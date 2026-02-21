import { GetBestPracticesTool } from '../../src/tools/getBestPractices';

describe('GetBestPracticesTool', () => {
  const tool = new GetBestPracticesTool();

  it('should return practices for each topic', async () => {
    const result = await tool.execute({ topic: 'hooks' });
    expect(result.content).toMatch(/Rule:/);
  });

  it('should rank practices based on context', async () => {
    const result = await tool.execute({ topic: 'hooks', useCase: 'authentication' });
    expect(result.content).toMatch(/Good Example:/);
  });
});