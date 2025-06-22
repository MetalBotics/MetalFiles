import { NextRequest, NextResponse } from 'next/server';
import UploadSessionManager from '../../uploadSessionManager';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const uploadId = formData.get('uploadId') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const chunkFile = formData.get('chunk') as File;

    if (!uploadId || isNaN(chunkIndex) || !chunkFile) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters'
      }, { status: 400 });
    }    const sessionManager = UploadSessionManager.getInstance();
    const session = sessionManager.getSession(uploadId);

    if (!session) {
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
