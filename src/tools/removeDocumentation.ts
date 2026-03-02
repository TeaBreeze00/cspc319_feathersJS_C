/**
 * removeDocumentation.ts
 *
 * MCP tool that lets external contributors request removal of a documentation
 * file via a GitHub Pull Request. The document's existence is verified against
 * the knowledge base before the PR is created.
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

// ---------------------------------------------------------------------------
// Rate limiting (per-instance, resets on restart)
// ---------------------------------------------------------------------------

let lastRemovalTime = 0;
const RATE_LIMIT_MS = 60_000; // 1 removal per 60 seconds

/** Reset rate limit state (exposed for testing). */
export function _resetRateLimit(): void {
  lastRemovalTime = 0;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RemoveDocParams {
  filePath: string;
  version: 'v5' | 'v6';
  reason: string;
  contributorName?: string;
}

// ---------------------------------------------------------------------------
// Path validation regex — only docs/(v5_docs|v6_docs)/.../*.md
// ---------------------------------------------------------------------------

const ALLOWED_PATH_PATTERN = /^docs\/(v5_docs|v6_docs)\/[a-zA-Z0-9_][a-zA-Z0-9_/.\-]*\.md$/;

// ---------------------------------------------------------------------------
// RemoveDocumentationTool
// ---------------------------------------------------------------------------

export class RemoveDocumentationTool extends BaseTool {
  name = 'remove_documentation';

  requiresNetwork = true;

  description =
    'Request removal of a documentation file via a GitHub Pull Request for admin review. ' +
    'The document must exist in the knowledge base. ' +
    'If GITHUB_TOKEN is not set, the removal request is staged locally.';

  inputSchema: JsonSchema = {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        pattern: '^docs/(v5_docs|v6_docs)/[a-zA-Z0-9_][a-zA-Z0-9_/.-]*\\.md$',
        description:
          'Path of the file to remove (e.g., "docs/v6_docs/cookbook/old-guide.md").',
      },
      version: {
        type: 'string',
        enum: ['v5', 'v6'],
        description: 'FeathersJS version this doc targets (must match filePath prefix).',
      },
      reason: {
        type: 'string',
        minLength: 10,
        maxLength: 500,
        description: 'Explanation for why this document should be removed.',
      },
      contributorName: {
        type: 'string',
        maxLength: 100,
        description: 'Optional name for attribution in the PR.',
      },
    },
    required: ['filePath', 'version', 'reason'],
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
        'Invalid input: expected an object with filePath, version, reason.',
      ]);
    }

    const p = params as RemoveDocParams;
    const errors: string[] = [];

    // ── Stage 1: Schema validation (defense-in-depth) ────────────────────
    if (!p.filePath || typeof p.filePath !== 'string') {
      errors.push('filePath is required and must be a string.');
    }

    if (!p.version || !['v5', 'v6'].includes(p.version)) {
      errors.push('version must be "v5" or "v6".');
    }

    if (!p.reason || typeof p.reason !== 'string') {
      errors.push('reason is required and must be a string.');
    } else if (p.reason.length < 10 || p.reason.length > 500) {
      errors.push('reason must be between 10 and 500 characters.');
    }

    if (errors.length > 0) {
      return this.errorResult(errors);
    }

    // ── Stage 2: Path restriction & traversal prevention ─────────────────
    const pathErrors = this.validatePath(p.filePath, p.version);
    if (pathErrors.length > 0) {
      return this.errorResult(pathErrors);
    }

    // ── Stage 3: Existence check — file must exist in knowledge base ─────
    const exists = await this.checkExists(p.filePath);
    if (!exists) {
      return this.errorResult([
        `File "${p.filePath}" does not exist in the knowledge base. Nothing to remove.`,
      ]);
    }

    // ── Stage 4: Rate limit ──────────────────────────────────────────────
    const now = Date.now();
    if (now - lastRemovalTime < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - (now - lastRemovalTime)) / 1000);
      return this.errorResult([`Rate limited. Please try again in ${waitSec} seconds.`]);
    }

    // ── Dispatch: GitHub PR or local staging ─────────────────────────────
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return this.stageLocally(p);
    }

    // Defense-in-depth: G1.5 gate also enforced inside the tool
    if (process.env.ALLOW_NETWORK_TOOLS !== 'true') {
      return this.errorResult([
        'Network access not enabled. Set ALLOW_NETWORK_TOOLS=true to enable GitHub PR submissions.',
      ]);
    }

    lastRemovalTime = now;

    const result = await this.githubClient.createRemovalPR({
      token,
      owner: process.env.GITHUB_OWNER || 'owner',
      repo: process.env.GITHUB_REPO || 'cspc319_feathersJS_C',
      filePath: p.filePath,
      reason: p.reason,
      version: p.version,
      contributorName: p.contributorName,
    });

    if (result.success) {
      return {
        content: JSON.stringify(
          {
            success: true,
            message: 'Documentation removal PR created successfully.',
            prUrl: result.prUrl,
            prNumber: result.prNumber,
            branch: result.branch,
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

    // Layer 1: regex allowlist
    if (!ALLOWED_PATH_PATTERN.test(filePath)) {
      errors.push('filePath must match pattern docs/(v5_docs|v6_docs)/.../*.md');
    }

    // Layer 2: normalized path must equal original
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
   * Check if the file exists in the knowledge base.
   */
  async checkExists(filePath: string): Promise<boolean> {
    try {
      const existingDocs = await this.loader.load<DocEntry>('chunks');
      return existingDocs.some((d) => d.sourceFile === filePath);
    } catch {
      // If knowledge base can't be loaded, assume it doesn't exist
      return false;
    }
  }

  // =====================================================================
  // Offline fallback: local staging
  // =====================================================================

  private stageLocally(params: RemoveDocParams): ToolResult {
    const stagingDir = path.join(process.cwd(), 'pending-removals');
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d+Z$/, 'Z');
    const slug = params.filePath
      .split('/')
      .pop()!
      .replace(/\.md$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    const fileName = `${timestamp}-remove-${slug}.json`;

    try {
      if (!fs.existsSync(stagingDir)) {
        fs.mkdirSync(stagingDir, { recursive: true });
      }

      const payload = {
        action: 'remove',
        timestamp: new Date().toISOString(),
        filePath: params.filePath,
        version: params.version,
        reason: params.reason,
        contributorName: params.contributorName,
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
              'GITHUB_TOKEN not set. Removal request saved locally to pending-removals/. ' +
              'An admin can batch-submit these later.',
            file: fileName,
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

export default RemoveDocumentationTool;
