#!/usr/bin/env ts-node

/**
 * FeathersJS Documentation Chunker — Full-File Strategy (BGE-M3)
 *
 * Strategy: 1 file = 1 chunk.
 * BGE-M3 has an 8192-token context window — large enough to embed entire files.
 * This eliminates fragmentation and gives the agent complete, self-contained docs.
 *
 * Overflow rule: if a file exceeds MAX_EMBED_TOKENS (7500), split into 2 at
 * the midpoint ## heading. Affects only the largest files (~1-3 per version).
 *
 * Improvements over v1:
 *   - Comprehensive path + filename + content category extraction
 *   - ~100 tag concepts covering the full FeathersJS surface area
 *   - Skips non-content directories (.vitepress, assets, public, components, menus, node_modules)
 *   - Handles both v5 (<BlockQuote>) and v6 (::callout[label]) syntax
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

type Version = 'v5' | 'v6' | 'both';

interface Chunk {
  id: string;
  content: string; // embed text: semantic header + full rawContent
  rawContent: string; // full file content (returned to agent)
  breadcrumb: string;
  version: Version;
  sourceFile: string;
  heading: string; // document title (# heading)
  subHeadings: string[]; // all ##, ###, #### headings
  hasCode: boolean;
  codeLanguages: string[];
  tokens: number;
  category: string;
  tags: string[];
}

// ============================================================================
// Config
// ============================================================================

const CONFIG = {
  MAX_EMBED_TOKENS: 7500,
  MIN_CHUNK_TOKENS: 40,
  INPUT_DIRS: ['docs/v5_docs', 'docs/v6_docs'],
  OUTPUT_DIR: 'knowledge-base/chunks',
  CHARS_PER_TOKEN: 4,
};

/** Directories to skip during file walking (case-insensitive basename check). */
const SKIP_DIRS = new Set([
  '.vitepress',
  'assets',
  'public',
  'components',
  'node_modules',
  'menus',
]);

// ============================================================================
// Category extraction — three tiers: path → filename → content
// ============================================================================

/**
 * Tier 1: subdirectory patterns (most specific, checked first).
 * Order matters — first match wins.
 */
const PATH_CATEGORY_RULES: [RegExp, string][] = [
  // Cookbook sub-categories
  [/\/cookbook\/authentication\//, 'cookbook-authentication'],
  [/\/cookbook\/deploy\//, 'deployment'],
  [/\/cookbook\/express\//, 'cookbook-express'],
  [/\/cookbook\/general\//, 'cookbook'],
  [/\/cookbook\//, 'cookbook'],

  // API sub-categories
  [/\/api\/authentication\//, 'authentication'],
  [/\/api\/databases\//, 'databases'],
  [/\/api\/schema\//, 'schema'],
  [/\/api\/client\//, 'client'],

  // Guide sub-categories
  [/\/guides\/cli\//, 'cli'],
  [/\/guides\/basics\//, 'guides'],
  [/\/guides\/frontend\//, 'frontend'],
  [/\/guides\//, 'guides'],

  // Top-level groupings
  [/\/ecosystem\//, 'ecosystem'],
  [/\/help\//, 'help'],
];

/**
 * Tier 2: filename-based (for top-level /api/ files and root docs).
 * Checked when no path rule matched, using the basename without extension.
 */
const FILENAME_CATEGORY: Record<string, string> = {
  application: 'application',
  hooks: 'hooks',
  services: 'services',
  channels: 'channels',
  events: 'events',
  errors: 'errors',
  configuration: 'configuration',
  express: 'express',
  koa: 'koa',
  socketio: 'socketio',
  client: 'client',
  authentication: 'authentication',
  // v6 runtimes / transports
  browser: 'runtime',
  bun: 'runtime',
  cloudflare: 'runtime',
  deno: 'runtime',
  nodejs: 'runtime',
  http: 'transport',
  // Guides
  migrating: 'migration',
  security: 'security',
  'whats-new': 'release-notes',
  frameworks: 'frameworks',
  generator: 'cli',
  // Help
  faq: 'help',
  // Comparison files
  comparison: 'comparison',
  'feathers-vs-firebase': 'comparison',
  'feathers-vs-loopback': 'comparison',
  'feathers-vs-meteor': 'comparison',
  'feathers-vs-nest': 'comparison',
  'feathers-vs-sails': 'comparison',
  // Cookbook topics (when in root)
  docker: 'deployment',
  'file-uploading': 'cookbook-express',
  'view-engine': 'cookbook-express',
  scaling: 'cookbook',
  'client-test': 'testing',
  // Auth cookbook
  anonymous: 'cookbook-authentication',
  apiKey: 'cookbook-authentication',
  auth0: 'cookbook-authentication',
  facebook: 'cookbook-authentication',
  firebase: 'cookbook-authentication',
  google: 'cookbook-authentication',
  'revoke-jwt': 'cookbook-authentication',
  stateless: 'cookbook-authentication',
  _discord: 'cookbook-authentication',
  // CLI reference files
  declarations: 'cli',
  knexfile: 'cli',
  validators: 'cli',
  'log-error': 'cli',
  logger: 'cli',
  prettierrc: 'cli',
  tsconfig: 'cli',
  'default.json': 'cli',
  'custom-environment-variables': 'cli',
  // Schema files
  resolvers: 'schema',
  schema: 'schema',
  typebox: 'schema',
  // Database files
  adapters: 'databases',
  common: 'databases',
  knex: 'databases',
  memory: 'databases',
  mongodb: 'databases',
  querying: 'databases',
};

/**
 * Tier 3: content-based heuristics (last resort).
 * Each entry is [keywords to look for, category to assign].
 */
const CONTENT_CATEGORY_RULES: [string[], string][] = [
  [['hook context', 'before hook', 'after hook', 'around hook'], 'hooks'],
  [['service method', 'custom service', 'app.use'], 'services'],
  [['jwt', 'oauth', 'local strategy', 'authenticationservice'], 'authentication'],
  [['typebox', 'resolver', 'schema', 'validators'], 'schema'],
  [['mongodb', 'postgresql', 'knex', 'database adapter'], 'databases'],
  [['feathers client', 'rest client', 'socketio-client'], 'client'],
  [['real-time', 'channel', 'publish'], 'channels'],
  [['migration', 'upgrade', 'migrating'], 'migration'],
  [['bun.serve', 'deno.serve', 'cloudflare worker'], 'runtime'],
  [['docker', 'deploy'], 'deployment'],
  [['testing', 'test runner', 'jest', 'mocha'], 'testing'],
  [['security', 'cors', 'helmet', 'xss'], 'security'],
  [['hook'], 'hooks'],
  [['service'], 'services'],
];

function extractCategory(filePath: string, content: string): string {
  // Tier 1: path-based
  for (const [regex, cat] of PATH_CATEGORY_RULES) {
    if (regex.test(filePath)) return cat;
  }

  // Tier 2: filename-based
  const basename = path.basename(filePath, path.extname(filePath));
  if (FILENAME_CATEGORY[basename]) return FILENAME_CATEGORY[basename];

  // Also try filename with dots removed (e.g. "app.test" → "app.test" key)
  const basenameNormalized = basename.replace(/\./g, '-');
  if (FILENAME_CATEGORY[basenameNormalized]) return FILENAME_CATEGORY[basenameNormalized];

  // Tier 3: content-based
  const lower = content.toLowerCase();
  for (const [keywords, cat] of CONTENT_CATEGORY_RULES) {
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }

  return 'general';
}

// ============================================================================
// Tag extraction — comprehensive FeathersJS concept list
// ============================================================================

const TAG_CONCEPTS: string[] = [
  // Core
  'hooks',
  'services',
  'application',
  'context',
  'params',
  'provider',

  // Hook types
  'before hooks',
  'after hooks',
  'around hooks',
  'error hooks',
  'hook context',
  'hook functions',
  'hook flow',

  // Service methods
  'find',
  'get',
  'create',
  'update',
  'patch',
  'remove',
  'custom methods',
  'setup',
  'teardown',

  // Authentication & authorization
  'authentication',
  'authorization',
  'jwt',
  'oauth',
  'local strategy',
  'api key',
  'anonymous',
  'stateless',
  'revoke',

  // OAuth providers
  'google',
  'facebook',
  'github',
  'auth0',
  'discord',

  // Schema & validation
  'schema',
  'resolver',
  'typebox',
  'validation',
  'validators',

  // Database & adapters
  'database',
  'adapter',
  'mongodb',
  'postgresql',
  'knex',
  'memory',
  'pagination',
  'querying',
  'aggregation',
  'collection',

  // Real-time & channels
  'real-time',
  'websockets',
  'channels',
  'events',
  'socket.io',
  'publish',
  'subscribe',

  // Transport
  'rest',
  'http',
  'transport',

  // Frameworks
  'express',
  'koa',
  'middleware',

  // Runtimes / platforms
  'bun',
  'deno',
  'cloudflare',
  'browser',
  'node.js',

  // Client
  'feathers client',
  'client',

  // Configuration
  'configuration',
  'environment variables',

  // Error handling
  'error handling',
  'errors',

  // TypeScript
  'typescript',
  'types',
  'declarations',

  // CLI & generator
  'cli',
  'generator',
  'generate',

  // Testing
  'testing',
  'test',

  // Deployment & scaling
  'docker',
  'deployment',
  'scaling',

  // Security
  'security',
  'cors',
  'helmet',

  // Migration
  'migration',
  'upgrade',
  'migrating',

  // Misc features
  'logging',
  'logger',
  'file upload',
  'view engine',
  'mixins',
  'login',
  'users',
  'custom service',
  'custom events',
];

function extractTags(content: string): string[] {
  const tags = new Set<string>();
  const lower = content.toLowerCase();
  for (const concept of TAG_CONCEPTS) {
    if (lower.includes(concept)) tags.add(concept);
  }
  return Array.from(tags);
}

// ============================================================================
// SubHeading extraction — ##, ###, ####
// ============================================================================

function extractSubHeadings(content: string): string[] {
  const headings: string[] = [];
  let insideFence = false;
  for (const line of content.split('\n')) {
    if (line.match(/^```/)) {
      insideFence = !insideFence;
      continue;
    }
    if (insideFence) continue;
    const m = line.match(/^#{2,4}\s+(.+)/);
    if (m) headings.push(m[1].trim());
  }
  return headings;
}

// ============================================================================
// Other extractors
// ============================================================================

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CONFIG.CHARS_PER_TOKEN);
}

function extractVersion(filePath: string): Version {
  if (filePath.includes('v5_docs') || filePath.includes('/v5/')) return 'v5';
  if (filePath.includes('v6_docs') || filePath.includes('/v6/')) return 'v6';
  return 'both';
}

function generateChunkId(filePath: string, index: number): string {
  const basename = path.basename(filePath, path.extname(filePath));
  const version = extractVersion(filePath);
  return `${version}-${basename}-${index}`;
}

function extractCodeLanguages(content: string): string[] {
  const langs = new Set<string>();
  for (const match of content.matchAll(/^```(\S*)/gm)) {
    const lang = match[1].replace(/\{.*\}/, '').trim();
    langs.add(lang || 'text');
  }
  return Array.from(langs);
}

// ============================================================================
// Pre-processor — handles frontmatter, Badges, images, LanguageBlock, callouts
// ============================================================================

function preprocess(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let i = 0;

  // Skip YAML frontmatter
  if (lines[0]?.trim() === '---') {
    i++;
    while (i < lines.length && lines[i].trim() !== '---') i++;
    i++; // skip closing ---
  }

  while (i < lines.length) {
    const line = lines[i];

    // Skip <Badges> blocks
    if (line.match(/^<Badges>/)) {
      while (i < lines.length && !lines[i].match(/^<\/Badges>/)) i++;
      i++;
      continue;
    }

    // Skip image-only lines
    if (line.match(/^!\[.*\]\(.*\)/)) {
      i++;
      continue;
    }

    // Inline <LanguageBlock> — keep inner content, strip wrapper tags
    if (line.match(/^<LanguageBlock/)) {
      i++;
      while (i < lines.length && !lines[i].match(/^<\/LanguageBlock>/)) {
        const inner = lines[i].trim();
        if (inner) out.push(lines[i]);
        i++;
      }
      i++; // skip </LanguageBlock>
      continue;
    }

    // v5 callout: ::tip, ::warning, ::info, ::danger, ::note (with optional [label])
    const calloutMatch = line.match(/^::(tip|warning|info|danger|note)(\[.*?\])?\s*$/i);
    if (calloutMatch) {
      const type = calloutMatch[1];
      const label = calloutMatch[2]?.slice(1, -1) || type;
      out.push(`> **${label}:**`);
      i++;
      while (i < lines.length && !lines[i].match(/^::\s*$/)) {
        out.push(`> ${lines[i]}`);
        i++;
      }
      i++; // skip closing ::
      continue;
    }

    // v5 <BlockQuote> elements
    const bqMatch = line.match(/^<BlockQuote\s+type="(\w+)"(\s+label="([^"]*)")?/);
    if (bqMatch) {
      const label = bqMatch[3] || bqMatch[1];
      out.push(`> **${label}:**`);
      i++;
      while (i < lines.length && !lines[i].match(/^<\/BlockQuote>/)) {
        out.push(`> ${lines[i]}`);
        i++;
      }
      i++; // skip </BlockQuote>
      continue;
    }

    out.push(line);
    i++;
  }

  return out.join('\n');
}

// ============================================================================
// Section splitter
// ============================================================================

interface Section {
  level: number; // 0 = preamble, 1 = #, 2 = ##, 3 = ###
  heading: string;
  body: string;
}

function splitIntoSections(content: string): Section[] {
  const lines = content.split('\n');
  const sections: Section[] = [];
  let insideCodeFence = false;
  let currentLevel = 0;
  let currentHeading = '';
  let bodyLines: string[] = [];

  function flush() {
    const body = bodyLines.join('\n').trim();
    if (currentHeading || body)
      sections.push({ level: currentLevel, heading: currentHeading, body });
    bodyLines = [];
  }

  for (const line of lines) {
    if (line.match(/^```/)) {
      insideCodeFence = !insideCodeFence;
      bodyLines.push(line);
      continue;
    }

    if (!insideCodeFence) {
      const h1 = line.match(/^# (.+)/);
      const h2 = line.match(/^## (.+)/);
      const h3 = line.match(/^### (.+)/);
      if (h1) {
        flush();
        currentLevel = 1;
        currentHeading = h1[1].trim();
        continue;
      }
      if (h2) {
        flush();
        currentLevel = 2;
        currentHeading = h2[1].trim();
        continue;
      }
      if (h3) {
        flush();
        currentLevel = 3;
        currentHeading = h3[1].trim();
        continue;
      }
    }

    bodyLines.push(line);
  }

  flush();
  return sections;
}

// ============================================================================
// Chunk builder
// ============================================================================

function buildContent(
  heading: string,
  breadcrumb: string,
  subHeadings: string[],
  tags: string[],
  rawContent: string
): string {
  const parts: string[] = [];
  parts.push(`# ${heading}`);
  parts.push(`Breadcrumb: ${breadcrumb}`);
  if (subHeadings.length > 0) parts.push(`Covers: ${subHeadings.join(' | ')}`);
  if (tags.length > 0) parts.push(`Topics: ${tags.join(', ')}`);
  parts.push('');
  parts.push(rawContent);
  return parts.join('\n');
}

function makeChunk(
  heading: string,
  docTitle: string,
  rawContent: string,
  sourceFile: string,
  version: Version,
  index: number
): Chunk {
  const subHeadings = extractSubHeadings(rawContent);
  const tags = extractTags(rawContent);
  const codeLanguages = extractCodeLanguages(rawContent);
  const category = extractCategory(sourceFile, rawContent);
  const breadcrumb = heading === docTitle ? docTitle : `${docTitle} > ${heading}`;
  const content = buildContent(heading, breadcrumb, subHeadings, tags, rawContent);

  return {
    id: generateChunkId(sourceFile, index),
    content,
    rawContent,
    breadcrumb,
    version,
    sourceFile,
    heading,
    subHeadings,
    hasCode: rawContent.includes('```'),
    codeLanguages,
    tokens: estimateTokens(rawContent),
    category,
    tags,
  };
}

function buildChunks(sections: Section[], sourceFile: string, docTitle: string): Chunk[] {
  const version = extractVersion(sourceFile);

  // Reconstruct full file body, folding ### under their parent ##
  const h2Blocks: { heading: string; body: string }[] = [];
  let currentBlock: { heading: string; body: string } | null = null;

  for (const section of sections) {
    if (section.level === 1) continue; // title already captured as docTitle

    if (section.level === 2) {
      if (currentBlock) h2Blocks.push(currentBlock);
      currentBlock = { heading: section.heading, body: `## ${section.heading}\n\n${section.body}` };
    } else if (section.level === 3 && currentBlock) {
      currentBlock.body += `\n\n### ${section.heading}\n\n${section.body}`;
    } else if (section.level === 0) {
      // Preamble (text before any ## heading)
      if (!currentBlock) {
        currentBlock = { heading: docTitle, body: section.body };
      } else {
        currentBlock.body += `\n\n${section.body}`;
      }
    }
  }
  if (currentBlock) h2Blocks.push(currentBlock);

  const fullBody = h2Blocks
    .map((b) => b.body)
    .join('\n\n')
    .trim();
  const totalTokens = estimateTokens(fullBody);

  // Single chunk — fits in BGE-M3's window
  if (totalTokens <= CONFIG.MAX_EMBED_TOKENS) {
    return [makeChunk(docTitle, docTitle, fullBody, sourceFile, version, 0)];
  }

  // Overflow — split into 2 at midpoint ## heading
  console.warn(`    ⚠  ${path.basename(sourceFile)} is ${totalTokens} tokens — splitting into 2`);
  const midpoint = Math.floor(h2Blocks.length / 2);
  const part1Body = h2Blocks
    .slice(0, midpoint)
    .map((b) => b.body)
    .join('\n\n')
    .trim();
  const part2Body = h2Blocks
    .slice(midpoint)
    .map((b) => b.body)
    .join('\n\n')
    .trim();

  const chunks: Chunk[] = [];
  if (estimateTokens(part1Body) >= CONFIG.MIN_CHUNK_TOKENS)
    chunks.push(makeChunk(`${docTitle} (part 1)`, docTitle, part1Body, sourceFile, version, 0));
  if (estimateTokens(part2Body) >= CONFIG.MIN_CHUNK_TOKENS)
    chunks.push(makeChunk(`${docTitle} (part 2)`, docTitle, part2Body, sourceFile, version, 1));

  return chunks;
}

// ============================================================================
// File processor
// ============================================================================

function processFile(filePath: string): { chunks: Chunk[]; meta: object } {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const cleaned = preprocess(raw);
  const sections = splitIntoSections(cleaned);
  const titleSection = sections.find((s) => s.level === 1);
  const docTitle = titleSection?.heading || path.basename(filePath, '.md');
  const chunks = buildChunks(sections, filePath, docTitle);

  return {
    chunks,
    meta: {
      file: filePath,
      version: extractVersion(filePath),
      docTitle,
      totalChunks: chunks.length,
    },
  };
}

function getAllMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  function walk(p: string) {
    for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
      // Skip hidden dirs and non-content dirs
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(p, entry.name));
      } else if (entry.name.endsWith('.md')) {
        files.push(path.join(p, entry.name));
      }
    }
  }
  walk(dir);
  return files;
}

// ============================================================================
// Main
// ============================================================================

function main() {
  console.log('🚀 FeathersJS full-file chunker (BGE-M3 strategy)...\n');
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });

  const allChunks: { v5: Chunk[]; v6: Chunk[] } = { v5: [], v6: [] };
  const stats = {
    v5: {
      files: 0,
      chunks: 0,
      withCode: 0,
      categories: new Set<string>(),
      tags: new Set<string>(),
    },
    v6: {
      files: 0,
      chunks: 0,
      withCode: 0,
      categories: new Set<string>(),
      tags: new Set<string>(),
    },
  };

  for (const dir of CONFIG.INPUT_DIRS) {
    if (!fs.existsSync(dir)) {
      console.warn(`⚠️  Not found: ${dir}`);
      continue;
    }
    console.log(`📂 ${dir}`);
    const files = getAllMarkdownFiles(dir);
    console.log(`   ${files.length} markdown files\n`);

    for (const file of files) {
      try {
        const { chunks } = processFile(file);
        const version = extractVersion(file);
        const label = chunks.length > 1 ? ` → split ${chunks.length}` : '';
        const cats = [...new Set(chunks.map((c) => c.category))].join(', ');
        const tagCt = [...new Set(chunks.flatMap((c) => c.tags))].length;
        const subCt = [...new Set(chunks.flatMap((c) => c.subHeadings))].length;
        console.log(
          `   ✓ ${path.basename(file).padEnd(35)} ${String(chunks[0].tokens).padStart(5)} tok` +
            `  cat=${cats.padEnd(22)}  ${tagCt} tags  ${subCt} subs${label}`
        );

        if (version === 'v5' || version === 'both') {
          allChunks.v5.push(...chunks);
          stats.v5.files++;
          stats.v5.chunks += chunks.length;
          stats.v5.withCode += chunks.filter((c) => c.hasCode).length;
          chunks.forEach((c) => {
            stats.v5.categories.add(c.category);
            c.tags.forEach((t) => stats.v5.tags.add(t));
          });
        }
        if (version === 'v6' || version === 'both') {
          allChunks.v6.push(...chunks);
          stats.v6.files++;
          stats.v6.chunks += chunks.length;
          stats.v6.withCode += chunks.filter((c) => c.hasCode).length;
          chunks.forEach((c) => {
            stats.v6.categories.add(c.category);
            c.tags.forEach((t) => stats.v6.tags.add(t));
          });
        }
      } catch (err) {
        console.error(`   ✗ ${file}:`, err);
      }
    }
    console.log('');
  }

  for (const version of ['v5', 'v6'] as const) {
    const outFile = path.join(CONFIG.OUTPUT_DIR, `${version}-chunks.json`);
    fs.writeFileSync(outFile, JSON.stringify(allChunks[version], null, 2));
    console.log(`✓ ${version}: ${allChunks[version].length} chunks → ${outFile}`);
  }

  fs.writeFileSync(
    path.join(CONFIG.OUTPUT_DIR, 'metadata.json'),
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        config: CONFIG,
        stats: {
          v5: {
            files: stats.v5.files,
            chunks: stats.v5.chunks,
            withCode: stats.v5.withCode,
            categories: [...stats.v5.categories].sort(),
            uniqueTags: stats.v5.tags.size,
          },
          v6: {
            files: stats.v6.files,
            chunks: stats.v6.chunks,
            withCode: stats.v6.withCode,
            categories: [...stats.v6.categories].sort(),
            uniqueTags: stats.v6.tags.size,
          },
        },
      },
      null,
      2
    )
  );

  console.log('\n📊 Summary:');
  for (const [v, s] of Object.entries(stats)) {
    if (s.files > 0) {
      console.log(`   ${v}: ${s.chunks} chunks from ${s.files} files`);
      console.log(`       categories: ${[...s.categories].sort().join(', ')}`);
      console.log(`       unique tags: ${s.tags.size}`);
    }
  }
  console.log('\n💡 Next: npm run generate:embeddings');
}

if (require.main === module) main();

export { preprocess, splitIntoSections, buildChunks, processFile };
