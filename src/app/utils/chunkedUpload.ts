// Chunked upload utility for large files
export class ChunkedUpload {
  private static readonly CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  private static readonly MAX_RETRIES = 3;

  static async uploadFileInChunks(
    file: File,
    encryptionData: {
      encryptedData: ArrayBuffer;
      key: string;
      iv: Uint8Array;
      salt: Uint8Array;
    },
    metadataIv: string,
    onProgress?: (progress: number) => void
  ): Promise<any> {
    const { encryptedData, key, iv, salt } = encryptionData;
    const encryptedBuffer = new Uint8Array(encryptedData);
    const totalSize = encryptedBuffer.length;
    const totalChunks = Math.ceil(totalSize / this.CHUNK_SIZE);
    
    console.log(`Starting chunked upload: ${totalChunks} chunks, ${this.formatSize(totalSize)} total`);

    // Start upload session
    const sessionResponse = await fetch('/api/upload/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalName: file.name,
        originalSize: file.size,
        totalSize,
        totalChunks,
        encryptionKey: key,
        iv: Array.from(iv),
        salt: Array.from(salt),
        metadataIv
      })
    });

    if (!sessionResponse.ok) {
      throw new Error('Failed to start upload session');
    }

    const { uploadId } = await sessionResponse.json();
    console.log('Upload session started:', uploadId);

    // Upload chunks
    const chunkUploadPromises: Promise<void>[] = [];
    
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * this.CHUNK_SIZE;
      const end = Math.min(start + this.CHUNK_SIZE, totalSize);
      const chunk = encryptedBuffer.slice(start, end);
      
      chunkUploadPromises.push(
        this.uploadChunkWithRetry(uploadId, chunkIndex, chunk, totalChunks, onProgress)
      );
    }

    // Wait for all chunks to upload
    await Promise.all(chunkUploadPromises);

    // Complete upload
    const completeResponse = await fetch('/api/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId })
    });

    if (!completeResponse.ok) {
      throw new Error('Failed to complete upload');
    }

    return await completeResponse.json();
  }

  private static async uploadChunkWithRetry(
    uploadId: string,
    chunkIndex: number,
    chunk: Uint8Array,
    totalChunks: number,
    onProgress?: (progress: number) => void,
    retryCount = 0
  ): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('uploadId', uploadId);
      formData.append('chunkIndex', chunkIndex.toString());
      formData.append('chunk', new Blob([chunk.slice().buffer]));

      const response = await fetch('/api/upload/chunk', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Chunk upload failed: ${response.status}`);
      }

      // Update progress
      if (onProgress) {
        const progress = ((chunkIndex + 1) / totalChunks) * 100;
        onProgress(progress);
      }

      console.log(`Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`);
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        console.log(`Retrying chunk ${chunkIndex}, attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return this.uploadChunkWithRetry(uploadId, chunkIndex, chunk, totalChunks, onProgress, retryCount + 1);
      }
      throw error;
    }
  }

  private static formatSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }
}
