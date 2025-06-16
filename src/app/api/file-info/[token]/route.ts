import { NextRequest, NextResponse } from 'next/server';
import { downloadTokens } from '../../tokenStorage';
import { apiRateLimiter, checkRateLimit } from '../../rateLimiter';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
      // Check rate limit (shared API rate limiter)
    const rateLimit = checkRateLimit(apiRateLimiter, request);
    
    if (!rateLimit.allowed) {
      const retryAfter = rateLimit.retryAfter || 60;
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded.',
          retryAfter: retryAfter
        }, 
        { 
          status: 429,          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0'
          }
        }
      );
    }
    
    console.log('File-info API called with token:', token);
    
    // Check if token exists and is valid
    const tokenData = await downloadTokens.get(token);
    
    console.log('Token data found:', tokenData);
    console.log('Total tokens in storage:', await downloadTokens.size());
    
    if (!tokenData) {
      console.log('Token not found in storage');
      return NextResponse.json(
        { error: 'Invalid download token', isValid: false }, 
        { status: 404 }
      );
    }
    
    // Check if token has expired
    if (Date.now() > tokenData.expiresAt) {
      await downloadTokens.delete(token); // Clean up expired token
      return NextResponse.json(
        { error: 'Download token has expired', isValid: false }, 
        { status: 410 }
      );
    }
      // Return file information
    return NextResponse.json({
      originalName: tokenData.originalName,
      size: tokenData.size,
      expiresAt: new Date(tokenData.expiresAt).toISOString(),
      isValid: true
    }, {
      headers: {
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': rateLimit.remaining?.toString() || '0',
        'X-RateLimit-Reset': new Date(rateLimit.resetTime || Date.now() + 60000).toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching file info:', error);
    return NextResponse.json(
      { error: 'Internal server error', isValid: false }, 
      { status: 500 }
    );
  }
}
