import { ExplainConceptTool } from '../../src/tools/explainConcept';
import { KnowledgeLoader } from '../../src/knowledge';
import { DocEntry } from '../../src/knowledge/types';
import * as vectorSearchModule from '../../src/tools/search/vectorSearch';

// Mock the vector search module
jest.mock('../../src/tools/search/vectorSearch', () => ({
  vectorSearch: {
    search: jest.fn(),
  },
}));

describe('ExplainConceptTool', () => {
  let tool: ExplainConceptTool;
  let mockLoader: jest.Mocked<KnowledgeLoader>;
  const mockVectorSearch = vectorSearchModule.vectorSearch as jest.Mocked<
    typeof vectorSearchModule.vectorSearch
  >;

  // Mock documents for testing
  const mockDocs: DocEntry[] = [
    {
      id: 'doc-hooks',
      title: 'Hooks',
      content:
        'Hooks are middleware functions that run before, after, or on error of service methods.',
      version: 'v6',
      tokens: ['hooks', 'middleware', 'service'],
      category: 'core-concepts',
      tags: ['hooks', 'middleware'],
    },
    {
      id: 'doc-hooks-before',
      title: 'Before Hooks',
      content: 'Before hooks execute before a service method is called.',
      version: 'v6',
      tokens: ['before', 'hooks'],
      category: 'hooks',
      tags: ['before', 'hooks'],
    },
    {
      id: 'doc-hooks-after',
      title: 'After Hooks',
      content: 'After hooks execute after a service method completes successfully.',
      version: 'v6',
      tokens: ['after', 'hooks'],
      category: 'hooks',
      tags: ['after', 'hooks'],
    },
    {
      id: 'doc-authentication',
      title: 'Authentication',
      content: 'Authentication allows you to secure your services.',
      version: 'v6',
      tokens: ['authentication', 'security'],
      category: 'authentication',
      tags: ['auth', 'security'],
    },
  ];

  beforeEach(() => {
    // Create mock loader
    mockLoader = {
      load: jest.fn().mockResolvedValue(mockDocs),
    } as any;

    // Create tool with mock loader
    tool = new ExplainConceptTool(mockLoader);

    // Reset vector search mock
    mockVectorSearch.search.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should explain known concepts using vector search', async () => {
      // Mock vector search to return hooks-related results
      mockVectorSearch.search.mockResolvedValue([
        { id: 'doc-hooks', score: 0.95 },
        { id: 'doc-hooks-before', score: 0.85 },
        { id: 'doc-hooks-after', score: 0.8 },
      ]);

      const result = await tool.execute({ concept: 'hooks' });

      expect(mockLoader.load).toHaveBeenCalledWith('docs');
      expect(mockVectorSearch.search).toHaveBeenCalledWith('hooks', mockDocs, 5, 0.1);
      expect(result.content).toMatch(/Concept: Hooks/);
      expect(result.content).toMatch(/Definition:/);
      expect(result.content).toMatch(/Related Concepts:/);
      expect(result.metadata?.success).toBe(true);
    });

    it('should handle empty concept gracefully', async () => {
      const result = await tool.execute({ concept: '' });

      expect(result.content).toMatch(/Please provide a concept/);
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle unknown concepts gracefully', async () => {
      // Mock vector search to return no results
      mockVectorSearch.search.mockResolvedValue([]);

      const result = await tool.execute({ concept: 'unknownConcept' });

      expect(result.content).toMatch(/not found/);
      expect(result.content).toMatch(/Try:/);
      expect(result.metadata?.success).toBe(false);
    });
  });

  describe('vector search integration', () => {
    it('should call vector search with correct parameters', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'doc-authentication', score: 0.92 }]);

      await tool.execute({ concept: 'authentication' });

      expect(mockVectorSearch.search).toHaveBeenCalledTimes(1);
      expect(mockVectorSearch.search).toHaveBeenCalledWith('authentication', mockDocs, 5, 0.1);
    });

    it('should include related concepts from vector search results', async () => {
      mockVectorSearch.search.mockResolvedValue([
        { id: 'doc-hooks', score: 0.95 },
        { id: 'doc-hooks-before', score: 0.85 },
        { id: 'doc-hooks-after', score: 0.8 },
      ]);

      const result = await tool.execute({ concept: 'hooks' });

      expect(result.content).toMatch(/Related Concepts:/);
      expect(result.content).toMatch(/Before Hooks/);
      expect(result.content).toMatch(/After Hooks/);
    });

    it('should handle vector search with single result', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'doc-authentication', score: 0.92 }]);

      const result = await tool.execute({ concept: 'authentication' });

      expect(result.content).toMatch(/Concept: Authentication/);
      expect(result.content).toMatch(/Definition:/);
      expect(result.metadata?.success).toBe(true);
    });
  });

  describe('metadata', () => {
    it('should include relevance score in metadata', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'doc-hooks', score: 0.95 }]);

      const result = await tool.execute({ concept: 'hooks' });

      expect(result.metadata?.bestMatchId).toBe('doc-hooks');
      expect(result.metadata?.score).toBe(0.95);
      expect(result.metadata?.success).toBe(true);
    });

    it('should include related count in metadata', async () => {
      mockVectorSearch.search.mockResolvedValue([
        { id: 'doc-hooks', score: 0.95 },
        { id: 'doc-hooks-before', score: 0.85 },
        { id: 'doc-hooks-after', score: 0.8 },
      ]);

      const result = await tool.execute({ concept: 'hooks' });

      expect(result.metadata?.relatedCount).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty knowledge base', async () => {
      mockLoader.load.mockResolvedValue([]);

      const result = await tool.execute({ concept: 'hooks' });

      expect(result.content).toMatch(/knowledge base appears to be empty/);
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle null params', async () => {
      const result = await tool.execute(null as any);

      expect(result.content).toMatch(/Please provide a concept/);
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle undefined params', async () => {
      const result = await tool.execute(undefined as any);

      expect(result.content).toMatch(/Please provide a concept/);
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle vector search returning invalid doc id', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'non-existent-doc', score: 0.95 }]);

      const result = await tool.execute({ concept: 'test' });

      expect(result.content).toMatch(/Unable to retrieve documentation/);
      expect(result.metadata?.success).toBe(false);
    });
  });

  describe('content formatting', () => {
    it('should format concept explanation with proper structure', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'doc-hooks', score: 0.95 }]);

      const result = await tool.execute({ concept: 'hooks' });

      expect(result.content).toMatch(/Concept: Hooks/);
      expect(result.content).toMatch(/Version: v6/);
      expect(result.content).toMatch(/Definition:/);
    });

    it('should include version information', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'doc-hooks', score: 0.95 }]);

      const result = await tool.execute({ concept: 'hooks' });

      expect(result.content).toContain('Version: v6');
    });
  });
});
