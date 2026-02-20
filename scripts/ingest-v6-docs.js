#!/usr/bin/env node
/**
 * ingest-v6-docs.js
 *
 * Reads FeathersJS v6 markdown documentation from docs/v6_docs/ (cloned from
 * the v6 branch of github.com/feathersjs/feathers, website/content directory)
 * and writes structured JSON entries into knowledge-base/docs/v6-*.json.
 *
 * Usage:
 *   node scripts/ingest-v6-docs.js [--source <path>]
 *
 * --source  Path to the v6 markdown content directory.
 *           Defaults to docs/v6_docs/ relative to the project root.
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
const V6_DOCS_DIR =
  sourceIdx !== -1 && args[sourceIdx + 1]
    ? path.resolve(args[sourceIdx + 1])
    : path.join(PROJECT_ROOT, 'docs', 'v6_docs');

const KB_DOCS_DIR = path.join(PROJECT_ROOT, 'knowledge-base', 'docs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum characters taken from content for each entry (model context limit). */
const MAX_CONTENT_CHARS = 4000;

/** Minimum content length to bother creating an entry (skip stubs). */
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
// Category mapping — inferred from directory / file names
// ---------------------------------------------------------------------------

/**
 * Map a relative file path (from V6_DOCS_DIR) to a knowledge-base category string.
 * Follows the directory conventions used in the v6 website/content layout.
 */
function inferCategory(relPath) {
  const parts = relPath.replace(/\\/g, '/').split('/');
  const topDir = parts[0] ? parts[0].toLowerCase() : '';

  if (topDir === 'api') {
    // Use the file name (without extension) for precise matching before
    // falling back to the subdirectory name.
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
 * Extract extra tags from the file path and first heading.
 */
function inferTags(relPath, title) {
  const tags = new Set();
  const combined = `${relPath} ${title}`.toLowerCase();

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
 */
function cleanMarkdown(raw) {
  let text = raw;

  // Remove YAML frontmatter (--- ... ---)
  text = text.replace(/^---[\s\S]*?---\s*/m, '');

  // Remove Nuxt Content MDC component blocks (::component ... ::)
  text = text.replace(/::[a-zA-Z][a-zA-Z0-9-]*[\s\S]*?::/g, '');

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

function truncate(text, maxChars = MAX_CONTENT_CHARS) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[... content truncated for knowledge base ...]';
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
      // Skip index files that are usually just nav stubs
      if (entry.name === 'index.md') {
        // Only include if the file has substantial content
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
// Category → output filename mapping
// ---------------------------------------------------------------------------

const CATEGORY_FILE_MAP = {
  'core-concepts': 'v6-core-concepts.json',
  services: 'v6-services.json',
  hooks: 'v6-hooks.json',
  authentication: 'v6-authentication.json',
  databases: 'v6-databases.json',
  configuration: 'v6-configuration.json',
  guides: 'v6-guides.json',
  cookbook: 'v6-cookbook.json',
  examples: 'v6-examples.json',
};

// ---------------------------------------------------------------------------
// Main ingestion logic
// ---------------------------------------------------------------------------

function main() {
  console.log('');
  console.log('  🪶  FeathersJS MCP — v6 Documentation Ingester');
  console.log('  ──────────────────────────────────────────────');
  console.log(`  Source : ${V6_DOCS_DIR}`);
  console.log(`  Output : ${KB_DOCS_DIR}`);
  console.log('');

  // Validate source directory
  if (!fs.existsSync(V6_DOCS_DIR)) {
    console.error(`  ✗  v6 docs directory not found: ${V6_DOCS_DIR}`);
    console.error('');
    console.error('  To set up the v6 docs, run:');
    console.error(
      '    git clone -b v6 https://github.com/feathersjs/feathers.git /tmp/feathers-v6'
    );
    console.error('    cp -r /tmp/feathers-v6/website/content docs/v6_docs');
    console.error('');
    console.error('  Or pass a custom source path:');
    console.error(
      '    node scripts/ingest-v6-docs.js --source /path/to/feathers-v6/website/content'
    );
    console.error('');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(KB_DOCS_DIR)) {
    fs.mkdirSync(KB_DOCS_DIR, { recursive: true });
  }

  // Collect all markdown files
  const mdFiles = collectMarkdownFiles(V6_DOCS_DIR, V6_DOCS_DIR);
  console.log(`  Found ${mdFiles.length} markdown file(s)\n`);

  if (mdFiles.length === 0) {
    console.warn(
      '  ⚠  No markdown files found. Check that the source directory contains .md files.'
    );
    process.exit(0);
  }

  // Group entries by category
  /** @type {Map<string, Array<object>>} */
  const byCategory = new Map();
  let idCounter = 1;
  let skipped = 0;
  let added = 0;

  for (const relPath of mdFiles) {
    const fullPath = path.join(V6_DOCS_DIR, relPath);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const cleaned = cleanMarkdown(raw);

    if (cleaned.length < MIN_CONTENT_CHARS) {
      console.log(`  → skip  ${relPath}  (too short: ${cleaned.length} chars)`);
      skipped++;
      continue;
    }

    // Derive a human-readable fallback title from the file name
    const fileBasename = path
      .basename(relPath, '.md')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const title = extractTitle(cleaned, `FeathersJS v6 — ${fileBasename}`);
    const category = inferCategory(relPath);
    const tags = inferTags(relPath, title);
    const content = truncate(cleaned);
    const tokens = tokenize(title + ' ' + content);

    const id = `v6-doc-${String(idCounter++).padStart(3, '0')}`;

    const entry = {
      id,
      title,
      content,
      version: 'v6',
      tokens,
      category,
      source: {
        path: relPath,
        url: `https://v6.feathersjs.com/${relPath.replace(/\\/g, '/').replace(/\.md$/, '')}`,
      },
      tags,
      // embedding will be populated by `npm run generate:embeddings`
    };

    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(entry);

    console.log(`  ✓ [${id}]  ${relPath}  →  ${category}`);
    added++;
  }

  console.log('');

  // Write one JSON file per category
  let filesWritten = 0;
  for (const [category, entries] of byCategory.entries()) {
    const outFile = CATEGORY_FILE_MAP[category] || `v6-${category}.json`;
    const outPath = path.join(KB_DOCS_DIR, outFile);

    // Merge with existing entries if the file already exists (re-run safe)
    let existing = [];
    if (fs.existsSync(outPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
        // Remove any previous v6 entries so we don't duplicate on re-run
        existing = existing.filter((e) => e.version !== 'v6');
      } catch {
        existing = [];
      }
    }

    const merged = [...existing, ...entries];
    fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf8');
    console.log(`  📄  Wrote ${outFile}  (${entries.length} v6 entries)`);
    filesWritten++;
  }

  // Summary
  console.log('');
  console.log('  ──────────────────────────────────────────────');
  console.log(`  Processed : ${mdFiles.length} markdown file(s)`);
  console.log(`  Added     : ${added} knowledge-base entries`);
  console.log(`  Skipped   : ${skipped} (too short / stub pages)`);
  console.log(`  Files     : ${filesWritten} JSON file(s) written`);
  console.log('');
  console.log('  Next step — regenerate embeddings:');
  console.log('    npm run generate:embeddings');
  console.log('');
  console.log('  Then commit knowledge-base/docs/v6-*.json');
  console.log('');
}

main();
