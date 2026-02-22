import { BaseTool } from './baseTool';
import { JsonSchema, ToolResult } from '../protocol/types';
import { ToolRegistration, ToolHandler } from '../protocol/types';
import { KnowledgeLoader } from '../knowledge';
import { DocEntry } from '../knowledge/types';
import { vectorSearch } from './search/vectorSearch';

interface TroubleshootParams {
  errorMessage: string;
  stackTrace?: string;
  version?: string;
}

interface ErrorEntry extends DocEntry {
  pattern: string;
  cause: string;
  solution: string;
  example: string;
  category: string;
}

/**
 * TroubleshootErrorTool
 *
 * Analyzes FeathersJS errors using a hybrid approach:
 * 1. First tries regex pattern matching for known error patterns
 * 2. Falls back to vector search for semantic similarity when no pattern matches
 *
 * This provides both precise matching for well-known errors and flexible
 * matching for new or unexpected error scenarios.
 */
export class TroubleshootErrorTool extends BaseTool {
  name = 'troubleshoot_error';

  description = 'Analyze a FeathersJS error and suggest likely cause, solution, and example fix.';

  inputSchema: JsonSchema = {
    type: 'object',
    properties: {
      errorMessage: {
        type: 'string',
        description: 'The error message to troubleshoot',
      },
      stackTrace: {
        type: 'string',
        description: 'Optional stack trace for additional context',
      },
      version: {
        type: 'string',
        enum: ['v5', 'v6'],
        description: 'FeathersJS version (default: v6)',
      },
    },
    required: ['errorMessage'],
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
        content: 'Please provide an error message to troubleshoot.',
        metadata: {
          tool: this.name,
          success: false,
        },
      };
    }

    const { errorMessage, stackTrace, version = 'v6' } = params as TroubleshootParams;

    if (!errorMessage || typeof errorMessage !== 'string' || errorMessage.trim().length === 0) {
      return {
        content: 'Please provide an error message to troubleshoot.',
        metadata: {
          tool: this.name,
          success: false,
        },
      };
    }

    const combinedText = `${errorMessage} ${stackTrace ?? ''}`.trim();

    // Load all error entries from knowledge base
    const allErrors = await this.loader.load<ErrorEntry>('errors');

    if (allErrors.length === 0) {
      return this.buildFallbackResponse(errorMessage);
    }

    // Filter by version
    const relevantErrors = allErrors.filter(
      (entry) => entry.version === version || entry.version === 'both' || !entry.version
    );

    if (relevantErrors.length === 0) {
      return this.buildFallbackResponse(errorMessage);
    }

    // Step 1: Try regex pattern matching for known errors
    const patternMatches = this.findPatternMatches(combinedText, relevantErrors);

    if (patternMatches.length > 0) {
      const best = patternMatches[0];
      return this.buildSuccessResponse(best.entry, 'pattern', best.score, errorMessage);
    }

    // Step 2: Fall back to vector search for semantic similarity
    const vectorMatches = await vectorSearch.search(combinedText, relevantErrors, 3, 0.2);

    if (vectorMatches.length > 0) {
      const errorMap = new Map<string, ErrorEntry>(relevantErrors.map((e) => [e.id, e]));
      const best = errorMap.get(vectorMatches[0].id);

      if (best) {
        return this.buildSuccessResponse(best, 'semantic', vectorMatches[0].score, errorMessage);
      }
    }

    // Step 3: No matches found - return general guidance
    return this.buildFallbackResponse(errorMessage);
  }

  /**
   * Find errors matching regex patterns
   */
  private findPatternMatches(
    text: string,
    errors: ErrorEntry[]
  ): Array<{ entry: ErrorEntry; score: number }> {
    const matches: Array<{ entry: ErrorEntry; score: number }> = [];

    for (const entry of errors) {
      if (!entry.pattern) continue;

      try {
        const regex = new RegExp(entry.pattern, 'i');
        if (regex.test(text)) {
          // Score based on pattern length (longer = more specific)
          const score = entry.pattern.length;
          matches.push({ entry, score });
        }
      } catch (err) {
        // Skip invalid regex patterns
        console.warn(`Invalid regex pattern in error entry ${entry.id}: ${entry.pattern}`);
      }
    }

    // Sort by score descending
    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Build a successful response with error details
   */
  private buildSuccessResponse(
    error: ErrorEntry,
    matchType: 'pattern' | 'semantic',
    score: number,
    originalError: string
  ): ToolResult {
    const parts: string[] = [];

    // Header
    if (error.category) {
      parts.push(`Category: ${error.category}`);
    }
    parts.push(`Error ID: ${error.id}`);
    parts.push(`Match Type: ${matchType === 'pattern' ? 'Exact Pattern' : 'Semantic Similarity'}`);

    if (matchType === 'semantic') {
      parts.push(`Confidence: ${(score * 100).toFixed(1)}%`);
    }

    parts.push('');

    // Cause
    parts.push('Cause:');
    parts.push(error.cause);
    parts.push('');

    // Solution
    parts.push('Solution:');
    parts.push(error.solution);
    parts.push('');

    // Example
    if (error.example) {
      parts.push('Example:');
      parts.push(error.example);
    }

    // Tags
    if (error.tags && error.tags.length > 0) {
      parts.push('');
      parts.push(`Related: ${error.tags.join(', ')}`);
    }

    return {
      content: parts.join('\n'),
      metadata: {
        tool: this.name,
        errorId: error.id,
        category: error.category || 'unknown',
        matchType,
        score,
        tags: error.tags || [],
        success: true,
      },
    };
  }

  /**
   * Build a fallback response when no matches are found
   */
  private buildFallbackResponse(errorMessage: string): ToolResult {
    const parts: string[] = [];

    parts.push('Unknown error - No exact match found');
    parts.push('');
    parts.push('General Troubleshooting Steps:');
    parts.push('');
    parts.push('1. Check the full stack trace for more context');
    parts.push('2. Verify your authentication setup is correct');
    parts.push('3. Validate your request data against the schema');
    parts.push('4. Ensure all services are properly registered');
    parts.push('5. Confirm database connectivity and configuration');
    parts.push('6. Enable debug logging with DEBUG=@feathersjs*');
    parts.push('7. Check the FeathersJS documentation for your version');
    parts.push('');
    parts.push('Common Error Categories:');
    parts.push('- Authentication: Check JWT tokens, auth strategies, and user permissions');
    parts.push('- Validation: Verify schema definitions and data types');
    parts.push('- Database: Check connection strings, migrations, and queries');
    parts.push('- Configuration: Review app configuration and environment variables');
    parts.push('- Hooks: Check hook order and async/await usage');
    parts.push('');
    parts.push('Error Received:');
    parts.push(errorMessage);

    return {
      content: parts.join('\n'),
      metadata: {
        tool: this.name,
        matchType: 'fallback',
        success: false,
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

export default TroubleshootErrorTool;
