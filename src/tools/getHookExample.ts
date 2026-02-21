import { BaseTool } from './baseTool';
import hookBestPractices from '../../knowledge-base/best-practices/hooks.json';
import { JsonSchema } from '../protocol';
import { ToolRegistration,ToolHandler } from '../protocol/types';


interface GetHookExampleParams {
  hookType: 'before' | 'after' | 'error' | 'around';
  useCase?: string;
  version?: string;
}

interface HookBestPractice {
  id: string;
  topic: string;
  rule: string;
  rationale: string;
  goodExample: string;
  badExample: string;
  version: string;
  tags: string[];
}

export class GetHookExampleTool extends BaseTool {
  name = 'get_hook_example';
  description = 'Retrieve example FeathersJS hook best practices';

  inputSchema: JsonSchema = {
    type: 'object',
    properties: {
      hookType: {
        type: 'string',
        enum: ['before', 'after', 'error', 'around']
      },
      useCase: { type: 'string' },
      version: { type: 'string' }
    },
    required: ['hookType']
  };

  async execute(params: unknown) {
    const { hookType, version = 'v5' } = params as GetHookExampleParams;

    const versionPractices = (hookBestPractices as HookBestPractice[]).filter(
      (bp) => bp.topic === 'hooks' && bp.version === version
    );

    const matches = versionPractices.filter((bp) => bp.tags.includes(hookType));

    if (versionPractices.length === 0) {
      return {
        content: `No hook examples found for type "${hookType}" in version "${version}".`
      };
    }

    const best = matches.length > 0 ? matches[0] : versionPractices[0];
    const fallbackNote =
      matches.length === 0
        ? `\nNote: No exact "${hookType}" tagged example found; showing closest "${version}" hook practice.\n`
        : '';

    return {
      content: `
Rule: ${best.rule}

Why:
${best.rationale}
${fallbackNote}

Good Example:
${best.goodExample}

Bad Example:
${best.badExample}
      `.trim()
    };
  }

 register(): ToolRegistration {
  const handler: ToolHandler = async (params: unknown) => {
    // cast params safely
    const typedParams = params as GetHookExampleParams;
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
