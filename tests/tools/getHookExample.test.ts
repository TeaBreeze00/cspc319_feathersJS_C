import { GetHookExampleTool } from '../../src/tools/getHookExample';

describe('GetHookExampleTool', () => {
  const tool = new GetHookExampleTool();

  it('should return a hook example for valid hookType', async () => {
    const result = await tool.execute({ hookType: 'before' });
    expect(result).toHaveProperty('content');
    expect(result.content).toMatch(/Rule:/);
  });

  it('should filter by version', async () => {
    const resultV5 = await tool.execute({ hookType: 'before', version: 'v5' });
    const resultV6 = await tool.execute({ hookType: 'before', version: 'v6' });
    expect(resultV5.content).not.toBe(resultV6.content);
  });

  it('should return message when no hooks match', async () => {
    const result = await tool.execute({ hookType: 'before', version: 'nonexistent' });
    expect(result.content).toMatch(/No hook examples found/);
  });
});