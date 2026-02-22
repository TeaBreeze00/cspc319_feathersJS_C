import { TroubleshootErrorTool } from '../../src/tools/troubleshootError';
import { KnowledgeLoader } from '../../src/knowledge';
import { DocEntry } from '../../src/knowledge/types';
import * as vectorSearchModule from '../../src/tools/search/vectorSearch';

// Mock the vector search module
jest.mock('../../src/tools/search/vectorSearch', () => ({
  vectorSearch: {
    search: jest.fn(),
  },
}));

interface ErrorEntry extends DocEntry {
  pattern: string;
  cause: string;
  solution: string;
  example: string;
  category: string;
}

describe('TroubleshootErrorTool', () => {
  let tool: TroubleshootErrorTool;
  let mockLoader: jest.Mocked<KnowledgeLoader>;
  const mockVectorSearch = vectorSearchModule.vectorSearch as jest.Mocked<
    typeof vectorSearchModule.vectorSearch
  >;

  // Mock error entries for testing
  const mockErrors: ErrorEntry[] = [
    {
      id: 'error-not-authenticated',
      title: 'NotAuthenticated Error',
      content: 'Authentication failed error',
      pattern: 'NotAuthenticated',
      cause: 'User is not authenticated or token is invalid.',
      solution: 'Ensure the user is authenticated before accessing protected resources.',
      example: 'before: { all: [authenticate("jwt")] }',
      category: 'authentication',
      version: 'v6',
      tokens: ['authentication', 'error'],
      tags: ['auth', 'security'],
    },
    {
      id: 'error-not-found',
      title: 'NotFound Error',
      pattern: 'NotFound',
      cause: 'The requested resource does not exist.',
      solution: 'Check that the ID exists in the database.',
      example: 'const result = await service.get(validId);',
      category: 'database',
      version: 'v6',
      tokens: ['not-found', 'error'],
      content: 'Resource not found error',
      tags: ['database', 'error'],
    },
    {
      id: 'error-bad-request',
      title: 'BadRequest Error',
      pattern: 'BadRequest',
      cause: 'Invalid request data or parameters.',
      solution: 'Validate your request data against the schema.',
      example: 'before: { create: [validateSchema] }',
      category: 'validation',
      version: 'v6',
      tokens: ['validation', 'error'],
      content: 'Bad request error',
      tags: ['validation', 'error'],
    },
    {
      id: 'error-forbidden',
      title: 'Forbidden Error',
      pattern: 'Forbidden',
      cause: 'User does not have permission to access this resource.',
      solution: 'Check user permissions and authorization rules.',
      example: 'before: { all: [checkPermissions] }',
      category: 'authorization',
      version: 'v6',
      tokens: ['authorization', 'error'],
      content: 'Forbidden access error',
      tags: ['auth', 'permissions'],
    },
    {
      id: 'error-v5-legacy',
      title: 'V5 Legacy Error',
      pattern: 'LegacyError',
      cause: 'V5 specific error.',
      solution: 'Migrate to V6.',
      example: 'app.use(errorHandler());',
      category: 'configuration',
      version: 'v5',
      tokens: ['legacy', 'error'],
      content: 'Legacy v5 error',
      tags: ['v5', 'legacy'],
    },
  ];

  beforeEach(() => {
    // Create mock loader
    mockLoader = {
      load: jest.fn().mockResolvedValue(mockErrors),
    } as any;

    // Create tool with mock loader
    tool = new TroubleshootErrorTool(mockLoader);

    // Reset vector search mock
    mockVectorSearch.search.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should handle known error patterns using regex', async () => {
      const result = await tool.execute({ errorMessage: 'NotAuthenticated: No auth token' });

      expect(mockLoader.load).toHaveBeenCalledWith('errors');
      expect(result.content).toMatch(/Category: authentication/);
      expect(result.content).toMatch(/Cause:/);
      expect(result.content).toMatch(/Solution:/);
      expect(result.content).toMatch(/Example:/);
      expect(result.metadata?.matchType).toBe('pattern');
      expect(result.metadata?.success).toBe(true);
    });

    it('should handle unknown errors gracefully', async () => {
      // Mock vector search to return no results
      mockVectorSearch.search.mockResolvedValue([]);

      const result = await tool.execute({ errorMessage: 'Some random error' });

      expect(result.content).toMatch(/Unknown error/);
      expect(result.content).toMatch(/General Troubleshooting Steps/);
      expect(result.metadata?.matchType).toBe('fallback');
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle empty error message', async () => {
      const result = await tool.execute({ errorMessage: '' });

      expect(result.content).toMatch(/Please provide an error message/);
      expect(result.metadata?.success).toBe(false);
    });
  });

  describe('pattern matching (Step 1)', () => {
    it('should match NotAuthenticated error pattern', async () => {
      const result = await tool.execute({ errorMessage: 'NotAuthenticated: Invalid token' });

      expect(mockVectorSearch.search).not.toHaveBeenCalled();
      expect(result.content).toMatch(/authentication/);
      expect(result.metadata?.matchType).toBe('pattern');
    });

    it('should match NotFound error pattern', async () => {
      const result = await tool.execute({ errorMessage: 'NotFound: Resource not found' });

      expect(result.content).toMatch(/database/);
      expect(result.metadata?.matchType).toBe('pattern');
    });

    it('should match BadRequest error pattern', async () => {
      const result = await tool.execute({ errorMessage: 'BadRequest: Invalid data' });

      expect(result.content).toMatch(/validation/);
      expect(result.metadata?.matchType).toBe('pattern');
    });

    it('should be case-insensitive', async () => {
      const result = await tool.execute({ errorMessage: 'notauthenticated: no token' });

      expect(result.metadata?.matchType).toBe('pattern');
      expect(result.metadata?.success).toBe(true);
    });

    it('should prioritize longer patterns (more specific)', async () => {
      const result = await tool.execute({ errorMessage: 'NotAuthenticated error occurred' });

      expect(result.content).toMatch(/authentication/);
      expect(result.metadata?.matchType).toBe('pattern');
    });

    it('should include stack trace in pattern matching', async () => {
      const result = await tool.execute({
        errorMessage: 'Some error',
        stackTrace: 'at NotAuthenticated (/path/to/file.js:123)',
      });

      expect(result.metadata?.matchType).toBe('pattern');
      expect(result.content).toMatch(/authentication/);
    });
  });

  describe('vector search fallback (Step 2)', () => {
    it('should use vector search when no pattern matches', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'error-not-authenticated', score: 0.85 }]);

      const result = await tool.execute({ errorMessage: 'Authentication failed somehow' });

      expect(mockVectorSearch.search).toHaveBeenCalledTimes(1);
      expect(mockVectorSearch.search).toHaveBeenCalledWith(
        'Authentication failed somehow',
        expect.any(Array),
        3,
        0.2
      );
      expect(result.metadata?.matchType).toBe('semantic');
      expect(result.metadata?.score).toBe(0.85);
      expect(result.metadata?.success).toBe(true);
    });

    it('should include confidence score for semantic matches', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'error-bad-request', score: 0.78 }]);

      const result = await tool.execute({ errorMessage: 'Invalid input provided' });

      expect(result.content).toMatch(/Confidence: 78\.0%/);
      expect(result.metadata?.matchType).toBe('semantic');
    });

    it('should find semantically similar errors', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'error-forbidden', score: 0.82 }]);

      const result = await tool.execute({ errorMessage: 'Access denied to resource' });

      expect(mockVectorSearch.search).toHaveBeenCalled();
      expect(result.content).toMatch(/permission/);
      expect(result.metadata?.matchType).toBe('semantic');
    });

    it('should include stack trace in vector search query', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'error-not-found', score: 0.9 }]);

      await tool.execute({
        errorMessage: 'Error occurred',
        stackTrace: 'Resource could not be located',
      });

      expect(mockVectorSearch.search).toHaveBeenCalledWith(
        'Error occurred Resource could not be located',
        expect.any(Array),
        3,
        0.2
      );
    });
  });

  describe('fallback guidance (Step 3)', () => {
    it('should provide general troubleshooting when no matches found', async () => {
      mockVectorSearch.search.mockResolvedValue([]);

      const result = await tool.execute({ errorMessage: 'Unknown error XYZ123' });

      expect(result.content).toMatch(/Unknown error/);
      expect(result.content).toMatch(/General Troubleshooting Steps/);
      expect(result.content).toMatch(/Check the full stack trace/);
      expect(result.content).toMatch(/Enable debug logging/);
      expect(result.metadata?.matchType).toBe('fallback');
    });

    it('should include the original error message in fallback', async () => {
      mockVectorSearch.search.mockResolvedValue([]);

      const result = await tool.execute({ errorMessage: 'My custom error' });

      expect(result.content).toContain('My custom error');
    });

    it('should provide common error categories in fallback', async () => {
      mockVectorSearch.search.mockResolvedValue([]);

      const result = await tool.execute({ errorMessage: 'Unknown' });

      expect(result.content).toMatch(/Common Error Categories/);
      expect(result.content).toMatch(/Authentication/);
      expect(result.content).toMatch(/Validation/);
      expect(result.content).toMatch(/Database/);
    });
  });

  describe('version filtering', () => {
    it('should filter errors by version v6 by default', async () => {
      const result = await tool.execute({ errorMessage: 'NotAuthenticated' });

      // Should match v6 error, not v5
      expect(result.content).toMatch(/authentication/);
      expect(result.metadata?.success).toBe(true);
    });

    it('should filter errors by version v5', async () => {
      const result = await tool.execute({ errorMessage: 'LegacyError', version: 'v5' });

      expect(result.content).toMatch(/V5 specific error/);
    });

    it('should include both version when error version is both', async () => {
      const errorBoth: ErrorEntry = {
        ...mockErrors[0],
        id: 'error-both',
        version: 'both',
      };
      mockLoader.load.mockResolvedValue([errorBoth]);

      const result = await tool.execute({ errorMessage: 'NotAuthenticated' });

      expect(result.metadata?.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle missing error message', async () => {
      const result = await tool.execute({} as any);

      expect(result.content).toMatch(/Please provide an error message/);
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle empty knowledge base', async () => {
      mockLoader.load.mockResolvedValue([]);

      const result = await tool.execute({ errorMessage: 'Some error' });

      expect(result.content).toMatch(/General Troubleshooting Steps/);
      expect(result.metadata?.matchType).toBe('fallback');
    });

    it('should handle null params', async () => {
      const result = await tool.execute(null as any);

      expect(result.content).toMatch(/Please provide an error message/);
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle undefined params', async () => {
      const result = await tool.execute(undefined as any);

      expect(result.content).toMatch(/Please provide an error message/);
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle vector search returning invalid doc id', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'non-existent', score: 0.9 }]);

      const result = await tool.execute({ errorMessage: 'Test error' });

      // Should fall back to general guidance
      expect(result.content).toMatch(/General Troubleshooting Steps/);
    });

    it('should handle invalid regex patterns gracefully', async () => {
      const errorWithBadPattern: ErrorEntry = {
        ...mockErrors[0],
        id: 'bad-pattern',
        pattern: '[invalid(regex',
      };
      mockLoader.load.mockResolvedValue([errorWithBadPattern]);

      // Should not throw, should skip the invalid pattern
      const result = await tool.execute({ errorMessage: 'test' });

      expect(result).toBeDefined();
    });
  });

  describe('metadata', () => {
    it('should include metadata for pattern matches', async () => {
      const result = await tool.execute({ errorMessage: 'NotAuthenticated' });

      expect(result.metadata?.tool).toBe('troubleshoot_error');
      expect(result.metadata?.errorId).toBe('error-not-authenticated');
      expect(result.metadata?.category).toBe('authentication');
      expect(result.metadata?.matchType).toBe('pattern');
      expect(result.metadata?.success).toBe(true);
    });

    it('should include metadata for semantic matches', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'error-not-authenticated', score: 0.85 }]);

      const result = await tool.execute({ errorMessage: 'Auth failed' });

      expect(result.metadata?.matchType).toBe('semantic');
      expect(result.metadata?.score).toBe(0.85);
      expect(result.metadata?.errorId).toBe('error-not-authenticated');
    });

    it('should include tags in metadata', async () => {
      const result = await tool.execute({ errorMessage: 'NotAuthenticated' });

      expect(result.metadata?.tags).toEqual(['auth', 'security']);
    });
  });

  describe('content formatting', () => {
    it('should format pattern match response correctly', async () => {
      const result = await tool.execute({ errorMessage: 'NotAuthenticated' });

      expect(result.content).toMatch(/Category: authentication/);
      expect(result.content).toMatch(/Error ID: error-not-authenticated/);
      expect(result.content).toMatch(/Match Type: Exact Pattern/);
      expect(result.content).toMatch(/Cause:/);
      expect(result.content).toMatch(/Solution:/);
      expect(result.content).toMatch(/Example:/);
    });

    it('should format semantic match response correctly', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'error-bad-request', score: 0.88 }]);

      const result = await tool.execute({ errorMessage: 'Invalid data sent' });

      expect(result.content).toMatch(/Match Type: Semantic Similarity/);
      expect(result.content).toMatch(/Confidence: 88\.0%/);
    });

    it('should include related tags when available', async () => {
      const result = await tool.execute({ errorMessage: 'NotAuthenticated' });

      expect(result.content).toMatch(/Related:/);
      expect(result.content).toMatch(/auth, security/);
    });

    it('should handle errors without example field', async () => {
      const errorNoExample: ErrorEntry = {
        ...mockErrors[0],
        id: 'no-example',
        example: '',
      };
      mockLoader.load.mockResolvedValue([errorNoExample]);

      const result = await tool.execute({ errorMessage: 'NotAuthenticated' });

      expect(result.content).toMatch(/Solution:/);
      expect(result.content).not.toMatch(/Example:/);
    });
  });

  describe('hybrid approach validation', () => {
    it('should prefer pattern matching over vector search', async () => {
      // Even if vector search would return results, pattern match should win
      mockVectorSearch.search.mockResolvedValue([{ id: 'error-bad-request', score: 0.95 }]);

      const result = await tool.execute({ errorMessage: 'NotAuthenticated error' });

      // Should use pattern match, not vector search
      expect(mockVectorSearch.search).not.toHaveBeenCalled();
      expect(result.metadata?.matchType).toBe('pattern');
      expect(result.content).toMatch(/authentication/);
    });

    it('should only use vector search when pattern matching fails', async () => {
      mockVectorSearch.search.mockResolvedValue([{ id: 'error-bad-request', score: 0.85 }]);

      const result = await tool.execute({ errorMessage: 'Data validation failed' });

      expect(mockVectorSearch.search).toHaveBeenCalledTimes(1);
      expect(result.metadata?.matchType).toBe('semantic');
    });

    it('should use fallback only when both pattern and vector search fail', async () => {
      mockVectorSearch.search.mockResolvedValue([]);

      const result = await tool.execute({ errorMessage: 'Completely unknown error type' });

      expect(result.metadata?.matchType).toBe('fallback');
    });
  });

  describe('edge cases', () => {
    it('should handle very long error messages', async () => {
      const longError = 'Error: ' + 'x'.repeat(10000);

      const result = await tool.execute({ errorMessage: longError });

      expect(result).toBeDefined();
      expect(result.content).toBeTruthy();
    });

    it('should handle special characters in error message', async () => {
      const result = await tool.execute({
        errorMessage: 'NotAuthenticated: $pecial ch@r$!',
      });

      expect(result.metadata?.success).toBe(true);
    });

    it('should handle multiline error messages', async () => {
      const multilineError = 'NotAuthenticated\nLine 2\nLine 3';

      const result = await tool.execute({ errorMessage: multilineError });

      expect(result.metadata?.matchType).toBe('pattern');
      expect(result.metadata?.success).toBe(true);
    });

    it('should trim whitespace from error message', async () => {
      const result = await tool.execute({ errorMessage: '   NotAuthenticated   ' });

      expect(result.metadata?.success).toBe(true);
    });
  });
});
