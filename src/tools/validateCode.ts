import { BaseTool } from './baseTool';
import { ToolResult, JsonSchema } from '../protocol/types';
import { ValidationPipeline } from './validation';

interface ValidateCodeParams {
  code: string;
  language?: 'typescript' | 'javascript';
  checks?: string[];
}

export class ValidateCodeTool extends BaseTool {
  name = 'validate_code';
  description = 'Validate code for TypeScript syntax, linting, formatting, and FeathersJS best practices.';
  inputSchema: JsonSchema = {
    type: 'object',
    properties: {
      code: { type: 'string' },
      language: { type: 'string', enum: ['typescript', 'javascript'] },
      checks: { type: 'array', items: { type: 'string' } },
    },
    required: ['code'],
  };

  private pipeline = new ValidationPipeline();

  async execute(params: unknown): Promise<ToolResult> {
    const { code, checks } = params as ValidateCodeParams;
    const enabledChecks = this.normalizeChecks(checks);

    const result = await this.pipeline.validate(code, enabledChecks);
    return {
      content: JSON.stringify(
        {
          valid: result.valid,
          results: {
            typescript: result.typescript,
            eslint: result.eslint,
            prettier: result.prettier,
            bestPractices: result.bestPractices,
          },
          formattedCode: result.formattedCode,
        },
        null,
        2
      ),
      metadata: {
        valid: result.valid,
      },
    };
  }

  private normalizeChecks(checks?: string[]): {
    typescript?: boolean;
    eslint?: boolean;
    prettier?: boolean;
    bestPractices?: boolean;
  } {
    if (!checks || checks.length === 0) {
      return {};
    }

    const enabled = new Set(checks.map((c) => c.toLowerCase()));
    return {
      typescript: enabled.has('typescript'),
      eslint: enabled.has('eslint'),
      prettier: enabled.has('prettier'),
      bestPractices: enabled.has('bestpractices') || enabled.has('best-practices'),
    };
  }
}
