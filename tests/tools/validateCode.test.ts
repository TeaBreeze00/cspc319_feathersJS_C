import { ValidateCodeTool } from '../../src/tools/validateCode';
import { PrettierValidator } from '../../src/tools/validation/prettierValidator';

describe('ValidateCodeTool', () => {
  jest.setTimeout(15000);

  it('returns structured validation results', async () => {
    const tool = new ValidateCodeTool();
    const formatter = new PrettierValidator();
    const result = await tool.execute({
      code: formatter.format('const x: number = 5; console.log(x);'),
      language: 'typescript',
    });
    expect(result.content).toBeTruthy();
    const parsed = JSON.parse(result.content);
    expect(parsed.valid).toBe(true);
    expect(parsed.results).toBeDefined();
  });

  it('respects checks filter', async () => {
    const tool = new ValidateCodeTool();
    const result = await tool.execute({
      code: 'const x=1;const y=2;',
      checks: ['typescript'],
    });
    const parsed = JSON.parse(result.content);
    expect(parsed.results.typescript).toBeDefined();
    expect(parsed.results.prettier).toBeUndefined();
    expect(parsed.results.eslint).toBeUndefined();
  });
});
