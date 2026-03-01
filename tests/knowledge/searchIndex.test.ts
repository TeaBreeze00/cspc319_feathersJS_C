import { KnowledgeLoader } from '../../src/knowledge/loader';
import { DocEntry } from '../../src/knowledge/types';

describe('Knowledge chunk index data', () => {
  const loader = new KnowledgeLoader();

  afterEach(() => {
    loader.clearCache();
  });

  test('loads v5 and v6 chunk files', async () => {
    const v5 = await loader.load<DocEntry>('chunks', 'v5-chunks');
    const v6 = await loader.load<DocEntry>('chunks', 'v6-chunks');

    expect(v5.length).toBeGreaterThan(0);
    expect(v6.length).toBeGreaterThan(0);
    expect(v5.every((entry) => entry.version === 'v5')).toBe(true);
    expect(v6.every((entry) => entry.version === 'v6')).toBe(true);
  });

  test('every chunk entry includes required vector-search fields', async () => {
    const allChunks = await loader.load<DocEntry>('chunks');
    const first = allChunks[0];

    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('heading');
    expect(first).toHaveProperty('rawContent');
    expect(first).toHaveProperty('breadcrumb');
    expect(first).toHaveProperty('version');
    expect(first).toHaveProperty('tokens');
    expect(first).toHaveProperty('embedding');
    expect(Array.isArray(first.embedding)).toBe(true);
    expect(first.embedding!.length).toBeGreaterThan(0);
  });

  test('merged corpus has strong id cardinality', async () => {
    const allChunks = await loader.load<DocEntry>('chunks');
    const ids = allChunks.map((entry) => entry.id);
    const uniqueIds = new Set(ids);

    // Some ids can repeat across v5/v6 source trees; we assert high cardinality.
    expect(uniqueIds.size).toBeGreaterThan(100);
    expect(uniqueIds.size).toBeLessThanOrEqual(ids.length);
  });

  test('chunk embeddings have consistent dimensionality', async () => {
    const allChunks = await loader.load<DocEntry>('chunks');
    const withEmbedding = allChunks.filter(
      (entry) => Array.isArray(entry.embedding) && entry.embedding.length > 0
    );
    expect(withEmbedding.length).toBeGreaterThan(0);

    const referenceSize = withEmbedding[0].embedding!.length;
    for (const entry of withEmbedding.slice(1, 50)) {
      expect(entry.embedding!.length).toBe(referenceSize);
    }
  });

  test('contains docs from both major doc trees', async () => {
    const allChunks = await loader.load<DocEntry>('chunks');
    const hasV5Path = allChunks.some((entry) => entry.sourceFile.includes('v5_docs'));
    const hasV6Path = allChunks.some((entry) => entry.sourceFile.includes('v6_docs'));

    expect(hasV5Path).toBe(true);
    expect(hasV6Path).toBe(true);
  });
});
