/**
 * submitDocumentation.ts
 *
 * MCP tool that lets external contributors submit documentation updates or
 * new docs as GitHub Pull Requests. Content is validated locally through a
 * six-stage pipeline before being sent to GitHub.
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
// Rate limiting (per-instance, resets on restart — not cross-request state)
// ---------------------------------------------------------------------------

let lastSubmissionTime = 0;
const RATE_LIMIT_MS = 60_000; // 1 submission per 60 seconds

/** Reset rate limit state (exposed for testing). */
export function _resetRateLimit(): void {
  lastSubmissionTime = 0;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubmitDocParams {
  title: string;
  filePath: string;
  content: string;
  version: 'v5' | 'v6';
  category?: string;
  description?: string;
  contributorName?: string;
}

interface DuplicationInfo {
  isUpdate: boolean;
  warning?: string;
}

// ---------------------------------------------------------------------------
// Allowed categories (from metadata.json + content-derived categories)
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
// SubmitDocumentationTool
// ---------------------------------------------------------------------------

export class SubmitDocumentationTool extends BaseTool {
  name = 'submit_documentation';

  requiresNetwork = true;

  description =
    'Submit a documentation update or new doc as a GitHub Pull Request for admin review. ' +
    'Content is validated locally (schema, path, sanitization, markdown lint, duplication check) ' +
    'then a PR is automatically created. If GITHUB_TOKEN is not set, the submission is staged locally.';

  inputSchema: JsonSchema = {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        minLength: 10,
        maxLength: 120,
        description: 'PR title describing the documentation change.',
      },
      filePath: {
        type: 'string',
        pattern: '^docs/(v5_docs|v6_docs)/[a-zA-Z0-9_][a-zA-Z0-9_/.-]*\\.md$',
        description:
          'Target file path within the repo (e.g., "docs/v6_docs/cookbook/koa-middleware.md").',
      },
      content: {
        type: 'string',
        minLength: 100,
        maxLength: 50000,
        description: 'Full markdown content for the documentation file.',
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
        description: 'Optional PR body text explaining the change.',
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

    const p = params as SubmitDocParams;
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

    // ── Stage 5: Duplication detection ───────────────────────────────────
    const dupeInfo = await this.checkDuplication(p.filePath, p.content);

    // ── Stage 6: Rate limit ──────────────────────────────────────────────
    const now = Date.now();
    if (now - lastSubmissionTime < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - (now - lastSubmissionTime)) / 1000);
      return this.errorResult([`Rate limited. Please try again in ${waitSec} seconds.`]);
    }

    // ── Dispatch: GitHub PR ───────────────────────────────────────────────
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return this.errorResult([
        'GitHub token not configured. Run: npx feathersjs-mcp-server@latest init to set up network tools.',
      ]);
    }

    // Defense-in-depth: G1.5 gate also enforced inside the tool so it fires
    // even when McpServer calls execute() directly (bypassing the Router).
    if (process.env.ALLOW_NETWORK_TOOLS !== 'true') {
      return this.errorResult([
        'Network access not enabled. Set ALLOW_NETWORK_TOOLS=true to enable GitHub PR submissions.',
      ]);
    }

    // Mark the submission time BEFORE making the API call
    lastSubmissionTime = now;

    const result = await this.githubClient.createDocsPR({
      token,
      owner: process.env.GITHUB_OWNER || 'TeaBreeze00',
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

    if (result.success) {
      return {
        content: JSON.stringify(
          {
            success: true,
            message: 'Documentation PR created successfully.',
            prUrl: result.prUrl,
            prNumber: result.prNumber,
            branch: result.branch,
            isUpdate: dupeInfo.isUpdate,
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
   * Stage 2: Four-layer path validation.
   */
  validatePath(filePath: string, version: string): string[] {
    const errors: string[] = [];

    // Layer 1: regex allowlist
    if (!ALLOWED_PATH_PATTERN.test(filePath)) {
      errors.push('filePath must match pattern docs/(v5_docs|v6_docs)/.../*.md');
    }

    // Layer 2: normalized path must equal original (rejects ".." and ".")
    const normalized = path.posix.normalize(filePath);
    if (normalized !== filePath) {
      errors.push('filePath contains disallowed path segments (e.g., ".." or ".").');
    }

    // Layer 3: explicit dangerous-character checks
    if (filePath.includes('\0')) errors.push('filePath contains null bytes.');
    if (filePath.includes('\\')) errors.push('filePath contains backslashes.');
    if (filePath.includes('//')) errors.push('filePath contains double slashes.');

    // Layer 4: version-path consistency
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
   * Stage 4: Basic markdown lint.
   */
  lintMarkdown(content: string): string[] {
    const errors: string[] = [];

    // Must contain at least one top-level heading
    const hasH1 = /^#\s+.+/m.test(content);
    if (!hasH1) {
      errors.push('Markdown must contain at least one top-level heading (# Title).');
    }

    // Must not be empty after stripping code fences
    const stripped = content.replace(/```[\s\S]*?```/g, '').trim();
    if (stripped.length < 50) {
      errors.push(
        'Markdown content is too short after removing code blocks (min 50 chars of prose).'
      );
    }

    return errors;
  }

  /**
   * Stage 5: Check if the file already exists in the knowledge base.
   */
  async checkDuplication(filePath: string, _content: string): Promise<DuplicationInfo> {
    try {
      const token = process.env.GITHUB_TOKEN;
      if (!token) return { isUpdate: false };
      const owner = process.env.GITHUB_OWNER || 'TeaBreeze00';
      const repo = process.env.GITHUB_REPO || 'cspc319_feathersJS_C';

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=main`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      if (response.ok) {
        return {
          isUpdate: true,
          warning: `File "${filePath}" already exists in the repository. This PR will update it.`,
        };
      }

      return { isUpdate: false };
    } catch {
      return { isUpdate: false };
    }
  }

  // =====================================================================
  // Offline fallback: local staging
  // =====================================================================

  /**
   * Save the submission to pending-contributions/ when GITHUB_TOKEN is absent.
   */
  private stageLocally(
    params: SubmitDocParams,
    dupeInfo: DuplicationInfo,
    warnings: string[]
  ): ToolResult {
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
    const fileName = `${timestamp}-${slug}.json`;

    try {
      if (!fs.existsSync(stagingDir)) {
        fs.mkdirSync(stagingDir, { recursive: true });
      }

      const payload = {
        timestamp: new Date().toISOString(),
        title: params.title,
        filePath: params.filePath,
        content: params.content,
        version: params.version,
        category: params.category,
        description: params.description,
        contributorName: params.contributorName,
        isUpdate: dupeInfo.isUpdate,
        duplicateWarning: dupeInfo.warning,
        validationResults: { passed: true, warnings },
      };

      fs.writeFileSync(path.join(stagingDir, fileName), JSON.stringify(payload, null, 2), 'utf-8');

      return {
        content: JSON.stringify(
          {
            success: true,
            mode: 'local-staging',
            message:
              'GITHUB_TOKEN not set. Submission saved locally to pending-contributions/. ' +
              'An admin can batch-submit these later.',
            file: fileName,
            isUpdate: dupeInfo.isUpdate,
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

export default SubmitDocumentationTool;
