/**
 * searchDocs.ts
 *
 * MCP tool: search_docs
 *
 * Searches the FeathersJS documentation knowledge base using semantic
 * vector similarity instead of keyword (BM25) matching.
 *
 * At search time:
 *   1. The user's query is embedded with all-MiniLM-L6-v2 (local, no API key).
 *   2. Cosine similarity is computed against every pre-embedded DocEntry.
 *   3. Results are returned sorted by descending relevance score.
 *
 * Pre-conditions:
 *   - knowledge-base/docs/*.json files must contain an `embedding` field on
 *     each entry. Run `npm run generate:embeddings` once to populate them.
 *   - Docs without an `embedding` field are skipped gracefully.
 */

import { BaseTool } from './baseTool';
import { ToolResult } from './types';
import { KnowledgeLoader } from '../knowledge';
import { DocEntry, DocVersion } from '../knowledge/types';
import { vectorSearch } from './search/vectorSearch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchVersion = DocVersion | 'all';

interface SearchDocsParams {
  query: string;
  limit: number;
  version: SearchVersion;
}

// ---------------------------------------------------------------------------
// SearchDocsTool
// ---------------------------------------------------------------------------

/**
 * Tool that searches the FeathersJS documentation knowledge base using
 * semantic vector embeddings and returns the most relevant entries.
 *
 * Name: `search_docs`
 *
 * Input:
 *   - query:   string (required)  — free-text search query
 *   - limit:   number (optional)  — max results to return (default 5, max 50)
 *   - version: string (optional)  — 'v4' | 'v5' | 'v6' | 'both' | 'all' (default 'v5')
 */
export class SearchDocsTool extends BaseTool {
  name = 'search_docs';

  description =
    'Searches the FeathersJS documentation knowledge base using semantic similarity and returns the most relevant entries.';

  inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query — can be a natural language question or keywords.',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        description: 'Maximum number of results to return (default 5).',
      },
      version: {
        type: 'string',
        enum: ['v4', 'v5', 'v6', 'both', 'all'],
        description:
          'Documentation version filter. Default is v5. Use both/all to search all versions. Use v6 for the latest Feathers v6 docs.',
      },
    },
    required: ['query'],
    additionalProperties: false,
  };

  // ── Private state ──────────────────────────────────────────────────────────

  /** Cached docs per version filter to avoid re-reading the filesystem. */
  private docCache: Map<SearchVersion, DocEntry[]> = new Map();

  private loader: KnowledgeLoader;

  constructor(loader?: KnowledgeLoader) {
    super();
    this.loader = loader ?? new KnowledgeLoader();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async execute(params: unknown): Promise<ToolResult> {
    const { query, limit, version } = this.normalizeParams(params);

    // Empty query — return empty results immediately without hitting the model
    if (!query) {
      return this.buildResult(query, [], version);
    }

    // Load and filter docs for the requested version
    const docs = await this.getDocsForVersion(version);

    if (docs.length === 0) {
      return this.buildResult(query, [], version);
    }

    // Run semantic search
    const hits = await vectorSearch.search(query, docs, limit);

    // Map search results back to full DocEntry data + snippet
    const results = hits
      .map((hit) => {
        const doc = docs.find((d) => d.id === hit.id);
        if (!doc) return null;

        return {
          id: doc.id,
          title: doc.title,
          version: doc.version,
          category: doc.category,
          source: doc.source,
          score: hit.score,
          snippet: this.buildSnippet(doc),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return this.buildResult(query, results, version);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Validate and normalise raw incoming parameters.
   */
  private normalizeParams(params: unknown): SearchDocsParams {
    const obj = (params ?? {}) as Record<string, unknown>;

    const query = typeof obj['query'] === 'string' ? obj['query'].trim() : '';

    const limit =
      typeof obj['limit'] === 'number' && Number.isFinite(obj['limit']) && obj['limit'] > 0
        ? Math.min(Math.floor(obj['limit'] as number), 50)
        : 5;

    let version: SearchVersion = 'v5';
    if (typeof obj['version'] === 'string') {
      const v = obj['version'] as SearchVersion;
      if (v === 'v4' || v === 'v5' || v === 'v6' || v === 'both' || v === 'all') {
        version = v;
      }
    }

    return { query, limit, version };
  }

  /**
   * Load all docs for a given version filter, using an in-memory cache
   * so the filesystem is only read once per version per process lifetime.
   */
  private async getDocsForVersion(version: SearchVersion): Promise<DocEntry[]> {
    if (this.docCache.has(version)) {
      return this.docCache.get(version)!;
    }

    const allDocs = (await this.loader.load<DocEntry>('docs')) ?? [];
    const filtered = allDocs.filter((doc) => this.matchesVersion(doc.version, version));

    this.docCache.set(version, filtered);
    return filtered;
  }

  /**
   * Determine whether a doc's version matches the requested filter.
   */
  private matchesVersion(docVersion: DocVersion, filter: SearchVersion): boolean {
    if (filter === 'all' || filter === 'both') return true;
    if (docVersion === 'both') return true;
    return docVersion === filter;
  }

  /**
   * Return the human-readable label for a version filter, used in result metadata.
   */
  private versionLabel(version: SearchVersion): string {
    switch (version) {
      case 'v4':
        return 'FeathersJS v4';
      case 'v5':
        return 'FeathersJS v5';
      case 'v6':
        return 'FeathersJS v6';
      case 'both':
      case 'all':
        return 'All versions';
    }
  }

  /**
   * Build a short human-readable excerpt from a doc's content.
   *
   * With semantic search the query terms may not literally appear in the
   * text, so we simply return the opening of the content — which is almost
   * always the most informative part of a documentation entry.
   *
   * Markdown headings and blank lines at the very start are stripped so the
   * snippet starts with real prose.
   */
  private buildSnippet(doc: DocEntry, maxLength = 400): string {
    let content = (doc.content ?? '').trim();

    if (!content) return '';

    // Strip leading Markdown heading lines (lines starting with #)
    const lines = content.split('\n');
    let firstContentLine = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#') || line.length === 0) {
        firstContentLine = i + 1;
      } else {
        break;
      }
    }
    content = lines.slice(firstContentLine).join('\n').trim();

    if (content.length <= maxLength) return content;

    // Trim to maxLength, breaking on a word boundary
    const cut = content.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > maxLength * 0.8 ? cut.slice(0, lastSpace) : cut) + '…';
  }

  /**
   * Construct the ToolResult payload returned to the MCP caller.
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
      metadata: {
        tool: 'search_docs',
        query,
        version,
        count: results.length,
        results,
      },
    };
  }
}

export default SearchDocsTool;
