/**
 * Manual test script for the submit_documentation pipeline.
 * Calls the tool directly — no MCP transport or server needed.
 *
 * Offline / local-staging mode (no GitHub token):
 *   npx ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true,"target":"ES2020"}' scripts/test-submit.ts
 *
 * GitHub PR mode:
 *   GITHUB_TOKEN=ghp_xxx GITHUB_OWNER=you GITHUB_REPO=cspc319_feathersJS_C \
 *     npx ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true,"target":"ES2020"}' scripts/test-submit.ts
 */

import { SubmitDocumentationTool, _resetRateLimit } from '../src/tools/submitDocumentation';

// Always enable the G1.5 network-tier gate for this script
process.env.ALLOW_NETWORK_TOOLS = 'true';

const tool = new SubmitDocumentationTool();

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
  { label: 'Short title (< 10 chars)',       params: { ...VALID_PARAMS, title: 'Too short' } },
  { label: 'Path traversal',                 params: { ...VALID_PARAMS, filePath: 'docs/v6_docs/../../etc/passwd.md' } },
  { label: 'XSS content',                    params: { ...VALID_PARAMS, content: VALID_PARAMS.content + '\n\n<script>alert("xss")</script>' } },
  { label: 'Version mismatch (v5 path/v6)',  params: { ...VALID_PARAMS, filePath: 'docs/v5_docs/guide.md', version: 'v6' as const } },
  { label: 'No top-level heading',           params: { ...VALID_PARAMS, content: 'Just a paragraph without a heading.\n\n' + 'Some more content to meet the minimum character requirement. '.repeat(5) } },
];

function section(title: string) {
  console.log('\n' + '─'.repeat(64));
  console.log(`  ${title}`);
  console.log('─'.repeat(64));
}

async function run() {
  const mode = process.env.GITHUB_TOKEN
    ? `GitHub PR mode  (owner=${process.env.GITHUB_OWNER}, repo=${process.env.GITHUB_REPO})`
    : 'Local staging mode  (no GITHUB_TOKEN — files written to pending-contributions/)';

  console.log('\n🚀  submit_documentation pipeline manual test');
  console.log(`   Mode : ${mode}`);
  console.log(`   Date : ${new Date().toISOString()}`);

  // ── Test 1: Valid submission ─────────────────────────────────────────────
  section('TEST 1 — Valid submission (should succeed)');
  _resetRateLimit();
  const result  = await tool.execute(VALID_PARAMS);
  const parsed  = JSON.parse(result.content);
  console.log(JSON.stringify(parsed, null, 2));

  if (parsed.success) {
    if (parsed.mode === 'local-staging') {
      console.log(`\n✅  Staged locally → pending-contributions/${parsed.file}`);
      console.log(`    Verify:  cat pending-contributions/${parsed.file}`);
    } else {
      console.log(`\n✅  PR created → ${parsed.prUrl}`);
      console.log(`    Branch : ${parsed.branch}`);
    }
  } else {
    console.log('\n❌  Unexpected failure:', parsed.errors);
  }

  // ── Test 2: Rate limit ───────────────────────────────────────────────────
  section('TEST 2 — Rate limit (immediate 2nd call should be blocked)');
  const rl      = await tool.execute({ ...VALID_PARAMS, title: 'Second submission immediately after the first one' });
  const rlp     = JSON.parse(rl.content);
  console.log(JSON.stringify(rlp, null, 2));
  console.log((!rlp.success && rlp.errors?.some((e: string) => /rate/i.test(e)))
    ? '\n✅  Rate limit correctly enforced'
    : '\n❌  Rate limit NOT enforced');

  // ── Test 3: Validation rejections ───────────────────────────────────────
  section('TEST 3 — Validation rejections (all should fail)');
  for (const { label, params } of INVALID_CASES) {
    _resetRateLimit();
    const r = await tool.execute(params);
    const p = JSON.parse(r.content);
    console.log(`\n  ${!p.success ? '✅  REJECTED' : '❌  INCORRECTLY ACCEPTED'}: ${label}`);
    if (!p.success) console.log(`    Errors: ${JSON.stringify(p.errors)}`);
  }

  // ── Test 4: Network gate (defense-in-depth) ──────────────────────────────
  section('TEST 4 — Network gate: token set but ALLOW_NETWORK_TOOLS unset');
  _resetRateLimit();
  const savedToken = process.env.GITHUB_TOKEN;
  const savedAllow = process.env.ALLOW_NETWORK_TOOLS;
  process.env.GITHUB_TOKEN = 'ghp_fake_token_for_gate_test';
  delete process.env.ALLOW_NETWORK_TOOLS;

  const gate  = await tool.execute(VALID_PARAMS);
  const gatep = JSON.parse(gate.content);
  console.log(JSON.stringify(gatep, null, 2));
  console.log((!gatep.success && gatep.errors?.some((e: string) => /ALLOW_NETWORK_TOOLS/i.test(e)))
    ? '\n✅  G1.5 network gate correctly blocked the call'
    : '\n❌  Network gate NOT working');

  if (savedToken) process.env.GITHUB_TOKEN = savedToken; else delete process.env.GITHUB_TOKEN;
  if (savedAllow) process.env.ALLOW_NETWORK_TOOLS = savedAllow;

  console.log('\n' + '═'.repeat(64));
  console.log('  All tests complete.');
  console.log('═'.repeat(64) + '\n');
}

run().catch((err) => { console.error('Script error:', err); process.exit(1); });
