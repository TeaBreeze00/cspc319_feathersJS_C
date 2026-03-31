/**
 * syncManager.ts
 *
 * TTL-based lazy refresh for the FeathersJS knowledge base.
 *
 * On every startup:
 *   1. Read ~/.feathersjs-mcp/sync-state.json for last_synced timestamp.
 *   2. If older than FEATHERS_MCP_SYNC_TTL_HOURS (default 24h), fetch the
 *      remote metadata.json and compare lastIncrementalUpdate.
 *   3. If the remote version is newer, download all three chunk files into a
 *      temporary directory, then atomically rename it into place.
 *   4. Hot-swap the KnowledgeLoader's root so the next search uses fresh data.
 *
 * All of this runs in the background — the server starts immediately with
 * whatever chunks are available locally.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { KnowledgeLoader } from './loader';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const CACHE_DIR = path.join(os.homedir(), '.feathersjs-mcp');
const CHUNKS_CACHE_DIR = path.join(CACHE_DIR, 'chunks');
const CHUNKS_TMP_DIR = path.join(CACHE_DIR, 'chunks-tmp');
const SYNC_STATE_FILE = path.join(CACHE_DIR, 'sync-state.json');

// Chunk files that live under knowledge-base/chunks/ in the repo
const CHUNK_FILES = ['metadata.json', 'v5-chunks.json', 'v6-chunks.json'];

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncState {
  last_synced: string;   // ISO timestamp of last successful sync attempt
  remote_version: string; // lastIncrementalUpdate value from the remote metadata
}

interface RemoteMetadata {
  lastIncrementalUpdate?: string;
  generated?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTtlMs(): number {
  const raw = process.env.FEATHERS_MCP_SYNC_TTL_HOURS;
  const hours = raw !== undefined ? parseFloat(raw) : 24;
  return Number.isFinite(hours) && hours > 0 ? hours * 3_600_000 : DEFAULT_TTL_MS;
}

function readSyncState(): SyncState | null {
  try {
    if (!fs.existsSync(SYNC_STATE_FILE)) return null;
    return JSON.parse(fs.readFileSync(SYNC_STATE_FILE, 'utf8')) as SyncState;
  } catch {
    return null;
  }
}

function writeSyncState(state: SyncState): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function isStale(state: SyncState | null): boolean {
  if (!state) return true;
  const age = Date.now() - new Date(state.last_synced).getTime();
  return age > getTtlMs();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.text();
}

// ---------------------------------------------------------------------------
// Core sync
// ---------------------------------------------------------------------------

async function sync(loader: KnowledgeLoader): Promise<void> {
  const owner = process.env.GITHUB_OWNER ?? 'TeaBreeze00';
  const repo = process.env.GITHUB_REPO ?? 'cspc319_feathersJS_C';
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/main/knowledge-base/chunks`;

  const state = readSyncState();

  if (!isStale(state)) return;

  // ── Step 1: fetch remote metadata (cheap — ~1 KB) ─────────────────────
  const remoteMeta = JSON.parse(await fetchText(`${base}/metadata.json`)) as RemoteMetadata;
  const remoteVersion = remoteMeta.lastIncrementalUpdate ?? remoteMeta.generated ?? '';

  // ── Step 2: already up to date — just update the timestamp ───────────
  if (state && state.remote_version === remoteVersion) {
    writeSyncState({ last_synced: new Date().toISOString(), remote_version: remoteVersion });
    console.error('[feathers-mcp] Knowledge base is already up to date.');
    return;
  }

  // ── Step 3: download all chunk files into a temp dir ──────────────────
  fs.mkdirSync(CHUNKS_TMP_DIR, { recursive: true });

  for (const file of CHUNK_FILES) {
    const content = await fetchText(`${base}/${file}`);
    fs.writeFileSync(path.join(CHUNKS_TMP_DIR, file), content, 'utf8');
  }

  // ── Step 4: atomic swap tmp → chunks ──────────────────────────────────
  if (fs.existsSync(CHUNKS_CACHE_DIR)) {
    fs.rmSync(CHUNKS_CACHE_DIR, { recursive: true, force: true });
  }
  fs.renameSync(CHUNKS_TMP_DIR, CHUNKS_CACHE_DIR);

  // ── Step 5: hot-swap the loader so the next search uses fresh data ────
  loader.setKbRoot(CACHE_DIR);

  // ── Step 6: persist sync state ────────────────────────────────────────
  writeSyncState({ last_synced: new Date().toISOString(), remote_version: remoteVersion });

  console.error(`[feathers-mcp] Knowledge base updated to version ${remoteVersion}`);
}

// ---------------------------------------------------------------------------
// Public API — fire-and-forget, never blocks startup
// ---------------------------------------------------------------------------

export function runBackgroundSync(loader: KnowledgeLoader): void {
  void sync(loader).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[feathers-mcp] Background KB sync failed (will retry next startup): ${msg}`);
  });
}

/** Exposed for testing only — awaitable version of the background sync. */
export async function _syncForTesting(loader: KnowledgeLoader): Promise<void> {
  return sync(loader);
}
