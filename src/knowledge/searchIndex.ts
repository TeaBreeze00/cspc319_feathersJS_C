import { DocEntry } from './types'

export class SearchIndex {
  private inverted: Map<string, Map<string, number>> = new Map()
  private entries: Map<string, DocEntry> = new Map()

  index(entries: DocEntry[]): void {
    for (const e of entries) {
      if (!e || !e.id) continue
      this.entries.set(e.id, e)
      const tokens = (e.tokens || []).map((t) => String(t).toLowerCase())
      for (const t of tokens) {
        if (!this.inverted.has(t)) this.inverted.set(t, new Map())
        const postings = this.inverted.get(t)!
        postings.set(e.id, (postings.get(e.id) || 0) + 1)
      }
    }
  }

  search(query: string, limit = 10): DocEntry[] {
    const qTokens = String(query || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)

    const scores = new Map<string, number>()

    for (const qt of qTokens) {
      this.inverted.forEach((postings, token) => {
        if (token === qt || token.startsWith(qt)) {
          postings.forEach((count, id) => {
            scores.set(id, (scores.get(id) || 0) + count)
          })
        }
      })
    }

    const results = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => this.entries.get(id)!)
      .filter(Boolean)

    return results
  }

  clear(): void {
    this.inverted.clear()
    this.entries.clear()
  }
}

export default SearchIndex
