import { BaseTool } from './baseTool';
import { JsonSchema, ToolResult } from '../protocol/types';

type ToolCategory = 'search' | 'generate' | 'validate' | 'support' | 'advanced';

interface ListToolsParams {
  category?: ToolCategory;
}

interface ToolCatalogEntry {
  name: string;
  category: ToolCategory;
  description: string;
  inputSchema: JsonSchema;
  example: string;
}

export class ListToolsTool extends BaseTool {
  name = 'list_available_tools';

  description =
    'List all available MCP tools by category with descriptions, input schemas, and usage examples.';

  inputSchema: JsonSchema = {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['search', 'generate', 'validate', 'support', 'advanced'],
      },
    },
    required: [],
    additionalProperties: false,
  };

  private catalog: ToolCatalogEntry[];

  constructor(catalog?: ToolCatalogEntry[]) {
    super();
    this.catalog = catalog ?? this.defaultCatalog();
  }

  async execute(params: unknown): Promise<ToolResult> {
    const { category } = this.normalizeParams(params);
    const entries = category
      ? this.catalog.filter((entry) => entry.category === category)
      : this.catalog;

    const lines = entries.map((entry) =>
      [
        `Tool: ${entry.name}`,
        `Category: ${entry.category}`,
        `Description: ${entry.description}`,
        `Input Schema: ${JSON.stringify(entry.inputSchema)}`,
        `Example: ${entry.example}`,
      ].join('\n')
    );

    const header = category
      ? `Available tools in category "${category}" (${entries.length}):`
      : `Available tools (${entries.length}):`;

    return {
      content: [header, ...lines].join('\n\n'),
      metadata: {
        tool: this.name,
        count: entries.length,
        category: category ?? 'all',
        tools: entries.map((entry) => entry.name),
      },
    };
  }

  private normalizeParams(params: unknown): ListToolsParams {
    const input = (params ?? {}) as Partial<ListToolsParams>;
    const category = input.category;
    if (
      category &&
      category !== 'search' &&
      category !== 'generate' &&
      category !== 'validate' &&
      category !== 'support' &&
      category !== 'advanced'
    ) {
      throw new Error(`Invalid category: ${category}`);
    }
    return { category };
  }

  private defaultCatalog(): ToolCatalogEntry[] {
    return [
      {
        name: 'search_docs',
        category: 'search',
        description: 'Search FeathersJS documentation using semantic similarity.',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
        example: `{"name":"search_docs","arguments":{"query":"hooks"}}`,
      },

      {
        name: 'generate_service',
        category: 'generate',
        description: 'Generate service boilerplate from a service specification.',
        inputSchema: {
          type: 'object',
          properties: { serviceName: { type: 'string' } },
          required: ['serviceName'],
        },
        example: `{"name":"generate_service","arguments":{"serviceName":"messages"}}`,
      },

      {
        name: 'explain_concept',
        category: 'support',
        description: 'Explain a FeathersJS concept with related topics.',
        inputSchema: {
          type: 'object',
          properties: { concept: { type: 'string' } },
          required: ['concept'],
        },
        example: `{"name":"explain_concept","arguments":{"concept":"hooks"}}`,
      },

      {
        name: 'list_available_tools',
        category: 'advanced',
        description: 'List tools by category with examples and schemas.',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['search', 'generate', 'validate', 'support', 'advanced'],
            },
          },
          required: [],
        },
        example: `{"name":"list_available_tools","arguments":{"category":"support"}}`,
      },
      {
        name: 'validate_code',
        category: 'advanced',
        description:
          'Validate code for TypeScript syntax, linting, formatting, and FeathersJS best practices.',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            language: { type: 'string', enum: ['typescript', 'javascript'] },
            checks: { type: 'array', items: { type: 'string' } },
          },
          required: ['code'],
        },
        example: `{"name":"validate_code_tools","arguments":{"code":"const x = 1;","language":"typescript","checks":["syntax","linting","formatting","feathersjs"]}}`,
      },
    ];
  }
}

export default ListToolsTool;
