import { SuggestAlternativesTool } from '../../src/tools/suggestAlternatives';

describe('SuggestAlternativesTool', () => {
  const tool = new SuggestAlternativesTool();

  it('returns at least 2 alternatives', async () => {
    const result = await tool.execute({ pattern: 'authentication hook' });
    expect(result.content).toMatch(/Alternative 1:/);
    expect(result.content).toMatch(/Alternative 2:/);
  });

  it('includes tradeoffs for each suggestion', async () => {
    const result = await tool.execute({ pattern: 'service pattern' });
    expect(result.content).toMatch(/Tradeoffs:/);
  });
});
