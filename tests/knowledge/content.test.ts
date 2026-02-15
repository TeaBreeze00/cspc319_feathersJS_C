import * as fs from 'fs'
import * as path from 'path'
import { DocEntry, TemplateFragment, CodeSnippet, ErrorPattern, BestPractice } from '../../src/knowledge/types'

const kbRoot = path.join(__dirname, '../../knowledge-base')

describe('Knowledge Base Content Validation', () => {
  describe('JSON parsing', () => {
    test('all docs JSON files parse without error', () => {
      const docsDir = path.join(kbRoot, 'docs')
      const files = fs.readdirSync(docsDir).filter((f: string) => f.endsWith('.json'))
      
      expect(files.length).toBeGreaterThan(0)
      
      files.forEach((file: any) => {
        const content = fs.readFileSync(path.join(docsDir, file), 'utf8')
        expect(() => JSON.parse(content)).not.toThrow()
      })
    })

    test('all templates JSON files parse without error', () => {
      const templatesDir = path.join(kbRoot, 'templates')
      const files = fs.readdirSync(templatesDir).filter((f: string) => f.endsWith('.json'))
      
      expect(files.length).toBeGreaterThan(0)
      
      files.forEach((file: any) => {
        const content = fs.readFileSync(path.join(templatesDir, file), 'utf8')
        expect(() => JSON.parse(content)).not.toThrow()
      })
    })

    test('all snippets JSON files parse without error', () => {
      const snippetsDir = path.join(kbRoot, 'snippets')
      const files = fs.readdirSync(snippetsDir).filter((f: string) => f.endsWith('.json'))
      
      expect(files.length).toBeGreaterThan(0)
      
      files.forEach((file: any) => {
        const content = fs.readFileSync(path.join(snippetsDir, file), 'utf8')
        expect(() => JSON.parse(content)).not.toThrow()
      })
    })

    test('all errors JSON files parse without error', () => {
      const errorsDir = path.join(kbRoot, 'errors')
      const files = fs.readdirSync(errorsDir).filter((f: string) => f.endsWith('.json'))
      
      expect(files.length).toBeGreaterThan(0)
      
      files.forEach((file: any) => {
        const content = fs.readFileSync(path.join(errorsDir, file), 'utf8')
        expect(() => JSON.parse(content)).not.toThrow()
      })
    })

    test('all best-practices JSON files parse without error', () => {
      const bpDir = path.join(kbRoot, 'best-practices')
      const files = fs.readdirSync(bpDir).filter((f: string) => f.endsWith('.json'))
      
      expect(files.length).toBeGreaterThan(0)
      
      files.forEach((file: any) => {
        const content = fs.readFileSync(path.join(bpDir, file), 'utf8')
        expect(() => JSON.parse(content)).not.toThrow()
      })
    })
  })

  describe('required fields validation', () => {
    test('all doc entries have required fields', () => {
      const docsDir = path.join(kbRoot, 'docs')
      const files = fs.readdirSync(docsDir).filter((f: string) => f.endsWith('.json'))
      
      files.forEach((file: any) => {
        const content = fs.readFileSync(path.join(docsDir, file), 'utf8')
        const entries: DocEntry[] = JSON.parse(content)
        
        expect(Array.isArray(entries)).toBe(true)
        
        entries.forEach((entry, idx) => {
          expect(entry.id).toBeDefined()
          expect(entry.title).toBeDefined()
          expect(entry.content).toBeDefined()
          expect(entry.version).toBeDefined()
          expect(entry.tokens).toBeDefined()
          expect(Array.isArray(entry.tokens)).toBe(true)
        })
      })
    })

    test('all template entries have required fields', () => {
      const templatesDir = path.join(kbRoot, 'templates')
      const files = fs.readdirSync(templatesDir).filter((f: string) => f.endsWith('.json'))
      
      files.forEach((file: any) => {
        const content = fs.readFileSync(path.join(templatesDir, file), 'utf8')
        const entries: TemplateFragment[] = JSON.parse(content)
        
        expect(Array.isArray(entries)).toBe(true)
        
        entries.forEach(entry => {
          expect(entry.id).toBeDefined()
          expect(entry.name).toBeDefined()
          expect(entry.code).toBeDefined()
          expect(entry.version).toBeDefined()
          expect(Array.isArray(entry.imports)).toBe(true)
          expect(Array.isArray(entry.dependencies)).toBe(true)
          expect(Array.isArray(entry.featureFlags)).toBe(true)
        })
      })
    })

    test('all snippet entries have required fields', () => {
      const snippetsDir = path.join(kbRoot, 'snippets')
      const files = fs.readdirSync(snippetsDir).filter((f: string) => f.endsWith('.json'))
      
      files.forEach((file: any) => {
        const content = fs.readFileSync(path.join(snippetsDir, file), 'utf8')
        const entries: CodeSnippet[] = JSON.parse(content)
        
        expect(Array.isArray(entries)).toBe(true)
        
        entries.forEach(entry => {
          expect(entry.id).toBeDefined()
          expect(entry.type).toBeDefined()
          expect(entry.useCase).toBeDefined()
          expect(entry.code).toBeDefined()
          expect(entry.explanation).toBeDefined()
          expect(entry.version).toBeDefined()
        })
      })
    })

    test('all error pattern entries have required fields', () => {
      const errorsDir = path.join(kbRoot, 'errors')
      const files = fs.readdirSync(errorsDir).filter((f: string) => f.endsWith('.json'))
      
    files.forEach((file: string) => {
      const content: string = fs.readFileSync(path.join(errorsDir, file), 'utf8')
      const entries: ErrorPattern[] = JSON.parse(content)
      
      expect(Array.isArray(entries)).toBe(true)
      
      entries.forEach((entry: ErrorPattern) => {
        expect(entry.id).toBeDefined()
        expect(entry.pattern).toBeDefined()
        expect(entry.cause).toBeDefined()
        expect(entry.solution).toBeDefined()
        expect(entry.example).toBeDefined()
      })
    })
    })

    test('all best practice entries have required fields', () => {
      const bpDir = path.join(kbRoot, 'best-practices')
      const files = fs.readdirSync(bpDir).filter((f: string) => f.endsWith('.json'))
      
      files.forEach((file: any) => {
        const content = fs.readFileSync(path.join(bpDir, file), 'utf8')
        const entries: BestPractice[] = JSON.parse(content)
        
        expect(Array.isArray(entries)).toBe(true)
        
        entries.forEach(entry => {
          expect(entry.id).toBeDefined()
          expect(entry.topic).toBeDefined()
          expect(entry.rule).toBeDefined()
          expect(entry.rationale).toBeDefined()
          expect(entry.goodExample).toBeDefined()
          expect(entry.badExample).toBeDefined()
        })
      })
    })
  })

  describe('version tags validation', () => {
    test('all doc entries have valid version tags', () => {
      const docsDir = path.join(kbRoot, 'docs')
      const files = fs.readdirSync(docsDir).filter((f: string) => f.endsWith('.json'))
      
      files.forEach((file: any) => {
        const content = fs.readFileSync(path.join(docsDir, file), 'utf8')
        const entries: DocEntry[] = JSON.parse(content)
        
        entries.forEach(entry => {
          expect(['v4', 'v5', 'both']).toContain(entry.version)
        })
      })
    })

    test('all template entries have valid version tags', () => {
      const templatesDir = path.join(kbRoot, 'templates')
      const files = fs.readdirSync(templatesDir).filter((f: string) => f.endsWith('.json'))
      
      files.forEach((file: any) => {
        const content = fs.readFileSync(path.join(templatesDir, file), 'utf8')
        const entries: TemplateFragment[] = JSON.parse(content)
        
        entries.forEach(entry => {
          expect(['v4', 'v5', 'both']).toContain(entry.version)
        })
      })
    })

    test('all snippet entries have valid version tags', () => {
      const snippetsDir = path.join(kbRoot, 'snippets')
      const files = fs.readdirSync(snippetsDir).filter((f: string) => f.endsWith('.json'))
      
      files.forEach((file: any) => {
        const content = fs.readFileSync(path.join(snippetsDir, file), 'utf8')
        const entries: CodeSnippet[] = JSON.parse(content)
        
        entries.forEach(entry => {
          expect(['v4', 'v5', 'both']).toContain(entry.version)
        })
      })
    })
  })
})
