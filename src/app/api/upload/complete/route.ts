import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';
import { downloadTokens, cleanupExpiredTokens } from '../../tokenStorage';
import UploadSessionManager from '../../uploadSessionManager';

export async function POST(request: NextRequest) {
  try {
    const { uploadId } = await request.json();

    if (!uploadId) {
      return NextResponse.json({
        success: false,
        error: 'Upload ID required'
      }, { status: 400 });
    }    const sessionManager = UploadSessionManager.getInstance();
    const session = sessionManager.getSession(uploadId);

    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'Upload session not found'
      }, { status: 404 });
    }    // Check if all chunks are received
    if (!sessionManager.isComplete(uploadId)) {
      return NextResponse.json({
        success: false,
        error: `Missing chunks. Expected ${session.totalChunks}, received ${session.chunks.size}`
      }, { status: 400 });
    }

    console.log(`Completing upload for session ${uploadId}: ${session.chunks.size} chunks`);

    // Assemble file from chunks
    const completeFile = sessionManager.assembleFile(uploadId);
    
    console.log(`File reconstructed: ${completeFile.length} bytes`);

    // Create uploads directory
    const uploadDir = join(process.cwd(), 'uploads');
    const { mkdir } = await import('fs/promises');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (err) {
      // Directory already exists
    }

    // Save file
    const timestamp = Date.now();
    const filename = `${timestamp}-encrypted`;
    const path = join(uploadDir, filename);

    await writeFile(path, completeFile);
    console.log(`File saved: ${filename}`);

    // Generate download token
    const downloadToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

    // Store token with file info
    await downloadTokens.set(downloadToken, {
      filename,
      originalName: session.originalName,
      size: session.originalSize,
      expiresAt,
      encryptionKey: session.encryptionKey,
      iv: Buffer.from(session.iv).toString('base64'),
      salt: Buffer.from(session.salt).toString('base64'),
      metadataIv: session.metadataIv
    });

    // Generate download URL
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host') || request.nextUrl.host;
    const downloadUrl = `${protocol}://${host}/download/${downloadToken}`;    // Clean up session
    sessionManager.deleteSession(uploadId);
    console.log(`Upload session ${uploadId} completed and cleaned up`);

    // Trigger cleanup of expired files
    cleanupExpiredTokens().catch(err => 
      console.error('Background cleanup failed:', err)
    );

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      filename,
      originalName: session.originalName,
      size: session.originalSize,
      downloadUrl,
      downloadToken,
      expiresAt: new Date(expiresAt).toISOString()
    });

  } catch (error) {
    console.error('Error completing upload:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to complete upload'
    }, { status: 500 });
  }
}
