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
}

interface SearchResult {
  id: string;
  heading: string; // was title
  version: string;
  category: string;
  score: number;
  snippet: string;
  breadcrumb: string; // replaces url + headingPath
}

interface SearchResponse {
  query: string;
  version: VersionFilter;
  results: SearchResult[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const VALID_VERSIONS = new Set<VersionFilter>(['v5', 'v6', 'both', 'all']);

// ---------------------------------------------------------------------------
// SearchDocsTool
// ---------------------------------------------------------------------------

/**
 * SearchDocsTool
 *
 * Semantic search over the FeathersJS knowledge base using vector embeddings.
 * Loads all DocEntry objects from the KnowledgeLoader, filters by version,
 * then delegates ranking to VectorSearch (cosine similarity with all-MiniLM-L6-v2).
 *
 * Returned JSON shape:
 * {
 *   query: string,
 *   version: string,
 *   results: Array<{
 *     id, title, version, category, score, snippet, url, headingPath
 *   }>
 * }
 */
export class SearchDocsTool extends BaseTool {
  name = 'search_docs';

  description =
    'Search the FeathersJS documentation using semantic vector search. ' +
    'Returns the most relevant documentation sections for a given query, ' +
    'optionally filtered by version (v4, v5, v6, both, all).';

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
          'FeathersJS version to search (default: v6). ' +
          'Use "all" or "both" to search across all versions.',
      },
      limit: {
        type: 'number',
        description: `Maximum number of results to return (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT}).`,
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
    // Safely normalize params — handle null, undefined, non-object inputs
    const normalized = this.normalizeParams(params);
    const { query, version, limit } = normalized;

    // Empty query → return empty results immediately
    if (!query) {
      return this.buildResult(query, version, []);
    }

    // Load all docs from the knowledge base
    const allDocs = await this.loader.load<DocEntry>('chunks'); // ← should be 'chunks'

    // Filter by the requested version
    const filteredDocs = this.filterByVersion(allDocs, version);

    // Delegate ranking to vector search
    const ranked = await vectorSearch.search(query, filteredDocs, limit);

    // Build the full result objects by joining ranked ids back to their DocEntry
    const docMap = new Map<string, DocEntry>(filteredDocs.map((d) => [d.id, d]));

    const results: SearchResult[] = [];
    for (const { id, score } of ranked) {
      const doc = docMap.get(id);
      if (!doc) continue;

      results.push({
        id: doc.id,
        heading: doc.heading,
        version: doc.version as string,
        category: (doc.category as string) ?? 'uncategorized',
        score,
        snippet: this.generateSnippet(doc.rawContent, query),
        breadcrumb: doc.breadcrumb,
      });
    }

    return this.buildResult(query, version, results);
  }

  // ---------------------------------------------------------------------------
  // register (MCP protocol registration)
  // ---------------------------------------------------------------------------

  register(): ToolRegistration {
    const handler: ToolHandler = async (params: unknown) => {
      return this.execute(params);
    };

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

  /**
   * Safely extract and validate params from an unknown input.
   * Returns safe defaults for every field.
   */
  private normalizeParams(params: unknown): Required<SearchDocsParams> {
    if (params === null || params === undefined || typeof params !== 'object') {
      return { query: '', version: 'v5', limit: DEFAULT_LIMIT };
    }

    const obj = params as Record<string, unknown>;

    // query — trim whitespace, default to empty string
    const rawQuery = typeof obj.query === 'string' ? obj.query.trim() : '';

    // version — validate against allowed set, fall back to 'v6'
    const rawVersion = obj.version;
    const version: VersionFilter =
      typeof rawVersion === 'string' && VALID_VERSIONS.has(rawVersion as VersionFilter)
        ? (rawVersion as VersionFilter)
        : 'v6';

    // limit — must be a positive integer, cap at MAX_LIMIT, fall back to DEFAULT_LIMIT
    const rawLimit = obj.limit;
    let limit = DEFAULT_LIMIT;
    if (typeof rawLimit === 'number' && Number.isFinite(rawLimit) && rawLimit > 0) {
      limit = Math.min(Math.floor(rawLimit), MAX_LIMIT);
    }

    return { query: rawQuery, version, limit };
  }

  /**
   * Filter docs by version.
   *
   * - 'all' / 'both' → include everything
   * - 'v5'           → include v5 + docs marked 'both'
   * - 'v6'           → include v6 + docs marked 'both'
   */
  private filterByVersion(docs: DocEntry[], version: VersionFilter): DocEntry[] {
    if (version === 'all' || version === 'both') {
      return docs;
    }

    return docs.filter((doc) => doc.version === version || doc.version === 'both');
  }

  /**
   * Extract a short snippet from content centred around the first occurrence
   * of any query word. Falls back to the start of the content.
   */
  private generateSnippet(content: string, query: string): string {
    return content ?? '';
  }

  /**
   * Build the final ToolResult with content JSON and metadata.
   */
  private buildResult(query: string, version: VersionFilter, results: SearchResult[]): ToolResult {
    const response: SearchResponse = { query, version, results };

    return {
      content: JSON.stringify(response, null, 2),
      metadata: {
        tool: this.name,
        query,
        version,
        count: results.length,
      },
    };
  }
}
export default SearchDocsTool;
