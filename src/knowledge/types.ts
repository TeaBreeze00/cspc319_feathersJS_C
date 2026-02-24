export type DocVersion = 'v5' | 'v6' | 'both';

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
  heading: string;
  content: string;
  rawContent: string;
  breadcrumb: string;
  version: DocVersion;
  tokens: number;
  category: KnowledgeCategory | string;
  sourceFile: string;
  hasCode: boolean;
  codeLanguages: string[];
  tags?: string[];
  subHeadings?: string[]; // ← NEW: all ## and ### headings in this chunk
  embedding?: number[];
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

export function isDocEntry(obj: unknown): obj is DocEntry {
  return (
    typeof obj === 'object' && obj !== null && 'id' in obj && 'content' in obj && 'version' in obj
  );
}
