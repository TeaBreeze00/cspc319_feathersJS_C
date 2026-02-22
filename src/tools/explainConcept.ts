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
  title: string;
  version: string;
  definition: string;
  relatedConcepts: string[];
}

/**
 * ExplainConceptTool
 *
 * Provides clear explanations of FeathersJS concepts using semantic search.
 * Now uses the same vector search infrastructure as SearchDocsTool for
 * better quality and consistency.
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
    // Safely handle null/undefined params
    if (!params || typeof params !== 'object') {
      return {
        content: 'Please provide a concept to explain.',
        metadata: {
          tool: this.name,
          success: false,
        },
      };
    }

    const { concept } = params as ExplainConceptParams;

    if (!concept || typeof concept !== 'string' || concept.trim().length === 0) {
      return {
        content: 'Please provide a concept to explain.',
        metadata: {
          tool: this.name,
          success: false,
        },
      };
    }

    const query = concept.trim();

    // Load all docs from the knowledge base
    const allDocs = await this.loader.load<DocEntry>('docs');

    if (allDocs.length === 0) {
      return {
        content: `
Concept "${concept}" not found in documentation.

The knowledge base appears to be empty. Please ensure documentation has been loaded.
        `.trim(),
        metadata: {
          tool: this.name,
          success: false,
        },
      };
    }

    // Use vector search to find the most relevant docs
    // Request top 5 to get the best match + related concepts
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
        metadata: {
          tool: this.name,
          query: concept,
          success: false,
        },
      };
    }

    // Map results back to full doc entries
    const docMap = new Map<string, DocEntry>(allDocs.map((d) => [d.id, d]));
    const bestMatch = docMap.get(results[0].id);

    if (!bestMatch) {
      return {
        content: `Error: Unable to retrieve documentation for "${concept}".`,
        metadata: {
          tool: this.name,
          success: false,
        },
      };
    }

    // Build the explanation
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

  /**
   * Build a structured explanation object from the best match and related docs
   */
  private buildExplanation(
    query: string,
    bestMatch: DocEntry,
    relatedDocs: DocEntry[]
  ): ConceptExplanation {
    // Extract related concept titles
    const relatedConcepts = relatedDocs.map((doc) => doc.title);

    return {
      concept: query,
      title: bestMatch.title,
      version: bestMatch.version as string,
      definition: bestMatch.content,
      relatedConcepts,
    };
  }

  /**
   * Format the explanation as human-readable text
   */
  private formatExplanation(explanation: ConceptExplanation): string {
    const parts: string[] = [];

    // Header
    parts.push(`Concept: ${explanation.title}`);
    parts.push(`Version: ${explanation.version}`);
    parts.push('');

    // Definition
    parts.push('Definition:');
    parts.push(explanation.definition);

    // Related concepts (if any)
    if (explanation.relatedConcepts.length > 0) {
      parts.push('');
      parts.push('Related Concepts:');
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
