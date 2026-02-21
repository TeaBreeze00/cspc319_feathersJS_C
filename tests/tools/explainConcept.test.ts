import { ExplainConceptTool } from '../../src/tools/explainConcept';

describe('ExplainConceptTool', () => {
  const tool = new ExplainConceptTool();

  it('should explain known concepts', async () => {
    const result = await tool.execute({ concept: 'hooks' });
    expect(result.content).toMatch(/Definition:/);
  });

  it('should handle unknown concepts gracefully', async () => {
    const result = await tool.execute({ concept: 'unknownConcept' });
    expect(result.content).toMatch(/not found/);
  });
});