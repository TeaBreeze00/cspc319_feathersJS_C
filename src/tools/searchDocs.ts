import { BaseTool } from './baseTool';
import { ToolResult } from './types';
import { ToolRegistration, ToolHandler, JsonSchema } from '../protocol/types';
import { KnowledgeLoader } from '../knowledge';
import { DocEntry } from '../knowledge/types';
import { vectorSearch } from './search/vectorSearch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VersionFilter = 'v5' | 'v6' | 'both' | 'all';

interface SearchDocsParams {
  query: string;
  version?: VersionFilter;
  limit?: number;
  /**
   * Optional token budget.  When provided, results are trimmed (greedily,
   * best-score first) so that the cumulative token count stays within this
   * value.  Helps callers fill a fixed context window without overflowing.
   */
  tokensBudget?: number;
}

interface SearchResult {
  id: string;
  heading: string;
  version: string;
  category: string;
  score: number;
  snippet: string;
  breadcrumb: string;
  /** All ## / ### headings inside the chunk — lets the agent see scope at a glance */
  covers: string[];
  /** Concept tags extracted from the chunk */
  tags: string[];
  /** Estimated token count (useful alongside tokensBudget) */
  tokens: number;
  /** Source markdown file — useful for grouping related results */
  sourceFile: string;
}

interface SearchResponse {
  query: string;
  version: VersionFilter;
  results: SearchResult[];
  /** Sum of tokens across all returned results */
  totalTokens: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_VERSION: VersionFilter = 'all';
const VALID_VERSIONS = new Set<VersionFilter>(['v5', 'v6', 'both', 'all']);

// ---------------------------------------------------------------------------
// SearchDocsTool
// ---------------------------------------------------------------------------

/**
 * SearchDocsTool — dense BGE-M3 semantic search over the FeathersJS knowledge base.
 *
 * Pipeline (all in-process, no external calls):
 *   1. BGE-M3 vector search  → ranked candidates by cosine similarity
 *   2. Source deduplication  → at most 2 results from the same source file
 *   3. Token-budget trim     → optional; honour a caller-supplied token budget
 *   4. Slice to `limit`      → return the top N results
 *
 * Returned JSON shape:
 * {
 *   query, version, totalTokens,
 *   results: [{ id, heading, version, category, score, snippet,
 *               breadcrumb, covers, tags, tokens, sourceFile }]
 * }
 */
export class SearchDocsTool extends BaseTool {
  name = 'search_docs';

  description =
    'Search the FeathersJS documentation using BGE-M3 dense semantic search. ' +
    'Returns the most relevant documentation chunks for a given query, ' +
    'optionally filtered by version (v5, v6, both, all) and capped by a token budget.';

  inputSchema: JsonSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query — a natural language question or keyword phrase.',
      },
      version: {
        type: 'string',
        enum: ['v5', 'v6', 'both', 'all'],
        description:
          'FeathersJS version to search (default: all). ' +
          'Use "all" or "both" to search across all versions.',
      },
      limit: {
        type: 'number',
        description: `Maximum results to return (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT}).`,
      },
      tokensBudget: {
        type: 'number',
        description:
          'Optional. Trim the result list so the cumulative chunk token count ' +
          'does not exceed this value. Useful for filling a fixed context window.',
      },
    },
    required: ['query'],
  };

  private loader: KnowledgeLoader;

  constructor(loader?: KnowledgeLoader) {
    super();
    this.loader = loader ?? new KnowledgeLoader();
  }

  // ---------------------------------------------------------------------------
  // execute
  // ---------------------------------------------------------------------------

  async execute(params: unknown): Promise<ToolResult> {
    const { query, version, limit, tokensBudget } = this.normalizeParams(params);

    if (!query) return this.buildResult(query, version, [], 0);

    // Load and version-filter docs
    const allDocs = await this.loader.load<DocEntry>('chunks');
    const filteredDocs = this.filterByVersion(allDocs, version);

    // ── Stage 1: BGE-M3 dense vector search ───────────────────────────────
    // Request up to MAX_LIMIT candidates so we have headroom for dedup + budget
    const candidates = await vectorSearch.search(query, filteredDocs, MAX_LIMIT);

    // ── Stage 2: Source deduplication — max 2 per source file ─────────────
    const docMap = new Map<string, DocEntry>(filteredDocs.map((d) => [d.id, d]));
    const seenSources = new Map<string, number>();
    const deduped: typeof candidates = [];

    for (const c of candidates) {
      const doc = docMap.get(c.id);
      const src = doc?.sourceFile ?? c.id;
      const n = seenSources.get(src) ?? 0;
      if (n < 2) {
        deduped.push(c);
        seenSources.set(src, n + 1);
      }
    }

    // ── Stage 3: Token-budget trimming ────────────────────────────────────
    let pool = deduped;
    if (tokensBudget > 0) {
      let remaining = tokensBudget;
      pool = deduped.filter((c) => {
        if (remaining <= 0) return false;
        remaining -= docMap.get(c.id)?.tokens ?? 0;
        return true;
      });
    }

    // ── Stage 4: Slice to final limit and build output ────────────────────
    const topN = pool.slice(0, limit);
    const results: SearchResult[] = [];
    let totalTokens = 0;

    for (const { id, score } of topN) {
      const doc = docMap.get(id);
      if (!doc) continue;

      totalTokens += doc.tokens ?? 0;
      results.push({
        id: doc.id,
        heading: doc.heading,
        version: doc.version as string,
        category: (doc.category as string) ?? 'uncategorized',
        score,
        snippet: doc.rawContent,
        breadcrumb: doc.breadcrumb,
        covers: doc.subHeadings ?? [],
        tags: doc.tags ?? [],
        tokens: doc.tokens ?? 0,
        sourceFile: doc.sourceFile ?? '',
      });
    }

    return this.buildResult(query, version, results, totalTokens);
  }

  // ---------------------------------------------------------------------------
  // register
  // ---------------------------------------------------------------------------

  register(): ToolRegistration {
    const handler: ToolHandler = async (params: unknown) => this.execute(params);
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      handler,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private normalizeParams(params: unknown): Required<SearchDocsParams> {
    if (params === null || params === undefined || typeof params !== 'object') {
      return { query: '', version: DEFAULT_VERSION, limit: DEFAULT_LIMIT, tokensBudget: 0 };
    }

    const obj = params as Record<string, unknown>;

    const rawQuery = typeof obj.query === 'string' ? obj.query.trim() : '';

    const rawVersion = obj.version;
    const version: VersionFilter =
      typeof rawVersion === 'string' && VALID_VERSIONS.has(rawVersion as VersionFilter)
        ? (rawVersion as VersionFilter)
        : DEFAULT_VERSION;

    let limit = DEFAULT_LIMIT;
    const rawLimit = obj.limit;
    if (typeof rawLimit === 'number' && Number.isFinite(rawLimit) && rawLimit > 0) {
      limit = Math.min(Math.floor(rawLimit), MAX_LIMIT);
    }

    let tokensBudget = 0;
    const rawBudget = obj.tokensBudget;
    if (typeof rawBudget === 'number' && Number.isFinite(rawBudget) && rawBudget > 0) {
      tokensBudget = Math.floor(rawBudget);
    }

    return { query: rawQuery, version, limit, tokensBudget };
  }

  private filterByVersion(docs: DocEntry[], version: VersionFilter): DocEntry[] {
    if (version === 'all' || version === 'both') return docs;
    return docs.filter((d) => d.version === version || d.version === 'both');
  }

  /**
   * Extract a ≤300-char snippet centred around the first query-term hit.
   * Falls back to the first 300 chars if no term is found.
   */
  private generateSnippet(content: string, query: string): string {
    if (!content) return '';
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const lower = content.toLowerCase();
    let bestIdx = -1;
    for (const w of words) {
      const idx = lower.indexOf(w);
      if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx;
    }
    const start = Math.max(0, (bestIdx === -1 ? 0 : bestIdx) - 60);
    const raw = content.slice(start, start + 300).trim();
    return start > 0 ? `\u2026${raw}` : raw;
  }

  private buildResult(
    query: string,
    version: VersionFilter,
    results: SearchResult[],
    totalTokens: number
  ): ToolResult {
    const response: SearchResponse = { query, version, results, totalTokens };
    return {
      content: JSON.stringify(response, null, 2),
      metadata: {
        tool: this.name,
        query,
        version,
        count: results.length,
        totalTokens,
      },
    };
  }
}

export default SearchDocsTool;
