import { NextRequest, NextResponse } from 'next/server';
import UploadSessionManager from '../../uploadSessionManager';

export async function POST(request: NextRequest) {
  try {
    console.log('=== START UPLOAD SESSION REQUEST ===');
    const requestData = await request.json();
    const {
      originalName,
      originalSize,
      totalSize,
      totalChunks,
      encryptionKey,
      iv,
      salt,
      metadataIv
      , pwSalt, pwVerifier
    } = requestData;

    console.log('Session start request:', {
      originalName,
      originalSize,
      totalSize,
      totalChunks,
      hasEncryptionKey: !!encryptionKey,
      hasIv: !!iv,
      hasSalt: !!salt,
      hasMetadataIv: !!metadataIv
    });

    // Validate required fields
    if (!originalName || !originalSize || !totalSize || !totalChunks || !encryptionKey || !iv || !salt || !metadataIv) {
      console.error('Missing required fields in session start');
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }

    const sessionManager = UploadSessionManager.getInstance();
    console.log('Creating session...');
    
    const uploadId = sessionManager.createSession({
      originalName,
      originalSize,
      totalSize,
      totalChunks,
      encryptionKey,
      iv,
      salt,
      metadataIv
      , pwSalt, pwVerifier
    });

    console.log('Session created successfully:', uploadId);
    
    // Debug: Verify session was created
    const verifySession = sessionManager.getSession(uploadId);
    console.log('Session verification:', !!verifySession);

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
