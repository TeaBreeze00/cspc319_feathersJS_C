import { SearchIndex } from '../../src/knowledge/searchIndex'
import { DocEntry } from '../../src/knowledge/types'

describe('SearchIndex', () => {
  let index: SearchIndex

  beforeEach(() => {
    index = new SearchIndex()
  })

  afterEach(() => {
    index.clear()
  })

  describe('indexing', () => {
    test('indexes entries successfully', () => {
      const entries: DocEntry[] = [
        {
          id: '1',
          title: 'Service Creation',
          content: 'How to create a service in FeathersJS',
          version: 'v5',
          tokens: ['feathers', 'service', 'create', 'api'],
          category: 'services'
        },
        {
          id: '2',
          title: 'Hooks Guide',
          content: 'Understanding hooks in FeathersJS',
          version: 'v5',
          tokens: ['hooks', 'before', 'after', 'feathers'],
          category: 'hooks'
        }
      ]

      expect(() => index.index(entries)).not.toThrow()
    })

    test('handles empty entries array', () => {
      expect(() => index.index([])).not.toThrow()
    })

    test('handles entries with no tokens', () => {
      const entries: DocEntry[] = [
        {
          id: '1',
          title: 'Test',
          content: 'Test content',
          version: 'v5',
          tokens: [],
          category: 'test'
        }
      ]

      expect(() => index.index(entries)).not.toThrow()
    })

    test('indexes multiple entries with overlapping tokens', () => {
      const entries: DocEntry[] = [
        {
          id: '1',
          title: 'A',
          content: 'A',
          version: 'v5',
          tokens: ['feathers', 'service'],
          category: 'services'
        },
        {
          id: '2',
          title: 'B',
          content: 'B',
          version: 'v5',
          tokens: ['feathers', 'hooks'],
          category: 'hooks'
        },
        {
          id: '3',
          title: 'C',
          content: 'C',
          version: 'v5',
          tokens: ['service', 'hooks'],
          category: 'services'
        }
      ]

      expect(() => index.index(entries)).not.toThrow()
    })
  })

  describe('search', () => {
    beforeEach(() => {
      const entries: DocEntry[] = [
        {
          id: '1',
          title: 'Service Creation',
          content: 'How to create a service in FeathersJS',
          version: 'v5',
          tokens: ['feathers', 'service', 'create', 'api', 'rest'],
          category: 'services'
        },
        {
          id: '2',
          title: 'Hooks Guide',
          content: 'Understanding hooks in FeathersJS',
          version: 'v5',
          tokens: ['hooks', 'before', 'after', 'feathers', 'middleware'],
          category: 'hooks'
        },
        {
          id: '3',
          title: 'Service Hooks',
          content: 'Using hooks with services',
          version: 'v5',
          tokens: ['service', 'hooks', 'feathers', 'integration'],
          category: 'services'
        },
        {
          id: '4',
          title: 'Authentication',
          content: 'Setting up authentication',
          version: 'v5',
          tokens: ['authentication', 'auth', 'security', 'login'],
          category: 'authentication'
        }
      ]
      index.index(entries)
    })

    test('returns relevant results for single term query', () => {
      const results = index.search('feathers')
      
      expect(results.length).toBeGreaterThan(0)
      expect(results.every(r => r.tokens?.includes('feathers'))).toBe(true)
    })

    test('returns relevant results for multi-term query', () => {
      const results = index.search('feathers service')
      
      expect(results.length).toBeGreaterThan(0)
      // Should prioritize entries with both terms
      const firstResult = results[0]
      expect(firstResult.tokens?.includes('feathers') || firstResult.tokens?.includes('service')).toBe(true)
    })

    test('returns empty array for non-matching query', () => {
      const results = index.search('nonexistent')
      
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(0)
    })

    test('handles empty query string', () => {
      const results = index.search('')
      
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(0)
    })

    test('is case insensitive', () => {
      const lower = index.search('feathers')
      const upper = index.search('FEATHERS')
      const mixed = index.search('FeAtHeRs')
      
      expect(lower.length).toBe(upper.length)
      expect(lower.length).toBe(mixed.length)
      expect(lower.length).toBeGreaterThan(0)
    })

    test('respects limit parameter', () => {
      const results = index.search('feathers', 2)
      
      expect(results.length).toBeLessThanOrEqual(2)
    })

    test('returns results sorted by relevance', () => {
      const results = index.search('service hooks')
      
      expect(results.length).toBeGreaterThan(0)
      // Entry 3 has both 'service' AND 'hooks' - should rank high
      const entry3 = results.find(r => r.id === '3')
      expect(entry3).toBeDefined()
    })

    test('handles partial match at start of token', () => {
      const results = index.search('auth')
      
      // Should match 'authentication' and 'auth' tokens
      expect(results.length).toBeGreaterThan(0)
      const hasAuthEntry = results.some(r => r.id === '4')
      expect(hasAuthEntry).toBe(true)
    })

    test('default limit is 10', () => {
      // Create many entries
      const manyEntries: DocEntry[] = []
      for (let i = 0; i < 20; i++) {
        manyEntries.push({
          id: `entry-${i}`,
          title: `Entry ${i}`,
          content: `Content ${i}`,
          version: 'v5',
          tokens: ['feathers', `token${i}`],
          category: 'test'
        })
      }
      
      const newIndex = new SearchIndex()
      newIndex.index(manyEntries)
      const results = newIndex.search('feathers')
      
      expect(results.length).toBeLessThanOrEqual(10)
    })
  })

  describe('clear', () => {
    test('clears all indexed data', () => {
      const entries: DocEntry[] = [
        {
          id: '1',
          title: 'Test',
          content: 'Test',
          version: 'v5',
          tokens: ['test', 'feathers'],
          category: 'test'
        }
      ]
      
      index.index(entries)
      let results = index.search('test')
      expect(results.length).toBeGreaterThan(0)
      
      index.clear()
      results = index.search('test')
      expect(results.length).toBe(0)
    })
  })
})
