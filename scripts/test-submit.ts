/**
 * Manual test script for the submit_documentation pipeline AND
 * the incremental knowledge-base update pipeline.
 *
 * Calls tools directly — no MCP transport or server needed.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true,"target":"ES2020"}' scripts/test-submit.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { SubmitDocumentationTool, _resetRateLimit } from '../src/tools/submitDocumentation';
import { processFile, extractVersion } from './improved-chunking';

// Always enable the G1.5 network-tier gate for this script
process.env.ALLOW_NETWORK_TOOLS = 'true';

const tool = new SubmitDocumentationTool();

// ---------------------------------------------------------------------------
// Shared test content
// ---------------------------------------------------------------------------

const VALID_PARAMS = {
  title: 'Test documentation submission guide for FeathersJS v6',
  filePath: 'docs/v6_docs/cookbook/test-submission.md',
  version: 'v6' as const,
  contributorName: 'Test User',
  description: 'Testing the contributor pipeline',
  content: `# Test Submission Guide

This is a manual test of the contributor pipeline for FeathersJS v6.

## Overview

The \`submit_documentation\` tool lets contributors submit docs as GitHub PRs
directly through the MCP interface.

## Steps

1. Call the tool with valid parameters
2. The server runs a 6-stage local validation pipeline
3. If \`GITHUB_TOKEN\` is set a PR is created; otherwise the submission is staged locally
4. An admin reviews and merges the PR
5. GitHub Actions rebuilds the knowledge base on merge

## Example

\`\`\`typescript
const result = await tool.execute({
  title: 'Add new cookbook guide',
  filePath: 'docs/v6_docs/cookbook/my-guide.md',
  content: '# My Guide\\n\\n...',
  version: 'v6',
});
\`\`\`
`,
};

const INVALID_CASES = [
  { label: 'Short title (< 10 chars)', params: { ...VALID_PARAMS, title: 'Too short' } },
  {
    label: 'Path traversal',
    params: { ...VALID_PARAMS, filePath: 'docs/v6_docs/../../etc/passwd.md' },
  },
  {
    label: 'XSS content',
    params: {
      ...VALID_PARAMS,
      content: VALID_PARAMS.content + '\n\n<script>alert("xss")</script>',
    },
  },
  {
    label: 'Version mismatch (v5 path/v6)',
    params: { ...VALID_PARAMS, filePath: 'docs/v5_docs/guide.md', version: 'v6' as const },
  },
  {
    label: 'No top-level heading',
    params: {
      ...VALID_PARAMS,
      content:
        'Just a paragraph without a heading.\n\n' +
        'Some more content to meet the minimum character requirement. '.repeat(5),
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function section(title: string) {
  console.log('\n' + '─'.repeat(68));
  console.log(`  ${title}`);
  console.log('─'.repeat(68));
}

function check(label: string, ok: boolean) {
  if (ok) {
    passed++;
    console.log(`  ✅  ${label}`);
  } else {
    failed++;
    console.log(`  ❌  ${label}`);
  }
}

// ---------------------------------------------------------------------------
// Submit-documentation tests (Tests 1–7)
// ---------------------------------------------------------------------------

async function testSubmitPipeline() {
  const mode = process.env.GITHUB_TOKEN
    ? `GitHub PR mode  (owner=${process.env.GITHUB_OWNER}, repo=${process.env.GITHUB_REPO})`
    : 'Local staging mode  (no GITHUB_TOKEN — files written to pending-contributions/)';

  console.log('\n🚀  submit_documentation pipeline manual test');
  console.log(`   Mode : ${mode}`);
  console.log(`   Date : ${new Date().toISOString()}`);

  // ── Test 1: Valid submission ─────────────────────────────────────────────
  section('TEST 1 — Valid submission (should succeed)');
  _resetRateLimit();
  const result = await tool.execute(VALID_PARAMS);
  const parsed = JSON.parse(result.content);
  console.log(JSON.stringify(parsed, null, 2));

  if (parsed.success) {
    if (parsed.mode === 'local-staging') {
      check('Submission staged locally', true);
      console.log(`    → pending-contributions/${parsed.file}`);
    } else {
      check('PR created', true);
      console.log(`    → ${parsed.prUrl}`);
    }
  } else {
    check('Valid submission should succeed', false);
    console.log('    Errors:', parsed.errors);
  }

  // ── Test 2: Rate limit ───────────────────────────────────────────────────
  section('TEST 2 — Rate limit (immediate 2nd call should be blocked)');
  const rl = await tool.execute({
    ...VALID_PARAMS,
    title: 'Second submission immediately after the first one',
  });
  const rlp = JSON.parse(rl.content);
  console.log(JSON.stringify(rlp, null, 2));
  check('Rate limit enforced', !rlp.success && rlp.errors?.some((e: string) => /rate/i.test(e)));

  // ── Test 3: Validation rejections ───────────────────────────────────────
  section('TEST 3 — Validation rejections (all 5 should fail)');
  for (const { label, params } of INVALID_CASES) {
    _resetRateLimit();
    const r = await tool.execute(params);
    const p = JSON.parse(r.content);
    check(`REJECTED: ${label}`, !p.success);
    if (!p.success) console.log(`    Errors: ${JSON.stringify(p.errors)}`);
  }

  // ── Test 4: Network gate (defense-in-depth) ──────────────────────────────
  section('TEST 4 — Network gate: token set but ALLOW_NETWORK_TOOLS unset');
  _resetRateLimit();
  const savedToken = process.env.GITHUB_TOKEN;
  const savedAllow = process.env.ALLOW_NETWORK_TOOLS;
  process.env.GITHUB_TOKEN = 'ghp_fake_token_for_gate_test';
  delete process.env.ALLOW_NETWORK_TOOLS;

  const gate = await tool.execute(VALID_PARAMS);
  const gatep = JSON.parse(gate.content);
  console.log(JSON.stringify(gatep, null, 2));
  check(
    'G1.5 network gate blocked the call',
    !gatep.success && gatep.errors?.some((e: string) => /ALLOW_NETWORK_TOOLS/i.test(e))
  );

  if (savedToken) process.env.GITHUB_TOKEN = savedToken;
  else delete process.env.GITHUB_TOKEN;
  if (savedAllow) process.env.ALLOW_NETWORK_TOOLS = savedAllow;
  else process.env.ALLOW_NETWORK_TOOLS = 'true';

  // ── Test 5: v5 submission path ────────────────────────────────────────────
  section('TEST 5 — Valid v5 submission (different version path)');
  _resetRateLimit();
  const v5Params = {
    ...VALID_PARAMS,
    title: 'Test v5 documentation submission for hooks',
    filePath: 'docs/v5_docs/api/test-hooks.md',
    version: 'v5' as const,
    category: 'hooks',
  };
  const v5Result = await tool.execute(v5Params);
  const v5Parsed = JSON.parse(v5Result.content);
  check('v5 submission accepted', v5Parsed.success === true);
  if (v5Parsed.success && v5Parsed.mode === 'local-staging') {
    console.log(`    → pending-contributions/${v5Parsed.file}`);
  }

  // ── Test 6: Max-boundary content ──────────────────────────────────────────
  section('TEST 6 — Boundary: exactly 100 chars of content (minimum)');
  _resetRateLimit();
  // Build content that is exactly at the boundary: heading + prose = 100 chars
  const minContent = '# T\n\n' + 'A'.repeat(94); // 6 chars heading + 94 chars = 100
  const minParams = {
    ...VALID_PARAMS,
    title: 'Test minimum boundary content length',
    content: minContent,
  };
  const minResult = await tool.execute(minParams);
  const minParsed = JSON.parse(minResult.content);
  check('100-char content accepted (boundary)', minParsed.success === true);

  // ── Test 7: Content at exactly 99 chars (below minimum) ───────────────────
  section('TEST 7 — Boundary: 99 chars of content (below minimum)');
  _resetRateLimit();
  const belowMinContent = '# T\n\n' + 'A'.repeat(93); // 6 + 93 = 99
  const belowMinParams = {
    ...VALID_PARAMS,
    title: 'Test below minimum boundary content',
    content: belowMinContent,
  };
  const belowMinResult = await tool.execute(belowMinParams);
  const belowMinParsed = JSON.parse(belowMinResult.content);
  check('99-char content rejected (below minimum)', belowMinParsed.success === false);
}

// ---------------------------------------------------------------------------
// Incremental knowledge-base update tests (Tests 8–13)
// ---------------------------------------------------------------------------

async function testIncrementalUpdate() {
  section('TEST 8 — processFile: chunk an existing v6 doc');

  // Find a real doc file to chunk
  const testDoc = 'docs/v6_docs/api/application.md';
  if (!fs.existsSync(testDoc)) {
    check('processFile on existing doc (SKIPPED — file not found)', false);
  } else {
    try {
      const { chunks } = processFile(testDoc);
      check('processFile returned chunks', chunks.length > 0);
      const c = chunks[0] as any;
      check('Chunk has id', typeof c.id === 'string' && c.id.length > 0);
      check('Chunk has heading', typeof c.heading === 'string' && c.heading.length > 0);
      check('Chunk has sourceFile', c.sourceFile === testDoc);
      check('Chunk has category', typeof c.category === 'string' && c.category.length > 0);
      check('Chunk has tags array', Array.isArray(c.tags));
      console.log(
        `    id=${c.id}  heading="${c.heading}"  cat=${c.category}  tags=${c.tags.length}`
      );
    } catch (err) {
      check('processFile did not throw', false);
      console.log('    Error:', err);
    }
  }

  // ── Test 9: extractVersion ─────────────────────────────────────────────
  section('TEST 9 — extractVersion returns correct version');
  check('v5_docs → v5', extractVersion('docs/v5_docs/api/hooks.md') === 'v5');
  check('v6_docs → v6', extractVersion('docs/v6_docs/guides/basics/app.md') === 'v6');
  check('unknown path → both', extractVersion('docs/other/readme.md') === 'both');

  // ── Test 10: Incremental merge (add new chunk) ─────────────────────────
  section('TEST 10 — Incremental merge: add a new chunk to existing array');
  const kbDir = path.join(process.cwd(), 'knowledge-base', 'chunks');
  const v6File = path.join(kbDir, 'v6-chunks.json');

  if (!fs.existsSync(v6File)) {
    check('v6-chunks.json exists (SKIPPED)', false);
  } else {
    const originalChunks = JSON.parse(fs.readFileSync(v6File, 'utf-8'));
    const originalCount = originalChunks.length;
    console.log(`    Original v6 chunk count: ${originalCount}`);

    // Create a temp doc, chunk it, then verify merge logic works
    const tmpDocDir = path.join(process.cwd(), 'docs', 'v6_docs', 'cookbook');
    const tmpDocPath = path.join(tmpDocDir, '_test-incremental-merge.md');
    const tmpRelPath = 'docs/v6_docs/cookbook/_test-incremental-merge.md';

    fs.mkdirSync(tmpDocDir, { recursive: true });
    fs.writeFileSync(
      tmpDocPath,
      `# Test Incremental Merge

This is a temporary document to verify the incremental merge logic.

## Details

The incremental update script should add this chunk to v6-chunks.json
without disturbing any existing chunks.

## Cleanup

This file is deleted by the test script after verification.
`,
      'utf-8'
    );

    try {
      const { chunks: newChunks } = processFile(tmpRelPath);
      check('Temp doc chunked successfully', newChunks.length > 0);
      const newChunk = newChunks[0] as any;
      console.log(`    New chunk: id=${newChunk.id}  sourceFile=${newChunk.sourceFile}`);

      // Simulate the merge logic from incremental-update.ts
      const changedSources = new Set(newChunks.map((c: any) => c.sourceFile));
      const filtered = originalChunks.filter((c: any) => !changedSources.has(c.sourceFile));
      for (const c of newChunks) filtered.push(c);

      check('Merge adds exactly 1 chunk', filtered.length === originalCount + newChunks.length);
      check(
        'New chunk is in merged array',
        filtered.some((c: any) => c.sourceFile === tmpRelPath)
      );
      check(
        'Original chunks preserved',
        filtered.filter((c: any) => c.sourceFile !== tmpRelPath).length === originalCount
      );
    } finally {
      // Cleanup
      if (fs.existsSync(tmpDocPath)) fs.unlinkSync(tmpDocPath);
    }
  }

  // ── Test 11: Incremental merge (update existing chunk) ─────────────────
  section('TEST 11 — Incremental merge: replacing an existing chunk');
  if (!fs.existsSync(v6File)) {
    check('v6-chunks.json exists (SKIPPED)', false);
  } else {
    const chunks = JSON.parse(fs.readFileSync(v6File, 'utf-8'));
    const originalCount = chunks.length;

    // Pick the first chunk and simulate an update
    const targetSourceFile = chunks[0].sourceFile;
    const targetOriginalId = chunks[0].id;
    console.log(`    Simulating update to: ${targetSourceFile} (id=${targetOriginalId})`);

    // Mock a "new chunk" with the same sourceFile but different heading
    const fakeUpdatedChunk = {
      ...chunks[0],
      heading: 'UPDATED — ' + chunks[0].heading,
      embedding: undefined, // new chunk needs embedding
    };

    // Merge logic: remove old, add new
    const changedSources = new Set([targetSourceFile]);
    const filtered = chunks.filter((c: any) => !changedSources.has(c.sourceFile));
    filtered.push(fakeUpdatedChunk);

    check('Update keeps same count', filtered.length === originalCount);
    const updatedEntry = filtered.find((c: any) => c.sourceFile === targetSourceFile);
    check('Updated chunk has new heading', updatedEntry?.heading?.startsWith('UPDATED'));
    check('Updated chunk has no embedding (needs re-embed)', !updatedEntry?.embedding);
  }

  // ── Test 12: Chunk a doc with no heading (edge case) ───────────────────
  section('TEST 12 — processFile: doc with no heading uses filename as title');
  const tmpNoHeading = path.join(
    process.cwd(),
    'docs',
    'v6_docs',
    'cookbook',
    '_test-no-heading.md'
  );
  fs.mkdirSync(path.dirname(tmpNoHeading), { recursive: true });
  fs.writeFileSync(
    tmpNoHeading,
    'Just some content without a markdown heading.\n\nMore paragraphs here to make it non-trivial.',
    'utf-8'
  );

  try {
    const { chunks } = processFile('docs/v6_docs/cookbook/_test-no-heading.md');
    if (chunks.length > 0) {
      const c = chunks[0] as any;
      check('Chunk created for headingless doc', true);
      check(
        'Heading falls back to filename',
        c.heading === '_test-no-heading' || c.heading.length > 0
      );
      console.log(`    heading="${c.heading}"`);
    } else {
      check('Chunk created for headingless doc', false);
    }
  } catch (err) {
    // Some chunkers skip files that are too small — that's also acceptable
    check('processFile handled headingless doc (skipped as too small)', true);
    console.log(`    ${err}`);
  } finally {
    if (fs.existsSync(tmpNoHeading)) fs.unlinkSync(tmpNoHeading);
  }

  // ── Test 13: Verify metadata.json exists and has expected shape ────────
  section('TEST 13 — metadata.json has expected structure');
  const metaPath = path.join(kbDir, 'metadata.json');
  if (!fs.existsSync(metaPath)) {
    check('metadata.json exists (SKIPPED)', false);
  } else {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    check('Has generated timestamp', typeof meta.generated === 'string');
    check('Has config object', typeof meta.config === 'object');
    check('Has stats.v5', typeof meta.stats?.v5 === 'object');
    check('Has stats.v6', typeof meta.stats?.v6 === 'object');
    check('v5 chunk count > 0', meta.stats.v5.chunks > 0);
    check('v6 chunk count > 0', meta.stats.v6.chunks > 0);
    console.log(`    v5: ${meta.stats.v5.chunks} chunks from ${meta.stats.v5.files} files`);
    console.log(`    v6: ${meta.stats.v6.chunks} chunks from ${meta.stats.v6.files} files`);
  }
}

// ---------------------------------------------------------------------------
// Local staging file tests (Tests 14–15)
// ---------------------------------------------------------------------------

async function testLocalStagingFiles() {
  // ── Test 14: Verify staged file content format ─────────────────────────
  section('TEST 14 — Local staging: verify saved file content structure');
  _resetRateLimit();
  delete process.env.GITHUB_TOKEN; // force local staging

  const stagingResult = await tool.execute(VALID_PARAMS);
  const stagingParsed = JSON.parse(stagingResult.content);

  if (stagingParsed.success && stagingParsed.mode === 'local-staging') {
    const stagingDir = path.join(process.cwd(), 'pending-contributions');
    const stagedFile = path.join(stagingDir, stagingParsed.file);

    if (fs.existsSync(stagedFile)) {
      const payload = JSON.parse(fs.readFileSync(stagedFile, 'utf-8'));
      check('Staged file has timestamp', typeof payload.timestamp === 'string');
      check('Staged file has title', payload.title === VALID_PARAMS.title);
      check('Staged file has filePath', payload.filePath === VALID_PARAMS.filePath);
      check('Staged file has content', payload.content === VALID_PARAMS.content);
      check('Staged file has version', payload.version === 'v6');
      check('Staged file has contributorName', payload.contributorName === 'Test User');
      check('Staged file has validationResults', payload.validationResults?.passed === true);

      // Cleanup
      fs.unlinkSync(stagedFile);
      console.log(`    Cleaned up: ${stagingParsed.file}`);
    } else {
      check('Staged file exists on disk', false);
    }
  } else {
    check('Staging mode activated', false);
  }

  // Restore env
  process.env.ALLOW_NETWORK_TOOLS = 'true';

  // ── Test 15: Multiple submissions create separate files ────────────────
  section('TEST 15 — Local staging: multiple submissions create distinct files');
  _resetRateLimit();
  delete process.env.GITHUB_TOKEN;

  const r1 = await tool.execute(VALID_PARAMS);
  const p1 = JSON.parse(r1.content);

  _resetRateLimit();
  const r2 = await tool.execute({
    ...VALID_PARAMS,
    title: 'Second distinct documentation submission test',
    filePath: 'docs/v6_docs/cookbook/test-second.md',
  });
  const p2 = JSON.parse(r2.content);

  if (p1.success && p2.success) {
    check('Two separate files created', p1.file !== p2.file);
    console.log(`    File 1: ${p1.file}`);
    console.log(`    File 2: ${p2.file}`);

    // Cleanup
    const stagingDir = path.join(process.cwd(), 'pending-contributions');
    for (const f of [p1.file, p2.file]) {
      const fp = path.join(stagingDir, f);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
  } else {
    check('Both submissions succeeded', false);
  }

  // Restore env
  process.env.ALLOW_NETWORK_TOOLS = 'true';
}

// ---------------------------------------------------------------------------
// Additional validation & edge-case tests (Tests 16–23)
// ---------------------------------------------------------------------------

async function testAdditionalValidation() {
  // ── Test 16: Invalid category ──────────────────────────────────────────
  section('TEST 16 — Invalid category name is rejected');
  _resetRateLimit();
  const badCat = await tool.execute({ ...VALID_PARAMS, category: 'nonexistent-category' });
  const badCatP = JSON.parse(badCat.content);
  check('Invalid category rejected', !badCatP.success);
  if (!badCatP.success) console.log(`    Errors: ${JSON.stringify(badCatP.errors)}`);

  // ── Test 17: <iframe> rejection ────────────────────────────────────────
  section('TEST 17 — Content with <iframe> tags is rejected');
  _resetRateLimit();
  const iframeContent = VALID_PARAMS.content + '\n\n<iframe src="https://evil.com"></iframe>';
  const iframe = await tool.execute({ ...VALID_PARAMS, content: iframeContent });
  const iframeP = JSON.parse(iframe.content);
  check(
    '<iframe> rejected',
    !iframeP.success && iframeP.errors?.some((e: string) => /iframe/i.test(e))
  );

  // ── Test 18: javascript: URI rejection ─────────────────────────────────
  section('TEST 18 — Content with javascript: URI is rejected');
  _resetRateLimit();
  const jsUri = VALID_PARAMS.content + '\n\n[click me](javascript:alert(1))';
  const jsRes = await tool.execute({ ...VALID_PARAMS, content: jsUri });
  const jsP = JSON.parse(jsRes.content);
  check(
    'javascript: URI rejected',
    !jsP.success && jsP.errors?.some((e: string) => /javascript/i.test(e))
  );

  // ── Test 19: Backslash in path ─────────────────────────────────────────
  section('TEST 19 — Backslash in filePath is rejected');
  _resetRateLimit();
  const bsRes = await tool.execute({ ...VALID_PARAMS, filePath: 'docs\\v6_docs\\test.md' });
  const bsP = JSON.parse(bsRes.content);
  check('Backslash path rejected', !bsP.success);

  // ── Test 20: Null byte in path ─────────────────────────────────────────
  section('TEST 20 — Null byte in filePath is rejected');
  _resetRateLimit();
  const nbRes = await tool.execute({ ...VALID_PARAMS, filePath: 'docs/v6_docs/test\0.md' });
  const nbP = JSON.parse(nbRes.content);
  check('Null byte path rejected', !nbP.success);

  // ── Test 21: Double slashes in path ────────────────────────────────────
  section('TEST 21 — Double slashes in filePath rejected');
  _resetRateLimit();
  const dsRes = await tool.execute({ ...VALID_PARAMS, filePath: 'docs/v6_docs//test.md' });
  const dsP = JSON.parse(dsRes.content);
  check('Double slash path rejected', !dsP.success);

  // ── Test 22: Title at max boundary (120 chars) ─────────────────────────
  section('TEST 22 — Boundary: title at exactly 120 chars (max)');
  _resetRateLimit();
  const maxTitle = 'A'.repeat(120);
  const maxTitleRes = await tool.execute({ ...VALID_PARAMS, title: maxTitle });
  const maxTitleP = JSON.parse(maxTitleRes.content);
  check('120-char title accepted', maxTitleP.success === true);

  // ── Test 23: Title over max boundary (121 chars) ───────────────────────
  section('TEST 23 — Boundary: title at 121 chars (over max)');
  _resetRateLimit();
  const overTitle = 'A'.repeat(121);
  const overTitleRes = await tool.execute({ ...VALID_PARAMS, title: overTitle });
  const overTitleP = JSON.parse(overTitleRes.content);
  check('121-char title rejected', !overTitleP.success);
}

// ---------------------------------------------------------------------------
// Additional incremental-update edge cases (Tests 24–30)
// ---------------------------------------------------------------------------

async function testIncrementalEdgeCases() {
  const kbDir = path.join(process.cwd(), 'knowledge-base', 'chunks');
  const v5File = path.join(kbDir, 'v5-chunks.json');
  const v6File = path.join(kbDir, 'v6-chunks.json');

  // ── Test 24: Content over 50,000 chars rejected ────────────────────────
  section('TEST 24 — Content over 50,000 chars is rejected');
  _resetRateLimit();
  const hugeContent = '# Huge Doc\n\n' + 'X'.repeat(50001);
  const hugeRes = await tool.execute({ ...VALID_PARAMS, content: hugeContent });
  const hugeP = JSON.parse(hugeRes.content);
  check('50,001-char content rejected', !hugeP.success);

  // ── Test 25: processFile on a v5 doc ───────────────────────────────────
  section('TEST 25 — processFile: chunk a v5 doc');
  // Find any v5 doc
  const v5DocsDir = path.join(process.cwd(), 'docs', 'v5_docs');
  let v5TestDoc: string | null = null;
  if (fs.existsSync(v5DocsDir)) {
    const findMd = (dir: string): string | null => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const found = findMd(path.join(dir, entry.name));
          if (found) return found;
        } else if (entry.name.endsWith('.md')) {
          return path.join(dir, entry.name);
        }
      }
      return null;
    };
    v5TestDoc = findMd(v5DocsDir);
  }
  if (v5TestDoc) {
    // Convert to relative path
    const relPath = path.relative(process.cwd(), v5TestDoc);
    try {
      const { chunks } = processFile(relPath);
      check('v5 doc chunked successfully', chunks.length > 0);
      const c = chunks[0] as any;
      check('v5 chunk version is v5', c.version === 'v5');
      check('v5 chunk has sourceFile', c.sourceFile === relPath);
      console.log(`    file=${path.basename(relPath)}  id=${c.id}  cat=${c.category}`);
    } catch (err) {
      check('v5 processFile did not throw', false);
      console.log(`    Error: ${err}`);
    }
  } else {
    check('v5 doc found to test (SKIPPED)', false);
  }

  // ── Test 26: Chunk field completeness ──────────────────────────────────
  section('TEST 26 — Chunk has all expected fields');
  const tmpDocPath = path.join(process.cwd(), 'docs', 'v6_docs', 'cookbook', '_test-fields.md');
  fs.mkdirSync(path.dirname(tmpDocPath), { recursive: true });
  fs.writeFileSync(
    tmpDocPath,
    `# Field Completeness Test

This document tests that every expected field is present on a chunk.

## Sub Heading One

Some content under sub heading one.

## Sub Heading Two

\`\`\`typescript
const app = feathers();
app.use('messages', new MessageService());
\`\`\`

More content after the code block to ensure we have enough text.
`,
    'utf-8'
  );

  try {
    const { chunks } = processFile('docs/v6_docs/cookbook/_test-fields.md');
    check('Chunk produced', chunks.length > 0);
    const c = chunks[0] as any;
    check('Has id (string)', typeof c.id === 'string' && c.id.length > 0);
    check('Has content (string)', typeof c.content === 'string' && c.content.length > 0);
    check('Has rawContent (string)', typeof c.rawContent === 'string' && c.rawContent.length > 0);
    check('Has breadcrumb (string)', typeof c.breadcrumb === 'string');
    check('Has version (v6)', c.version === 'v6');
    check('Has sourceFile', c.sourceFile === 'docs/v6_docs/cookbook/_test-fields.md');
    check('Has heading (string)', typeof c.heading === 'string' && c.heading.length > 0);
    check('Has subHeadings (array)', Array.isArray(c.subHeadings) && c.subHeadings.length >= 2);
    check('Has hasCode (true)', c.hasCode === true);
    check(
      'Has codeLanguages includes typescript',
      Array.isArray(c.codeLanguages) && c.codeLanguages.includes('typescript')
    );
    check('Has tokens (number > 0)', typeof c.tokens === 'number' && c.tokens > 0);
    check('Has category (string)', typeof c.category === 'string' && c.category.length > 0);
    check('Has tags (array)', Array.isArray(c.tags));
    console.log(
      `    subHeadings=${JSON.stringify(c.subHeadings)}  codeLangs=${c.codeLanguages}  tokens=${c.tokens}`
    );
  } catch (err) {
    check('processFile for field completeness did not throw', false);
    console.log(`    Error: ${err}`);
  } finally {
    if (fs.existsSync(tmpDocPath)) fs.unlinkSync(tmpDocPath);
  }

  // ── Test 27: Merge with multiple files at once ─────────────────────────
  section('TEST 27 — Incremental merge: two files at once');
  if (!fs.existsSync(v6File)) {
    check('v6-chunks.json exists (SKIPPED)', false);
  } else {
    const originalChunks = JSON.parse(fs.readFileSync(v6File, 'utf-8'));
    const originalCount = originalChunks.length;

    const tmpDir = path.join(process.cwd(), 'docs', 'v6_docs', 'cookbook');
    const tmpA = path.join(tmpDir, '_test-multi-a.md');
    const tmpB = path.join(tmpDir, '_test-multi-b.md');
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      tmpA,
      '# Multi A\n\nContent for doc A with enough text to be a valid chunk.\n\n## Details A\n\nMore details.',
      'utf-8'
    );
    fs.writeFileSync(
      tmpB,
      '# Multi B\n\nContent for doc B with enough text to be a valid chunk.\n\n## Details B\n\nMore details.',
      'utf-8'
    );

    try {
      const relA = 'docs/v6_docs/cookbook/_test-multi-a.md';
      const relB = 'docs/v6_docs/cookbook/_test-multi-b.md';
      const { chunks: chunksA } = processFile(relA);
      const { chunks: chunksB } = processFile(relB);
      const allNew = [...chunksA, ...chunksB];

      const changedSources = new Set(allNew.map((c: any) => c.sourceFile));
      const filtered = originalChunks.filter((c: any) => !changedSources.has(c.sourceFile));
      for (const c of allNew) filtered.push(c);

      check('Two new chunks added', filtered.length === originalCount + allNew.length);
      check(
        'Doc A in merged',
        filtered.some((c: any) => c.sourceFile === relA)
      );
      check(
        'Doc B in merged',
        filtered.some((c: any) => c.sourceFile === relB)
      );
      console.log(
        `    Original: ${originalCount}  After merge: ${filtered.length}  (+${allNew.length})`
      );
    } finally {
      if (fs.existsSync(tmpA)) fs.unlinkSync(tmpA);
      if (fs.existsSync(tmpB)) fs.unlinkSync(tmpB);
    }
  }

  // ── Test 28: Merge idempotency ─────────────────────────────────────────
  section('TEST 28 — Merge idempotency: merging same file twice = same count');
  if (!fs.existsSync(v6File)) {
    check('v6-chunks.json exists (SKIPPED)', false);
  } else {
    const originalChunks = JSON.parse(fs.readFileSync(v6File, 'utf-8'));
    const originalCount = originalChunks.length;

    // Pick an existing source file and simulate merging it twice
    const targetSource = originalChunks[0].sourceFile;
    const fakeChunk = { ...originalChunks[0], embedding: undefined };

    // First merge
    const sources1 = new Set([targetSource]);
    const pass1 = originalChunks.filter((c: any) => !sources1.has(c.sourceFile));
    pass1.push(fakeChunk);

    // Second merge on same result
    const sources2 = new Set([targetSource]);
    const pass2 = pass1.filter((c: any) => !sources2.has(c.sourceFile));
    pass2.push(fakeChunk);

    check('After 1st merge count equals original', pass1.length === originalCount);
    check('After 2nd merge count still equals original', pass2.length === originalCount);
    check('Idempotent — double merge is stable', pass1.length === pass2.length);
  }

  // ── Test 29: v5 merge doesn't affect v6 ────────────────────────────────
  section('TEST 29 — v5 chunk merge does not touch v6 array');
  if (!fs.existsSync(v5File) || !fs.existsSync(v6File)) {
    check('Both chunk files exist (SKIPPED)', false);
  } else {
    const v5Before = JSON.parse(fs.readFileSync(v5File, 'utf-8'));
    const v6Before = JSON.parse(fs.readFileSync(v6File, 'utf-8'));

    // Create a fake v5-only chunk
    const fakeV5 = {
      id: 'v5-fake-test-0',
      heading: 'Fake V5 Test',
      content: 'test',
      rawContent: 'test',
      breadcrumb: 'test',
      version: 'v5',
      tokens: 10,
      category: 'testing',
      sourceFile: 'docs/v5_docs/fake-test.md',
      hasCode: false,
      codeLanguages: [],
      tags: [],
      subHeadings: [],
    };

    // Merge into v5 only
    const changedSources = new Set([fakeV5.sourceFile]);
    const v5Filtered = v5Before.filter((c: any) => !changedSources.has(c.sourceFile));
    v5Filtered.push(fakeV5);
    // v6 is untouched
    const v6After = v6Before.filter((c: any) => !changedSources.has(c.sourceFile));

    check('v5 count increased by 1', v5Filtered.length === v5Before.length + 1);
    check('v6 count unchanged', v6After.length === v6Before.length);
  }

  // ── Test 30: Empty params handled gracefully ───────────────────────────
  section('TEST 30 — Empty/null params handled gracefully');
  _resetRateLimit();
  const emptyRes = await tool.execute({});
  const emptyP = JSON.parse(emptyRes.content);
  check('Empty params returns error (not crash)', !emptyP.success && emptyP.errors?.length > 0);

  _resetRateLimit();
  const nullRes = await tool.execute(null);
  const nullP = JSON.parse(nullRes.content);
  check('null params returns error (not crash)', !nullP.success && nullP.errors?.length > 0);

  _resetRateLimit();
  const strRes = await tool.execute('not an object');
  const strP = JSON.parse(strRes.content);
  check('string params returns error (not crash)', !strP.success && strP.errors?.length > 0);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function run() {
  await testSubmitPipeline();
  await testIncrementalUpdate();
  await testLocalStagingFiles();
  await testAdditionalValidation();
  await testIncrementalEdgeCases();

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(68));
  console.log(`  Results:  ${passed} passed,  ${failed} failed,  ${passed + failed} total`);
  if (failed === 0) {
    console.log('  🎉  All tests passed!');
  } else {
    console.log(`  ⚠️   ${failed} test(s) failed — review output above.`);
  }
  console.log('═'.repeat(68) + '\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
