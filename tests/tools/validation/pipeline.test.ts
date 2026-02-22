import { ValidationPipeline } from '../../../src/tools/validation/pipeline';
import { PrettierValidator } from '../../../src/tools/validation/prettierValidator';

describe('ValidationPipeline', () => {
  jest.setTimeout(15000);

  it('runs full pipeline on clean code', async () => {
    const pipeline = new ValidationPipeline();
    const formatter = new PrettierValidator();
    const code = formatter.format('const x = 1; console.log(x);');
    const result = await pipeline.validate(code);
    expect(result.valid).toBe(true);
    expect(result.typescript).toBeDefined();
    expect(result.eslint).toBeDefined();
    expect(result.prettier).toBeDefined();
    expect(result.bestPractices).toBeDefined();
  });

  it('short-circuits on syntax errors', async () => {
    const pipeline = new ValidationPipeline();
    const result = await pipeline.validate('const x: = 5;');
    expect(result.valid).toBe(false);
    expect(result.typescript).toBeDefined();
    expect(result.eslint).toBeUndefined();
  });

  it('respects validation options', async () => {
    const pipeline = new ValidationPipeline();
    const result = await pipeline.validate('const x = 1;\n', { eslint: false, prettier: false });
    expect(result.typescript).toBeDefined();
    expect(result.eslint).toBeUndefined();
    expect(result.prettier).toBeUndefined();
  });

  it('returns formattedCode when prettier fails', async () => {
    const pipeline = new ValidationPipeline();
    const code = 'const x=1;const y=2;';
    const result = await pipeline.validate(code);
    expect(result.prettier).toBeDefined();
    expect(result.formattedCode).toBeDefined();
  });
});
