/**
 * Schema generators for FeathersJS code generation.
 *
 * Generates database schema code for Mongoose (MongoDB) and Knex (SQL databases).
 * Supports common field types: string, number, boolean, date, objectId, array.
 */

/**
 * Field definition for schema generation.
 */
export interface FieldDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'objectId' | 'array' | 'object';
  required?: boolean;
  unique?: boolean;
  default?: string | number | boolean;
  ref?: string; // For objectId references
  arrayType?: 'string' | 'number' | 'boolean' | 'date' | 'objectId' | 'object'; // Type of array elements
  index?: boolean;
  maxLength?: number;
  minLength?: number;
  min?: number;
  max?: number;
  enum?: string[] | number[];
}

/**
 * Map field type to Mongoose schema type.
 */
function getMongooseType(field: FieldDef): string {
  switch (field.type) {
    case 'string':
      return 'String';
    case 'number':
      return 'Number';
    case 'boolean':
      return 'Boolean';
    case 'date':
      return 'Date';
    case 'objectId':
      return 'Schema.Types.ObjectId';
    case 'array':
      if (field.arrayType) {
        const innerType = getMongooseType({ ...field, type: field.arrayType });
        return `[${innerType}]`;
      }
      return '[Schema.Types.Mixed]';
    case 'object':
      return 'Schema.Types.Mixed';
    default:
      return 'String';
  }
}

/**
 * Generate a Mongoose schema definition.
 *
 * @param fields - Array of field definitions
 * @returns Generated Mongoose schema code as a string
 *
 * @example
 * ```ts
 * generateMongooseSchema([
 *   { name: 'email', type: 'string', required: true, unique: true },
 *   { name: 'age', type: 'number', min: 0 },
 *   { name: 'createdAt', type: 'date', default: 'Date.now' }
 * ])
 * ```
 */
export function generateMongooseSchema(fields: FieldDef[]): string {
  const lines: string[] = [];

  lines.push("import { Schema, model, Document } from 'mongoose';");
  lines.push('');

  // Generate interface
  lines.push('export interface IDocument extends Document {');
  for (const field of fields) {
    const tsType = getTypeScriptType(field);
    const optional = field.required ? '' : '?';
    lines.push(`  ${field.name}${optional}: ${tsType};`);
  }
  lines.push('}');
  lines.push('');

  // Generate schema
  lines.push('const schema = new Schema<IDocument>(');
  lines.push('  {');

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const isLast = i === fields.length - 1;
    const fieldDef = generateMongooseFieldDef(field);
    lines.push(`    ${field.name}: ${fieldDef}${isLast ? '' : ','}`);
  }

  lines.push('  },');
  lines.push('  {');
  lines.push('    timestamps: true,');
  lines.push('  }');
  lines.push(');');
  lines.push('');

  lines.push("export const Model = model<IDocument>('Model', schema);");
  lines.push('');
  lines.push('export default schema;');

  return lines.join('\n');
}

/**
 * Generate a single Mongoose field definition.
 */
function generateMongooseFieldDef(field: FieldDef): string {
  const mongooseType = getMongooseType(field);
  const options: string[] = [];

  options.push(`type: ${mongooseType}`);

  if (field.required) {
    options.push('required: true');
  }

  if (field.unique) {
    options.push('unique: true');
  }

  if (field.index) {
    options.push('index: true');
  }

  if (field.default !== undefined) {
    if (typeof field.default === 'string') {
      // Check if it's a function reference like Date.now
      if (field.default.includes('.') || field.default === 'Date.now') {
        options.push(`default: ${field.default}`);
      } else {
        options.push(`default: '${field.default}'`);
      }
    } else {
      options.push(`default: ${field.default}`);
    }
  }

  if (field.ref) {
    options.push(`ref: '${field.ref}'`);
  }

  if (field.maxLength !== undefined) {
    options.push(`maxlength: ${field.maxLength}`);
  }

  if (field.minLength !== undefined) {
    options.push(`minlength: ${field.minLength}`);
  }

  if (field.min !== undefined) {
    options.push(`min: ${field.min}`);
  }

  if (field.max !== undefined) {
    options.push(`max: ${field.max}`);
  }

  if (field.enum && field.enum.length > 0) {
    if (typeof field.enum[0] === 'string') {
      options.push(`enum: [${field.enum.map((v) => `'${v}'`).join(', ')}]`);
    } else {
      options.push(`enum: [${field.enum.join(', ')}]`);
    }
  }

  return `{ ${options.join(', ')} }`;
}

/**
 * Map field type to Knex column builder method.
 */
function getKnexColumnMethod(field: FieldDef): string {
  switch (field.type) {
    case 'string':
      if (field.maxLength && field.maxLength > 255) {
        return 'text';
      }
      return 'string';
    case 'number':
      if (Number.isInteger(field.min) && Number.isInteger(field.max)) {
        return 'integer';
      }
      return 'float';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'timestamp';
    case 'objectId':
      return 'string'; // Store as string reference
    case 'array':
      return 'json'; // Store arrays as JSON
    case 'object':
      return 'json';
    default:
      return 'string';
  }
}

/**
 * Generate a Knex migration schema definition.
 *
 * @param fields - Array of field definitions
 * @param tableName - Name of the database table
 * @returns Generated Knex migration code as a string
 *
 * @example
 * ```ts
 * generateKnexSchema([
 *   { name: 'email', type: 'string', required: true, unique: true },
 *   { name: 'age', type: 'number', min: 0 },
 *   { name: 'isActive', type: 'boolean', default: true }
 * ], 'users')
 * ```
 */
export function generateKnexSchema(fields: FieldDef[], tableName: string): string {
  const lines: string[] = [];

  lines.push("import type { Knex } from 'knex';");
  lines.push('');

  // Generate up migration
  lines.push('export async function up(knex: Knex): Promise<void> {');
  lines.push(`  await knex.schema.createTable('${tableName}', (table) => {`);
  lines.push('    table.increments(\'id\').primary();');

  for (const field of fields) {
    const columnDef = generateKnexColumnDef(field);
    lines.push(`    ${columnDef}`);
  }

  // Add timestamps
  lines.push('    table.timestamps(true, true);');
  lines.push('  });');
  lines.push('}');
  lines.push('');

  // Generate down migration
  lines.push('export async function down(knex: Knex): Promise<void> {');
  lines.push(`  await knex.schema.dropTableIfExists('${tableName}');`);
  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate a single Knex column definition.
 */
function generateKnexColumnDef(field: FieldDef): string {
  const columnMethod = getKnexColumnMethod(field);
  const parts: string[] = [];

  // Start with column type and name
  if (columnMethod === 'string' && field.maxLength) {
    parts.push(`table.string('${field.name}', ${field.maxLength})`);
  } else if (columnMethod === 'integer') {
    parts.push(`table.integer('${field.name}')`);
  } else if (columnMethod === 'float') {
    parts.push(`table.float('${field.name}')`);
  } else {
    parts.push(`table.${columnMethod}('${field.name}')`);
  }

  // Add modifiers
  if (field.required) {
    parts.push('.notNullable()');
  } else {
    parts.push('.nullable()');
  }

  if (field.unique) {
    parts.push('.unique()');
  }

  if (field.index) {
    parts.push('.index()');
  }

  if (field.default !== undefined) {
    if (typeof field.default === 'string') {
      // Check for special SQL defaults
      if (field.default.toUpperCase() === 'NOW()' || field.default === 'CURRENT_TIMESTAMP') {
        parts.push(`.defaultTo(knex.fn.now())`);
      } else {
        parts.push(`.defaultTo('${field.default}')`);
      }
    } else if (typeof field.default === 'boolean') {
      parts.push(`.defaultTo(${field.default})`);
    } else {
      parts.push(`.defaultTo(${field.default})`);
    }
  }

  return parts.join('') + ';';
}

/**
 * Map field type to TypeScript type.
 */
function getTypeScriptType(field: FieldDef): string {
  switch (field.type) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'Date';
    case 'objectId':
      return 'string';
    case 'array':
      if (field.arrayType) {
        const innerType = getTypeScriptType({ ...field, type: field.arrayType });
        return `${innerType}[]`;
      }
      return 'unknown[]';
    case 'object':
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

/**
 * Generate a TypeScript interface from field definitions.
 *
 * @param fields - Array of field definitions
 * @param interfaceName - Name of the interface
 * @returns Generated TypeScript interface as a string
 */
export function generateTypeScriptInterface(
  fields: FieldDef[],
  interfaceName: string
): string {
  const lines: string[] = [];

  lines.push(`export interface ${interfaceName} {`);

  for (const field of fields) {
    const tsType = getTypeScriptType(field);
    const optional = field.required ? '' : '?';
    lines.push(`  ${field.name}${optional}: ${tsType};`);
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate a JSON Schema from field definitions.
 *
 * @param fields - Array of field definitions
 * @returns JSON Schema object
 */
export function generateJsonSchema(fields: FieldDef[]): object {
  const properties: Record<string, object> = {};
  const required: string[] = [];

  for (const field of fields) {
    const prop: Record<string, unknown> = {
      type: getJsonSchemaType(field),
    };

    if (field.enum) {
      prop.enum = field.enum;
    }

    if (field.minLength !== undefined) {
      prop.minLength = field.minLength;
    }

    if (field.maxLength !== undefined) {
      prop.maxLength = field.maxLength;
    }

    if (field.min !== undefined) {
      prop.minimum = field.min;
    }

    if (field.max !== undefined) {
      prop.maximum = field.max;
    }

    if (field.type === 'array' && field.arrayType) {
      prop.items = { type: getJsonSchemaType({ ...field, type: field.arrayType }) };
    }

    properties[field.name] = prop;

    if (field.required) {
      required.push(field.name);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
    additionalProperties: false,
  };
}

/**
 * Map field type to JSON Schema type.
 */
function getJsonSchemaType(field: FieldDef): string {
  switch (field.type) {
    case 'string':
    case 'objectId':
    case 'date':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'array';
    case 'object':
      return 'object';
    default:
      return 'string';
  }
}
