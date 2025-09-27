import { NextRequest, NextResponse } from 'next/server';
import { existsSync, statSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';
import { downloadTokens } from '../../tokenStorage';
import { aliases, normalizeAlias } from '../../aliasStorage';
import { apiRateLimiter, checkRateLimit } from '../../rateLimiter';

// Configure for large file downloads
export const runtime = 'nodejs';
export const maxDuration = 900; // 15 minutes for very large downloads (up to 10GB)

// Server-side decryption function using Node.js crypto
async function decryptFile(
  encryptedBuffer: Buffer,
  password: string,
  iv: string,
  salt: string,
  originalSize: number
): Promise<Buffer> {
  try {
    // Convert base64 strings back to buffers (client uses btoa which is base64)
    const ivBuffer = Buffer.from(iv, 'base64');
    const saltBuffer = Buffer.from(salt, 'base64');

    // Derive key from password using PBKDF2
    const keyBuffer = crypto.pbkdf2Sync(password, saltBuffer, 100000, 32, 'sha256');

    // Decrypt each chunk individually and concatenate
    const CHUNK_SIZE = 5 * 1024 * 1024; // Must match client chunk size
    const decryptedChunks: Buffer[] = [];
    let offset = 0;
    let processed = 0;

    while (processed < originalSize) {
      const currentChunkSize = Math.min(CHUNK_SIZE, originalSize - processed);
      const encryptedChunkLength = currentChunkSize + 16; // ciphertext + auth tag
      const chunk = encryptedBuffer.slice(offset, offset + encryptedChunkLength);

      const authTag = chunk.slice(-16);
      const encryptedData = chunk.slice(0, -16);

      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
      ]);

      decryptedChunks.push(decrypted);
      offset += encryptedChunkLength;
      processed += currentChunkSize;
    }

    return Buffer.concat(decryptedChunks);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to decrypt file on server: ${message}`);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    // Check rate limit first
    const rateLimit = checkRateLimit(apiRateLimiter, request);
    
    if (!rateLimit.allowed) {
      const retryAfter = rateLimit.retryAfter || 60;
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded.',
          retryAfter: retryAfter
        }, 
        { 
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0'
          }
        }
      );
    }

    const { token } = await params;
    
    // Resolve token or alias
    let resolvedToken = token;
    let usedAlias = false;
    let tokenData = await downloadTokens.get(resolvedToken);
    if (!tokenData) {
      const mapped = await aliases.get(normalizeAlias(resolvedToken));
      if (mapped) {
        resolvedToken = mapped;
        usedAlias = true;
        tokenData = await downloadTokens.get(resolvedToken);
      }
    }
    
    if (!tokenData) {
      return NextResponse.json(
        { error: 'Invalid download token' }, 
        { status: 404 }
      );
    }
    
    // Check if token has expired
    if (Date.now() > tokenData.expiresAt) {
      await downloadTokens.delete(resolvedToken); // Clean up expired token
      if (usedAlias) {
        await aliases.delete(normalizeAlias(token));
      }
      return NextResponse.json(
        { error: 'Download token has expired' }, 
        { status: 410 }
      );
    }
    
    // Build file path
    const uploadsDir = join(process.cwd(), 'uploads');
    const filePath = join(uploadsDir, tokenData.filename);

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found on server' },
        { status: 404 }
      );
    }

    // If this token is password-protected, require the client to supply a password
    const tokenAny: any = tokenData;
    if (tokenAny.pwVerifier) {
      // Prefer header, but accept query param ?password= for direct API links
      let providedPw = request.headers.get('x-download-password') || '';
      if (!providedPw) {
        try {
          const url = new URL(request.url);
          providedPw = url.searchParams.get('password') || '';
        } catch (e) {
          // ignore URL parse errors and fall through
        }
      }

      if (!providedPw) {
        return NextResponse.json({ error: 'Password required for this download' }, { status: 401 });
      }

      try {
        // Derive key buffer from provided password using salt
        const saltBuffer = Buffer.from(tokenAny.pwSalt, 'base64');
        const keyBuffer = crypto.pbkdf2Sync(providedPw, saltBuffer, 100000, 32, 'sha256');
        // Export derived key raw and compare base64
        const providedBase64 = keyBuffer.toString('base64');
        if (providedBase64 !== tokenAny.pwVerifier) {
          return NextResponse.json({ error: 'Invalid password' }, { status: 403 });
        }
      } catch (err) {
        console.error('Error verifying password for token:', err);
        return NextResponse.json({ error: 'Invalid password' }, { status: 403 });
      }
    }
    try {
      // Get file stats for logging purposes
      const stats = statSync(filePath);
      if (stats.size > 1024 * 1024 * 1024) {
        console.log(
          `Serving large file: ${tokenData.originalName}, Size: ${(stats.size / 1024 / 1024 / 1024).toFixed(2)}GB`
        );
      }

      // Read and decrypt the file on the server
      const encryptedBuffer = await readFile(filePath);
      const decryptedBuffer = await decryptFile(
        encryptedBuffer,
        tokenData.encryptionKey,
        tokenData.iv,
        tokenData.salt,
        tokenData.size
      );

      // Prepare response headers
      const fileExtension = tokenData.originalName.split('.').pop()?.toLowerCase();
      const mimeType = getMimeType(fileExtension);

      const response = new NextResponse(new Uint8Array(decryptedBuffer), {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${tokenData.originalName}"`,
          'Content-Length': decryptedBuffer.length.toString(),
          'X-Original-Name': encodeURIComponent(tokenData.originalName),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': (rateLimit.remaining || 0).toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetTime || Date.now() + 60000).toISOString()
        }
      });

      // Delete the decrypted file and token after serving
      try {
        await unlink(filePath);
        console.log(`Physical file deleted: ${tokenData.filename}`);
      } catch (deleteError) {
        console.error('Error deleting physical file:', deleteError);
      }

      await downloadTokens.delete(resolvedToken);
      if (usedAlias) {
        await aliases.delete(normalizeAlias(token));
      }
      console.log(`Token removed: ${resolvedToken}`);

      return response;

    } catch (fileError) {
      console.error('Error serving decrypted file:', fileError);
      return NextResponse.json(
        { error: 'Failed to decrypt file' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in download route:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

function getMimeType(extension?: string): string {
  const mimeTypes: { [key: string]: string } = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    txt: 'text/plain',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    mp4: 'video/mp4',
    mp3: 'audio/mpeg',
    json: 'application/json',
    xml: 'application/xml'
  };

  return mimeTypes[extension || ''] || 'application/octet-stream';
}
