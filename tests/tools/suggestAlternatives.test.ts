import { SuggestAlternativesTool } from '../../src/tools/suggestAlternatives';
import { KnowledgeLoader } from '../../src/knowledge';
import { DocEntry } from '../../src/knowledge/types';
import * as vectorSearchModule from '../../src/tools/search/vectorSearch';

// Mock the vector search module
jest.mock('../../src/tools/search/vectorSearch', () => ({
  vectorSearch: {
    search: jest.fn(),
  },
}));

describe('SuggestAlternativesTool', () => {
  let tool: SuggestAlternativesTool;
  let mockLoader: jest.Mocked<KnowledgeLoader>;
  const mockVectorSearch = vectorSearchModule.vectorSearch as jest.Mocked<
    typeof vectorSearchModule.vectorSearch
  >;

  // Mock documents for testing
  const mockTemplates: DocEntry[] = [
    {
      id: 'tpl-hook-auth',
      title: 'Authentication Hook Pattern',
      content: 'Hook-based authentication using JWT',
      version: 'v6',
      tokens: ['authentication', 'hook', 'jwt'],
      category: 'templates',
      tags: ['auth', 'hooks'],
    },
    {
      id: 'tpl-service-auth',
      title: 'Service-Level Authentication',
      content: 'Service method authentication pattern',
      version: 'v6',
      tokens: ['authentication', 'service'],
      category: 'templates',
      tags: ['auth', 'services'],
    },
  ];

  const mockSnippets: DocEntry[] = [
    {
      id: 'snippet-before-hook',
      title: 'Before Hook Example',
      content: 'Example of a before hook for validation',
      version: 'v6',
      tokens: ['before', 'hook', 'validation'],
      category: 'snippets',
      tags: ['hooks', 'validation'],
    },
    {
      id: 'snippet-schema-validation',
      title: 'Schema Validation Example',
      content: 'Example using schema-based validation',
      version: 'v6',
      tokens: ['schema', 'validation'],
      category: 'snippets',
      tags: ['validation', 'schema'],
    },
  ];

  const mockDocs: DocEntry[] = [
    {
      id: 'doc-hooks-guide',
      title: 'Hooks Guide',
      content: 'Comprehensive guide to using hooks',
      version: 'v6',
      tokens: ['hooks', 'guide'],
      category: 'guides',
      tags: ['hooks'],
    },
  ];

  // Add code property to templates and snippets
  const mockTemplatesWithCode = mockTemplates.map((t) => ({
    ...t,
    code: `// ${t.title}\nexport const example = async (context) => {\n  return context;\n};`,
  }));

  const mockSnippetsWithCode = mockSnippets.map((s) => ({
    ...s,
    code: `// ${s.title}\nexport const snippet = async (context) => {\n  // Implementation\n  return context;\n};`,
  }));

  beforeEach(() => {
    // Create mock loader
    mockLoader = {
      load: jest.fn().mockImplementation(async (type: string) => {
        if (type === 'templates') return mockTemplatesWithCode;
        if (type === 'snippets') return mockSnippetsWithCode;
        if (type === 'docs') return mockDocs;
        return [];
      }),
    } as any;

    // Create tool with mock loader
    tool = new SuggestAlternativesTool(mockLoader);

    // Reset vector search mock
    mockVectorSearch.search.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('returns at least 2 alternatives', async () => {
      mockVectorSearch.search.mockResolvedValue([
        { id: 'tpl-hook-auth', score: 0.95 },
        { id: 'tpl-service-auth', score: 0.88 },
      ]);

      const result = await tool.execute({ pattern: 'authentication hook' });

      expect(result.content).toMatch(/Alternative 1:/);
      expect(result.content).toMatch(/Alternative 2:/);
      expect(result.metadata?.success).toBe(true);
    });

    it('includes tradeoffs for each suggestion', async () => {
      mockVectorSearch.search.mockResolvedValue([
        { id: 'tpl-hook-auth', score: 0.95 },
        { id: 'tpl-service-auth', score: 0.88 },
      ]);

      const result = await tool.execute({ pattern: 'service pattern' });

      expect(result.content).toMatch(/Tradeoffs:/);
      expect(result.content).toMatch(/When to use:/);
    });

    it('includes code examples in alternatives', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'tpl-hook-auth', score: 0.95 }]);

      const result = await tool.execute({ pattern: 'authentication' });

      expect(result.content).toMatch(/Code:/);
      expect(result.content).toContain('export const');
    });
  });

  describe('vector search integration', () => {
    it('should use vector search with pattern query', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'tpl-hook-auth', score: 0.95 }]);

      await tool.execute({ pattern: 'authentication hook' });

      expect(mockVectorSearch.search).toHaveBeenCalledTimes(1);
      expect(mockVectorSearch.search).toHaveBeenCalledWith(
        'authentication hook',
        expect.any(Array),
        10,
        0.1
      );
    });

    it('should combine pattern and context in query', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'tpl-hook-auth', score: 0.95 }]);

      await tool.execute({ pattern: 'authentication', context: 'JWT tokens' });

      expect(mockVectorSearch.search).toHaveBeenCalledWith(
        'authentication JWT tokens',
        expect.any(Array),
        10,
        0.1
      );
    });

    it('should search across templates, snippets, and docs', async () => {
      mockVectorSearch.search.mockImplementation(async (query, sources) => {
        // Verify that sources include all types
        const ids = sources.map((s: DocEntry) => s.id);
        expect(ids).toContain('tpl-hook-auth');
        expect(ids).toContain('snippet-before-hook');
        expect(ids).toContain('doc-hooks-guide');
        return [{ id: 'tpl-hook-auth', score: 0.95 }];
      });

      await tool.execute({ pattern: 'hooks' });

      expect(mockLoader.load).toHaveBeenCalledWith('templates');
      expect(mockLoader.load).toHaveBeenCalledWith('snippets');
      expect(mockLoader.load).toHaveBeenCalledWith('docs');
    });

    it('should include relevance scores when using vector search', async () => {
      mockVectorSearch.search.mockResolvedValue([
        { id: 'tpl-hook-auth', score: 0.95 },
        { id: 'tpl-service-auth', score: 0.88 },
      ]);

      const result = await tool.execute({ pattern: 'authentication' });

      expect(result.content).toMatch(/Relevance: 95\.0%/);
      expect(result.content).toMatch(/Relevance: 88\.0%/);
    });
  });

  describe('fallback alternatives', () => {
    it('should return fallback alternatives when no results found', async () => {
      mockVectorSearch.search.mockResolvedValue([]);

      const result = await tool.execute({ pattern: 'unknown pattern' });

      expect(result.content).toMatch(/No specific alternatives found/);
      expect(result.content).toMatch(/Hook-based approach/);
      expect(result.content).toMatch(/Service method approach/);
      expect(result.content).toMatch(/Schema-based validation/);
      expect(result.metadata?.usedFallback).toBe(true);
    });

    it('should return fallback when knowledge base is empty', async () => {
      mockLoader.load.mockResolvedValue([]);

      const result = await tool.execute({ pattern: 'test' });

      expect(result.content).toMatch(/Hook-based approach/);
      expect(result.metadata?.usedFallback).toBe(true);
    });
  });

  describe('alternative formatting', () => {
    it('should format alternatives with proper structure', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'tpl-hook-auth', score: 0.95 }]);

      const result = await tool.execute({ pattern: 'authentication' });

      expect(result.content).toMatch(/Alternative 1:/);
      expect(result.content).toMatch(/Code:/);
      expect(result.content).toMatch(/Tradeoffs:/);
      expect(result.content).toMatch(/When to use:/);
    });

    it('should separate alternatives with dividers', async () => {
      mockVectorSearch.search.mockResolvedValue([
        { id: 'tpl-hook-auth', score: 0.95 },
        { id: 'tpl-service-auth', score: 0.88 },
      ]);

      const result = await tool.execute({ pattern: 'authentication' });

      expect(result.content).toMatch(/={80}/);
    });

    it('should number alternatives sequentially', async () => {
      mockVectorSearch.search.mockResolvedValue([
        { id: 'tpl-hook-auth', score: 0.95 },
        { id: 'tpl-service-auth', score: 0.88 },
        { id: 'snippet-before-hook', score: 0.82 },
      ]);

      const result = await tool.execute({ pattern: 'pattern' });

      expect(result.content).toMatch(/Alternative 1:/);
      expect(result.content).toMatch(/Alternative 2:/);
      expect(result.content).toMatch(/Alternative 3:/);
    });
  });

  describe('error handling', () => {
    it('should handle missing pattern parameter', async () => {
      const result = await tool.execute({} as any);

      expect(result.content).toMatch(/Please provide a pattern/);
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle empty pattern', async () => {
      const result = await tool.execute({ pattern: '' });

      expect(result.content).toMatch(/Please provide a pattern/);
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle null params', async () => {
      const result = await tool.execute(null as any);

      expect(result.content).toMatch(/Please provide a pattern/);
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle undefined params', async () => {
      const result = await tool.execute(undefined as any);

      expect(result.content).toMatch(/Please provide a pattern/);
      expect(result.metadata?.success).toBe(false);
    });
  });

  describe('metadata', () => {
    it('should include metadata with pattern and count', async () => {
      mockVectorSearch.search.mockResolvedValue([
        { id: 'tpl-hook-auth', score: 0.95 },
        { id: 'tpl-service-auth', score: 0.88 },
      ]);

      const result = await tool.execute({ pattern: 'authentication' });

      expect(result.metadata?.tool).toBe('suggest_alternatives');
      expect(result.metadata?.pattern).toBe('authentication');
      expect(result.metadata?.count).toBeGreaterThan(0);
      expect(result.metadata?.usedVectorSearch).toBe(true);
      expect(result.metadata?.success).toBe(true);
    });

    it('should include context in metadata when provided', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'tpl-hook-auth', score: 0.95 }]);

      const result = await tool.execute({ pattern: 'auth', context: 'JWT' });

      expect(result.metadata?.context).toBe('JWT');
    });

    it('should indicate when fallback was used', async () => {
      mockVectorSearch.search.mockResolvedValue([]);

      const result = await tool.execute({ pattern: 'unknown' });

      expect(result.metadata?.usedFallback).toBe(true);
    });
  });

  describe('deduplication', () => {
    it('should deduplicate alternatives with same title', async () => {
      // Mock vector search returning duplicates
      mockVectorSearch.search.mockResolvedValue([
        { id: 'tpl-hook-auth', score: 0.95 },
        { id: 'tpl-hook-auth', score: 0.9 }, // Duplicate
        { id: 'tpl-service-auth', score: 0.88 },
      ]);

      const result = await tool.execute({ pattern: 'authentication' });

      // Should only have 2 unique alternatives, not 3
      const alternativeCount = (result.content.match(/Alternative \d+:/g) || []).length;
      expect(alternativeCount).toBeLessThanOrEqual(2);
    });
  });

  describe('code extraction', () => {
    it('should extract code from code property', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'tpl-hook-auth', score: 0.95 }]);

      const result = await tool.execute({ pattern: 'authentication' });

      expect(result.content).toContain('export const');
    });

    it('should extract code from markdown code blocks', async () => {
      const docWithCodeBlock: DocEntry = {
        id: 'doc-with-code',
        title: 'Example with code',
        content: '```javascript\nexport const test = () => {};\n```',
        version: 'v6',
        tokens: ['example'],
        category: 'docs',
      };

      mockLoader.load.mockResolvedValue([docWithCodeBlock]);
      mockVectorSearch.search.mockResolvedValue([{ id: 'doc-with-code', score: 0.95 }]);

      const result = await tool.execute({ pattern: 'test' });

      expect(result.content).toContain('export const test');
    });

    it('should skip alternatives without code', async () => {
      const docWithoutCode: DocEntry = {
        id: 'doc-no-code',
        title: 'Example without code',
        content: 'This is just text without any code',
        version: 'v6',
        tokens: ['example'],
        category: 'docs',
      };

      mockLoader.load.mockResolvedValue([docWithoutCode]);
      mockVectorSearch.search.mockResolvedValue([{ id: 'doc-no-code', score: 0.95 }]);

      const result = await tool.execute({ pattern: 'test' });

      // Should fall back to default alternatives since no valid code found
      expect(result.content).toMatch(/Hook-based approach|Service method approach/);
    });
  });

  describe('guidance inference', () => {
    it('should infer tradeoffs when not explicitly provided', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'tpl-hook-auth', score: 0.95 }]);

      const result = await tool.execute({ pattern: 'authentication' });

      expect(result.content).toMatch(/Tradeoffs:/);
    });

    it('should infer when to use guidance', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'tpl-hook-auth', score: 0.95 }]);

      const result = await tool.execute({ pattern: 'authentication' });

      expect(result.content).toMatch(/When to use:/);
    });
  });

  describe('result limiting', () => {
    it('should return maximum 3 alternatives', async () => {
      mockVectorSearch.search.mockResolvedValue([
        { id: 'tpl-hook-auth', score: 0.95 },
        { id: 'tpl-service-auth', score: 0.88 },
        { id: 'snippet-before-hook', score: 0.82 },
        { id: 'snippet-schema-validation', score: 0.75 },
        { id: 'doc-hooks-guide', score: 0.7 },
      ]);

      const result = await tool.execute({ pattern: 'pattern' });

      const alternativeCount = (result.content.match(/Alternative \d+:/g) || []).length;
      expect(alternativeCount).toBeLessThanOrEqual(3);
    });
  });

  describe('context parameter', () => {
    it('should use context to refine search', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'tpl-hook-auth', score: 0.95 }]);

      await tool.execute({ pattern: 'authentication', context: 'REST API' });

      expect(mockVectorSearch.search).toHaveBeenCalledWith(
        'authentication REST API',
        expect.any(Array),
        10,
        0.1
      );
    });

    it('should handle empty context', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'tpl-hook-auth', score: 0.95 }]);

      await tool.execute({ pattern: 'authentication', context: '' });

      expect(mockVectorSearch.search).toHaveBeenCalledWith(
        'authentication',
        expect.any(Array),
        10,
        0.1
      );
    });
  });
});
