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

/**
 * TypeScript syntax and type validator using the compiler API.
 * Runs entirely in-memory with no file writes.
 */
export interface TypeScriptValidatorOptions {
  typeCheck?: boolean;
}

export class TypeScriptValidator {
  private typeCheck: boolean;

  constructor(options: TypeScriptValidatorOptions = {}) {
    this.typeCheck = options.typeCheck !== false;
  }

  validate(code: string, filename = 'input.ts'): ValidationResult {
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      strict: true,
      noEmit: true,
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
      if (diagnostics.length === 0) {
        return { valid: true };
      }
      const errors: ValidationError[] = diagnostics.map((diagnostic) =>
        this.formatDiagnostic(diagnostic)
      );
      return { valid: false, errors };
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

    if (diagnostics.length === 0) {
      return { valid: true };
    }

    const errors: ValidationError[] = diagnostics.map((diagnostic) =>
      this.formatDiagnostic(diagnostic)
    );

    return { valid: false, errors };
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
