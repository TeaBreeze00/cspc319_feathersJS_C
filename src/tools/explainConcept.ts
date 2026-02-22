import { BaseTool } from './baseTool';
import { JsonSchema, ToolResult } from '../protocol/types';
import { ToolRegistration, ToolHandler } from '../protocol/types';

import fs from 'fs';
import path from 'path';

interface ExplainConceptParams {
  concept: string;
}

interface DocEntry {
  id: string;
  title: string;
  content: string;
  version: string;
  tokens?: string[];
  tags?: string[];
  category?: string;
}

// We'll dynamically load JSON files from knowledge-base/docs/v5 and /v6
// to avoid static imports that can fail when files are generated/absent.

function loadJsonFiles(dir: string): DocEntry[] {
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const entries: DocEntry[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        entries.push(...parsed);
      }
    } catch (err) {
      // Ignore malformed or unreadable files
      // eslint-disable-next-line no-console
      console.warn(`Warning: could not load ${file} from ${dir}: ${err}`);
    }
  }

  return entries;
}

export class ExplainConceptTool extends BaseTool {
  name = 'explain_concept';

  description =
    'Provide a clear explanation of a FeathersJS concept with examples and related topics';

  inputSchema: JsonSchema = {
    type: 'object',
    properties: {
      concept: { type: 'string' },
    },
    required: ['concept'],
  };

  private docs: DocEntry[];

  constructor() {
    super();

    // Combine ALL knowledge base docs into one searchable array by
    // loading any JSON files present under knowledge-base/docs/v5/ and /v6/.
    const kbBase = path.join(__dirname, '..', '..', 'knowledge-base', 'docs');
    const v5dir = path.join(kbBase, 'v5');
    const v6dir = path.join(kbBase, 'v6');

    this.docs = [...loadJsonFiles(v5dir), ...loadJsonFiles(v6dir)];
  }

  async execute(params: unknown): Promise<ToolResult> {
    const { concept } = params as ExplainConceptParams;

    const query = concept.toLowerCase();

    const matches = this.docs
      .map((doc) => ({
        doc,
        score: this.scoreDoc(doc, query),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    if (matches.length === 0) {
      return {
        content: `
Concept "${concept}" not found in documentation.

Try:
- Checking spelling
- Using a broader term
- Searching related topics like "services", "hooks", or "authentication"
        `.trim(),
      };
    }

    const best = matches[0].doc;

    // Pick up to 3 related concepts
    const related = matches
      .slice(1, 4)
      .map((m) => `- ${m.doc.title}`)
      .join('\n');

    return {
      content: `
Concept: ${best.title}
Version: ${best.version}

Definition:
${best.content}

${related ? `Related Concepts:\n${related}` : ''}
      `.trim(),
    };
  }

  private scoreDoc(doc: DocEntry, query: string): number {
    let score = 0;

    // Strong match in title
    if (doc.title.toLowerCase().includes(query)) score += 6;

    // Match in tokens
    if (doc.tokens?.some((t) => t.toLowerCase().includes(query))) score += 4;

    // Match in tags
    if (doc.tags?.some((t) => t.toLowerCase().includes(query))) score += 3;

    // Weak match in content
    if (doc.content.toLowerCase().includes(query)) score += 1;

    return score;
  }
  register(): ToolRegistration {
    const handler: ToolHandler = async (params: unknown) => {
      // cast params safely
      const typedParams = params as ExplainConceptParams;
      return this.execute(typedParams);
    };

    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      handler,
    };
  }
}
