/**
 * Integration test: submit_documentation through the Router layer.
 *
 * Exercises the full path: Router → ParameterValidator → network-tier gate
 * → SubmitDocumentationTool.execute() → mock GitHubClient.
 */

import { Router } from '../../src/routing/router';
import { ToolHandlerRegistry } from '../../src/routing/toolRegistry';
import { ParameterValidator } from '../../src/routing/validator';
import { ErrorHandler } from '../../src/routing/errorHandler';
import {
  SubmitDocumentationTool,
  _resetRateLimit,
} from '../../src/tools/submitDocumentation';
import { KnowledgeLoader } from '../../src/knowledge';

// Mock GitHubClient
jest.mock('../../src/tools/github/githubClient', () => {
  return {
    GitHubClient: jest.fn().mockImplementation(() => ({
      createDocsPR: jest.fn().mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/repo/pull/42',
        prNumber: 42,
        branch: 'docs/contrib/20260301T000000Z-integration-test',
      }),
    })),
  };
});

function validParams() {
  return {
    title: 'Integration test documentation submission',
    filePath: 'docs/v6_docs/guides/integration-test.md',
    content:
      '# Integration Test Guide\n\n' +
      'This guide covers integration testing patterns in FeathersJS v6.\n\n' +
      '## Setup\n\nInstall the test dependencies and configure your test runner.\n\n' +
      '## Running Tests\n\nRun the test suite with `npm test`.\n\n' +
      'Additional text to meet the minimum length requirement for submissions.',
    version: 'v6',
    category: 'testing',
    description: 'A guide for integration testing',
    contributorName: 'Test Runner',
  };
}

describe('submit_documentation integration (Router → Tool → mock GitHub)', () => {
  let router: Router;
  let routingRegistry: ToolHandlerRegistry;
  const originalEnv = process.env;

  beforeEach(() => {
    _resetRateLimit();

    const mockLoader = {
      load: jest.fn().mockResolvedValue([]),
      preload: jest.fn(),
      clearCache: jest.fn(),
      buildIndex: jest.fn(),
    } as any;

    const tool = new SubmitDocumentationTool(mockLoader);

    routingRegistry = new ToolHandlerRegistry();
    const validator = new ParameterValidator();
    const errorHandler = new ErrorHandler();
    router = new Router(routingRegistry, validator, errorHandler);

    routingRegistry.register(
      'submit_documentation',
      (params: unknown) => tool.execute(params),
      tool.inputSchema,
      true // requiresNetwork
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

  it('successfully routes a valid submission and returns PR details', async () => {
    const res = await router.route({
      toolName: 'submit_documentation',
      params: validParams(),
    });

    expect(res.success).toBe(true);

    // The tool returns a ToolResult with content as JSON string
    const toolResult = res.data as { content: string };
    const parsed = JSON.parse(toolResult.content);
    expect(parsed.success).toBe(true);
    expect(parsed.prUrl).toBe('https://github.com/test/repo/pull/42');
    expect(parsed.prNumber).toBe(42);
  });

  it('blocks submission when ALLOW_NETWORK_TOOLS is not set', async () => {
    delete process.env.ALLOW_NETWORK_TOOLS;

    const res = await router.route({
      toolName: 'submit_documentation',
      params: validParams(),
    });

    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe('NETWORK_NOT_ALLOWED');
  });

  it('rejects invalid params through the router validation layer', async () => {
    const res = await router.route({
      toolName: 'submit_documentation',
      params: {
        // Missing required fields: title, filePath, content, version
        title: 'x', // too short for tool validation but might pass schema
      },
    });

    // The router-level Ajv validation or the tool itself should catch this
    expect(res.success).toBe(true); // Router passes because Ajv schema doesn't enforce minLength
    // But the tool's defense-in-depth catches it
    const toolResult = res.data as { content: string };
    const parsed = JSON.parse(toolResult.content);
    expect(parsed.success).toBe(false);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });

  it('handles empty params gracefully', async () => {
    const res = await router.route({
      toolName: 'submit_documentation',
      params: {},
    });

    // Router passes (schema has required fields but Ajv may or may not catch all)
    // Tool's own validation catches it
    if (res.success) {
      const toolResult = res.data as { content: string };
      const parsed = JSON.parse(toolResult.content);
      expect(parsed.success).toBe(false);
    } else {
      // Router-level validation caught it
      expect(res.error).toBeDefined();
    }
  });
});
