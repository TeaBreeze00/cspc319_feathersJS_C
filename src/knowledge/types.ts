export type DocVersion = 'v5';

export type KnowledgeCategory =
  | 'core-concepts'
  | 'services'
  | 'hooks'
  | 'authentication'
  | 'databases'
  | 'configuration'
  | 'cookbook'
  | 'guides'
  | 'examples';

export interface DocEntry {
  id: string;
  title: string;
  content: string;
  version: DocVersion;
  tokens: string[];
  category: KnowledgeCategory | string;
  source?: {
    url?: string;
    path?: string;
  };
  tags?: string[];
}

export interface TemplateFragment {
  id: string;
  name: string;
  code: string;
  imports: string[];
  dependencies: string[];
  featureFlags: string[];
  version: DocVersion;
  description?: string;
  language?: string;
  tags?: string[];
}

export interface CodeSnippet {
  id: string;
  type: string;
  useCase: string;
  code: string;
  explanation: string;
  version: DocVersion;
  language?: string;
  filename?: string;
  tags?: string[];
}

export interface ErrorPattern {
  id: string;
  pattern: string;
  cause: string;
  solution: string;
  example: string;
  version?: DocVersion;
  tags?: string[];
}

export interface BestPractice {
  id: string;
  topic: string;
  rule: string;
  rationale: string;
  goodExample: string;
  badExample: string;
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
