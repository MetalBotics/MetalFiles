#!/bin/bash

# Production startup script for HTTPS enforcement

echo "Starting MetalFiles in production mode with HTTPS..."

# Set environment
export NODE_ENV=production
export FORCE_HTTPS=true

# Build if needed
if [ ! -d ".next" ]; then
    echo "Building application..."
    npm run build
fi

# Start with HTTPS on the specified port
echo "Starting server on HTTPS with port ${PORT:-28126}..."
PORT=${PORT:-28126} npm start

echo "Server started at https://localhost:${PORT:-28126}"
