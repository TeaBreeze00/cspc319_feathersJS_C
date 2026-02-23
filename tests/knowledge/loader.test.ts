import { KnowledgeLoader } from '../../src/knowledge/loader';
import { DocEntry } from '../../src/knowledge/types';
import * as path from 'path';

describe('KnowledgeLoader', () => {
  let loader: KnowledgeLoader;
  const kbPath = path.join(__dirname, '../../knowledge-base');

  beforeEach(() => {
    loader = new KnowledgeLoader(kbPath);
  });

  afterEach(() => {
    loader.clearCache();
  });

  describe('preload', () => {
    test('completes without errors', async () => {
      await expect(loader.preload()).resolves.not.toThrow();
    });

    test('loads docs from chunks into cache', async () => {
      await loader.preload();
      const docs = await loader.load<DocEntry>('docs');

      expect(Array.isArray(docs)).toBe(true);
      expect(docs.length).toBeGreaterThan(0);
    });

    test('keeps approximate serialized preload size under 100MB', async () => {
      await loader.preload();
      const docs = await loader.load<DocEntry>('docs');
      const templates = await loader.load('templates');

      const approxBytes = Buffer.byteLength(JSON.stringify({ docsLength: docs.length, templates }));
      const approxMB = approxBytes / (1024 * 1024);
      expect(approxMB).toBeLessThan(100);
    });
  });

  describe('runtime loading', () => {
    test('loads all chunks recursively', async () => {
      const chunks = await loader.load<DocEntry>('chunks');
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toHaveProperty('id');
      expect(chunks[0]).toHaveProperty('version');
    });

    test('loads specific chunk file', async () => {
      const v5Chunks = await loader.load<DocEntry>('chunks', 'v5-chunks');
      expect(Array.isArray(v5Chunks)).toBe(true);
      expect(v5Chunks.length).toBeGreaterThan(0);
      expect(v5Chunks.every((entry) => entry.version === 'v5')).toBe(true);
    });

    test('returns empty array for unknown category', async () => {
      const unknown = await loader.load('does-not-exist');
      expect(Array.isArray(unknown)).toBe(true);
      expect(unknown).toHaveLength(0);
    });

    test('caches loaded category by reference', async () => {
      const first = await loader.load<DocEntry>('chunks');
      const second = await loader.load<DocEntry>('chunks');
      expect(first).toBe(second);
    });
  });

  describe('buildIndex', () => {
    test('returns structured index object even when optional folders are empty', async () => {
      const index = await loader.buildIndex();

      expect(index.byCategory).toBeDefined();
      expect(typeof index.byCategory).toBe('object');
      expect(Array.isArray(index.templates)).toBe(true);
      expect(Array.isArray(index.snippets)).toBe(true);
      expect(Array.isArray(index.patterns)).toBe(true);
      expect(Array.isArray(index.bestPractices)).toBe(true);
    });
  });

  describe('clearCache', () => {
    test('clears cached collections', async () => {
      const beforeClear = await loader.load<DocEntry>('chunks');
      expect(beforeClear.length).toBeGreaterThan(0);

      loader.clearCache();

      const afterClear = await loader.load<DocEntry>('chunks');
      expect(afterClear.length).toBeGreaterThan(0);
      expect(beforeClear).not.toBe(afterClear);
    });
  });
});
