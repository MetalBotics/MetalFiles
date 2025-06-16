import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';
import { downloadTokens, cleanupExpiredTokens } from '../tokenStorage';

// Configure for large file uploads
export const runtime = 'nodejs';
export const maxDuration = 900; // 15 minutes for very large uploads (up to 10GB)

export async function POST(request: NextRequest) {
  try {
    // Force HTTPS in production
    if (process.env.NODE_ENV === 'production') {
      const isHTTPS = request.headers.get('x-forwarded-proto') === 'https' || 
                     request.nextUrl.protocol === 'https:' ||
                     request.headers.get('x-forwarded-ssl') === 'on';
      
      if (!isHTTPS) {
        return NextResponse.json(
          { error: 'HTTPS required for secure file upload' }, 
          { status: 400 }
        );
      }
    }

    const data = await request.formData();
    
    console.log('Received FormData keys:', Array.from(data.keys()));
    
    const encryptedFile: File | null = data.get('encryptedFile') as unknown as File;
    const encryptionKey = data.get('encryptionKey') as string;
    const iv = data.get('iv') as string;
    const salt = data.get('salt') as string;
    const metadataIv = data.get('metadataIv') as string;
    const originalName = data.get('originalName') as string;
    const originalSize = parseInt(data.get('originalSize') as string);

    console.log('Parsed data:', {
      encryptedFile: !!encryptedFile,
      encryptionKey: !!encryptionKey,
      iv: !!iv,
      salt: !!salt,
      metadataIv: !!metadataIv,
      originalName,
      originalSize
    });

    if (!encryptedFile || !encryptionKey || !iv || !salt || !metadataIv || !originalName) {
      console.log('Missing required fields');
      return NextResponse.json({ success: false, error: 'Missing required encryption data.' }, { status: 400 });
    }    const bytes = await encryptedFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create uploads directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'uploads');
    
    // Ensure directory exists without creating unnecessary files
    const { mkdir } = await import('fs/promises');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (err) {
      // Directory already exists, ignore error
    }
    
    // Create a unique filename to avoid conflicts
    const timestamp = Date.now();
    const filename = `${timestamp}-encrypted`;
    const path = join(uploadDir, filename);

    // Write the encrypted file
    await writeFile(path, buffer);
    
    // Generate a secure download token
    const downloadToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now
      // Store the token with file info and encryption metadata
    await downloadTokens.set(downloadToken, {
      filename,
      originalName: originalName,
      size: originalSize,
      expiresAt,
      encryptionKey,
      iv,
      salt,
      metadataIv
    });
    console.log('Token stored:', downloadToken);
    console.log('Token data:', { filename, originalName, size: originalSize, expiresAt });
    console.log('Total tokens in storage:', await downloadTokens.size());    // Generate download URL (pointing to the download page, not API)
    // Ensure we use the correct protocol and host from the request
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const protocol = forwardedProto || (request.nextUrl.protocol.replace(':', ''));
    const host = request.headers.get('host') || request.nextUrl.host;
    const downloadUrl = `${protocol}://${host}/download/${downloadToken}`;
    
    console.log(`Generated download URL: ${downloadUrl}`);
    console.log(`Request origin: ${request.nextUrl.origin}`);
    console.log(`X-Forwarded-Proto: ${forwardedProto}`);
    console.log(`Host header: ${request.headers.get('host')}`);
    console.log(`Encrypted file uploaded: ${filename}, Original: ${originalName}, Size: ${originalSize} bytes, Download token: ${downloadToken}`);

    // Trigger cleanup of expired files in the background
    cleanupExpiredTokens().catch(err => 
      console.error('Background cleanup failed:', err)
    );

    return NextResponse.json({ 
      success: true, 
      message: 'File uploaded and encrypted successfully',
      filename: filename,
      originalName: originalName,
      size: originalSize,
      downloadUrl: downloadUrl,
      downloadToken: downloadToken,
      expiresAt: new Date(expiresAt).toISOString()
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to upload file' 
    }, { status: 500 });
  }
}
