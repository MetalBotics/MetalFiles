import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { downloadTokens } from '../../tokenStorage';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = await params;
    
    // Check if token exists
    const tokenData = await downloadTokens.get(token);
    
    if (!tokenData) {
      return NextResponse.json(
        { error: 'Token not found' }, 
        { status: 404 }
      );
    }
    
    // Build file path
    const uploadsDir = join(process.cwd(), 'uploads');
    const filePath = join(uploadsDir, tokenData.filename);
    
    // Delete the file from server if it exists
    if (existsSync(filePath)) {
      try {
        await unlink(filePath);
        console.log(`File deleted by user: ${tokenData.filename}`);
      } catch (fileError) {
        console.error('Error deleting file:', fileError);
        return NextResponse.json(
          { error: 'Failed to delete file from server' }, 
          { status: 500 }
        );
      }
    }
    
    // Remove token from storage
    await downloadTokens.delete(token);
    console.log(`Token removed by user: ${token}`);
    
    return NextResponse.json({
      success: true,
      message: 'File and token deleted successfully'
    });

  } catch (error) {
    console.error('Error in delete route:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
