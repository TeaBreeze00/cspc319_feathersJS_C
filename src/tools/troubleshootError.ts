import { BaseTool } from './baseTool';
import { JsonSchema, ToolResult } from '../protocol/types';
import { ToolRegistration,ToolHandler } from '../protocol/types';

// Import your knowledge base
import authErrors from '../../knowledge-base/errors/authentication.json';
import configErrors from '../../knowledge-base/errors/configuration.json';
import dbErrors from '../../knowledge-base/errors/database.json';
import runtimeErrors from '../../knowledge-base/errors/runtime.json';

interface TroubleshootParams {
  errorMessage: string;
  stackTrace?: string;
  version?: string;
}

interface ErrorEntry {
  id: string;
  pattern: string;
  cause: string;
  solution: string;
  example: string;
  version: string;
  tags: string[];
  category: string;
}

export class TroubleshootErrorTool extends BaseTool {
  name = 'troubleshoot_error';

  description =
    'Analyze a FeathersJS error and suggest likely cause, solution, and example fix.';

  inputSchema: JsonSchema = {
    type: 'object',
    properties: {
      errorMessage: { type: 'string' },
      stackTrace: { type: 'string' },
      version: { type: 'string' }
    },
    required: ['errorMessage']
  };

  // Merge all error files into one array
  private errorDatabase: ErrorEntry[] = [
    ...authErrors,
    ...configErrors,
    ...dbErrors,
    ...runtimeErrors
  ];

  async execute(params: unknown): Promise<ToolResult> {
    const { errorMessage, stackTrace, version = 'v5' } =
      params as TroubleshootParams;

    const combinedText = `${errorMessage} ${stackTrace ?? ''}`;

    // Filter by version first
    const relevantErrors = this.errorDatabase.filter(
      entry => entry.version === version
    );

    // Match against patterns
    const matches = relevantErrors
      .filter(entry => {
        const regex = new RegExp(entry.pattern, 'i');
        return regex.test(combinedText);
      })
      .map(entry => ({
        entry,
        score: entry.pattern.length // longer pattern = more specific
      }))
      .sort((a, b) => b.score - a.score);

    if (matches.length === 0) {
      return {
        content: `
Unknown error.

General Troubleshooting Steps:
- Check the full stack trace.
- Verify authentication setup.
- Validate request schema.
- Ensure services are registered.
- Confirm database connectivity.
- Enable debug logging.

Error Received:
${errorMessage}
        `.trim()
      };
    }

    const best = matches[0].entry;

    return {
      content: `
Category: ${best.category}
Error ID: ${best.id}

Cause:
${best.cause}

Solution:
${best.solution}

Example:
${best.example}
        `.trim(),
      metadata: {
        id: best.id,
        category: best.category,
        tags: best.tags
      }
    };
  }

   register(): ToolRegistration {
    const handler: ToolHandler = async (params: unknown) => {
      // cast params safely
      const typedParams = params as TroubleshootParams;
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