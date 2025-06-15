import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Increase the body size limit for file uploads
    serverComponentsExternalPackages: [],
  },
  // Set maximum request body size to 10GB
  api: {
    bodyParser: {
      sizeLimit: '10gb',
    },
  },
  // Override default request size limits
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
};

export default nextConfig;
