import { GetHookExampleTool } from '../../src/tools/getHookExample';
import { KnowledgeLoader } from '../../src/knowledge';
import { DocEntry } from '../../src/knowledge/types';
import * as vectorSearchModule from '../../src/tools/search/vectorSearch';

// Mock the vector search module
jest.mock('../../src/tools/search/vectorSearch', () => ({
  vectorSearch: {
    search: jest.fn(),
  },
}));

interface HookSnippet extends DocEntry {
  type: 'before' | 'after' | 'error';
  useCase: string;
  code: string;
  explanation: string;
  language?: string;
}

describe('GetHookExampleTool', () => {
  let tool: GetHookExampleTool;
  let mockLoader: jest.Mocked<KnowledgeLoader>;
  const mockVectorSearch = vectorSearchModule.vectorSearch as jest.Mocked<
    typeof vectorSearchModule.vectorSearch
  >;

  // Mock hook snippets for testing
  const mockSnippets: HookSnippet[] = [
    {
      id: 'hook-before-validate',
      type: 'before',
      useCase: 'Validate email address',
      code: 'export const validateEmail = async (context) => {\n  const { data } = context;\n  if (!data.email || !data.email.includes("@")) {\n    throw new Error("Invalid email");\n  }\n  return context;\n};',
      explanation: 'Validates that the email field contains an @ symbol.',
      version: 'v6',
      tokens: ['before', 'validate', 'email'],
      category: 'hooks',
      tags: ['validation', 'email'],
      title: 'Validate Email Hook',
      content: 'A before hook that validates email addresses',
      language: 'typescript',
    },
    {
      id: 'hook-before-timestamp',
      type: 'before',
      useCase: 'Add timestamp to data',
      code: 'export const addTimestamp = async (context) => {\n  context.data.createdAt = new Date();\n  return context;\n};',
      explanation: 'Adds a createdAt timestamp to the data before saving.',
      version: 'v6',
      tokens: ['before', 'timestamp'],
      category: 'hooks',
      tags: ['timestamp', 'date'],
      title: 'Add Timestamp Hook',
      content: 'A before hook that adds timestamps',
      language: 'typescript',
    },
    {
      id: 'hook-after-sanitize',
      type: 'after',
      useCase: 'Remove sensitive data',
      code: 'export const sanitize = async (context) => {\n  delete context.result.password;\n  return context;\n};',
      explanation: 'Removes password field from the result.',
      version: 'v6',
      tokens: ['after', 'sanitize'],
      category: 'hooks',
      tags: ['security', 'sanitize'],
      title: 'Sanitize Result Hook',
      content: 'An after hook that removes sensitive data',
      language: 'typescript',
    },
    {
      id: 'hook-error-log',
      type: 'error',
      useCase: 'Log errors',
      code: 'export const logError = async (context) => {\n  console.error("Error:", context.error);\n  return context;\n};',
      explanation: 'Logs errors to the console.',
      version: 'v6',
      tokens: ['error', 'log'],
      category: 'hooks',
      tags: ['logging', 'error'],
      title: 'Log Error Hook',
      content: 'An error hook that logs errors',
      language: 'typescript',
    },
    {
      id: 'hook-before-v5',
      type: 'before',
      useCase: 'Legacy validation',
      code: 'module.exports = function (options = {}) {\n  return async context => {\n    // v5 style hook\n    return context;\n  };\n};',
      explanation: 'V5 style hook for validation.',
      version: 'v5',
      tokens: ['before', 'validate'],
      category: 'hooks',
      tags: ['validation', 'legacy'],
      title: 'V5 Validation Hook',
      content: 'A v5 style validation hook',
      language: 'javascript',
    },
    {
      id: 'hook-before-both',
      type: 'before',
      useCase: 'Universal authentication',
      code: 'export const authenticate = async (context) => {\n  // Works in both v5 and v6\n  return context;\n};',
      explanation: 'Authentication hook that works in both versions.',
      version: 'both',
      tokens: ['before', 'authenticate'],
      category: 'hooks',
      tags: ['auth', 'universal'],
      title: 'Universal Auth Hook',
      content: 'An authentication hook for both versions',
      language: 'typescript',
    },
  ];

  beforeEach(() => {
    // Create mock loader
    mockLoader = {
      load: jest.fn().mockResolvedValue(mockSnippets),
    } as any;

    // Create tool with mock loader
    tool = new GetHookExampleTool(mockLoader);

    // Reset vector search mock
    mockVectorSearch.search.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should return a hook example for valid hookType', async () => {
      const result = await tool.execute({ hookType: 'before' });

      expect(mockLoader.load).toHaveBeenCalledWith('snippets');
      expect(result).toHaveProperty('content');
      const parsed = JSON.parse(result.content);
      expect(parsed.code).toBeTruthy();
      expect(parsed.explanation).toBeTruthy();
      expect(parsed.hookType).toBe('before');
    });

    it('should return hook examples for v5 version', async () => {
      const result = await tool.execute({ hookType: 'before', version: 'v5' });

      expect(result).toHaveProperty('content');
      const parsed = JSON.parse(result.content);
      expect(parsed.code).toBeTruthy();
      expect(parsed.hookType).toBe('before');
      expect(['v5', 'both']).toContain(parsed.version);
    });

    it('should return hook examples for v6 version', async () => {
      const result = await tool.execute({ hookType: 'before', version: 'v6' });

      expect(result).toHaveProperty('content');
      const parsed = JSON.parse(result.content);
      expect(parsed.code).toBeTruthy();
      expect(parsed.hookType).toBe('before');
    });

    it('should return after hook examples', async () => {
      const result = await tool.execute({ hookType: 'after' });

      expect(result).toHaveProperty('content');
      const parsed = JSON.parse(result.content);
      expect(parsed.hookType).toBe('after');
      expect(parsed.code).toContain('sanitize');
    });

    it('should return error hook examples', async () => {
      const result = await tool.execute({ hookType: 'error' });

      expect(result).toHaveProperty('content');
      const parsed = JSON.parse(result.content);
      expect(parsed.hookType).toBe('error');
      expect(parsed.code).toContain('error');
    });
  });

  describe('vector search integration with useCase', () => {
    it('should use vector search when useCase is provided', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'hook-before-validate', score: 0.95 }]);

      const result = await tool.execute({ hookType: 'before', useCase: 'validate' });

      expect(mockVectorSearch.search).toHaveBeenCalledTimes(1);
      expect(mockVectorSearch.search).toHaveBeenCalledWith('validate', expect.any(Array), 1, 0.05);
      expect(result).toHaveProperty('content');
      const parsed = JSON.parse(result.content);
      expect(parsed.code).toBeTruthy();
      expect(parsed.useCase).toContain('Validate');
    });

    it('should not use vector search when useCase is not provided', async () => {
      const result = await tool.execute({ hookType: 'before' });

      expect(mockVectorSearch.search).not.toHaveBeenCalled();
      expect(result.metadata?.usedVectorSearch).toBe(false);
    });

    it('should not use vector search when useCase is empty', async () => {
      const result = await tool.execute({ hookType: 'before', useCase: '' });

      expect(mockVectorSearch.search).not.toHaveBeenCalled();
      expect(result.metadata?.usedVectorSearch).toBe(false);
    });

    it('should find semantically similar examples with vector search', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'hook-before-timestamp', score: 0.88 }]);

      const result = await tool.execute({ hookType: 'before', useCase: 'add created date' });

      expect(mockVectorSearch.search).toHaveBeenCalled();
      const parsed = JSON.parse(result.content);
      expect(parsed.useCase).toContain('timestamp');
    });

    it('should include relevance score when using vector search', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'hook-before-validate', score: 0.95 }]);

      const result = await tool.execute({ hookType: 'before', useCase: 'validate email' });

      expect(result.metadata?.relevanceScore).toBe(0.95);
      expect(result.metadata?.usedVectorSearch).toBe(true);

      const parsed = JSON.parse(result.content);
      expect(parsed.relevanceScore).toBe(0.95);
    });

    it('should fall back to first snippet when vector search returns no results', async () => {
      mockVectorSearch.search.mockResolvedValue([]);

      const result = await tool.execute({ hookType: 'before', useCase: 'nonexistent' });

      const parsed = JSON.parse(result.content);
      expect(parsed.code).toBeTruthy();
      expect(parsed.hookType).toBe('before');
    });
  });

  describe('version filtering', () => {
    it('should filter by version v6', async () => {
      const result = await tool.execute({ hookType: 'before', version: 'v6' });

      const parsed = JSON.parse(result.content);
      expect(['v6', 'both']).toContain(parsed.version);
    });

    it('should filter by version v5', async () => {
      const result = await tool.execute({ hookType: 'before', version: 'v5' });

      const parsed = JSON.parse(result.content);
      expect(['v5', 'both']).toContain(parsed.version);
    });

    it('should include both versions when version is both', async () => {
      const result = await tool.execute({ hookType: 'before', version: 'v6' });

      // Should return v6 or both
      const parsed = JSON.parse(result.content);
      expect(parsed.version).toBeDefined();
    });

    it('should default to v6 when version not specified', async () => {
      const result = await tool.execute({ hookType: 'before' });

      const parsed = JSON.parse(result.content);
      // Should return v6 or both version snippets
      expect(['v6', 'both']).toContain(parsed.version);
    });
  });

  describe('error handling', () => {
    it('should handle missing hookType parameter', async () => {
      const result = await tool.execute({} as any);

      const parsed = JSON.parse(result.content);
      expect(parsed.error).toMatch(/Please provide a hookType/);
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle empty knowledge base', async () => {
      mockLoader.load.mockResolvedValue([]);

      const result = await tool.execute({ hookType: 'before' });

      const parsed = JSON.parse(result.content);
      expect(parsed.error).toMatch(/No hook examples found/);
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle no snippets for hookType', async () => {
      // Filter out all before hooks
      mockLoader.load.mockResolvedValue(mockSnippets.filter((s) => s.type !== 'before'));

      const result = await tool.execute({ hookType: 'before' });

      const parsed = JSON.parse(result.content);
      expect(parsed.error).toBeTruthy();
    });

    it('should handle no snippets for version', async () => {
      // Only return v5 snippets
      mockLoader.load.mockResolvedValue(mockSnippets.filter((s) => s.version === 'v5'));

      const result = await tool.execute({ hookType: 'before', version: 'v6' });

      const parsed = JSON.parse(result.content);
      expect(parsed.error).toMatch(/No hook examples found for type "before" in version "v6"/);
    });

    it('should handle null params', async () => {
      const result = await tool.execute(null as any);

      const parsed = JSON.parse(result.content);
      expect(parsed.error).toBeTruthy();
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle undefined params', async () => {
      const result = await tool.execute(undefined as any);

      const parsed = JSON.parse(result.content);
      expect(parsed.error).toBeTruthy();
      expect(result.metadata?.success).toBe(false);
    });
  });

  describe('metadata', () => {
    it('should include metadata with hookType and version', async () => {
      const result = await tool.execute({ hookType: 'before', version: 'v6' });

      expect(result.metadata?.tool).toBe('get_hook_example');
      expect(result.metadata?.hookType).toBe('before');
      expect(result.metadata?.version).toBe('v6');
      expect(result.metadata?.success).toBe(true);
    });

    it('should include snippet ID in metadata', async () => {
      const result = await tool.execute({ hookType: 'before' });

      expect(result.metadata?.snippetId).toBeTruthy();
    });

    it('should indicate when vector search was used', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'hook-before-validate', score: 0.95 }]);

      const result = await tool.execute({ hookType: 'before', useCase: 'validate' });

      expect(result.metadata?.usedVectorSearch).toBe(true);
    });

    it('should indicate when vector search was not used', async () => {
      const result = await tool.execute({ hookType: 'before' });

      expect(result.metadata?.usedVectorSearch).toBe(false);
    });
  });

  describe('response format', () => {
    it('should return valid JSON', async () => {
      const result = await tool.execute({ hookType: 'before' });

      expect(() => JSON.parse(result.content)).not.toThrow();
    });

    it('should include all required fields in response', async () => {
      const result = await tool.execute({ hookType: 'before' });

      const parsed = JSON.parse(result.content);
      expect(parsed).toHaveProperty('hookType');
      expect(parsed).toHaveProperty('useCase');
      expect(parsed).toHaveProperty('version');
      expect(parsed).toHaveProperty('code');
      expect(parsed).toHaveProperty('explanation');
      expect(parsed).toHaveProperty('language');
    });

    it('should include language field', async () => {
      const result = await tool.execute({ hookType: 'before' });

      const parsed = JSON.parse(result.content);
      expect(parsed.language).toBe('typescript');
    });

    it('should default language to typescript', async () => {
      // Create snippet without language field
      const snippetWithoutLang = { ...mockSnippets[0] };
      delete (snippetWithoutLang as any).language;
      mockLoader.load.mockResolvedValue([snippetWithoutLang]);

      const result = await tool.execute({ hookType: 'before' });

      const parsed = JSON.parse(result.content);
      expect(parsed.language).toBe('typescript');
    });
  });

  describe('hook type filtering', () => {
    it('should only return before hooks for before hookType', async () => {
      const result = await tool.execute({ hookType: 'before' });

      const parsed = JSON.parse(result.content);
      expect(parsed.hookType).toBe('before');
    });

    it('should only return after hooks for after hookType', async () => {
      const result = await tool.execute({ hookType: 'after' });

      const parsed = JSON.parse(result.content);
      expect(parsed.hookType).toBe('after');
    });

    it('should only return error hooks for error hookType', async () => {
      const result = await tool.execute({ hookType: 'error' });

      const parsed = JSON.parse(result.content);
      expect(parsed.hookType).toBe('error');
    });
  });

  describe('useCase matching', () => {
    it('should match validation useCase', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'hook-before-validate', score: 0.95 }]);

      const result = await tool.execute({ hookType: 'before', useCase: 'validate email' });

      const parsed = JSON.parse(result.content);
      expect(parsed.useCase).toContain('Validate');
    });

    it('should match timestamp useCase', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'hook-before-timestamp', score: 0.92 }]);

      const result = await tool.execute({ hookType: 'before', useCase: 'add timestamp' });

      const parsed = JSON.parse(result.content);
      expect(parsed.useCase).toContain('timestamp');
    });

    it('should match sanitize useCase', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'hook-after-sanitize', score: 0.89 }]);

      const result = await tool.execute({ hookType: 'after', useCase: 'remove password' });

      const parsed = JSON.parse(result.content);
      expect(parsed.useCase).toContain('sensitive');
    });
  });
});
