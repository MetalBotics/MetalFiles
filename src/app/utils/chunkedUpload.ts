// Chunked upload utility for large files
import { FileEncryption } from './encryption';

export class ChunkedUpload {
  private static readonly CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  private static readonly MAX_RETRIES = 3;

  static async uploadFileInChunks(
    file: File,
    onProgress?: (progress: number) => void,
    alias?: string,
    concurrency?: number
  ): Promise<any> {
    try {
      const { key, iv, salt, encryptedStream, totalChunks } =
        await FileEncryption.encryptFile(file, this.CHUNK_SIZE);

      const totalSize = file.size + totalChunks * 16; // approximate with GCM tag
      
      console.log(
        `Starting chunked upload: ${totalChunks} chunks, ${this.formatSize(totalSize)} total`
      );

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
          metadataIv: btoa(String.fromCharCode(...iv))
        })
      });

      if (!sessionResponse.ok) {
        console.error('Failed to start upload session');
        throw new Error('Failed to start upload session');
      }

      const { uploadId } = await sessionResponse.json();
      console.log('Upload session started:', uploadId);

      // Determine how many chunks to upload in parallel.
      // Defaults to the browser's hardwareConcurrency, allowing the
      // transfer to use all available cores. Higher concurrency can
      // improve throughput but increases memory and network pressure.
      const runtimeConcurrency = Math.max(
        1,
        concurrency ?? navigator?.hardwareConcurrency ?? 3
      );

      const activeUploads = new Set<Promise<void>>();
      let chunkIndex = 0;
      let uploaded = 0;

      for await (const chunk of encryptedStream) {
        const currentIndex = chunkIndex++;
        const task = this.uploadChunkWithRetry(
          uploadId,
          currentIndex,
          chunk,
          totalChunks
        );
        activeUploads.add(task);

        task
          .then(() => {
            uploaded++;
            if (onProgress) {
              const progress = Math.round((uploaded / totalChunks) * 100);
              onProgress(progress);
            }
          })
          .finally(() => activeUploads.delete(task));

        if (activeUploads.size >= runtimeConcurrency) {
          await Promise.race(activeUploads);
        }
      }

      await Promise.all(activeUploads);

      // Complete upload
      const completeResponse = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, alias })
      });

      if (!completeResponse.ok) {
        console.error('Failed to complete upload');
        throw new Error('Failed to complete upload');
      }


      return await completeResponse.json();
    } catch (error) {
      console.error('Chunked upload failed:', error);
      throw error;
    }
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
      console.log(`Uploading chunk ${chunkIndex + 1}/${totalChunks}`);
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

      if (onProgress) {
        const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
        onProgress(progress);
      }
      console.log(
        `Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`
      );
    } catch (error) {
      console.error(`Error uploading chunk ${chunkIndex}:`, error);
      if (retryCount < this.MAX_RETRIES) {
        console.log(`Retrying chunk ${chunkIndex}, attempt ${retryCount + 1}`);
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (retryCount + 1))
        ); // Exponential backoff
        return this.uploadChunkWithRetry(
          uploadId,
          chunkIndex,
          chunk,
          totalChunks,
          onProgress,
          retryCount + 1
        );
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
