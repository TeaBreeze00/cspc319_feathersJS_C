import { GetBestPracticesTool } from '../../src/tools/getBestPractices';
import { KnowledgeLoader } from '../../src/knowledge';
import { BestPractice } from '../../src/knowledge/types';
import * as vectorSearchModule from '../../src/tools/search/vectorSearch';

// Mock the vector search module
jest.mock('../../src/tools/search/vectorSearch', () => ({
  vectorSearch: {
    search: jest.fn(),
  },
}));

describe('GetBestPracticesTool', () => {
  let tool: GetBestPracticesTool;
  let mockLoader: jest.Mocked<KnowledgeLoader>;
  const mockVectorSearch = vectorSearchModule.vectorSearch as jest.Mocked<
    typeof vectorSearchModule.vectorSearch
  >;

  // Mock best practices for testing
  const mockBestPractices: BestPractice[] = [
    {
      id: 'bp-hooks-1',
      topic: 'hooks',
      rule: 'Always return the context object from hooks',
      rationale: 'Hooks must return the context to allow the service method to continue.',
      goodExample: 'export const myHook = async (context) => { return context; }',
      badExample: 'export const myHook = async (context) => { /* no return */ }',
      version: 'v6',
      tags: ['hooks', 'context'],
    },
    {
      id: 'bp-hooks-2',
      topic: 'hooks',
      rule: 'Use async/await in hooks',
      rationale: 'Async/await makes asynchronous hook code more readable and maintainable.',
      goodExample:
        'export const myHook = async (context) => { await doSomething(); return context; }',
      badExample: 'export const myHook = (context) => { doSomething().then(...); }',
      version: 'v6',
      tags: ['hooks', 'async', 'validation'],
    },
    {
      id: 'bp-hooks-3',
      topic: 'hooks',
      rule: 'Validate data in before hooks',
      rationale: 'Validating data before it reaches the service prevents invalid data storage.',
      goodExample: 'before: { create: [validateSchema] }',
      badExample: 'after: { create: [validateSchema] } // Too late!',
      version: 'v6',
      tags: ['hooks', 'validation', 'security'],
    },
    {
      id: 'bp-security-1',
      topic: 'security',
      rule: 'Always authenticate users before sensitive operations',
      rationale: 'Authentication ensures only authorized users can access protected resources.',
      goodExample: 'before: { all: [authenticate("jwt")] }',
      badExample: 'before: { all: [] } // No authentication!',
      version: 'v6',
      tags: ['security', 'authentication'],
    },
  ];

  beforeEach(() => {
    // Create mock loader
    mockLoader = {
      load: jest.fn().mockResolvedValue(mockBestPractices),
    } as any;

    // Create tool with mock loader
    tool = new GetBestPracticesTool(mockLoader);

    // Reset vector search mock
    mockVectorSearch.search.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should return practices for each topic', async () => {
      // Mock vector search not called when no context provided
      const result = await tool.execute({ topic: 'hooks' });

      expect(mockLoader.load).toHaveBeenCalledWith('best-practices');
      expect(result.content).toMatch(/Best Practice:/);
      expect(result.content).toMatch(/Why:/);
      expect(result.content).toMatch(/Good Example:/);
      expect(result.content).toMatch(/Bad Example:/);
      expect(result.metadata?.success).toBe(true);
    });

    it('should filter practices by topic', async () => {
      const result = await tool.execute({ topic: 'security' });

      expect(result.content).toMatch(/authenticate/);
      expect(result.content).not.toMatch(/Always return the context/);
      expect(result.metadata?.topic).toBe('security');
    });

    it('should return top 3 practices when no context provided', async () => {
      const result = await tool.execute({ topic: 'hooks' });

      // Should return top 3 practices for hooks topic
      expect(result.metadata?.count).toBeLessThanOrEqual(3);
    });
  });

  describe('context-aware ranking with vector search', () => {
    it('should use vector search when context is provided', async () => {
      mockVectorSearch.search.mockResolvedValue([
        { id: 'bp-hooks-3', score: 0.92 },
        { id: 'bp-hooks-2', score: 0.85 },
      ]);

      const result = await tool.execute({ topic: 'hooks', context: 'validation' });

      expect(mockVectorSearch.search).toHaveBeenCalledTimes(1);
      expect(mockVectorSearch.search).toHaveBeenCalledWith(
        'validation',
        expect.any(Array),
        5,
        0.05
      );
      expect(result.content).toMatch(/Validate data/);
      expect(result.metadata?.usedVectorSearch).toBe(true);
      expect(result.metadata?.success).toBe(true);
    });

    it('should rank practices based on context relevance', async () => {
      mockVectorSearch.search.mockResolvedValue([
        { id: 'bp-hooks-2', score: 0.95 },
        { id: 'bp-hooks-3', score: 0.88 },
        { id: 'bp-hooks-1', score: 0.75 },
      ]);

      const result = await tool.execute({ topic: 'hooks', context: 'async await' });

      expect(result.content).toMatch(/Use async\/await/);
      expect(result.content).toMatch(/Relevance Score:/);
    });

    it('should not use vector search when context is empty', async () => {
      const result = await tool.execute({ topic: 'hooks', context: '' });

      expect(mockVectorSearch.search).not.toHaveBeenCalled();
      expect(result.metadata?.usedVectorSearch).toBe(false);
    });

    it('should not use vector search when context is only whitespace', async () => {
      const result = await tool.execute({ topic: 'hooks', context: '   ' });

      expect(mockVectorSearch.search).not.toHaveBeenCalled();
      expect(result.metadata?.usedVectorSearch).toBe(false);
    });
  });

  describe('relevance scores', () => {
    it('should include relevance scores when using vector search', async () => {
      mockVectorSearch.search.mockResolvedValue([
        { id: 'bp-hooks-3', score: 0.92 },
        { id: 'bp-hooks-2', score: 0.85 },
      ]);

      const result = await tool.execute({ topic: 'hooks', context: 'validation' });

      expect(result.content).toMatch(/Relevance Score: 92\.0%/);
    });

    it('should not include relevance scores when no context provided', async () => {
      const result = await tool.execute({ topic: 'hooks' });

      expect(result.content).not.toMatch(/Relevance Score:/);
    });
  });

  describe('error handling', () => {
    it('should handle missing topic parameter', async () => {
      const result = await tool.execute({} as any);

      expect(result.content).toMatch(/Please provide a topic/);
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle empty knowledge base', async () => {
      mockLoader.load.mockResolvedValue([]);

      const result = await tool.execute({ topic: 'hooks' });

      expect(result.content).toMatch(/No best practices found/);
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle topic with no practices', async () => {
      const result = await tool.execute({ topic: 'unknown-topic' as any });

      expect(result.content).toMatch(/No best practices found for topic/);
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle vector search returning no results', async () => {
      mockVectorSearch.search.mockResolvedValue([]);

      const result = await tool.execute({ topic: 'hooks', context: 'nonexistent' });

      expect(result.content).toMatch(/No best practices found matching the context/);
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle null params', async () => {
      const result = await tool.execute(null as any);

      expect(result.content).toMatch(/Please provide a topic/);
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle undefined params', async () => {
      const result = await tool.execute(undefined as any);

      expect(result.content).toMatch(/Please provide a topic/);
      expect(result.metadata?.success).toBe(false);
    });
  });

  describe('metadata', () => {
    it('should include metadata with topic and count', async () => {
      const result = await tool.execute({ topic: 'hooks' });

      expect(result.metadata?.tool).toBe('get_best_practices');
      expect(result.metadata?.topic).toBe('hooks');
      expect(result.metadata?.count).toBeGreaterThan(0);
    });

    it('should include context in metadata when provided', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'bp-hooks-3', score: 0.92 }]);

      const result = await tool.execute({ topic: 'hooks', context: 'validation' });

      expect(result.metadata?.context).toBe('validation');
      expect(result.metadata?.usedVectorSearch).toBe(true);
    });

    it('should indicate when vector search was not used', async () => {
      const result = await tool.execute({ topic: 'hooks' });

      expect(result.metadata?.usedVectorSearch).toBe(false);
    });
  });

  describe('content formatting', () => {
    it('should format practices with proper structure', async () => {
      const result = await tool.execute({ topic: 'hooks' });

      expect(result.content).toMatch(/Best Practice:/);
      expect(result.content).toMatch(/Why:/);
      expect(result.content).toMatch(/Good Example:/);
      expect(result.content).toMatch(/Bad Example:/);
      expect(result.content).toMatch(/Version:/);
    });

    it('should include tags when available', async () => {
      const result = await tool.execute({ topic: 'hooks' });

      expect(result.content).toMatch(/Tags:/);
    });

    it('should separate multiple practices with separators', async () => {
      const result = await tool.execute({ topic: 'hooks' });

      // Check for separator between practices (80 equals signs)
      expect(result.content).toMatch(/={80}/);
    });
  });

  describe('topic validation', () => {
    const validTopics = ['hooks', 'services', 'security', 'testing', 'performance'];

    validTopics.forEach((topic) => {
      it(`should accept valid topic: ${topic}`, async () => {
        // Mock practices for this topic
        mockLoader.load.mockResolvedValue([
          {
            id: `bp-${topic}-1`,
            topic,
            rule: `Test rule for ${topic}`,
            rationale: 'Test rationale',
            goodExample: 'good code',
            badExample: 'bad code',
            version: 'v6',
          },
        ]);

        const result = await tool.execute({ topic: topic as any });

        expect(result.metadata?.topic).toBe(topic);
        expect(result.metadata?.success).toBe(true);
      });
    });
  });

  describe('version filtering', () => {
    it('should include practices for the current version', async () => {
      const result = await tool.execute({ topic: 'hooks' });

      expect(result.content).toMatch(/Version: v6/);
    });

    it('should handle practices without version field', async () => {
      const practicesWithoutVersion: BestPractice[] = [
        {
          id: 'bp-test',
          topic: 'hooks',
          rule: 'Test rule',
          rationale: 'Test rationale',
          goodExample: 'good',
          badExample: 'bad',
        },
      ];

      mockLoader.load.mockResolvedValue(practicesWithoutVersion);

      const result = await tool.execute({ topic: 'hooks' });

      expect(result.metadata?.success).toBe(true);
    });
  });

  describe('BestPractice to DocEntry conversion', () => {
    it('should convert BestPractice to DocEntry format for vector search', async () => {
      mockVectorSearch.search.mockImplementation(async (query, docs) => {
        // Verify that docs have the DocEntry structure
        expect(docs[0]).toHaveProperty('id');
        expect(docs[0]).toHaveProperty('title');
        expect(docs[0]).toHaveProperty('content');
        expect(docs[0]).toHaveProperty('version');
        expect(docs[0]).toHaveProperty('tokens');
        expect(docs[0]).toHaveProperty('category');

        return [{ id: 'bp-hooks-3', score: 0.92 }];
      });

      await tool.execute({ topic: 'hooks', context: 'validation' });

      expect(mockVectorSearch.search).toHaveBeenCalled();
    });
  });
});
