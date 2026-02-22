/**
 * AST Utilities for TypeScript code generation.
 *
 * Uses the TypeScript Compiler API to programmatically create and print
 * TypeScript/JavaScript code structures like imports, classes, and interfaces.
 */

import * as ts from 'typescript';

/**
 * Property definition for class or interface generation.
 */
export interface PropertyDef {
  name: string;
  type: string;
  optional?: boolean;
  readonly?: boolean;
  initializer?: string;
}

/**
 * Method definition for class generation.
 */
export interface MethodDef {
  name: string;
  parameters?: Array<{ name: string; type: string; optional?: boolean }>;
  returnType?: string;
  body?: string;
  async?: boolean;
  visibility?: 'public' | 'private' | 'protected';
}

/**
 * Print a TypeScript AST node to a string.
 *
 * @param node - The TypeScript AST node to print
 * @returns The printed code string
 */
export function printNode(node: ts.Node): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const sourceFile = ts.createSourceFile(
    'generated.ts',
    '',
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS
  );
  return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
}

/**
 * Create an import statement.
 *
 * @param from - The module to import from
 * @param names - Array of named imports
 * @returns The generated import statement as a string
 *
 * @example
 * ```ts
 * createImport('@feathersjs/feathers', ['Application', 'HookContext'])
 * // Returns: import { Application, HookContext } from "@feathersjs/feathers";
 * ```
 */
export function createImport(from: string, names: string[]): string {
  if (names.length === 0) {
    // Side-effect import: import "module"
    const importDecl = ts.factory.createImportDeclaration(
      undefined,
      undefined,
      ts.factory.createStringLiteral(from)
    );
    return printNode(importDecl);
  }

  const importSpecifiers = names.map((name) =>
    ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(name))
  );

  const namedImports = ts.factory.createNamedImports(importSpecifiers);
  const importClause = ts.factory.createImportClause(false, undefined, namedImports);

  const importDecl = ts.factory.createImportDeclaration(
    undefined,
    importClause,
    ts.factory.createStringLiteral(from)
  );

  return printNode(importDecl);
}

/**
 * Create a default import statement.
 *
 * @param from - The module to import from
 * @param defaultName - The name for the default import
 * @returns The generated import statement as a string
 */
export function createDefaultImport(from: string, defaultName: string): string {
  const importClause = ts.factory.createImportClause(
    false,
    ts.factory.createIdentifier(defaultName),
    undefined
  );

  const importDecl = ts.factory.createImportDeclaration(
    undefined,
    importClause,
    ts.factory.createStringLiteral(from)
  );

  return printNode(importDecl);
}

/**
 * Parse a type string into a TypeScript TypeNode.
 */
function parseType(typeStr: string): ts.TypeNode {
  // Handle common type strings
  switch (typeStr.toLowerCase()) {
    case 'string':
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
    case 'number':
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
    case 'boolean':
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
    case 'any':
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
    case 'void':
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword);
    case 'unknown':
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
    case 'never':
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword);
    case 'null':
      return ts.factory.createLiteralTypeNode(ts.factory.createNull());
    case 'undefined':
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword);
    default:
      // For complex types, create a type reference
      if (typeStr.includes('<') || typeStr.includes('[') || typeStr.includes('|')) {
        // For complex types, use a type reference with the raw string
        // This is a simplification; full parsing would require more logic
        return ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(typeStr));
      }
      return ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(typeStr));
  }
}

/**
 * Create a class declaration.
 *
 * @param name - The class name
 * @param properties - Array of property definitions
 * @param methods - Array of method definitions
 * @returns The generated class as a string
 */
export function createClass(name: string, properties: PropertyDef[], methods: MethodDef[]): string {
  const members: ts.ClassElement[] = [];

  // Add properties
  for (const prop of properties) {
    const modifiers: ts.ModifierLike[] = [];
    if (prop.readonly) {
      modifiers.push(ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword));
    }

    const questionToken = prop.optional
      ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
      : undefined;

    const initializer = prop.initializer
      ? ts.factory.createIdentifier(prop.initializer)
      : undefined;

    const propertyDecl = ts.factory.createPropertyDeclaration(
      modifiers.length > 0 ? modifiers : undefined,
      ts.factory.createIdentifier(prop.name),
      questionToken,
      parseType(prop.type),
      initializer
    );

    members.push(propertyDecl);
  }

  // Add methods
  for (const method of methods) {
    const modifiers: ts.ModifierLike[] = [];

    if (method.visibility === 'private') {
      modifiers.push(ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword));
    } else if (method.visibility === 'protected') {
      modifiers.push(ts.factory.createModifier(ts.SyntaxKind.ProtectedKeyword));
    }

    if (method.async) {
      modifiers.push(ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword));
    }

    const params = (method.parameters || []).map((p) => {
      const questionToken = p.optional
        ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
        : undefined;

      return ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        ts.factory.createIdentifier(p.name),
        questionToken,
        parseType(p.type)
      );
    });

    const returnType = method.returnType ? parseType(method.returnType) : undefined;

    // Create method body
    let body: ts.Block;
    if (method.body) {
      // For simplicity, wrap the body string in a block
      const bodyStatement = ts.factory.createExpressionStatement(
        ts.factory.createIdentifier(method.body)
      );
      body = ts.factory.createBlock([bodyStatement], true);
    } else {
      body = ts.factory.createBlock([], true);
    }

    const methodDecl = ts.factory.createMethodDeclaration(
      modifiers.length > 0 ? modifiers : undefined,
      undefined,
      ts.factory.createIdentifier(method.name),
      undefined,
      undefined,
      params,
      returnType,
      body
    );

    members.push(methodDecl);
  }

  const classDecl = ts.factory.createClassDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createIdentifier(name),
    undefined,
    undefined,
    members
  );

  return printNode(classDecl);
}

/**
 * Create an interface declaration.
 *
 * @param name - The interface name
 * @param properties - Array of property definitions
 * @returns The generated interface as a string
 */
export function createInterface(name: string, properties: PropertyDef[]): string {
  const members: ts.TypeElement[] = [];

  for (const prop of properties) {
    const modifiers: ts.Modifier[] = [];
    if (prop.readonly) {
      modifiers.push(ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword));
    }

    const questionToken = prop.optional
      ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
      : undefined;

    const propertySignature = ts.factory.createPropertySignature(
      modifiers.length > 0 ? modifiers : undefined,
      ts.factory.createIdentifier(prop.name),
      questionToken,
      parseType(prop.type)
    );

    members.push(propertySignature);
  }

  const interfaceDecl = ts.factory.createInterfaceDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createIdentifier(name),
    undefined,
    undefined,
    members
  );

  return printNode(interfaceDecl);
}

/**
 * Create a type alias declaration.
 *
 * @param name - The type alias name
 * @param type - The type definition string
 * @returns The generated type alias as a string
 */
export function createTypeAlias(name: string, type: string): string {
  const typeAlias = ts.factory.createTypeAliasDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createIdentifier(name),
    undefined,
    parseType(type)
  );

  return printNode(typeAlias);
}

/**
 * Create a function declaration.
 *
 * @param name - The function name
 * @param parameters - Array of parameter definitions
 * @param returnType - The return type
 * @param body - The function body as a string
 * @param async - Whether the function is async
 * @returns The generated function as a string
 */
export function createFunction(
  name: string,
  parameters: Array<{ name: string; type: string; optional?: boolean }>,
  returnType: string,
  body?: string,
  async?: boolean
): string {
  const modifiers: ts.ModifierLike[] = [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)];

  if (async) {
    modifiers.push(ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword));
  }

  const params = parameters.map((p) => {
    const questionToken = p.optional
      ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
      : undefined;

    return ts.factory.createParameterDeclaration(
      undefined,
      undefined,
      ts.factory.createIdentifier(p.name),
      questionToken,
      parseType(p.type)
    );
  });

  let block: ts.Block;
  if (body) {
    const bodyStatement = ts.factory.createExpressionStatement(ts.factory.createIdentifier(body));
    block = ts.factory.createBlock([bodyStatement], true);
  } else {
    block = ts.factory.createBlock([], true);
  }

  const funcDecl = ts.factory.createFunctionDeclaration(
    modifiers,
    undefined,
    ts.factory.createIdentifier(name),
    undefined,
    params,
    parseType(returnType),
    block
  );

  return printNode(funcDecl);
}

/**
 * Create a const variable declaration with an initializer.
 *
 * @param name - The variable name
 * @param type - Optional type annotation
 * @param initializer - The initializer expression as a string
 * @param exported - Whether to export the variable
 * @returns The generated variable declaration as a string
 */
export function createConst(
  name: string,
  type: string | undefined,
  initializer: string,
  exported = true
): string {
  const modifiers: ts.ModifierLike[] = [];
  if (exported) {
    modifiers.push(ts.factory.createModifier(ts.SyntaxKind.ExportKeyword));
  }

  const typeNode = type ? parseType(type) : undefined;

  const variableDecl = ts.factory.createVariableDeclaration(
    ts.factory.createIdentifier(name),
    undefined,
    typeNode,
    ts.factory.createIdentifier(initializer)
  );

  const variableList = ts.factory.createVariableDeclarationList([variableDecl], ts.NodeFlags.Const);

  const variableStatement = ts.factory.createVariableStatement(
    modifiers.length > 0 ? modifiers : undefined,
    variableList
  );

  return printNode(variableStatement);
}
