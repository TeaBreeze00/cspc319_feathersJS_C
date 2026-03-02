#!/usr/bin/env ts-node

/**
 * incremental-update.ts
 *
 * Incrementally updates the knowledge base when specific doc files change.
 * Instead of re-chunking ALL docs and re-embedding ALL chunks, this script:
 *
 *   1. Takes a list of changed file paths (from git diff or CLI args)
 *   2. Chunks ONLY those files using the same logic as improved-chunking.ts
 *   3. Merges the new chunks into the existing v5-chunks.json / v6-chunks.json
 *      (replaces chunks with the same sourceFile, appends genuinely new ones)
 *   4. Generates embeddings ONLY for the new/replaced chunks
 *   5. Writes the updated files back
 *
 * Usage:
 *   # Auto-detect changed docs via git diff against HEAD~1
 *   npx ts-node --compiler-options '...' scripts/incremental-update.ts
 *
 *   # Or pass explicit file paths
 *   npx ts-node ... scripts/incremental-update.ts docs/v6_docs/cookbook/koa-middleware.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Re-use the chunker's core functions
import { processFile, extractVersion } from './improved-chunking';

// ---------------------------------------------------------------------------
// Types (matches existing chunk format)
// ---------------------------------------------------------------------------

interface DocEntry {
  id: string;
  heading: string;
  content: string;
  rawContent: string;
  breadcrumb: string;
  version: string;
  tokens: number;
  category: string;
  sourceFile: string;
  hasCode: boolean;
  codeLanguages: string[];
  tags?: string[];
  subHeadings?: string[];
  embedding?: number[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const KB_DIR = path.join(__dirname, '..', 'knowledge-base', 'chunks');
const V5_CHUNKS = path.join(KB_DIR, 'v5-chunks.json');
const V6_CHUNKS = path.join(KB_DIR, 'v6-chunks.json');
const METADATA = path.join(KB_DIR, 'metadata.json');

const EMBED_MAX_CHARS = 4096;
const MODEL_NAME = 'Xenova/bge-m3';
const EXPECTED_DIMS = 1024;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEmbedText(doc: DocEntry): string {
  const lines: string[] = [`# ${doc.heading}`];
  if (doc.category) lines.push(`Category: ${doc.category}`);
  if (doc.breadcrumb && doc.breadcrumb !== doc.heading)
    lines.push(`Breadcrumb: ${doc.breadcrumb}`);
  if (doc.subHeadings?.length) lines.push(`Covers: ${doc.subHeadings.join(' | ')}`);
  if (doc.tags?.length) lines.push(`Topics: ${doc.tags.join(', ')}`);
  if (doc.hasCode && doc.codeLanguages?.length)
    lines.push(`Code: ${doc.codeLanguages.join(', ')}`);
  lines.push('');
  const header = lines.join('\n');

  const budget = Math.max(0, EMBED_MAX_CHARS - header.length - 1);
  const body = doc.rawContent ?? doc.content ?? '';
  let truncated = body.slice(0, budget);
  if (truncated.length < body.length) {
    const last = truncated.lastIndexOf(' ');
    if (last > budget * 0.8) truncated = truncated.slice(0, last);
  }
  return `${header}\n${truncated}`.trim();
}

function toNumberArray(f32: Float32Array): number[] {
  const out = new Array<number>(f32.length);
  for (let i = 0; i < f32.length; i++)
    out[i] = Math.round(f32[i] * 1_000_000) / 1_000_000;
  return out;
}

function loadChunks(file: string): DocEntry[] {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

function versionOf(filePath: string): 'v5' | 'v6' | null {
  const v = extractVersion(filePath);
  if (v === 'v5' || v === 'v6') return v;
  return null;
}

// ---------------------------------------------------------------------------
// Detect changed files
// ---------------------------------------------------------------------------

function getChangedDocFiles(): string[] {
  const cliArgs = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  if (cliArgs.length > 0) {
    console.log(`  Using ${cliArgs.length} file(s) from CLI arguments`);
    return cliArgs.filter((f) => fs.existsSync(f));
  }

  // Auto-detect from git diff against the previous commit
  try {
    const diff = execSync(
      'git diff --name-only HEAD~1 HEAD -- docs/v5_docs docs/v6_docs',
      { encoding: 'utf-8' }
    ).trim();
    if (!diff) return [];
    const files = diff
      .split('\n')
      .filter((f) => f.endsWith('.md') && fs.existsSync(f));
    console.log(`  Detected ${files.length} changed doc file(s) via git diff`);
    return files;
  } catch {
    console.warn(
      '  ⚠  Could not run git diff — pass file paths as CLI arguments instead.'
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('');
  console.log('  🔄  FeathersJS MCP — Incremental Knowledge Base Update');
  console.log('  ────────────────────────────────────────────────────────');

  const changedFiles = getChangedDocFiles();
  if (changedFiles.length === 0) {
    console.log('  ✓  No changed doc files detected — nothing to do.\n');
    return;
  }

  console.log('  Changed files:');
  changedFiles.forEach((f) => console.log(`    • ${f}`));
  console.log('');

  // ── Step 1: Load existing chunks ────────────────────────────────────────
  const v5Chunks = loadChunks(V5_CHUNKS);
  const v6Chunks = loadChunks(V6_CHUNKS);
  console.log(`  Existing chunks: v5=${v5Chunks.length}, v6=${v6Chunks.length}`);

  // ── Step 2: Chunk ONLY the changed files ────────────────────────────────
  const newChunks: DocEntry[] = [];

  for (const file of changedFiles) {
    const version = versionOf(file);
    if (!version) {
      console.log(`  ⚠  Skipping ${file} — not under v5_docs or v6_docs`);
      continue;
    }

    try {
      const { chunks } = processFile(file);
      console.log(
        `  ✓  Chunked ${path.basename(file)} → ${chunks.length} chunk(s)`
      );
      for (const chunk of chunks) {
        newChunks.push(chunk as unknown as DocEntry);
      }
    } catch (err) {
      console.error(`  ✗  Failed to chunk ${file}:`, err);
    }
  }

  if (newChunks.length === 0) {
    console.log('  ✓  No new chunks produced — nothing to update.\n');
    return;
  }

  // ── Step 3: Merge — replace old chunks for same sourceFile, add new ─────
  const changedSourceFiles = new Set(newChunks.map((c) => c.sourceFile));

  const v5Filtered = v5Chunks.filter(
    (c) => !changedSourceFiles.has(c.sourceFile)
  );
  const v6Filtered = v6Chunks.filter(
    (c) => !changedSourceFiles.has(c.sourceFile)
  );

  let v5Added = 0;
  let v6Added = 0;

  for (const chunk of newChunks) {
    const v = versionOf(chunk.sourceFile);
    if (v === 'v5') {
      v5Filtered.push(chunk);
      v5Added++;
    }
    if (v === 'v6') {
      v6Filtered.push(chunk);
      v6Added++;
    }
  }

  const v5Removed = v5Chunks.length - (v5Filtered.length - v5Added);
  const v6Removed = v6Chunks.length - (v6Filtered.length - v6Added);

  console.log(`\n  Merge results:`);
  console.log(
    `    v5: removed ${v5Removed} old, added ${v5Added} new → ${v5Filtered.length} total`
  );
  console.log(
    `    v6: removed ${v6Removed} old, added ${v6Added} new → ${v6Filtered.length} total`
  );

  // ── Step 4: Embed ONLY the new/replaced chunks ──────────────────────────
  const chunksToEmbed = newChunks.filter(
    (c) =>
      !c.embedding ||
      !Array.isArray(c.embedding) ||
      c.embedding.length !== EXPECTED_DIMS
  );

  if (chunksToEmbed.length > 0) {
    console.log(
      `\n  Loading ${MODEL_NAME} for ${chunksToEmbed.length} new chunk(s) …`
    );
    const t0 = Date.now();
    const { pipeline } = await import('@xenova/transformers');
    const embedder = await pipeline('feature-extraction', MODEL_NAME, {
      progress_callback: undefined,
    });
    console.log(
      `  ✓  Model ready in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`
    );

    for (let i = 0; i < chunksToEmbed.length; i++) {
      const doc = chunksToEmbed[i];
      const text = buildEmbedText(doc);
      try {
        const t1 = Date.now();
        const output = await embedder(text, {
          pooling: 'cls',
          normalize: true,
        });
        doc.embedding = toNumberArray(output.data as Float32Array);
        console.log(
          `    [${i + 1}/${chunksToEmbed.length}] ${doc.id} → ${doc.embedding.length}d  ${Date.now() - t1}ms`
        );
      } catch (err) {
        console.error(
          `    [${i + 1}/${chunksToEmbed.length}] ${doc.id} → FAILED:`,
          err
        );
      }
    }
  } else {
    console.log(
      `\n  All new chunks already have valid embeddings — skipping model load.`
    );
  }

  // ── Step 5: Write updated chunk files ───────────────────────────────────
  if (!fs.existsSync(KB_DIR)) fs.mkdirSync(KB_DIR, { recursive: true });
  fs.writeFileSync(V5_CHUNKS, JSON.stringify(v5Filtered, null, 2), 'utf-8');
  fs.writeFileSync(V6_CHUNKS, JSON.stringify(v6Filtered, null, 2), 'utf-8');

  // Update metadata with incremental info
  try {
    const meta = fs.existsSync(METADATA)
      ? JSON.parse(fs.readFileSync(METADATA, 'utf-8'))
      : {};
    meta.lastIncrementalUpdate = new Date().toISOString();
    meta.lastChangedFiles = changedFiles;
    fs.writeFileSync(METADATA, JSON.stringify(meta, null, 2), 'utf-8');
  } catch {
    /* non-fatal */
  }

  console.log(
    `\n  ✓  Written: ${path.basename(V5_CHUNKS)} (${v5Filtered.length} chunks)`
  );
  console.log(
    `  ✓  Written: ${path.basename(V6_CHUNKS)} (${v6Filtered.length} chunks)`
  );
  console.log(
    `\n  Done. ${newChunks.length} chunk(s) updated, ${chunksToEmbed.length} embedded.\n`
  );
}

main().catch((err) => {
  console.error('\n  ✗  Unhandled error:', err);
  process.exit(1);
});
