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
};

export default nextConfig;
