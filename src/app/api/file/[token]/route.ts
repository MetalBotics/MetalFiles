import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, existsSync, statSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { downloadTokens } from '../../tokenStorage';
import { apiRateLimiter, checkRateLimit } from '../../rateLimiter';

// Configure for large file downloads
export const runtime = 'nodejs';
export const maxDuration = 900; // 15 minutes for very large downloads (up to 10GB)

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
    
    // Check if token exists and is valid
    const tokenData = await downloadTokens.get(token);
    
    if (!tokenData) {
      return NextResponse.json(
        { error: 'Invalid download token' }, 
        { status: 404 }
      );
    }
    
    // Check if token has expired
    if (Date.now() > tokenData.expiresAt) {
      await downloadTokens.delete(token); // Clean up expired token
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
    }    try {
      // Get file stats for content length
      const stats = statSync(filePath);
      
      // Use dynamic import for readFile to handle the missing import
      const { readFile } = await import('fs/promises');
      
      // For very large files (>1GB), we should consider additional optimizations
      if (stats.size > 1024 * 1024 * 1024) { // 1GB threshold
        console.log(`Serving large file: ${tokenData.originalName}, Size: ${(stats.size / 1024 / 1024 / 1024).toFixed(2)}GB`);
      }
      
      // Read the encrypted file
      const encryptedFileBuffer = await readFile(filePath);
        // Return encrypted file as binary data with metadata in headers
      const response = new NextResponse(new Uint8Array(encryptedFileBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': encryptedFileBuffer.length.toString(),
          'X-Encryption-Key': tokenData.encryptionKey,
          'X-IV': tokenData.iv,
          'X-Salt': tokenData.salt,
          'X-Original-Name': encodeURIComponent(tokenData.originalName),
          'X-Original-Size': tokenData.size.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': (rateLimit.remaining || 0).toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetTime || Date.now() + 60000).toISOString()
        }
      });
      
      console.log(`Encrypted file served: ${tokenData.originalName}, Size: ${encryptedFileBuffer.length} bytes`);
      
      // Delete the encrypted file from server after successful serving
      try {
        await unlink(filePath);
        console.log(`Encrypted file deleted from server: ${tokenData.filename}`);
      } catch (deleteError) {
        console.error('Error deleting encrypted file from server:', deleteError);
        // Don't fail the response if file deletion fails
      }
        // Remove token from storage since file is served and deleted
      await downloadTokens.delete(token);
      console.log(`Token removed: ${token}`);
      
      return response;
      
    } catch (fileError) {
      console.error('Error reading encrypted file:', fileError);
      return NextResponse.json(
        { error: 'Error reading encrypted file from disk' }, 
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
