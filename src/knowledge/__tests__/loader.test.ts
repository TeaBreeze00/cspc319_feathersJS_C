import KnowledgeLoader from '../loader'

describe('KnowledgeLoader', () => {
  let loader: KnowledgeLoader

  beforeAll(() => {
    loader = new KnowledgeLoader()
  })

  afterAll(() => {
    loader.clearCache()
  })

  test('preload loads docs and templates and buildIndex returns categories', async () => {
    await loader.preload()
    const idx = await loader.buildIndex()
    expect(idx).toBeDefined()
    expect(typeof idx.byCategory).toBe('object')
    // core-concepts should exist
    expect(Array.isArray(idx.byCategory['core-concepts'])).toBe(true)
    expect(idx.templates && idx.templates.length).toBeGreaterThan(0)
  })

  test('load specific snippet file', async () => {
    const hooksBefore = await loader.load<any>('snippets', 'hooks-before')
    expect(Array.isArray(hooksBefore)).toBe(true)
    expect(hooksBefore.length).toBeGreaterThanOrEqual(5)
  })

  test('load combined docs folder returns many entries', async () => {
    const docs = await loader.load<any>('docs')
    expect(Array.isArray(docs)).toBe(true)
    expect(docs.length).toBeGreaterThan(50)
  })
})
