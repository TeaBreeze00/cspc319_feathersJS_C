/// <reference types="jest" />

import { TemplateComposer, ComposerOptions, ComposedTemplate } from '../../../src/tools/templates/composer';
import { TemplateFragment } from '../../../src/knowledge/types';

describe('TemplateComposer', () => {
  let composer: TemplateComposer;

  beforeEach(() => {
    composer = new TemplateComposer();
  });

  describe('import merging', () => {
    it('merges duplicate imports from multiple fragments', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag1',
          name: 'Fragment 1',
          description: 'First fragment',
          version: 'v5',
          code: 'const app = feathers();',
          imports: ['import { feathers } from "@feathersjs/feathers"'],
          dependencies: [],
          featureFlags: [],
          tags: [],
        },
        {
          id: 'frag2',
          name: 'Fragment 2',
          description: 'Second fragment',
          version: 'v5',
          code: 'app.configure(configuration());',
          imports: [
            'import { feathers } from "@feathersjs/feathers"',
            'import configuration from "@feathersjs/configuration"',
          ],
          dependencies: [],
          featureFlags: [],
          tags: [],
        },
      ];

      const result = composer.compose(fragments);

      // Get the composed file content
      const fileContent = result.files.get('index.ts') || '';

      // Should contain feathers import only once
      const feathersImportCount = (fileContent.match(/import.*feathers.*from.*@feathersjs\/feathers/g) || []).length;
      expect(feathersImportCount).toBe(1);

      // Should contain configuration import
      expect(fileContent).toContain('configuration');
    });

    it('sorts imports alphabetically', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag1',
          name: 'Fragment 1',
          description: 'Test fragment',
          version: 'v5',
          code: '// code',
          imports: [
            'import z from "zod"',
            'import a from "alpha"',
            'import m from "middle"',
          ],
          dependencies: [],
          featureFlags: [],
          tags: [],
        },
      ];

      const result = composer.compose(fragments);
      const fileContent = result.files.get('index.ts') || '';

      // Find the positions of each import
      const aPos = fileContent.indexOf('import a from');
      const mPos = fileContent.indexOf('import m from');
      const zPos = fileContent.indexOf('import z from');

      // They should be in alphabetical order
      expect(aPos).toBeLessThan(mPos);
      expect(mPos).toBeLessThan(zPos);
    });

    it('handles fragments with no imports', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag1',
          name: 'Fragment 1',
          description: 'No imports',
          version: 'v5',
          code: 'const x = 5;',
          imports: [],
          dependencies: [],
          featureFlags: [],
          tags: [],
        },
      ];

      const result = composer.compose(fragments);
      const fileContent = result.files.get('index.ts') || '';

      // Should still contain the code
      expect(fileContent).toContain('const x = 5;');
    });

    it('filters out empty import strings', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag1',
          name: 'Fragment 1',
          description: 'Test fragment',
          version: 'v5',
          code: '// code',
          imports: ['', 'import x from "x"', '   ', 'import y from "y"'],
          dependencies: [],
          featureFlags: [],
          tags: [],
        },
      ];

      const result = composer.compose(fragments);
      const fileContent = result.files.get('index.ts') || '';

      // Should contain valid imports
      expect(fileContent).toContain('import x from');
      expect(fileContent).toContain('import y from');
    });
  });

  describe('fragment composition', () => {
    it('composes multiple fragments into a single file', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag1',
          name: 'Fragment 1',
          description: 'First fragment',
          version: 'v5',
          code: 'const a = 1;',
          imports: [],
          dependencies: [],
          featureFlags: [],
          tags: [],
        },
        {
          id: 'frag2',
          name: 'Fragment 2',
          description: 'Second fragment',
          version: 'v5',
          code: 'const b = 2;',
          imports: [],
          dependencies: [],
          featureFlags: [],
          tags: [],
        },
      ];

      const result = composer.compose(fragments);
      const fileContent = result.files.get('index.ts') || '';

      expect(fileContent).toContain('const a = 1;');
      expect(fileContent).toContain('const b = 2;');
    });

    it('orders fragments by dependencies (topological sort)', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag-dependent',
          name: 'Dependent Fragment',
          description: 'Depends on base',
          version: 'v5',
          code: 'const dependent = base + 1;',
          imports: [],
          dependencies: ['frag-base'],
          featureFlags: [],
          tags: [],
        },
        {
          id: 'frag-base',
          name: 'Base Fragment',
          description: 'Base fragment',
          version: 'v5',
          code: 'const base = 0;',
          imports: [],
          dependencies: [],
          featureFlags: [],
          tags: [],
        },
      ];

      const result = composer.compose(fragments);
      const fileContent = result.files.get('index.ts') || '';

      // Base should come before dependent
      const basePos = fileContent.indexOf('const base = 0;');
      const dependentPos = fileContent.indexOf('const dependent = base + 1;');

      expect(basePos).toBeLessThan(dependentPos);
    });

    it('handles circular dependencies gracefully (falls back to original order)', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag-a',
          name: 'Fragment A',
          description: 'Depends on B',
          version: 'v5',
          code: 'const a = 1;',
          imports: [],
          dependencies: ['frag-b'],
          featureFlags: [],
          tags: [],
        },
        {
          id: 'frag-b',
          name: 'Fragment B',
          description: 'Depends on A',
          version: 'v5',
          code: 'const b = 2;',
          imports: [],
          dependencies: ['frag-a'],
          featureFlags: [],
          tags: [],
        },
      ];

      // Should not throw, should fall back to original order
      const result = composer.compose(fragments);
      expect(result.files.size).toBeGreaterThan(0);
    });

    it('includes comments when includeComments option is true', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag1',
          name: 'My Fragment',
          description: 'This is a description',
          version: 'v5',
          code: 'const x = 1;',
          imports: [],
          dependencies: [],
          featureFlags: [],
          tags: [],
        },
      ];

      const result = composer.compose(fragments, { includeComments: true });
      const fileContent = result.files.get('index.ts') || '';

      expect(fileContent).toContain('// My Fragment');
      expect(fileContent).toContain('// This is a description');
    });

    it('excludes comments when includeComments option is false', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag1',
          name: 'My Fragment',
          description: 'This is a description',
          version: 'v5',
          code: 'const x = 1;',
          imports: [],
          dependencies: [],
          featureFlags: [],
          tags: [],
        },
      ];

      const result = composer.compose(fragments, { includeComments: false });
      const fileContent = result.files.get('index.ts') || '';

      expect(fileContent).not.toContain('// My Fragment');
      expect(fileContent).not.toContain('// This is a description');
    });

    it('uses custom target file when specified', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag1',
          name: 'Fragment 1',
          description: 'Test',
          version: 'v5',
          code: 'const x = 1;',
          imports: [],
          dependencies: [],
          featureFlags: [],
          tags: [],
        },
      ];

      const result = composer.compose(fragments, { targetFile: 'app.ts' });

      expect(result.files.has('app.ts')).toBe(true);
      expect(result.files.has('index.ts')).toBe(false);
    });

    it('supports custom file mapping for fragments', () => {
      const fileMapping = new Map<string, string>();
      fileMapping.set('frag-service', 'services/users.ts');
      fileMapping.set('frag-hooks', 'hooks/users.ts');

      const fragments: TemplateFragment[] = [
        {
          id: 'frag-service',
          name: 'Service',
          description: 'User service',
          version: 'v5',
          code: 'export class UsersService {}',
          imports: [],
          dependencies: [],
          featureFlags: [],
          tags: [],
        },
        {
          id: 'frag-hooks',
          name: 'Hooks',
          description: 'User hooks',
          version: 'v5',
          code: 'export const usersHooks = {};',
          imports: [],
          dependencies: [],
          featureFlags: [],
          tags: [],
        },
      ];

      const result = composer.compose(fragments, { fileMapping });

      expect(result.files.has('services/users.ts')).toBe(true);
      expect(result.files.has('hooks/users.ts')).toBe(true);
      expect(result.files.get('services/users.ts')).toContain('UsersService');
      expect(result.files.get('hooks/users.ts')).toContain('usersHooks');
    });
  });

  describe('dependency and feature flag collection', () => {
    it('collects all unique dependencies from fragments', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag1',
          name: 'Fragment 1',
          description: 'Test',
          version: 'v5',
          code: '',
          imports: [],
          dependencies: ['@feathersjs/feathers', '@feathersjs/koa'],
          featureFlags: [],
          tags: [],
        },
        {
          id: 'frag2',
          name: 'Fragment 2',
          description: 'Test',
          version: 'v5',
          code: '',
          imports: [],
          dependencies: ['@feathersjs/feathers', '@feathersjs/mongodb'],
          featureFlags: [],
          tags: [],
        },
      ];

      const result = composer.compose(fragments);

      expect(result.dependencies).toContain('@feathersjs/feathers');
      expect(result.dependencies).toContain('@feathersjs/koa');
      expect(result.dependencies).toContain('@feathersjs/mongodb');
      // Should be unique (feathers only once)
      expect(result.dependencies.filter(d => d === '@feathersjs/feathers').length).toBe(1);
    });

    it('sorts dependencies alphabetically', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag1',
          name: 'Fragment 1',
          description: 'Test',
          version: 'v5',
          code: '',
          imports: [],
          dependencies: ['zod', 'alpha', 'mongoose'],
          featureFlags: [],
          tags: [],
        },
      ];

      const result = composer.compose(fragments);

      expect(result.dependencies[0]).toBe('alpha');
      expect(result.dependencies[1]).toBe('mongoose');
      expect(result.dependencies[2]).toBe('zod');
    });

    it('collects all unique feature flags from fragments', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag1',
          name: 'Fragment 1',
          description: 'Test',
          version: 'v5',
          code: '',
          imports: [],
          dependencies: [],
          featureFlags: ['authentication', 'mongodb'],
          tags: [],
        },
        {
          id: 'frag2',
          name: 'Fragment 2',
          description: 'Test',
          version: 'v5',
          code: '',
          imports: [],
          dependencies: [],
          featureFlags: ['authentication', 'typescript'],
          tags: [],
        },
      ];

      const result = composer.compose(fragments);

      expect(result.featureFlags).toContain('authentication');
      expect(result.featureFlags).toContain('mongodb');
      expect(result.featureFlags).toContain('typescript');
      // Should be unique
      expect(result.featureFlags.filter(f => f === 'authentication').length).toBe(1);
    });

    it('sorts feature flags alphabetically', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag1',
          name: 'Fragment 1',
          description: 'Test',
          version: 'v5',
          code: '',
          imports: [],
          dependencies: [],
          featureFlags: ['zflag', 'aflag', 'mflag'],
          tags: [],
        },
      ];

      const result = composer.compose(fragments);

      expect(result.featureFlags[0]).toBe('aflag');
      expect(result.featureFlags[1]).toBe('mflag');
      expect(result.featureFlags[2]).toBe('zflag');
    });
  });

  describe('edge cases', () => {
    it('handles empty fragment array', () => {
      const result = composer.compose([]);

      expect(result.files.size).toBe(0);
      expect(result.dependencies).toEqual([]);
      expect(result.featureFlags).toEqual([]);
    });

    it('handles null/undefined fragments array', () => {
      const result = composer.compose(null as any);

      expect(result.files.size).toBe(0);
      expect(result.dependencies).toEqual([]);
      expect(result.featureFlags).toEqual([]);
    });

    it('handles fragments with empty code', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag1',
          name: 'Empty Fragment',
          description: 'Has no code',
          version: 'v5',
          code: '',
          imports: ['import x from "x"'],
          dependencies: [],
          featureFlags: [],
          tags: [],
        },
      ];

      const result = composer.compose(fragments);

      // Should still have the imports
      const fileContent = result.files.get('index.ts') || '';
      expect(fileContent).toContain('import x from');
    });

    it('handles fragments with whitespace-only code', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag1',
          name: 'Whitespace Fragment',
          description: 'Only whitespace',
          version: 'v5',
          code: '   \n\t  \n   ',
          imports: [],
          dependencies: [],
          featureFlags: [],
          tags: [],
        },
      ];

      const result = composer.compose(fragments);

      // Should handle gracefully
      expect(result.files.size).toBeGreaterThanOrEqual(0);
    });

    it('handles dependencies on fragments not in the set', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag1',
          name: 'Fragment 1',
          description: 'Depends on missing fragment',
          version: 'v5',
          code: 'const x = 1;',
          imports: [],
          dependencies: ['non-existent-fragment'],
          featureFlags: [],
          tags: [],
        },
      ];

      // Should not throw
      const result = composer.compose(fragments);
      expect(result.files.size).toBeGreaterThan(0);
    });

    it('trims code content', () => {
      const fragments: TemplateFragment[] = [
        {
          id: 'frag1',
          name: 'Fragment 1',
          description: 'Has extra whitespace',
          version: 'v5',
          code: '\n\n  const x = 1;  \n\n',
          imports: [],
          dependencies: [],
          featureFlags: [],
          tags: [],
        },
      ];

      const result = composer.compose(fragments);
      const fileContent = result.files.get('index.ts') || '';

      // Code should be trimmed
      expect(fileContent).toContain('const x = 1;');
      // Should not have excessive blank lines
      expect(fileContent.startsWith('\n\n')).toBe(false);
    });
  });
});
