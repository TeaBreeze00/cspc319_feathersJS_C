/// <reference types="jest" />

import {
  createImport,
  createDefaultImport,
  createClass,
  createInterface,
  createTypeAlias,
  createFunction,
  createConst,
  printNode,
  PropertyDef,
  MethodDef,
} from '../../../src/tools/codegen/astUtils';

describe('astUtils', () => {
  describe('createImport', () => {
    it('creates a named import statement', () => {
      const result = createImport('@feathersjs/feathers', ['Application', 'HookContext']);

      expect(result).toContain('import');
      expect(result).toContain('Application');
      expect(result).toContain('HookContext');
      expect(result).toContain('@feathersjs/feathers');
    });

    it('creates a single named import', () => {
      const result = createImport('express', ['Router']);

      expect(result).toContain('import');
      expect(result).toContain('Router');
      expect(result).toContain('express');
    });

    it('creates a side-effect import when names array is empty', () => {
      const result = createImport('reflect-metadata', []);

      expect(result).toContain('import');
      expect(result).toContain('reflect-metadata');
    });

    it('handles multiple named imports', () => {
      const result = createImport('lodash', ['map', 'filter', 'reduce', 'forEach']);

      expect(result).toContain('map');
      expect(result).toContain('filter');
      expect(result).toContain('reduce');
      expect(result).toContain('forEach');
    });
  });

  describe('createDefaultImport', () => {
    it('creates a default import statement', () => {
      const result = createDefaultImport('express', 'express');

      expect(result).toContain('import');
      expect(result).toContain('express');
    });

    it('creates a default import with different name', () => {
      const result = createDefaultImport('lodash', '_');

      expect(result).toContain('import');
      expect(result).toContain('_');
      expect(result).toContain('lodash');
    });
  });

  describe('createClass', () => {
    it('creates a simple class with no members', () => {
      const result = createClass('MyClass', [], []);

      expect(result).toContain('export');
      expect(result).toContain('class');
      expect(result).toContain('MyClass');
    });

    it('creates a class with properties', () => {
      const properties: PropertyDef[] = [
        { name: 'name', type: 'string' },
        { name: 'age', type: 'number' },
      ];

      const result = createClass('Person', properties, []);

      expect(result).toContain('name');
      expect(result).toContain('string');
      expect(result).toContain('age');
      expect(result).toContain('number');
    });

    it('creates a class with optional properties', () => {
      const properties: PropertyDef[] = [
        { name: 'email', type: 'string', optional: true },
      ];

      const result = createClass('User', properties, []);

      expect(result).toContain('email');
      expect(result).toContain('?');
    });

    it('creates a class with readonly properties', () => {
      const properties: PropertyDef[] = [
        { name: 'id', type: 'string', readonly: true },
      ];

      const result = createClass('Entity', properties, []);

      expect(result).toContain('readonly');
      expect(result).toContain('id');
    });

    it('creates a class with property initializer', () => {
      const properties: PropertyDef[] = [
        { name: 'count', type: 'number', initializer: '0' },
      ];

      const result = createClass('Counter', properties, []);

      expect(result).toContain('count');
      expect(result).toContain('0');
    });

    it('creates a class with methods', () => {
      const methods: MethodDef[] = [
        { name: 'greet', returnType: 'string' },
      ];

      const result = createClass('Greeter', [], methods);

      expect(result).toContain('greet');
    });

    it('creates a class with async methods', () => {
      const methods: MethodDef[] = [
        { name: 'fetchData', returnType: 'Promise<void>', async: true },
      ];

      const result = createClass('DataFetcher', [], methods);

      expect(result).toContain('async');
      expect(result).toContain('fetchData');
    });

    it('creates a class with method parameters', () => {
      const methods: MethodDef[] = [
        {
          name: 'add',
          parameters: [
            { name: 'a', type: 'number' },
            { name: 'b', type: 'number' },
          ],
          returnType: 'number',
        },
      ];

      const result = createClass('Calculator', [], methods);

      expect(result).toContain('add');
      expect(result).toContain('a');
      expect(result).toContain('b');
    });

    it('creates a class with optional method parameters', () => {
      const methods: MethodDef[] = [
        {
          name: 'log',
          parameters: [
            { name: 'message', type: 'string' },
            { name: 'level', type: 'string', optional: true },
          ],
          returnType: 'void',
        },
      ];

      const result = createClass('Logger', [], methods);

      expect(result).toContain('level');
      expect(result).toContain('?');
    });

    it('creates a class with private methods', () => {
      const methods: MethodDef[] = [
        { name: 'internalMethod', visibility: 'private', returnType: 'void' },
      ];

      const result = createClass('Internal', [], methods);

      expect(result).toContain('private');
      expect(result).toContain('internalMethod');
    });

    it('creates a class with protected methods', () => {
      const methods: MethodDef[] = [
        { name: 'protectedMethod', visibility: 'protected', returnType: 'void' },
      ];

      const result = createClass('Base', [], methods);

      expect(result).toContain('protected');
      expect(result).toContain('protectedMethod');
    });

    it('creates a class with method body', () => {
      const methods: MethodDef[] = [
        { name: 'execute', returnType: 'void', body: 'console.log("executed")' },
      ];

      const result = createClass('Executor', [], methods);

      expect(result).toContain('execute');
      expect(result).toContain('console.log');
    });
  });

  describe('createInterface', () => {
    it('creates a simple interface', () => {
      const result = createInterface('IUser', []);

      expect(result).toContain('export');
      expect(result).toContain('interface');
      expect(result).toContain('IUser');
    });

    it('creates an interface with properties', () => {
      const properties: PropertyDef[] = [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' },
      ];

      const result = createInterface('IEntity', properties);

      expect(result).toContain('id');
      expect(result).toContain('name');
      expect(result).toContain('string');
    });

    it('creates an interface with optional properties', () => {
      const properties: PropertyDef[] = [
        { name: 'email', type: 'string', optional: true },
      ];

      const result = createInterface('IContact', properties);

      expect(result).toContain('email');
      expect(result).toContain('?');
    });

    it('creates an interface with readonly properties', () => {
      const properties: PropertyDef[] = [
        { name: 'createdAt', type: 'Date', readonly: true },
      ];

      const result = createInterface('ITimestamped', properties);

      expect(result).toContain('readonly');
      expect(result).toContain('createdAt');
    });
  });

  describe('createTypeAlias', () => {
    it('creates a simple type alias', () => {
      const result = createTypeAlias('ID', 'string');

      expect(result).toContain('export');
      expect(result).toContain('type');
      expect(result).toContain('ID');
      expect(result).toContain('string');
    });

    it('creates a type alias for number', () => {
      const result = createTypeAlias('Count', 'number');

      expect(result).toContain('Count');
      expect(result).toContain('number');
    });

    it('creates a type alias for boolean', () => {
      const result = createTypeAlias('Flag', 'boolean');

      expect(result).toContain('Flag');
      expect(result).toContain('boolean');
    });

    it('creates a type alias for any', () => {
      const result = createTypeAlias('Anything', 'any');

      expect(result).toContain('any');
    });

    it('creates a type alias for void', () => {
      const result = createTypeAlias('Nothing', 'void');

      expect(result).toContain('void');
    });

    it('creates a type alias for unknown', () => {
      const result = createTypeAlias('Unknown', 'unknown');

      expect(result).toContain('unknown');
    });

    it('creates a type alias for never', () => {
      const result = createTypeAlias('Never', 'never');

      expect(result).toContain('never');
    });

    it('creates a type alias for null', () => {
      const result = createTypeAlias('Nullable', 'null');

      expect(result).toContain('null');
    });

    it('creates a type alias for undefined', () => {
      const result = createTypeAlias('Undef', 'undefined');

      expect(result).toContain('undefined');
    });

    it('creates a type alias for complex types', () => {
      const result = createTypeAlias('UserList', 'Array<User>');

      expect(result).toContain('UserList');
      expect(result).toContain('Array<User>');
    });

    it('creates a type alias for union types', () => {
      const result = createTypeAlias('StringOrNumber', 'string | number');

      expect(result).toContain('StringOrNumber');
    });
  });

  describe('createFunction', () => {
    it('creates a simple function', () => {
      const result = createFunction('greet', [], 'void');

      expect(result).toContain('export');
      expect(result).toContain('function');
      expect(result).toContain('greet');
    });

    it('creates a function with parameters', () => {
      const result = createFunction(
        'add',
        [
          { name: 'a', type: 'number' },
          { name: 'b', type: 'number' },
        ],
        'number'
      );

      expect(result).toContain('add');
      expect(result).toContain('a');
      expect(result).toContain('b');
      expect(result).toContain('number');
    });

    it('creates a function with optional parameters', () => {
      const result = createFunction(
        'log',
        [
          { name: 'message', type: 'string' },
          { name: 'level', type: 'string', optional: true },
        ],
        'void'
      );

      expect(result).toContain('level');
      expect(result).toContain('?');
    });

    it('creates an async function', () => {
      const result = createFunction('fetchData', [], 'Promise<void>', undefined, true);

      expect(result).toContain('async');
      expect(result).toContain('fetchData');
    });

    it('creates a function with body', () => {
      const result = createFunction('execute', [], 'void', 'console.log("done")');

      expect(result).toContain('execute');
      expect(result).toContain('console.log');
    });
  });

  describe('createConst', () => {
    it('creates an exported const', () => {
      const result = createConst('PI', 'number', '3.14159');

      expect(result).toContain('export');
      expect(result).toContain('const');
      expect(result).toContain('PI');
      expect(result).toContain('3.14159');
    });

    it('creates a non-exported const', () => {
      const result = createConst('secret', 'string', '"hidden"', false);

      expect(result).not.toContain('export');
      expect(result).toContain('const');
      expect(result).toContain('secret');
    });

    it('creates a const without type annotation', () => {
      const result = createConst('value', undefined, '42');

      expect(result).toContain('const');
      expect(result).toContain('value');
      expect(result).toContain('42');
    });
  });
});
