import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaseTool } from './baseTool';
import { ToolResult } from './types';
import { JsonSchema } from '../protocol/types';

interface GetHookExampleParams {
  hookType: 'before' | 'after' | 'error';
  useCase?: string;
  version?: string;
}

interface HookSnippet {
  id: string;
  type: 'before' | 'after' | 'error';
  useCase: string;
  code: string;
  explanation: string;
  version: string;
  language?: string;
  tags?: string[];
}

export class GetHookExampleTool extends BaseTool {
  name = 'get_hook_example';
  description = 'Retrieve example FeathersJS hook best practices';

  inputSchema: JsonSchema = {
    type: 'object',
    properties: {
      hookType: {
        type: 'string',
        enum: ['before', 'after', 'error'],
      },
      useCase: { type: 'string' },
      version: { type: 'string' },
    },
    required: ['hookType'],
  };

  async execute(params: unknown): Promise<ToolResult> {
    const { hookType, useCase, version = 'v5' } = params as GetHookExampleParams;
    const snippets = this.loadSnippets(hookType);

    const versioned = snippets.filter((s) => s.version === version);
    if (versioned.length === 0) {
      return {
        content: `No hook examples found for type "${hookType}" in version "${version}".`,
      };
    }

    const match = this.selectBest(versioned, useCase);
    return {
      content: JSON.stringify(
        {
          hookType,
          useCase: match.useCase,
          version: match.version,
          code: match.code,
          explanation: match.explanation,
        },
        null,
        2
      ),
    };
  }

  private loadSnippets(hookType: 'before' | 'after' | 'error'): HookSnippet[] {
    const basePath = path.resolve(process.cwd(), 'knowledge-base', 'snippets');
    const files = [`hooks-${hookType}.json`, 'hooks-common.json'];

    const all: HookSnippet[] = [];
    for (const file of files) {
      const fullPath = path.join(basePath, file);
      if (!fs.existsSync(fullPath)) {
        continue;
      }
      const raw = fs.readFileSync(fullPath, 'utf8');
      const parsed = JSON.parse(raw) as HookSnippet[];
      all.push(...parsed);
    }

    return all.filter((s) => s.type === hookType);
  }

  private selectBest(snippets: HookSnippet[], useCase?: string): HookSnippet {
    if (!useCase) {
      return snippets[0];
    }

    const query = useCase.toLowerCase();
    const scored = snippets.map((s) => ({
      score: this.scoreSnippet(s, query),
      snippet: s,
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0].snippet;
  }

  private scoreSnippet(snippet: HookSnippet, query: string): number {
    let score = 0;
    if (snippet.useCase.toLowerCase().includes(query)) score += 5;
    if (snippet.explanation.toLowerCase().includes(query)) score += 2;
    if (snippet.tags?.some((t) => t.toLowerCase().includes(query))) score += 3;
    return score;
  }
}
