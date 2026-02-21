import { BaseTool } from './baseTool';
import { JsonSchema, ToolResult } from '../protocol/types';
import { ToolRegistration,ToolHandler } from '../protocol/types';


// Import your best-practice knowledge files
import hookPractices from '../../knowledge-base/best-practices/hooks.json';
import servicePractices from '../../knowledge-base/best-practices/services.json';
import securityPractices from '../../knowledge-base/best-practices/security.json';
import testingPractices from '../../knowledge-base/best-practices/testing.json';
import performancePractices from '../../knowledge-base/best-practices/performance.json';

type Topic = 'hooks' | 'services' | 'security' | 'testing' | 'performance';

interface GetBestPracticesParams {
  topic: Topic;
  context?: string;
}

interface BestPractice {
  id: string;
  topic: string;
  rule: string;
  rationale: string;
  goodExample: string;
  badExample: string;
  version: string;
  tags: string[];
}

export class GetBestPracticesTool extends BaseTool {
  name = 'get_best_practices';

  description =
    'Retrieve FeathersJS best practices for hooks, services, security, testing, or performance';

  inputSchema: JsonSchema = {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        enum: ['hooks', 'services', 'security', 'testing', 'performance']
      },
      context: {
        type: 'string'
      }
    },
    required: ['topic']
  };

  async execute(params: unknown): Promise<ToolResult> {
    const { topic, context } = params as GetBestPracticesParams;

    const practices = this.getPracticesForTopic(topic);

    if (!practices || practices.length === 0) {
      return {
        content: `No best practices found for topic "${topic}".`
      };
    }

    const ranked = context
      ? this.rankByContext(practices, context)
      : practices;

    const topPractices = ranked.slice(0, 3);

    const formatted = topPractices
      .map(bp => this.formatPractice(bp))
      .join('\n\n----------------------------------------\n\n');

    return {
      content: formatted
    };
  }

  private getPracticesForTopic(topic: Topic): BestPractice[] {
    switch (topic) {
      case 'hooks':
        return hookPractices as BestPractice[];
      case 'services':
        return servicePractices as BestPractice[];
      case 'security':
        return securityPractices as BestPractice[];
      case 'testing':
        return testingPractices as BestPractice[];
      case 'performance':
        return performancePractices as BestPractice[];
      default:
        return [];
    }
  }

  private rankByContext(practices: BestPractice[], context: string): BestPractice[] {
    const lowerContext = context.toLowerCase();

    return practices
      .map(practice => {
        let score = 0;

        if (practice.rule.toLowerCase().includes(lowerContext)) score += 3;
        if (practice.rationale.toLowerCase().includes(lowerContext)) score += 2;
        if (practice.tags.some(tag => lowerContext.includes(tag.toLowerCase()))) score += 2;

        return { practice, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.practice);
  }

  private formatPractice(bp: BestPractice): string {
    return `
Rule:
${bp.rule}

Why:
${bp.rationale}

Good Example:
${bp.goodExample}

Bad Example:
${bp.badExample}
    `.trim();
  }
   register(): ToolRegistration {
    const handler: ToolHandler = async (params: unknown) => {
      // cast params safely
      const typedParams = params as GetBestPracticesParams;
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