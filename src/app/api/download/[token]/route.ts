import { NextRequest, NextResponse } from 'next/server';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { downloadTokens } from '../../tokenStorage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
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
    
    // Check if file exists
    const filePath = join(process.cwd(), 'uploads', tokenData.filename);
    
    if (!existsSync(filePath)) {
      await downloadTokens.delete(token); // Clean up token for missing file
      return NextResponse.json(
        { error: 'File not found' }, 
        { status: 404 }
      );
    }
      // Read the file
    const fileBuffer = await readFile(filePath);
    
    // Get file extension for MIME type
    const fileExtension = tokenData.originalName.split('.').pop()?.toLowerCase();
    const mimeType = getMimeType(fileExtension);
      // Delete the token after successful download (one-time use)
    await downloadTokens.delete(token);
    console.log(`Token ${token} deleted after successful download of ${tokenData.originalName}`);
    
    // Delete the physical file after successful download (one-time use)
    try {
      await unlink(filePath);
      console.log(`Physical file deleted: ${tokenData.filename}`);
    } catch (deleteError) {
      console.error('Error deleting physical file:', deleteError);
      // Don't fail the response if file deletion fails
    }
    
    // Return the file with appropriate headers
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${tokenData.originalName}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
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
