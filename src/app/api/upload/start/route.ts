import { NextRequest, NextResponse } from 'next/server';
import UploadSessionManager from '../../uploadSessionManager';

export async function POST(request: NextRequest) {
  try {
    const {
      originalName,
      originalSize,
      totalSize,
      totalChunks,
      encryptionKey,
      iv,
      salt,
      metadataIv
    } = await request.json();

    // Validate required fields
    if (!originalName || !originalSize || !totalSize || !totalChunks || !encryptionKey || !iv || !salt || !metadataIv) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }

    const sessionManager = UploadSessionManager.getInstance();
    
    const uploadId = sessionManager.createSession({
      originalName,
      originalSize,
      totalSize,
      totalChunks,
      encryptionKey,
      iv,
      salt,
      metadataIv
    });

    return NextResponse.json({
      success: true,
      uploadId,
      message: 'Upload session started'
    });

  } catch (error) {
    console.error('Error starting upload session:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to start upload session'
    }, { status: 500 });
  }
}
