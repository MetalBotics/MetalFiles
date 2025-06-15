import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    const url = request.nextUrl.clone();
    
    // Check if the request is not already HTTPS
    const isHTTPS = request.headers.get('x-forwarded-proto') === 'https' || 
                   url.protocol === 'https:' ||
                   request.headers.get('x-forwarded-ssl') === 'on';
    
    // Check if we're on the correct domain
    const hostname = request.headers.get('host') || url.hostname;
    const isCorrectDomain = hostname === 'metalfiles.tech' || hostname === 'www.metalfiles.tech';
    
    if (!isHTTPS && isCorrectDomain) {
      // Redirect to HTTPS
      url.protocol = 'https:';
      url.host = 'metalfiles.tech'; // Normalize to non-www
      return NextResponse.redirect(url, { status: 301 });
    }
    
    // Redirect www to non-www over HTTPS
    if (isHTTPS && hostname === 'www.metalfiles.tech') {
      url.host = 'metalfiles.tech';
      return NextResponse.redirect(url, { status: 301 });
    }
  }

  // Set security headers
  const response = NextResponse.next();
  
  // Force HTTPS and set security headers
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
