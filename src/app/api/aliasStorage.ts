// Simple alias storage mapping a user-friendly alias to a download token
// In production, consider a database with unique constraints.
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const aliasFilePath = join(process.cwd(), 'aliases.json');

export type AliasMap = Record<string, string>; // alias -> token

let aliasCache: Map<string, string> = new Map();
let aliasesLoaded = false;
let loadingPromise: Promise<void> | null = null;

async function loadAliases() {
  try {
    if (existsSync(aliasFilePath)) {
      const raw = await readFile(aliasFilePath, 'utf8');
      const data: AliasMap = JSON.parse(raw);
      aliasCache = new Map(Object.entries(data));
      console.log('Loaded', aliasCache.size, 'aliases from file');
    }
  } catch (err) {
    console.error('Error loading aliases:', err);
  }
}

async function saveAliases() {
  try {
    const data: AliasMap = Object.fromEntries(aliasCache.entries());
    await writeFile(aliasFilePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving aliases:', err);
  }
}

async function ensureAliasesLoaded(): Promise<void> {
  if (aliasesLoaded) return;
  if (loadingPromise) {
    await loadingPromise;
    return;
  }
  loadingPromise = loadAliases().then(() => {
    aliasesLoaded = true;
    loadingPromise = null;
  });
  await loadingPromise;
}

export const aliases = {
  set: async (alias: string, token: string) => {
    await ensureAliasesLoaded();
    aliasCache.set(alias, token);
    await saveAliases();
  },
  get: async (alias: string) => {
    await ensureAliasesLoaded();
    return aliasCache.get(alias);
  },
  delete: async (alias: string) => {
    await ensureAliasesLoaded();
    const res = aliasCache.delete(alias);
    await saveAliases();
    return res;
  },
  has: async (alias: string) => {
    await ensureAliasesLoaded();
    return aliasCache.has(alias);
  },
  // For checks/debug
  size: async () => {
    await ensureAliasesLoaded();
    return aliasCache.size;
  },
  entries: async () => {
    await ensureAliasesLoaded();
    return aliasCache.entries();
  },
  // Returns a plain array of [alias, token] for safe iteration
  entriesArray: async () => {
    await ensureAliasesLoaded();
    return Array.from(aliasCache.entries());
  }
};

// Remove aliases that point to tokens not present in the provided tokenSet
export async function sweepInvalidAliases(tokenSet: Set<string>) {
  await ensureAliasesLoaded();
  let removed = 0;
  for (const [alias, mappedToken] of Array.from(aliasCache.entries())) {
    if (!tokenSet.has(mappedToken)) {
      aliasCache.delete(alias);
      removed++;
    }
  }
  if (removed > 0) {
    await saveAliases();
  }
  return removed;
}

export function normalizeAlias(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidAlias(input: string): boolean {
  // 3-64 chars, lowercase letters, numbers, dash, underscore, dot; must start with alnum
  return /^[a-z0-9][a-z0-9._-]{2,63}$/.test(input);
}

