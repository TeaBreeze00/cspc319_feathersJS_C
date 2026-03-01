import { GitHubClient } from '../../../src/tools/github/githubClient';

// Mock the https module
jest.mock('https', () => {
  const original = jest.requireActual('https');
  return {
    ...original,
    request: jest.fn(),
  };
});

import * as https from 'https';
import { EventEmitter } from 'events';

const mockRequest = https.request as jest.MockedFunction<typeof https.request>;

/**
 * Helper: create a mock IncomingMessage (response) + ClientRequest (request).
 */
function createMockResponse(statusCode: number, body: string | object) {
  const response = new EventEmitter() as any;
  response.statusCode = statusCode;

  const req = new EventEmitter() as any;
  req.write = jest.fn();
  req.end = jest.fn();
  req.destroy = jest.fn();
  req.setTimeout = jest.fn();

  mockRequest.mockImplementation((_opts: any, callback: any) => {
    // Defer so the caller has time to attach listeners
    process.nextTick(() => {
      callback(response);
      const data = typeof body === 'string' ? body : JSON.stringify(body);
      response.emit('data', Buffer.from(data));
      response.emit('end');
    });
    return req;
  });

  return { req, response };
}

/**
 * Helper: set up a sequence of mock responses for multiple API calls.
 */
function setupSequentialResponses(
  responses: Array<{ status: number; body: string | object }>
) {
  let callIndex = 0;
  const requests: any[] = [];

  mockRequest.mockImplementation((_opts: any, callback: any) => {
    const responseData = responses[callIndex] || { status: 500, body: 'No more responses' };
    callIndex++;

    const res = new EventEmitter() as any;
    res.statusCode = responseData.status;

    const req = new EventEmitter() as any;
    req.write = jest.fn();
    req.end = jest.fn();
    req.destroy = jest.fn();
    req.setTimeout = jest.fn();
    requests.push(req);

    process.nextTick(() => {
      callback(res);
      const data =
        typeof responseData.body === 'string'
          ? responseData.body
          : JSON.stringify(responseData.body);
      res.emit('data', Buffer.from(data));
      res.emit('end');
    });

    return req;
  });

  return requests;
}

describe('GitHubClient', () => {
  let client: GitHubClient;

  beforeEach(() => {
    client = new GitHubClient();
    mockRequest.mockReset();
  });

  describe('generateBranchName', () => {
    it('generates a branch name with timestamp and slug', () => {
      const branch = client.generateBranchName('Add Koa Middleware Guide');
      expect(branch).toMatch(/^docs\/contrib\/\d{8}T\d{6}Z-add-koa-middleware-guide$/);
    });

    it('truncates long titles to 40 chars in slug', () => {
      const longTitle = 'A very long title that exceeds the forty character slug limit for branch names';
      const branch = client.generateBranchName(longTitle);
      const slug = branch.split('-').slice(1).join('-'); // remove timestamp prefix
      // The full slug portion (after timestamp-) should be <= 40 chars
      const parts = branch.replace(/^docs\/contrib\/\d{8}T\d{6}Z-/, '');
      expect(parts.length).toBeLessThanOrEqual(40);
    });

    it('strips special characters from slug', () => {
      const branch = client.generateBranchName('Fix: auth & hooks (v5)!!!');
      expect(branch).toMatch(/^docs\/contrib\/\d{8}T\d{6}Z-fix-auth-hooks-v5$/);
    });
  });

  describe('createDocsPR - success', () => {
    it('creates a PR with 4 API calls (new file)', async () => {
      setupSequentialResponses([
        // 1. GET ref/heads/main
        { status: 200, body: { object: { sha: 'abc123' } } },
        // 2. POST git/refs (create branch)
        { status: 201, body: { ref: 'refs/heads/docs/contrib/test-branch' } },
        // 3. PUT contents (create file)
        { status: 201, body: { content: { sha: 'def456' } } },
        // 4. POST pulls (create PR)
        { status: 201, body: { number: 42, html_url: 'https://github.com/test/repo/pull/42' } },
      ]);

      const result = await client.createDocsPR({
        token: 'ghp_testtoken',
        owner: 'testowner',
        repo: 'testrepo',
        filePath: 'docs/v6_docs/guides/new-guide.md',
        content: '# New Guide\n\nContent here.',
        title: 'Add new guide for testing',
        version: 'v6',
        isUpdate: false,
      });

      expect(result.success).toBe(true);
      expect(result.prNumber).toBe(42);
      expect(result.prUrl).toBe('https://github.com/test/repo/pull/42');
      expect(result.branch).toMatch(/^docs\/contrib\//);
      expect(mockRequest).toHaveBeenCalledTimes(4);
    });

    it('creates a PR with 5 API calls (update existing file)', async () => {
      setupSequentialResponses([
        // 1. GET ref/heads/main
        { status: 200, body: { object: { sha: 'abc123' } } },
        // 2. POST git/refs
        { status: 201, body: { ref: 'refs/heads/docs/contrib/test-branch' } },
        // 3. GET contents (existing file SHA)
        { status: 200, body: { sha: 'existing-sha-789' } },
        // 4. PUT contents (update file)
        { status: 200, body: { content: { sha: 'new-sha-012' } } },
        // 5. POST pulls
        { status: 201, body: { number: 99, html_url: 'https://github.com/test/repo/pull/99' } },
      ]);

      const result = await client.createDocsPR({
        token: 'ghp_testtoken',
        owner: 'testowner',
        repo: 'testrepo',
        filePath: 'docs/v5_docs/api/services.md',
        content: '# Updated Services\n\nNew content.',
        title: 'Update services documentation',
        version: 'v5',
        isUpdate: true,
      });

      expect(result.success).toBe(true);
      expect(result.prNumber).toBe(99);
      expect(mockRequest).toHaveBeenCalledTimes(5);
    });
  });

  describe('createDocsPR - error handling', () => {
    it('handles 401 authentication failure', async () => {
      setupSequentialResponses([{ status: 401, body: 'Unauthorized' }]);

      const result = await client.createDocsPR({
        token: 'bad_token',
        owner: 'testowner',
        repo: 'testrepo',
        filePath: 'docs/v6_docs/test.md',
        content: '# Test',
        title: 'Test submission title',
        version: 'v6',
        isUpdate: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Authentication failed/i);
    });

    it('handles 403 insufficient permissions', async () => {
      setupSequentialResponses([{ status: 403, body: 'Forbidden' }]);

      const result = await client.createDocsPR({
        token: 'limited_token',
        owner: 'testowner',
        repo: 'testrepo',
        filePath: 'docs/v6_docs/test.md',
        content: '# Test',
        title: 'Test submission title',
        version: 'v6',
        isUpdate: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permissions/i);
    });

    it('handles 404 repository not found', async () => {
      setupSequentialResponses([{ status: 404, body: 'Not Found' }]);

      const result = await client.createDocsPR({
        token: 'ghp_testtoken',
        owner: 'nonexistent',
        repo: 'nonexistent',
        filePath: 'docs/v6_docs/test.md',
        content: '# Test',
        title: 'Test submission title',
        version: 'v6',
        isUpdate: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    it('handles 422 validation failure', async () => {
      setupSequentialResponses([
        { status: 200, body: { object: { sha: 'abc123' } } },
        { status: 422, body: { message: 'Reference already exists' } },
      ]);

      const result = await client.createDocsPR({
        token: 'ghp_testtoken',
        owner: 'testowner',
        repo: 'testrepo',
        filePath: 'docs/v6_docs/test.md',
        content: '# Test',
        title: 'Test submission title',
        version: 'v6',
        isUpdate: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/422/);
    });

    it('handles 429 rate limit exceeded', async () => {
      setupSequentialResponses([{ status: 429, body: 'Rate limit exceeded' }]);

      const result = await client.createDocsPR({
        token: 'ghp_testtoken',
        owner: 'testowner',
        repo: 'testrepo',
        filePath: 'docs/v6_docs/test.md',
        content: '# Test',
        title: 'Test submission title',
        version: 'v6',
        isUpdate: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/rate limit/i);
    });

    it('handles network errors', async () => {
      mockRequest.mockImplementation((_opts: any, _callback: any) => {
        const req = new EventEmitter() as any;
        req.write = jest.fn();
        req.end = jest.fn();
        req.destroy = jest.fn();
        req.setTimeout = jest.fn();

        process.nextTick(() => {
          req.emit('error', new Error('ECONNREFUSED'));
        });

        return req;
      });

      const result = await client.createDocsPR({
        token: 'ghp_testtoken',
        owner: 'testowner',
        repo: 'testrepo',
        filePath: 'docs/v6_docs/test.md',
        content: '# Test',
        title: 'Test submission title',
        version: 'v6',
        isUpdate: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Network error/i);
    });

    it('never leaks the auth token in error messages', async () => {
      setupSequentialResponses([
        { status: 200, body: { object: { sha: 'abc123' } } },
        { status: 500, body: 'Internal error with token ghp_secret123' },
      ]);

      const result = await client.createDocsPR({
        token: 'ghp_secret123',
        owner: 'testowner',
        repo: 'testrepo',
        filePath: 'docs/v6_docs/test.md',
        content: '# Test',
        title: 'Test submission title',
        version: 'v6',
        isUpdate: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).not.toContain('ghp_secret123');
    });
  });
});
