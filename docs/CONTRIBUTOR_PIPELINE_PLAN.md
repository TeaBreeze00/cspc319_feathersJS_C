# Contributor Documentation Pipeline — Technical Plan

**Author:** Junior Software Engineer  
**Date:** 2026-03-01  
**Status:** Proposed  
**Repo:** `cspc319_feathersJS_C` (FeathersJS MCP Server)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Pipeline Flow (Step-by-Step)](#3-pipeline-flow-step-by-step)
4. [Required Changes](#4-required-changes)
5. [Security & Abuse Prevention](#5-security--abuse-prevention)
6. [Edge Cases](#6-edge-cases)
7. [Definition of Done](#7-definition-of-done)

---

## 1. Executive Summary

This plan introduces a **contributor documentation pipeline** that allows external contributors to submit documentation updates to the FeathersJS MCP Server knowledge base **through the MCP server itself**. Submissions are automatically turned into GitHub Pull Requests, reviewed by project admins in GitHub's native PR UI, and — upon merge — trigger automated rebuilding of the knowledge-base chunks and embeddings.

**Approach chosen:** Automatic GitHub Pull Request creation (open-source native, reviewed by admins in GitHub).

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Submission mechanism | New `submit_documentation` MCP tool | Contributors interact through the same MCP interface they already use |
| PR creation | GitHub REST API (Contents + Pulls endpoints) | GitHub-native, no external infra, open-source friendly |
| Authentication | Personal Access Token (`GITHUB_TOKEN` env var) | Simplest for single-repo OSS; upgradeable to GitHub App later |
| Guardrail G1 exemption | Scoped network-tier flag (`requiresNetwork`) | Preserves offline-first for all existing tools; only the contributor tool may make network calls |
| Post-merge rebuild | GitHub Actions workflow | Zero external infrastructure; runs chunking + embedding on merge |
| Offline fallback | Local staging directory (`pending-contributions/`) | When `GITHUB_TOKEN` is absent, contributions are saved locally for batch submission |

---

## 2. System Architecture

### 2.1 High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  CONTRIBUTOR (via AI client / MCP)                                   │
│                                                                      │
│  Calls: submit_documentation {                                       │
│    title, filePath, content, version, category?, description?        │
│  }                                                                   │
└──────────────┬───────────────────────────────────────────────────────┘
               │ JSON-RPC over stdio
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PROTOCOL LAYER  (src/protocol/)                                     │
│  McpServer receives tools/call → dispatches to Router                │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  ROUTING LAYER  (src/routing/)                                       │
│  Router.route() → ParameterValidator (Ajv) → network-tier gate       │
│  → SubmitDocumentationTool.execute() (30s timeout)                   │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  TOOLS LAYER  (src/tools/submitDocumentation.ts)                     │
│                                                                      │
│  1. Input validation (schema, path, version, size)                   │
│  2. Content sanitization (strip script/iframe/data-URI)              │
│  3. Markdown lint (parse with `marked`, require # heading)           │
│  4. Duplication detection (compare sourceFile in existing chunks)    │
│  5. Rate limit check (1 submission / 60s per server instance)        │
│  6. Dispatch to GitHub adapter OR local staging                      │
└──────┬──────────────────────────────────────┬────────────────────────┘
       │ GITHUB_TOKEN present                  │ GITHUB_TOKEN absent
       ▼                                       ▼
┌──────────────────────┐        ┌──────────────────────────────────┐
│  GITHUB ADAPTER      │        │  LOCAL STAGING                   │
│  src/tools/github/   │        │  pending-contributions/          │
│  githubClient.ts     │        │  <timestamp>-<slug>.json         │
│                      │        │  (queued for batch PR later)     │
│  1. Read base SHA    │        └──────────────────────────────────┘
│  2. Create branch    │
│  3. Commit file      │
│  4. Open PR          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│  GITHUB.COM                                                          │
│                                                                      │
│  PR created on branch: docs/contrib/<timestamp>-<slug>               │
│  Target: main                                                        │
│  Labels: documentation, community-contribution                       │
│  Reviewers: configured repo admins                                   │
└──────────────┬───────────────────────────────────────────────────────┘
               │ Admin reviews & merges
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  GITHUB ACTIONS  (.github/workflows/rebuild-knowledge-base.yml)      │
│                                                                      │
│  Trigger: push to main when docs/v5_docs/** or docs/v6_docs/**      │
│  Steps:                                                              │
│    1. checkout repo                                                  │
│    2. npm ci                                                         │
│    3. ts-node scripts/improved-chunking.ts   (re-chunk)              │
│    4. npm run generate:embeddings            (re-embed)              │
│    5. git commit & push knowledge-base/chunks/*.json                 │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Guardrail G1 Exemption Strategy

The existing guardrail **G1** ("NO network requests at runtime") is critical to the server's offline-first design. We introduce a **scoped exemption**:

**New sub-rule G1.5:**
> Network calls are permitted ONLY for contributor-submission tools, gated by:
> 1. The tool declares `requiresNetwork = true` on the `BaseTool` class.
> 2. The environment variable `ALLOW_NETWORK_TOOLS=true` must be set at server start.
> 3. If the env var is absent, the tool returns a structured error (never crashes).
> 4. All existing tools remain `requiresNetwork = false` (unchanged behavior).

This ensures the 5 existing tools (`search_docs`, `generate_service`, `explain_concept`, `list_available_tools`, `validate_code`) are never affected.

### 2.3 Component Inventory (New and Modified)

| Component | Type | Path |
|-----------|------|------|
| `SubmitDocumentationTool` | **New** tool class | `src/tools/submitDocumentation.ts` |
| `GitHubClient` | **New** adapter | `src/tools/github/githubClient.ts` |
| `GitHubTypes` | **New** types | `src/tools/github/types.ts` |
| `ContentSanitizer` | **New** utility | `src/tools/github/sanitizer.ts` |
| `BaseTool` | **Modified** | `src/tools/baseTool.ts` — add `requiresNetwork` |
| `Router` | **Modified** | `src/routing/router.ts` — add network-tier gate |
| `ToolHandlerEntry` | **Modified** | `src/routing/toolRegistry.ts` — add `requiresNetwork` metadata |
| `src/index.ts` | **Modified** | Wire up new tool |
| `src/tools/index.ts` | **Modified** | Barrel export |
| `src/tools/listTools.ts` | **Modified** | Add to catalog |
| GitHub Actions workflow | **New** | `.github/workflows/rebuild-knowledge-base.yml` |
| Tests | **New** | `tests/tools/submitDocumentation.test.ts`, `tests/tools/github/githubClient.test.ts` |

---

## 3. Pipeline Flow (Step-by-Step)

### Step 1: Contributor Submits Documentation

The contributor (via an AI client or direct MCP call) invokes the `submit_documentation` tool.

**Submission Format — Input Schema (JSON Schema, Ajv-validated):**

```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "minLength": 10,
      "maxLength": 120,
      "description": "PR title describing the documentation change"
    },
    "filePath": {
      "type": "string",
      "pattern": "^docs/(v5_docs|v6_docs)/[a-zA-Z0-9_][a-zA-Z0-9_/.-]*\\.md$",
      "description": "Target file path within the repo (e.g., docs/v6_docs/api/new-feature.md)"
    },
    "content": {
      "type": "string",
      "minLength": 100,
      "maxLength": 50000,
      "description": "Full markdown content for the documentation file"
    },
    "version": {
      "type": "string",
      "enum": ["v5", "v6"],
      "description": "FeathersJS version this doc targets (must match filePath prefix)"
    },
    "category": {
      "type": "string",
      "enum": [
        "application", "authentication", "channels", "cli", "client",
        "configuration", "cookbook", "cookbook-authentication", "cookbook-express",
        "databases", "deployment", "ecosystem", "errors", "events", "express",
        "frontend", "guides", "help", "hooks", "koa", "schema", "services",
        "socketio", "comparison", "general", "migration", "runtime",
        "transport", "security", "testing", "release-notes", "frameworks"
      ],
      "description": "Knowledge-base category (optional; auto-detected from content if omitted)"
    },
    "description": {
      "type": "string",
      "maxLength": 500,
      "description": "Optional PR body text explaining the change"
    },
    "contributorName": {
      "type": "string",
      "maxLength": 100,
      "description": "Optional name for attribution in the PR"
    }
  },
  "required": ["title", "filePath", "content", "version"],
  "additionalProperties": false
}
```

### Step 2: MCP Server Validates the Submission

The `SubmitDocumentationTool.execute()` method runs a **six-stage validation pipeline** (all local, zero network calls):

#### Stage 1 — Schema Validation
- Ajv validates all fields against the input schema above.
- Rejects immediately with structured error listing all violations.

#### Stage 2 — Path Restriction & Traversal Prevention
```typescript
// Validation rules:
// 1. Must match the regex allowlist from inputSchema
// 2. Normalized path must equal original (rejects ".." and "." segments)
// 3. Must NOT contain: \0, backslash, leading slash, double-slash
// 4. Version in path must match the `version` field

const normalized = path.posix.normalize(filePath);
if (normalized !== filePath) reject("Path contains disallowed segments");
if (filePath.includes('..')) reject("Path traversal detected");
if (filePath.startsWith('docs/v5_docs/') && version !== 'v5') reject("Version mismatch");
if (filePath.startsWith('docs/v6_docs/') && version !== 'v6') reject("Version mismatch");
```

#### Stage 3 — Content Sanitization
Strip or reject dangerous content:
- `<script>` and `</script>` tags → **reject**
- `<iframe>` tags → **reject**
- `javascript:` URI scheme → **reject**
- `data:` URIs with executable MIME types → **reject**
- Embedded base64 blobs > 1KB → **warn** (allowed, but flagged in PR body)
- Raw HTML blocks are allowed (standard in Markdown) but audited by admin during review

#### Stage 4 — Markdown Lint
Parse with `marked` (already a project dependency):
- Content must parse without fatal errors
- Must contain at least one top-level `# heading`
- Must not be empty after stripping code fences
- Warn if no code examples are present (FeathersJS docs should be example-rich)

#### Stage 5 — Duplication Detection
Load existing chunks and compare:
```typescript
const existingDocs = await this.loader.load<DocEntry>('chunks');
const existingPaths = new Set(existingDocs.map(d => d.sourceFile));

if (existingPaths.has(filePath)) {
  // File already exists in KB — this is an UPDATE, not a new file
  // Set PR title prefix: "Update: ..."
  // Include diff note in PR body
  isUpdate = true;
}

// Near-duplicate check: compute 3-gram Jaccard similarity against
// the top 3 most similar existing docs (by heading/content overlap).
// If similarity > 0.8, warn contributor and note in PR body.
```

#### Stage 6 — Rate Limit Check
- In-memory cooldown: max 1 submission per 60 seconds per server instance.
- This is a safety throttle, not cross-request state (resets on restart).
- Returns a clear "try again in N seconds" message if throttled.

### Step 3: GitHub PR Is Automatically Generated

If all validation passes, the tool dispatches to the `GitHubClient` adapter:

```typescript
// GitHub API flow (4 API calls total):
// 1. GET /repos/{owner}/{repo}/git/ref/heads/main
//    → get the SHA of the main branch tip
//
// 2. POST /repos/{owner}/{repo}/git/refs
//    → create branch: docs/contrib/<ISO-timestamp>-<sanitized-slug>
//    → e.g., docs/contrib/20260301T143022Z-add-koa-middleware-guide
//
// 3. PUT /repos/{owner}/{repo}/contents/{filePath}
//    → create or update the file on the new branch
//    → content is base64-encoded markdown
//    → commit message: "docs: <title>"
//
// 4. POST /repos/{owner}/{repo}/pulls
//    → open PR from the new branch → main
//    → title: "[Community Docs] <title>"
//    → body: auto-generated with metadata, validation results, contributor name
//    → labels: ["documentation", "community-contribution"]
```

**Branch naming strategy:**
```
docs/contrib/<ISO-timestamp>-<sanitized-title-slug>
```
- Timestamp ensures uniqueness (no collisions)
- Slug is derived from the title: lowercased, non-alphanum → hyphens, max 40 chars
- Example: `docs/contrib/20260301T143022Z-add-koa-middleware-guide`
- **Server-generated only** — contributors cannot choose the branch name

**PR body template:**
```markdown
## Community Documentation Contribution

**Submitted via:** FeathersJS MCP Server (`submit_documentation` tool)
**Contributor:** {contributorName || "Anonymous"}
**Target version:** {version}
**Category:** {category}
**File:** `{filePath}`
**Type:** {isUpdate ? "Update to existing doc" : "New documentation"}

### Validation Results
- ✅ Schema validation passed
- ✅ Path restrictions passed
- ✅ Content sanitization passed
- ✅ Markdown lint passed
- {duplicateWarning || "✅ No near-duplicates detected"}

### Description
{description || "No description provided."}

---
*This PR was automatically generated by the FeathersJS MCP Server contributor pipeline.
Please review the content carefully before merging.*
```

### Step 4: Admin Reviews and Merges

- Admins receive the PR in GitHub's standard PR interface.
- The PR has clear labels (`documentation`, `community-contribution`) for filtering.
- Validation results are pre-populated in the PR body.
- Admins review the markdown content, check for accuracy, and merge (or request changes / close).
- Standard GitHub review workflow applies (comments, suggestions, approvals).

### Step 5: Merged Docs Flow Into Knowledge-Base Build

Upon merge to `main` (when files in `docs/v5_docs/**` or `docs/v6_docs/**` are modified):

1. **GitHub Actions workflow triggers** (`rebuild-knowledge-base.yml`)
2. **Re-chunking:** `ts-node scripts/improved-chunking.ts` processes all files in `docs/v5_docs/` and `docs/v6_docs/`, regenerating `knowledge-base/chunks/v5-chunks.json`, `v6-chunks.json`, and `metadata.json`
3. **Re-embedding:** `npm run generate:embeddings` runs incrementally — only new/changed chunks get embedded (existing embeddings are preserved)
4. **Commit and push:** The updated `knowledge-base/chunks/*.json` files are committed back to `main` automatically
5. **Next server build** picks up the new chunks; users get updated search results

### Where New Docs Live

```
docs/
├── v5_docs/          ← v5 contributions land here
│   ├── api/
│   ├── cookbook/
│   ├── guides/
│   └── ...           ← new files added by contributors
├── v6_docs/          ← v6 contributions land here
│   ├── api/
│   ├── cookbook/
│   ├── guides/
│   └── ...           ← new files added by contributors
```

The contributor specifies the exact `filePath` (e.g., `docs/v6_docs/cookbook/custom-hooks.md`). The path regex ensures contributions can only land within the two versioned doc directories.

---

## 4. Required Changes

### 4.1 MCP Server Changes

#### 4.1.1 `src/tools/baseTool.ts` — Add Network Tier

```typescript
export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: JsonSchema;

  /** Whether this tool requires network access (default: false).
   *  Network-tier tools are only dispatched when ALLOW_NETWORK_TOOLS=true. */
  requiresNetwork: boolean = false;

  abstract execute(params: unknown): Promise<ToolResult>;

  register(): ToolRegistration {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      handler: (params: unknown) => this.execute(params),
      requiresNetwork: this.requiresNetwork,
    };
  }
}
```

#### 4.1.2 `src/protocol/types.ts` — Extend ToolRegistration

```typescript
export interface ToolRegistration {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler: ToolHandler;
  requiresNetwork?: boolean;  // NEW
}
```

#### 4.1.3 `src/routing/router.ts` — Network-Tier Gate

```typescript
async route(request: ToolRequest): Promise<ToolResponse> {
  try {
    const entry = this.registry.lookup(request.toolName);
    if (!entry) throw new Error(`Unknown tool: ${request.toolName}`);

    // NEW: network-tier gate
    if (entry.requiresNetwork && process.env.ALLOW_NETWORK_TOOLS !== 'true') {
      return {
        success: false,
        error: {
          code: 'NETWORK_NOT_ALLOWED',
          message: `Tool "${request.toolName}" requires network access. ` +
                   `Set ALLOW_NETWORK_TOOLS=true to enable contributor submissions.`,
        },
      };
    }

    // ... existing validation and execution logic ...
  }
}
```

#### 4.1.4 `src/routing/toolRegistry.ts` — Store Network Flag

```typescript
export interface ToolHandlerEntry {
  handler: ToolHandler;
  schema: object;
  requiresNetwork?: boolean;  // NEW
}

// Update register() to accept and store the flag
register(name: string, handler: ToolHandler, schema: object, requiresNetwork = false): void {
  // ...
  this.handlers.set(name, { handler, schema, requiresNetwork });
}
```

#### 4.1.5 `src/tools/submitDocumentation.ts` — New Tool (Full Implementation)

```typescript
import { BaseTool } from './baseTool';
import { ToolResult, JsonSchema } from '../protocol/types';
import { KnowledgeLoader } from '../knowledge';
import { DocEntry } from '../knowledge/types';
import { GitHubClient, GitHubPRResult } from './github/githubClient';
import { sanitizeContent, SanitizationResult } from './github/sanitizer';
import { marked } from 'marked';
import * as path from 'path';
import * as fs from 'fs';

// Rate limiting state (per-instance, resets on restart)
let lastSubmissionTime = 0;
const RATE_LIMIT_MS = 60_000; // 1 minute

interface SubmitDocParams {
  title: string;
  filePath: string;
  content: string;
  version: 'v5' | 'v6';
  category?: string;
  description?: string;
  contributorName?: string;
}

export class SubmitDocumentationTool extends BaseTool {
  name = 'submit_documentation';
  requiresNetwork = true;

  description = 'Submit a documentation update or new doc as a GitHub Pull Request. ' +
    'Content is validated locally, then a PR is auto-created for admin review.';

  inputSchema: JsonSchema = { /* ... full schema from Step 1 above ... */ };

  private loader: KnowledgeLoader;
  private githubClient: GitHubClient;

  constructor(loader?: KnowledgeLoader, githubClient?: GitHubClient) {
    super();
    this.loader = loader ?? new KnowledgeLoader();
    this.githubClient = githubClient ?? new GitHubClient();
  }

  async execute(params: unknown): Promise<ToolResult> {
    const p = params as SubmitDocParams;
    const errors: string[] = [];

    // --- Stage 1: Schema validation (defense-in-depth) ---
    if (!p.title || p.title.length < 10 || p.title.length > 120)
      errors.push('title must be 10-120 characters');
    if (!p.content || p.content.length < 100)
      errors.push('content must be at least 100 characters');
    if (!p.version || !['v5', 'v6'].includes(p.version))
      errors.push('version must be "v5" or "v6"');

    // --- Stage 2: Path restriction ---
    const pathErrors = this.validatePath(p.filePath, p.version);
    errors.push(...pathErrors);

    // --- Stage 3: Content sanitization ---
    const sanitization = sanitizeContent(p.content);
    if (sanitization.rejected) errors.push(...sanitization.reasons);

    // --- Stage 4: Markdown lint ---
    const lintErrors = this.lintMarkdown(p.content);
    errors.push(...lintErrors);

    if (errors.length > 0) {
      return {
        content: JSON.stringify({ success: false, errors }),
        metadata: { tool: this.name, success: false },
      };
    }

    // --- Stage 5: Duplication detection ---
    const dupeInfo = await this.checkDuplication(p.filePath, p.content);

    // --- Stage 6: Rate limit ---
    const now = Date.now();
    if (now - lastSubmissionTime < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - (now - lastSubmissionTime)) / 1000);
      return {
        content: JSON.stringify({
          success: false,
          errors: [`Rate limited. Try again in ${waitSec} seconds.`],
        }),
        metadata: { tool: this.name, success: false },
      };
    }

    // --- Dispatch ---
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      // Offline fallback: save to pending-contributions/
      return this.stageLocally(p, dupeInfo);
    }

    lastSubmissionTime = now;
    const result = await this.githubClient.createDocsPR({
      token,
      owner: process.env.GITHUB_OWNER || 'owner',
      repo: process.env.GITHUB_REPO || 'cspc319_feathersJS_C',
      filePath: p.filePath,
      content: sanitization.cleanContent,
      title: p.title,
      description: p.description,
      contributorName: p.contributorName,
      version: p.version,
      category: p.category,
      isUpdate: dupeInfo.isUpdate,
      duplicateWarning: dupeInfo.warning,
    });

    return {
      content: JSON.stringify(result),
      metadata: { tool: this.name, success: result.success },
    };
  }

  // ... helper methods: validatePath(), lintMarkdown(), checkDuplication(), stageLocally()
}
```

#### 4.1.6 `src/tools/github/githubClient.ts` — GitHub API Adapter

```typescript
import * as https from 'https';

export interface CreatePRParams {
  token: string;
  owner: string;
  repo: string;
  filePath: string;
  content: string;
  title: string;
  description?: string;
  contributorName?: string;
  version: string;
  category?: string;
  isUpdate: boolean;
  duplicateWarning?: string;
}

export interface GitHubPRResult {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  branch?: string;
  error?: string;
}

export class GitHubClient {
  private baseUrl = 'https://api.github.com';

  async createDocsPR(params: CreatePRParams): Promise<GitHubPRResult> {
    try {
      // 1. Get main branch SHA
      const mainRef = await this.apiGet(params.token, params.owner, params.repo,
        '/git/ref/heads/main');
      const baseSha = mainRef.object.sha;

      // 2. Create branch
      const branchName = this.generateBranchName(params.title);
      await this.apiPost(params.token, params.owner, params.repo, '/git/refs', {
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      });

      // 3. Create/update file
      const contentBase64 = Buffer.from(params.content, 'utf-8').toString('base64');
      // Check if file exists on main (for update scenario)
      let existingSha: string | undefined;
      if (params.isUpdate) {
        try {
          const existing = await this.apiGet(params.token, params.owner, params.repo,
            `/contents/${params.filePath}?ref=main`);
          existingSha = existing.sha;
        } catch { /* file doesn't exist yet, that's fine */ }
      }

      await this.apiPut(params.token, params.owner, params.repo,
        `/contents/${params.filePath}`, {
          message: `docs: ${params.title}`,
          content: contentBase64,
          branch: branchName,
          ...(existingSha ? { sha: existingSha } : {}),
        });

      // 4. Open PR
      const prBody = this.buildPRBody(params);
      const pr = await this.apiPost(params.token, params.owner, params.repo, '/pulls', {
        title: `[Community Docs] ${params.title}`,
        head: branchName,
        base: 'main',
        body: prBody,
      });

      return {
        success: true,
        prUrl: pr.html_url,
        prNumber: pr.number,
        branch: branchName,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Never leak auth tokens or raw API errors
      return {
        success: false,
        error: `Failed to create PR: ${message.replace(/token\s+\S+/gi, 'token [REDACTED]')}`,
      };
    }
  }

  private generateBranchName(title: string): string {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z/, 'Z');
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    return `docs/contrib/${timestamp}-${slug}`;
  }

  // ... apiGet(), apiPost(), apiPut() methods using Node.js https module
  // ... buildPRBody() method generating the PR body template
}
```

#### 4.1.7 `src/tools/github/sanitizer.ts` — Content Sanitization

```typescript
export interface SanitizationResult {
  cleanContent: string;
  rejected: boolean;
  reasons: string[];
  warnings: string[];
}

export function sanitizeContent(raw: string): SanitizationResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Hard rejections
  if (/<script[\s>]/i.test(raw)) reasons.push('Content contains <script> tags');
  if (/<\/script>/i.test(raw)) reasons.push('Content contains </script> tags');
  if (/<iframe[\s>]/i.test(raw)) reasons.push('Content contains <iframe> tags');
  if (/javascript:/i.test(raw)) reasons.push('Content contains javascript: URIs');
  if (/data:[^;]+;base64,.{1024,}/i.test(raw))
    reasons.push('Content contains large base64 data URIs');

  // Warnings (allowed but flagged)
  if (/<[a-z]+[^>]*>/i.test(raw) && !/<(br|hr|img|a|em|strong|code|pre|p|ul|ol|li|h[1-6]|table|tr|td|th|thead|tbody|blockquote|div|span)\b/i.test(raw))
    warnings.push('Content contains uncommon HTML tags');

  return {
    cleanContent: raw, // Content is not modified — only accept/reject
    rejected: reasons.length > 0,
    reasons,
    warnings,
  };
}
```

#### 4.1.8 `src/tools/github/types.ts` — Shared Types

```typescript
export interface GitHubAPIError {
  status: number;
  message: string;
  documentationUrl?: string;
}

export interface GitHubRef {
  ref: string;
  object: {
    sha: string;
    type: string;
  };
}

export interface GitHubContentResponse {
  sha: string;
  name: string;
  path: string;
}

export interface GitHubPullRequest {
  number: number;
  html_url: string;
  state: string;
  title: string;
}
```

#### 4.1.9 `src/index.ts` — Wire Up New Tool

```typescript
// Add import
import { SubmitDocumentationTool } from './tools';

// Create instance
const submitDocTool = new SubmitDocumentationTool();

// Register with protocol registry
registry.register(submitDocTool.register());

// Register with routing registry
routingRegistry.register(
  'submit_documentation',
  (params: unknown) => submitDocTool.execute(params),
  submitDocTool.inputSchema,
  true  // requiresNetwork = true
);
```

#### 4.1.10 `src/tools/index.ts` — Barrel Export

```typescript
export { SubmitDocumentationTool } from './submitDocumentation';
```

#### 4.1.11 `src/tools/listTools.ts` — Add to Catalog

Add a new entry to the tool catalog:
```typescript
{
  name: 'submit_documentation',
  category: 'submit' as ToolCategory,  // Add 'submit' to ToolCategory union
  description: 'Submit a documentation update or new doc as a GitHub PR for admin review.',
  inputSchema: { /* ... abbreviated ... */ },
  example: 'submit_documentation { title: "Add Koa middleware guide", filePath: "docs/v6_docs/cookbook/koa-middleware.md", content: "# Koa Middleware\\n...", version: "v6" }',
}
```

### 4.2 GitHub Integration

#### 4.2.1 Authentication Strategy

| Aspect | Decision |
|--------|----------|
| Method | Personal Access Token (PAT) — fine-grained |
| Storage | `GITHUB_TOKEN` environment variable (never committed) |
| Scope | `contents:write` + `pull_requests:write` on the target repo only |
| Rotation | Document 90-day rotation policy in CONTRIBUTING.md |
| Fallback | When absent, submissions saved to `pending-contributions/` locally |

**Why PAT over GitHub App:**
- Single-repo project: PAT is simpler, no webhook infrastructure needed
- GitHub App requires a server endpoint for installation callbacks
- PAT can be upgraded to a GitHub App later without changing the tool interface

**Environment variables required:**
```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=<repo-owner>          # defaults to 'owner'
GITHUB_REPO=cspc319_feathersJS_C   # defaults to repo name
ALLOW_NETWORK_TOOLS=true           # enables the network-tier gate
```

#### 4.2.2 API Usage

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/repos/{owner}/{repo}/git/ref/heads/main` | GET | Get main branch SHA |
| `/repos/{owner}/{repo}/git/refs` | POST | Create feature branch |
| `/repos/{owner}/{repo}/contents/{path}` | PUT | Create/update file |
| `/repos/{owner}/{repo}/pulls` | POST | Open pull request |

Total: **4 API calls per submission** (well within GitHub's 5,000/hour rate limit for authenticated requests).

### 4.3 Updates to Build Steps

#### 4.3.1 New `npm` Script

Add to `package.json`:
```json
{
  "scripts": {
    "rebuild:kb": "ts-node scripts/improved-chunking.ts && npm run generate:embeddings"
  }
}
```

#### 4.3.2 GitHub Actions Workflow

Create `.github/workflows/rebuild-knowledge-base.yml`:

```yaml
name: Rebuild Knowledge Base

on:
  push:
    branches: [main]
    paths:
      - 'docs/v5_docs/**'
      - 'docs/v6_docs/**'

jobs:
  rebuild:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Re-chunk documentation
        run: npx ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true,"target":"ES2020"}' scripts/improved-chunking.ts

      - name: Generate embeddings
        run: npm run generate:embeddings

      - name: Commit updated knowledge base
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add knowledge-base/chunks/
          if git diff --staged --quiet; then
            echo "No changes to knowledge base"
          else
            git commit -m "chore: rebuild knowledge base after docs update"
            git push
          fi
```

### 4.4 Documentation Updates Required

| Document | Update |
|----------|--------|
| `docs/BUILD_STEPS.md` | Add Phase for contributor pipeline build steps, document G1.5 exemption |
| `docs/IMPLEMENTATION_PLAN.md` | Add G1.5 sub-rule, new Phase for contributor tools |
| `docs/TECHNICAL_DOCUMENTATION.md` | Add Section 7: Contributor Pipeline (architecture, tool API, security model) |
| `README.md` | Add "Contributing Documentation" section with usage examples |
| **New:** `CONTRIBUTING.md` | Full contributor guide: how to use `submit_documentation`, content guidelines, review process |
| **New:** `docs/CONTRIBUTOR_PIPELINE_PLAN.md` | This document |

---

## 5. Security & Abuse Prevention

### 5.1 Rate Limiting

| Layer | Mechanism | Limit |
|-------|-----------|-------|
| Tool-level | In-memory cooldown in `SubmitDocumentationTool` | 1 submission / 60 seconds per server instance |
| GitHub API | Token-based rate limit (GitHub enforced) | 5,000 requests/hour (authenticated) |
| Content size | `maxLength: 50000` in JSON Schema | 50KB per submission |

The tool-level rate limit resets on server restart. This is intentionally simple:
- The MCP server is a single-process stdio server (no concurrent users)
- One submission per minute is sufficient for legitimate contributors
- GitHub's own rate limits provide a secondary safety net

### 5.2 Path Traversal Prevention

```typescript
// Defense-in-depth: 4 layers of path validation
// Layer 1: JSON Schema regex — only allows docs/(v5_docs|v6_docs)/... .md
// Layer 2: posix normalize check — rejects ".." and "." segments
// Layer 3: Explicit checks — no null bytes, backslashes, leading slashes, double slashes
// Layer 4: Version-path consistency — v5 path ↔ v5 version field

function validatePath(filePath: string, version: string): string[] {
  const errors: string[] = [];

  const ALLOWED_PATTERN = /^docs\/(v5_docs|v6_docs)\/[a-zA-Z0-9_][a-zA-Z0-9_/.\-]*\.md$/;
  if (!ALLOWED_PATTERN.test(filePath))
    errors.push('filePath must match docs/(v5_docs|v6_docs)/.../*.md');

  if (path.posix.normalize(filePath) !== filePath)
    errors.push('filePath contains disallowed path segments');

  if (filePath.includes('\0')) errors.push('filePath contains null bytes');
  if (filePath.includes('\\')) errors.push('filePath contains backslashes');
  if (filePath.includes('//')) errors.push('filePath contains double slashes');

  const pathVersion = filePath.startsWith('docs/v5_docs/') ? 'v5' : 'v6';
  if (pathVersion !== version)
    errors.push(`Version mismatch: path is ${pathVersion} but version field is ${version}`);

  return errors;
}
```

### 5.3 PR Branch Naming Strategy

| Aspect | Rule |
|--------|------|
| Format | `docs/contrib/<ISO-timestamp>-<sanitized-slug>` |
| Timestamp | `YYYYMMDDTHHmmssZ` (UTC, no separators) |
| Slug | Title → lowercase → non-alphanum to hyphens → trim hyphens → max 40 chars |
| Total max length | ~60 chars |
| Who generates it | **Server only** — contributors cannot specify branch names |
| Example | `docs/contrib/20260301T143022Z-add-koa-middleware-guide` |

This prevents:
- Branch name collisions (timestamp guarantees uniqueness)
- Injection via branch names (slug is sanitized)
- Namespace pollution (all contribution branches live under `docs/contrib/`)

### 5.4 Handling Malicious or Malformed Content

| Threat | Mitigation |
|--------|------------|
| XSS via `<script>` tags | Hard reject in sanitizer |
| Iframe injection | Hard reject in sanitizer |
| JavaScript URIs in links | Hard reject in sanitizer |
| Large base64 data URIs | Hard reject (>1KB) in sanitizer |
| Path traversal (`../`) | 4-layer path validation |
| Oversized submissions | 50KB content limit in schema |
| Spam / rapid-fire submissions | 60-second rate limit |
| Token leakage in error messages | All errors sanitized; tokens redacted |
| Binary or non-UTF-8 content | `marked` parser will fail → rejected |
| Commit message injection | Commit message is server-generated from sanitized title |

### 5.5 Token Security

- `GITHUB_TOKEN` is **never** included in tool results, error messages, or PR bodies
- The `GitHubClient` catches all errors and redacts any token-like strings
- The token is read from `process.env` at call time (not stored in class state)
- Documentation specifies fine-grained PAT with minimal scope

---

## 6. Edge Cases

### 6.1 Duplicate Content

| Scenario | Handling |
|----------|----------|
| Exact same `filePath` exists in knowledge base | Detected in Stage 5; PR is marked as "Update" with note in body |
| Content is >80% similar to existing doc (Jaccard) | Warning added to PR body; not blocked (admin decides) |
| Contributor submits identical content twice | Rate limit prevents rapid re-submission; GitHub will show "no changes" if the branch already exists |

### 6.2 Version Mismatches (v5 vs v6)

| Scenario | Handling |
|----------|----------|
| `filePath` says `v5_docs` but `version` field says `v6` | Hard reject in Stage 2 (path-version consistency check) |
| Content references v5 APIs but targets v6 directory | Not automatically detectable; flagged for admin review |
| Contributor unsure which version | Tool description and error messages guide them to check |

### 6.3 Broken Links

| Scenario | Handling |
|----------|----------|
| Markdown contains relative links to non-existent files | Not validated at submission time (would require full repo scan); admin responsibility during review |
| External URLs that may be broken | Not validated (G1: no network calls during validation); admin responsibility |
| **Future enhancement** | Add optional link-checking in the GitHub Actions workflow post-merge |

### 6.4 Failed PR Creation

| Scenario | Handling |
|----------|----------|
| `GITHUB_TOKEN` missing | Fallback to local staging (`pending-contributions/`) with clear message |
| `GITHUB_TOKEN` expired or invalid (401) | Return structured error: "Authentication failed. Contact project admins." |
| Branch already exists (422) | Timestamp-based naming makes this near-impossible; if it occurs, append a random suffix and retry once |
| GitHub API rate limit exceeded (429) | Return structured error with retry-after header value |
| Network timeout | 30-second timeout in Router; return "GitHub API timed out, try again later" |
| Repository not found (404) | Return structured error: "Repository not found. Check GITHUB_OWNER and GITHUB_REPO." |
| Insufficient permissions (403) | Return structured error: "Token lacks required permissions (contents:write, pull_requests:write)." |
| `pending-contributions/` write fails | Return error; no silent data loss |

### 6.5 Offline Fallback (Local Staging)

When `GITHUB_TOKEN` is not set, contributions are saved as JSON files:

```
pending-contributions/
└── 20260301T143022Z-add-koa-middleware-guide.json
```

Each file contains:
```json
{
  "timestamp": "2026-03-01T14:30:22.000Z",
  "title": "Add Koa middleware guide",
  "filePath": "docs/v6_docs/cookbook/koa-middleware.md",
  "content": "# Koa Middleware\n...",
  "version": "v6",
  "category": "cookbook",
  "description": "Guide for using Koa middleware with FeathersJS v6",
  "contributorName": "Jane Doe",
  "validationResults": { "passed": true, "warnings": [] }
}
```

Admins can later batch-submit these via a helper script: `npm run submit:pending`.

---

## 7. Definition of Done

The contributor pipeline is **production-ready** when ALL of the following are true:

### Functional Requirements

- [ ] `submit_documentation` tool is registered and discoverable via `list_available_tools`
- [ ] Tool validates all 6 stages (schema, path, sanitization, markdown, duplication, rate limit) correctly
- [ ] Valid submissions with `GITHUB_TOKEN` create a GitHub PR with correct branch, file, title, body, and labels
- [ ] Valid submissions without `GITHUB_TOKEN` save to `pending-contributions/` with full metadata
- [ ] PR body includes validation results, contributor attribution, and review instructions
- [ ] Merged PRs trigger the GitHub Actions workflow that rebuilds the knowledge base
- [ ] Rebuilt chunks are committed back to `main` and available to `search_docs` on next server build

### Security Requirements

- [ ] Path traversal attempts are rejected (tested with `../`, `./`, null bytes, backslashes)
- [ ] `<script>`, `<iframe>`, `javascript:` URIs, and large `data:` URIs are rejected
- [ ] `GITHUB_TOKEN` never appears in tool results, error messages, or PR bodies
- [ ] Rate limiting enforces 1 submission/60s per server instance
- [ ] Network-tier gate prevents tool execution when `ALLOW_NETWORK_TOOLS` is not set

### Testing Requirements

- [ ] Unit tests for `SubmitDocumentationTool` cover all 6 validation stages and both dispatch paths
- [ ] Unit tests for `GitHubClient` mock all 4 API calls and cover error scenarios (401, 403, 404, 422, 429, timeout)
- [ ] Unit tests for `sanitizeContent()` cover all rejection and warning cases
- [ ] Integration test exercises full Router → Tool → mock GitHub flow
- [ ] All existing tests continue to pass (no regressions)
- [ ] Test coverage remains ≥80% (per existing `jest.config.js` threshold)

### Documentation Requirements

- [ ] `CONTRIBUTING.md` created with contributor guide and usage examples
- [ ] `docs/BUILD_STEPS.md` updated with contributor pipeline build steps
- [ ] `docs/IMPLEMENTATION_PLAN.md` updated with G1.5 exemption rule
- [ ] `docs/TECHNICAL_DOCUMENTATION.md` updated with contributor pipeline section
- [ ] `README.md` updated with "Contributing Documentation" section
- [ ] This plan document (`docs/CONTRIBUTOR_PIPELINE_PLAN.md`) is committed

### Operational Requirements

- [ ] `.github/workflows/rebuild-knowledge-base.yml` is committed and functional
- [ ] `npm run rebuild:kb` script works locally
- [ ] `pending-contributions/` directory is in `.gitignore`
- [ ] Environment variable requirements are documented in README and CONTRIBUTING

---

*End of Technical Plan*
