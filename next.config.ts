import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Move serverComponentsExternalPackages to the correct location
  serverExternalPackages: [],
  
  // Override default request size limits for file uploads
  experimental: {
    // Set maximum request body size to 10GB for large file support
    serverActions: {
      bodySizeLimit: '10gb',
    },
  },
  
  // Configure on-demand entries for better performance
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },

  // Force HTTPS in production
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ],
      },
    ];
  },

  // Redirect HTTP to HTTPS
  async redirects() {
    return [
      {
        source: '/(.*)',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://metalfiles.tech/:path*',
        permanent: true,
      },
      // Redirect www to non-www
      {
        source: '/(.*)',
        has: [
          {
            type: 'host',
            value: 'www.metalfiles.tech',
          },
        ],
        destination: 'https://metalfiles.tech/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
