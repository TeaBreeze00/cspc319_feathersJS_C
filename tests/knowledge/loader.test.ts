import { KnowledgeLoader } from '../../src/knowledge/loader'
import * as path from 'path'

describe('KnowledgeLoader', () => {
  let loader: KnowledgeLoader
  const kbPath = path.join(__dirname, '../../knowledge-base')

  beforeEach(() => {
    loader = new KnowledgeLoader(kbPath)
  })

  afterEach(() => {
    loader.clearCache()
  })

  describe('preload', () => {
    test('completes without errors', async () => {
      await expect(loader.preload()).resolves.not.toThrow()
    })

    test('loads docs and templates into cache', async () => {
      await loader.preload()
      const docs = await loader.load('docs')
      const templates = await loader.load('templates')
      
      expect(docs.length).toBeGreaterThan(0)
      expect(templates.length).toBeGreaterThan(0)
    })

    test('memory usage is under 100MB', async () => {
      await loader.preload()
      const docs = await loader.load('docs')
      const templates = await loader.load('templates')
      
      const approxBytes = Buffer.byteLength(
        JSON.stringify({ docs, templates })
      )
      const approxMB = approxBytes / (1024 * 1024)
      
      expect(approxMB).toBeLessThan(100)
    })
  })

  describe('lazy loading', () => {
    test('loads snippets on demand', async () => {
      const snippets = await loader.load('snippets')
      expect(Array.isArray(snippets)).toBe(true)
      expect(snippets.length).toBeGreaterThan(0)
    })

    test('loads errors on demand', async () => {
      const errors = await loader.load('errors')
      expect(Array.isArray(errors)).toBe(true)
      expect(errors.length).toBeGreaterThan(0)
    })

    test('loads best-practices on demand', async () => {
      const bestPractices = await loader.load('best-practices')
      expect(Array.isArray(bestPractices)).toBe(true)
      expect(bestPractices.length).toBeGreaterThan(0)
    })

    test('loads specific file within category', async () => {
      const hooksServices = await loader.load('snippets', 'hooks-services')
      expect(Array.isArray(hooksServices)).toBe(true)
    })

    test('caches loaded content', async () => {
      const first = await loader.load('snippets')
      const second = await loader.load('snippets')
      expect(first).toBe(second) // Same reference = cached
    })
  })

  describe('buildIndex', () => {
    test('returns structured index with all categories', async () => {
      await loader.preload()
      const index = await loader.buildIndex()
      
      expect(index.byCategory).toBeDefined()
      expect(typeof index.byCategory).toBe('object')
      expect(index.templates).toBeDefined()
      expect(index.snippets).toBeDefined()
      expect(index.patterns).toBeDefined()
      expect(index.bestPractices).toBeDefined()
    })

    test('groups docs by category', async () => {
      await loader.preload()
      const index = await loader.buildIndex()
      
      const categories = Object.keys(index.byCategory)
      expect(categories.length).toBeGreaterThan(0)
    })
  })

  describe('clearCache', () => {
    test('clears all cached data', async () => {
      await loader.preload()
      const beforeClear = await loader.load('docs')
      expect(beforeClear.length).toBeGreaterThan(0)
      
      loader.clearCache()
      
      // After clearing, loading again should work but be a new instance
      const afterClear = await loader.load('docs')
      expect(afterClear.length).toBeGreaterThan(0)
      expect(beforeClear).not.toBe(afterClear) // Different reference
    })
  })
})
