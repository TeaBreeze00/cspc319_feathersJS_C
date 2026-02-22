import { BaseTool } from './baseTool';
import { ToolResult } from './types';
import { ToolRegistration, ToolHandler } from '../protocol/types';
import { KnowledgeLoader } from '../knowledge';
import { DocEntry } from '../knowledge/types';
import { vectorSearch } from './search/vectorSearch';

interface SuggestAlternativesParams {
  pattern: string;
  context?: string;
}

interface Alternative {
  id: string;
  title: string;
  code: string;
  tradeoffs: string;
  whenToUse: string;
  score?: number;
}

/**
 * SuggestAlternativesTool
 *
 * Suggests alternative FeathersJS implementation patterns using semantic search.
 * Now uses vector embeddings to find the most relevant patterns and approaches
 * based on the user's query, providing more accurate and contextual recommendations.
 *
 * Searches across templates, snippets, and patterns in the knowledge base to
 * provide multiple implementation options with tradeoffs and use cases.
 */
export class SuggestAlternativesTool extends BaseTool {
  name = 'suggest_alternatives';

  description =
    'Suggest alternative FeathersJS implementation patterns with code examples, tradeoffs, and when to use each option.';

  inputSchema = {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description:
          'The pattern or approach you want alternatives for (e.g., "authentication hook", "service validation", "error handling")',
      },
      context: {
        type: 'string',
        description:
          'Optional additional context about your use case (e.g., "for REST API", "with MongoDB", "real-time updates")',
      },
    },
    required: ['pattern'],
    additionalProperties: false,
  };

  private loader: KnowledgeLoader;

  constructor(loader?: KnowledgeLoader) {
    super();
    this.loader = loader ?? new KnowledgeLoader();
  }

  async execute(params: unknown): Promise<ToolResult> {
    const { pattern, context } = this.normalizeParams(params);

    if (!pattern) {
      return {
        content: 'Please provide a pattern to search for alternatives.',
        metadata: {
          tool: this.name,
          success: false,
        },
      };
    }

    // Build the search query by combining pattern and context
    const query = context ? `${pattern} ${context}` : pattern;

    // Load relevant knowledge sources
    const [templates, snippets, docs] = await Promise.all([
      this.loader.load<DocEntry>('templates'),
      this.loader.load<DocEntry>('snippets'),
      this.loader.load<DocEntry>('docs'),
    ]);

    // Combine all sources for searching
    const allSources = [...templates, ...snippets, ...docs];

    if (allSources.length === 0) {
      return {
        content: this.buildFallbackAlternatives(pattern),
        metadata: {
          tool: this.name,
          pattern,
          context,
          usedFallback: true,
          success: true,
        },
      };
    }

    // Use vector search to find relevant alternatives
    const searchResults = await vectorSearch.search(query, allSources, 10, 0.1);

    if (searchResults.length === 0) {
      return {
        content: this.buildFallbackAlternatives(pattern),
        metadata: {
          tool: this.name,
          pattern,
          context,
          usedFallback: true,
          success: true,
        },
      };
    }

    // Map results back to full entries
    const sourceMap = new Map<string, DocEntry>(allSources.map((s) => [s.id, s]));

    const alternatives = searchResults
      .map((result) => {
        const source = sourceMap.get(result.id);
        if (!source) return null;
        return this.buildAlternative(source, result.score);
      })
      .filter((alt): alt is Alternative => alt !== null);

    // Deduplicate by title and take top 3
    const uniqueAlternatives = this.uniqueByTitle(alternatives).slice(0, 3);

    if (uniqueAlternatives.length === 0) {
      return {
        content: this.buildFallbackAlternatives(pattern),
        metadata: {
          tool: this.name,
          pattern,
          context,
          usedFallback: true,
          success: true,
        },
      };
    }

    // Format the output
    const content = this.formatAlternatives(uniqueAlternatives);

    return {
      content,
      metadata: {
        tool: this.name,
        pattern,
        context,
        count: uniqueAlternatives.length,
        usedVectorSearch: true,
        success: true,
      },
    };
  }

  /**
   * Normalize and validate input parameters
   */
  private normalizeParams(params: unknown): SuggestAlternativesParams {
    const input = (params ?? {}) as Partial<SuggestAlternativesParams>;
    const pattern = typeof input.pattern === 'string' ? input.pattern.trim() : '';
    const context = typeof input.context === 'string' ? input.context.trim() : undefined;

    return { pattern, context };
  }

  /**
   * Build an Alternative object from a DocEntry
   */
  private buildAlternative(source: DocEntry, score: number): Alternative | null {
    // Extract code if available
    const code = this.extractCode(source);

    if (!code) {
      // If no code found, skip this alternative
      return null;
    }

    // Build tradeoffs and whenToUse based on source type and content
    const { tradeoffs, whenToUse } = this.extractGuidance(source);

    return {
      id: source.id,
      title: source.title,
      code,
      tradeoffs,
      whenToUse,
      score,
    };
  }

  /**
   * Extract code from a DocEntry
   */
  private extractCode(source: DocEntry): string {
    // Check if source has a code property
    const sourceAny = source as any;

    if (typeof sourceAny.code === 'string' && sourceAny.code.length > 0) {
      return sourceAny.code;
    }

    // Try to extract code blocks from content
    if (source.content) {
      const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
      const matches = [...source.content.matchAll(codeBlockRegex)];

      if (matches.length > 0 && matches[0][1]) {
        return matches[0][1].trim();
      }

      // If content is short and looks like code, use it as-is
      if (source.content.length < 500 && this.looksLikeCode(source.content)) {
        return source.content;
      }
    }

    return '';
  }

  /**
   * Check if text looks like code
   */
  private looksLikeCode(text: string): boolean {
    const codeIndicators = [
      /\bfunction\b/,
      /\bconst\b/,
      /\blet\b/,
      /\bvar\b/,
      /\basync\b/,
      /\bawait\b/,
      /\bexport\b/,
      /\bimport\b/,
      /=>/,
      /\{[\s\S]*\}/,
    ];

    return codeIndicators.some((indicator) => indicator.test(text));
  }

  /**
   * Extract guidance (tradeoffs and when to use) from source
   */
  private extractGuidance(source: DocEntry): { tradeoffs: string; whenToUse: string } {
    const sourceAny = source as any;

    // Check for explicit tradeoffs and whenToUse properties
    let tradeoffs =
      typeof sourceAny.tradeoffs === 'string' ? sourceAny.tradeoffs : this.inferTradeoffs(source);

    let whenToUse =
      typeof sourceAny.whenToUse === 'string' ? sourceAny.whenToUse : this.inferWhenToUse(source);

    return { tradeoffs, whenToUse };
  }

  /**
   * Infer tradeoffs from source metadata and content
   */
  private inferTradeoffs(source: DocEntry): string {
    const sourceAny = source as any;

    // Check source type to provide generic tradeoffs
    if (sourceAny.type === 'template') {
      return 'Provides comprehensive scaffolding but may include features you need to customize or remove.';
    }

    if (sourceAny.type === 'snippet') {
      return 'Focused and lightweight but requires manual integration into your application structure.';
    }

    if (sourceAny.category === 'hooks') {
      return 'Centralizes cross-cutting concerns but can become complex when many hooks are chained.';
    }

    if (sourceAny.category === 'services') {
      return 'Keeps logic explicit in service methods but may lead to code duplication across services.';
    }

    // Generic fallback
    return 'Standard approach with balanced tradeoffs between flexibility and complexity.';
  }

  /**
   * Infer when to use from source metadata
   */
  private inferWhenToUse(source: DocEntry): string {
    const sourceAny = source as any;

    if (sourceAny.useCase) {
      return `Use when you need: ${sourceAny.useCase}`;
    }

    if (sourceAny.type === 'before') {
      return 'Use when you need to validate or transform data before a service method executes.';
    }

    if (sourceAny.type === 'after') {
      return 'Use when you need to transform results or trigger side effects after a service method completes.';
    }

    if (sourceAny.type === 'error') {
      return 'Use when you need to handle or transform errors before they reach the client.';
    }

    if (source.tags && source.tags.length > 0) {
      return `Use for: ${source.tags.join(', ')}`;
    }

    // Generic fallback
    return `Use when implementing: ${source.title.toLowerCase()}`;
  }

  /**
   * Remove duplicate alternatives by title
   */
  private uniqueByTitle(alternatives: Alternative[]): Alternative[] {
    const seen = new Map<string, Alternative>();

    for (const alt of alternatives) {
      const key = alt.title.toLowerCase().trim();

      // Keep the one with the higher score
      const existing = seen.get(key);
      if (!existing || (alt.score && existing.score && alt.score > existing.score)) {
        seen.set(key, alt);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Format alternatives for display
   */
  private formatAlternatives(alternatives: Alternative[]): string {
    return alternatives
      .map((alt, i) => {
        const parts: string[] = [];

        parts.push(`Alternative ${i + 1}: ${alt.title}`);

        if (alt.score !== undefined) {
          parts.push(`Relevance: ${(alt.score * 100).toFixed(1)}%`);
        }

        parts.push('');
        parts.push('Code:');
        parts.push(alt.code);
        parts.push('');
        parts.push('Tradeoffs:');
        parts.push(alt.tradeoffs);
        parts.push('');
        parts.push('When to use:');
        parts.push(alt.whenToUse);

        return parts.join('\n');
      })
      .join('\n\n' + '='.repeat(80) + '\n\n');
  }

  /**
   * Provide fallback alternatives when vector search returns no results
   */
  private buildFallbackAlternatives(pattern: string): string {
    const alternatives: Alternative[] = [
      {
        id: 'fallback-1',
        title: 'Hook-based approach',
        code: `// Around hook example
export const wrapLogic = async (context, next) => {
  // Pre-processing logic
  console.log('Before service method');

  await next();

  // Post-processing logic
  console.log('After service method');
};`,
        tradeoffs:
          'Centralizes cross-cutting logic and keeps services clean, but can become hard to trace when many hooks are chained together.',
        whenToUse:
          'Use when behavior should run consistently across multiple service methods (e.g., logging, validation, authorization).',
      },
      {
        id: 'fallback-2',
        title: 'Service method approach',
        code: `// Service class with explicit logic
class MyService {
  async create(data, params) {
    // Explicit business logic in service method
    const validated = this.validateData(data);
    const result = await this.saveToDatabase(validated);
    return result;
  }

  private validateData(data) {
    // Validation logic here
    return data;
  }
}`,
        tradeoffs:
          'Keeps behavior explicit and easy to trace, but may lead to code duplication across services and harder to maintain consistency.',
        whenToUse:
          'Use when behavior is service-specific and needs clear method-level ownership without cross-cutting concerns.',
      },
      {
        id: 'fallback-3',
        title: 'Schema-based validation',
        code: `// Schema validation with resolvers
import { resolve } from '@feathersjs/schema';

export const myDataSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  name: Type.String({ minLength: 2 })
});

export const myDataResolver = resolve({
  email: async (value) => value.toLowerCase(),
  createdAt: async () => new Date()
});`,
        tradeoffs:
          'Provides type safety and automatic validation, but requires learning the schema system and may be overkill for simple cases.',
        whenToUse:
          'Use when you need robust data validation, type safety, and automatic serialization/deserialization.',
      },
    ];

    return `No specific alternatives found for "${pattern}". Here are some common patterns:\n\n${this.formatAlternatives(alternatives)}`;
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

export default SuggestAlternativesTool;
