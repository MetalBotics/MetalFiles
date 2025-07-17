// Shared upload session manager for chunked uploads
import fs from 'fs';
import path from 'path';

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

// Helper functions for persistent storage in development
const SESSIONS_DIR = path.join(process.cwd(), '.next/cache/upload-sessions');

function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function getSessionFilePath(sessionId: string) {
  return path.join(SESSIONS_DIR, `${sessionId}.json`);
}

function saveSessionToDisk(session: UploadSession) {
  if (process.env.NODE_ENV === 'development') {
    try {
      ensureSessionsDir();
      const sessionData = {
        ...session,
        chunks: Array.from(session.chunks.entries()).map(([index, buffer]) => [
          index,
          Array.from(buffer) // Convert Buffer to array of numbers for JSON serialization
        ])
      };
      fs.writeFileSync(getSessionFilePath(session.id), JSON.stringify(sessionData));
      console.log(`Session ${session.id} saved to disk`);
    } catch (error) {
      console.error('Failed to save session to disk:', error);
    }
  }
}

function loadSessionFromDisk(sessionId: string): UploadSession | undefined {
  if (process.env.NODE_ENV === 'development') {
    try {
      const filePath = getSessionFilePath(sessionId);
      if (fs.existsSync(filePath)) {
        const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const session: UploadSession = {
          ...sessionData,
          chunks: new Map(
            sessionData.chunks.map(([index, bufferArray]: [number, number[]]) => [
              index,
              Buffer.from(bufferArray) // Convert array of numbers back to Buffer
            ])
          )
        };
        console.log(`Session ${sessionId} loaded from disk`);
        return session;
      }
    } catch (error) {
      console.error('Failed to load session from disk:', error);
    }
  }
  return undefined;
}

function deleteSessionFromDisk(sessionId: string) {
  if (process.env.NODE_ENV === 'development') {
    try {
      const filePath = getSessionFilePath(sessionId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Session ${sessionId} deleted from disk`);
      }
    } catch (error) {
      console.error('Failed to delete session from disk:', error);
    }
  }
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
    saveSessionToDisk(session);
    console.log(`Upload session created: ${uploadId} for file: ${sessionData.originalName} (${sessionData.totalSize} bytes, ${sessionData.totalChunks} chunks)`);
    
    return uploadId;
  }

  getSession(uploadId: string): UploadSession | undefined {
    // First try to get from memory
    let session = this.sessions.get(uploadId);
    
    // If not in memory, try to load from disk (development mode)
    if (!session) {
      session = loadSessionFromDisk(uploadId);
      if (session) {
        // Restore to memory
        this.sessions.set(uploadId, session);
        console.log(`Session ${uploadId} restored from disk to memory`);
      }
    }
    
    return session;
  }

  deleteSession(uploadId: string): boolean {
    const deleted = this.sessions.delete(uploadId);
    deleteSessionFromDisk(uploadId);
    return deleted;
  }

  addChunk(uploadId: string, chunkIndex: number, chunkData: Buffer): boolean {
    const session = this.getSession(uploadId); // Use getSession to handle disk loading
    if (!session) {
      return false;
    }

    session.chunks.set(chunkIndex, chunkData);
    saveSessionToDisk(session); // Persist updated session
    console.log(`Chunk ${chunkIndex + 1}/${session.totalChunks} received for session ${uploadId}`);
    
    return true;
  }

  isComplete(uploadId: string): boolean {
    const session = this.getSession(uploadId); // Use getSession to handle disk loading
    if (!session) {
      return false;
    }

    return session.chunks.size === session.totalChunks;
  }

  assembleFile(uploadId: string): Buffer {
    const session = this.getSession(uploadId); // Use getSession to handle disk loading
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
        deleteSessionFromDisk(id);
        console.log(`Cleaned up expired upload session: ${id}`);
      }
    }
    
    // Also clean up orphaned disk sessions in development
    if (process.env.NODE_ENV === 'development') {
      try {
        if (fs.existsSync(SESSIONS_DIR)) {
          const files = fs.readdirSync(SESSIONS_DIR);
          for (const file of files) {
            if (file.endsWith('.json')) {
              const filePath = path.join(SESSIONS_DIR, file);
              const stats = fs.statSync(filePath);
              if (now - stats.mtime.getTime() > oneHour) {
                fs.unlinkSync(filePath);
                console.log(`Cleaned up expired session file: ${file}`);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error cleaning up disk sessions:', error);
      }
    }
  }
}

export default UploadSessionManager;
export type { UploadSession };
