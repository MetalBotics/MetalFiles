# Large File Upload Troubleshooting Guide

## Common Issues with 1.5GB+ File Uploads

### 1. **Configuration Issues**

- ✅ **Fixed**: Updated `next.config.ts` with proper size limits
- ✅ **Fixed**: Added streaming for large files to reduce memory usage
- ✅ **Fixed**: Increased upload timeout to 15 minutes
- ✅ **Fixed**: Special rate limiting for uploads (3 attempts per 5 minutes)

### 2. **Browser/Network Issues**

- **Browser Memory**: Large files require significant memory for encryption
- **Network Timeout**: Upload may timeout on slow connections
- **Browser Limits**: Some browsers have built-in limits for large uploads

### 3. **Server Issues**

- **Memory Limits**: Server may run out of memory processing large files
- **Disk Space**: Server needs sufficient disk space for temporary files
- **Process Limits**: Node.js process may hit memory limits

## How to Test the Fix

### Step 1: Check Browser Console

```javascript
// Run this in browser console before uploading
const testFile = new File([""], "test.txt");
console.log("Browser support:", {
  crypto: !!window.crypto?.subtle,
  formData: !!FormData,
  arrayBuffer: !!ArrayBuffer,
});
```

### Step 2: Test with Smaller File First

1. Try uploading a 100MB file first
2. If successful, try 500MB
3. Then try your 1.5GB file

### Step 3: Monitor Upload Progress

- Check browser console for detailed logs
- Look for specific error messages
- Note where the upload fails (encryption, upload, server processing)

### Step 4: Check Server Resources

```bash
# Check available disk space
df -h

# Check memory usage
free -h

# Check Node.js process memory (if using PM2)
pm2 monit
```

## Expected Upload Times for 1.5GB File

| Connection Speed | Upload Time |
| ---------------- | ----------- |
| 10 Mbps          | ~20-25 min  |
| 25 Mbps          | ~8-10 min   |
| 100 Mbps         | ~2-3 min    |

## Error Codes and Solutions

### 413 - Payload Too Large

- **Cause**: Server rejecting large requests
- **Solution**: ✅ Fixed with updated configuration

### 429 - Too Many Requests

- **Cause**: Rate limiting
- **Solution**: ✅ Fixed with special upload rate limiter

### 504 - Gateway Timeout

- **Cause**: Upload taking too long
- **Solution**: ✅ Fixed with 15-minute timeout

### Memory Errors

- **Cause**: Insufficient server memory
- **Solution**: ✅ Implemented streaming approach

## Debugging Commands

### Check File Size Validation

```bash
# Check if file is within limits
node -e "
const file = { size: 1.5 * 1024 * 1024 * 1024 };
const maxSize = 10 * 1024 * 1024 * 1024;
console.log('File size:', file.size, 'Max:', maxSize, 'Valid:', file.size <= maxSize);
"
```

### Test Upload Endpoint

```bash
# Test with curl (replace with your file)
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: multipart/form-data" \
  -F "test=@small-test-file.txt" \
  -v
```

## If Upload Still Fails

1. **Check Browser Developer Tools Network Tab**

   - Look for the actual HTTP status code
   - Check if request is cancelled or times out

2. **Check Server Logs**

   ```bash
   # If using PM2
   pm2 logs filetransfer

   # Or check console in development
   npm run dev
   ```

3. **Try Reducing File Size**

   - Compress the file first
   - Split into smaller chunks if possible

4. **Check System Resources**
   - Available RAM
   - Available disk space
   - Network connectivity

## Environment Variables to Check

Create `.env.local`:

```env
MAX_FILE_SIZE_GB=10
UPLOAD_TIMEOUT_MINUTES=15
UPLOAD_RATE_LIMIT=3
UPLOAD_RATE_WINDOW_MINUTES=5
```

## Next Steps if Issues Persist

1. Enable detailed logging in upload route
2. Test with different file types
3. Test with different browsers
4. Consider implementing chunked uploads for very large files
5. Monitor server resources during upload

The configuration has been updated to handle 1.5GB files. Try uploading again and check the browser console for detailed error messages.
