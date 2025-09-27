// Shared token storage (in production, use a database like Redis, PostgreSQL, etc.)
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { aliases, sweepInvalidAliases } from './aliasStorage';

export interface TokenData {
  filename: string;
  originalName: string;
  size: number;
  expiresAt: number;
  // Encryption metadata
  encryptionKey: string;
  iv: string; // base64 encoded
  salt: string; // base64 encoded
  metadataIv: string; // base64 encoded
  // Optional password protection
  pwSalt?: string; // base64 encoded
  pwVerifier?: string; // base64 encoded verifier
}

// In-memory cache
const tokenCache = new Map<string, TokenData>();

// File path for persistent storage
const tokenFilePath = join(process.cwd(), 'tokens.json');

// Load tokens from file on startup
async function loadTokens() {
  try {
    if (existsSync(tokenFilePath)) {
      const data = await readFile(tokenFilePath, 'utf8');
      const tokens = JSON.parse(data);
      for (const [key, value] of Object.entries(tokens)) {
        tokenCache.set(key, value as TokenData);
      }
      console.log('Loaded', tokenCache.size, 'tokens from file');
    }
  } catch (error) {
    console.error('Error loading tokens:', error);
  }
}

// Save tokens to file
async function saveTokens() {
  try {
    const tokens = Object.fromEntries(tokenCache);
    await writeFile(tokenFilePath, JSON.stringify(tokens, null, 2));
  } catch (error) {
    console.error('Error saving tokens:', error);
  }
}

// Initialize on first import
let tokensLoaded = false;
let loadingPromise: Promise<void> | null = null;

// Ensure tokens are loaded before any operation
async function ensureTokensLoaded(): Promise<void> {
  if (tokensLoaded) return;
  
  if (loadingPromise) {
    await loadingPromise;
    return;
  }
  
  loadingPromise = loadTokens().then(() => {
    tokensLoaded = true;
    loadingPromise = null;
  });
  
  await loadingPromise;
}

export const downloadTokens = {
  set: async (key: string, value: TokenData) => {
    await ensureTokensLoaded();
    tokenCache.set(key, value);
    saveTokens(); // Save to file whenever we add a token
  },
  get: async (key: string) => {
    await ensureTokensLoaded();
    return tokenCache.get(key);
  },
  delete: async (key: string) => {
    await ensureTokensLoaded();
    const result = tokenCache.delete(key);
    // Save tokens after deletion
    saveTokens();

    // Also remove any aliases that point to this token to keep aliases.json consistent
    try {
      const aliasEntries = await aliases.entriesArray();
      for (const [alias, mappedToken] of aliasEntries) {
        if (mappedToken === key) {
          await aliases.delete(alias);
          console.log(`Alias removed for deleted token: ${alias}`);
        }
      }
    } catch (err) {
      console.error('Error cleaning up aliases after token delete:', err);
    }

    return result;
  },
  entries: async () => {
    await ensureTokensLoaded();
    return tokenCache.entries();
  },
  keys: async () => {
    await ensureTokensLoaded();
    return tokenCache.keys();
  },
  size: async () => {
    await ensureTokensLoaded();
    return tokenCache.size;
  }
};

// Clean up expired tokens periodically
export async function cleanupExpiredTokens() {
  const now = Date.now();
  let deletedCount = 0;
  
  const entries = await downloadTokens.entries();
  for (const [token, data] of entries) {
    if (now > data.expiresAt) {
      // Delete the file from disk
      try {
        const { unlink } = require('fs/promises');
        const { join } = require('path');
        const filePath = join(process.cwd(), 'uploads', data.filename);
        
        if (require('fs').existsSync(filePath)) {
          await unlink(filePath);
          console.log(`Expired file deleted: ${data.filename}`);
        }
      } catch (fileError) {
        console.error(`Error deleting expired file ${data.filename}:`, fileError);
      }
      
      // Remove token from storage
      await downloadTokens.delete(token);
      // Remove any aliases pointing to this token
      try {
        const aliasEntries = await aliases.entries();
        for (const [alias, mappedToken] of aliasEntries) {
          if (mappedToken === token) {
            await aliases.delete(alias);
            console.log(`Alias removed during cleanup: ${alias}`);
          }
        }
      } catch (aliasErr) {
        console.error('Error cleaning up aliases:', aliasErr);
      }
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`Cleanup completed: ${deletedCount} expired files/tokens removed`);
  }
  
  // Sweep aliases that point to tokens that no longer exist
  try {
    const tokenKeys = new Set<string>(Array.from(tokenCache.keys()));
    const removed = await sweepInvalidAliases(tokenKeys);
    if (removed > 0) {
      console.log(`Sweep completed: ${removed} orphan aliases removed`);
    }
  } catch (aliasErr) {
    console.error('Error sweeping orphan aliases:', aliasErr);
  }

  return deletedCount;
}

// Auto cleanup every hour
let cleanupInterval: NodeJS.Timeout | null = null;

// Start automatic cleanup
export function startAutomaticCleanup() {
  if (cleanupInterval) {
    return; // Already running
  }
  
  console.log('Starting automatic file cleanup service (runs every hour)');
  
  // Run cleanup immediately
  cleanupExpiredTokens().catch(err => 
    console.error('Initial cleanup failed:', err)
  );
  
  // Then run every hour
  cleanupInterval = setInterval(async () => {
    try {
      await cleanupExpiredTokens();
    } catch (error) {
      console.error('Scheduled cleanup failed:', error);
    }
  }, 60 * 60 * 1000); // 1 hour in milliseconds
}

// Stop automatic cleanup
export function stopAutomaticCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('Automatic cleanup service stopped');
  }
}

// Start cleanup when module loads
if (typeof window === 'undefined') { // Only on server-side
  startAutomaticCleanup();
}
