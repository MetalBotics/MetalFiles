import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { downloadTokens } from '../../tokenStorage';
import { apiRateLimiter, checkRateLimit } from '../../rateLimiter';

export async function DELETE(
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
    }, {
      headers: {
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': (rateLimit.remaining || 0).toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetTime || Date.now() + 60000).toISOString()
      }
    });

  } catch (error) {
    console.error('Error in delete route:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
