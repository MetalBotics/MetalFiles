import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredTokens } from '../tokenStorage';
import { apiRateLimiter, checkRateLimit } from '../rateLimiter';

export async function POST(request: NextRequest) {
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

    console.log('Manual cleanup triggered');
    const deletedCount = await cleanupExpiredTokens();
    
    return NextResponse.json({
      success: true,
      message: `Cleanup completed: ${deletedCount} expired files removed`,
      deletedCount
    }, {
      headers: {
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': (rateLimit.remaining || 0).toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetTime || Date.now() + 60000).toISOString()
      }
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    return NextResponse.json({
      success: false,
      error: 'Cleanup failed'
    }, { status: 500 });
  }
}

// GET endpoint for manual cleanup via browser
export async function GET(request: NextRequest) {
  return POST(request);
}
