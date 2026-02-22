/**
 * generate-embeddings.ts
 *
 * One-time script that reads every DocEntry from knowledge-base/docs/*.json,
 * generates a 384-dimensional sentence embedding for each entry using the
 * all-MiniLM-L6-v2 model (via @xenova/transformers, fully local – no API key),
 * and writes the embedding back into the same JSON files under the `embedding` key.
 *
 * Run once after any change to the knowledge base:
 *   npm run generate:embeddings
 *
 * The updated JSON files should be committed to the repository so that the
 * MCP server never has to compute embeddings at query time.
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types (mirrors src/knowledge/types.ts without importing from src/)
// ---------------------------------------------------------------------------

interface DocEntry {
  id: string;
  title: string;
  content: string;
  version: string;
  tokens: string[];
  category: string;
  source?: { url?: string; path?: string };
  tags?: string[];
  embedding?: number[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KB_DOCS_DIR = path.join(__dirname, '..', 'knowledge-base', 'docs');

/**
 * Maximum number of characters taken from `content` when building the text
 * to embed.  all-MiniLM-L6-v2 has a 256-token context window; ~1 000 chars
 * comfortably fits inside it while capturing enough semantic detail.
 */
const MAX_CONTENT_CHARS = 1000;

/**
 * Hugging Face model identifier used by @xenova/transformers.
 * all-MiniLM-L6-v2:
 *   - 384-dimensional output
 *   - ~23 MB download (cached after first run)
 *   - Excellent balance of speed and semantic quality
 */
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the text string that will be embedded for a single DocEntry.
 * We combine the title and the beginning of the content so the embedding
 * captures both the topic label and the actual explanation.
 */
function buildEmbedText(doc: DocEntry): string {
  const title = (doc.title ?? '').trim();
  const content = (doc.content ?? '').trim().slice(0, MAX_CONTENT_CHARS);
  return `${title}\n\n${content}`;
}

/**
 * Convert a Float32Array (what @xenova/transformers returns) to a plain
 * number[] so it can be serialised into JSON without loss.
 */
function toNumberArray(float32: Float32Array): number[] {
  const out: number[] = new Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    // Round to 6 decimal places — more than enough precision, saves ~30 % JSON size
    out[i] = Math.round(float32[i] * 1_000_000) / 1_000_000;
  }
  return out;
}

/** Simple zero-padded progress indicator, e.g. " 3/42". */
function progress(current: number, total: number): string {
  const w = String(total).length;
  return `${String(current).padStart(w)}/${total}`;
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('');
  console.log('  🪶  FeathersJS MCP — Embedding Generator');
  console.log('  ─────────────────────────────────────────');
  console.log(`  Model : ${MODEL_NAME}`);
  console.log(`  Docs  : ${KB_DOCS_DIR}`);
  console.log('');

  // ── 1. Discover JSON files ───────────────────────────────────────────────
  if (!fs.existsSync(KB_DOCS_DIR)) {
    console.error(`  ✗  Docs directory not found: ${KB_DOCS_DIR}`);
    process.exit(1);
  }

  // Recursively collect all .json files under KB_DOCS_DIR (supports v5/, v6/)
  function collectJsonFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectJsonFiles(full));
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        results.push(full);
      }
    }
    return results;
  }

  const jsonFiles = collectJsonFiles(KB_DOCS_DIR);

  if (jsonFiles.length === 0) {
    console.error('  ✗  No JSON files found in docs directory.');
    console.error(
      '     Expected JSON files under knowledge-base/docs/, e.g. knowledge-base/docs/v5/*.json and knowledge-base/docs/v6/*.json'
    );
    console.error('     Run the ingest scripts to generate them:');
    console.error('       node scripts/ingest-v5-docs-sectioned.js');
    console.error('       node scripts/ingest-v6-docs-sectioned.js');
    process.exit(1);
  }

  console.log(
    `  Found ${jsonFiles.length} doc file(s): ${jsonFiles.map((f) => path.relative(KB_DOCS_DIR, f)).join(', ')}`
  );
  console.log('');

  // ── 2. Load the embedding model ──────────────────────────────────────────
  console.log('  Loading model (first run will download ~23 MB and cache it) …');
  const startLoad = Date.now();

  // Dynamic import keeps CommonJS compatibility while loading the ESM package
  const { pipeline } = await import('@xenova/transformers');

  const embedder = await pipeline('feature-extraction', MODEL_NAME, {
    // Suppress the verbose progress bars from the transformers library
    progress_callback: undefined,
  });

  const loadMs = Date.now() - startLoad;
  console.log(`  ✓  Model ready in ${(loadMs / 1000).toFixed(1)}s`);
  console.log('');

  // ── 3. Process each file ─────────────────────────────────────────────────
  let totalDocs = 0;
  let totalEmbedded = 0;
  let totalSkipped = 0;

  for (const filePath of jsonFiles) {
    const fileName = path.basename(filePath);
    let docs: DocEntry[];

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      docs = JSON.parse(raw) as DocEntry[];
    } catch (err) {
      console.warn(`  ⚠  Skipping ${fileName} — could not parse JSON: ${String(err)}`);
      continue;
    }

    if (!Array.isArray(docs) || docs.length === 0) {
      console.warn(`  ⚠  Skipping ${fileName} — empty or not an array.`);
      continue;
    }

    console.log(`  Processing ${fileName} (${docs.length} entries) …`);
    totalDocs += docs.length;

    // ── 4. Embed each doc entry ────────────────────────────────────────────
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const label = `    [${progress(i + 1, docs.length)}] ${doc.id} — "${doc.title}"`;

      const text = buildEmbedText(doc);
      if (!text.trim()) {
        console.log(`${label}  → skipped (empty text)`);
        totalSkipped++;
        continue;
      }

      try {
        const startEmbed = Date.now();

        const output = await embedder(text, {
          pooling: 'mean', // mean-pool the token embeddings → single vector
          normalize: true, // L2-normalise so cosine similarity = dot product
        });

        const embedMs = Date.now() - startEmbed;
        doc.embedding = toNumberArray(output.data as Float32Array);

        console.log(`${label}  → ${doc.embedding.length}d  (${embedMs}ms)`);
        totalEmbedded++;
      } catch (err) {
        console.warn(`${label}  → FAILED: ${String(err)}`);
        totalSkipped++;
      }
    }

    // ── 5. Write updated file back ─────────────────────────────────────────
    try {
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');
      console.log(`  ✓  Wrote ${fileName}\n`);
    } catch (err) {
      console.error(`  ✗  Failed to write ${fileName}: ${String(err)}`);
      process.exit(1);
    }
  }

  // ── 6. Summary ────────────────────────────────────────────────────────────
  console.log('  ─────────────────────────────────────────');
  console.log(`  Total docs   : ${totalDocs}`);
  console.log(`  Embedded     : ${totalEmbedded}`);
  console.log(`  Skipped/err  : ${totalSkipped}`);
  console.log('');
  console.log('  Done. Commit the updated knowledge-base/docs/*.json files.');
  console.log('');
}

main().catch((err) => {
  console.error('\n  ✗  Unhandled error:', err);
  process.exit(1);
});
