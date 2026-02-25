/**
 * vectorSearch.ts
 *
 * Dense semantic search for the FeathersJS MCP knowledge base using BGE-M3.
 *
 * BGE-M3 (Xenova/bge-m3) is used at BOTH embedding generation time
 * (scripts/generate-embeddings.ts) and at query time here — they MUST stay
 * in sync.  Key settings:
 *   - Pooling : CLS  (not mean — BGE-M3 requirement)
 *   - Dims    : 1024
 *   - Window  : 8192 tokens
 *   - Norm    : L2-normalised → cosine similarity = dot product
 *
 * The model is loaded lazily on the first call and kept resident for the
 * lifetime of the process (~40-80 ms per query after warm-up).
 * Pre-computed embeddings live in the knowledge-base JSON chunk files.
 * Docs without an `embedding` field are skipped gracefully.
 */

import { DocEntry } from '../../knowledge/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VectorSearchResult {
  id: string;
  score: number; // normalised cosine similarity in [0, 1], higher = more relevant
}

// ---------------------------------------------------------------------------
// Module-level model cache
// ---------------------------------------------------------------------------

let cachedEmbedder: ((text: string, opts: object) => Promise<{ data: Float32Array }>) | null = null;
let initPromise: Promise<void> | null = null;

/**
 * BGE-M3 — must match scripts/generate-embeddings.ts exactly.
 * First run downloads ~568 MB (int8 quantised) and caches locally.
 */
const MODEL_NAME = 'Xenova/bge-m3';

// ---------------------------------------------------------------------------
// VectorSearch
// ---------------------------------------------------------------------------

export class VectorSearch {
  /**
   * Ensure the embedding model is loaded exactly once, even when multiple
   * concurrent calls arrive before the model is ready.
   */
  private async ensureModel(): Promise<void> {
    if (cachedEmbedder !== null) return;
    if (initPromise !== null) {
      await initPromise;
      return;
    }

    initPromise = (async () => {
      try {
        const { pipeline } = await import('@xenova/transformers');
        cachedEmbedder = (await pipeline('feature-extraction', MODEL_NAME, {
          progress_callback: undefined, // suppress download-progress bars
        })) as (text: string, opts: object) => Promise<{ data: Float32Array }>;
        console.error(`[VectorSearch] Model "${MODEL_NAME}" loaded (1024-dim, CLS pooling).`);
      } catch (err) {
        initPromise = null;
        throw new Error(
          `[VectorSearch] Failed to load embedding model "${MODEL_NAME}": ${String(err)}`
        );
      }
    })();

    await initPromise;
  }

  /**
   * Embed a single query string into a normalised 1024-dimensional vector.
   * Uses CLS pooling — must match generate-embeddings.ts.
   */
  private async embedQuery(query: string): Promise<Float32Array> {
    await this.ensureModel();
    if (!cachedEmbedder) {
      throw new Error('[VectorSearch] Embedder is not available after initialisation.');
    }
    const output = await cachedEmbedder(query.trim(), {
      pooling: 'cls', // BGE-M3 requirement — do NOT change to 'mean'
      normalize: true, // L2-normalise; must match generate-embeddings.ts
    });
    return output.data as Float32Array;
  }

  /**
   * Dot product of two L2-normalised vectors = cosine similarity.
   *
   * @param a  Query vector      (Float32Array, length 1024)
   * @param b  Stored embedding  (number[],     length 1024)
   */
  private dotProduct(a: Float32Array, b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot;
  }

  /**
   * Normalise scores so the top result = 1.0 and the rest are fractions.
   * Returns the input unchanged if it is empty or max ≤ 0.
   */
  private normaliseScores(results: VectorSearchResult[]): VectorSearchResult[] {
    if (results.length === 0) return results;
    const max = results[0].score;
    if (max <= 0) return results;
    return results.map((r) => ({
      id: r.id,
      score: Math.round((r.score / max) * 1_000_000) / 1_000_000,
    }));
  }

  /**
   * Search docs using pure BGE-M3 dense cosine similarity (dense-only mode).
   *
   * Steps:
   *   1. Embed the query (CLS pooling, L2-normalised).
   *   2. Dot-product against every pre-stored 1024-dim embedding.
   *   3. Drop results below minScore, sort descending, take top `limit`.
   *   4. Normalise to [0, 1] relative to the top result.
   *
   * @param query     Free-text query.
   * @param docs      Version-filtered candidate documents.
   * @param limit     Max results (default 10).
   * @param minScore  Minimum cosine similarity threshold (default 0.05).
   */
  async search(
    query: string,
    docs: DocEntry[],
    limit = 10,
    minScore = 0.05
  ): Promise<VectorSearchResult[]> {
    if (!query || query.trim().length === 0) return [];
    if (docs.length === 0) return [];

    const queryVec = await this.embedQuery(query);
    const scored: VectorSearchResult[] = [];

    for (const doc of docs) {
      if (!Array.isArray(doc.embedding) || doc.embedding.length === 0) continue;
      const score = this.dotProduct(queryVec, doc.embedding);
      if (score >= minScore) scored.push({ id: doc.id, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return this.normaliseScores(scored.slice(0, limit));
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const vectorSearch = new VectorSearch();
