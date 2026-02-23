import { ExplainConceptTool } from '../../src/tools/explainConcept';
import { KnowledgeLoader } from '../../src/knowledge';
import { DocEntry } from '../../src/knowledge/types';
import * as vectorSearchModule from '../../src/tools/search/vectorSearch';

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

  const mockDocs: DocEntry[] = [
    {
      id: 'doc-hooks',
      heading: 'Hooks',
      content: 'Context: Hooks\n\nHooks are middleware functions.',
      rawContent: 'Hooks are middleware functions.',
      breadcrumb: 'Hooks',
      version: 'v6',
      tokens: 20,
      category: 'core-concepts',
      sourceFile: 'docs/v6_docs/api/hooks.md',
      hasCode: false,
      codeLanguages: [],
      tags: ['hooks'],
      embedding: [0.1, 0.2],
    },
    {
      id: 'doc-before-hooks',
      heading: 'Before hooks',
      content: 'Context: Hooks > Before hooks\n\nBefore hooks run first.',
      rawContent: 'Before hooks run first.',
      breadcrumb: 'Hooks > Before hooks',
      version: 'v6',
      tokens: 16,
      category: 'hooks',
      sourceFile: 'docs/v6_docs/api/hooks.md',
      hasCode: false,
      codeLanguages: [],
      tags: ['hooks', 'before'],
      embedding: [0.2, 0.1],
    },
  ];

  beforeEach(() => {
    mockLoader = {
      load: jest.fn().mockResolvedValue(mockDocs),
    } as unknown as jest.Mocked<KnowledgeLoader>;
    tool = new ExplainConceptTool(mockLoader);
    mockVectorSearch.search.mockReset();
  });

  test('loads chunk docs and asks vector search for top matches', async () => {
    mockVectorSearch.search.mockResolvedValue([{ id: 'doc-hooks', score: 0.95 }]);

    const result = await tool.execute({ concept: 'hooks' });

    expect(mockLoader.load).toHaveBeenCalledWith('chunks');
    expect(mockVectorSearch.search).toHaveBeenCalledWith('hooks', mockDocs, 5, 0.1);
    expect(result.content).toContain('# Hooks');
    expect(result.content).toContain('Path: Hooks');
    expect(result.content).toContain('Version: v6');
    expect(result.metadata?.success).toBe(true);
  });

  test('includes related entries when multiple matches are returned', async () => {
    mockVectorSearch.search.mockResolvedValue([
      { id: 'doc-hooks', score: 0.95 },
      { id: 'doc-before-hooks', score: 0.88 },
    ]);

    const result = await tool.execute({ concept: 'hooks' });

    expect(result.content).toContain('## Related');
    expect(result.content).toContain('Hooks > Before hooks');
    expect(result.metadata?.relatedCount).toBe(1);
  });

  test('returns guidance when concept is unknown', async () => {
    mockVectorSearch.search.mockResolvedValue([]);
    const result = await tool.execute({ concept: 'not-a-real-concept' });

    expect(result.content).toContain('not found');
    expect(result.metadata?.success).toBe(false);
  });

  test('handles empty concept', async () => {
    const result = await tool.execute({ concept: '' });
    expect(result.content).toContain('Please provide a concept');
    expect(result.metadata?.success).toBe(false);
  });

  test('handles missing params', async () => {
    const result = await tool.execute(undefined as unknown);
    expect(result.content).toContain('Please provide a concept');
    expect(result.metadata?.success).toBe(false);
  });
});
