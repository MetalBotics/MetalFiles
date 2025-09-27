// Simple in-memory rate limiter
// In production, you might want to use Redis or a database for persistence

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private cache = new Map<string, RateLimitEntry>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 5, windowMs: number = 60000) { // 5 requests per minute
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  isAllowed(ip: string): boolean {
    const now = Date.now();
    const entry = this.cache.get(ip);

    if (!entry || now > entry.resetTime) {
      // First request or window expired, reset
      this.cache.set(ip, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false; // Rate limit exceeded
    }

    // Increment count
    entry.count++;
    return true;
  }

  getRemainingRequests(ip: string): number {
    const entry = this.cache.get(ip);
    if (!entry || Date.now() > entry.resetTime) {
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - entry.count);
  }

  getResetTime(ip: string): number {
    const entry = this.cache.get(ip);
    if (!entry || Date.now() > entry.resetTime) {
      return Date.now() + this.windowMs;
    }
    return entry.resetTime;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.cache.entries()) {
      if (now > entry.resetTime) {
        this.cache.delete(ip);
      }
    }
  }
}

// Create a single shared rate limiter instance for all API endpoints
export const apiRateLimiter = new RateLimiter(5, 60000); // 5 API calls per minute (shared across all endpoints)

// Special rate limiter for large file uploads (more lenient)
// Allow more re-uploads in a short period to support user retries and password changes
export const uploadRateLimiter = new RateLimiter(50, 300000); // 50 upload attempts per 5 minutes

// Lightweight, permissive limiter for status checks (file-info)
// These endpoints are expected to be polled or refreshed frequently by the UI.
export const infoRateLimiter = new RateLimiter(50, 60000); // 50 checks per minute

// Helper function to get client IP
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  // Fallback (not reliable in production behind proxy)
  return 'unknown';
}

// Helper function to apply rate limiting
export function checkRateLimit(rateLimiter: RateLimiter, request: Request) {
  const ip = getClientIP(request);
  const isAllowed = rateLimiter.isAllowed(ip);
  
  if (!isAllowed) {
    const resetTime = rateLimiter.getResetTime(ip);
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    
    return {
      allowed: false,
      ip,
      retryAfter,
      resetTime
    };
  }
  
  return {
    allowed: true,
    ip,
    remaining: rateLimiter.getRemainingRequests(ip),
    resetTime: rateLimiter.getResetTime(ip)
  };
}
