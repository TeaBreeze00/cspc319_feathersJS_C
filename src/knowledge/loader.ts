import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import {
  DocEntry,
  TemplateFragment,
  CodeSnippet,
  ErrorPattern,
  BestPractice,
  KnowledgeIndex,
  isDocEntry,
} from './types';

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);

const USER_CACHE_DIR = path.join(os.homedir(), '.feathersjs-mcp');
const USER_CACHE_CHUNKS_DIR = path.join(USER_CACHE_DIR, 'chunks');

export class KnowledgeLoader {
  private kbRoot: string;
  private cache: Map<string, any[]>;

  constructor(kbRoot?: string) {
    if (kbRoot) {
      this.kbRoot = kbRoot;
    } else if (fs.existsSync(USER_CACHE_CHUNKS_DIR)) {
      // Use previously downloaded chunks from ~/.feathersjs-mcp if available
      this.kbRoot = USER_CACHE_DIR;
    } else {
      this.kbRoot = path.join(process.cwd(), 'knowledge-base');
    }
    this.cache = new Map();
  }

  /** Hot-swap the knowledge base root and clear the cache. */
  setKbRoot(newRoot: string): void {
    this.kbRoot = newRoot;
    this.cache.clear();
  }

  /**
   * Preload core docs and templates into memory.
   * Lazy-loads snippets, errors, and best-practices on demand.
   */
  async preload(): Promise<void> {
    // Load docs/* (recursively including subdirectories)
    const docsDir = path.join(this.kbRoot, 'chunks'); // was 'docs'
    const templatesDir = path.join(this.kbRoot, 'templates');

    const docs = await this.readAllJsonArraysRecursive<DocEntry>(docsDir);
    this.cache.set('docs', docs);

    const templates = await this.readAllJsonArraysRecursive<TemplateFragment>(templatesDir);
    this.cache.set('templates', templates);

    // Check approximate memory usage of preloaded JSON (rough estimate)
    const approxBytes = Buffer.byteLength(
      JSON.stringify({ docs: docs.length, templates: templates.length })
    );
    if (approxBytes > 100 * 1024 * 1024) {
      throw new Error(
        `Preload exceeds 100MB approximate serialized size: ${Math.round(approxBytes / (1024 * 1024))}MB`
      );
    }
  }

  /**
   * Generic loader. `category` corresponds to a folder name under knowledge-base
   * If `file` is provided it reads that specific file (without .json), otherwise
   * it returns the combined arrays from all files in the category folder.
   */
  async load<T>(category: string, file?: string): Promise<T[]> {
    const key = file ? `${category}/${file}` : category;
    if (this.cache.has(key)) return this.cache.get(key) as T[];

    const folder = path.join(this.kbRoot, category);
    if (!fs.existsSync(folder)) return [];

    if (file) {
      const filePath = path.join(folder, `${file}.json`);
      if (!fs.existsSync(filePath)) return [];
      const raw = await readFile(filePath, 'utf8');
      try {
        const parsed = JSON.parse(raw) as T[];
        this.cache.set(key, parsed);
        return parsed;
      } catch (e) {
        throw new Error(`Failed to parse ${filePath}: ${String(e)}`);
      }
    }

    // No file specified: recursively combine all JSON arrays in folder
    const arrays: T[] = await this.readAllJsonArraysRecursive<T>(folder, []);
    this.cache.set(key, arrays);
    return arrays;
  }

  /** Clear in-memory cache (useful for testing or memory management) */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Convenience: return an index object with docs by category and top-level collections
   */
  async buildIndex(): Promise<KnowledgeIndex> {
    const docs = (await this.load<DocEntry>('docs')) || [];
    const templates = (await this.load<TemplateFragment>('templates')) || [];
    const snippets = (await this.load<CodeSnippet>('snippets')) || [];
    const patterns = (await this.load<ErrorPattern>('errors')) || [];
    const bestPractices = (await this.load<BestPractice>('best-practices')) || [];

    const byCategory: Record<string, DocEntry[]> = {};
    for (const d of docs) {
      const cat = (d.category as string) || 'uncategorized';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(d);
    }

    return {
      byCategory,
      templates,
      snippets,
      patterns,
      bestPractices,
    };
  }

  private async readAllJsonArrays<T>(dirPath: string): Promise<T[]> {
    if (!fs.existsSync(dirPath)) return [];
    const names = await readdir(dirPath);
    const out: T[] = [];
    for (const n of names) {
      if (!n.endsWith('.json')) continue;
      const p = path.join(dirPath, n);
      try {
        const raw = await readFile(p, 'utf8');
        const parsed = JSON.parse(raw) as T[];
        if (Array.isArray(parsed)) out.push(...parsed);
      } catch (e) {
        // ignore parse errors but continue
      }
    }
    return out;
  }

  /**
   * Recursively walk a directory tree and load all .json files,
   * combining them into a single array. Skips hidden directories.
   */
  private async readAllJsonArraysRecursive<T>(dirPath: string, _results: T[] = []): Promise<T[]> {
    if (!fs.existsSync(dirPath)) return _results;

    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files/directories
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        await this.readAllJsonArraysRecursive(fullPath, _results);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const raw = await readFile(fullPath, 'utf8');
          const parsed = JSON.parse(raw) as T[];
          if (Array.isArray(parsed)) _results.push(...parsed);
        } catch (e) {
          // ignore parse errors but continue
        }
      }
    }

    return _results;
  }
}

export default KnowledgeLoader;
