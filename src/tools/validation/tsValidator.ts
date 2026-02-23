import * as ts from 'typescript';
export interface ValidationError {
  line: number;
  column: number;
  message: string;
  code?: number;
}
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}
export interface TypeScriptValidatorOptions {
  typeCheck?: boolean;
}

const IGNORED_CODES = new Set([
  2307, // Cannot find module '...' or its corresponding type declarations
  2304, // Cannot find name '...'
  2305, // Module '...' has no exported member '...'
]);

export class TypeScriptValidator {
  private typeCheck: boolean;
  constructor(options: TypeScriptValidatorOptions = {}) {
    this.typeCheck = options.typeCheck !== false;
  }
  validate(code: string, filename = 'input.ts'): ValidationResult {
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      noEmit: true,
      noResolve: true,
    };
    const normalizedFile = this.normalizeFilename(filename);
    const scriptKind = normalizedFile.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    if (!this.typeCheck) {
      const sourceFile = ts.createSourceFile(
        normalizedFile,
        code,
        compilerOptions.target ?? ts.ScriptTarget.ES2022,
        true,
        scriptKind
      );
      const diagnostics = ((sourceFile as any).parseDiagnostics as ts.Diagnostic[]) ?? [];
      // ← filter here
      const filtered = diagnostics.filter((d) => !IGNORED_CODES.has(d.code ?? -1));
      if (filtered.length === 0) {
        return { valid: true };
      }
      return { valid: false, errors: filtered.map((d) => this.formatDiagnostic(d)) };
    }
    const host = ts.createCompilerHost(compilerOptions, true);
    const originalReadFile = host.readFile.bind(host);
    const originalFileExists = host.fileExists.bind(host);
    const originalGetSourceFile = host.getSourceFile.bind(host);
    host.readFile = (fileName) => (fileName === normalizedFile ? code : originalReadFile(fileName));
    host.fileExists = (fileName) =>
      fileName === normalizedFile ? true : originalFileExists(fileName);
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
      if (fileName === normalizedFile) {
        return ts.createSourceFile(fileName, code, languageVersion, true, scriptKind);
      }
      return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    };
    host.writeFile = () => undefined;
    const program = ts.createProgram([normalizedFile], compilerOptions, host);
    const sourceFile = program.getSourceFile(normalizedFile);
    const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile);
    // ← filter here
    const filtered = Array.from(diagnostics).filter((d) => !IGNORED_CODES.has(d.code ?? -1));
    if (filtered.length === 0) {
      return { valid: true };
    }
    return { valid: false, errors: filtered.map((d) => this.formatDiagnostic(d)) };
  }
  private normalizeFilename(filename: string): string {
    if (filename.endsWith('.ts') || filename.endsWith('.tsx')) {
      return filename;
    }
    return `${filename}.ts`;
  }
  private formatDiagnostic(diagnostic: ts.Diagnostic): ValidationError {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    let line = 1;
    let column = 1;
    if (diagnostic.file && typeof diagnostic.start === 'number') {
      const pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      line = pos.line + 1;
      column = pos.character + 1;
    }
    return {
      line,
      column,
      message,
      code: diagnostic.code,
    };
  }
}
