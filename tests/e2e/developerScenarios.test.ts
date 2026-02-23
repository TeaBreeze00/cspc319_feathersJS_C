import { DocEntry } from '../../src/knowledge/types';
import { sendMcpRequest } from '../integration/helpers';
import { resetIntegrationServer } from '../integration/setup';
import * as vectorSearchModule from '../../src/tools/search/vectorSearch';

jest.mock('../../src/tools/search/vectorSearch', () => ({
  vectorSearch: {
    search: jest.fn(),
  },
}));

const mockedVectorSearch = vectorSearchModule.vectorSearch as jest.Mocked<
  typeof vectorSearchModule.vectorSearch
>;

describe('Developer scenarios (E2E)', () => {
  beforeEach(() => {
    resetIntegrationServer();
    mockedVectorSearch.search.mockImplementation(
      async (query: string, docs: DocEntry[], limit = 10): Promise<Array<{ id: string; score: number }>> => {
        const q = query.toLowerCase();
        const matches = docs
          .map((doc) => ({
            id: doc.id,
            score: `${doc.heading} ${doc.rawContent}`.toLowerCase().includes(q) ? 1 : 0,
          }))
          .filter((entry) => entry.score > 0)
          .slice(0, limit);
        return matches;
      }
    );
  });

  test('Ava workflow: discover tools -> generate service -> validate output', async () => {
    const toolsResponse = await sendMcpRequest('tools/call', {
      name: 'list_available_tools',
      arguments: {},
    });
    expect((toolsResponse.result as { content: string }).content).toContain('generate_service');

    const generatedResponse = await sendMcpRequest('tools/call', {
      name: 'generate_service',
      arguments: {
        name: 'tasks',
        database: 'sqlite',
        fields: [
          { name: 'title', type: 'string', required: true },
          { name: 'done', type: 'boolean', required: false },
        ],
      },
    });

    const generated = JSON.parse((generatedResponse.result as { content: string }).content) as {
      files: Record<string, { content: string }>;
    };
    const serviceCode = generated.files['src/services/tasks/tasks.service.ts'].content;

    const validateResponse = await sendMcpRequest('tools/call', {
      name: 'validate_code',
      arguments: {
        code: serviceCode,
        checks: ['typescript'],
      },
    });

    const validated = JSON.parse((validateResponse.result as { content: string }).content) as {
      valid: boolean;
    };
    expect(validated.valid).toBe(true);
  });

  test('Marco workflow: validate problematic code -> explain quality concept', async () => {
    const invalidCodeResponse = await sendMcpRequest('tools/call', {
      name: 'validate_code',
      arguments: {
        code: 'const user = ;',
        checks: ['typescript'],
      },
    });

    const invalidResult = JSON.parse((invalidCodeResponse.result as { content: string }).content) as {
      valid: boolean;
    };
    expect(invalidResult.valid).toBe(false);

    const conceptResponse = await sendMcpRequest('tools/call', {
      name: 'explain_concept',
      arguments: { concept: 'hooks' },
    });

    const conceptContent = (conceptResponse.result as { content: string }).content;
    expect(conceptContent).toContain('# ');
    expect(conceptContent).toContain('Version:');
  });

  test('Jason workflow: explain concept -> search docs -> iterate on generated code', async () => {
    const explainResponse = await sendMcpRequest('tools/call', {
      name: 'explain_concept',
      arguments: { concept: 'services' },
    });
    expect((explainResponse.result as { content: string }).content).toContain('# ');

    const searchResponse = await sendMcpRequest('tools/call', {
      name: 'search_docs',
      arguments: { query: 'services', version: 'all', limit: 5 },
    });
    const searchPayload = JSON.parse((searchResponse.result as { content: string }).content) as {
      results: Array<{ id: string }>;
    };
    expect(searchPayload.results.length).toBeGreaterThan(0);

    const generatedResponse = await sendMcpRequest('tools/call', {
      name: 'generate_service',
      arguments: {
        name: 'messages',
        database: 'mongodb',
        fields: [{ name: 'text', type: 'string', required: true }],
      },
    });
    const generated = JSON.parse((generatedResponse.result as { content: string }).content) as {
      files: Record<string, { content: string }>;
    };
    expect(generated.files['src/services/messages/messages.hooks.ts'].content).toContain('before:');
  });
});
