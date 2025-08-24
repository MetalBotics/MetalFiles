import { NextRequest, NextResponse } from 'next/server';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { downloadTokens } from '../../tokenStorage';
import { aliases, normalizeAlias } from '../../aliasStorage';
import { apiRateLimiter, checkRateLimit } from '../../rateLimiter';

// Server-side decryption function using Node.js crypto
async function decryptFile(
  encryptedBuffer: Buffer,
  password: string,
  iv: string,
  salt: string
): Promise<Buffer> {
  try {
    console.log('Decryption parameters:', { 
      passwordLength: password.length, 
      ivLength: iv.length, 
      saltLength: salt.length,
      encryptedBufferLength: encryptedBuffer.length 
    });
      // Convert base64 strings back to buffers (client uses btoa which is base64)
    let ivBuffer: Buffer;
    let saltBuffer: Buffer;
    
    try {
      // The client sends IV and salt as base64 (using btoa), not hex
      ivBuffer = Buffer.from(iv, 'base64');
      saltBuffer = Buffer.from(salt, 'base64');
      
      console.log('Parsed buffer lengths:', { 
        ivBufferLength: ivBuffer.length, 
        saltBufferLength: saltBuffer.length 
      });
      
      // AES-GCM requires 12-byte IV
      if (ivBuffer.length !== 12) {
        throw new Error(`Invalid IV length: expected 12 bytes, got ${ivBuffer.length}`);
      }
      
      // Salt should be 16 bytes
      if (saltBuffer.length !== 16) {
        throw new Error(`Invalid salt length: expected 16 bytes, got ${saltBuffer.length}`);
      }
      
    } catch (parseError) {
      console.error('Error parsing base64 strings:', parseError);
      throw new Error('Invalid IV or salt format');
    }
    
    // Derive key from password using PBKDF2 (matching client-side derivation)
    const keyBuffer = crypto.pbkdf2Sync(password, saltBuffer, 100000, 32, 'sha256');
    console.log('Key derived, length:', keyBuffer.length);
    
    // Create decipher for AES-256-GCM
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
    
    // For AES-GCM, the auth tag is appended to the encrypted data
    // Extract the auth tag (last 16 bytes) and the encrypted data
    const authTag = encryptedBuffer.slice(-16);
    const encryptedData = encryptedBuffer.slice(0, -16);
    
    console.log('Auth tag length:', authTag.length, 'Encrypted data length:', encryptedData.length);
    
    decipher.setAuthTag(authTag);
    
    // Decrypt the data
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);
    
    console.log('Decryption successful, decrypted length:', decrypted.length);
    return decrypted;
      } catch (error) {
    console.error('Server-side decryption error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to decrypt file on server: ${errorMessage}`);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
      // Check rate limit first
    const rateLimit = checkRateLimit(apiRateLimiter, request);
    
    if (!rateLimit.allowed) {
      console.log(`Download rate limit exceeded for IP: ${rateLimit.ip}`);
      const retryAfter = rateLimit.retryAfter || 60;
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Too many download attempts.',
          retryAfter: retryAfter
        }, 
        { 
          status: 429,          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimit.resetTime || Date.now() + 60000).toISOString()
          }
        }
      );
    }

    console.log(`Download request from IP: ${rateLimit.ip}, remaining: ${rateLimit.remaining}`);
    
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
    
    // Check if file exists
    const filePath = join(process.cwd(), 'uploads', tokenData.filename);
    
    if (!existsSync(filePath)) {
      await downloadTokens.delete(token); // Clean up token for missing file
      return NextResponse.json(
        { error: 'File not found' }, 
        { status: 404 }
      );
    }    // Read the encrypted file
    const encryptedBuffer = await readFile(filePath);
    
    try {
      // Decrypt the file using server-side crypto
      const decryptedBuffer = await decryptFile(
        encryptedBuffer,
        tokenData.encryptionKey,
        tokenData.iv,
        tokenData.salt
      );
      
      // Delete the token after successful download (one-time use)
      await downloadTokens.delete(resolvedToken);
      if (usedAlias) {
        await aliases.delete(normalizeAlias(token));
      }
      console.log(`Token ${resolvedToken} deleted after successful download of ${tokenData.originalName}`);
      
      // Delete the physical file after successful download (one-time use)
      try {
        await unlink(filePath);
        console.log(`Physical file deleted: ${tokenData.filename}`);
      } catch (deleteError) {
        console.error('Error deleting physical file:', deleteError);
        // Don't fail the response if file deletion fails
      }
      
      // Get file extension for MIME type
      const fileExtension = tokenData.originalName.split('.').pop()?.toLowerCase();
      const mimeType = getMimeType(fileExtension);
        // Return the decrypted file with correct headers
      return new NextResponse(new Uint8Array(decryptedBuffer), {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${tokenData.originalName}"`,
          'Content-Length': decryptedBuffer.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': (rateLimit.remaining || 0).toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetTime || Date.now() + 60000).toISOString()
        }
      });
      
    } catch (decryptError) {
      console.error('Decryption error:', decryptError);
      return NextResponse.json(
        { error: 'Failed to decrypt file' }, 
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download file' }, 
      { status: 500 }
    );
  }
}

function getMimeType(extension?: string): string {
  const mimeTypes: { [key: string]: string } = {
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'txt': 'text/plain',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    'mp4': 'video/mp4',
    'mp3': 'audio/mpeg',
    'json': 'application/json',
    'xml': 'application/xml'
  };
  
  return mimeTypes[extension || ''] || 'application/octet-stream';
}
