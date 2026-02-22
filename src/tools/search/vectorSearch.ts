/**
 * vectorSearch.ts
 *
 * Semantic search engine for the FeathersJS MCP knowledge base.
 *
 * Replaces BM25 entirely. Uses a locally-running sentence-transformer model
 * (all-MiniLM-L6-v2 via @xenova/transformers) to embed the user's query at
 * search time, then ranks every pre-embedded DocEntry by cosine similarity.
 *
 * Key design decisions:
 *   - The embedding model is loaded lazily on the first search call and then
 *     kept in memory for the lifetime of the process. Subsequent calls are
 *     fast (~40-80 ms for the embed step; similarity is sub-millisecond).
 *   - Embeddings in the knowledge-base JSON files are pre-computed by the
 *     `npm run generate:embeddings` script. The server never trains or fine-
 *     tunes anything at runtime.
 *   - Docs that have no `embedding` field are skipped gracefully so that a
 *     partially-migrated knowledge base still works.
 *   - Because the embeddings are L2-normalised (normalize: true in the script),
 *     cosine similarity reduces to a plain dot product, which is cheaper to
 *     compute.
 */

import { DocEntry } from '../../knowledge/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VectorSearchResult {
  id: string;
  score: number; // cosine similarity in [0, 1], higher = more relevant
}

// ---------------------------------------------------------------------------
// Module-level model cache
// ---------------------------------------------------------------------------

/** Cached pipeline function — initialised once, reused on every search. */
let cachedEmbedder: ((text: string, opts: object) => Promise<{ data: Float32Array }>) | null = null;
let initPromise: Promise<void> | null = null;

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

// ---------------------------------------------------------------------------
// VectorSearch
// ---------------------------------------------------------------------------

export class VectorSearch {
  /**
   * Ensure the embedding model is loaded exactly once, even if multiple
   * concurrent calls arrive before the model is ready.
   */
  private async ensureModel(): Promise<void> {
    if (cachedEmbedder !== null) return;

    if (initPromise !== null) {
      // Another call is already initialising — wait for it
      await initPromise;
      return;
    }

    initPromise = (async () => {
      try {
        // Dynamic import keeps CommonJS compatibility while consuming the
        // ESM @xenova/transformers package.
        const { pipeline } = await import('@xenova/transformers');

        cachedEmbedder = (await pipeline('feature-extraction', MODEL_NAME, {
          progress_callback: undefined, // suppress download progress bars
        })) as (text: string, opts: object) => Promise<{ data: Float32Array }>;

        console.error(`[VectorSearch] Model "${MODEL_NAME}" loaded.`);
      } catch (err) {
        // Reset so the next call can try again
        initPromise = null;
        throw new Error(
          `[VectorSearch] Failed to load embedding model "${MODEL_NAME}": ${String(err)}`
        );
      }
    })();

    await initPromise;
  }

  /**
   * Embed a single query string into a normalised 384-dimensional vector.
   *
   * @param query  Raw query text from the user.
   * @returns      Float32Array of length 384.
   */
  private async embedQuery(query: string): Promise<Float32Array> {
    await this.ensureModel();

    if (!cachedEmbedder) {
      throw new Error('[VectorSearch] Embedder is not available after initialisation.');
    }

    const output = await cachedEmbedder(query.trim(), {
      pooling: 'mean',
      normalize: true, // must match the setting used at generation time
    });

    return output.data as Float32Array;
  }

  /**
   * Compute the cosine similarity between two vectors.
   *
   * Because both vectors are L2-normalised (||v|| = 1), this is equivalent
   * to a plain dot product and avoids the expensive square-root divisions.
   *
   * @param a  Query embedding (Float32Array, length 384).
   * @param b  Document embedding (number[], length 384).
   * @returns  Similarity score in the range [-1, 1].  In practice, with
   *           normalised sentence embeddings, scores land in [0, 1].
   */
  private dotProduct(a: Float32Array, b: number[]): number {
    if (a.length !== b.length) return 0;

    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }

  /**
   * Normalise an array of raw scores so that the top result has a score of
   * exactly 1.0 and all others are expressed as fractions of that maximum.
   * This mirrors the behaviour of the previous BM25 implementation so that
   * callers do not need to change how they interpret scores.
   *
   * If every score is zero (no matches at all), the array is returned as-is.
   */
  private normaliseScores(results: VectorSearchResult[]): VectorSearchResult[] {
    if (results.length === 0) return results;

    const max = results[0].score; // already sorted descending
    if (max <= 0) return results;

    return results.map((r) => ({
      id: r.id,
      score: Math.round((r.score / max) * 1_000_000) / 1_000_000,
    }));
  }

  /**
   * Search a collection of DocEntry objects using semantic similarity.
   *
   * Steps:
   *   1. Embed the query with the same model used to pre-compute doc embeddings.
   *   2. Compute dot-product similarity between the query vector and each doc's
   *      pre-stored embedding.
   *   3. Filter out docs with no embedding and those below `minScore`.
   *   4. Sort descending by score, take the top `limit`, then normalise.
   *
   * @param query     User's free-text query.
   * @param docs      Candidate documents (filtered by version before this call).
   * @param limit     Maximum number of results to return (default 10).
   * @param minScore  Minimum raw cosine similarity to include (default 0.15).
   *                  Raise this to get only high-confidence matches; lower it
   *                  to broaden results for sparse knowledge bases.
   * @returns         Array of { id, score } sorted by descending score, with
   *                  scores normalised to [0, 1] relative to the top result.
   */
  async search(
    query: string,
    docs: DocEntry[],
    limit = 10,
    minScore = 0.05
  ): Promise<VectorSearchResult[]> {
    if (!query || query.trim().length === 0) return [];
    if (docs.length === 0) return [];

    // Embed the query
    const queryVec = await this.embedQuery(query);

    // Score every doc that has a pre-computed embedding
    const scored: VectorSearchResult[] = [];

    for (const doc of docs) {
      if (!Array.isArray(doc.embedding) || doc.embedding.length === 0) {
        // Skip docs that have not been embedded yet
        continue;
      }

      const score = this.dotProduct(queryVec, doc.embedding);

      if (score >= minScore) {
        scored.push({ id: doc.id, score });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    // Take the top N and normalise so the best result = 1.0
    const topN = scored.slice(0, limit);
    return this.normaliseScores(topN);
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/**
 * Shared VectorSearch instance — keeps the model loaded in memory across
 * all calls within a single server process.
 */
export const vectorSearch = new VectorSearch();
