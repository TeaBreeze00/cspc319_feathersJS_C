import { BaseTool } from './baseTool';
import { JsonSchema, ToolResult } from '../protocol/types';
import { ToolRegistration, ToolHandler } from '../protocol/types';
import { KnowledgeLoader } from '../knowledge';
import { DocEntry, BestPractice } from '../knowledge/types';
import { vectorSearch } from './search/vectorSearch';

type Topic = 'hooks' | 'services' | 'security' | 'testing' | 'performance';

interface GetBestPracticesParams {
  topic: Topic;
  context?: string;
}

/**
 * GetBestPracticesTool
 *
 * Retrieves FeathersJS best practices using semantic search.
 * Now uses vector embeddings to rank practices by relevance to the user's
 * context, providing more accurate and contextual recommendations.
 *
 * When context is provided, uses vector search to find the most relevant
 * practices. Without context, returns the top practices for the topic.
 */
export class GetBestPracticesTool extends BaseTool {
  name = 'get_best_practices';

  description =
    'Retrieve FeathersJS best practices for hooks, services, security, testing, or performance';

  inputSchema: JsonSchema = {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        enum: ['hooks', 'services', 'security', 'testing', 'performance'],
        description: 'The topic area for best practices',
      },
      context: {
        type: 'string',
        description:
          'Optional context to filter practices (e.g., "authentication", "validation", "error handling")',
      },
    },
    required: ['topic'],
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
        content: 'Please provide a topic (hooks, services, security, testing, or performance).',
        metadata: {
          tool: this.name,
          success: false,
        },
      };
    }

    const { topic, context } = params as GetBestPracticesParams;

    if (!topic || typeof topic !== 'string') {
      return {
        content: 'Please provide a topic (hooks, services, security, testing, or performance).',
        metadata: {
          tool: this.name,
          success: false,
        },
      };
    }

    // Load best practices from knowledge base
    const allPractices = await this.loader.load<BestPractice>('best-practices');

    if (allPractices.length === 0) {
      return {
        content: `No best practices found. Please ensure best practices have been loaded into the knowledge base.`,
        metadata: {
          tool: this.name,
          topic,
          success: false,
        },
      };
    }

    // Convert BestPractice to DocEntry format for vector search
    const topicPracticesAsDocEntries: DocEntry[] = allPractices
      .filter((p) => p.topic === topic)
      .map((p) => this.bestPracticeToDocEntry(p));

    if (topicPracticesAsDocEntries.length === 0) {
      return {
        content: `No best practices found for topic "${topic}".`,
        metadata: {
          tool: this.name,
          topic,
          success: false,
        },
      };
    }

    // If context is provided, use vector search for semantic ranking
    let rankedPractices: Array<{ practice: BestPractice; score?: number }>;
    let usedVectorSearch = false;

    if (context && typeof context === 'string' && context.trim().length > 0) {
      usedVectorSearch = true;
      const searchResults = await vectorSearch.search(context, topicPracticesAsDocEntries, 5, 0.05);

      const practiceMap = new Map<string, BestPractice>(allPractices.map((p) => [p.id, p]));

      rankedPractices = searchResults
        .map((result) => ({
          practice: practiceMap.get(result.id)!,
          score: result.score,
        }))
        .filter((entry) => entry.practice !== undefined);
    } else {
      // No context - return top 3 practices
      rankedPractices = allPractices
        .filter((p) => p.topic === topic)
        .slice(0, 3)
        .map((practice) => ({ practice }));
    }

    if (rankedPractices.length === 0) {
      return {
        content: `No best practices found matching the context "${context}" for topic "${topic}".`,
        metadata: {
          tool: this.name,
          topic,
          context,
          success: false,
        },
      };
    }

    // Format the results
    const formatted = rankedPractices
      .map(({ practice, score }) => this.formatPractice(practice, score))
      .join('\n\n' + '='.repeat(80) + '\n\n');

    return {
      content: formatted,
      metadata: {
        tool: this.name,
        topic,
        context,
        count: rankedPractices.length,
        usedVectorSearch,
        success: true,
      },
    };
  }

  /**
   * Convert BestPractice to DocEntry format for vector search
   */
  private bestPracticeToDocEntry(practice: BestPractice): DocEntry {
    // Combine rule, rationale, and examples into content
    const content = `${practice.rule}\n\n${practice.rationale}\n\nGood Example:\n${practice.goodExample}\n\nBad Example:\n${practice.badExample}`;

    return {
      id: practice.id,
      title: practice.rule,
      content,
      version: (practice.version || 'v6') as 'v5' | 'v6' | 'both',
      tokens: [],
      category: practice.topic,
      tags: practice.tags,
      embedding: undefined,
    };
  }

  /**
   * Format a single best practice for display
   */
  private formatPractice(practice: BestPractice, score?: number): string {
    const parts: string[] = [];

    // Rule
    parts.push(`Best Practice: ${practice.rule}`);

    // Relevance score (if available from vector search)
    if (score !== undefined) {
      parts.push(`Relevance Score: ${(score * 100).toFixed(1)}%`);
    }

    parts.push('');

    // Rationale
    parts.push('Why:');
    parts.push(practice.rationale);
    parts.push('');

    // Good example
    parts.push('Good Example:');
    parts.push(practice.goodExample);
    parts.push('');

    // Bad example
    parts.push('Bad Example:');
    parts.push(practice.badExample);

    // Tags (if available)
    if (practice.tags && practice.tags.length > 0) {
      parts.push('');
      parts.push(`Tags: ${practice.tags.join(', ')}`);
    }

    // Version
    if (practice.version) {
      parts.push(`Version: ${practice.version}`);
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

export default GetBestPracticesTool;
