import { performance } from 'perf_hooks';
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

function percentile(sortedValues: number[], pct: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.ceil((pct / 100) * sortedValues.length) - 1
  );
  return sortedValues[index];
}

async function measure(
  label: string,
  run: () => Promise<unknown>,
  iterations = 100,
  warmup = 5
): Promise<{ p50: number; p95: number; p99: number }> {
  for (let i = 0; i < warmup; i++) {
    await run();
  }

  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await run();
    const end = performance.now();
    samples.push(end - start);
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const metrics = {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };

  console.log(
    `[perf] ${label} p50=${metrics.p50.toFixed(2)}ms p95=${metrics.p95.toFixed(2)}ms p99=${metrics.p99.toFixed(2)}ms`
  );
  return metrics;
}

describe('Performance: response time', () => {
  jest.setTimeout(240000);

  beforeEach(() => {
    resetIntegrationServer();
    mockedVectorSearch.search.mockImplementation(
      async (query: string, docs: DocEntry[], limit = 10): Promise<Array<{ id: string; score: number }>> => {
        const q = query.toLowerCase();
        const hits = docs
          .map((doc) => {
            const text = `${doc.heading} ${doc.rawContent}`.toLowerCase();
            return { id: doc.id, score: text.includes(q) ? 1 : 0 };
          })
          .filter((entry) => entry.score > 0)
          .slice(0, limit);
        return hits;
      }
    );
  });

  test('all implemented tools meet p95 < 2000ms', async () => {
    const metricsByTool: Record<string, { p50: number; p95: number; p99: number }> = {};

    metricsByTool.search_docs = await measure('search_docs', async () => {
      await sendMcpRequest('tools/call', {
        name: 'search_docs',
        arguments: { query: 'hooks', version: 'v6', limit: 5 },
      });
    });

    metricsByTool.generate_service = await measure('generate_service', async () => {
      await sendMcpRequest('tools/call', {
        name: 'generate_service',
        arguments: {
          name: 'perfsvc',
          database: 'sqlite',
          fields: [{ name: 'title', type: 'string', required: true }],
        },
      });
    });

    metricsByTool.validate_code = await measure('validate_code', async () => {
      await sendMcpRequest('tools/call', {
        name: 'validate_code',
        arguments: {
          code: 'const value: number = 1;\nconsole.log(value);',
          checks: ['typescript'],
        },
      });
    });

    metricsByTool.explain_concept = await measure('explain_concept', async () => {
      await sendMcpRequest('tools/call', {
        name: 'explain_concept',
        arguments: { concept: 'services' },
      });
    });

    metricsByTool.list_available_tools = await measure('list_available_tools', async () => {
      await sendMcpRequest('tools/call', {
        name: 'list_available_tools',
        arguments: {},
      });
    });

    for (const [tool, metrics] of Object.entries(metricsByTool)) {
      expect(metrics.p95).toBeLessThan(2000);
      expect(metrics.p50).toBeGreaterThanOrEqual(0);
      expect(metrics.p99).toBeGreaterThanOrEqual(metrics.p95);
      console.log(`[perf-threshold] ${tool} p95=${metrics.p95.toFixed(2)}ms`);
    }
  });
});
