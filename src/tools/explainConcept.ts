import { BaseTool } from './baseTool';
import { JsonSchema, ToolResult } from '../protocol/types';
import { ToolRegistration,ToolHandler } from '../protocol/types';

import authentication from '../../knowledge-base/docs/authentication.json';
import cookbook from '../../knowledge-base/docs/cookbook.json';
import coreconcepts from '../../knowledge-base/docs/core-concepts.json';
import database from '../../knowledge-base/docs/databases.json';
import guides from '../../knowledge-base/docs/guides.json';
import hooks from '../../knowledge-base/docs/hooks.json';
import services from '../../knowledge-base/docs/services.json';
import v6authentication from '../../knowledge-base/docs/v6-authentication.json';
import v6cookbook from '../../knowledge-base/docs/v6-cookbook.json';
import v6coreConcepts from '../../knowledge-base/docs/v6-core-concepts.json';
import v6guides from '../../knowledge-base/docs/v6-guides.json';
import v6hooks from '../../knowledge-base/docs/v6-hooks.json';
import v6services from '../../knowledge-base/docs/v6-services.json';


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

export class ExplainConceptTool extends BaseTool {
  name = 'explain_concept';

  description =
    'Provide a clear explanation of a FeathersJS concept with examples and related topics';

  inputSchema: JsonSchema = {
    type: 'object',
    properties: {
      concept: { type: 'string' }
    },
    required: ['concept']
  };

  private docs: DocEntry[];

  constructor() {
    super();

    // Combine ALL knowledge base docs into one searchable array
    this.docs = [
      ...authentication,
      ...cookbook,
      ...coreconcepts,
      ...database,
      ...guides,
      ...hooks,
      ...services,
      ...v6authentication,
      ...v6cookbook,
      ...v6coreConcepts,
      ...v6guides,
      ...v6hooks,
      ...v6services
    ];
  }

  async execute(params: unknown): Promise<ToolResult> {
    const { concept } = params as ExplainConceptParams;

    const query = concept.toLowerCase();

    const matches = this.docs
      .map(doc => ({
        doc,
        score: this.scoreDoc(doc, query)
      }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    if (matches.length === 0) {
      return {
        content: `
Concept "${concept}" not found in documentation.

Try:
- Checking spelling
- Using a broader term
- Searching related topics like "services", "hooks", or "authentication"
        `.trim()
      };
    }

    const best = matches[0].doc;

    // Pick up to 3 related concepts
    const related = matches
      .slice(1, 4)
      .map(m => `- ${m.doc.title}`)
      .join('\n');

    return {
      content: `
Concept: ${best.title}
Version: ${best.version}

Definition:
${best.content}

${related ? `Related Concepts:\n${related}` : ''}
      `.trim()
    };
  }

  private scoreDoc(doc: DocEntry, query: string): number {
    let score = 0;

    // Strong match in title
    if (doc.title.toLowerCase().includes(query)) score += 6;

    // Match in tokens
    if (doc.tokens?.some(t => t.toLowerCase().includes(query))) score += 4;

    // Match in tags
    if (doc.tags?.some(t => t.toLowerCase().includes(query))) score += 3;

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
