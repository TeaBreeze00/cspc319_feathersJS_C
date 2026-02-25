/**
 * generate-embeddings.ts
 *
 * Generates 1024-dimensional BGE-M3 dense embeddings for FeathersJS doc chunks.
 *
 * Speed features:
 *   1. INCREMENTAL — skips chunks that already carry a valid 1024-dim embedding.
 *      Pass --force to re-embed everything.
 *   2. TRUNCATED EMBED TEXT — embeds the semantic header (heading + breadcrumb +
 *      subHeadings + tags + category) plus the first ~1024 tokens of rawContent
 *      instead of the full 7500-token file. BGE-M3's CLS vector saturates around
 *      512-1024 tokens; the tail of a large doc adds near-zero retrieval signal
 *      but makes inference ~10-20x slower (O(n^2) attention).
 *
 * Run after chunking:
 *   npm run generate:embeddings           # incremental (default)
 *   npm run generate:embeddings -- --force # full rebuild
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
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

const CONFIG = {
  /**
   * Max characters fed to BGE-M3 for embedding.
   * 4 chars ≈ 1 token.  4096 chars ≈ 1024 tokens — well within BGE-M3's
   * sweet spot for dense retrieval, and ~6-15x faster than embedding a
   * full 7500-token document.
   */
  EMBED_MAX_CHARS: 4096,

  /** BGE-M3: 1024-dim, CLS pooling. Must match vectorSearch.ts exactly. */
  MODEL_NAME: 'Xenova/bge-m3',

  /** Expected embedding dimension — used to validate existing embeddings. */
  EXPECTED_DIMS: 1024,

  KB_DOCS_DIR: path.join(__dirname, '..', 'knowledge-base', 'chunks'),
};

// ---------------------------------------------------------------------------
// Embed text builder (KEY: uses all metadata from improved chunker)
// ---------------------------------------------------------------------------

/**
 * Build a compact but semantically rich embed string for one doc.
 *
 * Structure (always fully included):
 *   # <heading>
 *   Category: <category>
 *   Breadcrumb: <breadcrumb>
 *   Covers: <subHeadings joined>          ← table-of-contents signal
 *   Topics: <tags joined>                 ← concept signal
 *   Code languages: <codeLanguages>       ← if hasCode
 *
 *   <first N chars of rawContent, truncated at word boundary>
 *
 * The metadata prefix is always kept whole (~200-500 chars).
 * rawContent fills the remaining EMBED_MAX_CHARS budget.
 */
function buildEmbedText(doc: DocEntry): string {
  const headerLines: string[] = [];

  // Title — always first, strongest signal
  headerLines.push(`# ${doc.heading}`);

  // Category
  if (doc.category) {
    headerLines.push(`Category: ${doc.category}`);
  }

  // Breadcrumb (skip if same as heading)
  if (doc.breadcrumb && doc.breadcrumb !== doc.heading) {
    headerLines.push(`Breadcrumb: ${doc.breadcrumb}`);
  }

  // SubHeadings — shows the full scope of the doc
  if (doc.subHeadings && doc.subHeadings.length > 0) {
    headerLines.push(`Covers: ${doc.subHeadings.join(' | ')}`);
  }

  // Tags — concept-level signal
  if (doc.tags && doc.tags.length > 0) {
    headerLines.push(`Topics: ${doc.tags.join(', ')}`);
  }

  // Code languages (only if the doc has code)
  if (doc.hasCode && doc.codeLanguages && doc.codeLanguages.length > 0) {
    headerLines.push(`Code: ${doc.codeLanguages.join(', ')}`);
  }

  // Blank line before body
  headerLines.push('');

  const header = headerLines.join('\n');

  // Fill remaining budget with rawContent
  const budget = Math.max(0, CONFIG.EMBED_MAX_CHARS - header.length - 1);
  const body = doc.rawContent ?? doc.content ?? '';

  // Truncate at a word boundary so we don't cut a word in half
  let truncated = body.slice(0, budget);
  if (truncated.length < body.length) {
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > budget * 0.8) {
      truncated = truncated.slice(0, lastSpace);
    }
  }

  return `${header}\n${truncated}`.trim();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumberArray(float32: Float32Array): number[] {
  const out = new Array<number>(float32.length);
  for (let i = 0; i < float32.length; i++) {
    out[i] = Math.round(float32[i] * 1_000_000) / 1_000_000;
  }
  return out;
}

function pad(n: number, total: number): string {
  return String(n).padStart(String(total).length);
}

/** Returns true if the doc already has a valid BGE-M3 embedding. */
function hasValidEmbedding(doc: DocEntry): boolean {
  return (
    Array.isArray(doc.embedding) &&
    doc.embedding.length === CONFIG.EXPECTED_DIMS &&
    doc.embedding.every((v) => typeof v === 'number' && isFinite(v))
  );
}

function collectJsonFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json') && !entry.name.includes('metadata'))
      out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const force = process.argv.includes('--force');

  console.log('');
  console.log('  🪶  FeathersJS MCP — BGE-M3 Embedding Generator');
  console.log('  ──────────────────────────────────────────────────');
  console.log(`  Model     : ${CONFIG.MODEL_NAME}`);
  console.log(`  Dims      : ${CONFIG.EXPECTED_DIMS}`);
  console.log(
    `  Embed cap : ${CONFIG.EMBED_MAX_CHARS} chars (~${Math.round(CONFIG.EMBED_MAX_CHARS / 4)} tokens)`
  );
  console.log(`  Mode      : ${force ? 'FORCE (re-embed all)' : 'incremental (skip existing)'}`);
  console.log(`  Docs      : ${CONFIG.KB_DOCS_DIR}`);
  console.log('');

  if (!fs.existsSync(CONFIG.KB_DOCS_DIR)) {
    console.error(`  ✗  Docs directory not found: ${CONFIG.KB_DOCS_DIR}`);
    console.error('     Run: npm run chunk:docs');
    process.exit(1);
  }

  const jsonFiles = collectJsonFiles(CONFIG.KB_DOCS_DIR);
  if (jsonFiles.length === 0) {
    console.error('  ✗  No JSON chunk files found. Run the chunker first.');
    process.exit(1);
  }

  // ── Pre-scan: count how many docs actually need embedding ────────────────
  let totalDocs = 0;
  let totalNeedWork = 0;
  const fileData: { filePath: string; docs: DocEntry[] }[] = [];

  for (const filePath of jsonFiles) {
    try {
      const docs = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as DocEntry[];
      if (!Array.isArray(docs) || docs.length === 0) continue;
      totalDocs += docs.length;
      const needWork = force ? docs.length : docs.filter((d) => !hasValidEmbedding(d)).length;
      totalNeedWork += needWork;
      fileData.push({ filePath, docs });
    } catch {
      console.warn(`  ⚠  Could not parse ${path.basename(filePath)} — skipping.`);
    }
  }

  const alreadyDone = totalDocs - totalNeedWork;
  console.log(`  Chunks total    : ${totalDocs}`);
  console.log(`  Already embedded: ${alreadyDone}  ${alreadyDone > 0 ? '← will be skipped' : ''}`);
  console.log(`  Need embedding  : ${totalNeedWork}`);
  console.log('');

  if (totalNeedWork === 0) {
    console.log('  ✓  Nothing to do — all chunks are already embedded.');
    console.log('     Use --force to rebuild all embeddings.');
    console.log('');
    return;
  }

  // ── Load model (only if there's work to do) ───────────────────────────────
  console.log('  Loading BGE-M3 (first run downloads ~568 MB int8, cached after) …');
  const startLoad = Date.now();
  const { pipeline } = await import('@xenova/transformers');
  const embedder = await pipeline('feature-extraction', CONFIG.MODEL_NAME, {
    progress_callback: undefined,
  });
  console.log(`  ✓  Model ready in ${((Date.now() - startLoad) / 1000).toFixed(1)}s\n`);

  // ── Embed ─────────────────────────────────────────────────────────────────
  let embedded = 0;
  let skipped = 0;
  let errors = 0;
  const startAll = Date.now();

  for (const { filePath, docs } of fileData) {
    const fileName = path.basename(filePath);
    const needWork = force ? docs.length : docs.filter((d) => !hasValidEmbedding(d)).length;

    if (needWork === 0) {
      console.log(`  ⏭  ${fileName} — all ${docs.length} chunks already embedded, skipping.`);
      skipped += docs.length;
      continue;
    }

    console.log(`  📄  ${fileName} — ${needWork} of ${docs.length} chunks to embed …`);
    let fileChanged = false;

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const label = `    [${pad(i + 1, docs.length)}/${docs.length}] ${doc.id}`;

      // Skip if already valid and not forcing
      if (!force && hasValidEmbedding(doc)) {
        skipped++;
        continue;
      }

      const text = buildEmbedText(doc);
      if (!text.trim()) {
        console.log(`${label}  → skipped (empty text)`);
        skipped++;
        continue;
      }

      try {
        const t0 = Date.now();
        const output = await embedder(text, { pooling: 'cls', normalize: true });
        const ms = Date.now() - t0;

        doc.embedding = toNumberArray(output.data as Float32Array);
        fileChanged = true;
        embedded++;

        // ETA estimate
        const elapsed = (Date.now() - startAll) / 1000;
        const rate = embedded / elapsed;
        const remaining = totalNeedWork - embedded;
        const eta = remaining > 0 && rate > 0 ? Math.round(remaining / rate) : 0;
        const etaStr = eta > 0 ? `  ETA ~${eta}s` : '';

        console.log(
          `${label}  → ${doc.embedding.length}d  ${ms}ms  ` +
            `cat=${doc.category}  ${(doc.tags || []).length} tags  ` +
            `${(doc.subHeadings || []).length} subs  ~${text.length} chars${etaStr}`
        );
      } catch (err) {
        console.warn(`${label}  → FAILED: ${String(err)}`);
        errors++;
      }
    }

    if (fileChanged) {
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');
      console.log(`  ✓  Saved ${fileName}\n`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalSec = ((Date.now() - startAll) / 1000).toFixed(1);
  console.log('  ──────────────────────────────────────────');
  console.log(`  Embedded : ${embedded}`);
  console.log(`  Skipped  : ${skipped}  (already done or empty)`);
  console.log(`  Errors   : ${errors}`);
  console.log(`  Time     : ${totalSec}s`);
  if (embedded > 0) {
    console.log(
      `  Avg      : ${((Date.now() - startAll) / 1000 / embedded).toFixed(2)}s per chunk`
    );
  }
  console.log('');
  if (embedded > 0) console.log('  Done. Run: npm run build && npm test');
  console.log('');
}

main().catch((err) => {
  console.error('\n  ✗  Unhandled error:', err);
  process.exit(1);
});
