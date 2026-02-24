/**
 * generate-embeddings.ts
 *
 * Generates 1024-dimensional BGE-M3 embeddings for each DocEntry.
 * Uses Xenova/bge-m3 via @xenova/transformers (local, no API key).
 *
 * Key changes from v1:
 *  - Model: Xenova/bge-m3 (1024d, 8192 token window) vs all-MiniLM-L6-v2 (384d, 256 tokens)
 *  - Pooling: 'cls' (BGE-M3 requirement) vs 'mean'
 *  - Embed text: full content with semantic header prefix (no truncation needed)
 *
 * Run after chunking:
 *   npm run generate:embeddings
 */

import * as fs from 'fs';
import * as path from 'path';

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
// Constants
// ---------------------------------------------------------------------------

const KB_DOCS_DIR = path.join(__dirname, '..', 'knowledge-base', 'chunks');

/**
 * BGE-M3: 1024d, 8192 token window, MIT license, built for retrieval.
 * Xenova/bge-m3 is the ONNX-converted version compatible with @xenova/transformers.
 * First run downloads ~568 MB (int8 quantized) and caches it.
 */
const MODEL_NAME = 'Xenova/bge-m3';

// ---------------------------------------------------------------------------
// Embed text builder
// ---------------------------------------------------------------------------

/**
 * Build the text to embed for a single DocEntry.
 *
 * BGE-M3 can process 8192 tokens — enough for entire documentation files.
 * We use the pre-built `content` field which already contains:
 *   - Heading
 *   - Breadcrumb
 *   - Covers: (subHeadings list)
 *   - Topics: (tags)
 *   - Full rawContent
 *
 * This means the model sees both the structured metadata AND the full content,
 * giving rich semantic representation of the entire document.
 */
function buildEmbedText(doc: DocEntry): string {
  // The chunker already built a perfect embed text in the `content` field.
  // It front-loads heading/subHeadings/tags before the raw content.
  // BGE-M3 handles the full length — no truncation needed.
  return doc.content.trim();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumberArray(float32: Float32Array): number[] {
  const out: number[] = new Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    out[i] = Math.round(float32[i] * 1_000_000) / 1_000_000;
  }
  return out;
}

function progress(current: number, total: number): string {
  const w = String(total).length;
  return `${String(current).padStart(w)}/${total}`;
}

function collectJsonFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json') && !entry.name.includes('metadata'))
      results.push(full);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('');
  console.log('  🪶  FeathersJS MCP — BGE-M3 Embedding Generator');
  console.log('  ─────────────────────────────────────────────────');
  console.log(`  Model : ${MODEL_NAME}`);
  console.log(`  Dims  : 1024`);
  console.log(`  Window: 8192 tokens`);
  console.log(`  Docs  : ${KB_DOCS_DIR}`);
  console.log('');

  if (!fs.existsSync(KB_DOCS_DIR)) {
    console.error(`  ✗  Docs directory not found: ${KB_DOCS_DIR}`);
    console.error('     Run: npx ts-node scripts/improved-chunking.ts');
    process.exit(1);
  }

  const jsonFiles = collectJsonFiles(KB_DOCS_DIR);
  if (jsonFiles.length === 0) {
    console.error('  ✗  No JSON chunk files found. Run the chunker first.');
    process.exit(1);
  }

  console.log(
    `  Found ${jsonFiles.length} chunk file(s): ${jsonFiles.map((f) => path.basename(f)).join(', ')}`
  );
  console.log('');

  // Load BGE-M3
  console.log('  Loading BGE-M3 (first run downloads ~568 MB int8 quantized, cached after) …');
  const startLoad = Date.now();

  const { pipeline } = await import('@xenova/transformers');

  const embedder = await pipeline('feature-extraction', MODEL_NAME, {
    progress_callback: undefined,
  });

  const loadMs = Date.now() - startLoad;
  console.log(`  ✓  Model ready in ${(loadMs / 1000).toFixed(1)}s`);
  console.log('');

  let totalDocs = 0;
  let totalEmbedded = 0;
  let totalSkipped = 0;

  for (const filePath of jsonFiles) {
    const fileName = path.basename(filePath);
    let docs: DocEntry[];

    try {
      docs = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as DocEntry[];
    } catch (err) {
      console.warn(`  ⚠  Skipping ${fileName} — parse error: ${String(err)}`);
      continue;
    }

    if (!Array.isArray(docs) || docs.length === 0) {
      console.warn(`  ⚠  Skipping ${fileName} — empty or not an array.`);
      continue;
    }

    console.log(`  Processing ${fileName} (${docs.length} entries) …`);
    totalDocs += docs.length;

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const label = `    [${progress(i + 1, docs.length)}] ${doc.id}`;
      const text = buildEmbedText(doc);

      if (!text.trim()) {
        console.log(`${label}  → skipped (empty text)`);
        totalSkipped++;
        continue;
      }

      try {
        const startEmbed = Date.now();

        const output = await embedder(text, {
          pooling: 'cls', // BGE-M3 uses CLS pooling (not mean)
          normalize: true, // L2-normalise → cosine similarity = dot product
        });

        const embedMs = Date.now() - startEmbed;
        doc.embedding = toNumberArray(output.data as Float32Array);

        console.log(`${label}  → ${doc.embedding.length}d  (${embedMs}ms)  [${doc.tokens} tokens]`);
        totalEmbedded++;
      } catch (err) {
        console.warn(`${label}  → FAILED: ${String(err)}`);
        totalSkipped++;
      }
    }

    try {
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');
      console.log(`  ✓  Wrote ${fileName}\n`);
    } catch (err) {
      console.error(`  ✗  Failed to write ${fileName}: ${String(err)}`);
      process.exit(1);
    }
  }

  console.log('  ─────────────────────────────────────────');
  console.log(`  Total docs   : ${totalDocs}`);
  console.log(`  Embedded     : ${totalEmbedded}`);
  console.log(`  Skipped/err  : ${totalSkipped}`);
  console.log('');
  console.log('  Done. Run: npm run build && npm test');
  console.log('');
}

main().catch((err) => {
  console.error('\n  ✗  Unhandled error:', err);
  process.exit(1);
});
