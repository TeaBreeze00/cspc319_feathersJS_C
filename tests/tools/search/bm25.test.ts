/// <reference types="jest" />

import { BM25 } from '../../../src/tools/search/bm25';

describe('BM25', () => {
  let bm25: BM25;

  beforeEach(() => {
    bm25 = new BM25();
  });

  describe('IDF calculation', () => {
    it('calculates higher IDF for rare terms', () => {
      const documents = [
        { id: 'doc1', tokens: ['feathers', 'service', 'api'] },
        { id: 'doc2', tokens: ['feathers', 'hooks', 'middleware'] },
        { id: 'doc3', tokens: ['feathers', 'authentication', 'jwt'] },
        { id: 'doc4', tokens: ['express', 'server', 'api'] },
      ];

      bm25.index(documents);

      // Search for a common term vs a rare term
      const commonResults = bm25.search('feathers', 10);
      const rareResults = bm25.search('jwt', 10);

      // 'feathers' appears in 3 docs, 'jwt' appears in 1 doc
      // Documents containing rare terms should still be found
      expect(rareResults.length).toBeGreaterThan(0);
      expect(rareResults[0].id).toBe('doc3');
    });

    it('returns empty results for terms not in corpus', () => {
      const documents = [
        { id: 'doc1', tokens: ['feathers', 'service'] },
        { id: 'doc2', tokens: ['feathers', 'hooks'] },
      ];

      bm25.index(documents);

      const results = bm25.search('nonexistent', 10);
      expect(results).toEqual([]);
    });

    it('handles empty corpus gracefully', () => {
      bm25.index([]);
      const results = bm25.search('anything', 10);
      expect(results).toEqual([]);
    });

    it('handles empty query gracefully', () => {
      const documents = [
        { id: 'doc1', tokens: ['feathers', 'service'] },
      ];

      bm25.index(documents);

      const results = bm25.search('', 10);
      expect(results).toEqual([]);
    });
  });

  describe('ranking accuracy', () => {
    it('ranks documents with more query term occurrences higher', () => {
      const documents = [
        { id: 'doc1', tokens: ['feathers', 'api'] },
        { id: 'doc2', tokens: ['feathers', 'feathers', 'feathers', 'service'] },
        { id: 'doc3', tokens: ['feathers', 'feathers', 'hooks'] },
      ];

      bm25.index(documents);

      const results = bm25.search('feathers', 10);

      // doc2 has most occurrences of 'feathers', should rank highest
      expect(results[0].id).toBe('doc2');
      // doc3 has second most occurrences
      expect(results[1].id).toBe('doc3');
      // doc1 has fewest occurrences
      expect(results[2].id).toBe('doc1');
    });

    it('ranks documents matching multiple query terms higher', () => {
      const documents = [
        { id: 'doc1', tokens: ['feathers', 'service', 'create'] },
        { id: 'doc2', tokens: ['feathers', 'hooks'] },
        { id: 'doc3', tokens: ['express', 'middleware'] },
      ];

      bm25.index(documents);

      const results = bm25.search('feathers service', 10);

      // doc1 matches both 'feathers' and 'service', should rank highest
      expect(results[0].id).toBe('doc1');
      // doc2 only matches 'feathers'
      expect(results[1].id).toBe('doc2');
      // doc3 doesn't match any terms
      expect(results.find(r => r.id === 'doc3')).toBeUndefined();
    });

    it('normalizes scores to 0-1 range with top result having score 1', () => {
      const documents = [
        { id: 'doc1', tokens: ['feathers', 'service'] },
        { id: 'doc2', tokens: ['feathers', 'feathers', 'hooks'] },
        { id: 'doc3', tokens: ['feathers'] },
      ];

      bm25.index(documents);

      const results = bm25.search('feathers', 10);

      // Top result should have score of 1 (normalized)
      expect(results[0].score).toBe(1);
      // Other results should be between 0 and 1
      expect(results[1].score).toBeGreaterThan(0);
      expect(results[1].score).toBeLessThan(1);
      expect(results[2].score).toBeGreaterThan(0);
      expect(results[2].score).toBeLessThan(1);
    });

    it('respects the limit parameter', () => {
      const documents = [
        { id: 'doc1', tokens: ['feathers'] },
        { id: 'doc2', tokens: ['feathers'] },
        { id: 'doc3', tokens: ['feathers'] },
        { id: 'doc4', tokens: ['feathers'] },
        { id: 'doc5', tokens: ['feathers'] },
      ];

      bm25.index(documents);

      const results = bm25.search('feathers', 3);

      expect(results.length).toBe(3);
    });

    it('returns fewer results when corpus is smaller than limit', () => {
      const documents = [
        { id: 'doc1', tokens: ['feathers'] },
        { id: 'doc2', tokens: ['feathers'] },
      ];

      bm25.index(documents);

      const results = bm25.search('feathers', 10);

      expect(results.length).toBe(2);
    });

    it('handles re-indexing correctly', () => {
      const initialDocs = [
        { id: 'doc1', tokens: ['old', 'content'] },
      ];

      bm25.index(initialDocs);
      let results = bm25.search('old', 10);
      expect(results.length).toBe(1);

      // Re-index with new documents
      const newDocs = [
        { id: 'doc2', tokens: ['new', 'content'] },
        { id: 'doc3', tokens: ['different', 'content'] },
      ];

      bm25.index(newDocs);

      // Old documents should no longer be searchable
      results = bm25.search('old', 10);
      expect(results.length).toBe(0);

      // New documents should be searchable
      results = bm25.search('new', 10);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('doc2');
    });

    it('considers document length normalization', () => {
      // Longer documents are slightly penalized for term frequency
      const documents = [
        { id: 'short', tokens: ['feathers', 'service'] },
        { id: 'long', tokens: ['feathers', 'service', 'hooks', 'middleware', 'authentication', 'jwt', 'express', 'koa', 'database', 'mongodb'] },
      ];

      bm25.index(documents);

      const results = bm25.search('feathers service', 10);

      // Both documents match, but BM25 considers document length
      expect(results.length).toBe(2);
      // The short document should rank higher due to length normalization
      expect(results[0].id).toBe('short');
    });
  });

  describe('custom parameters', () => {
    it('allows custom k1 and b parameters', () => {
      // k1 controls term frequency saturation
      // b controls document length normalization
      const customBm25 = new BM25(2.0, 0.5);

      const documents = [
        { id: 'doc1', tokens: ['feathers', 'feathers', 'feathers'] },
        { id: 'doc2', tokens: ['feathers'] },
      ];

      customBm25.index(documents);

      const results = customBm25.search('feathers', 10);

      // Should still work with custom parameters
      expect(results.length).toBe(2);
      expect(results[0].id).toBe('doc1');
    });
  });
});
