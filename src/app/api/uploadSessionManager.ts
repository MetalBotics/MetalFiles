// Shared upload session manager for chunked uploads
interface UploadSession {
  id: string;
  originalName: string;
  originalSize: number;
  totalSize: number;
  totalChunks: number;
  encryptionKey: string;
  iv: number[];
  salt: number[];
  metadataIv: string;
  chunks: Map<number, Buffer>;
  createdAt: number;
}

class UploadSessionManager {
  private static instance: UploadSessionManager;
  private sessions: Map<string, UploadSession> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  private constructor() {
    // Clean up old sessions every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
  }

  static getInstance(): UploadSessionManager {
    if (!UploadSessionManager.instance) {
      UploadSessionManager.instance = new UploadSessionManager();
    }
    return UploadSessionManager.instance;
  }

  createSession(sessionData: Omit<UploadSession, 'id' | 'chunks' | 'createdAt'>): string {
    const uploadId = require('crypto').randomBytes(16).toString('hex');
    
    const session: UploadSession = {
      ...sessionData,
      id: uploadId,
      chunks: new Map(),
      createdAt: Date.now()
    };

    this.sessions.set(uploadId, session);
    console.log(`Upload session created: ${uploadId} for file: ${sessionData.originalName} (${sessionData.totalSize} bytes, ${sessionData.totalChunks} chunks)`);
    
    return uploadId;
  }

  getSession(uploadId: string): UploadSession | undefined {
    return this.sessions.get(uploadId);
  }

  deleteSession(uploadId: string): boolean {
    return this.sessions.delete(uploadId);
  }

  addChunk(uploadId: string, chunkIndex: number, chunkData: Buffer): boolean {
    const session = this.sessions.get(uploadId);
    if (!session) {
      return false;
    }

    session.chunks.set(chunkIndex, chunkData);
    console.log(`Chunk ${chunkIndex + 1}/${session.totalChunks} received for session ${uploadId}`);
    
    return true;
  }

  isComplete(uploadId: string): boolean {
    const session = this.sessions.get(uploadId);
    if (!session) {
      return false;
    }

    return session.chunks.size === session.totalChunks;
  }

  assembleFile(uploadId: string): Buffer {
    const session = this.sessions.get(uploadId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (!this.isComplete(uploadId)) {
      throw new Error('Not all chunks received');
    }

    const chunks: Buffer[] = [];
    for (let i = 0; i < session.totalChunks; i++) {
      const chunk = session.chunks.get(i);
      if (!chunk) {
        throw new Error(`Missing chunk ${i}`);
      }
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.createdAt > oneHour) {
        this.sessions.delete(id);
        console.log(`Cleaned up expired upload session: ${id}`);
      }
    }
  }
}

export default UploadSessionManager;
export type { UploadSession };
