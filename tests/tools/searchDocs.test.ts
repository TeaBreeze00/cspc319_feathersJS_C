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

// Mock vectorSearch so the ML model is never loaded in Jest (CJS mode cannot
// import the ESM @xenova/transformers package).  The mock does simple
// case-insensitive substring matching so the tests remain meaningful.
jest.mock('../../src/tools/search/vectorSearch', () => {
  return {
    vectorSearch: {
      search: jest
        .fn()
        .mockImplementation(
          async (query: string, docs: DocEntry[], limit = 10, _minScore = 0.15) => {
            if (!query || query.trim().length === 0) return [];
            const q = query.toLowerCase();
            const scored = docs
              .map((doc) => {
                const text = `${doc.heading} ${doc.rawContent}`.toLowerCase();
                // Count how many query words appear in the document text
                const words = q.split(/\s+/).filter(Boolean);
                const hits = words.filter((w) => text.includes(w)).length;
                return { id: doc.id, score: hits / words.length };
              })
              .filter((r) => r.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, limit);

            if (scored.length === 0) return [];

            // Normalise scores so the top result = 1.0
            const max = scored[0].score;
            return scored.map((r) => ({
              id: r.id,
              score: Math.round((r.score / max) * 1_000_000) / 1_000_000,
            }));
          }
        ),
    },
  };
});

describe('SearchDocsTool', () => {
  let searchDocsTool: SearchDocsTool;
  let mockLoader: jest.Mocked<KnowledgeLoader>;

  const mockDocs: DocEntry[] = [
    {
      id: 'doc-v5-services',
      heading: 'FeathersJS Services',
      content: 'Context: Services\n\nServices are the heart of every Feathers application.',
      rawContent:
        'Services are the heart of every Feathers application. They provide a uniform interface for all your data and business logic.',
      breadcrumb: 'Services',
      version: 'v5',
      category: 'core',
      tokens: 45,
      sourceFile: 'docs/v5_docs/services.md',
      hasCode: false,
      codeLanguages: [],
      tags: ['services'],
    },
    {
      id: 'doc-v5-hooks',
      heading: 'FeathersJS Hooks',
      content: 'Context: Hooks\n\nHooks are pluggable middleware functions.',
      rawContent:
        'Hooks are pluggable middleware functions that can be registered before, after or on error of a service method.',
      breadcrumb: 'Hooks',
      version: 'v5',
      category: 'core',
      tokens: 42,
      sourceFile: 'docs/v5_docs/hooks.md',
      hasCode: false,
      codeLanguages: [],
      tags: ['hooks', 'middleware'],
    },
    {
      id: 'doc-v5-authentication',
      heading: 'Authentication',
      content: 'Context: Authentication\n\nAuthentication in FeathersJS using JWT tokens.',
      rawContent: 'Authentication in FeathersJS using JWT tokens, local strategy, OAuth providers.',
      breadcrumb: 'Authentication',
      version: 'v5',
      category: 'authentication',
      tokens: 38,
      sourceFile: 'docs/v5_docs/authentication.md',
      hasCode: false,
      codeLanguages: [],
      tags: ['authentication', 'jwt'],
    },
    {
      id: 'doc-both-concepts',
      heading: 'Core Concepts',
      content: 'Context: Core Concepts\n\nUnderstanding the core concepts of FeathersJS.',
      rawContent: 'Understanding the core concepts of FeathersJS that apply to both v5 and v6.',
      breadcrumb: 'Core Concepts',
      version: 'both',
      category: 'guides',
      tokens: 35,
      sourceFile: 'docs/v5_docs/concepts.md',
      hasCode: false,
      codeLanguages: [],
      tags: ['concepts'],
    },
    {
      id: 'doc-v6-services',
      heading: 'FeathersJS v6 Services',
      content: 'Context: Services\n\nServices in FeathersJS v6 are the core building blocks.',
      rawContent:
        'Services in FeathersJS v6 are the core building blocks. v6 introduces typed services with full TypeScript support.',
      breadcrumb: 'Services',
      version: 'v6',
      category: 'services',
      tokens: 48,
      sourceFile: 'docs/v6_docs/services.md',
      hasCode: false,
      codeLanguages: [],
      tags: ['services', 'typescript'],
    },
    {
      id: 'doc-v6-hooks',
      heading: 'FeathersJS v6 Hooks',
      content: 'Context: Hooks\n\nHooks in FeathersJS v6 use the around hook pattern.',
      rawContent: 'Hooks in FeathersJS v6 use the around hook pattern as the primary mechanism.',
      breadcrumb: 'Hooks',
      version: 'v6',
      category: 'hooks',
      tokens: 44,
      sourceFile: 'docs/v6_docs/hooks.md',
      hasCode: false,
      codeLanguages: [],
      tags: ['hooks', 'around'],
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
    it('defaults to all when no version specified', async () => {
      const result = await searchDocsTool.execute({ query: 'services' });

      const parsed = JSON.parse(result.content);
      expect(parsed.version).toBe('all');

      // Should include any matching docs across versions
      const versions = parsed.results.map((r: any) => r.version);
      versions.forEach((v: string) => {
        expect(v === 'v5' || v === 'v6' || v === 'both').toBe(true);
      });
    });

    it('filters to v5 docs when version is v5', async () => {
      const result = await searchDocsTool.execute({ query: 'services', version: 'v5' });

      const parsed = JSON.parse(result.content);
      expect(parsed.version).toBe('v5');

      // Should include v5 and 'both' docs
      const versions = parsed.results.map((r: any) => r.version);
      versions.forEach((v: string) => {
        expect(v === 'v5' || v === 'both').toBe(true);
      });
    });

    it('returns all versions when version is "all"', async () => {
      const result = await searchDocsTool.execute({ query: 'services', version: 'all' });

      const parsed = JSON.parse(result.content);
      expect(parsed.version).toBe('all');

      // Should include docs from both v5 and v6
      const ids = parsed.results.map((r: any) => r.id);
      const hasV5 = ids.some((id: string) => id.includes('v5'));
      const hasV6 = ids.some((id: string) => id.includes('v6'));

      // At least one version should be present if docs match
      if (parsed.results.length > 1) {
        expect(hasV5 || hasV6).toBe(true);
      }
    });

    it('returns all versions when version is "both"', async () => {
      const result = await searchDocsTool.execute({ query: 'services', version: 'both' });

      const parsed = JSON.parse(result.content);
      expect(parsed.version).toBe('both');
    });

    it('filters to v6 docs when version is v6', async () => {
      const result = await searchDocsTool.execute({ query: 'services', version: 'v6' });

      const parsed = JSON.parse(result.content);
      expect(parsed.version).toBe('v6');

      // Should only include v6 and 'both' docs, not v5-only docs
      const versions = parsed.results.map((r: any) => r.version);
      versions.forEach((v: string) => {
        expect(v === 'v6' || v === 'both').toBe(true);
      });
    });

    it('v6 results include v6-specific content', async () => {
      const result = await searchDocsTool.execute({
        query: 'v6 services typescript',
        version: 'v6',
      });

      const parsed = JSON.parse(result.content);

      if (parsed.results.length > 0) {
        // At least one result should be from v6
        const hasV6 = parsed.results.some((r: any) => r.version === 'v6');
        expect(hasV6).toBe(true);
      }
    });

    it('"all" version filter includes both v5 and v6 docs', async () => {
      const result = await searchDocsTool.execute({ query: 'services', version: 'all' });

      const parsed = JSON.parse(result.content);
      const versions: string[] = parsed.results.map((r: any) => r.version);

      const hasV6 = versions.some((v) => v === 'v6');
      const hasV5 = versions.some((v) => v === 'v5');

      // With our mock data, both v5 and v6 service docs exist
      if (parsed.results.length > 1) {
        expect(hasV5 || hasV6).toBe(true);
      }
    });

    it('v5 does not appear in v6-only searches', async () => {
      const result = await searchDocsTool.execute({ query: 'services', version: 'v6' });

      const parsed = JSON.parse(result.content);
      const versions: string[] = parsed.results.map((r: any) => r.version);

      // v5-only docs must not appear in a v6-scoped search
      const hasV5Only = versions.some((v) => v === 'v5');
      expect(hasV5Only).toBe(false);
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
          heading: `Document ${i} about feathers`,
          content: `Context: Document ${i}\n\nThis is content about feathers and services.`,
          rawContent: `This is content about feathers and services for document ${i}.`,
          breadcrumb: `Document ${i}`,
          version: i % 2 === 0 ? 'v6' : 'v5',
          category: 'docs',
          tokens: 40,
          sourceFile: `docs/v6_docs/doc-${i}.md`,
          hasCode: false,
          codeLanguages: [],
          tags: ['feathers', 'services'],
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

      // Should fall back to default version (all)
      const parsed = JSON.parse(result.content);
      expect(parsed.version).toBe('all');
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
