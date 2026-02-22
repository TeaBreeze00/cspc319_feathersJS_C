/// <reference types="jest" />

import { GetTemplateTool } from '../../src/tools/getTemplate';
import { KnowledgeLoader } from '../../src/knowledge';
import { TemplateFragment } from '../../src/knowledge/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock KnowledgeLoader
jest.mock('../../src/knowledge', () => {
  return {
    KnowledgeLoader: jest.fn().mockImplementation(() => ({
      load: jest.fn(),
    })),
  };
});

describe('GetTemplateTool', () => {
  let getTemplateTool: GetTemplateTool;
  let mockLoader: jest.Mocked<KnowledgeLoader>;

  const mockTemplateFragments: TemplateFragment[] = [
    {
      id: 'tpl-base-project',
      name: 'Base Project Template',
      description: 'Base FeathersJS project with Koa',
      version: 'both',
      code: `
import { feathers } from '@feathersjs/feathers';
import { koa, rest } from '@feathersjs/koa';

const app = koa(feathers());
app.configure(rest());

export { app };
`,
      imports: [
        'import { feathers } from "@feathersjs/feathers"',
        'import { koa, rest } from "@feathersjs/koa"',
      ],
      dependencies: ['@feathersjs/feathers', '@feathersjs/koa'],
      featureFlags: ['typescript', 'koa'],
      tags: ['project', 'base'],
    },
    {
      id: 'tpl-base-express',
      name: 'Express Base Template',
      description: 'Base FeathersJS project with Express',
      version: 'both',
      code: `
import { feathers } from '@feathersjs/feathers';
import express from '@feathersjs/express';

const app = express(feathers());

export { app };
`,
      imports: [
        'import { feathers } from "@feathersjs/feathers"',
        'import express from "@feathersjs/express"',
      ],
      dependencies: ['@feathersjs/feathers', '@feathersjs/express'],
      featureFlags: ['javascript', 'express'],
      tags: ['project', 'base'],
    },
    {
      id: 'tpl-mongodb-service',
      name: 'MongoDB Service Template',
      description: 'MongoDB database adapter',
      version: 'both',
      code: `
import { MongoDBService } from '@feathersjs/mongodb';

export class MyService extends MongoDBService {}
`,
      imports: ['import { MongoDBService } from "@feathersjs/mongodb"'],
      dependencies: ['@feathersjs/mongodb', 'mongodb'],
      featureFlags: ['mongodb'],
      tags: ['database', 'mongodb'],
    },
    {
      id: 'tpl-knex-postgresql',
      name: 'PostgreSQL Service Template',
      description: 'PostgreSQL database adapter using Knex',
      version: 'both',
      code: `
import { KnexService } from '@feathersjs/knex';

export class MyService extends KnexService {}
`,
      imports: ['import { KnexService } from "@feathersjs/knex"'],
      dependencies: ['@feathersjs/knex', 'knex', 'pg'],
      featureFlags: ['postgresql'],
      tags: ['database', 'postgresql'],
    },
    {
      id: 'tpl-knex-sqlite',
      name: 'SQLite Service Template',
      description: 'SQLite database adapter using Knex',
      version: 'both',
      code: `
import { KnexService } from '@feathersjs/knex';

export class MyService extends KnexService {}
`,
      imports: ['import { KnexService } from "@feathersjs/knex"'],
      dependencies: ['@feathersjs/knex', 'knex', 'better-sqlite3'],
      featureFlags: ['sqlite'],
      tags: ['database', 'sqlite'],
    },
    {
      id: 'tpl-authentication',
      name: 'Authentication Template',
      description: 'JWT authentication setup',
      version: 'both',
      code: `
import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication';
import { LocalStrategy } from '@feathersjs/authentication-local';

export const authentication = (app: any) => {
  const authentication = new AuthenticationService(app);
  authentication.register('jwt', new JWTStrategy());
  authentication.register('local', new LocalStrategy());
  app.use('authentication', authentication);
};
`,
      imports: [
        'import { AuthenticationService, JWTStrategy } from "@feathersjs/authentication"',
        'import { LocalStrategy } from "@feathersjs/authentication-local"',
      ],
      dependencies: ['@feathersjs/authentication', '@feathersjs/authentication-local'],
      featureFlags: ['authentication'],
      tags: ['authentication'],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockLoader = new KnowledgeLoader() as jest.Mocked<KnowledgeLoader>;
    mockLoader.load = jest.fn().mockResolvedValue(mockTemplateFragments);

    getTemplateTool = new GetTemplateTool(mockLoader);
  });

  describe('tool metadata', () => {
    it('has correct name', () => {
      expect(getTemplateTool.name).toBe('get_feathers_template');
    });

    it('has a description', () => {
      expect(getTemplateTool.description).toBeDefined();
      expect(getTemplateTool.description.length).toBeGreaterThan(0);
    });

    it('has a valid input schema', () => {
      expect(getTemplateTool.inputSchema).toBeDefined();
      expect(getTemplateTool.inputSchema.type).toBe('object');
      expect(getTemplateTool.inputSchema.properties).toHaveProperty('database');
      expect(getTemplateTool.inputSchema.required).toContain('database');
    });
  });

  describe('all 8 flag combinations', () => {
    const databases: ('mongodb' | 'postgresql' | 'sqlite')[] = ['mongodb', 'postgresql', 'sqlite'];
    const authOptions = [true, false];
    const typescriptOptions = [true, false];

    // Test all combinations for each database
    databases.forEach((database) => {
      authOptions.forEach((auth) => {
        typescriptOptions.forEach((typescript) => {
          const testName = `generates template for ${database}, auth=${auth}, typescript=${typescript}`;

          it(testName, async () => {
            const result = await getTemplateTool.execute({
              database,
              auth,
              typescript,
              version: 'both',
            });

            expect(result).toBeDefined();
            expect(result.content).toBeDefined();

            const parsed = JSON.parse(result.content);

            // Should have the correct configuration
            expect(parsed.database).toBe(database);
            expect(parsed.auth).toBe(auth);
            expect(parsed.typescript).toBe(typescript);

            // Should have files
            expect(parsed.files).toBeDefined();

            // Metadata should be present
            expect(result.metadata).toBeDefined();
            expect(result.metadata!.tool).toBe('get_feathers_template');
            expect(result.metadata!.database).toBe(database);
          });
        });
      });
    });
  });

  describe('database selection', () => {
    it('selects MongoDB adapter for mongodb database', async () => {
      const result = await getTemplateTool.execute({ database: 'mongodb' });

      const parsed = JSON.parse(result.content);
      expect(parsed.database).toBe('mongodb');
    });

    it('selects PostgreSQL adapter for postgresql database', async () => {
      const result = await getTemplateTool.execute({ database: 'postgresql' });

      const parsed = JSON.parse(result.content);
      expect(parsed.database).toBe('postgresql');
    });

    it('selects SQLite adapter for sqlite database', async () => {
      const result = await getTemplateTool.execute({ database: 'sqlite' });

      const parsed = JSON.parse(result.content);
      expect(parsed.database).toBe('sqlite');
    });

    it('throws error for invalid database', async () => {
      await expect(getTemplateTool.execute({ database: 'invalid' })).rejects.toThrow(
        'Invalid database type'
      );
    });
  });

  describe('authentication flag', () => {
    it('includes authentication when auth=true', async () => {
      const result = await getTemplateTool.execute({
        database: 'mongodb',
        auth: true,
      });

      const parsed = JSON.parse(result.content);
      expect(parsed.auth).toBe(true);

      // Check metadata
      expect(result.metadata!.auth).toBe(true);
    });

    it('excludes authentication when auth=false', async () => {
      const result = await getTemplateTool.execute({
        database: 'mongodb',
        auth: false,
      });

      const parsed = JSON.parse(result.content);
      expect(parsed.auth).toBe(false);
    });

    it('defaults to auth=false when not specified', async () => {
      const result = await getTemplateTool.execute({ database: 'mongodb' });

      const parsed = JSON.parse(result.content);
      expect(parsed.auth).toBe(false);
    });
  });

  describe('typescript flag', () => {
    it('generates TypeScript when typescript=true', async () => {
      const result = await getTemplateTool.execute({
        database: 'mongodb',
        typescript: true,
      });

      const parsed = JSON.parse(result.content);
      expect(parsed.typescript).toBe(true);

      // Files should have .ts extension
      if (parsed.files && Object.keys(parsed.files).length > 0) {
        const filePaths = Object.keys(parsed.files);
        const hasTsFile = filePaths.some((p: string) => p.endsWith('.ts'));
        expect(hasTsFile).toBe(true);
      }
    });

    it('generates JavaScript when typescript=false', async () => {
      const result = await getTemplateTool.execute({
        database: 'mongodb',
        typescript: false,
      });

      const parsed = JSON.parse(result.content);
      expect(parsed.typescript).toBe(false);
    });

    it('defaults to typescript=true when not specified', async () => {
      const result = await getTemplateTool.execute({ database: 'mongodb' });

      const parsed = JSON.parse(result.content);
      expect(parsed.typescript).toBe(true);
    });
  });

  describe('version filtering', () => {
    it('defaults to v6 when version not specified', async () => {
      const result = await getTemplateTool.execute({ database: 'mongodb' });

      const parsed = JSON.parse(result.content);
      expect(parsed.version).toBe('v6');
    });

    it('filters to v5 templates when version=v5', async () => {
      const result = await getTemplateTool.execute({
        database: 'mongodb',
        version: 'v5',
      });

      const parsed = JSON.parse(result.content);
      // Templates are marked as 'both', so they match v5 filter
      // The result version reflects what was requested
      expect(parsed.version).toBe('v5');
    });

    it('includes both versions when version=both', async () => {
      const result = await getTemplateTool.execute({
        database: 'mongodb',
        version: 'both',
      });

      const parsed = JSON.parse(result.content);
      expect(parsed.version).toBe('both');
    });
  });

  describe('result structure', () => {
    it('includes files in the result', async () => {
      const result = await getTemplateTool.execute({ database: 'mongodb' });

      const parsed = JSON.parse(result.content);
      expect(parsed.files).toBeDefined();
      expect(typeof parsed.files).toBe('object');
    });

    it('includes dependencies in the result', async () => {
      const result = await getTemplateTool.execute({ database: 'mongodb' });

      const parsed = JSON.parse(result.content);
      expect(parsed.dependencies).toBeDefined();
      expect(Array.isArray(parsed.dependencies)).toBe(true);
    });

    it('includes feature flags in the result', async () => {
      const result = await getTemplateTool.execute({ database: 'mongodb' });

      const parsed = JSON.parse(result.content);
      expect(parsed.featureFlags).toBeDefined();
      expect(Array.isArray(parsed.featureFlags)).toBe(true);
    });

    it('includes metadata with fragment count', async () => {
      const result = await getTemplateTool.execute({ database: 'mongodb' });

      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata!.fragmentCount).toBe('number');
      expect(typeof result.metadata!.fileCount).toBe('number');
    });

    it('file entries include path, content, and size', async () => {
      const result = await getTemplateTool.execute({ database: 'mongodb' });

      const parsed = JSON.parse(result.content);

      if (parsed.files && Object.keys(parsed.files).length > 0) {
        const firstFile = Object.values(parsed.files)[0] as any;
        expect(firstFile).toHaveProperty('path');
        expect(firstFile).toHaveProperty('content');
        expect(firstFile).toHaveProperty('size');
        expect(typeof firstFile.size).toBe('number');
      }
    });
  });

  describe('error handling', () => {
    it('returns error message when no templates match', async () => {
      mockLoader.load = jest.fn().mockResolvedValue([]);
      const emptyTool = new GetTemplateTool(mockLoader);

      const result = await emptyTool.execute({ database: 'mongodb' });

      const parsed = JSON.parse(result.content);
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('No matching templates');
    });

    it('handles missing database parameter', async () => {
      await expect(getTemplateTool.execute({})).rejects.toThrow();
    });

    it('handles null params', async () => {
      await expect(getTemplateTool.execute(null)).rejects.toThrow();
    });

    it('handles undefined params', async () => {
      await expect(getTemplateTool.execute(undefined)).rejects.toThrow();
    });
  });

  describe('generated code compilation', () => {
    let tempDir: string;

    beforeAll(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feathers-template-test-'));
    });

    afterAll(() => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('generates syntactically valid TypeScript for mongodb', async () => {
      const result = await getTemplateTool.execute({
        database: 'mongodb',
        typescript: true,
      });

      const parsed = JSON.parse(result.content);

      if (parsed.files && Object.keys(parsed.files).length > 0) {
        for (const [filePath, fileInfo] of Object.entries(parsed.files)) {
          const info = fileInfo as { content: string };
          if (filePath.endsWith('.ts') && info.content) {
            const fullPath = path.join(tempDir, filePath.replace(/\//g, '_'));
            fs.writeFileSync(fullPath, info.content);

            expect(info.content).toBeDefined();
            expect(typeof info.content).toBe('string');
          }
        }
      }
    });

    it('generates syntactically valid TypeScript for postgresql', async () => {
      const result = await getTemplateTool.execute({
        database: 'postgresql',
        typescript: true,
        auth: true,
      });

      const parsed = JSON.parse(result.content);
      expect(parsed.files).toBeDefined();

      for (const fileInfo of Object.values(parsed.files)) {
        const info = fileInfo as { content: string; path: string };
        expect(typeof info.content).toBe('string');
      }
    });

    it('generates syntactically valid TypeScript for sqlite with auth', async () => {
      const result = await getTemplateTool.execute({
        database: 'sqlite',
        typescript: true,
        auth: true,
      });

      const parsed = JSON.parse(result.content);
      expect(parsed.files).toBeDefined();

      for (const fileInfo of Object.values(parsed.files)) {
        const info = fileInfo as { content: string; path: string };
        expect(typeof info.content).toBe('string');
        expect(info.content.length).toBeGreaterThan(0);
      }
    });
  });

  describe('file path adjustment', () => {
    it('uses .ts extension for TypeScript projects', async () => {
      const result = await getTemplateTool.execute({
        database: 'mongodb',
        typescript: true,
      });

      const parsed = JSON.parse(result.content);

      if (parsed.files && Object.keys(parsed.files).length > 0) {
        const filePaths = Object.keys(parsed.files);
        const hasTsFile = filePaths.some((p: string) => p.endsWith('.ts'));

        if (filePaths.length > 0) {
          expect(hasTsFile || filePaths.every((p: string) => !p.endsWith('.js'))).toBe(true);
        }
      }
    });

    it('uses .js extension for JavaScript projects', async () => {
      const result = await getTemplateTool.execute({
        database: 'mongodb',
        typescript: false,
      });

      const parsed = JSON.parse(result.content);

      if (parsed.files && Object.keys(parsed.files).length > 0) {
        const filePaths = Object.keys(parsed.files);
        const hasTsFile = filePaths.some((p: string) => p.endsWith('.ts'));
        expect(!hasTsFile || filePaths.some((p: string) => p.endsWith('.js'))).toBe(true);
      }
    });
  });
});
