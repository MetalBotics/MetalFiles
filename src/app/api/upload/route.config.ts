// API Route configuration for large file uploads
export const config = {
  api: {
    bodyParser: false, // Disable default body parser
    responseLimit: false, // Disable response size limit
  },
  runtime: 'nodejs',
  maxDuration: 900, // 15 minutes
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10GB
export const CHUNK_SIZE = 64 * 1024; // 64KB chunks for streaming
