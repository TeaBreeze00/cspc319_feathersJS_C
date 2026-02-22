#!/usr/bin/env ts-node

/**
 * Improved Chunking Strategy for FeathersJS Documentation
 *
 * This script implements better chunking based on semantic units rather than
 * header boundaries, following llms.txt conventions and best practices.
 *
 * Key improvements:
 * 1. Sliding window chunking (400 tokens with 50 token overlap)
 * 2. Hypothetical question generation for better retrieval
 * 3. Version-specific namespacing
 * 4. Contextual window storage (embed small, retrieve large)
 */

import * as fs from 'fs';
import * as path from 'path';
import { marked } from 'marked';

// ============================================================================
// Types
// ============================================================================

interface Chunk {
  id: string;
  content: string;
  version: 'v5' | 'v6' | 'both';
  sourceFile: string;
  startOffset: number;
  endOffset: number;
  tokens: number;

  // For contextual retrieval
  prevChunkId?: string;
  nextChunkId?: string;

  // Metadata
  category?: string;
  tags?: string[];

  // Hypothetical questions for better retrieval
  hypotheticalQuestions?: string[];
}

interface ProcessedDoc {
  chunks: Chunk[];
  metadata: {
    file: string;
    version: string;
    totalChunks: number;
    totalTokens: number;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Chunking parameters
  CHUNK_SIZE: 400, // tokens per chunk
  OVERLAP: 50, // token overlap between chunks
  MIN_CHUNK_SIZE: 100, // minimum viable chunk size

  // Paths
  INPUT_DIRS: ['knowledge-base/docs/v5', 'knowledge-base/docs/v6'],
  OUTPUT_DIR: 'knowledge-base/chunks',

  // Token estimation (rough approximation: 1 token ≈ 4 characters)
  CHARS_PER_TOKEN: 4,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Estimate token count from text
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CONFIG.CHARS_PER_TOKEN);
}

/**
 * Extract version from file path
 */
function extractVersion(filePath: string): 'v5' | 'v6' | 'both' {
  if (filePath.includes('/v5/')) return 'v5';
  if (filePath.includes('/v6/')) return 'v6';
  return 'both';
}

/**
 * Generate a unique chunk ID
 */
function generateChunkId(file: string, index: number): string {
  const basename = path.basename(file, path.extname(file));
  return `${basename}-chunk-${index}`;
}

/**
 * Extract category from file path or content
 */
function extractCategory(filePath: string, content: string): string {
  // Try to extract from path first with expanded categories
  const pathMatch = filePath.match(
    /\/(hooks|services|authentication|databases|schema|client|api|guides|cookbook|ecosystem)\//
  );
  if (pathMatch) return pathMatch[1];

  // Try to infer from content with more specific matching
  const lowerContent = content.toLowerCase();

  // Prioritized category detection
  if (
    lowerContent.includes('hook context') ||
    lowerContent.includes('before hook') ||
    lowerContent.includes('after hook')
  )
    return 'hooks';
  if (lowerContent.includes('service method') || lowerContent.includes('custom service'))
    return 'services';
  if (
    lowerContent.includes('jwt') ||
    lowerContent.includes('oauth') ||
    lowerContent.includes('local strategy')
  )
    return 'authentication';
  if (
    lowerContent.includes('typebox') ||
    lowerContent.includes('resolver') ||
    lowerContent.includes('schema validation')
  )
    return 'schema';
  if (
    lowerContent.includes('mongodb') ||
    lowerContent.includes('postgresql') ||
    lowerContent.includes('knex') ||
    lowerContent.includes('adapter')
  )
    return 'databases';
  if (lowerContent.includes('feathers client') || lowerContent.includes('rest client'))
    return 'client';
  if (
    lowerContent.includes('real-time') ||
    lowerContent.includes('channel') ||
    lowerContent.includes('publish')
  )
    return 'events';
  if (lowerContent.includes('migration') || lowerContent.includes('upgrade')) return 'migration';

  // Fallback to broader terms
  if (lowerContent.includes('hook')) return 'hooks';
  if (lowerContent.includes('service')) return 'services';
  if (lowerContent.includes('auth')) return 'authentication';
  if (lowerContent.includes('database')) return 'databases';

  return 'general';
}

/**
 * Extract tags from content
 */
function extractTags(content: string): string[] {
  const tags = new Set<string>();

  // Real FeathersJS concepts extracted from actual documentation
  const concepts = [
    // Core concepts
    'hooks',
    'services',
    'service methods',
    'context',
    'params',
    'provider',
    'application',
    'feathers client',
    'configuration',

    // Authentication & Authorization
    'authentication',
    'authorization',
    'jwt',
    'oauth',
    'local strategy',
    'jwtstrategy',
    'localstrategy',
    'oauthstrategy',
    'permissions',

    // Data & Schemas
    'schema',
    'resolver',
    'typebox',
    'validation',
    'validator',
    'query schema',
    'data schema',
    'result schema',
    'external resolver',
    'property resolver',

    // Databases & Adapters
    'database',
    'adapter',
    'mongodb',
    'postgresql',
    'sqlite',
    'knex',
    'core adapters',
    'community adapters',
    'pagination',
    'query helpers',
    'aggregation',
    'indexes',
    'associations',
    'populate',

    // Real-time & Events
    'real-time',
    'websockets',
    'channels',
    'events',
    'publish',
    'dispatch',
    'event emitters',
    'service events',
    'custom events',

    // Transport & API
    'rest',
    'http api',
    'api',
    'cors',
    'middleware',
    'custom service middleware',

    // Hook types
    'before hooks',
    'after hooks',
    'error hooks',
    'around hooks',
    'hook flow',
    'hook context',
    'hook functions',

    // Methods
    'find',
    'get',
    'create',
    'update',
    'patch',
    'remove',
    'custom methods',

    // Advanced
    'migrations',
    'filters',
    'search',
    'collation',
    'error handling',
    'content types',
    'dates',
    'objectids',
    'operators',
    'async iterators',
    'sse',
    'direct connection',
  ];

  const lowerContent = content.toLowerCase();
  concepts.forEach((concept) => {
    if (lowerContent.includes(concept)) {
      tags.add(concept);
    }
  });

  return Array.from(tags);
}

/**
 * Generate hypothetical questions for a chunk
 * This improves retrieval by embedding questions instead of statements
 */
function generateHypotheticalQuestions(content: string, category: string): string[] {
  const questions: string[] = [];
  const lowerContent = content.toLowerCase();

  // Extract code blocks as they're often the answer to "how to" questions
  const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
  const codeBlocks = [...content.matchAll(codeBlockRegex)];

  // Generate questions based on category and specific content
  if (category === 'hooks') {
    if (lowerContent.includes('before')) questions.push('How do I use before hooks in FeathersJS?');
    if (lowerContent.includes('after')) questions.push('How do I use after hooks in FeathersJS?');
    if (lowerContent.includes('around')) questions.push('How do around hooks work in FeathersJS?');
    if (lowerContent.includes('error'))
      questions.push('How do I handle errors in FeathersJS hooks?');
    if (lowerContent.includes('context')) questions.push('What is the hook context in FeathersJS?');
    if (lowerContent.includes('validate')) questions.push('How do I validate data in FeathersJS?');
    if (lowerContent.includes('register')) questions.push('How do I register hooks in FeathersJS?');
  }

  if (category === 'services') {
    questions.push('How do I create a service in FeathersJS?');
    if (lowerContent.includes('custom method'))
      questions.push('How do I add custom methods to a FeathersJS service?');
    if (lowerContent.includes('find'))
      questions.push('How does the find method work in FeathersJS?');
    if (lowerContent.includes('get'))
      questions.push('How do I retrieve a single record in FeathersJS?');
    if (lowerContent.includes('create')) questions.push('How do I create records in FeathersJS?');
    if (lowerContent.includes('patch')) questions.push('How do I update records in FeathersJS?');
    if (lowerContent.includes('remove')) questions.push('How do I delete records in FeathersJS?');
  }

  if (category === 'authentication') {
    questions.push('How do I set up authentication in FeathersJS?');
    if (lowerContent.includes('jwt'))
      questions.push('How do I use JWT authentication in FeathersJS?');
    if (lowerContent.includes('local'))
      questions.push('How do I set up local authentication in FeathersJS?');
    if (lowerContent.includes('oauth')) questions.push('How do I implement OAuth in FeathersJS?');
    if (lowerContent.includes('strategy'))
      questions.push('What are authentication strategies in FeathersJS?');
  }

  // Schema and resolvers
  if (lowerContent.includes('schema') || lowerContent.includes('resolver')) {
    questions.push('How do schemas work in FeathersJS?');
    if (lowerContent.includes('typebox')) questions.push('How do I use TypeBox with FeathersJS?');
    if (lowerContent.includes('resolver')) questions.push('What are resolvers in FeathersJS?');
    if (lowerContent.includes('validation'))
      questions.push('How do I validate data with schemas in FeathersJS?');
  }

  // Database related
  if (lowerContent.includes('database') || lowerContent.includes('adapter')) {
    if (lowerContent.includes('mongodb')) questions.push('How do I use MongoDB with FeathersJS?');
    if (lowerContent.includes('postgresql'))
      questions.push('How do I use PostgreSQL with FeathersJS?');
    if (lowerContent.includes('knex')) questions.push('How do I use Knex with FeathersJS?');
    if (lowerContent.includes('pagination'))
      questions.push('How does pagination work in FeathersJS?');
    if (lowerContent.includes('query')) questions.push('How do I query data in FeathersJS?');
  }

  // Real-time and events
  if (
    lowerContent.includes('real-time') ||
    lowerContent.includes('channel') ||
    lowerContent.includes('event')
  ) {
    questions.push('How does real-time work in FeathersJS?');
    if (lowerContent.includes('channel')) questions.push('What are channels in FeathersJS?');
    if (lowerContent.includes('publish')) questions.push('How do I publish events in FeathersJS?');
    if (lowerContent.includes('websocket')) questions.push('How do WebSockets work in FeathersJS?');
  }

  // Client usage
  if (lowerContent.includes('client')) {
    questions.push('How do I use the FeathersJS client?');
    if (lowerContent.includes('rest')) questions.push('How do I connect to a FeathersJS REST API?');
    if (lowerContent.includes('socket'))
      questions.push('How do I connect with Socket.io in FeathersJS?');
  }

  // Generic questions based on content patterns
  if (content.includes('example') || codeBlocks.length > 0) {
    questions.push(`How do I implement ${category} in FeathersJS?`);
    questions.push(`What is an example of ${category} in FeathersJS?`);
  }

  if (content.includes('error') || content.includes('problem')) {
    questions.push(`What are common issues with ${category} in FeathersJS?`);
    questions.push(`How do I troubleshoot ${category} in FeathersJS?`);
  }

  // Migration and upgrade questions
  if (lowerContent.includes('migration') || lowerContent.includes('upgrade')) {
    questions.push('How do I migrate to the latest FeathersJS version?');
    questions.push('What changed in this FeathersJS version?');
  }

  // Fallback generic question
  if (questions.length === 0) {
    questions.push(`What is ${category} in FeathersJS?`);
    questions.push(`How does ${category} work in FeathersJS?`);
  }

  return questions;
}

// ============================================================================
// Chunking Strategy
// ============================================================================

/**
 * Split text into chunks using sliding window approach
 *
 * This ignores header boundaries and creates overlapping chunks
 * that are more likely to contain complete semantic units.
 */
function slidingWindowChunk(text: string, sourceFile: string): Chunk[] {
  const chunks: Chunk[] = [];
  const version = extractVersion(sourceFile);

  // Split into sentences to avoid breaking mid-sentence
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  let currentChunk = '';
  let currentTokens = 0;
  let chunkStartOffset = 0;
  let chunkIndex = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceTokens = estimateTokens(sentence);

    // Check if adding this sentence would exceed chunk size
    if (currentTokens + sentenceTokens > CONFIG.CHUNK_SIZE && currentChunk.length > 0) {
      // Save current chunk if it's large enough
      if (currentTokens >= CONFIG.MIN_CHUNK_SIZE) {
        const chunkId = generateChunkId(sourceFile, chunkIndex);
        const category = extractCategory(sourceFile, currentChunk);

        chunks.push({
          id: chunkId,
          content: currentChunk.trim(),
          version,
          sourceFile,
          startOffset: chunkStartOffset,
          endOffset: chunkStartOffset + currentChunk.length,
          tokens: currentTokens,
          category,
          tags: extractTags(currentChunk),
          hypotheticalQuestions: generateHypotheticalQuestions(currentChunk, category),
          prevChunkId: chunkIndex > 0 ? generateChunkId(sourceFile, chunkIndex - 1) : undefined,
        });

        chunkIndex++;
      }

      // Create overlap by keeping last N tokens
      const overlapSentences: string[] = [];
      let overlapTokens = 0;

      // Work backwards to build overlap
      for (let j = i - 1; j >= 0 && overlapTokens < CONFIG.OVERLAP; j--) {
        const prevSentence = sentences[j];
        const prevTokens = estimateTokens(prevSentence);

        if (overlapTokens + prevTokens <= CONFIG.OVERLAP) {
          overlapSentences.unshift(prevSentence);
          overlapTokens += prevTokens;
        } else {
          break;
        }
      }

      currentChunk = overlapSentences.join('');
      currentTokens = overlapTokens;
      chunkStartOffset += currentChunk.length;
    }

    // Add current sentence
    currentChunk += sentence;
    currentTokens += sentenceTokens;
  }

  // Save final chunk
  if (currentTokens >= CONFIG.MIN_CHUNK_SIZE) {
    const chunkId = generateChunkId(sourceFile, chunkIndex);
    const category = extractCategory(sourceFile, currentChunk);

    chunks.push({
      id: chunkId,
      content: currentChunk.trim(),
      version,
      sourceFile,
      startOffset: chunkStartOffset,
      endOffset: chunkStartOffset + currentChunk.length,
      tokens: currentTokens,
      category,
      tags: extractTags(currentChunk),
      hypotheticalQuestions: generateHypotheticalQuestions(currentChunk, category),
      prevChunkId: chunkIndex > 0 ? generateChunkId(sourceFile, chunkIndex - 1) : undefined,
    });
  }

  // Set nextChunkId references
  for (let i = 0; i < chunks.length - 1; i++) {
    chunks[i].nextChunkId = chunks[i + 1].id;
  }

  return chunks;
}

/**
 * Process a markdown file into chunks
 */
function processMarkdownFile(filePath: string): ProcessedDoc {
  const content = fs.readFileSync(filePath, 'utf-8');
  const chunks = slidingWindowChunk(content, filePath);

  const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);

  return {
    chunks,
    metadata: {
      file: filePath,
      version: extractVersion(filePath),
      totalChunks: chunks.length,
      totalTokens,
    },
  };
}

// ============================================================================
// Main Processing
// ============================================================================

function getAllMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];

  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function main() {
  console.log('🚀 Starting improved chunking process...\n');

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  }

  // Process each version separately for namespace isolation
  const allProcessedDocs: ProcessedDoc[] = [];
  const versionStats: Record<string, { chunks: number; tokens: number; files: number }> = {
    v5: { chunks: 0, tokens: 0, files: 0 },
    v6: { chunks: 0, tokens: 0, files: 0 },
  };

  for (const inputDir of CONFIG.INPUT_DIRS) {
    console.log(`📂 Processing directory: ${inputDir}`);

    const markdownFiles = getAllMarkdownFiles(inputDir);
    console.log(`   Found ${markdownFiles.length} markdown files`);

    for (const file of markdownFiles) {
      try {
        const processed = processMarkdownFile(file);
        allProcessedDocs.push(processed);

        const version = processed.metadata.version;
        versionStats[version].chunks += processed.chunks.length;
        versionStats[version].tokens += processed.metadata.totalTokens;
        versionStats[version].files += 1;

        console.log(`   ✓ ${path.basename(file)}: ${processed.chunks.length} chunks`);
      } catch (error) {
        console.error(`   ✗ Error processing ${file}:`, error);
      }
    }

    console.log('');
  }

  // Save chunks by version (namespace isolation)
  console.log('💾 Saving chunks...\n');

  for (const version of ['v5', 'v6']) {
    const versionChunks = allProcessedDocs
      .filter((doc) => doc.metadata.version === version)
      .flatMap((doc) => doc.chunks);

    const outputFile = path.join(CONFIG.OUTPUT_DIR, `${version}-chunks.json`);
    fs.writeFileSync(outputFile, JSON.stringify(versionChunks, null, 2));

    console.log(`   ✓ Saved ${versionChunks.length} ${version} chunks to ${outputFile}`);
  }

  // Save metadata
  const metadata = {
    generated: new Date().toISOString(),
    config: CONFIG,
    stats: {
      totalFiles: allProcessedDocs.length,
      totalChunks: allProcessedDocs.reduce((sum, doc) => sum + doc.chunks.length, 0),
      totalTokens: allProcessedDocs.reduce((sum, doc) => sum + doc.metadata.totalTokens, 0),
      byVersion: versionStats,
    },
  };

  const metadataFile = path.join(CONFIG.OUTPUT_DIR, 'metadata.json');
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('✨ Chunking complete!\n');
  console.log(`📊 Statistics:`);
  console.log(`   Total files processed: ${metadata.stats.totalFiles}`);
  console.log(`   Total chunks created: ${metadata.stats.totalChunks}`);
  console.log(`   Total tokens: ${metadata.stats.totalTokens.toLocaleString()}`);
  console.log('');
  console.log(`   v5: ${versionStats.v5.chunks} chunks from ${versionStats.v5.files} files`);
  console.log(`   v6: ${versionStats.v6.chunks} chunks from ${versionStats.v6.files} files`);
  console.log('');
  console.log(`💡 Next steps:`);
  console.log(`   1. Run embedding generation on the new chunks`);
  console.log(`   2. Update vector search to use version-specific indexes`);
  console.log(`   3. Implement contextual window retrieval (return prev + current + next)`);
  console.log('='.repeat(80));
}

// ============================================================================
// Execute
// ============================================================================

if (require.main === module) {
  main();
}

export { slidingWindowChunk, generateHypotheticalQuestions, processMarkdownFile };
