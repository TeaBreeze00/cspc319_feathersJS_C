import { tokenize } from './tokenizer';

/**
 * BM25 (Best Matching 25) ranking algorithm implementation.
 *
 * Scores documents against a query using term-frequency / inverse-document-frequency
 * weighting with document-length normalization.  Returned scores are normalized to
 * the 0–1 range.
 */
export class BM25 {
  /** Term-frequency saturation parameter (default 1.5) */
  private k1: number;

  /** Document-length normalization parameter (default 0.75) */
  private b: number;

  /** Indexed documents keyed by their id */
  private documents: Map<string, string[]> = new Map();

  /** Document frequency: number of documents containing each term */
  private df: Map<string, number> = new Map();

  /** Pre-computed IDF values for each term */
  private idf: Map<string, number> = new Map();

  /** Total number of indexed documents */
  private docCount = 0;

  /** Average document length (in tokens) across the corpus */
  private avgDl = 0;

  /** Per-document token length */
  private docLengths: Map<string, number> = new Map();

  constructor(k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
  }

  /**
   * Index an array of pre-tokenized documents.
   *
   * @param documents - Array of objects with `id` and `tokens` fields.
   */
  index(documents: { id: string; tokens: string[] }[]): void {
    // Reset state for re-indexing
    this.documents.clear();
    this.df.clear();
    this.idf.clear();
    this.docLengths.clear();
    this.docCount = 0;
    this.avgDl = 0;

    let totalLength = 0;

    for (const doc of documents) {
      this.documents.set(doc.id, doc.tokens);
      this.docLengths.set(doc.id, doc.tokens.length);
      totalLength += doc.tokens.length;

      // Track unique terms in this document for DF calculation
      const uniqueTerms = new Set(doc.tokens);
      for (const term of uniqueTerms) {
        this.df.set(term, (this.df.get(term) ?? 0) + 1);
      }
    }

    this.docCount = documents.length;
    this.avgDl = this.docCount > 0 ? totalLength / this.docCount : 0;

    // Compute IDF for every term in the corpus
    for (const [term, freq] of this.df.entries()) {
      // Standard BM25 IDF formula: ln((N - n + 0.5) / (n + 0.5) + 1)
      // The `+ 1` inside the log keeps values non-negative for very common terms.
      this.idf.set(
        term,
        Math.log(1 + (this.docCount - freq + 0.5) / (freq + 0.5)),
      );
    }
  }

  /**
   * Search the indexed corpus with a free-text query.
   *
   * The query string is tokenized with the same pipeline used for indexing.
   * Results are returned sorted by descending score, limited to `limit` entries.
   * Scores are normalized so that the top result has a score of 1 (when there
   * is at least one match).
   *
   * @param query - Free-text search query.
   * @param limit - Maximum number of results to return (default 10).
   * @returns Array of `{ id, score }` objects ordered by relevance.
   */
  search(query: string, limit = 10): { id: string; score: number }[] {
    if (this.docCount === 0) {
      return [];
    }

    const queryTokens = tokenize(query);

    if (queryTokens.length === 0) {
      return [];
    }

    const scores: { id: string; score: number }[] = [];

    for (const [docId, docTokens] of this.documents.entries()) {
      let score = 0;
      const dl = this.docLengths.get(docId) ?? 0;

      for (const qTerm of queryTokens) {
        const idfValue = this.idf.get(qTerm);
        if (idfValue === undefined) {
          // Term not in corpus — contributes nothing
          continue;
        }

        // Count term frequency of qTerm in this document
        let tf = 0;
        for (const token of docTokens) {
          if (token === qTerm) {
            tf++;
          }
        }

        if (tf === 0) {
          continue;
        }

        // BM25 scoring formula
        const numerator = tf * (this.k1 + 1);
        const denominator =
          tf + this.k1 * (1 - this.b + this.b * (dl / this.avgDl));
        score += idfValue * (numerator / denominator);
      }

      if (score > 0) {
        scores.push({ id: docId, score });
      }
    }

    // Sort descending by score
    scores.sort((a, b) => b.score - a.score);

    // Normalize scores to [0, 1] range based on the maximum score
    const maxScore = scores.length > 0 ? scores[0].score : 1;
    if (maxScore > 0) {
      for (const entry of scores) {
        entry.score = entry.score / maxScore;
      }
    }

    return scores.slice(0, limit);
  }
}
