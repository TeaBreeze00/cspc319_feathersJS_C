import { TroubleshootErrorTool } from '../../src/tools/troubleshootError';

describe('TroubleshootErrorTool', () => {
  const tool = new TroubleshootErrorTool();

  it('should handle known error patterns', async () => {
    const result = await tool.execute({ errorMessage: 'Known error example' });
    expect(result.content).toMatch(/Solution:/);
  });

  it('should handle unknown errors gracefully', async () => {
    const result = await tool.execute({ errorMessage: 'Some random error' });
    expect(result.content).toMatch(/No known solution/);
  });
});