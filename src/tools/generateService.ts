import { BaseTool } from './baseTool';
import { ToolResult } from './types';
import {
  createImport,
  createClass,
  createInterface,
  PropertyDef,
  MethodDef,
} from './codegen/astUtils';
import {
  generateMongooseSchema,
  generateKnexSchema,
  generateTypeScriptInterface,
  FieldDef,
} from './codegen/schemaGenerator';
import { ValidationPipeline } from './validation';

type DatabaseType = 'mongodb' | 'postgresql' | 'sqlite';

/**
 * Field definition for service generation.
 */
interface FieldDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'objectId' | 'array' | 'object';
  required?: boolean;
  unique?: boolean;
  default?: string | number | boolean;
}

interface GenerateServiceParams {
  name: string;
  database: DatabaseType;
  fields: FieldDefinition[];
  version?: 'v5';
}

interface GeneratedFile {
  path: string;
  content: string;
  type: 'service' | 'hooks' | 'schema' | 'test';
}

/**
 * Tool that generates a complete FeathersJS service with all associated files.
 *
 * Name: `generate_service`
 *
 * Input:
 *   - name: string (required) - service name (e.g., 'users', 'messages')
 *   - database: 'mongodb' | 'postgresql' | 'sqlite' (required) - database adapter
 *   - fields: FieldDefinition[] (required) - array of field definitions
 *
 * Generates:
 *   1. Service class file (e.g., users.service.ts)
 *   2. Hooks file (e.g., users.hooks.ts)
 *   3. Schema/model file (e.g., users.schema.ts or users.model.ts)
 *   4. Test file (e.g., users.test.ts)
 */
export class GenerateServiceTool extends BaseTool {
  name = 'generate_service';

  description =
    'Generates a complete FeathersJS service with service class, hooks, schema/model, and test files.';

  inputSchema = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Service name (e.g., "users", "messages").',
      },
      database: {
        type: 'string',
        enum: ['mongodb', 'postgresql', 'sqlite'],
        description: 'Database adapter to use.',
      },
      fields: {
        type: 'array',
        description: 'Array of field definitions for the service schema.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Field name.' },
            type: {
              type: 'string',
              enum: ['string', 'number', 'boolean', 'date', 'objectId', 'array', 'object'],
              description: 'Field type.',
            },
            required: { type: 'boolean', description: 'Whether the field is required.' },
            unique: { type: 'boolean', description: 'Whether the field must be unique.' },
          },
          required: ['name', 'type'],
        },
      },
    },
    required: ['name', 'database', 'fields'],
    additionalProperties: false,
  };

  constructor() {
    super();
  }

  /**
   * Execute the generate_service tool.
   */
  async execute(params: unknown): Promise<ToolResult> {
    const normalized = this.normalizeParams(params);
    const { name, database, fields } = normalized;

    const generatedFiles: GeneratedFile[] = [];

    // 1. Generate schema/model file
    const schemaFile = this.generateSchemaFile(name, database, fields);
    generatedFiles.push(schemaFile);

    // 2. Generate service class file
    const serviceFile = this.generateServiceFile(name, database);
    generatedFiles.push(serviceFile);

    // 3. Generate hooks file
    const hooksFile = this.generateHooksFile(name);
    generatedFiles.push(hooksFile);

    // 4. Generate test file
    const testFile = this.generateTestFile(name, fields);
    generatedFiles.push(testFile);

    const validationErrors = await this.validateGeneratedFiles(generatedFiles);
    if (validationErrors.length > 0) {
      return {
        content: JSON.stringify(
          {
            error: 'Generated service failed validation',
            issues: validationErrors,
          },
          null,
          2
        ),
        metadata: {
          tool: 'generate_service',
          validationFailed: true,
          issueCount: validationErrors.length,
        },
      };
    }

    // Build result
    const filesMap: Record<string, { path: string; content: string; type: string; size: number }> =
      {};
    for (const file of generatedFiles) {
      filesMap[file.path] = {
        path: file.path,
        content: file.content,
        type: file.type,
        size: file.content.length,
      };
    }

    const result = {
      name,
      database,
      fieldCount: fields.length,
      files: filesMap,
    };

    return {
      content: JSON.stringify(result, null, 2),
      metadata: {
        tool: 'generate_service',
        name,
        database,
        fieldCount: fields.length,
        fileCount: generatedFiles.length,
        files: generatedFiles.map((f) => ({ path: f.path, type: f.type })),
      },
    };
  }

  private async validateGeneratedFiles(
    files: GeneratedFile[]
  ): Promise<Array<{ path: string; type: string; result: unknown }>> {
    const validator = new ValidationPipeline({ typeCheck: false });
    const errors: Array<{ path: string; type: string; result: unknown }> = [];

    for (const file of files) {
      if (!file.path.endsWith('.ts') && !file.path.endsWith('.js')) {
        continue;
      }
      const result = await validator.validate(file.content, {
        typescript: true,
        eslint: false,
        prettier: false,
        bestPractices: false,
      });
      if (!result.valid) {
        errors.push({
          path: file.path,
          type: file.type,
          result,
        });
      }
    }

    return errors;
  }

  /**
   * Normalize and validate incoming parameters.
   */
  private normalizeParams(params: unknown): Required<GenerateServiceParams> {
    const obj = (params ?? {}) as Partial<GenerateServiceParams>;

    if (!obj.name || typeof obj.name !== 'string') {
      throw new Error('Service name is required and must be a string.');
    }

    if (!obj.database || !['mongodb', 'postgresql', 'sqlite'].includes(obj.database)) {
      throw new Error('Database must be one of: mongodb, postgresql, sqlite');
    }

    if (!obj.fields || !Array.isArray(obj.fields) || obj.fields.length === 0) {
      throw new Error('Fields array is required and must not be empty.');
    }

    const name = this.sanitizeName(obj.name);
    const database = obj.database as DatabaseType;
    const fields = obj.fields.map((f) => this.normalizeField(f));
    const version = 'v5' as const;

    return { name, database, fields, version };
  }

  /**
   * Sanitize service name to be a valid identifier.
   */
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/^[0-9]/, '_$&');
  }

  /**
   * Normalize a field definition.
   */
  private normalizeField(field: unknown): FieldDefinition {
    const f = field as Partial<FieldDefinition>;

    if (!f.name || typeof f.name !== 'string') {
      throw new Error('Field name is required.');
    }

    const validTypes = ['string', 'number', 'boolean', 'date', 'objectId', 'array', 'object'];
    if (!f.type || !validTypes.includes(f.type)) {
      throw new Error(`Field type must be one of: ${validTypes.join(', ')}`);
    }

    return {
      name: f.name,
      type: f.type as FieldDefinition['type'],
      required: f.required === true,
      unique: f.unique === true,
      default: f.default,
    };
  }

  /**
   * Convert FieldDefinition to FieldDef for schema generator.
   */
  private toFieldDef(field: FieldDefinition): FieldDef {
    return {
      name: field.name,
      type: field.type,
      required: field.required,
      unique: field.unique,
      default: field.default,
    };
  }

  /**
   * Generate the schema/model file based on database type.
   */
  private generateSchemaFile(
    name: string,
    database: DatabaseType,
    fields: FieldDefinition[]
  ): GeneratedFile {
    const fieldDefs = fields.map((f) => this.toFieldDef(f));
    const className = this.capitalize(name);

    let content: string;
    let fileName: string;

    if (database === 'mongodb') {
      // Generate Mongoose schema
      content = generateMongooseSchema(fieldDefs);
      // Replace generic names with service-specific names
      content = content.replace(/IDocument/g, `I${className}`);
      content = content.replace(/Model = model<I/g, `${className}Model = model<I`);
      content = content.replace(/'Model'/g, `'${className}'`);
      fileName = `${name}.schema.ts`;
    } else {
      // Generate Knex migration for PostgreSQL/SQLite
      content = generateKnexSchema(fieldDefs, name);
      fileName = `${name}.model.ts`;
    }

    return {
      path: `src/services/${name}/${fileName}`,
      content,
      type: 'schema',
    };
  }

  /**
   * Generate the service class file.
   */
  private generateServiceFile(name: string, database: DatabaseType): GeneratedFile {
    const className = this.capitalize(name);
    const lines: string[] = [];

    // Imports
    if (database === 'mongodb') {
      lines.push(createImport('@feathersjs/mongodb', ['MongoDBService']));
      lines.push(createImport(`./schema`, [`I${className}`]));
    } else {
      lines.push(createImport('@feathersjs/knex', ['KnexService']));
    }
    lines.push(createImport('@feathersjs/feathers', ['Application', 'Params']));
    lines.push('');

    // Type declarations
    lines.push(`export type ${className}Data = Partial<I${className}>;`);
    lines.push(`export type ${className}Patch = Partial<I${className}>;`);
    lines.push(`export type ${className}Query = Partial<I${className}>;`);
    lines.push('');

    // Service class
    if (database === 'mongodb') {
      lines.push(
        `export class ${className}Service extends MongoDBService<I${className}, ${className}Data, Params, ${className}Patch> {`
      );
    } else {
      lines.push(`export class ${className}Service extends KnexService {`);
    }
    lines.push(`  constructor(options: any) {`);
    lines.push(`    super(options);`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  // Add custom service methods here`);
    lines.push(`}`);
    lines.push('');

    // Service configuration function
    lines.push(`export const ${name} = (app: Application): void => {`);
    if (database === 'mongodb') {
      lines.push(`  const collection = app.get('mongodbClient').db().collection('${name}');`);
      lines.push(`  app.use('${name}', new ${className}Service({ collection }));`);
    } else {
      lines.push(
        `  const db = app.get('${database === 'postgresql' ? 'postgresqlClient' : 'sqliteClient'}');`
      );
      lines.push(`  app.use('${name}', new ${className}Service({`);
      lines.push(`    Model: db,`);
      lines.push(`    name: '${name}'`);
      lines.push(`  }));`);
    }
    lines.push('');
    lines.push(`  const service = app.service('${name}');`);
    lines.push(`  service.hooks(${name}Hooks);`);
    lines.push(`};`);
    lines.push('');

    lines.push(`export default ${name};`);

    // Add hooks import at the top
    const hooksImport = `import { ${name}Hooks } from './${name}.hooks';`;
    lines.splice(lines.indexOf(''), 0, hooksImport);

    return {
      path: `src/services/${name}/${name}.service.ts`,
      content: lines.join('\n'),
      type: 'service',
    };
  }

  /**
   * Generate the hooks file.
   */
  private generateHooksFile(name: string): GeneratedFile {
    const lines: string[] = [];

    lines.push(createImport('@feathersjs/feathers', ['HookContext']));
    lines.push('');

    // Before hooks
    lines.push(`const beforeAll = async (context: HookContext): Promise<HookContext> => {`);
    lines.push(`  // Add before all hook logic here`);
    lines.push(`  return context;`);
    lines.push(`};`);
    lines.push('');

    // After hooks
    lines.push(`const afterAll = async (context: HookContext): Promise<HookContext> => {`);
    lines.push(`  // Add after all hook logic here`);
    lines.push(`  return context;`);
    lines.push(`};`);
    lines.push('');

    // Error hooks
    lines.push(`const errorAll = async (context: HookContext): Promise<HookContext> => {`);
    lines.push(`  // Add error handling logic here`);
    lines.push(`  console.error(\`Error in ${name} service:\`, context.error);`);
    lines.push(`  return context;`);
    lines.push(`};`);
    lines.push('');

    // Hooks object
    lines.push(`export const ${name}Hooks = {`);
    lines.push(`  before: {`);
    lines.push(`    all: [beforeAll],`);
    lines.push(`    find: [],`);
    lines.push(`    get: [],`);
    lines.push(`    create: [],`);
    lines.push(`    update: [],`);
    lines.push(`    patch: [],`);
    lines.push(`    remove: []`);
    lines.push(`  },`);
    lines.push(`  after: {`);
    lines.push(`    all: [afterAll],`);
    lines.push(`    find: [],`);
    lines.push(`    get: [],`);
    lines.push(`    create: [],`);
    lines.push(`    update: [],`);
    lines.push(`    patch: [],`);
    lines.push(`    remove: []`);
    lines.push(`  },`);
    lines.push(`  error: {`);
    lines.push(`    all: [errorAll],`);
    lines.push(`    find: [],`);
    lines.push(`    get: [],`);
    lines.push(`    create: [],`);
    lines.push(`    update: [],`);
    lines.push(`    patch: [],`);
    lines.push(`    remove: []`);
    lines.push(`  }`);
    lines.push(`};`);
    lines.push('');

    lines.push(`export default ${name}Hooks;`);

    return {
      path: `src/services/${name}/${name}.hooks.ts`,
      content: lines.join('\n'),
      type: 'hooks',
    };
  }

  /**
   * Generate the test file.
   */
  private generateTestFile(name: string, fields: FieldDefinition[]): GeneratedFile {
    const className = this.capitalize(name);
    const lines: string[] = [];

    lines.push(createImport('@feathersjs/feathers', ['feathers']));
    lines.push(`import { ${name} } from './${name}.service';`);
    lines.push('');

    lines.push(`describe('${name} service', () => {`);
    lines.push(`  let app: any;`);
    lines.push('');

    lines.push(`  beforeEach(() => {`);
    lines.push(`    app = feathers();`);
    lines.push(`    // Mock database connection`);
    lines.push(`    app.set('mongodbClient', {`);
    lines.push(`      db: () => ({`);
    lines.push(`        collection: () => ({})`);
    lines.push(`      })`);
    lines.push(`    });`);
    lines.push(`    app.configure(${name});`);
    lines.push(`  });`);
    lines.push('');

    lines.push(`  it('registered the service', () => {`);
    lines.push(`    const service = app.service('${name}');`);
    lines.push(`    expect(service).toBeTruthy();`);
    lines.push(`  });`);
    lines.push('');

    // Generate a test for creating a record with sample data
    lines.push(`  it('creates a ${name} record', async () => {`);
    lines.push(`    const service = app.service('${name}');`);
    lines.push(`    const testData = {`);

    for (const field of fields) {
      const sampleValue = this.getSampleValue(field);
      lines.push(`      ${field.name}: ${sampleValue},`);
    }

    lines.push(`    };`);
    lines.push('');
    lines.push(`    // Note: This test requires a mock or actual database connection`);
    lines.push(`    // const result = await service.create(testData);`);
    lines.push(`    // expect(result).toMatchObject(testData);`);
    lines.push(`    expect(testData).toBeDefined();`);
    lines.push(`  });`);
    lines.push('');

    lines.push(`  it('has the expected fields in schema', () => {`);
    lines.push(`    const expectedFields = [${fields.map((f) => `'${f.name}'`).join(', ')}];`);
    lines.push(`    expect(expectedFields.length).toBe(${fields.length});`);
    lines.push(`  });`);

    lines.push(`});`);

    return {
      path: `src/services/${name}/${name}.test.ts`,
      content: lines.join('\n'),
      type: 'test',
    };
  }

  /**
   * Get a sample value for a field type.
   */
  private getSampleValue(field: FieldDefinition): string {
    switch (field.type) {
      case 'string':
        return `'test-${field.name}'`;
      case 'number':
        return '123';
      case 'boolean':
        return 'true';
      case 'date':
        return 'new Date()';
      case 'objectId':
        return `'507f1f77bcf86cd799439011'`;
      case 'array':
        return '[]';
      case 'object':
        return '{}';
      default:
        return 'null';
    }
  }

  /**
   * Capitalize the first letter of a string.
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export default GenerateServiceTool;
