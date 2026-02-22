/**
 * Mock implementation of vectorSearch for testing
 *
 * This mock provides predictable behavior for unit tests without
 * loading the actual embedding model.
 */

import { DocEntry } from '../../../src/knowledge/types';

export interface VectorSearchResult {
  id: string;
  score: number;
}

/**
 * Mock VectorSearch class that simulates semantic search behavior
 * without loading the actual embedding model.
 */
export class MockVectorSearch {
  /**
   * Mock search that returns results based on simple text matching
   * to simulate vector search behavior in tests.
   */
  async search(
    query: string,
    docs: DocEntry[],
    limit = 10,
    minScore = 0.1
  ): Promise<VectorSearchResult[]> {
    if (!query || query.trim().length === 0) return [];
    if (docs.length === 0) return [];

    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(Boolean);

    // Score each document based on keyword matching
    // This is a simplified simulation of semantic similarity
    const scored = docs
      .map((doc) => {
        let score = 0;
        const searchableText = [
          doc.title,
          doc.content,
          ...(doc.tokens || []),
          ...(doc.tags || []),
        ]
          .join(' ')
          .toLowerCase();

        // Score based on query word matches
        for (const word of queryWords) {
          if (searchableText.includes(word)) {
            // Higher score for title matches
            if (doc.title.toLowerCase().includes(word)) {
              score += 0.3;
            }
            // Medium score for content matches
            if (doc.content.toLowerCase().includes(word)) {
              score += 0.1;
            }
            // Lower score for tag matches
            if (doc.tags?.some((t) => t.toLowerCase().includes(word))) {
              score += 0.05;
            }
          }
        }

        // Normalize score to be between 0 and 1
        const normalizedScore = Math.min(score, 1);

        return {
          id: doc.id,
          score: normalizedScore,
        };
      })
      .filter((result) => result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  }
}

/**
 * Singleton instance of the mock vector search
 */
export const mockVectorSearch = new MockVectorSearch();

/**
 * Create mock search results for testing
 */
export function createMockSearchResults(
  docIds: string[],
  baseScore = 0.9
): VectorSearchResult[] {
  return docIds.map((id, index) => ({
    id,
    score: Math.max(baseScore - index * 0.1, 0.1),
  }));
}

/**
 * Create a mock DocEntry for testing
 */
export function createMockDocEntry(
  overrides: Partial<DocEntry> = {}
): DocEntry {
  return {
    id: overrides.id || 'test-doc-1',
    title: overrides.title || 'Test Document',
    content: overrides.content || 'Test content for the document',
    version: (overrides.version as 'v5' | 'v6' | 'both') || 'v6',
    tokens: overrides.tokens || ['test', 'document'],
    category: overrides.category || 'test-category',
    tags: overrides.tags || ['test'],
    embedding: overrides.embedding || undefined,
    source: overrides.source || undefined,
    headingPath: overrides.headingPath || undefined,
    sourceFile: overrides.sourceFile || undefined,
  };
}

/**
 * Reset the mock (useful for beforeEach in tests)
 */
export function resetMockVectorSearch() {
  // Currently stateless, but this is here for future use
}
