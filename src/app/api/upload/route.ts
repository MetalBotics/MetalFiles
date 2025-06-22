import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';
import { downloadTokens, cleanupExpiredTokens } from '../tokenStorage';
import { uploadRateLimiter, checkRateLimit } from '../rateLimiter';

// Configure for large file uploads
export const runtime = 'nodejs';
export const maxDuration = 900; // 15 minutes for very large uploads (up to 10GB)

// Increase body size limit for this API route
export const dynamic = 'force-dynamic';

// Custom body parser configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10GB in bytes

export async function POST(request: NextRequest) {
  console.log('=== UPLOAD REQUEST START ===');
  console.log('Content-Length:', request.headers.get('content-length'));
  console.log('Content-Type:', request.headers.get('content-type'));
  console.log('User-Agent:', request.headers.get('user-agent'));
  
  try {    // Check rate limit first (use special upload rate limiter for large files)
    const rateLimit = checkRateLimit(uploadRateLimiter, request);
      if (!rateLimit.allowed) {
      console.log(`Rate limit exceeded for IP: ${rateLimit.ip}`);
      const retryAfter = rateLimit.retryAfter || 60;
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: retryAfter
        },        { 
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': '3',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimit.resetTime || Date.now() + 300000).toISOString()
          }
        }
      );
    }

    console.log(`Upload request from IP: ${rateLimit.ip}, remaining: ${rateLimit.remaining}`);

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
      }    }

    // Parse form data with extended timeout for large files
    let data: FormData;
    try {
      console.log('Parsing form data for large file upload...');
      console.log('Content-Length:', request.headers.get('content-length'));
        // Use Next.js built-in formData() with timeout protection
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Upload timeout - file may be too large or connection too slow')), 15 * 60 * 1000); // 15 minutes
      });

      const formDataPromise = request.formData();
      
      data = await Promise.race([formDataPromise, timeoutPromise]);
      console.log('Form data parsed successfully');
    } catch (parseError) {
      console.error('Error parsing form data:', parseError);
      const errorMessage = parseError instanceof Error ? parseError.message : 'Failed to parse upload data';
      
      if (errorMessage.includes('timeout')) {
        return NextResponse.json({
          success: false,
          error: 'Upload timeout. File may be too large or connection too slow. Try a smaller file or better connection.'
        }, { status: 408 });
      }
      
      return NextResponse.json({
        success: false,
        error: errorMessage
      }, { status: 400 });
    }
    
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
    });    if (!encryptedFile || !encryptionKey || !iv || !salt || !metadataIv || !originalName) {
      console.log('Missing required fields');
      return NextResponse.json({ success: false, error: 'Missing required encryption data.' }, { status: 400 });
    }    // Validate file sizes
    if (encryptedFile.size > MAX_FILE_SIZE) {
      console.log(`Encrypted file too large: ${encryptedFile.size} bytes (max: ${MAX_FILE_SIZE})`);
      return NextResponse.json({ 
        success: false, 
        error: `File too large. Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB.` 
      }, { status: 413 });
    }

    if (originalSize > MAX_FILE_SIZE) {
      console.log(`Original file too large: ${originalSize} bytes (max: ${MAX_FILE_SIZE})`);
      return NextResponse.json({ 
        success: false, 
        error: `File too large. Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB.` 
      }, { status: 413 });
    }

    console.log(`Processing file: ${originalName}, encrypted size: ${encryptedFile.size} bytes, original size: ${originalSize} bytes`);    console.log(`Processing file: ${originalName}, encrypted size: ${encryptedFile.size} bytes, original size: ${originalSize} bytes`);

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
    const path = join(uploadDir, filename);    // Process the file based on size
    if (encryptedFile.size > 100 * 1024 * 1024) { // 100MB threshold for special handling
      console.log('Processing large file (>100MB)');
      
      try {
        console.log(`Processing large file: ${encryptedFile.name} (${encryptedFile.size} bytes)`);
        const arrayBuffer = await encryptedFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await writeFile(path, buffer);
        console.log(`Large file written successfully: ${filename}, size: ${buffer.length} bytes`);
      } catch (processingError) {
        console.error('Error processing large file:', processingError);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to process large file. Please try again or reduce file size.' 
        }, { status: 500 });
      }
    } else {
      // For smaller files, use the standard approach
      console.log('Processing normal file (<100MB)');
      const bytes = await encryptedFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(path, buffer);
      console.log(`File written successfully: ${filename}, size: ${buffer.length} bytes`);
    }
    
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
    );    return NextResponse.json({ 
      success: true, 
      message: 'File uploaded and encrypted successfully',
      filename: filename,
      originalName: originalName,
      size: originalSize,
      downloadUrl: downloadUrl,
      downloadToken: downloadToken,
      expiresAt: new Date(expiresAt).toISOString()    }, {
      headers: {
        'X-RateLimit-Limit': '3',
        'X-RateLimit-Remaining': (rateLimit.remaining || 0).toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetTime || Date.now() + 300000).toISOString()
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to upload file';
    if (error instanceof Error) {
      if (error.message.includes('Request entity too large')) {
        errorMessage = 'File too large. Maximum file size is 10GB.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Upload timeout. Large files may take longer to process.';
      } else if (error.message.includes('ENOSPC')) {
        errorMessage = 'Server storage full. Please try again later.';
      } else if (error.message.includes('memory')) {
        errorMessage = 'Server memory limit reached. Please try a smaller file.';
      }
    }
    
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}
