export type DocVersion = 'v4' | 'v5' | 'both';

export type KnowledgeCategory =
  | 'core-concepts'
  | 'services'
  | 'hooks'
  | 'authentication'
  | 'cookbook'
  | 'guides'
  | 'examples';

export interface DocEntry {
  id: string; // unique id, e.g. "v5-services" or "v4-guides-basics-services"
  title: string;
  content: string; // textual or markdown content (trimmed to an ingest limit)
  version: DocVersion;
  tokens: string[]; // pre-tokenized keywords for search (BM25 input)
  category: KnowledgeCategory | string; // category or custom tag
  source?: {
    url?: string;
    path?: string; // file path in repo if applicable
  };
  tags?: string[];
}

export interface TemplateFragment {
  id: string;
  name: string;
  description?: string;
  fragment: string; // template snippet or prose
  language?: string; // e.g. 'javascript', 'typescript'
  version?: DocVersion;
  tags?: string[];
}

export interface CodeSnippet {
  id: string;
  title: string;
  description?: string;
  code: string;
  language: string;
  filename?: string;
  version?: DocVersion;
  tags?: string[];
}

export interface ErrorPattern {
  id: string;
  title: string;
  description?: string;
  pattern: string; // textual pattern or short regex (stored as string for JSON compatibility)
  examples?: string[]; // example error messages
  remediation?: string; // recommended fix
  version?: DocVersion;
}

export interface BestPractice {
  id: string;
  title: string;
  description: string;
  rationale?: string;
  examples?: string[];
  version?: DocVersion;
  tags?: string[];
}

export interface KnowledgeIndex {
  byCategory: Record<string, DocEntry[]>;
  templates?: TemplateFragment[];
  snippets?: CodeSnippet[];
  patterns?: ErrorPattern[];
  bestPractices?: BestPractice[];
}

// Minimal runtime type guard for DocEntry
export function isDocEntry(obj: unknown): obj is DocEntry {
  return (
    typeof obj === 'object' && obj !== null &&
    'id' in obj && 'title' in obj && 'content' in obj && 'version' in obj
  );
}
