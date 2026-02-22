import { BaseTool } from './baseTool';
import { ToolResult } from './types';
import { JsonSchema } from '../protocol/types';
import { ToolRegistration, ToolHandler } from '../protocol/types';
import { KnowledgeLoader } from '../knowledge';
import { DocEntry } from '../knowledge/types';
import { vectorSearch } from './search/vectorSearch';

interface GetHookExampleParams {
  hookType: 'before' | 'after' | 'error';
  useCase?: string;
  version?: string;
}

interface HookSnippet extends DocEntry {
  type: 'before' | 'after' | 'error';
  useCase: string;
  code: string;
  explanation: string;
  language?: string;
}

/**
 * GetHookExampleTool
 *
 * Retrieves FeathersJS hook examples using semantic search.
 * Now uses vector embeddings to find the most relevant hook examples
 * based on the user's use case, providing more accurate recommendations.
 *
 * When a use case is provided, uses vector search to find semantically
 * similar examples. Without a use case, returns a default example.
 */
export class GetHookExampleTool extends BaseTool {
  name = 'get_hook_example';
  description = 'Retrieve example FeathersJS hook best practices';

  inputSchema: JsonSchema = {
    type: 'object',
    properties: {
      hookType: {
        type: 'string',
        enum: ['before', 'after', 'error'],
        description: 'The type of hook to retrieve examples for',
      },
      useCase: {
        type: 'string',
        description:
          'Optional description of your use case (e.g., "validate email", "add timestamp", "log errors")',
      },
      version: {
        type: 'string',
        enum: ['v5', 'v6'],
        description: 'FeathersJS version (default: v6)',
      },
    },
    required: ['hookType'],
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
        content: JSON.stringify(
          {
            error: 'Please provide a hookType (before, after, or error)',
          },
          null,
          2
        ),
        metadata: {
          tool: this.name,
          success: false,
        },
      };
    }

    const { hookType, useCase, version = 'v6' } = params as GetHookExampleParams;

    if (!hookType || typeof hookType !== 'string') {
      return {
        content: JSON.stringify(
          {
            error: 'Please provide a hookType (before, after, or error)',
          },
          null,
          2
        ),
        metadata: {
          tool: this.name,
          success: false,
        },
      };
    }

    // Load all hook snippets from knowledge base
    const allSnippets = await this.loader.load<HookSnippet>('snippets');

    if (allSnippets.length === 0) {
      return {
        content: JSON.stringify(
          {
            error: 'No hook examples found. Please ensure hook snippets have been loaded.',
          },
          null,
          2
        ),
        metadata: {
          tool: this.name,
          success: false,
        },
      };
    }

    // Filter by hook type and version
    const filteredSnippets = allSnippets.filter(
      (s) => s.type === hookType && (s.version === version || s.version === 'both' || !s.version)
    );

    if (filteredSnippets.length === 0) {
      return {
        content: JSON.stringify(
          {
            error: `No hook examples found for type "${hookType}" in version "${version}".`,
          },
          null,
          2
        ),
        metadata: {
          tool: this.name,
          hookType,
          version,
          success: false,
        },
      };
    }

    // Select the best match
    let selectedSnippet: HookSnippet;
    let relevanceScore: number | undefined;

    if (useCase && useCase.trim().length > 0) {
      // Use vector search to find the most relevant example
      const searchResults = await vectorSearch.search(useCase, filteredSnippets, 1, 0.05);

      if (searchResults.length > 0) {
        const snippetMap = new Map<string, HookSnippet>(filteredSnippets.map((s) => [s.id, s]));
        const match = snippetMap.get(searchResults[0].id);

        if (match) {
          selectedSnippet = match;
          relevanceScore = searchResults[0].score;
        } else {
          // Fallback to first snippet if match not found
          selectedSnippet = filteredSnippets[0];
        }
      } else {
        // No semantic match found, return first snippet
        selectedSnippet = filteredSnippets[0];
      }
    } else {
      // No use case provided, return the first snippet
      selectedSnippet = filteredSnippets[0];
    }

    // Build the response
    const response = {
      hookType: selectedSnippet.type,
      useCase: selectedSnippet.useCase,
      version: selectedSnippet.version || version,
      code: selectedSnippet.code,
      explanation: selectedSnippet.explanation,
      language: selectedSnippet.language || 'typescript',
      ...(relevanceScore !== undefined && { relevanceScore: relevanceScore }),
    };

    return {
      content: JSON.stringify(response, null, 2),
      metadata: {
        tool: this.name,
        hookType,
        useCase,
        version,
        snippetId: selectedSnippet.id,
        usedVectorSearch: !!useCase,
        relevanceScore,
        success: true,
      },
    };
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

export default GetHookExampleTool;
