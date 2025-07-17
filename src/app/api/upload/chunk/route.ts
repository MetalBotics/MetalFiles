import { NextRequest, NextResponse } from 'next/server';
import UploadSessionManager from '../../uploadSessionManager';

export async function POST(request: NextRequest) {
  try {
    console.log('=== CHUNK UPLOAD REQUEST ===');
    const formData = await request.formData();
    const uploadId = formData.get('uploadId') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const chunkFile = formData.get('chunk') as File;

    console.log('Chunk upload request details:', {
      uploadId,
      chunkIndex,
      chunkFileSize: chunkFile?.size,
      hasChunkFile: !!chunkFile
    });

    if (!uploadId || isNaN(chunkIndex) || !chunkFile) {
      console.error('Missing required parameters for chunk upload');
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters'
      }, { status: 400 });
    }

    const sessionManager = UploadSessionManager.getInstance();
    console.log('Looking for session:', uploadId);
    
    // Debug: Check all existing sessions
    const allSessions = (sessionManager as any).sessions;
    console.log('Total sessions in memory:', allSessions.size);
    console.log('Session IDs:', Array.from(allSessions.keys()));
    
    const session = sessionManager.getSession(uploadId);
    console.log('Session found:', !!session);

    if (!session) {
      console.error('Upload session not found:', uploadId);
      console.log('Available sessions:', Array.from(allSessions.keys()));
      return NextResponse.json({
        success: false,
        error: 'Upload session not found'
      }, { status: 404 });
    }

    // Convert chunk to buffer
    const chunkArrayBuffer = await chunkFile.arrayBuffer();
    const chunkBuffer = Buffer.from(chunkArrayBuffer);    // Store chunk
    const success = sessionManager.addChunk(uploadId, chunkIndex, chunkBuffer);
    
    if (!success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to store chunk'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Chunk ${chunkIndex + 1}/${session.totalChunks} received`,
      chunksReceived: session.chunks.size,
      totalChunks: session.totalChunks
    });

  } catch (error) {
    console.error('Error uploading chunk:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to upload chunk'
    }, { status: 500 });
  }
}
