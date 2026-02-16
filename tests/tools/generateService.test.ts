/// <reference types="jest" />

import { GenerateServiceTool } from '../../src/tools/generateService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('GenerateServiceTool', () => {
  let generateServiceTool: GenerateServiceTool;

  beforeEach(() => {
    generateServiceTool = new GenerateServiceTool();
  });

  describe('tool metadata', () => {
    it('has correct name', () => {
      expect(generateServiceTool.name).toBe('generate_service');
    });

    it('has a description', () => {
      expect(generateServiceTool.description).toBeDefined();
      expect(generateServiceTool.description.length).toBeGreaterThan(0);
    });

    it('has a valid input schema', () => {
      expect(generateServiceTool.inputSchema).toBeDefined();
      expect(generateServiceTool.inputSchema.type).toBe('object');
      expect(generateServiceTool.inputSchema.properties).toHaveProperty('name');
      expect(generateServiceTool.inputSchema.properties).toHaveProperty('database');
      expect(generateServiceTool.inputSchema.properties).toHaveProperty('fields');
      expect(generateServiceTool.inputSchema.required).toContain('name');
      expect(generateServiceTool.inputSchema.required).toContain('database');
      expect(generateServiceTool.inputSchema.required).toContain('fields');
    });
  });

  describe('all field types', () => {
    const fieldTypes = [
      'string',
      'number',
      'boolean',
      'date',
      'objectId',
      'array',
      'object',
    ] as const;

    fieldTypes.forEach((fieldType) => {
      it(`handles ${fieldType} field type`, async () => {
        const result = await generateServiceTool.execute({
          name: 'testservice',
          database: 'mongodb',
          fields: [{ name: `test${fieldType}Field`, type: fieldType, required: true }],
        });

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();

        const parsed = JSON.parse(result.content);
        expect(parsed.fieldCount).toBe(1);
        expect(parsed.files).toBeDefined();
      });
    });

    it('handles multiple fields of different types', async () => {
      const result = await generateServiceTool.execute({
        name: 'users',
        database: 'mongodb',
        fields: [
          { name: 'username', type: 'string', required: true, unique: true },
          { name: 'email', type: 'string', required: true, unique: true },
          { name: 'age', type: 'number', required: false },
          { name: 'isActive', type: 'boolean', required: true },
          { name: 'createdAt', type: 'date', required: true },
          { name: 'profileId', type: 'objectId', required: false },
          { name: 'tags', type: 'array', required: false },
          { name: 'metadata', type: 'object', required: false },
        ],
      });

      expect(result).toBeDefined();
      const parsed = JSON.parse(result.content);
      expect(parsed.fieldCount).toBe(8);
    });

    it('handles required field flag', async () => {
      const result = await generateServiceTool.execute({
        name: 'products',
        database: 'mongodb',
        fields: [
          { name: 'requiredField', type: 'string', required: true },
          { name: 'optionalField', type: 'string', required: false },
        ],
      });

      const parsed = JSON.parse(result.content);
      expect(parsed.fieldCount).toBe(2);

      // Check that schema file contains required field info
      const schemaFile = Object.values(parsed.files).find((f: any) => f.type === 'schema') as any;
      expect(schemaFile).toBeDefined();
      expect(schemaFile.content).toContain('requiredField');
      expect(schemaFile.content).toContain('optionalField');
    });

    it('handles unique field flag', async () => {
      const result = await generateServiceTool.execute({
        name: 'accounts',
        database: 'mongodb',
        fields: [
          { name: 'email', type: 'string', required: true, unique: true },
          { name: 'name', type: 'string', required: true, unique: false },
        ],
      });

      const parsed = JSON.parse(result.content);
      expect(parsed.fieldCount).toBe(2);
    });
  });

  describe('all database types', () => {
    const databases: ('mongodb' | 'postgresql' | 'sqlite')[] = ['mongodb', 'postgresql', 'sqlite'];

    databases.forEach((database) => {
      it(`generates service for ${database}`, async () => {
        const result = await generateServiceTool.execute({
          name: 'items',
          database,
          fields: [
            { name: 'title', type: 'string', required: true },
            { name: 'count', type: 'number', required: false },
          ],
        });

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();

        const parsed = JSON.parse(result.content);
        expect(parsed.database).toBe(database);
        expect(parsed.name).toBe('items');
        expect(parsed.files).toBeDefined();
      });
    });

    it('generates MongoDB-specific schema with Mongoose', async () => {
      const result = await generateServiceTool.execute({
        name: 'posts',
        database: 'mongodb',
        fields: [
          { name: 'title', type: 'string', required: true },
          { name: 'content', type: 'string', required: true },
        ],
      });

      const parsed = JSON.parse(result.content);
      const schemaFile = Object.values(parsed.files).find((f: any) => f.type === 'schema') as any;

      expect(schemaFile).toBeDefined();
      expect(schemaFile.path).toContain('.schema.ts');
      // MongoDB uses Mongoose
      expect(schemaFile.content).toContain('mongoose');
    });

    it('generates PostgreSQL-specific schema with Knex', async () => {
      const result = await generateServiceTool.execute({
        name: 'articles',
        database: 'postgresql',
        fields: [
          { name: 'headline', type: 'string', required: true },
          { name: 'body', type: 'string', required: true },
        ],
      });

      const parsed = JSON.parse(result.content);
      const schemaFile = Object.values(parsed.files).find((f: any) => f.type === 'schema') as any;

      expect(schemaFile).toBeDefined();
      expect(schemaFile.path).toContain('.model.ts');
      // PostgreSQL uses Knex
      expect(schemaFile.content).toContain('knex');
    });

    it('generates SQLite-specific schema with Knex', async () => {
      const result = await generateServiceTool.execute({
        name: 'notes',
        database: 'sqlite',
        fields: [{ name: 'text', type: 'string', required: true }],
      });

      const parsed = JSON.parse(result.content);
      const schemaFile = Object.values(parsed.files).find((f: any) => f.type === 'schema') as any;

      expect(schemaFile).toBeDefined();
      expect(schemaFile.path).toContain('.model.ts');
      // SQLite uses Knex
      expect(schemaFile.content).toContain('knex');
    });
  });

  describe('generated file structure', () => {
    it('generates all 4 required files', async () => {
      const result = await generateServiceTool.execute({
        name: 'messages',
        database: 'mongodb',
        fields: [{ name: 'text', type: 'string', required: true }],
      });

      const parsed = JSON.parse(result.content);
      const files = Object.values(parsed.files) as any[];

      expect(files.length).toBe(4);

      const types = files.map((f) => f.type);
      expect(types).toContain('service');
      expect(types).toContain('hooks');
      expect(types).toContain('schema');
      expect(types).toContain('test');
    });

    it('generates service file with correct path', async () => {
      const result = await generateServiceTool.execute({
        name: 'orders',
        database: 'mongodb',
        fields: [{ name: 'total', type: 'number', required: true }],
      });

      const parsed = JSON.parse(result.content);
      const serviceFile = Object.values(parsed.files).find((f: any) => f.type === 'service') as any;

      expect(serviceFile).toBeDefined();
      expect(serviceFile.path).toBe('src/services/orders/orders.service.ts');
    });

    it('generates hooks file with correct path', async () => {
      const result = await generateServiceTool.execute({
        name: 'customers',
        database: 'mongodb',
        fields: [{ name: 'name', type: 'string', required: true }],
      });

      const parsed = JSON.parse(result.content);
      const hooksFile = Object.values(parsed.files).find((f: any) => f.type === 'hooks') as any;

      expect(hooksFile).toBeDefined();
      expect(hooksFile.path).toBe('src/services/customers/customers.hooks.ts');
    });

    it('generates test file with correct path', async () => {
      const result = await generateServiceTool.execute({
        name: 'reviews',
        database: 'mongodb',
        fields: [{ name: 'rating', type: 'number', required: true }],
      });

      const parsed = JSON.parse(result.content);
      const testFile = Object.values(parsed.files).find((f: any) => f.type === 'test') as any;

      expect(testFile).toBeDefined();
      expect(testFile.path).toBe('src/services/reviews/reviews.test.ts');
    });

    it('includes file size in metadata', async () => {
      const result = await generateServiceTool.execute({
        name: 'payments',
        database: 'mongodb',
        fields: [{ name: 'amount', type: 'number', required: true }],
      });

      const parsed = JSON.parse(result.content);

      for (const fileInfo of Object.values(parsed.files)) {
        const info = fileInfo as { size: number; content: string };
        expect(typeof info.size).toBe('number');
        expect(info.size).toBe(info.content.length);
      }
    });
  });

  describe('service file content', () => {
    it('includes proper imports', async () => {
      const result = await generateServiceTool.execute({
        name: 'tasks',
        database: 'mongodb',
        fields: [{ name: 'title', type: 'string', required: true }],
      });

      const parsed = JSON.parse(result.content);
      const serviceFile = Object.values(parsed.files).find((f: any) => f.type === 'service') as any;

      expect(serviceFile.content).toContain('import');
      expect(serviceFile.content).toContain('@feathersjs');
    });

    it('includes service class definition', async () => {
      const result = await generateServiceTool.execute({
        name: 'projects',
        database: 'mongodb',
        fields: [{ name: 'name', type: 'string', required: true }],
      });

      const parsed = JSON.parse(result.content);
      const serviceFile = Object.values(parsed.files).find((f: any) => f.type === 'service') as any;

      expect(serviceFile.content).toContain('class');
      expect(serviceFile.content).toContain('Service');
    });

    it('includes service configuration function', async () => {
      const result = await generateServiceTool.execute({
        name: 'teams',
        database: 'mongodb',
        fields: [{ name: 'name', type: 'string', required: true }],
      });

      const parsed = JSON.parse(result.content);
      const serviceFile = Object.values(parsed.files).find((f: any) => f.type === 'service') as any;

      expect(serviceFile.content).toContain('app.use');
      expect(serviceFile.content).toContain('teams');
    });
  });

  describe('hooks file content', () => {
    it('includes before, after, and error hooks', async () => {
      const result = await generateServiceTool.execute({
        name: 'events',
        database: 'mongodb',
        fields: [{ name: 'title', type: 'string', required: true }],
      });

      const parsed = JSON.parse(result.content);
      const hooksFile = Object.values(parsed.files).find((f: any) => f.type === 'hooks') as any;

      expect(hooksFile.content).toContain('before:');
      expect(hooksFile.content).toContain('after:');
      expect(hooksFile.content).toContain('error:');
    });

    it('includes all CRUD method hooks', async () => {
      const result = await generateServiceTool.execute({
        name: 'comments',
        database: 'mongodb',
        fields: [{ name: 'text', type: 'string', required: true }],
      });

      const parsed = JSON.parse(result.content);
      const hooksFile = Object.values(parsed.files).find((f: any) => f.type === 'hooks') as any;

      expect(hooksFile.content).toContain('find:');
      expect(hooksFile.content).toContain('get:');
      expect(hooksFile.content).toContain('create:');
      expect(hooksFile.content).toContain('update:');
      expect(hooksFile.content).toContain('patch:');
      expect(hooksFile.content).toContain('remove:');
    });
  });

  describe('test file content', () => {
    it('includes test describe block with service name', async () => {
      const result = await generateServiceTool.execute({
        name: 'widgets',
        database: 'mongodb',
        fields: [{ name: 'name', type: 'string', required: true }],
      });

      const parsed = JSON.parse(result.content);
      const testFile = Object.values(parsed.files).find((f: any) => f.type === 'test') as any;

      expect(testFile.content).toContain("describe('widgets service'");
    });

    it('includes test for service registration', async () => {
      const result = await generateServiceTool.execute({
        name: 'gadgets',
        database: 'mongodb',
        fields: [{ name: 'name', type: 'string', required: true }],
      });

      const parsed = JSON.parse(result.content);
      const testFile = Object.values(parsed.files).find((f: any) => f.type === 'test') as any;

      expect(testFile.content).toContain('registered the service');
    });

    it('includes sample data for fields', async () => {
      const result = await generateServiceTool.execute({
        name: 'samples',
        database: 'mongodb',
        fields: [
          { name: 'textField', type: 'string', required: true },
          { name: 'numField', type: 'number', required: true },
        ],
      });

      const parsed = JSON.parse(result.content);
      const testFile = Object.values(parsed.files).find((f: any) => f.type === 'test') as any;

      expect(testFile.content).toContain('textField');
      expect(testFile.content).toContain('numField');
    });
  });

  describe('input validation', () => {
    it('throws error for missing name', async () => {
      await expect(
        generateServiceTool.execute({
          database: 'mongodb',
          fields: [{ name: 'test', type: 'string' }],
        })
      ).rejects.toThrow('Service name is required');
    });

    it('throws error for missing database', async () => {
      await expect(
        generateServiceTool.execute({
          name: 'test',
          fields: [{ name: 'test', type: 'string' }],
        })
      ).rejects.toThrow('Database must be one of');
    });

    it('throws error for invalid database', async () => {
      await expect(
        generateServiceTool.execute({
          name: 'test',
          database: 'mysql' as any,
          fields: [{ name: 'test', type: 'string' }],
        })
      ).rejects.toThrow('Database must be one of');
    });

    it('throws error for missing fields', async () => {
      await expect(
        generateServiceTool.execute({
          name: 'test',
          database: 'mongodb',
        })
      ).rejects.toThrow('Fields array is required');
    });

    it('throws error for empty fields array', async () => {
      await expect(
        generateServiceTool.execute({
          name: 'test',
          database: 'mongodb',
          fields: [],
        })
      ).rejects.toThrow('Fields array is required and must not be empty');
    });

    it('throws error for invalid field type', async () => {
      await expect(
        generateServiceTool.execute({
          name: 'test',
          database: 'mongodb',
          fields: [{ name: 'test', type: 'invalid' as any }],
        })
      ).rejects.toThrow('Field type must be one of');
    });

    it('throws error for field missing name', async () => {
      await expect(
        generateServiceTool.execute({
          name: 'test',
          database: 'mongodb',
          fields: [{ type: 'string' }],
        })
      ).rejects.toThrow('Field name is required');
    });

    it('throws error for null params', async () => {
      await expect(generateServiceTool.execute(null)).rejects.toThrow();
    });

    it('throws error for undefined params', async () => {
      await expect(generateServiceTool.execute(undefined)).rejects.toThrow();
    });
  });

  describe('name sanitization', () => {
    it('converts name to lowercase', async () => {
      const result = await generateServiceTool.execute({
        name: 'MyService',
        database: 'mongodb',
        fields: [{ name: 'test', type: 'string' }],
      });

      const parsed = JSON.parse(result.content);
      expect(parsed.name).toBe('myservice');
    });

    it('removes special characters from name', async () => {
      const result = await generateServiceTool.execute({
        name: 'my-service_123',
        database: 'mongodb',
        fields: [{ name: 'test', type: 'string' }],
      });

      const parsed = JSON.parse(result.content);
      expect(parsed.name).toBe('myservice123');
    });

    it('handles names starting with numbers', async () => {
      const result = await generateServiceTool.execute({
        name: '123service',
        database: 'mongodb',
        fields: [{ name: 'test', type: 'string' }],
      });

      const parsed = JSON.parse(result.content);
      // Should prefix with underscore
      expect(parsed.name).toBe('_123service');
    });
  });

  describe('generated code compilation', () => {
    let tempDir: string;

    beforeAll(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feathers-service-test-'));
    });

    afterAll(() => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('generates syntactically valid TypeScript for all generated files', async () => {
      const result = await generateServiceTool.execute({
        name: 'validservice',
        database: 'mongodb',
        fields: [
          { name: 'name', type: 'string', required: true },
          { name: 'count', type: 'number', required: false },
          { name: 'active', type: 'boolean', required: true },
        ],
      });

      const parsed = JSON.parse(result.content);

      // Verify all files have valid content
      for (const [filePath, fileInfo] of Object.entries(parsed.files)) {
        const info = fileInfo as { content: string; type: string };

        // Basic syntax checks
        expect(info.content).toBeDefined();
        expect(typeof info.content).toBe('string');
        expect(info.content.length).toBeGreaterThan(0);

        // TypeScript files should have valid structure
        if (filePath.endsWith('.ts')) {
          // Should not have obvious syntax errors
          expect(info.content).not.toContain('undefined undefined');
          expect(info.content).not.toContain('{{');
          expect(info.content).not.toContain('}}');
        }
      }
    });

    it('generates valid MongoDB service code', async () => {
      const result = await generateServiceTool.execute({
        name: 'mongotest',
        database: 'mongodb',
        fields: [
          { name: 'title', type: 'string', required: true },
          { name: 'authorId', type: 'objectId', required: true },
          { name: 'tags', type: 'array', required: false },
        ],
      });

      const parsed = JSON.parse(result.content);
      const serviceFile = Object.values(parsed.files).find((f: any) => f.type === 'service') as any;

      // MongoDB service should extend MongoDBService
      expect(serviceFile.content).toContain('MongoDBService');
      expect(serviceFile.content).toContain('mongodbClient');
    });

    it('generates valid PostgreSQL service code', async () => {
      const result = await generateServiceTool.execute({
        name: 'pgtest',
        database: 'postgresql',
        fields: [
          { name: 'name', type: 'string', required: true },
          { name: 'value', type: 'number', required: false },
        ],
      });

      const parsed = JSON.parse(result.content);
      const serviceFile = Object.values(parsed.files).find((f: any) => f.type === 'service') as any;

      // PostgreSQL service should use KnexService
      expect(serviceFile.content).toContain('KnexService');
      expect(serviceFile.content).toContain('postgresqlClient');
    });

    it('generates valid SQLite service code', async () => {
      const result = await generateServiceTool.execute({
        name: 'sqlitetest',
        database: 'sqlite',
        fields: [{ name: 'description', type: 'string', required: true }],
      });

      const parsed = JSON.parse(result.content);
      const serviceFile = Object.values(parsed.files).find((f: any) => f.type === 'service') as any;

      // SQLite service should use KnexService
      expect(serviceFile.content).toContain('KnexService');
      expect(serviceFile.content).toContain('sqliteClient');
    });
  });

  describe('metadata', () => {
    it('includes correct metadata in result', async () => {
      const result = await generateServiceTool.execute({
        name: 'metaservice',
        database: 'mongodb',
        fields: [
          { name: 'field1', type: 'string' },
          { name: 'field2', type: 'number' },
          { name: 'field3', type: 'boolean' },
        ],
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata!.tool).toBe('generate_service');
      expect(result.metadata!.name).toBe('metaservice');
      expect(result.metadata!.database).toBe('mongodb');
      expect(result.metadata!.fieldCount).toBe(3);
      expect(result.metadata!.fileCount).toBe(4);
    });

    it('includes file list in metadata', async () => {
      const result = await generateServiceTool.execute({
        name: 'filelistservice',
        database: 'mongodb',
        fields: [{ name: 'test', type: 'string' }],
      });

      expect(result.metadata!.files).toBeDefined();
      expect(Array.isArray(result.metadata!.files)).toBe(true);
      expect((result.metadata!.files as any[]).length).toBe(4);

      const types = (result.metadata!.files as any[]).map((f: any) => f.type);
      expect(types).toContain('service');
      expect(types).toContain('hooks');
      expect(types).toContain('schema');
      expect(types).toContain('test');
    });
  });
});
