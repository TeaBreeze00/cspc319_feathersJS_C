import { ListToolsTool } from '../../src/tools/listTools';

describe('ListToolsTool', () => {
  const tool = new ListToolsTool();

  it('lists all tools by default', async () => {
    const result = await tool.execute({});
    expect(result.content).toMatch(/search_docs/);
    expect(result.content).toMatch(/suggest_alternatives/);
    expect(result.content).toMatch(/list_available_tools/);
  });

  it('filters by category', async () => {
    const result = await tool.execute({ category: 'advanced' });
    expect(result.content).toMatch(/suggest_alternatives/);
    expect(result.content).toMatch(/list_available_tools/);
    expect(result.content).not.toMatch(/search_docs/);
  });
});
