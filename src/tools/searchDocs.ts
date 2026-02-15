import { BaseTool } from './baseTool';
import { ToolResult } from './types';
import { KnowledgeLoader } from '../knowledge';
import { DocEntry, DocVersion } from '../knowledge/types';
import { BM25 } from './search/bm25';
import { tokenize } from './search/tokenizer';

type SearchVersion = DocVersion | 'all';

interface SearchDocsParams {
  query: string;
  limit?: number;
  version?: SearchVersion;
}

/**
 * Tool that searches the documentation knowledge base using BM25 ranking.
 *
 * Name: `search_docs`
 *
 * Input:
 *   - query: string (required) – search query text
 *   - limit: number (optional) – max number of results (default 10)
 *   - version: 'v4' | 'v5' | 'both' | 'all' (optional, default 'v5')
 *
 * Behavior:
 *   - Loads documentation entries from the knowledge base
 *   - Filters docs by requested version (default v5)
 *   - Uses BM25 over tokenized doc content/title to rank relevance
 *   - Returns top N results with snippets and metadata
 */
export class SearchDocsTool extends BaseTool {
  name = 'search_docs';

  description =
    'Searches the FeathersJS documentation knowledge base and returns the most relevant entries.';

  inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query string.',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        description: 'Maximum number of results to return (default 10).',
      },
      version: {
        type: 'string',
        enum: ['v4', 'v5', 'both', 'all'],
        description:
          'Documentation version filter. Default is v5. Use both/all to search all versions.',
      },
    },
    required: ['query'],
    additionalProperties: false,
  };

  private loader: KnowledgeLoader;
  private bm25: BM25;
  private indexedVersion: SearchVersion | null = null;
  private indexedDocs: DocEntry[] = [];

  constructor(loader?: KnowledgeLoader) {
    super();
    this.loader = loader ?? new KnowledgeLoader();
    this.bm25 = new BM25();
  }

  /**
   * Execute the search_docs tool.
   */
  async execute(params: unknown): Promise<ToolResult> {
    const { query, limit, version } = this.normalizeParams(params);

    const effectiveVersion: SearchVersion = version ?? 'v5';

    // Ensure docs for the requested version are indexed.
    await this.ensureIndexed(effectiveVersion);

    if (!query || this.indexedDocs.length === 0) {
      return this.buildResult(query, [], effectiveVersion);
    }

    const results = this.bm25.search(query, limit);

    const rankedDocs = results
      .map((r) => {
        const doc = this.indexedDocs.find((d) => d.id === r.id);
        if (!doc) return null;
        return {
          id: doc.id,
          title: doc.title,
          version: doc.version,
          category: doc.category,
          source: doc.source,
          score: r.score,
          snippet: this.buildSnippet(doc, query),
        };
      })
      .filter((d): d is NonNullable<typeof d> => Boolean(d));

    return this.buildResult(query, rankedDocs, effectiveVersion);
  }

  /**
   * Normalize and validate incoming parameters.
   */
  private normalizeParams(params: unknown): SearchDocsParams {
    const obj = (params ?? {}) as Partial<SearchDocsParams>;

    const query = typeof obj.query === 'string' ? obj.query.trim() : '';
    const limit =
      typeof obj.limit === 'number' && Number.isFinite(obj.limit) && obj.limit > 0
        ? Math.min(Math.floor(obj.limit), 50)
        : 10;

    let version: SearchVersion | undefined;
    if (typeof obj.version === 'string') {
      const v = obj.version as SearchVersion;
      if (v === 'v4' || v === 'v5' || v === 'both' || v === 'all') {
        version = v;
      }
    }

    return { query, limit, version };
  }

  /**
   * Ensure that documentation for the given version filter is indexed into BM25.
   * If the requested version differs from the current index, reload and reindex.
   */
  private async ensureIndexed(version: SearchVersion): Promise<void> {
    if (this.indexedVersion === version && this.indexedDocs.length > 0) {
      return;
    }

    // Load all docs from the knowledge base.
    const allDocs = (await this.loader.load<DocEntry>('docs')) || [];

    const filteredDocs = allDocs.filter((doc) => this.matchesVersion(doc.version, version));

    this.indexedDocs = filteredDocs;
    this.indexedVersion = version;

    // Build BM25 index, using existing tokens if present, or deriving tokens from title+content.
    const corpus = filteredDocs.map((doc) => {
      const combinedText = [doc.title || '', doc.content || ''].join(' ');
      const tokens =
        Array.isArray(doc.tokens) && doc.tokens.length > 0 ? doc.tokens : tokenize(combinedText);

      return {
        id: doc.id,
        tokens,
      };
    });

    this.bm25.index(corpus);
  }

  /**
   * Version-matching logic for doc entries.
   */
  private matchesVersion(docVersion: DocVersion, filter: SearchVersion): boolean {
    if (filter === 'all' || filter === 'both') {
      return true;
    }
    if (docVersion === 'both') {
      return true;
    }
    return docVersion === filter;
  }

  /**
   * Build a short snippet from the document content around the first query term,
   * or fall back to the start of the content.
   */
  private buildSnippet(doc: DocEntry, query: string, maxLength = 400): string {
    const content = String(doc.content || '');
    if (!content) return '';

    const qTokens = tokenize(query);
    if (qTokens.length === 0) {
      return content.slice(0, maxLength);
    }

    const firstToken = qTokens[0];
    const lower = content.toLowerCase();
    const idx = lower.indexOf(firstToken.toLowerCase());

    if (idx < 0) {
      return content.slice(0, maxLength);
    }

    const start = Math.max(0, idx - Math.floor(maxLength / 4));
    const snippet = content.slice(start, start + maxLength);

    return (start > 0 ? '…' : '') + snippet + (start + maxLength < content.length ? '…' : '');
  }

  /**
   * Construct the ToolResult including structured metadata.
   */
  private buildResult(
    query: string,
    results: Array<{
      id: string;
      title: string;
      version: DocVersion;
      category: string;
      source?: { url?: string; path?: string };
      score: number;
      snippet: string;
    }>,
    version: SearchVersion
  ): ToolResult {
    const metadata = {
      tool: 'search_docs',
      query,
      version,
      count: results.length,
      results,
    };

    return {
      content: JSON.stringify(
        {
          query,
          version,
          results,
        },
        null,
        2
      ),
      metadata,
    };
  }
}

export default SearchDocsTool;
