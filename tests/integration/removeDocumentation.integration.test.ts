/**
 * Integration test: remove_documentation through the Router layer.
 *
 * Exercises the full path: Router → ParameterValidator → network-tier gate
 * → RemoveDocumentationTool.execute() → mock GitHubClient.
 */

import { Router } from '../../src/routing/router';
import { ToolHandlerRegistry } from '../../src/routing/toolRegistry';
import { ParameterValidator } from '../../src/routing/validator';
import { ErrorHandler } from '../../src/routing/errorHandler';
import { RemoveDocumentationTool, _resetRateLimit } from '../../src/tools/removeDocumentation';
import { KnowledgeLoader } from '../../src/knowledge';

// Mock GitHubClient
jest.mock('../../src/tools/github/githubClient', () => {
  return {
    GitHubClient: jest.fn().mockImplementation(() => ({
      createRemovalPR: jest.fn().mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/repo/pull/50',
        prNumber: 50,
        branch: 'docs/contrib/20260302T000000Z-remove-old-guide',
      }),
    })),
  };
});

const EXISTING_DOC = {
  id: 'v6-old-guide-0',
  heading: 'Old Guide',
  content: 'old content',
  rawContent: 'old content',
  breadcrumb: 'Cookbook > Old Guide',
  version: 'v6',
  tokens: 100,
  category: 'cookbook',
  sourceFile: 'docs/v6_docs/cookbook/old-guide.md',
  hasCode: false,
  codeLanguages: [],
};

function validParams() {
  return {
    filePath: 'docs/v6_docs/cookbook/old-guide.md',
    version: 'v6',
    reason: 'This guide is outdated and superseded by the new Koa middleware guide.',
    contributorName: 'Test Runner',
  };
}

describe('remove_documentation integration (Router → Tool → mock GitHub)', () => {
  let router: Router;
  const originalEnv = process.env;

  beforeEach(() => {
    _resetRateLimit();

    const mockLoader = {
      load: jest.fn().mockResolvedValue([EXISTING_DOC]),
      preload: jest.fn(),
      clearCache: jest.fn(),
      buildIndex: jest.fn(),
    } as any;

    const tool = new RemoveDocumentationTool(mockLoader);

    const routingRegistry = new ToolHandlerRegistry();
    const validator = new ParameterValidator();
    const errorHandler = new ErrorHandler();
    router = new Router(routingRegistry, validator, errorHandler);

    routingRegistry.register(
      'remove_documentation',
      (params: unknown) => tool.execute(params),
      tool.inputSchema,
      true
    );

    process.env = {
      ...originalEnv,
      GITHUB_TOKEN: 'ghp_integrationtest',
      GITHUB_OWNER: 'testowner',
      GITHUB_REPO: 'testrepo',
      ALLOW_NETWORK_TOOLS: 'true',
    };

    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('successfully routes a valid removal and returns PR details', async () => {
    const res = await router.route({
      toolName: 'remove_documentation',
      params: validParams(),
    });

    expect(res.success).toBe(true);

    const toolResult = res.data as { content: string };
    const parsed = JSON.parse(toolResult.content);
    expect(parsed.success).toBe(true);
    expect(parsed.prUrl).toBe('https://github.com/test/repo/pull/50');
  });

  it('blocks removal when ALLOW_NETWORK_TOOLS is not set', async () => {
    delete process.env.ALLOW_NETWORK_TOOLS;

    const res = await router.route({
      toolName: 'remove_documentation',
      params: validParams(),
    });

    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe('NETWORK_NOT_ALLOWED');
  });

  it('rejects invalid params through the router validation layer', async () => {
    const res = await router.route({
      toolName: 'remove_documentation',
      params: {
        // Missing required fields
        filePath: 'docs/v6_docs/cookbook/old-guide.md',
      },
    });

    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe('INVALID_PARAMS');
  });

  it('rejects when doc does not exist in knowledge base', async () => {
    // Create a new tool with an empty loader
    const emptyLoader = {
      load: jest.fn().mockResolvedValue([]),
      preload: jest.fn(),
      clearCache: jest.fn(),
      buildIndex: jest.fn(),
    } as any;
    const emptyTool = new RemoveDocumentationTool(emptyLoader);

    const routingRegistry = new ToolHandlerRegistry();
    const validator = new ParameterValidator();
    const errorHandler = new ErrorHandler();
    const emptyRouter = new Router(routingRegistry, validator, errorHandler);
    routingRegistry.register(
      'remove_documentation',
      (params: unknown) => emptyTool.execute(params),
      emptyTool.inputSchema,
      true
    );

    const res = await emptyRouter.route({
      toolName: 'remove_documentation',
      params: validParams(),
    });

    // The tool itself catches the "does not exist" case and returns a result
    // (not a thrown error), so the route succeeds but the tool result says failure
    expect(res.success).toBe(true);
    const toolResult = res.data as { content: string };
    const parsed = JSON.parse(toolResult.content);
    expect(parsed.success).toBe(false);
    expect(parsed.errors.some((e: string) => /does not exist/i.test(e))).toBe(true);
  });
});
