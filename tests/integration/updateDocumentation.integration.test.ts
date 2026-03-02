/**
 * Integration test: update_documentation through the Router layer.
 *
 * Exercises the full path: Router → ParameterValidator → network-tier gate
 * → UpdateDocumentationTool.execute() → mock GitHubClient.
 */

import { Router } from '../../src/routing/router';
import { ToolHandlerRegistry } from '../../src/routing/toolRegistry';
import { ParameterValidator } from '../../src/routing/validator';
import { ErrorHandler } from '../../src/routing/errorHandler';
import { UpdateDocumentationTool, _resetRateLimit } from '../../src/tools/updateDocumentation';
import { KnowledgeLoader } from '../../src/knowledge';

// Mock GitHubClient
jest.mock('../../src/tools/github/githubClient', () => {
  return {
    GitHubClient: jest.fn().mockImplementation(() => ({
      createDocsPR: jest.fn().mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/repo/pull/60',
        prNumber: 60,
        branch: 'docs/contrib/20260302T000000Z-update-hooks',
      }),
    })),
  };
});

const EXISTING_DOC = {
  id: 'v6-custom-hooks-0',
  heading: 'Custom Hooks Guide',
  content: 'old hooks content',
  rawContent: 'old hooks content',
  breadcrumb: 'Guides > Custom Hooks',
  version: 'v6',
  tokens: 200,
  category: 'hooks',
  sourceFile: 'docs/v6_docs/guides/custom-hooks.md',
  hasCode: true,
  codeLanguages: ['typescript'],
};

function validParams() {
  return {
    title: 'Update the custom hooks guide with new patterns',
    filePath: 'docs/v6_docs/guides/custom-hooks.md',
    content:
      '# Custom Hooks Guide (Updated)\n\n' +
      'This guide explains how to write custom hooks in FeathersJS v6.\n\n' +
      '## Before Hooks\n\nBefore hooks run before the service method.\n\n' +
      '## After Hooks\n\nAfter hooks run after the service method.\n\n' +
      'Additional text to meet the minimum length requirement for this update submission.',
    version: 'v6',
    category: 'hooks',
    description: 'Updated hook patterns for v6',
    contributorName: 'Test Runner',
  };
}

describe('update_documentation integration (Router → Tool → mock GitHub)', () => {
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

    const tool = new UpdateDocumentationTool(mockLoader);

    const routingRegistry = new ToolHandlerRegistry();
    const validator = new ParameterValidator();
    const errorHandler = new ErrorHandler();
    router = new Router(routingRegistry, validator, errorHandler);

    routingRegistry.register(
      'update_documentation',
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

  it('successfully routes a valid update and returns PR details', async () => {
    const res = await router.route({
      toolName: 'update_documentation',
      params: validParams(),
    });

    expect(res.success).toBe(true);

    const toolResult = res.data as { content: string };
    const parsed = JSON.parse(toolResult.content);
    expect(parsed.success).toBe(true);
    expect(parsed.prUrl).toBe('https://github.com/test/repo/pull/60');
    expect(parsed.prNumber).toBe(60);
  });

  it('blocks update when ALLOW_NETWORK_TOOLS is not set', async () => {
    delete process.env.ALLOW_NETWORK_TOOLS;

    const res = await router.route({
      toolName: 'update_documentation',
      params: validParams(),
    });

    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe('NETWORK_NOT_ALLOWED');
  });

  it('rejects invalid params through the router validation layer', async () => {
    const res = await router.route({
      toolName: 'update_documentation',
      params: {
        // Missing required fields: content, version
        title: 'x',
        filePath: 'docs/v6_docs/guides/custom-hooks.md',
      },
    });

    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe('INVALID_PARAMS');
  });

  it('rejects update when doc does not exist in knowledge base', async () => {
    const emptyLoader = {
      load: jest.fn().mockResolvedValue([]),
      preload: jest.fn(),
      clearCache: jest.fn(),
      buildIndex: jest.fn(),
    } as any;
    const emptyTool = new UpdateDocumentationTool(emptyLoader);

    const routingRegistry = new ToolHandlerRegistry();
    const validator = new ParameterValidator();
    const errorHandler = new ErrorHandler();
    const emptyRouter = new Router(routingRegistry, validator, errorHandler);
    routingRegistry.register(
      'update_documentation',
      (params: unknown) => emptyTool.execute(params),
      emptyTool.inputSchema,
      true
    );

    const res = await emptyRouter.route({
      toolName: 'update_documentation',
      params: validParams(),
    });

    expect(res.success).toBe(true);
    const toolResult = res.data as { content: string };
    const parsed = JSON.parse(toolResult.content);
    expect(parsed.success).toBe(false);
    expect(parsed.errors.some((e: string) => /does not exist/i.test(e))).toBe(true);
    expect(parsed.errors.some((e: string) => /submit_documentation/i.test(e))).toBe(true);
  });
});
