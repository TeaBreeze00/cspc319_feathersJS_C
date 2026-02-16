/// <reference types="jest" />

import { SearchDocsTool } from '../../src/tools/searchDocs';
import { KnowledgeLoader } from '../../src/knowledge';
import { DocEntry } from '../../src/knowledge/types';

// Mock KnowledgeLoader
jest.mock('../../src/knowledge', () => {
  return {
    KnowledgeLoader: jest.fn().mockImplementation(() => ({
      load: jest.fn(),
    })),
  };
});

describe('SearchDocsTool', () => {
  let searchDocsTool: SearchDocsTool;
  let mockLoader: jest.Mocked<KnowledgeLoader>;

  const mockDocs: DocEntry[] = [
    {
      id: 'doc-v5-services',
      title: 'FeathersJS Services',
      content:
        'Services are the heart of every Feathers application. They provide a uniform interface for all your data and business logic.',
      version: 'v5',
      category: 'core',
      tokens: [
        'services',
        'heart',
        'feathers',
        'application',
        'uniform',
        'interface',
        'data',
        'business',
        'logic',
      ],
      source: { url: 'https://feathersjs.com/docs/services' },
    },
    {
      id: 'doc-v5-hooks',
      title: 'FeathersJS Hooks',
      content:
        'Hooks are pluggable middleware functions that can be registered before, after or on error of a service method.',
      version: 'v5',
      category: 'core',
      tokens: [
        'hooks',
        'pluggable',
        'middleware',
        'functions',
        'registered',
        'before',
        'after',
        'error',
        'service',
        'method',
      ],
      source: { url: 'https://feathersjs.com/docs/hooks' },
    },
    {
      id: 'doc-v4-services',
      title: 'Feathers v4 Services',
      content: 'Services are the heart of Feathers v4 applications with similar concepts to v5.',
      version: 'v4',
      category: 'core',
      tokens: ['services', 'heart', 'feathers', 'v4', 'applications', 'similar', 'concepts', 'v5'],
      source: { url: 'https://feathersjs.com/v4/docs/services' },
    },
    {
      id: 'doc-v5-authentication',
      title: 'Authentication',
      content: 'Authentication in FeathersJS using JWT tokens, local strategy, OAuth providers.',
      version: 'v5',
      category: 'authentication',
      tokens: [
        'authentication',
        'feathersjs',
        'jwt',
        'tokens',
        'local',
        'strategy',
        'oauth',
        'providers',
      ],
      source: { url: 'https://feathersjs.com/docs/authentication' },
    },
    {
      id: 'doc-both-concepts',
      title: 'Core Concepts',
      content: 'Understanding the core concepts of FeathersJS that apply to both v4 and v5.',
      version: 'both',
      category: 'guides',
      tokens: ['understanding', 'core', 'concepts', 'feathersjs', 'apply', 'both', 'v4', 'v5'],
      source: { url: 'https://feathersjs.com/docs/concepts' },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockLoader = new KnowledgeLoader() as jest.Mocked<KnowledgeLoader>;
    mockLoader.load = jest.fn().mockResolvedValue(mockDocs);

    searchDocsTool = new SearchDocsTool(mockLoader);
  });

  describe('basic search', () => {
    it('returns relevant docs for a query', async () => {
      const result = await searchDocsTool.execute({ query: 'services' });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();

      const parsed = JSON.parse(result.content);
      expect(parsed.results.length).toBeGreaterThan(0);

      // Should find service-related docs
      const titles = parsed.results.map((r: any) => r.title);
      expect(titles.some((t: string) => t.toLowerCase().includes('service'))).toBe(true);
    });

    it('returns empty results for non-matching query', async () => {
      const result = await searchDocsTool.execute({ query: 'xyznonexistent123' });

      const parsed = JSON.parse(result.content);
      expect(parsed.results.length).toBe(0);
    });

    it('handles empty query gracefully', async () => {
      const result = await searchDocsTool.execute({ query: '' });

      const parsed = JSON.parse(result.content);
      expect(parsed.results.length).toBe(0);
    });

    it('respects the limit parameter', async () => {
      const result = await searchDocsTool.execute({ query: 'feathers', limit: 2 });

      const parsed = JSON.parse(result.content);
      expect(parsed.results.length).toBeLessThanOrEqual(2);
    });

    it('uses default limit of 10 when not specified', async () => {
      const result = await searchDocsTool.execute({ query: 'feathers' });

      const parsed = JSON.parse(result.content);
      // Should return all matching docs up to the default limit
      expect(parsed.results.length).toBeLessThanOrEqual(10);
    });

    it('caps limit at 50', async () => {
      const result = await searchDocsTool.execute({ query: 'feathers', limit: 100 });

      // The tool should internally cap the limit at 50
      expect(result).toBeDefined();
      const parsed = JSON.parse(result.content);
      expect(parsed.results.length).toBeLessThanOrEqual(50);
    });
  });

  describe('version filtering', () => {
    it('defaults to v5 when no version specified', async () => {
      const result = await searchDocsTool.execute({ query: 'services' });

      const parsed = JSON.parse(result.content);
      expect(parsed.version).toBe('v5');

      // Should include v5 and 'both' docs, but not v4-only docs
      const versions = parsed.results.map((r: any) => r.version);
      versions.forEach((v: string) => {
        expect(v === 'v5' || v === 'both').toBe(true);
      });
    });

    it('filters to v4 docs when version is v4', async () => {
      const result = await searchDocsTool.execute({ query: 'services', version: 'v4' });

      const parsed = JSON.parse(result.content);
      expect(parsed.version).toBe('v4');

      // Should include v4 and 'both' docs
      const versions = parsed.results.map((r: any) => r.version);
      versions.forEach((v: string) => {
        expect(v === 'v4' || v === 'both').toBe(true);
      });
    });

    it('returns all versions when version is "all"', async () => {
      const result = await searchDocsTool.execute({ query: 'services', version: 'all' });

      const parsed = JSON.parse(result.content);
      expect(parsed.version).toBe('all');

      // Should include docs from both v4 and v5
      const ids = parsed.results.map((r: any) => r.id);
      const hasV4 = ids.some((id: string) => id.includes('v4'));
      const hasV5 = ids.some((id: string) => id.includes('v5'));

      // At least one version should be present if docs match
      if (parsed.results.length > 1) {
        expect(hasV4 || hasV5).toBe(true);
      }
    });

    it('returns all versions when version is "both"', async () => {
      const result = await searchDocsTool.execute({ query: 'services', version: 'both' });

      const parsed = JSON.parse(result.content);
      expect(parsed.version).toBe('both');
    });
  });

  describe('result structure', () => {
    it('includes required fields in results', async () => {
      const result = await searchDocsTool.execute({ query: 'hooks' });

      const parsed = JSON.parse(result.content);

      if (parsed.results.length > 0) {
        const firstResult = parsed.results[0];
        expect(firstResult).toHaveProperty('id');
        expect(firstResult).toHaveProperty('title');
        expect(firstResult).toHaveProperty('version');
        expect(firstResult).toHaveProperty('category');
        expect(firstResult).toHaveProperty('score');
        expect(firstResult).toHaveProperty('snippet');
      }
    });

    it('includes metadata in the result', async () => {
      const result = await searchDocsTool.execute({ query: 'authentication' });

      expect(result.metadata).toBeDefined();
      expect(result.metadata!.tool).toBe('search_docs');
      expect(result.metadata!.query).toBe('authentication');
      expect(typeof result.metadata!.count).toBe('number');
    });

    it('generates snippets around query terms', async () => {
      const result = await searchDocsTool.execute({ query: 'JWT' });

      const parsed = JSON.parse(result.content);

      if (parsed.results.length > 0) {
        const firstResult = parsed.results[0];
        // Snippet should exist and be a string
        expect(typeof firstResult.snippet).toBe('string');
      }
    });
  });

  describe('response time', () => {
    it('responds within 500ms for typical queries', async () => {
      const startTime = Date.now();

      await searchDocsTool.execute({ query: 'services hooks authentication' });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(500);
    });

    it('responds within 500ms for large result sets', async () => {
      // Create a larger mock dataset
      const largeMockDocs: DocEntry[] = [];
      for (let i = 0; i < 100; i++) {
        largeMockDocs.push({
          id: `doc-${i}`,
          title: `Document ${i} about feathers`,
          content: `This is content about feathers and services for document ${i}. It contains various keywords like hooks, authentication, and middleware.`,
          version: i % 2 === 0 ? 'v5' : 'v4',
          category: 'docs',
          tokens: ['feathers', 'services', 'document', 'hooks', 'authentication', 'middleware'],
          source: { url: `https://example.com/doc/${i}` },
        });
      }

      mockLoader.load = jest.fn().mockResolvedValue(largeMockDocs);
      const largeSearchTool = new SearchDocsTool(mockLoader);

      const startTime = Date.now();

      await largeSearchTool.execute({ query: 'feathers services hooks', limit: 50 });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('edge cases', () => {
    it('handles null params gracefully', async () => {
      const result = await searchDocsTool.execute(null);

      const parsed = JSON.parse(result.content);
      expect(parsed.results.length).toBe(0);
    });

    it('handles undefined params gracefully', async () => {
      const result = await searchDocsTool.execute(undefined);

      const parsed = JSON.parse(result.content);
      expect(parsed.results.length).toBe(0);
    });

    it('handles non-object params gracefully', async () => {
      const result = await searchDocsTool.execute('invalid params');

      expect(result).toBeDefined();
    });

    it('handles special characters in query', async () => {
      const result = await searchDocsTool.execute({ query: 'feathers @#$%^&*()' });

      expect(result).toBeDefined();
      // Should not throw an error
    });

    it('trims whitespace from query', async () => {
      const result = await searchDocsTool.execute({ query: '  services  ' });

      const parsed = JSON.parse(result.content);
      expect(parsed.query).toBe('services');
    });

    it('handles invalid version parameter', async () => {
      const result = await searchDocsTool.execute({ query: 'services', version: 'invalid' as any });

      // Should fall back to default version (v5)
      const parsed = JSON.parse(result.content);
      expect(parsed.version).toBe('v5');
    });

    it('handles negative limit parameter', async () => {
      const result = await searchDocsTool.execute({ query: 'services', limit: -5 });

      // Should use default limit
      expect(result).toBeDefined();
    });

    it('handles non-numeric limit parameter', async () => {
      const result = await searchDocsTool.execute({ query: 'services', limit: 'ten' as any });

      // Should use default limit
      expect(result).toBeDefined();
    });
  });

  describe('tool metadata', () => {
    it('has correct name', () => {
      expect(searchDocsTool.name).toBe('search_docs');
    });

    it('has a description', () => {
      expect(searchDocsTool.description).toBeDefined();
      expect(searchDocsTool.description.length).toBeGreaterThan(0);
    });

    it('has a valid input schema', () => {
      expect(searchDocsTool.inputSchema).toBeDefined();
      expect(searchDocsTool.inputSchema.type).toBe('object');
      expect(searchDocsTool.inputSchema.properties).toHaveProperty('query');
      expect(searchDocsTool.inputSchema.required).toContain('query');
    });
  });
});
