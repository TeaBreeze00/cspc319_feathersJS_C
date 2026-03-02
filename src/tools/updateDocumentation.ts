/**
 * updateDocumentation.ts
 *
 * MCP tool that lets external contributors update an existing documentation
 * file via a GitHub Pull Request. The document must already exist in the
 * knowledge base — use `submit_documentation` for new files instead.
 *
 * Content is validated through the same 6-stage pipeline as submit_documentation,
 * with an inverted existence check (must exist vs. duplication warning).
 *
 * This tool declares `requiresNetwork = true` (G1.5 exemption).
 * It is only dispatched when ALLOW_NETWORK_TOOLS=true.
 */

import * as path from 'path';
import * as fs from 'fs';
import { BaseTool } from './baseTool';
import { ToolResult, JsonSchema } from '../protocol/types';
import { KnowledgeLoader } from '../knowledge';
import { DocEntry } from '../knowledge/types';
import { GitHubClient } from './github/githubClient';
import { sanitizeContent } from './github/sanitizer';

// ---------------------------------------------------------------------------
// Rate limiting (per-instance, resets on restart)
// ---------------------------------------------------------------------------

let lastUpdateTime = 0;
const RATE_LIMIT_MS = 60_000; // 1 update per 60 seconds

/** Reset rate limit state (exposed for testing). */
export function _resetRateLimit(): void {
  lastUpdateTime = 0;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UpdateDocParams {
  title: string;
  filePath: string;
  content: string;
  version: 'v5' | 'v6';
  category?: string;
  description?: string;
  contributorName?: string;
}

// ---------------------------------------------------------------------------
// Allowed categories (same set as submitDocumentation)
// ---------------------------------------------------------------------------

const ALLOWED_CATEGORIES = new Set([
  'application',
  'authentication',
  'channels',
  'cli',
  'client',
  'comparison',
  'configuration',
  'cookbook',
  'cookbook-authentication',
  'cookbook-express',
  'databases',
  'deployment',
  'ecosystem',
  'errors',
  'events',
  'express',
  'frontend',
  'frameworks',
  'general',
  'guides',
  'help',
  'hooks',
  'koa',
  'migration',
  'release-notes',
  'runtime',
  'schema',
  'security',
  'services',
  'socketio',
  'testing',
  'transport',
]);

// ---------------------------------------------------------------------------
// Path validation regex — only docs/(v5_docs|v6_docs)/.../*.md
// ---------------------------------------------------------------------------

const ALLOWED_PATH_PATTERN = /^docs\/(v5_docs|v6_docs)\/[a-zA-Z0-9_][a-zA-Z0-9_/.\-]*\.md$/;

// ---------------------------------------------------------------------------
// UpdateDocumentationTool
// ---------------------------------------------------------------------------

export class UpdateDocumentationTool extends BaseTool {
  name = 'update_documentation';

  requiresNetwork = true;

  description =
    'Update an existing documentation file via a GitHub Pull Request for admin review. ' +
    'The document must already exist in the knowledge base. ' +
    'Content is validated locally (schema, path, sanitization, markdown lint, existence check) ' +
    'then a PR is automatically created. If GITHUB_TOKEN is not set, the update is staged locally. ' +
    'For new documents, use submit_documentation instead.';

  inputSchema: JsonSchema = {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        minLength: 10,
        maxLength: 120,
        description: 'PR title describing the documentation update.',
      },
      filePath: {
        type: 'string',
        pattern: '^docs/(v5_docs|v6_docs)/[a-zA-Z0-9_][a-zA-Z0-9_/.-]*\\.md$',
        description:
          'Target file path within the repo (must already exist in the knowledge base).',
      },
      content: {
        type: 'string',
        minLength: 100,
        maxLength: 50000,
        description: 'Full updated markdown content for the documentation file.',
      },
      version: {
        type: 'string',
        enum: ['v5', 'v6'],
        description: 'FeathersJS version this doc targets (must match filePath prefix).',
      },
      category: {
        type: 'string',
        description: 'Knowledge-base category (optional; auto-detected from content if omitted).',
      },
      description: {
        type: 'string',
        maxLength: 500,
        description: 'Optional PR body text explaining the update.',
      },
      contributorName: {
        type: 'string',
        maxLength: 100,
        description: 'Optional name for attribution in the PR.',
      },
    },
    required: ['title', 'filePath', 'content', 'version'],
    additionalProperties: false,
  };

  private loader: KnowledgeLoader;
  private githubClient: GitHubClient;

  constructor(loader?: KnowledgeLoader, githubClient?: GitHubClient) {
    super();
    this.loader = loader ?? new KnowledgeLoader();
    this.githubClient = githubClient ?? new GitHubClient();
  }

  async execute(params: unknown): Promise<ToolResult> {
    if (!params || typeof params !== 'object') {
      return this.errorResult([
        'Invalid input: expected an object with title, filePath, content, version.',
      ]);
    }

    const p = params as UpdateDocParams;
    const errors: string[] = [];

    // ── Stage 1: Schema validation (defense-in-depth) ────────────────────
    if (!p.title || typeof p.title !== 'string') {
      errors.push('title is required and must be a string.');
    } else if (p.title.length < 10 || p.title.length > 120) {
      errors.push('title must be between 10 and 120 characters.');
    }

    if (!p.content || typeof p.content !== 'string') {
      errors.push('content is required and must be a string.');
    } else if (p.content.length < 100) {
      errors.push('content must be at least 100 characters.');
    } else if (p.content.length > 50000) {
      errors.push('content must not exceed 50,000 characters.');
    }

    if (!p.version || !['v5', 'v6'].includes(p.version)) {
      errors.push('version must be "v5" or "v6".');
    }

    if (!p.filePath || typeof p.filePath !== 'string') {
      errors.push('filePath is required and must be a string.');
    }

    if (p.category && !ALLOWED_CATEGORIES.has(p.category)) {
      errors.push(
        `Invalid category "${p.category}". Allowed: ${[...ALLOWED_CATEGORIES].join(', ')}`
      );
    }

    // Stop early on basic schema errors
    if (errors.length > 0) {
      return this.errorResult(errors);
    }

    // ── Stage 2: Path restriction & traversal prevention ─────────────────
    const pathErrors = this.validatePath(p.filePath, p.version);
    if (pathErrors.length > 0) {
      return this.errorResult(pathErrors);
    }

    // ── Stage 3: Content sanitization ────────────────────────────────────
    const sanitization = sanitizeContent(p.content);
    if (sanitization.rejected) {
      return this.errorResult(sanitization.reasons);
    }

    // ── Stage 4: Markdown lint ───────────────────────────────────────────
    const lintErrors = this.lintMarkdown(p.content);
    if (lintErrors.length > 0) {
      return this.errorResult(lintErrors);
    }

    // ── Stage 5: Existence check — file MUST exist (inverted from submit) ─
    const exists = await this.checkExists(p.filePath);
    if (!exists) {
      return this.errorResult([
        `File "${p.filePath}" does not exist in the knowledge base. ` +
          'Use submit_documentation to create new documents.',
      ]);
    }

    // ── Stage 6: Rate limit ──────────────────────────────────────────────
    const now = Date.now();
    if (now - lastUpdateTime < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - (now - lastUpdateTime)) / 1000);
      return this.errorResult([`Rate limited. Please try again in ${waitSec} seconds.`]);
    }

    // ── Dispatch: GitHub PR or local staging ─────────────────────────────
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return this.stageLocally(p, sanitization.warnings);
    }

    // Defense-in-depth: G1.5 gate also enforced inside the tool
    if (process.env.ALLOW_NETWORK_TOOLS !== 'true') {
      return this.errorResult([
        'Network access not enabled. Set ALLOW_NETWORK_TOOLS=true to enable GitHub PR submissions.',
      ]);
    }

    lastUpdateTime = now;

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
      isUpdate: true, // always true — we verified existence
      duplicateWarning: undefined,
    });

    if (result.success) {
      return {
        content: JSON.stringify(
          {
            success: true,
            message: 'Documentation update PR created successfully.',
            prUrl: result.prUrl,
            prNumber: result.prNumber,
            branch: result.branch,
            warnings: sanitization.warnings,
          },
          null,
          2
        ),
        metadata: { tool: this.name, success: true, prNumber: result.prNumber },
      };
    }

    return {
      content: JSON.stringify({ success: false, error: result.error }, null, 2),
      metadata: { tool: this.name, success: false },
    };
  }

  // =====================================================================
  // Validation helpers
  // =====================================================================

  /**
   * Four-layer path validation (same as submitDocumentation).
   */
  validatePath(filePath: string, version: string): string[] {
    const errors: string[] = [];

    if (!ALLOWED_PATH_PATTERN.test(filePath)) {
      errors.push('filePath must match pattern docs/(v5_docs|v6_docs)/.../*.md');
    }

    const normalized = path.posix.normalize(filePath);
    if (normalized !== filePath) {
      errors.push('filePath contains disallowed path segments (e.g., ".." or ".").');
    }

    if (filePath.includes('\0')) errors.push('filePath contains null bytes.');
    if (filePath.includes('\\')) errors.push('filePath contains backslashes.');
    if (filePath.includes('//')) errors.push('filePath contains double slashes.');

    if (filePath.startsWith('docs/v5_docs/') && version !== 'v5') {
      errors.push(
        'Version mismatch: filePath targets v5_docs but version field is "' + version + '".'
      );
    }
    if (filePath.startsWith('docs/v6_docs/') && version !== 'v6') {
      errors.push(
        'Version mismatch: filePath targets v6_docs but version field is "' + version + '".'
      );
    }

    return errors;
  }

  /**
   * Basic markdown lint (same as submitDocumentation).
   */
  lintMarkdown(content: string): string[] {
    const errors: string[] = [];

    const hasH1 = /^#\s+.+/m.test(content);
    if (!hasH1) {
      errors.push('Markdown must contain at least one top-level heading (# Title).');
    }

    const stripped = content.replace(/```[\s\S]*?```/g, '').trim();
    if (stripped.length < 50) {
      errors.push(
        'Markdown content is too short after removing code blocks (min 50 chars of prose).'
      );
    }

    return errors;
  }

  /**
   * Check if the file exists in the knowledge base.
   */
  async checkExists(filePath: string): Promise<boolean> {
    try {
      const existingDocs = await this.loader.load<DocEntry>('chunks');
      return existingDocs.some((d) => d.sourceFile === filePath);
    } catch {
      return false;
    }
  }

  // =====================================================================
  // Offline fallback: local staging
  // =====================================================================

  private stageLocally(params: UpdateDocParams, warnings: string[]): ToolResult {
    const stagingDir = path.join(process.cwd(), 'pending-contributions');
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d+Z$/, 'Z');
    const slug = params.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    const fileName = `${timestamp}-update-${slug}.json`;

    try {
      if (!fs.existsSync(stagingDir)) {
        fs.mkdirSync(stagingDir, { recursive: true });
      }

      const payload = {
        action: 'update',
        timestamp: new Date().toISOString(),
        title: params.title,
        filePath: params.filePath,
        content: params.content,
        version: params.version,
        category: params.category,
        description: params.description,
        contributorName: params.contributorName,
        validationResults: { passed: true, warnings },
      };

      fs.writeFileSync(
        path.join(stagingDir, fileName),
        JSON.stringify(payload, null, 2),
        'utf-8'
      );

      return {
        content: JSON.stringify(
          {
            success: true,
            mode: 'local-staging',
            message:
              'GITHUB_TOKEN not set. Update saved locally to pending-contributions/. ' +
              'An admin can batch-submit these later.',
            file: fileName,
            action: 'update',
            warnings,
          },
          null,
          2
        ),
        metadata: { tool: this.name, success: true, mode: 'local-staging' },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.errorResult([`Failed to save locally: ${msg}`]);
    }
  }

  // =====================================================================
  // Helper
  // =====================================================================

  private errorResult(errors: string[]): ToolResult {
    return {
      content: JSON.stringify({ success: false, errors }, null, 2),
      metadata: { tool: this.name, success: false },
    };
  }
}

export default UpdateDocumentationTool;
