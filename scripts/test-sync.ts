/**
 * Manual test script for the TTL-based knowledge base sync.
 *
 * Scenarios tested:
 *   1. First sync  — no sync-state.json exists → should download chunks
 *   2. Up-to-date  — sync-state.json is fresh   → should skip download
 *   3. Forced stale — last_synced backdated      → should re-download
 *
 * Run with:
 *   ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true,"target":"ES2020"}' scripts/test-sync.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { KnowledgeLoader } from '../src/knowledge/loader';
import { _syncForTesting } from '../src/knowledge/syncManager';

const CACHE_DIR = path.join(os.homedir(), '.feathersjs-mcp');
const CHUNKS_CACHE_DIR = path.join(CACHE_DIR, 'chunks');
const SYNC_STATE_FILE = path.join(CACHE_DIR, 'sync-state.json');

function readSyncState(): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(SYNC_STATE_FILE, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sectionHeader(title: string): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

function pass(msg: string): void { console.log(`  ✓  ${msg}`); }
function fail(msg: string): void { console.log(`  ✗  ${msg}`); process.exitCode = 1; }
function info(msg: string): void { console.log(`     ${msg}`); }

async function main(): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────
  // SETUP: wipe any existing cache so we start clean
  // ─────────────────────────────────────────────────────────────────────────

  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
    info(`Cleared existing cache at ${CACHE_DIR}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: No sync-state.json — should download chunks
  // ─────────────────────────────────────────────────────────────────────────

  sectionHeader('Scenario 1 — First sync (no existing state)');

  const loader1 = new KnowledgeLoader();
  info(`Loader kbRoot before sync: ${(loader1 as any).kbRoot}`);

  const t1Start = Date.now();
  await _syncForTesting(loader1);
  const t1Ms = Date.now() - t1Start;

  const state1 = readSyncState();
  const chunksExist = fs.existsSync(CHUNKS_CACHE_DIR);
  const chunkFiles = chunksExist ? fs.readdirSync(CHUNKS_CACHE_DIR) : [];

  if (state1) {
    pass(`sync-state.json created  →  last_synced: ${state1.last_synced}`);
    info(`remote_version: ${state1.remote_version}`);
  } else {
    fail('sync-state.json was NOT created');
  }

  if (chunksExist && chunkFiles.length > 0) {
    pass(`Chunks downloaded to ${CHUNKS_CACHE_DIR}`);
    chunkFiles.forEach(f => {
      const size = fs.statSync(path.join(CHUNKS_CACHE_DIR, f)).size;
      info(`  ${f}  (${(size / 1024).toFixed(1)} KB)`);
    });
  } else {
    fail('No chunk files found in cache dir');
  }

  pass(`Loader kbRoot after sync: ${(loader1 as any).kbRoot}`);
  info(`Completed in ${t1Ms}ms`);

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: Fresh sync-state.json — TTL not expired, should skip
  // ─────────────────────────────────────────────────────────────────────────

  sectionHeader('Scenario 2 — TTL not expired (should skip download)');

  const loader2 = new KnowledgeLoader();

  // Spy on fetch to detect if any network call is made
  let fetchCalled = false;
  const originalFetch = global.fetch;
  (global as any).fetch = async (...args: unknown[]) => {
    fetchCalled = true;
    return originalFetch(...(args as Parameters<typeof fetch>));
  };

  const t2Start = Date.now();
  await _syncForTesting(loader2);
  const t2Ms = Date.now() - t2Start;

  (global as any).fetch = originalFetch;

  if (!fetchCalled) {
    pass(`Network NOT called — TTL guard worked correctly (${t2Ms}ms)`);
  } else {
    fail(`fetch was called even though TTL had not expired (${t2Ms}ms)`);
  }

  info(`Loader kbRoot unchanged: ${(loader2 as any).kbRoot}`);

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: Backdated last_synced — TTL expired, should re-sync
  // ─────────────────────────────────────────────────────────────────────────

  sectionHeader('Scenario 3 — Forced stale (last_synced backdated 25h)');

  // Use an old remote_version so the sync thinks the remote is newer
  const staleState = {
    last_synced: new Date(Date.now() - 25 * 3_600_000).toISOString(),
    remote_version: '1970-01-01T00:00:00.000Z',
  };
  fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(staleState, null, 2), 'utf8');
  info(`Backdated last_synced to: ${staleState.last_synced}`);

  // Remove cached chunks so we can confirm they get re-downloaded
  if (fs.existsSync(CHUNKS_CACHE_DIR)) {
    fs.rmSync(CHUNKS_CACHE_DIR, { recursive: true, force: true });
  }

  const loader3 = new KnowledgeLoader();
  const t3Start = Date.now();
  await _syncForTesting(loader3);
  const t3Ms = Date.now() - t3Start;

  const state3 = readSyncState();
  const chunksExistAfter = fs.existsSync(CHUNKS_CACHE_DIR);

  if (chunksExistAfter) {
    pass(`Chunks re-downloaded successfully (${t3Ms}ms)`);
  } else {
    fail('Chunks were NOT re-downloaded on stale state');
  }

  if (state3 && new Date(state3.last_synced as string).getTime() > Date.now() - 10_000) {
    pass(`last_synced updated to fresh timestamp: ${state3.last_synced}`);
  } else {
    fail('last_synced was not updated');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────

  sectionHeader('Done');
  info(`Cache dir: ${CACHE_DIR}`);
  info(`Exit code: ${process.exitCode ?? 0}`);
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
