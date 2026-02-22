import { GetHookExampleTool } from '../../src/tools/getHookExample';

describe('GetHookExampleTool', () => {
  const tool = new GetHookExampleTool();

  it('should return a hook example for valid hookType', async () => {
    const result = await tool.execute({ hookType: 'before' });
    expect(result).toHaveProperty('content');
    const parsed = JSON.parse(result.content);
    expect(parsed.code).toBeTruthy();
    expect(parsed.explanation).toBeTruthy();
  });

  it('should return hook examples for v5 version', async () => {
    const result = await tool.execute({ hookType: 'before', version: 'v5' });
    expect(result).toHaveProperty('content');
    const parsed = JSON.parse(result.content);
    expect(parsed.code).toBeTruthy();
    expect(parsed.hookType).toBe('before');
  });

  it('should return hook examples for v6 version', async () => {
    const result = await tool.execute({ hookType: 'before', version: 'v6' });
    expect(result).toHaveProperty('content');
    const parsed = JSON.parse(result.content);
    expect(parsed.code).toBeTruthy();
    expect(parsed.hookType).toBe('before');
  });

  it('should return after hook examples', async () => {
    const result = await tool.execute({ hookType: 'after' });
    expect(result).toHaveProperty('content');
    const parsed = JSON.parse(result.content);
    expect(parsed.hookType).toBe('after');
  });

  it('should return error hook examples', async () => {
    const result = await tool.execute({ hookType: 'error' });
    expect(result).toHaveProperty('content');
    const parsed = JSON.parse(result.content);
    expect(parsed.hookType).toBe('error');
  });

  it('should filter by useCase when provided', async () => {
    const result = await tool.execute({ hookType: 'before', useCase: 'validate' });
    expect(result).toHaveProperty('content');
    const parsed = JSON.parse(result.content);
    expect(parsed.code).toBeTruthy();
  });

  it('should return valid hook for any version since snippets are marked as both', async () => {
    // Even with a non-standard version string, 'both' docs should still match
    const result = await tool.execute({ hookType: 'before', version: 'nonexistent' as any });
    // Since snippets are version: 'both', they match any version filter
    const parsed = JSON.parse(result.content);
    expect(parsed.code).toBeTruthy();
  });
});
