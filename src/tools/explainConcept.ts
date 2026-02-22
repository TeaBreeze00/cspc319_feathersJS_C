import { BaseTool } from './baseTool';
import { JsonSchema, ToolResult } from '../protocol/types';
import { ToolRegistration, ToolHandler } from '../protocol/types';
import { KnowledgeLoader } from '../knowledge';
import { DocEntry } from '../knowledge/types';
import { vectorSearch } from './search/vectorSearch';

interface ExplainConceptParams {
  concept: string;
}

interface ConceptExplanation {
  concept: string;
  heading: string;
  breadcrumb: string;
  version: string;
  definition: string;
  relatedConcepts: string[];
}

/**
 * ExplainConceptTool
 *
 * Provides clear explanations of FeathersJS concepts using semantic search.
 * Uses vector search infrastructure for better quality and consistency.
 *
 * Returns a focused explanation of a single concept plus related topics.
 */
export class ExplainConceptTool extends BaseTool {
  name = 'explain_concept';

  description =
    'Provide a clear explanation of a FeathersJS concept with examples and related topics';

  inputSchema: JsonSchema = {
    type: 'object',
    properties: {
      concept: {
        type: 'string',
        description:
          'The FeathersJS concept to explain (e.g., "hooks", "services", "authentication")',
      },
    },
    required: ['concept'],
  };

  private loader: KnowledgeLoader;

  constructor(loader?: KnowledgeLoader) {
    super();
    this.loader = loader ?? new KnowledgeLoader();
  }

  async execute(params: unknown): Promise<ToolResult> {
    if (!params || typeof params !== 'object') {
      return {
        content: 'Please provide a concept to explain.',
        metadata: { tool: this.name, success: false },
      };
    }

    const { concept } = params as ExplainConceptParams;

    if (!concept || typeof concept !== 'string' || concept.trim().length === 0) {
      return {
        content: 'Please provide a concept to explain.',
        metadata: { tool: this.name, success: false },
      };
    }

    const query = concept.trim();

    const allDocs = await this.loader.load<DocEntry>('chunks');

    if (allDocs.length === 0) {
      return {
        content: `Concept "${concept}" not found. The knowledge base appears to be empty.`,
        metadata: { tool: this.name, success: false },
      };
    }

    // Top 5: best match + related concepts
    const results = await vectorSearch.search(query, allDocs, 5, 0.1);

    if (results.length === 0) {
      return {
        content: `
Concept "${concept}" not found in documentation.

Try:
- Checking spelling
- Using a broader term
- Searching related topics like "services", "hooks", "authentication", or "schemas"
        `.trim(),
        metadata: { tool: this.name, query: concept, success: false },
      };
    }

    const docMap = new Map<string, DocEntry>(allDocs.map((d) => [d.id, d]));
    const bestMatch = docMap.get(results[0].id);

    if (!bestMatch) {
      return {
        content: `Error: Unable to retrieve documentation for "${concept}".`,
        metadata: { tool: this.name, success: false },
      };
    }

    const explanation = this.buildExplanation(
      concept,
      bestMatch,
      results
        .slice(1)
        .map((r) => docMap.get(r.id))
        .filter((d): d is DocEntry => d !== undefined)
    );

    return {
      content: this.formatExplanation(explanation),
      metadata: {
        tool: this.name,
        query: concept,
        bestMatchId: bestMatch.id,
        score: results[0].score,
        relatedCount: explanation.relatedConcepts.length,
        success: true,
      },
    };
  }

  private buildExplanation(
    query: string,
    bestMatch: DocEntry,
    relatedDocs: DocEntry[]
  ): ConceptExplanation {
    return {
      concept: query,
      heading: bestMatch.heading,
      breadcrumb: bestMatch.breadcrumb,
      version: bestMatch.version as string,
      // Use rawContent so we don't repeat the breadcrumb prefix in the output
      definition: bestMatch.rawContent,
      // Use breadcrumb for related concepts — more informative than just the heading
      relatedConcepts: relatedDocs.map((doc) => doc.breadcrumb),
    };
  }

  private formatExplanation(explanation: ConceptExplanation): string {
    const parts: string[] = [];

    parts.push(`# ${explanation.heading}`);
    parts.push(`Path: ${explanation.breadcrumb}`);
    parts.push(`Version: ${explanation.version}`);
    parts.push('');
    parts.push(explanation.definition);

    if (explanation.relatedConcepts.length > 0) {
      parts.push('');
      parts.push('## Related');
      explanation.relatedConcepts.forEach((concept) => {
        parts.push(`- ${concept}`);
      });
    }

    return parts.join('\n');
  }

  register(): ToolRegistration {
    const handler: ToolHandler = async (params: unknown) => {
      return this.execute(params);
    };

    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      handler,
    };
  }
}

export default ExplainConceptTool;
