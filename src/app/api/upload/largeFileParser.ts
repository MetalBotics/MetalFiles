import { NextRequest } from 'next/server';
import { Readable } from 'stream';

export class LargeFileParser {
  static async parseFormData(request: NextRequest, maxSize: number = 10 * 1024 * 1024 * 1024): Promise<FormData> {
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    
    if (contentLength > maxSize) {
      throw new Error(`Request too large: ${contentLength} bytes (max: ${maxSize})`);
    }

    // For large files, we need to handle the request body carefully
    try {
      // Next.js formData() should handle large files, but with timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Form data parsing timeout')), 5 * 60 * 1000); // 5 minutes
      });

      const formDataPromise = request.formData();
      
      const formData = await Promise.race([formDataPromise, timeoutPromise]) as FormData;
      
      return formData;
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new Error('File too large or upload too slow. Please try a smaller file.');
      }
      throw error;
    }
  }

  static validateFileSize(file: File, maxSize: number): void {
    if (file.size > maxSize) {
      throw new Error(`File too large: ${file.size} bytes (max: ${maxSize})`);
    }
  }

  static async processLargeFile(file: File): Promise<ArrayBuffer> {
    // For very large files, we might want to process in chunks
    if (file.size > 1024 * 1024 * 1024) { // > 1GB
      console.log(`Processing large file: ${file.name} (${file.size} bytes)`);
    }
    
    return await file.arrayBuffer();
  }
}
