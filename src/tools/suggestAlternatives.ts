import { BaseTool } from './baseTool';
import { ToolResult } from './types';
import { KnowledgeLoader } from '../knowledge';
import { CodeSnippet, TemplateFragment } from '../knowledge/types';

interface SuggestAlternativesParams {
  pattern: string;
  context?: string;
}

interface Alternative {
  title: string;
  code: string;
  tradeoffs: string;
  whenToUse: string;
}

export class SuggestAlternativesTool extends BaseTool {
  name = 'suggest_alternatives';

  description =
    'Suggest alternative FeathersJS implementation patterns with code examples, tradeoffs, and when to use each option.';

  inputSchema = {
    type: 'object',
    properties: {
      pattern: { type: 'string' },
      context: { type: 'string' },
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
    const query = `${pattern} ${context ?? ''}`.trim().toLowerCase();

    const [templates, snippets] = await Promise.all([
      this.loader.load<TemplateFragment>('templates'),
      this.loader.load<CodeSnippet>('snippets'),
    ]);

    const alternatives = this.buildAlternatives(query, templates, snippets);
    const top = alternatives.slice(0, 3);

    const content = top
      .map(
        (alt, i) => `
Alternative ${i + 1}: ${alt.title}
Code:
${alt.code}

Tradeoffs:
${alt.tradeoffs}

When to use:
${alt.whenToUse}
`.trim()
      )
      .join('\n\n----------------------------------------\n\n');

    return {
      content,
      metadata: {
        tool: this.name,
        pattern,
        context: context ?? '',
        count: top.length,
      },
    };
  }

  private normalizeParams(params: unknown): SuggestAlternativesParams {
    const input = (params ?? {}) as Partial<SuggestAlternativesParams>;
    const pattern = typeof input.pattern === 'string' ? input.pattern.trim() : '';
    const context = typeof input.context === 'string' ? input.context.trim() : undefined;

    if (!pattern) {
      throw new Error('pattern is required');
    }

    return { pattern, context };
  }

  private buildAlternatives(
    query: string,
    templates: TemplateFragment[],
    snippets: CodeSnippet[]
  ): Alternative[] {
    const scored: Array<{ alt: Alternative; score: number }> = [];

    for (const tpl of templates) {
      const haystack = [
        tpl.name,
        tpl.description ?? '',
        ...(tpl.featureFlags ?? []),
        ...(tpl.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();

      const score = this.score(haystack, query);
      if (score <= 0) continue;

      scored.push({
        score,
        alt: {
          title: tpl.name,
          code: tpl.code,
          tradeoffs: `Uses template "${tpl.id}". Faster scaffolding but may include extra defaults you will customize.`,
          whenToUse: `Use when you need a starting point for ${tpl.featureFlags?.join(', ') || 'this pattern'}.`,
        },
      });
    }

    for (const snip of snippets) {
      const haystack = [snip.type, snip.useCase, snip.explanation, ...(snip.tags ?? [])]
        .join(' ')
        .toLowerCase();

      const score = this.score(haystack, query);
      if (score <= 0) continue;

      scored.push({
        score,
        alt: {
          title: snip.useCase,
          code: snip.code,
          tradeoffs: `Focused snippet with lower integration overhead, but you must wire it into your app structure manually.`,
          whenToUse: `Use when you need a targeted ${snip.type} implementation.`,
        },
      });
    }

    const deduped = this.uniqueByTitle(
      scored.sort((a, b) => b.score - a.score).map((x) => x.alt)
    );

    if (deduped.length >= 2) {
      return deduped;
    }

    return [
      {
        title: 'Hook-based approach',
        code: `// around hook example\nexport const wrapLogic = async (context, next) => {\n  // pre logic\n  await next();\n  // post logic\n};`,
        tradeoffs:
          'Centralizes cross-cutting logic, but can become hard to trace when many hooks stack.',
        whenToUse:
          'Use when behavior should run consistently around service methods.',
      },
      {
        title: 'Service-class approach',
        code: `class MyService {\n  async create(data, params) {\n    // explicit business logic in service method\n    return { ...data };\n  }\n}`,
        tradeoffs:
          'Keeps behavior explicit in one place, but may duplicate logic across services.',
        whenToUse: 'Use when behavior is service-specific and needs clear method-level ownership.',
      },
    ];
  }

  private score(haystack: string, query: string): number {
    const parts = query.split(/\s+/).filter(Boolean);
    let score = 0;
    for (const p of parts) {
      if (haystack.includes(p)) score += 1;
    }
    return score;
  }

  private uniqueByTitle(alternatives: Alternative[]): Alternative[] {
    const seen = new Set<string>();
    const out: Alternative[] = [];
    for (const alt of alternatives) {
      const key = alt.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(alt);
    }
    return out;
  }
}

export default SuggestAlternativesTool;
