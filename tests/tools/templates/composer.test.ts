import { GenerateServiceTool } from '../../../src/tools/generateService';
import { ListToolsTool } from '../../../src/tools/listTools';

describe('Template composition regression checks', () => {
  const generateServiceTool = new GenerateServiceTool();

  test('project no longer exposes get_feathers_template as a tool', async () => {
    const listTools = new ListToolsTool();
    const result = await listTools.execute({});

    expect(result.content).not.toContain('get_feathers_template');
    expect(result.content).toContain('generate_service');
  });

  test('generate_service composes a full service file set deterministically', async () => {
    const params = {
      name: 'messages',
      database: 'mongodb' as const,
      fields: [
        { name: 'text', type: 'string' as const, required: true },
        { name: 'read', type: 'boolean' as const, required: false },
      ],
    };

    const first = JSON.parse((await generateServiceTool.execute(params)).content);
    const second = JSON.parse((await generateServiceTool.execute(params)).content);

    expect(Object.keys(first.files).sort()).toEqual(Object.keys(second.files).sort());
    expect(first.files['src/services/messages/messages.service.ts'].content).toBe(
      second.files['src/services/messages/messages.service.ts'].content
    );
    expect(first.files['src/services/messages/messages.hooks.ts'].content).toContain('before: {');
  });

  test('generated service file includes single import statements without duplicates', async () => {
    const parsed = JSON.parse(
      (
        await generateServiceTool.execute({
          name: 'orders',
          database: 'postgresql',
          fields: [{ name: 'total', type: 'number', required: true }],
        })
      ).content
    );

    const serviceContent = parsed.files['src/services/orders/orders.service.ts'].content as string;
    const importLines = serviceContent.split('\n').filter((line) => line.startsWith('import '));
    const uniqueImportLines = new Set(importLines);

    expect(importLines.length).toBe(uniqueImportLines.size);
    expect(serviceContent).toContain("app.use('orders'");
  });
});
