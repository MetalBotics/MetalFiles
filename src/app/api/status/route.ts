import { NextRequest, NextResponse } from 'next/server';
import { downloadTokens } from '../tokenStorage';
import { apiRateLimiter, checkRateLimit } from '../rateLimiter';

export async function GET(request: NextRequest) {
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

    const now = Date.now();
    let totalFiles = 0;
    let expiredFiles = 0;
    let validFiles = 0;
    const files: Array<{
      originalName: string;
      size: number;
      expiresAt: string;
      isExpired: boolean;
      timeRemaining: string;
    }> = [];
    
    const validTokens: Array<{
      id: string;
      fileName: string;
      downloadUrl: string;
      expiresAt: string;
      token: string;
    }> = [];

    const entries = await downloadTokens.entries();
    for (const [token, data] of entries) {
      totalFiles++;
      const isExpired = now > data.expiresAt;
      
      if (isExpired) {
        expiredFiles++;
      } else {
        validFiles++;        // Add to valid tokens for download URLs
        // Generate absolute URL using request headers (same logic as upload API)
        const forwardedProto = request.headers.get('x-forwarded-proto');
        const protocol = forwardedProto || (request.nextUrl.protocol.replace(':', ''));
        const host = request.headers.get('host') || request.nextUrl.host;
        const downloadUrl = `${protocol}://${host}/download/${token}`;
        
        validTokens.push({
          id: token, // Use token directly as ID for consistency
          fileName: data.originalName,
          downloadUrl: downloadUrl,
          expiresAt: new Date(data.expiresAt).toISOString(),
          token: token
        });
      }

      const timeRemaining = isExpired 
        ? 'Expired' 
        : `${Math.round((data.expiresAt - now) / (1000 * 60 * 60))} hours`;

      files.push({
        originalName: data.originalName,
        size: data.size,
        expiresAt: new Date(data.expiresAt).toISOString(),
        isExpired,
        timeRemaining
      });
    }    return NextResponse.json({
      success: true,
      stats: {
        totalFiles,
        validFiles,
        expiredFiles
      },
      files: files.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)),
      validTokens: validTokens.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
    }, {
      headers: {
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': (rateLimit.remaining || 0).toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetTime || Date.now() + 60000).toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting file status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get file status'
    }, { status: 500 });
  }
}
