#!/bin/bash

# PM2 Deployment Script for MetalFiles File Transfer

echo "🚀 Deploying MetalFiles with PM2..."

# Set working directory
cd /home/ubuntu/filetransfer

# Pull latest changes (if using git)
# git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Build the application
echo "🔨 Building application..."
npm run build

# Create logs directory if it doesn't exist
mkdir -p logs

# Stop existing PM2 process if running
echo "🛑 Stopping existing PM2 processes..."
pm2 stop filetransfer 2>/dev/null || true
pm2 delete filetransfer 2>/dev/null || true

# Start with PM2
echo "▶️  Starting application with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup PM2 startup script (run this once)
echo "🔧 Setting up PM2 startup script..."
pm2 startup

echo "✅ Deployment complete!"
echo ""
echo "📊 Application Status:"
pm2 status

echo ""
echo "📋 Useful commands:"
echo "  View logs:     pm2 logs filetransfer"
echo "  Monitor:       pm2 monit"
echo "  Restart:       pm2 restart filetransfer"
echo "  Stop:          pm2 stop filetransfer"
echo "  Status:        pm2 status"
