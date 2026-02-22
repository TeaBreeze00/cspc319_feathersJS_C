#!/usr/bin/env node
/**
 * ingest-v5-docs-sectioned.js
 *
 * Reads FeathersJS v5 markdown documentation from docs/v5_docs/ and writes
 * structured JSON entries with SECTION-LEVEL CHUNKING into knowledge-base/docs/v5/.
 *
 * Instead of one entry per file, this ingester:
 * - Splits each markdown file at ## and ### heading boundaries
 * - Creates a separate DocEntry for each section
 * - Preserves file-level context in breadcrumb titles
 * - Applies per-chunk content length limits
 *
 * Usage:
 *   node scripts/ingest-v5-docs-sectioned.js [--source <path>]
 *
 * --source  Path to the v5 markdown content directory.
 *           Defaults to docs/v5_docs/ relative to the project root.
 *
 * After running this script, regenerate embeddings:
 *   npm run generate:embeddings
 *
 * Then commit both the JSON files and the updated embeddings.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.join(__dirname, '..');

// Allow overriding source path via --source flag
const args = process.argv.slice(2);
const sourceIdx = args.indexOf('--source');
const V5_DOCS_DIR =
  sourceIdx !== -1 && args[sourceIdx + 1]
    ? path.resolve(args[sourceIdx + 1])
    : path.join(PROJECT_ROOT, 'docs', 'v5_docs');

const KB_DOCS_DIR = path.join(PROJECT_ROOT, 'knowledge-base', 'docs', 'v5');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum characters per chunk (model context limit). */
const MAX_CONTENT_CHARS = 4000;

/** Minimum content length to create a chunk (skip stubs). */
const MIN_CONTENT_CHARS = 40;

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'shall',
  'should',
  'may',
  'might',
  'must',
  'can',
  'could',
  'and',
  'but',
  'or',
  'nor',
  'not',
  'so',
  'yet',
  'both',
  'either',
  'neither',
  'each',
  'every',
  'all',
  'any',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'only',
  'own',
  'same',
  'than',
  'too',
  'very',
  'just',
  'because',
  'as',
  'until',
  'while',
  'of',
  'at',
  'by',
  'for',
  'with',
  'about',
  'against',
  'between',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'to',
  'from',
  'up',
  'down',
  'in',
  'out',
  'on',
  'off',
  'over',
  'under',
  'again',
  'further',
  'then',
  'once',
  'here',
  'there',
  'when',
  'where',
  'why',
  'how',
  'what',
  'which',
  'who',
  'whom',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'i',
  'me',
  'my',
  'myself',
  'we',
  'our',
  'ours',
  'you',
  'your',
  'he',
  'him',
  'his',
  'she',
  'her',
  'they',
  'them',
  'their',
]);

// ---------------------------------------------------------------------------
// Category mapping
// ---------------------------------------------------------------------------

/**
 * Map a relative file path (from V5_DOCS_DIR) to a knowledge-base category string.
 */
function inferCategory(relPath) {
  const parts = relPath.replace(/\\/g, '/').split('/');
  const topDir = parts[0] ? parts[0].toLowerCase() : '';

  if (topDir === 'api') {
    const fileName = path.basename(parts[parts.length - 1], '.md').toLowerCase();
    const sub = (parts[1] || '').toLowerCase();

    if (fileName === 'hooks' || fileName === 'hook') return 'hooks';
    if (fileName === 'services' || fileName === 'service') return 'services';
    if (fileName === 'authentication' || sub === 'authentication' || sub === 'auth')
      return 'authentication';
    if (fileName === 'errors') return 'core-concepts';
    if (fileName === 'channels') return 'core-concepts';
    if (fileName === 'events') return 'core-concepts';
    if (fileName === 'application') return 'core-concepts';
    if (sub.startsWith('schema') || sub.startsWith('type')) return 'configuration';
    if (
      sub.startsWith('database') ||
      sub.startsWith('db') ||
      sub.startsWith('knex') ||
      sub.startsWith('mongo')
    )
      return 'databases';
    return 'core-concepts';
  }
  if (topDir === 'guides') {
    const fileName = path.basename(parts[parts.length - 1], '.md').toLowerCase();
    if (fileName === 'hooks') return 'hooks';
    if (fileName === 'services') return 'services';
    if (fileName === 'authentication') return 'authentication';
    return 'guides';
  }
  if (topDir === 'cookbook') return 'cookbook';
  if (topDir === 'help' || topDir === 'support') return 'guides';
  if (topDir === 'ecosystem') return 'cookbook';

  // Top-level files
  if (parts.length === 1) {
    const name = parts[0].toLowerCase();
    if (name.includes('hook')) return 'hooks';
    if (name.includes('service')) return 'services';
    if (name.includes('auth')) return 'authentication';
    if (name.includes('database') || name.includes('db')) return 'databases';
  }

  return 'guides';
}

/**
 * Extract extra tags from the file path and headings.
 */
function inferTags(relPath, headingPath) {
  const tags = new Set();
  const combined = `${relPath} ${headingPath.join(' ')}`.toLowerCase();

  const tagKeywords = [
    'hook',
    'hooks',
    'service',
    'services',
    'authentication',
    'auth',
    'jwt',
    'database',
    'mongodb',
    'postgresql',
    'sqlite',
    'knex',
    'sequelize',
    'schema',
    'resolver',
    'validation',
    'channels',
    'real-time',
    'websocket',
    'socketio',
    'express',
    'koa',
    'rest',
    'client',
    'typescript',
    'migration',
    'testing',
    'deployment',
    'configuration',
    'errors',
    'events',
  ];

  for (const kw of tagKeywords) {
    if (combined.includes(kw)) tags.add(kw);
  }

  return [...tags];
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function tokenize(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
  const unique = [...new Set(words.filter((w) => !STOPWORDS.has(w)))];
  return unique;
}

/**
 * Strip Nuxt Content / VitePress frontmatter, Vue/MDC components, and HTML
 * tags from markdown so we are left with plain prose + fenced code blocks.
 *
 * IMPORTANT: Preserve callout content (::note::, ::tip::, ::warning::)
 * by only stripping the markers, not the content.
 */
function cleanMarkdown(raw) {
  let text = raw;

  // Remove YAML frontmatter (--- ... ---)
  text = text.replace(/^---[\s\S]*?---\s*/m, '');

  // Strip MDC component markers but PRESERVE the inner content
  // This regex removes the opening and closing :: markers only
  text = text.replace(/::[a-zA-Z][a-zA-Z0-9-]*\s*/g, '');
  text = text.replace(/\s*::/g, '');

  // Remove inline Vue / HTML components and self-closing tags
  text = text.replace(/<[A-Z][A-Za-z0-9]*[^>]*\/>/g, '');
  text = text.replace(/<[A-Z][A-Za-z0-9]*[^>]*>[\s\S]*?<\/[A-Z][A-Za-z0-9]*>/g, '');

  // Remove standard HTML tags (but keep the text inside)
  text = text.replace(/<[^>]+>/g, ' ');

  // Collapse multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

/**
 * Extract the first H1 or H2 heading from markdown as the entry title.
 * Falls back to the file name (without extension).
 */
function extractTitle(markdown, fallback) {
  const match = markdown.match(/^#{1,2}\s+(.+)$/m);
  if (match) return match[1].trim().replace(/\*\*/g, '');
  return fallback;
}

/**
 * Split markdown into sections based on ## and ### headings.
 * Returns an array of { level, heading, content } objects.
 *
 * Rules:
 * - Split on ## (level 2) and ### (level 3) boundaries
 * - Content under a heading continues until the next heading of same or higher priority
 * - Level 1 (# or ##) becomes the file-level title and is not chunked
 */
function splitIntoSections(markdown) {
  const lines = markdown.split('\n');
  const sections = [];
  let currentSection = null;
  let firstHeadingSkipped = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#+)\s+(.+)$/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const heading = headingMatch[2].trim().replace(/\*\*/g, '');

      // Skip the first H1/H2 (file-level title)
      if (!firstHeadingSkipped && level <= 2) {
        firstHeadingSkipped = true;
        continue;
      }

      // Start a new section for H2 and H3
      if (level >= 2 && level <= 3) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          level,
          heading,
          lines: [],
        };
      }
    } else if (currentSection) {
      currentSection.lines.push(line);
    }
  }

  // Don't forget the last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

function truncate(text, maxChars = MAX_CONTENT_CHARS) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[... content truncated for knowledge base ...]';
}

/**
 * Generate a stable ID based on file path and heading.
 * Format: v5/category/filename#heading-slug
 */
function generateId(relPath, headingPath) {
  const slug = headingPath
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const fileSlug = path
    .basename(relPath, '.md')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-');

  return `v5/${fileSlug}#${slug}`;
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

/**
 * Recursively collect all .md files under a directory.
 * Returns paths relative to baseDir.
 */
function collectMarkdownFiles(dir, baseDir, results = []) {
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      // Skip hidden directories and VitePress internals
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'public')
        continue;
      collectMarkdownFiles(fullPath, baseDir, results);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      // Skip stub index files
      if (entry.name === 'index.md') {
        const raw = fs.readFileSync(fullPath, 'utf8');
        const cleaned = cleanMarkdown(raw);
        if (cleaned.length < MIN_CONTENT_CHARS * 3) continue;
      }
      results.push(relPath);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main ingestion logic
// ---------------------------------------------------------------------------

function main() {
  console.log('');
  console.log('  🫶  FeathersJS MCP — v5 Documentation Ingester (Section-Level Chunking)');
  console.log('  ──────────────────────────────────────────────────────────────────────');
  console.log(`  Source : ${V5_DOCS_DIR}`);
  console.log(`  Output : ${KB_DOCS_DIR}`);
  console.log('');

  // Validate source directory
  if (!fs.existsSync(V5_DOCS_DIR)) {
    console.error(`  ✗  v5 docs directory not found: ${V5_DOCS_DIR}`);
    console.error('');
    console.error('  To set up the v5 docs, run:');
    console.error(
      '    git clone -b v5 https://github.com/feathersjs/feathers.git /tmp/feathers-v5'
    );
    console.error('    cp -r /tmp/feathers-v5/website/content docs/v5_docs');
    console.error('');
    console.error('  Or pass a custom source path:');
    console.error(
      '    node scripts/ingest-v5-docs-sectioned.js --source /path/to/feathers-v5/website/content'
    );
    console.error('');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(KB_DOCS_DIR)) {
    fs.mkdirSync(KB_DOCS_DIR, { recursive: true });
  }

  // Collect all markdown files
  const mdFiles = collectMarkdownFiles(V5_DOCS_DIR, V5_DOCS_DIR);
  console.log(`  Found ${mdFiles.length} markdown file(s)\n`);

  if (mdFiles.length === 0) {
    console.warn(
      '  ⚠  No markdown files found. Check that the source directory contains .md files.'
    );
    process.exit(0);
  }

  // Ingest files and create chunks
  let totalChunks = 0;
  let skipped = 0;
  let filesProcessed = 0;

  // Group chunks by category for output
  /** @type {Map<string, Array<object>>} */
  const byCategory = new Map();

  for (const relPath of mdFiles) {
    const fullPath = path.join(V5_DOCS_DIR, relPath);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const cleaned = cleanMarkdown(raw);

    if (cleaned.length < MIN_CONTENT_CHARS) {
      console.log(`  → skip  ${relPath}  (too short: ${cleaned.length} chars)`);
      skipped++;
      continue;
    }

    filesProcessed++;

    // Extract the main file title
    const fileBasename = path
      .basename(relPath, '.md')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const fileTitle = extractTitle(cleaned, `FeathersJS v5 — ${fileBasename}`);

    // Split into sections
    const sections = splitIntoSections(cleaned);

    // If no sections found, treat the whole file as one chunk (fallback)
    if (sections.length === 0) {
      const category = inferCategory(relPath);
      const tokens = tokenize(fileTitle + ' ' + cleaned);
      const content = truncate(cleaned);
      const id = generateId(relPath, [fileTitle]);
      const tags = inferTags(relPath, [fileTitle]);

      const entry = {
        id,
        title: fileTitle,
        content,
        version: 'v5',
        tokens,
        category,
        sourceFile: relPath,
        headingPath: [fileTitle],
        source: {
          path: relPath,
          url: `https://v5.feathersjs.com/${relPath.replace(/\\/g, '/').replace(/\.md$/, '')}`,
        },
        tags,
      };

      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category).push(entry);

      console.log(`  ✓ [${id}]  ${relPath}  (no sections, treating as single chunk)`);
      totalChunks++;
      continue;
    }

    // Create entries for each section
    for (const section of sections) {
      const sectionContent = section.lines.join('\n').trim();

      if (sectionContent.length < MIN_CONTENT_CHARS) {
        continue; // Skip empty or very short sections
      }

      const category = inferCategory(relPath);
      const headingPath = [fileTitle, section.heading];
      const id = generateId(relPath, headingPath);
      const title = `${fileTitle} > ${section.heading}`;
      const tokens = tokenize(title + ' ' + sectionContent);
      const content = truncate(sectionContent);
      const tags = inferTags(relPath, headingPath);

      const entry = {
        id,
        title,
        content,
        version: 'v5',
        tokens,
        category,
        sourceFile: relPath,
        headingPath,
        source: {
          path: relPath,
          url: `https://v5.feathersjs.com/${relPath.replace(/\\/g, '/').replace(/\.md$/, '')}`,
        },
        tags,
      };

      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category).push(entry);

      totalChunks++;
    }

    console.log(`  ✓ ${relPath}  →  ${sections.length} section(s)`);
  }

  console.log('');

  // Write JSON files grouped by category
  let filesWritten = 0;
  for (const [category, entries] of byCategory.entries()) {
    const outFile = `${category}.json`;
    const outPath = path.join(KB_DOCS_DIR, outFile);

    // Merge with existing entries if file exists (preserve non-v5 entries)
    let existing = [];
    if (fs.existsSync(outPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
        // Remove any previous v5 entries so we don't duplicate on re-run
        existing = existing.filter((e) => e.version !== 'v5');
      } catch {
        existing = [];
      }
    }

    const merged = [...existing, ...entries];
    fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf8');
    console.log(`  📄  Wrote v5/${outFile}  (${entries.length} v5 entries)`);
    filesWritten++;
  }

  // Summary
  console.log('');
  console.log('  ──────────────────────────────────────────────────────────────────────');
  console.log(`  Processed  : ${mdFiles.length} markdown file(s)`);
  console.log(`  Files used : ${filesProcessed} (${skipped} skipped as too short)`);
  console.log(`  Chunks     : ${totalChunks} total section-level entries`);
  console.log(`  Files      : ${filesWritten} JSON file(s) written to knowledge-base/docs/v5/`);
  console.log('');
  console.log('  Next step — regenerate embeddings:');
  console.log('    npm run generate:embeddings');
  console.log('');
  console.log('  Then commit knowledge-base/docs/v5/');
  console.log('');
}

main();
