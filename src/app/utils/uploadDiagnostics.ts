// File upload troubleshooting utilities
export class UploadDiagnostics {
  static checkFileSize(file: File): { valid: boolean; message: string } {
    const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
    
    if (file.size > maxSize) {
      return {
        valid: false,
        message: `File too large: ${this.formatFileSize(file.size)}. Maximum allowed: ${this.formatFileSize(maxSize)}`
      };
    }
    
    return {
      valid: true,
      message: `File size OK: ${this.formatFileSize(file.size)}`
    };
  }
  
  static checkBrowserSupport(): { valid: boolean; message: string } {
    // Check for required APIs
    const hasWebCrypto = typeof window !== 'undefined' && window.crypto && window.crypto.subtle;
    const hasFormData = typeof FormData !== 'undefined';
    const hasArrayBuffer = typeof ArrayBuffer !== 'undefined';
    
    if (!hasWebCrypto) {
      return {
        valid: false,
        message: 'Web Crypto API not supported. Please use HTTPS and a modern browser.'
      };
    }
    
    if (!hasFormData || !hasArrayBuffer) {
      return {
        valid: false,
        message: 'Required browser APIs not available. Please update your browser.'
      };
    }
    
    return {
      valid: true,
      message: 'Browser support OK'
    };
  }
  
  static estimateUploadTime(fileSize: number): string {
    // Estimate based on typical upload speeds
    const speeds = {
      slow: 1 * 1024 * 1024,      // 1 MB/s
      medium: 5 * 1024 * 1024,    // 5 MB/s  
      fast: 20 * 1024 * 1024      // 20 MB/s
    };
    
    const slowTime = Math.ceil(fileSize / speeds.slow / 60); // minutes
    const fastTime = Math.ceil(fileSize / speeds.fast / 60); // minutes
    
    return `Estimated upload time: ${fastTime}-${slowTime} minutes`;
  }
  
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  static checkMemoryEstimate(fileSize: number): { valid: boolean; message: string } {
    // Rough estimate: file + encrypted + processing overhead
    const estimatedMemoryUsage = fileSize * 3;
    const maxRecommended = 2 * 1024 * 1024 * 1024; // 2GB
    
    if (estimatedMemoryUsage > maxRecommended) {
      return {
        valid: false,
        message: `Large file may cause memory issues. Estimated memory usage: ${this.formatFileSize(estimatedMemoryUsage)}`
      };
    }
    
    return {
      valid: true,
      message: `Memory usage should be acceptable: ${this.formatFileSize(estimatedMemoryUsage)}`
    };
  }
}
