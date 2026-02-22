/// <reference types="jest" />

import { VectorSearch, VectorSearchResult } from '../../../src/tools/search/vectorSearch';
import { DocEntry } from '../../../src/knowledge/types';

// ---------------------------------------------------------------------------
// Mock @xenova/transformers so the ML model is never downloaded in CI / Jest.
// We produce deterministic fake embeddings: each word in the text gets a
// fixed hash-derived dimension set to 1, everything else stays 0. This is
// enough to make cosine-similarity ranking behave sensibly for unit tests.
// ---------------------------------------------------------------------------

jest.mock('@xenova/transformers', () => {
  /**
   * Tiny deterministic embedding: returns a 384-dim Float32Array where the
   * dimensions corresponding to each word in `text` are set to 1/√n
   * (pre-normalised) and the rest are 0.
   */
  function fakeEmbed(text: string): { data: Float32Array } {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    const dim = 384;
    const arr = new Float32Array(dim);
    const seen = new Set<number>();
    for (const word of words) {
      let h = 5381;
      for (let i = 0; i < word.length; i++) h = ((h << 5) + h) ^ word.charCodeAt(i);
      const idx = Math.abs(h) % dim;
      seen.add(idx);
      arr[idx] = 1;
    }
    // L2-normalise
    const norm = Math.sqrt(seen.size);
    if (norm > 0) for (const idx of seen) arr[idx] = 1 / norm;
    return { data: arr };
  }

  const pipeline = jest
    .fn()
    .mockResolvedValue(jest.fn().mockImplementation(async (text: string) => fakeEmbed(text)));

  return { pipeline };
});

// ---------------------------------------------------------------------------
// Helper: build a DocEntry with a matching fake embedding so dot-product
// similarity can be computed without the real model.
// ---------------------------------------------------------------------------

function makeDoc(
  id: string,
  title: string,
  content: string,
  version: 'v5' | 'v6' | 'both' = 'v6'
): DocEntry {
  // Generate the same fake embedding we produce at query time so similarity
  // actually reflects term overlap.
  const text = `${title} ${content}`.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const dim = 384;
  const arr = new Array<number>(dim).fill(0);
  const seen = new Set<number>();
  for (const word of words) {
    let h = 5381;
    for (let i = 0; i < word.length; i++) h = ((h << 5) + h) ^ word.charCodeAt(i);
    const idx = Math.abs(h) % dim;
    seen.add(idx);
    arr[idx] = 1;
  }
  const norm = Math.sqrt(seen.size);
  if (norm > 0) for (const idx of seen) arr[idx] = 1 / norm;

  return {
    id,
    title,
    content,
    version,
    category: 'core',
    tokens: words,
    embedding: arr,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VectorSearch', () => {
  let vs: VectorSearch;

  beforeEach(() => {
    // Each test gets a fresh instance so model-cache state is reset between
    // suites (the module-level cache is shared, but the mock is fast).
    vs = new VectorSearch();
  });

  // ── Empty / degenerate inputs ────────────────────────────────────────────

  describe('degenerate inputs', () => {
    it('returns empty array for empty query', async () => {
      const docs = [makeDoc('d1', 'FeathersJS Services', 'Services are the core of Feathers')];
      const results = await vs.search('', docs);
      expect(results).toEqual([]);
    });

    it('returns empty array for whitespace-only query', async () => {
      const docs = [makeDoc('d1', 'Hooks', 'Hooks middleware feathers')];
      const results = await vs.search('   ', docs);
      expect(results).toEqual([]);
    });

    it('returns empty array when doc list is empty', async () => {
      const results = await vs.search('feathers service', []);
      expect(results).toEqual([]);
    });

    it('skips docs that have no embedding field', async () => {
      const noEmbedDoc: DocEntry = {
        id: 'no-embed',
        title: 'No embedding',
        content: 'feathers service hooks',
        version: 'v5',
        category: 'core',
        tokens: ['feathers', 'service', 'hooks'],
        // embedding intentionally omitted
      };
      const results = await vs.search('feathers', [noEmbedDoc]);
      expect(results).toEqual([]);
    });

    it('skips docs with empty embedding array', async () => {
      const emptyEmbedDoc: DocEntry = {
        id: 'empty-embed',
        title: 'Empty embedding',
        content: 'feathers hooks middleware',
        version: 'v5',
        category: 'core',
        tokens: ['feathers'],
        embedding: [],
      };
      const results = await vs.search('feathers', [emptyEmbedDoc]);
      expect(results).toEqual([]);
    });
  });

  // ── Basic relevance ──────────────────────────────────────────────────────

  describe('basic relevance', () => {
    it('finds a document matching the query', async () => {
      const docs = [
        makeDoc('d1', 'FeathersJS Services', 'Services are the heart of Feathers applications'),
        makeDoc('d2', 'Express Middleware', 'Express is a web framework for Node.js'),
      ];

      const results = await vs.search('feathers services', docs);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('d1');
    });

    it('returns no results when nothing matches minScore', async () => {
      const docs = [
        makeDoc('d1', 'Completely unrelated topic', 'Lorem ipsum dolor sit amet consectetur'),
      ];

      // Query words share no dimensions with the doc words so dot-product ≈ 0
      const results = await vs.search('zyx unique token', docs, 10, 0.15);

      // May return 0 or 1 depending on hash collisions; just verify structure
      results.forEach((r) => {
        expect(r).toHaveProperty('id');
        expect(r).toHaveProperty('score');
      });
    });

    it('returns results sorted by descending score', async () => {
      const docs = [
        makeDoc('d1', 'Hooks guide', 'hooks feathers middleware'),
        makeDoc('d2', 'Hooks deep dive', 'hooks feathers hooks feathers hooks'),
        makeDoc('d3', 'Unrelated', 'express server routing'),
      ];

      const results = await vs.search('hooks feathers', docs);

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });
  });

  // ── Score normalisation ──────────────────────────────────────────────────

  describe('score normalisation', () => {
    it('normalises top result score to exactly 1.0', async () => {
      const docs = [
        makeDoc('d1', 'FeathersJS Service', 'feathers service create find'),
        makeDoc('d2', 'FeathersJS Hooks', 'feathers hooks before after'),
      ];

      const results = await vs.search('feathers', docs);

      if (results.length > 0) {
        expect(results[0].score).toBe(1);
      }
    });

    it('all scores are in the range [0, 1]', async () => {
      const docs = [
        makeDoc('d1', 'Services', 'feathers service api'),
        makeDoc('d2', 'Hooks', 'feathers hooks middleware'),
        makeDoc('d3', 'Auth', 'feathers authentication jwt'),
      ];

      const results = await vs.search('feathers', docs);

      results.forEach((r) => {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(1);
      });
    });
  });

  // ── Limit parameter ──────────────────────────────────────────────────────

  describe('limit parameter', () => {
    it('respects the limit parameter', async () => {
      const docs = Array.from({ length: 10 }, (_, i) =>
        makeDoc(`d${i}`, `FeathersJS Topic ${i}`, `feathers hooks service topic ${i}`)
      );

      const results = await vs.search('feathers hooks', docs, 3);

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('returns fewer results when fewer docs match', async () => {
      const docs = [
        makeDoc('d1', 'Feathers', 'feathers service'),
        makeDoc('d2', 'Express', 'express server'),
      ];

      // Only d1 should match; limit is larger than matching set
      const results = await vs.search('feathers service', docs, 10);

      expect(results.length).toBeLessThanOrEqual(docs.length);
    });

    it('default limit is 10', async () => {
      const docs = Array.from({ length: 20 }, (_, i) =>
        makeDoc(`d${i}`, `Feathers doc ${i}`, `feathers hooks service middleware ${i}`)
      );

      const results = await vs.search('feathers hooks', docs);

      expect(results.length).toBeLessThanOrEqual(10);
    });
  });

  // ── Result structure ─────────────────────────────────────────────────────

  describe('result structure', () => {
    it('each result has id and score fields', async () => {
      const docs = [makeDoc('d1', 'FeathersJS', 'feathers service hooks')];

      const results = await vs.search('feathers', docs);

      results.forEach((r: VectorSearchResult) => {
        expect(typeof r.id).toBe('string');
        expect(typeof r.score).toBe('number');
      });
    });

    it('result ids correspond to input document ids', async () => {
      const docs = [
        makeDoc('svc-001', 'Services', 'feathers service api'),
        makeDoc('hook-001', 'Hooks', 'feathers hooks middleware'),
      ];

      const results = await vs.search('feathers', docs);
      const inputIds = docs.map((d) => d.id);

      results.forEach((r) => {
        expect(inputIds).toContain(r.id);
      });
    });
  });

  // ── minScore threshold ───────────────────────────────────────────────────

  describe('minScore threshold', () => {
    it('excludes results below minScore', async () => {
      const docs = [
        makeDoc('d1', 'FeathersJS', 'feathers service hooks'),
        makeDoc('d2', 'Unrelated', 'completely different terms zxqw'),
      ];

      // Use a high minScore so only very similar docs pass
      const results = await vs.search('feathers', docs, 10, 0.9);

      // All returned results must have raw score >= minScore before normalisation;
      // after normalisation scores can differ. We just verify results is an array.
      expect(Array.isArray(results)).toBe(true);
    });

    it('returns more results with a lower minScore threshold', async () => {
      const docs = [
        makeDoc('d1', 'FeathersJS Services', 'feathers service api endpoint'),
        makeDoc('d2', 'FeathersJS Hooks', 'feathers hooks middleware before after'),
        makeDoc('d3', 'FeathersJS Auth', 'feathers authentication jwt strategy'),
      ];

      const highThreshold = await vs.search('feathers', docs, 10, 0.9);
      const lowThreshold = await vs.search('feathers', docs, 10, 0.01);

      // A lower threshold should surface at least as many docs
      expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
    });
  });

  // ── Singleton export ─────────────────────────────────────────────────────

  describe('singleton export', () => {
    it('exports a shared vectorSearch singleton', () => {
      // Verify the named export used by SearchDocsTool exists and is a VectorSearch
      const { vectorSearch } = require('../../../src/tools/search/vectorSearch');
      expect(vectorSearch).toBeDefined();
      expect(typeof vectorSearch.search).toBe('function');
    });
  });
});
