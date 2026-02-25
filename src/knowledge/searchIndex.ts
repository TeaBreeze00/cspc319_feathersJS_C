/**
 * searchIndex.ts
 *
 * Compatibility stub — BM25 was replaced by BGE-M3 dense vector search.
 *
 * This class provides a minimal substring-search fallback so that:
 *   - src/knowledge/index.ts  can require('./searchIndex') without crashing
 *   - tests/knowledge/searchIndex.test.ts has a working implementation to test
 *
 * Do NOT use in production code — use VectorSearch (src/tools/search/vectorSearch.ts).
 */

import { DocEntry } from './types';

export class SearchIndex {
  private docs: DocEntry[] = [];

  /** Store entries for later search. */
  index(entries: DocEntry[]): void {
    this.docs = [...entries];
  }

  /**
   * Case-insensitive substring search over heading + rawContent.
   * Returns docs that contain at least one query term, ordered by hit count.
   *
   * @param query  Free-text query string.
   * @param limit  Max results (default 10).
   */
  search(query: string, limit = 10): DocEntry[] {
    if (!query || !query.trim()) return [];

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

    return this.docs
      .map((doc) => {
        const text = `${doc.heading ?? ''} ${doc.rawContent ?? doc.content ?? ''}`.toLowerCase();
        const hits = terms.filter((t) => text.includes(t)).length;
        return { doc, hits };
      })
      .filter(({ hits }) => hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit)
      .map(({ doc }) => doc);
  }

  /** Clear all indexed entries (used in tests). */
  clear(): void {
    this.docs = [];
  }
}

export default SearchIndex;
