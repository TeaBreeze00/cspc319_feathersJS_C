#!/usr/bin/env ts-node

/**
 * FeathersJS Documentation Chunker — Hierarchical Header Strategy
 *
 * Chunking logic:
 * - # = document title → prepended as context to all chunks in the file
 * - ## = primary chunk boundary, always creates a new chunk
 * - ### = sub-chunk boundary, but only if the ## section exceeds MAX_SECTION_TOKENS
 *
 * Every chunk carries a full breadcrumb: e.g. "Hooks > Hook context > context.params"
 * Code blocks are never split — they are consumed atomically within their section.
 *
 * Handles:
 * - ```ts, ```js, ```sh, ``` (bare) code fences
 * - <BlockQuote> components (v5 style)
 * - ::tip / ::warning / ::info / ::danger callouts (v6 style)
 * - <LanguageBlock> tags (stripped, prose content kept)
 * - <Badges> blocks and image lines (stripped)
 * - YAML Frontmatter (stripped)
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

type Version = 'v5' | 'v6' | 'both';

interface Chunk {
  id: string;
  content: string; // breadcrumb + raw content — this is what you embed
  rawContent: string; // content without breadcrumb prefix
  breadcrumb: string; // e.g. "Hooks > Hook context > context.params"
  version: Version;
  sourceFile: string;
  heading: string; // the immediate heading for this chunk
  hasCode: boolean;
  codeLanguages: string[];
  tokens: number;
  category: string;
  tags: string[];
  prevChunkId?: string;
  nextChunkId?: string;
}

// ============================================================================
// Config
// ============================================================================

const CONFIG = {
  MAX_SECTION_TOKENS: 500, // ## sections larger than this get split at ###
  MIN_CHUNK_TOKENS: 40, // discard chunks smaller than this
  INPUT_DIRS: ['docs/v5_docs', 'docs/v6_docs'],
  OUTPUT_DIR: 'knowledge-base/chunks',
  CHARS_PER_TOKEN: 4,
};

// ============================================================================
// Utilities
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

function extractCategory(filePath: string, content: string): string {
  const pathMatch = filePath.match(
    /\/(hooks|services|authentication|databases|schema|client|api|guides|cookbook|ecosystem|koa|express)\//
  );
  if (pathMatch) return pathMatch[1];

  const lower = content.toLowerCase();
  if (
    lower.includes('hook context') ||
    lower.includes('before hook') ||
    lower.includes('after hook')
  )
    return 'hooks';
  if (lower.includes('service method') || lower.includes('custom service')) return 'services';
  if (lower.includes('jwt') || lower.includes('oauth') || lower.includes('local strategy'))
    return 'authentication';
  if (lower.includes('typebox') || lower.includes('resolver') || lower.includes('schema'))
    return 'schema';
  if (lower.includes('mongodb') || lower.includes('postgresql') || lower.includes('knex'))
    return 'databases';
  if (lower.includes('feathers client') || lower.includes('rest client')) return 'client';
  if (lower.includes('real-time') || lower.includes('channel') || lower.includes('publish'))
    return 'events';
  if (lower.includes('migration') || lower.includes('upgrade')) return 'migration';
  if (lower.includes('hook')) return 'hooks';
  if (lower.includes('service')) return 'services';
  return 'general';
}

function extractTags(content: string): string[] {
  const tags = new Set<string>();
  const concepts = [
    'hooks',
    'services',
    'context',
    'params',
    'provider',
    'authentication',
    'authorization',
    'jwt',
    'oauth',
    'local strategy',
    'schema',
    'resolver',
    'typebox',
    'validation',
    'database',
    'adapter',
    'mongodb',
    'postgresql',
    'knex',
    'pagination',
    'real-time',
    'websockets',
    'channels',
    'events',
    'rest',
    'find',
    'get',
    'create',
    'update',
    'patch',
    'remove',
    'before hooks',
    'after hooks',
    'around hooks',
    'error hooks',
    'hook context',
    'hook functions',
    'custom methods',
    'migrations',
    'feathers client',
    'socket.io',
    'error handling',
    'middleware',
    'setup',
    'teardown',
    'application',
  ];
  const lower = content.toLowerCase();
  for (const concept of concepts) {
    if (lower.includes(concept)) tags.add(concept);
  }
  return Array.from(tags);
}

function extractCodeLanguages(content: string): string[] {
  const langs = new Set<string>();
  for (const match of content.matchAll(/^```(\S*)/gm)) {
    const lang = match[1].replace(/\{.*\}/, '').trim();
    langs.add(lang || 'text'); // bare ``` fence gets 'text' instead of being skipped
  }
  return Array.from(langs);
}

// ============================================================================
// Pre-processor
//
// Normalizes the raw markdown before parsing:
// - Strips YAML frontmatter
// - Strips <Badges> blocks
// - Strips image lines
// - Strips <LanguageBlock> tags but keeps inner prose
// - Converts ::tip/warning/info/danger callouts into <BlockQuote> format
//   so the section splitter only has to handle one callout style
// ============================================================================

function preprocess(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let i = 0;

  // Strip frontmatter
  if (lines[0]?.trim() === '---') {
    i++;
    while (i < lines.length && lines[i].trim() !== '---') i++;
    i++;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Strip <Badges> blocks
    if (line.match(/^<Badges>/)) {
      while (i < lines.length && !lines[i].match(/^<\/Badges>/)) i++;
      i++;
      continue;
    }

    // Strip image lines
    if (line.match(/^!\[.*\]\(.*\)/)) {
      i++;
      continue;
    }

    // Strip <LanguageBlock> tags, keep inner prose
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

    // Normalize ::callout into <BlockQuote> for uniform downstream parsing
    const calloutMatch = line.match(/^::(tip|warning|info|danger|note)(\[.*?\])?\s*$/i);
    if (calloutMatch) {
      out.push(`<BlockQuote type="${calloutMatch[1]}">`);
      i++;
      while (i < lines.length && !lines[i].match(/^::\s*$/)) {
        out.push(lines[i]);
        i++;
      }
      out.push('</BlockQuote>');
      i++; // skip closing ::
      continue;
    }

    out.push(line);
    i++;
  }

  return out.join('\n');
}

// ============================================================================
// Section splitter
//
// Splits preprocessed markdown into sections keyed by heading level.
// Code fences are tracked to avoid treating # inside code as headings.
// ============================================================================

interface Section {
  level: number; // 1, 2, or 3
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
    if (currentHeading || body) {
      sections.push({ level: currentLevel, heading: currentHeading, body });
    }
    bodyLines = [];
  }

  for (const line of lines) {
    // Track code fences so headings inside code blocks are ignored
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

function buildChunks(sections: Section[], sourceFile: string, docTitle: string): Chunk[] {
  const chunks: Chunk[] = [];
  const version = extractVersion(sourceFile);
  let chunkIndex = 0;
  let currentH2 = '';

  function makeChunk(heading: string, body: string, breadcrumb: string): Chunk | null {
    const rawContent = body.trim();
    if (!rawContent || estimateTokens(rawContent) < CONFIG.MIN_CHUNK_TOKENS) return null;

    const fullContent = `Context: ${breadcrumb}\n\n${rawContent}`;
    const codeLanguages = extractCodeLanguages(rawContent);

    return {
      id: generateChunkId(sourceFile, chunkIndex++),
      content: fullContent,
      rawContent,
      breadcrumb,
      version,
      sourceFile,
      heading,
      hasCode: rawContent.includes('```'),
      codeLanguages,
      tokens: estimateTokens(fullContent),
      category: extractCategory(sourceFile, rawContent),
      tags: extractTags(rawContent),
    };
  }

  for (const section of sections) {
    // Level 1 — document title, used only for breadcrumbs
    if (section.level === 1) continue;

    if (section.level === 2) {
      currentH2 = section.heading;
      const breadcrumb = `${docTitle} > ${currentH2}`;

      if (estimateTokens(section.body) <= CONFIG.MAX_SECTION_TOKENS) {
        // Small enough — emit as a single chunk
        const chunk = makeChunk(section.heading, section.body, breadcrumb);
        if (chunk) chunks.push(chunk);
      } else {
        // Large section — emit the lead content (before first ###) as its own chunk.
        // The ### subsections will be emitted separately when we encounter level 3.
        const leadBody = section.body.split(/\n(?=### )/)[0].trim();
        if (leadBody && estimateTokens(leadBody) >= CONFIG.MIN_CHUNK_TOKENS) {
          const chunk = makeChunk(section.heading, leadBody, breadcrumb);
          if (chunk) chunks.push(chunk);
        }
      }
      continue;
    }

    if (section.level === 3) {
      const breadcrumb = currentH2
        ? `${docTitle} > ${currentH2} > ${section.heading}`
        : `${docTitle} > ${section.heading}`;

      const chunk = makeChunk(section.heading, section.body, breadcrumb);
      if (chunk) chunks.push(chunk);
      continue;
    }
  }

  // Link prev/next for contextual window retrieval
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) chunks[i].prevChunkId = chunks[i - 1].id;
    if (i < chunks.length - 1) chunks[i].nextChunkId = chunks[i + 1].id;
  }

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
      totalTokens: chunks.reduce((s, c) => s + c.tokens, 0),
    },
  };
}

function getAllMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];

  function walk(p: string) {
    for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
      const full = path.join(p, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) files.push(full);
    }
  }

  walk(dir);
  return files;
}

// ============================================================================
// Main
// ============================================================================

function main() {
  console.log('🚀 FeathersJS hierarchical chunker starting...\n');

  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  }

  const allChunks: { v5: Chunk[]; v6: Chunk[] } = { v5: [], v6: [] };
  const stats = {
    v5: { files: 0, chunks: 0, withCode: 0 },
    v6: { files: 0, chunks: 0, withCode: 0 },
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

        if (version === 'v5' || version === 'both') {
          allChunks.v5.push(...chunks);
          stats.v5.files++;
          stats.v5.chunks += chunks.length;
          stats.v5.withCode += chunks.filter((c) => c.hasCode).length;
        }
        if (version === 'v6' || version === 'both') {
          allChunks.v6.push(...chunks);
          stats.v6.files++;
          stats.v6.chunks += chunks.length;
          stats.v6.withCode += chunks.filter((c) => c.hasCode).length;
        }

        const codeCount = chunks.filter((c) => c.hasCode).length;
        console.log(
          `   ✓ ${path.basename(file)}: ${chunks.length} chunks (${codeCount} with code)`
        );
      } catch (err) {
        console.error(`   ✗ ${file}:`, err);
      }
    }
    console.log('');
  }

  // Write version-namespaced output
  console.log('💾 Writing output...\n');
  for (const version of ['v5', 'v6'] as const) {
    const outFile = path.join(CONFIG.OUTPUT_DIR, `${version}-chunks.json`);
    fs.writeFileSync(outFile, JSON.stringify(allChunks[version], null, 2));
    console.log(`   ✓ ${version}: ${allChunks[version].length} chunks → ${outFile}`);
  }

  fs.writeFileSync(
    path.join(CONFIG.OUTPUT_DIR, 'metadata.json'),
    JSON.stringify({ generated: new Date().toISOString(), config: CONFIG, stats }, null, 2)
  );

  console.log('\n' + '='.repeat(60));
  console.log('✨ Done!\n');
  console.log('📊 Summary:');
  for (const [v, s] of Object.entries(stats)) {
    if (s.files === 0) continue;
    console.log(`   ${v}: ${s.chunks} chunks from ${s.files} files (${s.withCode} contain code)`);
  }
  console.log('\n💡 Tips:');
  console.log('   • Embed using the `content` field — it includes the breadcrumb prefix');
  console.log('   • At retrieval time, use `rawContent` for the LLM context window');
  console.log('   • Use prevChunkId/nextChunkId to expand context when needed');
  console.log('   • Filter by `version` to avoid v5/v6 cross-contamination');
  console.log('='.repeat(60));
}

if (require.main === module) {
  main();
}

export { preprocess, splitIntoSections, buildChunks, processFile };
