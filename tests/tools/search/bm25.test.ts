/// <reference types="jest" />

import { VectorSearch } from '../../../src/tools/search/vectorSearch';
import { DocEntry } from '../../../src/knowledge/types';

jest.mock('@xenova/transformers', () => {
  function hashVector(text: string): Float32Array {
    const dim = 64;
    const vec = new Float32Array(dim);
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    const used = new Set<number>();

    for (const word of words) {
      let h = 0;
      for (let i = 0; i < word.length; i++) {
        h = (h * 31 + word.charCodeAt(i)) >>> 0;
      }
      const idx = h % dim;
      used.add(idx);
      vec[idx] = 1;
    }

    const norm = Math.sqrt(used.size || 1);
    for (const idx of used) {
      vec[idx] = vec[idx] / norm;
    }

    return vec;
  }

  return {
    pipeline: jest
      .fn()
      .mockResolvedValue(jest.fn(async (text: string) => ({ data: hashVector(text) }))),
  };
});

function hashVectorArray(text: string): number[] {
  const dim = 64;
  const vec = new Array<number>(dim).fill(0);
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const used = new Set<number>();
  for (const word of words) {
    let h = 0;
    for (let i = 0; i < word.length; i++) {
      h = (h * 31 + word.charCodeAt(i)) >>> 0;
    }
    const idx = h % dim;
    used.add(idx);
    vec[idx] = 1;
  }
  const norm = Math.sqrt(used.size || 1);
  for (const idx of used) {
    vec[idx] = vec[idx] / norm;
  }
  return vec;
}

function doc(id: string, heading: string, rawContent: string, embeddingText: string): DocEntry {
  const embedding = hashVectorArray(embeddingText);

  return {
    id,
    heading,
    content: `Context: ${heading}\n\n${rawContent}`,
    rawContent,
    breadcrumb: heading,
    version: 'v6',
    tokens: rawContent.split(/\s+/).length,
    category: 'guides',
    sourceFile: 'docs/v6_docs/guides/index.md',
    hasCode: false,
    codeLanguages: [],
    embedding,
  };
}

describe('VectorSearch (replaces BM25)', () => {
  let search: VectorSearch;

  beforeEach(() => {
    search = new VectorSearch();
  });

  test('returns empty array for empty queries', async () => {
    const results = await search.search('', []);
    expect(results).toEqual([]);
  });

  test('ranks semantically overlapping docs first', async () => {
    const docs = [
      doc('services', 'Services', 'Service methods find create patch', 'service methods create'),
      doc('hooks', 'Hooks', 'Hooks run before and after methods', 'hooks before after'),
      doc('auth', 'Authentication', 'JWT authentication for users', 'jwt authentication'),
    ];

    const results = await search.search('create service', docs, 3, 0.01);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('services');
  });

  test('respects result limit', async () => {
    const docs = Array.from({ length: 8 }, (_, i) =>
      doc(`d-${i}`, `Doc ${i}`, `feathers topic ${i}`, `feathers topic ${i}`)
    );

    const results = await search.search('feathers topic', docs, 3, 0.01);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  test('normalizes top score to 1 when matches exist', async () => {
    const docs = [
      doc('a', 'A', 'service create', 'service create'),
      doc('b', 'B', 'service', 'service'),
    ];

    const results = await search.search('service create', docs, 5, 0.01);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBe(1);
    results.forEach((result) => {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  test('skips documents without embeddings', async () => {
    const withNoEmbedding: DocEntry = {
      id: 'missing',
      heading: 'Missing',
      content: 'Context: Missing\n\nNo embedding',
      rawContent: 'No embedding',
      breadcrumb: 'Missing',
      version: 'v6',
      tokens: 2,
      category: 'guides',
      sourceFile: 'docs/v6_docs/guides/index.md',
      hasCode: false,
      codeLanguages: [],
    };

    const results = await search.search('missing', [withNoEmbedding], 5, 0.01);
    expect(results).toEqual([]);
  });
});
