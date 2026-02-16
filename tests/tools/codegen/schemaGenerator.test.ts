/// <reference types="jest" />

import {
  generateMongooseSchema,
  generateKnexSchema,
  generateTypeScriptInterface,
  FieldDef,
} from '../../../src/tools/codegen/schemaGenerator';

describe('schemaGenerator', () => {
  describe('generateMongooseSchema', () => {
    it('generates a schema with string field', () => {
      const fields: FieldDef[] = [{ name: 'name', type: 'string', required: true }];

      const result = generateMongooseSchema(fields);

      expect(result).toContain('mongoose');
      expect(result).toContain('name');
      expect(result).toContain('String');
    });

    it('generates a schema with number field', () => {
      const fields: FieldDef[] = [{ name: 'age', type: 'number', required: true }];

      const result = generateMongooseSchema(fields);

      expect(result).toContain('age');
      expect(result).toContain('Number');
    });

    it('generates a schema with boolean field', () => {
      const fields: FieldDef[] = [{ name: 'isActive', type: 'boolean', required: true }];

      const result = generateMongooseSchema(fields);

      expect(result).toContain('isActive');
      expect(result).toContain('Boolean');
    });

    it('generates a schema with date field', () => {
      const fields: FieldDef[] = [{ name: 'createdAt', type: 'date', required: true }];

      const result = generateMongooseSchema(fields);

      expect(result).toContain('createdAt');
      expect(result).toContain('Date');
    });

    it('generates a schema with objectId field', () => {
      const fields: FieldDef[] = [{ name: 'userId', type: 'objectId', required: true }];

      const result = generateMongooseSchema(fields);

      expect(result).toContain('userId');
      expect(result).toContain('ObjectId');
    });

    it('generates a schema with array field', () => {
      const fields: FieldDef[] = [{ name: 'tags', type: 'array', required: false }];

      const result = generateMongooseSchema(fields);

      expect(result).toContain('tags');
    });

    it('generates a schema with object field', () => {
      const fields: FieldDef[] = [{ name: 'metadata', type: 'object', required: false }];

      const result = generateMongooseSchema(fields);

      expect(result).toContain('metadata');
    });

    it('handles required fields', () => {
      const fields: FieldDef[] = [{ name: 'email', type: 'string', required: true }];

      const result = generateMongooseSchema(fields);

      expect(result).toContain('required');
    });

    it('handles unique fields', () => {
      const fields: FieldDef[] = [{ name: 'username', type: 'string', required: true, unique: true }];

      const result = generateMongooseSchema(fields);

      expect(result).toContain('unique');
    });

    it('handles default values', () => {
      const fields: FieldDef[] = [{ name: 'status', type: 'string', required: false, default: 'active' }];

      const result = generateMongooseSchema(fields);

      expect(result).toContain('default');
    });

    it('generates a schema with multiple fields', () => {
      const fields: FieldDef[] = [
        { name: 'username', type: 'string', required: true, unique: true },
        { name: 'email', type: 'string', required: true, unique: true },
        { name: 'age', type: 'number', required: false },
        { name: 'isVerified', type: 'boolean', required: true },
      ];

      const result = generateMongooseSchema(fields);

      expect(result).toContain('username');
      expect(result).toContain('email');
      expect(result).toContain('age');
      expect(result).toContain('isVerified');
    });

    it('generates export statement', () => {
      const fields: FieldDef[] = [{ name: 'test', type: 'string' }];

      const result = generateMongooseSchema(fields);

      expect(result).toContain('export');
    });
  });

  describe('generateKnexSchema', () => {
    it('generates a knex migration with string field', () => {
      const fields: FieldDef[] = [{ name: 'name', type: 'string', required: true }];

      const result = generateKnexSchema(fields, 'users');

      expect(result).toContain('knex');
      expect(result).toContain('name');
      expect(result).toContain('users');
    });

    it('generates a knex migration with number field', () => {
      const fields: FieldDef[] = [{ name: 'count', type: 'number', required: true }];

      const result = generateKnexSchema(fields, 'items');

      expect(result).toContain('count');
    });

    it('generates a knex migration with boolean field', () => {
      const fields: FieldDef[] = [{ name: 'isActive', type: 'boolean', required: true }];

      const result = generateKnexSchema(fields, 'accounts');

      expect(result).toContain('isActive');
      expect(result).toContain('boolean');
    });

    it('generates a knex migration with date field', () => {
      const fields: FieldDef[] = [{ name: 'createdAt', type: 'date', required: true }];

      const result = generateKnexSchema(fields, 'records');

      expect(result).toContain('createdAt');
    });

    it('handles required fields with notNullable', () => {
      const fields: FieldDef[] = [{ name: 'email', type: 'string', required: true }];

      const result = generateKnexSchema(fields, 'users');

      expect(result).toContain('notNullable');
    });

    it('handles unique fields', () => {
      const fields: FieldDef[] = [{ name: 'username', type: 'string', required: true, unique: true }];

      const result = generateKnexSchema(fields, 'users');

      expect(result).toContain('unique');
    });

    it('handles default values', () => {
      const fields: FieldDef[] = [{ name: 'status', type: 'string', required: false, default: 'pending' }];

      const result = generateKnexSchema(fields, 'orders');

      expect(result).toContain('defaultTo');
    });

    it('generates up and down functions', () => {
      const fields: FieldDef[] = [{ name: 'test', type: 'string' }];

      const result = generateKnexSchema(fields, 'tests');

      expect(result).toContain('up');
      expect(result).toContain('down');
    });

    it('generates a knex migration with multiple fields', () => {
      const fields: FieldDef[] = [
        { name: 'title', type: 'string', required: true },
        { name: 'price', type: 'number', required: true },
        { name: 'inStock', type: 'boolean', required: true },
        { name: 'createdAt', type: 'date', required: true },
      ];

      const result = generateKnexSchema(fields, 'products');

      expect(result).toContain('title');
      expect(result).toContain('price');
      expect(result).toContain('inStock');
      expect(result).toContain('createdAt');
    });

    it('handles objectId as uuid', () => {
      const fields: FieldDef[] = [{ name: 'refId', type: 'objectId', required: true }];

      const result = generateKnexSchema(fields, 'refs');

      expect(result).toContain('refId');
    });

    it('handles array field as json', () => {
      const fields: FieldDef[] = [{ name: 'items', type: 'array', required: false }];

      const result = generateKnexSchema(fields, 'orders');

      expect(result).toContain('items');
    });

    it('handles object field as json', () => {
      const fields: FieldDef[] = [{ name: 'config', type: 'object', required: false }];

      const result = generateKnexSchema(fields, 'settings');

      expect(result).toContain('config');
    });
  });

  describe('generateTypeScriptInterface', () => {
    it('generates an interface with string field', () => {
      const fields: FieldDef[] = [{ name: 'name', type: 'string', required: true }];

      const result = generateTypeScriptInterface(fields, 'User');

      expect(result).toContain('interface');
      expect(result).toContain('User');
      expect(result).toContain('name');
      expect(result).toContain('string');
    });

    it('generates an interface with number field', () => {
      const fields: FieldDef[] = [{ name: 'age', type: 'number', required: true }];

      const result = generateTypeScriptInterface(fields, 'Person');

      expect(result).toContain('age');
      expect(result).toContain('number');
    });

    it('generates an interface with boolean field', () => {
      const fields: FieldDef[] = [{ name: 'isActive', type: 'boolean', required: true }];

      const result = generateTypeScriptInterface(fields, 'Account');

      expect(result).toContain('isActive');
      expect(result).toContain('boolean');
    });

    it('generates an interface with date field', () => {
      const fields: FieldDef[] = [{ name: 'createdAt', type: 'date', required: true }];

      const result = generateTypeScriptInterface(fields, 'Record');

      expect(result).toContain('createdAt');
      expect(result).toContain('Date');
    });

    it('generates an interface with objectId field', () => {
      const fields: FieldDef[] = [{ name: 'userId', type: 'objectId', required: true }];

      const result = generateTypeScriptInterface(fields, 'Ref');

      expect(result).toContain('userId');
      expect(result).toContain('string');
    });

    it('generates an interface with array field', () => {
      const fields: FieldDef[] = [{ name: 'tags', type: 'array', required: true }];

      const result = generateTypeScriptInterface(fields, 'Post');

      expect(result).toContain('tags');
      expect(result).toContain('[]');
    });

    it('generates an interface with object field', () => {
      const fields: FieldDef[] = [{ name: 'metadata', type: 'object', required: true }];

      const result = generateTypeScriptInterface(fields, 'Item');

      expect(result).toContain('metadata');
    });

    it('handles optional fields', () => {
      const fields: FieldDef[] = [{ name: 'nickname', type: 'string', required: false }];

      const result = generateTypeScriptInterface(fields, 'User');

      expect(result).toContain('nickname');
      expect(result).toContain('?');
    });

    it('generates an interface with multiple fields', () => {
      const fields: FieldDef[] = [
        { name: 'id', type: 'string', required: true },
        { name: 'username', type: 'string', required: true },
        { name: 'age', type: 'number', required: false },
        { name: 'isActive', type: 'boolean', required: true },
      ];

      const result = generateTypeScriptInterface(fields, 'UserProfile');

      expect(result).toContain('id');
      expect(result).toContain('username');
      expect(result).toContain('age');
      expect(result).toContain('isActive');
    });

    it('exports the interface', () => {
      const fields: FieldDef[] = [{ name: 'test', type: 'string' }];

      const result = generateTypeScriptInterface(fields, 'Test');

      expect(result).toContain('export');
    });
  });

  describe('edge cases', () => {
    it('handles empty fields array for mongoose', () => {
      const result = generateMongooseSchema([]);

      expect(result).toContain('mongoose');
    });

    it('handles empty fields array for knex', () => {
      const result = generateKnexSchema([], 'empty');

      expect(result).toContain('knex');
    });

    it('handles empty fields array for interface', () => {
      const result = generateTypeScriptInterface([], 'Empty');

      expect(result).toContain('interface');
      expect(result).toContain('Empty');
    });

    it('handles field with all options for mongoose', () => {
      const fields: FieldDef[] = [
        { name: 'fullField', type: 'string', required: true, unique: true, default: 'default' },
      ];

      const result = generateMongooseSchema(fields);

      expect(result).toContain('fullField');
    });

    it('handles field with all options for knex', () => {
      const fields: FieldDef[] = [
        { name: 'fullField', type: 'string', required: true, unique: true, default: 'default' },
      ];

      const result = generateKnexSchema(fields, 'full');

      expect(result).toContain('fullField');
    });

    it('handles number default value', () => {
      const fields: FieldDef[] = [{ name: 'count', type: 'number', default: 0 }];

      const result = generateMongooseSchema(fields);

      expect(result).toContain('count');
    });

    it('handles boolean default value', () => {
      const fields: FieldDef[] = [{ name: 'active', type: 'boolean', default: true }];

      const result = generateMongooseSchema(fields);

      expect(result).toContain('active');
    });
  });
});
