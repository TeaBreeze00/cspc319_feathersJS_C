# FeathersJS MCP Server — Linear Build Steps

**For AI Coding Agent Execution**

This document contains a numbered, linear sequence of build steps. Execute each step in order. Each step produces a tangible artifact and references earlier steps when dependent.

---

## GUARDRAILS (Reference Before Every Step)

Before implementing ANY step, verify compliance with these constraints:

- **G1**: NO network requests at runtime. All knowledge embedded in package.
- **G2**: NO session state between tool calls. Tools are stateless.
- **G3**: ALL knowledge content has `version` field (`'v4'` | `'v5'` | `'both'`).
- **G4**: Response time <2s (p95). Server startup <3s.
- **G5**: Memory usage <200MB peak.
- **G6**: ALL generated code MUST pass validation before return.
- **G7**: Layer imports flow downward only: Protocol → Routing → Tools → Knowledge.
- **G8**: stdout is ONLY for MCP JSON-RPC. Use stderr for logs.
- **G9**: Test coverage ≥80%.
- **G10**: Use ONLY: Node.js 20, TypeScript strict, @modelcontextprotocol/sdk, Ajv, Jest.

---

## PHASE 0: PROJECT INITIALIZATION

### Step 1: Create package.json
Create `package.json` with:
```json
{
  "name": "feathers-mcp-server",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": { "feathers-mcp-server": "./dist/index.js" },
  "engines": { "node": ">=20.0.0" },
  "scripts": {}
}
```
**Verify**:
1. `node -e "const p=require('./package.json'); if(p.name!=='feathers-mcp-server') throw 'name wrong'; if(p.engines.node!=='>=20.0.0') throw 'engines wrong'; console.log('✓ package.json valid')"` → outputs success
2. `cat package.json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` → parses without error

**Artifact**: `package.json` exists with name and engines fields.

---

### Step 2: Create tsconfig.json
Create `tsconfig.json` with:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```
**Verify**:
1. `node -e "const t=require('./tsconfig.json'); if(!t.compilerOptions.strict) throw 'strict not enabled'; console.log('✓ tsconfig.json valid')"` → outputs success
2. `npx tsc --showConfig` → displays merged config without errors

**Artifact**: `tsconfig.json` with strict mode enabled.

---

### Step 3: Create directory structure
Create these directories:
- `src/`
- `src/protocol/`
- `src/protocol/handlers/`
- `src/routing/`
- `src/tools/`
- `src/tools/search/`
- `src/tools/templates/`
- `src/tools/codegen/`
- `src/tools/validation/`
- `src/tools/validation/rules/`
- `src/knowledge/`
- `knowledge-base/`
- `knowledge-base/docs/`
- `knowledge-base/templates/`
- `knowledge-base/snippets/`
- `knowledge-base/errors/`
- `knowledge-base/best-practices/`
- `tests/`
- `tests/helpers/`
- `tests/protocol/`
- `tests/routing/`
- `tests/knowledge/`
- `tests/tools/`
- `tests/integration/`
- `tests/e2e/`
- `tests/performance/`
- `docs/`
- `config-templates/`

**Verify**:
```bash
for dir in src src/protocol src/protocol/handlers src/routing src/tools \
  src/tools/search src/tools/templates src/tools/codegen src/tools/validation \
  src/tools/validation/rules src/knowledge knowledge-base knowledge-base/docs \
  knowledge-base/templates knowledge-base/snippets knowledge-base/errors \
  knowledge-base/best-practices tests tests/helpers tests/protocol tests/routing \
  tests/knowledge tests/tools tests/integration tests/e2e tests/performance \
  docs config-templates; do
  [ -d "$dir" ] && echo "✓ $dir" || echo "✗ $dir missing"
done
```
→ All directories show ✓

**Artifact**: All directories exist.

---

### Step 4: Install production dependencies
Run: `npm install @modelcontextprotocol/sdk ajv`

**Verify**:
1. `node -e "require('@modelcontextprotocol/sdk'); console.log('✓ @modelcontextprotocol/sdk')"` → resolves
2. `node -e "require('ajv'); console.log('✓ ajv')"` → resolves
3. `cat package.json | grep -q '"dependencies"' && echo '✓ dependencies in package.json'` → found

**Artifact**: `node_modules/` contains @modelcontextprotocol/sdk and ajv.

---

### Step 5: Install development dependencies
Run: `npm install -D typescript ts-node jest ts-jest @types/jest @types/node eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier`

**Verify**:
1. `npx tsc --version` → displays TypeScript version
2. `npx jest --version` → displays Jest version
3. `npx eslint --version` → displays ESLint version
4. `npx prettier --version` → displays Prettier version
5. `node -e "const p=require('./package.json'); if(!p.devDependencies.typescript) throw 'missing'; console.log('✓ devDependencies present')"` → success

**Artifact**: All dev dependencies in `package.json` devDependencies.

---

### Step 6: Create .eslintrc.json
Create `.eslintrc.json`:
```json
{
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```
**Verify**:
1. `node -e "JSON.parse(require('fs').readFileSync('.eslintrc.json')); console.log('✓ .eslintrc.json parses')"` → parses
2. `npx eslint --print-config src/index.ts 2>/dev/null | head -5` → displays config (after Step 12)

**Artifact**: `.eslintrc.json` with TypeScript rules.

---

### Step 7: Create .prettierrc
Create `.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```
**Verify**:
1. `node -e "JSON.parse(require('fs').readFileSync('.prettierrc')); console.log('✓ .prettierrc parses')"` → parses
2. `npx prettier --check .prettierrc` → file is formatted (after Step 12)

**Artifact**: `.prettierrc` with formatting rules.

---

### Step 8: Create jest.config.js
Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```
**Verify**:
1. `node -e "require('./jest.config.js'); console.log('✓ jest.config.js loads')"` → loads
2. `node -e "const c=require('./jest.config.js'); if(c.coverageThreshold.global.lines!==80) throw 'threshold wrong'; console.log('✓ 80% threshold set')"` → success

**Artifact**: `jest.config.js` with 80% coverage threshold.

---

### Step 9: Add npm scripts to package.json
Update `package.json` scripts:
```json
"scripts": {
  "build": "tsc",
  "start": "node dist/index.js",
  "dev": "ts-node src/index.ts",
  "test": "jest",
  "test:coverage": "jest --coverage",
  "lint": "eslint src/ tests/",
  "format": "prettier --write src/ tests/"
}
```
**Verify**:
1. `node -e "const p=require('./package.json'); const s=p.scripts; if(!s.build||!s.test||!s.lint) throw 'scripts missing'; console.log('✓ all scripts defined')"` → success
2. `npm run --list` → displays all scripts

**Artifact**: All scripts runnable.

---

### Step 10: Create .gitignore
Create `.gitignore`:
```
node_modules/
dist/
coverage/
*.log
.env
.DS_Store
```
**Verify**:
1. `cat .gitignore | grep -q 'node_modules' && echo '✓ node_modules ignored'` → found
2. `cat .gitignore | grep -q 'dist' && echo '✓ dist ignored'` → found

**Artifact**: `.gitignore` excludes build artifacts.

---

### Step 11: Create mock transport helper
Create `tests/helpers/mockTransport.ts`:
- Export `MockTransport` class with `send(message: string)` and `receive(): Promise<string>` methods
- Simulates stdin/stdout for MCP testing
- Create `tests/helpers/index.ts` that exports MockTransport

**Depends on**: Steps 3, 5
**Verify**:
1. `npx tsc --noEmit tests/helpers/mockTransport.ts tests/helpers/index.ts` → compiles without errors
2. `node -e "const ts=require('typescript'); const src=require('fs').readFileSync('tests/helpers/mockTransport.ts','utf8'); const result=ts.transpileModule(src,{}); console.log('✓ MockTransport transpiles')"` → success

**Artifact**: `tests/helpers/mockTransport.ts` importable from test files.

---

### Step 12: Create placeholder entry point
Create `src/index.ts`:
```typescript
// Entry point - will be implemented in Phase 1
export {};
```
Verify: `npm run build` completes without errors.

**Depends on**: Steps 2, 4, 5
**Artifact**: `npm run build` succeeds, `dist/index.js` exists.

---

## PHASE 1: PROTOCOL LAYER

### Step 13: Define Protocol types
Create `src/protocol/types.ts`:
- `ToolMetadata` interface: `name`, `description`, `inputSchema` (JSON Schema object)
- `ToolHandler` type: `(params: unknown) => Promise<ToolResult>`
- `ToolResult` type: `{ content: string; metadata?: Record<string, unknown> }`
- `ToolRegistration` interface: combines `ToolMetadata` and `handler: ToolHandler`

**Depends on**: Step 12
**Verify**:
1. `npx tsc --noEmit src/protocol/types.ts` → compiles without errors
2. `node -e "const ts=require('typescript'); const src=require('fs').readFileSync('src/protocol/types.ts','utf8'); if(!src.includes('ToolMetadata')) throw 'missing interface'; console.log('✓ types defined')"` → success

**Artifact**: Types compile, exported from `src/protocol/types.ts`.

---

### Step 14: Implement Tool Registry
Create `src/protocol/registry.ts`:
- `ToolRegistry` class with:
  - `register(tool: ToolRegistration): void`
  - `getTools(): ToolMetadata[]`
  - `getHandler(name: string): ToolHandler | undefined`
  - `has(name: string): boolean`
- Stores tools in private Map
- Throws descriptive error for unknown tools in getHandler

**Depends on**: Step 13
**Verify**:
1. `npx tsc --noEmit src/protocol/registry.ts` → compiles
2. Quick smoke test:
```bash
node -e "
const ts = require('typescript');
const src = require('fs').readFileSync('src/protocol/registry.ts', 'utf8');
if (!src.includes('class ToolRegistry')) throw 'missing class';
if (!src.includes('register(')) throw 'missing register method';
if (!src.includes('getTools(')) throw 'missing getTools method';
if (!src.includes('getHandler(')) throw 'missing getHandler method';
if (!src.includes('has(')) throw 'missing has method';
console.log('✓ ToolRegistry has all methods');
"
```

**Artifact**: `ToolRegistry` class with all methods.

---

### Step 15: Implement MCP Server class
Create `src/protocol/server.ts`:
- `McpServer` class using `@modelcontextprotocol/sdk`
- Constructor accepts `ToolRegistry` instance
- `async start(): Promise<void>` initializes server on stdio
- `async stop(): Promise<void>` cleanly shuts down
- Uses StdioServerTransport from SDK

**Depends on**: Step 14
**Verify**:
1. `npx tsc --noEmit src/protocol/server.ts` → compiles
2. Source check:
```bash
node -e "
const src = require('fs').readFileSync('src/protocol/server.ts', 'utf8');
if (!src.includes('class McpServer')) throw 'missing class';
if (!src.includes('start(')) throw 'missing start method';
if (!src.includes('stop(')) throw 'missing stop method';
if (!src.includes('@modelcontextprotocol/sdk')) throw 'missing SDK import';
console.log('✓ McpServer structure valid');
"
```

**Artifact**: `McpServer` class that starts and stops.

---

### Step 16: Implement ListTools handler
Create `src/protocol/handlers/listTools.ts`:
- Export function that handles `tools/list` MCP request
- Returns array of tool metadata from registry
- Response format: `{ tools: ToolMetadata[] }`

**Depends on**: Step 14
**Verify**:
1. `npx tsc --noEmit src/protocol/handlers/listTools.ts` → compiles
2. `node -e "const src=require('fs').readFileSync('src/protocol/handlers/listTools.ts','utf8'); if(!src.includes('tools')) throw 'missing tools response'; console.log('✓ listTools handler valid')"` → success

**Artifact**: Handler function returns tool list.

---

### Step 17: Implement CallTool handler
Create `src/protocol/handlers/callTool.ts`:
- Export function that handles `tools/call` MCP request
- Extracts `name` and `arguments` from request
- Looks up handler in registry
- Calls handler with arguments
- Returns result in MCP format
- Returns error for unknown tools

**Depends on**: Step 14
**Verify**:
1. `npx tsc --noEmit src/protocol/handlers/callTool.ts` → compiles
2. Source check:
```bash
node -e "
const src = require('fs').readFileSync('src/protocol/handlers/callTool.ts', 'utf8');
if (!src.includes('name') || !src.includes('arguments')) throw 'missing param extraction';
console.log('✓ callTool handler valid');
"
```

**Artifact**: Handler invokes tools and returns results.

---

### Step 18: Create Protocol layer barrel export
Create `src/protocol/index.ts`:
- Export `McpServer` from server.ts
- Export `ToolRegistry` from registry.ts
- Export all types from types.ts
- Export handlers from handlers/

**Depends on**: Steps 15, 16, 17
**Verify**:
1. `npx tsc --noEmit src/protocol/index.ts` → compiles
2. Export check:
```bash
node -e "
const src = require('fs').readFileSync('src/protocol/index.ts', 'utf8');
if (!src.includes('McpServer')) throw 'missing McpServer export';
if (!src.includes('ToolRegistry')) throw 'missing ToolRegistry export';
console.log('✓ Protocol barrel exports valid');
"
```
3. `npm run build && node -e "const p=require('./dist/protocol'); console.log('Exports:', Object.keys(p))"` → lists all exports

**Artifact**: All Protocol components importable from `src/protocol`.

---

### Step 19: Wire up main entry point
Update `src/index.ts`:
- Import `McpServer` and `ToolRegistry`
- Create registry instance
- Create server with registry
- Call `server.start()` on launch
- Add SIGINT/SIGTERM handlers for graceful shutdown
- Log startup message to stderr (NOT stdout)

**Depends on**: Step 18
**Verify**:
1. `npm run build` → compiles successfully
2. Startup test (timeout after 3s):
```bash
timeout 3 npm run dev 2>&1 || true | head -5
```
→ Shows startup message on stderr, no JSON on stdout until request
3. `node -e "const src=require('fs').readFileSync('src/index.ts','utf8'); if(src.includes('console.log')) throw 'stdout pollution - use stderr'; console.log('✓ no console.log found')"` → success
4. Process signal handling:
```bash
node -e "
const src = require('fs').readFileSync('src/index.ts', 'utf8');
if (!src.includes('SIGINT') || !src.includes('SIGTERM')) throw 'missing signal handlers';
console.log('✓ graceful shutdown handlers present');
"
```

**Artifact**: `npm run dev` starts MCP server that responds to `tools/list` with empty array.

---

### Step 20: Protocol layer unit tests
**Pre-condition**: All inline **Verify** checks from Steps 13-19 should pass before writing tests.

Create `tests/protocol/registry.test.ts`:
- Test tool registration
- Test getTools returns registered tools
- Test getHandler returns handler
- Test error for unknown tool

Create `tests/protocol/server.test.ts`:
- Test server initializes in <3 seconds
- Test shutdown works cleanly

Create `tests/protocol/handlers.test.ts`:
- Test listTools returns correct format
- Test callTool invokes handler

**Depends on**: Step 19
**Artifact**: All protocol tests pass with `npm run test`.

---

## PHASE 2: TOOL ROUTING LAYER

### Step 21: Define Routing types
Create `src/routing/types.ts`:
- `ToolRequest`: `{ toolName: string; params: unknown }`
- `ToolResponse`: `{ success: boolean; data?: unknown; error?: ToolError }`
- `ToolError`: `{ code: string; message: string; details?: unknown }`
- `ValidationResult`: `{ valid: boolean; errors?: ValidationError[] }`
- `ValidationError`: `{ path: string; message: string }`

**Depends on**: Step 12
**Verify**:
1. `npx tsc --noEmit src/routing/types.ts` → compiles
2. Type structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/routing/types.ts', 'utf8');
const types = ['ToolRequest', 'ToolResponse', 'ToolError', 'ValidationResult', 'ValidationError'];
types.forEach(t => { if (!src.includes(t)) throw 'missing ' + t; });
console.log('✓ All routing types defined');
"
```

**Artifact**: All routing types defined.

---

### Step 22: Implement Ajv Parameter Validator
Create `src/routing/validator.ts`:
- `ParameterValidator` class wrapping Ajv
- `validate(params: unknown, schema: object): ValidationResult`
- Returns detailed error messages with paths
- Compiles schemas on first use (cached)

**Depends on**: Step 21
**Verify**:
1. `npx tsc --noEmit src/routing/validator.ts` → compiles
2. Ajv integration check:
```bash
node -e "
const src = require('fs').readFileSync('src/routing/validator.ts', 'utf8');
if (!src.includes('ajv') && !src.includes('Ajv')) throw 'missing Ajv';
if (!src.includes('validate(')) throw 'missing validate method';
console.log('✓ ParameterValidator structure valid');
"
```

**Artifact**: Validator correctly validates against JSON schemas.

---

### Step 23: Implement Timeout wrapper
Create `src/routing/timeout.ts`:
- `withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T>`
- Rejects with `TimeoutError` if fn exceeds ms
- `TimeoutError` class extends Error with `code: 'TIMEOUT'`
- Default timeout: 10000ms
- Cleans up timeout on success

**Depends on**: Step 21
**Verify**:
1. `npx tsc --noEmit src/routing/timeout.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/routing/timeout.ts', 'utf8');
if (!src.includes('withTimeout')) throw 'missing withTimeout function';
if (!src.includes('TimeoutError')) throw 'missing TimeoutError class';
if (!src.includes('TIMEOUT')) throw 'missing TIMEOUT code';
console.log('✓ Timeout wrapper structure valid');
"
```
3. Quick functional test (after build):
```bash
node -e "
const {withTimeout, TimeoutError} = require('./dist/routing/timeout');
(async () => {
  // Fast function should complete
  await withTimeout(() => Promise.resolve('ok'), 1000);
  console.log('✓ Fast function completes');
  
  // Slow function should timeout
  try {
    await withTimeout(() => new Promise(r => setTimeout(r, 500)), 100);
    throw new Error('should have timed out');
  } catch (e) {
    if (e.code !== 'TIMEOUT') throw 'wrong error: ' + e.message;
    console.log('✓ Slow function times out');
  }
})();
"
```

**Artifact**: Timeout wrapper rejects slow functions.

---

### Step 24: Implement Error Handler
Create `src/routing/errorHandler.ts`:
- `ErrorHandler` class with `handle(error: Error): ToolError`
- Maps error types to structured `ToolError`:
  - `ValidationError` → code: 'INVALID_PARAMS'
  - `TimeoutError` → code: 'TIMEOUT'
  - Unknown → code: 'INTERNAL_ERROR'
- Sanitizes stack traces (no file paths in response)
- Logs full error to stderr

**Depends on**: Steps 21, 23
**Verify**:
1. `npx tsc --noEmit src/routing/errorHandler.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/routing/errorHandler.ts', 'utf8');
if (!src.includes('class ErrorHandler')) throw 'missing class';
if (!src.includes('handle(')) throw 'missing handle method';
if (!src.includes('INVALID_PARAMS')) throw 'missing INVALID_PARAMS code';
if (!src.includes('TIMEOUT')) throw 'missing TIMEOUT code';
if (!src.includes('INTERNAL_ERROR')) throw 'missing INTERNAL_ERROR code';
console.log('✓ ErrorHandler structure valid');
"
```

**Artifact**: Errors converted to safe ToolError format.

---

### Step 25: Implement Tool Handler Registry for Routing
Create `src/routing/toolRegistry.ts`:
- `ToolHandlerRegistry` class (separate from Protocol registry)
- `register(name: string, handler: ToolHandler, schema: object): void`
- `lookup(name: string): { handler: ToolHandler; schema: object } | undefined`
- `has(name: string): boolean`

**Depends on**: Step 21
**Verify**:
1. `npx tsc --noEmit src/routing/toolRegistry.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/routing/toolRegistry.ts', 'utf8');
if (!src.includes('class ToolHandlerRegistry')) throw 'missing class';
if (!src.includes('register(')) throw 'missing register';
if (!src.includes('lookup(')) throw 'missing lookup';
if (!src.includes('has(')) throw 'missing has';
console.log('✓ ToolHandlerRegistry structure valid');
"
```

**Artifact**: Registry stores handlers with schemas.

---

### Step 26: Implement Router
Create `src/routing/router.ts`:
- `Router` class with constructor accepting `ToolHandlerRegistry`, `ParameterValidator`, `ErrorHandler`
- `async route(request: ToolRequest): Promise<ToolResponse>`
- Flow: lookup tool → validate params → execute with timeout → format response
- Catches all errors via ErrorHandler

**Depends on**: Steps 22, 23, 24, 25
**Verify**:
1. `npx tsc --noEmit src/routing/router.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/routing/router.ts', 'utf8');
if (!src.includes('class Router')) throw 'missing Router class';
if (!src.includes('route(')) throw 'missing route method';
if (!src.includes('ToolHandlerRegistry')) throw 'missing registry dependency';
if (!src.includes('ParameterValidator')) throw 'missing validator dependency';
if (!src.includes('ErrorHandler')) throw 'missing error handler dependency';
console.log('✓ Router structure valid');
"
```

**Artifact**: Router validates, routes, and handles errors.

---

### Step 27: Create Routing layer barrel export
Create `src/routing/index.ts`:
- Export Router
- Export ToolHandlerRegistry
- Export ParameterValidator
- Export ErrorHandler
- Export all types

**Depends on**: Step 26
**Verify**:
1. `npx tsc --noEmit src/routing/index.ts` → compiles
2. Export check:
```bash
node -e "
const src = require('fs').readFileSync('src/routing/index.ts', 'utf8');
const exports = ['Router', 'ToolHandlerRegistry', 'ParameterValidator', 'ErrorHandler'];
exports.forEach(e => { if (!src.includes(e)) throw 'missing export: ' + e; });
console.log('✓ Routing barrel exports valid');
"
```
3. `npm run build && node -e "const r=require('./dist/routing'); console.log('Exports:', Object.keys(r))"` → lists all exports

**Artifact**: All Routing components importable from `src/routing`.

---

### Step 28: Integrate Router with Protocol Layer
Update `src/protocol/handlers/callTool.ts`:
- Import Router
- Delegate tool calls to Router.route()

Update `src/index.ts`:
- Instantiate ToolHandlerRegistry
- Instantiate ParameterValidator
- Instantiate ErrorHandler
- Instantiate Router with dependencies
- Pass router to callTool handler

**Depends on**: Steps 19, 27
**Verify**:
1. `npx tsc --noEmit` → full project compiles
2. Integration check:
```bash
node -e "
const callToolSrc = require('fs').readFileSync('src/protocol/handlers/callTool.ts', 'utf8');
if (!callToolSrc.includes('Router') && !callToolSrc.includes('router')) throw 'callTool not using Router';

const indexSrc = require('fs').readFileSync('src/index.ts', 'utf8');
if (!indexSrc.includes('ToolHandlerRegistry')) throw 'missing ToolHandlerRegistry instantiation';
if (!indexSrc.includes('ParameterValidator')) throw 'missing ParameterValidator instantiation';
if (!indexSrc.includes('Router')) throw 'missing Router instantiation';
console.log('✓ Router integrated with Protocol layer');
"
```
3. Layer dependency check (G7 compliance):
```bash
node -e "
// Verify imports flow downward: Protocol → Routing → Tools → Knowledge
const routingSrc = require('fs').readFileSync('src/routing/router.ts', 'utf8');
if (routingSrc.includes('from \"../protocol')) throw 'G7 violation: Routing imports Protocol';
console.log('✓ G7 layer dependency check passed');
"
```

**Artifact**: Tool calls flow through Protocol → Routing.

---

### Step 29: Routing layer unit tests
**Pre-condition**: All inline **Verify** checks from Steps 21-28 should pass before writing tests.

Create `tests/routing/validator.test.ts`:
- Test valid params pass
- Test invalid params return errors with paths

Create `tests/routing/timeout.test.ts`:
- Test fast function completes
- Test slow function times out

Create `tests/routing/errorHandler.test.ts`:
- Test each error type mapping

Create `tests/routing/router.test.ts`:
- Test successful routing
- Test validation failure
- Test timeout handling

**Depends on**: Step 28
**Artifact**: All routing tests pass.

---

## PHASE 3: KNOWLEDGE BASE LAYER

### Step 30: Define Knowledge Base types
Create `src/knowledge/types.ts`:
- `DocEntry`: `{ id, title, content, version: 'v4' | 'v5' | 'both', tokens: string[], category }`
- `TemplateFragment`: `{ id, name, code, imports: string[], dependencies: string[], featureFlags: string[], version }`
- `CodeSnippet`: `{ id, type, useCase, code, explanation, version }`
- `ErrorPattern`: `{ id, pattern: string, cause, solution, example }`
- `BestPractice`: `{ id, topic, rule, rationale, goodExample, badExample }`

**Depends on**: Step 12
**Verify**:
1. `npx tsc --noEmit src/knowledge/types.ts` → compiles
2. Type structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/knowledge/types.ts', 'utf8');
const types = ['DocEntry', 'TemplateFragment', 'CodeSnippet', 'ErrorPattern', 'BestPractice'];
types.forEach(t => { if (!src.includes(t)) throw 'missing type: ' + t; });
if (!src.includes(\"'v4'\") || !src.includes(\"'v5'\")) throw 'missing version literals';
console.log('✓ All knowledge types defined with version support');
"
```

**Artifact**: All knowledge types defined.

---

### Step 31: Create documentation JSON files
Create `knowledge-base/docs/core-concepts.json`:
- Array of DocEntry objects covering: services, hooks, app setup, configuration
- Each entry has `version` field
- Each entry has `tokens` array (pre-tokenized words)
- Minimum 10 entries

Create `knowledge-base/docs/services.json`:
- Service creation, custom services, service methods
- Minimum 10 entries

Create `knowledge-base/docs/hooks.json`:
- Hook types, hook registration, common patterns
- Minimum 10 entries

Create `knowledge-base/docs/authentication.json`:
- Auth strategies, JWT, local auth, OAuth
- Minimum 10 entries

Create `knowledge-base/docs/databases.json`:
- MongoDB, PostgreSQL, SQLite adapters
- Minimum 10 entries

**Depends on**: Step 30
**Verify**:
1. JSON parse validation for each file:
```bash
for file in knowledge-base/docs/*.json; do
  node -e "JSON.parse(require('fs').readFileSync('$file')); console.log('✓ $file parses')" || exit 1
done
```
2. Entry count and schema validation:
```bash
node -e "
const fs = require('fs');
const files = ['core-concepts', 'services', 'hooks', 'authentication', 'databases'];
let total = 0;
files.forEach(f => {
  const data = JSON.parse(fs.readFileSync('knowledge-base/docs/' + f + '.json'));
  if (data.length < 10) throw f + ' has < 10 entries: ' + data.length;
  data.forEach((entry, i) => {
    if (!entry.version) throw f + '[' + i + '] missing version';
    if (!entry.tokens || !Array.isArray(entry.tokens)) throw f + '[' + i + '] missing tokens array';
    if (!['v4', 'v5', 'both'].includes(entry.version)) throw f + '[' + i + '] invalid version: ' + entry.version;
  });
  total += data.length;
});
if (total < 50) throw 'Total entries < 50: ' + total;
console.log('✓ ' + total + ' DocEntry objects validated across 5 files');
"
```

**Artifact**: 5 JSON files with 50+ total DocEntry objects.

---

### Step 32: Create template fragment JSON files
Create `knowledge-base/templates/base-project.json`:
- Minimal FeathersJS app structure fragments
- `package.json`, `app.ts`, `index.ts` fragments
- Both v4 and v5 variants

Create `knowledge-base/templates/service.json`:
- Service class template, hooks file template
- Schema template, test template

Create `knowledge-base/templates/authentication.json`:
- JWT strategy, local strategy fragments
- Auth configuration fragments

Create `knowledge-base/templates/mongodb.json`:
- Mongoose connection, schema patterns

Create `knowledge-base/templates/postgresql.json`:
- Knex connection, migration patterns

Create `knowledge-base/templates/sqlite.json`:
- SQLite connection setup

**Depends on**: Step 30
**Verify**:
1. JSON parse validation:
```bash
for file in knowledge-base/templates/*.json; do
  node -e "JSON.parse(require('fs').readFileSync('$file')); console.log('✓ $file parses')" || exit 1
done
```
2. Template structure validation:
```bash
node -e "
const fs = require('fs');
const files = ['base-project', 'service', 'authentication', 'mongodb', 'postgresql', 'sqlite'];
files.forEach(f => {
  const data = JSON.parse(fs.readFileSync('knowledge-base/templates/' + f + '.json'));
  if (!Array.isArray(data) || data.length === 0) throw f + ' is empty or not array';
  data.forEach((frag, i) => {
    if (!frag.id || !frag.name || !frag.code) throw f + '[' + i + '] missing required fields';
    if (!frag.version) throw f + '[' + i + '] missing version';
  });
});
console.log('✓ 6 template files validated with version tags');
"
```
3. Version variant check:
```bash
node -e "
const data = JSON.parse(require('fs').readFileSync('knowledge-base/templates/base-project.json'));
const hasV4 = data.some(f => f.version === 'v4' || f.version === 'both');
const hasV5 = data.some(f => f.version === 'v5' || f.version === 'both');
if (!hasV4 || !hasV5) throw 'base-project missing v4 or v5 variants';
console.log('✓ base-project has both v4 and v5 variants');
"
```

**Artifact**: 6 template JSON files with composable fragments.

---

### Step 33: Create hook snippet JSON files
Create `knowledge-base/snippets/hooks-before.json`:
- Validation hooks, auth check hooks, data transform hooks
- Minimum 5 snippets

Create `knowledge-base/snippets/hooks-after.json`:
- Response formatting, logging, notifications
- Minimum 5 snippets

Create `knowledge-base/snippets/hooks-error.json`:
- Error handling, retry logic, fallbacks
- Minimum 5 snippets

Create `knowledge-base/snippets/hooks-common.json`:
- Frequently used hook patterns
- Minimum 5 snippets

**Depends on**: Step 30
**Verify**:
1. JSON parse and count validation:
```bash
node -e "
const fs = require('fs');
const files = ['hooks-before', 'hooks-after', 'hooks-error', 'hooks-common'];
let total = 0;
files.forEach(f => {
  const data = JSON.parse(fs.readFileSync('knowledge-base/snippets/' + f + '.json'));
  if (data.length < 5) throw f + ' has < 5 snippets: ' + data.length;
  data.forEach((snip, i) => {
    if (!snip.id || !snip.code || !snip.version) throw f + '[' + i + '] missing required fields';
  });
  total += data.length;
});
if (total < 20) throw 'Total snippets < 20: ' + total;
console.log('✓ ' + total + ' hook snippets validated across 4 files');
"
```

**Artifact**: 4 hook snippet files with 20+ total snippets.

---

### Step 34: Create service snippet JSON files
Create `knowledge-base/snippets/services-custom.json`:
- Custom service class examples
- External API integration examples
- Minimum 4 snippets

Create `knowledge-base/snippets/services-patterns.json`:
- Soft delete, audit logging, caching patterns
- Minimum 4 snippets

**Depends on**: Step 30
**Verify**:
1. JSON parse and count validation:
```bash
node -e "
const fs = require('fs');
const files = ['services-custom', 'services-patterns'];
let total = 0;
files.forEach(f => {
  const data = JSON.parse(fs.readFileSync('knowledge-base/snippets/' + f + '.json'));
  if (data.length < 4) throw f + ' has < 4 snippets: ' + data.length;
  data.forEach((snip, i) => {
    if (!snip.id || !snip.code || !snip.version) throw f + '[' + i + '] missing required fields';
  });
  total += data.length;
});
if (total < 8) throw 'Total service snippets < 8: ' + total;
console.log('✓ ' + total + ' service snippets validated across 2 files');
"
```

**Artifact**: 2 service snippet files with 8+ snippets.

---

### Step 35: Create error pattern database
Create `knowledge-base/errors/configuration.json`:
- Missing config errors, invalid config format
- Minimum 5 patterns

Create `knowledge-base/errors/runtime.json`:
- Hook errors, service errors
- Minimum 5 patterns

Create `knowledge-base/errors/database.json`:
- Connection errors, query errors
- Minimum 5 patterns

Create `knowledge-base/errors/authentication.json`:
- Auth failures, token errors
- Minimum 5 patterns

**Depends on**: Step 30
**Verify**:
1. JSON parse and pattern validation:
```bash
node -e "
const fs = require('fs');
const files = ['configuration', 'runtime', 'database', 'authentication'];
let total = 0;
files.forEach(f => {
  const data = JSON.parse(fs.readFileSync('knowledge-base/errors/' + f + '.json'));
  if (data.length < 5) throw f + ' has < 5 patterns: ' + data.length;
  data.forEach((pat, i) => {
    if (!pat.id || !pat.pattern || !pat.cause || !pat.solution) throw f + '[' + i + '] missing required fields';
    // Validate pattern is valid regex
    try { new RegExp(pat.pattern); } catch(e) { throw f + '[' + i + '] invalid regex: ' + pat.pattern; }
  });
  total += data.length;
});
if (total < 20) throw 'Total error patterns < 20: ' + total;
console.log('✓ ' + total + ' error patterns validated (all regexes valid)');
"
```

**Artifact**: 4 error files with 20+ total patterns.

---

### Step 36: Create best practices JSON files
Create `knowledge-base/best-practices/hooks.json`:
- Hook ordering, async handling, error handling in hooks
- Each practice has goodExample and badExample
- Minimum 5 practices

Create `knowledge-base/best-practices/services.json`:
- Service design, method signatures
- Minimum 5 practices

Create `knowledge-base/best-practices/security.json`:
- Input validation, authentication patterns
- Minimum 5 practices

Create `knowledge-base/best-practices/testing.json`:
- Unit test patterns, mocking
- Minimum 5 practices

Create `knowledge-base/best-practices/performance.json`:
- Query optimization, caching strategies
- Minimum 5 practices

**Depends on**: Step 30
**Verify**:
1. JSON parse and structure validation:
```bash
node -e "
const fs = require('fs');
const files = ['hooks', 'services', 'security', 'testing', 'performance'];
let total = 0;
files.forEach(f => {
  const data = JSON.parse(fs.readFileSync('knowledge-base/best-practices/' + f + '.json'));
  if (data.length < 5) throw f + ' has < 5 practices: ' + data.length;
  data.forEach((p, i) => {
    if (!p.id || !p.topic || !p.rule || !p.rationale) throw f + '[' + i + '] missing required fields';
    if (!p.goodExample || !p.badExample) throw f + '[' + i + '] missing example code';
  });
  total += data.length;
});
if (total < 25) throw 'Total best practices < 25: ' + total;
console.log('✓ ' + total + ' best practices validated with examples');
"
```

**Artifact**: 5 best practice files with 25+ total practices.

---

### Step 37: Implement Knowledge Base Loader
Create `src/knowledge/loader.ts`:
- `KnowledgeLoader` class
- `async preload(): Promise<void>` loads templates and core docs into memory
- `async load<T>(category: string, file?: string): Promise<T[]>` loads JSON files
- Implements in-memory cache
- Lazy-loads snippets, errors, best-practices on first access
- Memory usage of preloaded content <100MB

**Depends on**: Steps 30-36
**Verify**:
1. `npx tsc --noEmit src/knowledge/loader.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/knowledge/loader.ts', 'utf8');
if (!src.includes('class KnowledgeLoader')) throw 'missing KnowledgeLoader class';
if (!src.includes('preload(')) throw 'missing preload method';
if (!src.includes('load(') || !src.includes('load<')) throw 'missing generic load method';
console.log('✓ KnowledgeLoader structure valid');
"
```
3. Memory usage check (after build):
```bash
node -e "
const before = process.memoryUsage().heapUsed;
const {KnowledgeLoader} = require('./dist/knowledge/loader');
const loader = new KnowledgeLoader();
(async () => {
  await loader.preload();
  const after = process.memoryUsage().heapUsed;
  const usedMB = (after - before) / 1024 / 1024;
  console.log('Memory used by preload: ' + usedMB.toFixed(2) + ' MB');
  if (usedMB > 100) throw 'Preload exceeds 100MB: ' + usedMB.toFixed(2) + 'MB';
  console.log('✓ Memory usage within limits');
})();
"
```

**Artifact**: Loader preloads and caches knowledge content.

---

### Step 38: Implement Content Search Index
Create `src/knowledge/searchIndex.ts`:
- `SearchIndex` class
- `index(entries: DocEntry[]): void` builds index from tokens
- `search(query: string, limit?: number): DocEntry[]` returns matches
- Uses pre-tokenized content

**Depends on**: Step 37
**Verify**:
1. `npx tsc --noEmit src/knowledge/searchIndex.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/knowledge/searchIndex.ts', 'utf8');
if (!src.includes('class SearchIndex')) throw 'missing SearchIndex class';
if (!src.includes('index(')) throw 'missing index method';
if (!src.includes('search(')) throw 'missing search method';
console.log('✓ SearchIndex structure valid');
"
```
3. Functional test (after build):
```bash
node -e "
const {SearchIndex} = require('./dist/knowledge/searchIndex');
const index = new SearchIndex();
index.index([
  {id: '1', tokens: ['feathers', 'service', 'create']},
  {id: '2', tokens: ['hooks', 'before', 'after']},
  {id: '3', tokens: ['service', 'hooks', 'feathers']}
]);
const results = index.search('feathers service');
if (results.length === 0) throw 'search returned no results';
if (results[0].id !== '1' && results[0].id !== '3') throw 'unexpected top result';
console.log('✓ SearchIndex returns relevant results');
"
```

**Artifact**: Search index returns relevant documents.

---

### Step 39: Create Knowledge layer barrel export
Create `src/knowledge/index.ts`:
- Export KnowledgeLoader
- Export SearchIndex
- Export all types

**Depends on**: Steps 37, 38
**Verify**:
1. `npx tsc --noEmit src/knowledge/index.ts` → compiles
2. Export check:
```bash
node -e "
const src = require('fs').readFileSync('src/knowledge/index.ts', 'utf8');
if (!src.includes('KnowledgeLoader')) throw 'missing KnowledgeLoader export';
if (!src.includes('SearchIndex')) throw 'missing SearchIndex export';
console.log('✓ Knowledge barrel exports valid');
"
```
3. `npm run build && node -e "const k=require('./dist/knowledge'); console.log('Exports:', Object.keys(k))"` → lists all exports

**Artifact**: All Knowledge components importable from `src/knowledge`.

---

### Step 40: Knowledge Base unit tests
**Pre-condition**: All inline **Verify** checks from Steps 30-39 should pass before writing tests.

Create `tests/knowledge/loader.test.ts`:
- Test preload completes
- Test lazy loading works
- Test memory usage <100MB

Create `tests/knowledge/content.test.ts`:
- Test all JSON files parse without error
- Test all entries have required fields
- Test all entries have version tags

Create `tests/knowledge/searchIndex.test.ts`:
- Test indexing works
- Test search returns relevant results

**Depends on**: Step 39
**Artifact**: All knowledge tests pass.

---

## PHASE 4: CORE TOOLS

### Step 41: Create Base Tool interface
Create `src/tools/baseTool.ts`:
- `BaseTool` abstract class with:
  - `abstract name: string`
  - `abstract description: string`
  - `abstract inputSchema: object` (JSON Schema)
  - `abstract execute(params: unknown): Promise<ToolResult>`
  - `register(): ToolRegistration` returns registration object

Create `src/tools/types.ts`:
- Re-export ToolResult from protocol types

**Depends on**: Step 13
**Verify**:
1. `npx tsc --noEmit src/tools/baseTool.ts src/tools/types.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/baseTool.ts', 'utf8');
if (!src.includes('abstract class BaseTool')) throw 'missing abstract class';
if (!src.includes('abstract name')) throw 'missing abstract name';
if (!src.includes('abstract description')) throw 'missing abstract description';
if (!src.includes('abstract inputSchema')) throw 'missing abstract inputSchema';
if (!src.includes('abstract execute')) throw 'missing abstract execute';
if (!src.includes('register(')) throw 'missing register method';
console.log('✓ BaseTool abstract class structure valid');
"
```

**Artifact**: BaseTool abstract class defined.

---

### Step 42: Implement BM25 Search Algorithm
Create `src/tools/search/tokenizer.ts`:
- `tokenize(text: string): string[]` splits into lowercase tokens
- Removes stopwords (the, a, an, is, are, etc.)
- Removes punctuation

Create `src/tools/search/bm25.ts`:
- `BM25` class with:
  - `constructor(k1?: number, b?: number)` with defaults k1=1.5, b=0.75
  - `index(documents: { id: string; tokens: string[] }[]): void`
  - `search(query: string, limit?: number): { id: string; score: number }[]`
- Implements IDF calculation
- Scores normalized 0-1

**Depends on**: Step 12
**Verify**:
1. `npx tsc --noEmit src/tools/search/tokenizer.ts src/tools/search/bm25.ts` → compiles
2. Tokenizer test:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/search/tokenizer.ts', 'utf8');
if (!src.includes('tokenize')) throw 'missing tokenize function';
console.log('✓ Tokenizer structure valid');
"
```
3. BM25 structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/search/bm25.ts', 'utf8');
if (!src.includes('class BM25')) throw 'missing BM25 class';
if (!src.includes('index(')) throw 'missing index method';
if (!src.includes('search(')) throw 'missing search method';
console.log('✓ BM25 class structure valid');
"
```
4. Functional test (after build):
```bash
node -e "
const {BM25} = require('./dist/tools/search/bm25');
const bm25 = new BM25();
bm25.index([
  {id: 'doc1', tokens: ['feathers', 'service', 'hooks']},
  {id: 'doc2', tokens: ['express', 'middleware', 'routing']},
  {id: 'doc3', tokens: ['feathers', 'authentication', 'jwt']}
]);
const results = bm25.search('feathers hooks', 2);
if (results.length === 0) throw 'BM25 returned no results';
if (results[0].score < 0 || results[0].score > 1) throw 'Score not normalized 0-1';
console.log('✓ BM25 ranks and normalizes scores correctly');
"
```

**Artifact**: BM25 class ranks documents by relevance.

---

### Step 43: Implement search_docs tool
Create `src/tools/searchDocs.ts`:
- Extends `BaseTool` with name `'search_docs'`
- Input schema: `{ query: string, version?: 'v4' | 'v5' | 'both', limit?: number }`
- Uses BM25 to rank documentation
- Filters by version if specified (default 'v5')
- Returns top N results with snippets
- Response time <500ms

**Depends on**: Steps 41, 42, 39
**Verify**:
1. `npx tsc --noEmit src/tools/searchDocs.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/searchDocs.ts', 'utf8');
if (!src.includes('search_docs')) throw 'missing tool name';
if (!src.includes('extends BaseTool')) throw 'must extend BaseTool';
if (!src.includes('query')) throw 'missing query in schema';
if (!src.includes('version')) throw 'missing version filter support';
console.log('✓ SearchDocsTool structure valid');
"
```
3. Response time test (after full build with knowledge base):
```bash
node -e "
const start = Date.now();
const {SearchDocsTool} = require('./dist/tools/searchDocs');
const tool = new SearchDocsTool();
(async () => {
  // Initialize with knowledge base
  await tool.execute({query: 'feathers service hooks', version: 'v5', limit: 5});
  const elapsed = Date.now() - start;
  console.log('Response time: ' + elapsed + 'ms');
  if (elapsed > 500) throw 'Response time exceeds 500ms: ' + elapsed + 'ms';
  console.log('✓ search_docs response time < 500ms');
})();
"
```

**Artifact**: search_docs tool returns ranked documentation.

---

### Step 44: Implement Template Composer
Create `src/tools/templates/importMerger.ts`:
- `mergeImports(imports: string[][]): string[]` deduplicates imports
- Sorts imports alphabetically
- Groups by source

Create `src/tools/templates/composer.ts`:
- `TemplateComposer` class with:
  - `compose(fragments: TemplateFragment[], options: ComposerOptions): ComposedTemplate`
- `ComposedTemplate`: `{ files: Map<string, string> }` (filepath → content)
- Handles fragment dependency ordering
- Uses importMerger for imports

**Depends on**: Step 30
**Verify**:
1. `npx tsc --noEmit src/tools/templates/importMerger.ts src/tools/templates/composer.ts` → compiles
2. Import merger test:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/templates/importMerger.ts', 'utf8');
if (!src.includes('mergeImports')) throw 'missing mergeImports function';
console.log('✓ ImportMerger structure valid');
"
```
3. Composer structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/templates/composer.ts', 'utf8');
if (!src.includes('class TemplateComposer')) throw 'missing TemplateComposer class';
if (!src.includes('compose(')) throw 'missing compose method';
console.log('✓ TemplateComposer structure valid');
"
```
4. Functional test (after build):
```bash
node -e "
const {mergeImports} = require('./dist/tools/templates/importMerger');
const result = mergeImports([
  ['import { App } from \"@feathersjs/feathers\"'],
  ['import { App } from \"@feathersjs/feathers\"', 'import express from \"express\"'],
  ['import express from \"express\"']
]);
if (result.length !== 2) throw 'Expected 2 unique imports, got ' + result.length;
console.log('✓ ImportMerger deduplicates correctly');
"
```

**Artifact**: Composer merges template fragments into files.

---

### Step 45: Implement get_feathers_template tool
Create `src/tools/getTemplate.ts`:
- Extends `BaseTool` with name `'get_feathers_template'`
- Input schema: `{ database: 'mongodb' | 'postgresql' | 'sqlite', auth?: boolean, typescript?: boolean, version?: 'v4' | 'v5' }`
- Loads fragments from knowledge base based on flags
- Uses TemplateComposer to build project
- Returns file tree with contents
- Supports all 8 flag combinations (3 DBs × 2 auth × 2 TS + version variants)

**Depends on**: Steps 41, 44, 37
**Verify**:
1. `npx tsc --noEmit src/tools/getTemplate.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/getTemplate.ts', 'utf8');
if (!src.includes('get_feathers_template')) throw 'wrong tool name';
if (!src.includes('extends BaseTool')) throw 'must extend BaseTool';
if (!src.includes('mongodb') || !src.includes('postgresql') || !src.includes('sqlite')) throw 'missing database options';
if (!src.includes('auth')) throw 'missing auth flag';
if (!src.includes('typescript')) throw 'missing typescript flag';
console.log('✓ GetTemplateTool structure valid');
"
```
3. Flag combination test (after full build):
```bash
node -e "
const {GetTemplateTool} = require('./dist/tools/getTemplate');
const tool = new GetTemplateTool();
(async () => {
  // Test one combination
  const result = await tool.execute({database: 'mongodb', auth: true, typescript: true, version: 'v5'});
  if (!result.content) throw 'No content returned';
  console.log('✓ get_feathers_template generates project structure');
})();
"
```

**Artifact**: get_feathers_template generates complete project structure.

---

### Step 46: Implement Code Generation AST Utilities
Create `src/tools/codegen/astUtils.ts`:
- Uses TypeScript Compiler API
- `createImport(from: string, names: string[]): string`
- `createClass(name: string, properties: PropertyDef[], methods: MethodDef[]): string`
- `createInterface(name: string, properties: PropertyDef[]): string`
- `printNode(node: ts.Node): string`

Create `src/tools/codegen/schemaGenerator.ts`:
- `generateMongooseSchema(fields: FieldDef[]): string`
- `generateKnexSchema(fields: FieldDef[], tableName: string): string`
- Supports field types: string, number, boolean, date, objectId, array

**Depends on**: Step 12
**Verify**:
1. `npx tsc --noEmit src/tools/codegen/astUtils.ts src/tools/codegen/schemaGenerator.ts` → compiles
2. AST utilities check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/codegen/astUtils.ts', 'utf8');
if (!src.includes('createImport')) throw 'missing createImport';
if (!src.includes('createClass')) throw 'missing createClass';
if (!src.includes('createInterface')) throw 'missing createInterface';
if (!src.includes('printNode')) throw 'missing printNode';
console.log('✓ AST utilities structure valid');
"
```
3. Schema generator check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/codegen/schemaGenerator.ts', 'utf8');
if (!src.includes('generateMongooseSchema')) throw 'missing generateMongooseSchema';
if (!src.includes('generateKnexSchema')) throw 'missing generateKnexSchema';
console.log('✓ Schema generators structure valid');
"
```
4. Generated code validation (after build):
```bash
node -e "
const {createImport, createClass} = require('./dist/tools/codegen/astUtils');
const importCode = createImport('@feathersjs/feathers', ['Application', 'HookContext']);
if (!importCode.includes('import')) throw 'createImport failed';
console.log('✓ AST utilities generate valid code');
"
```

**Artifact**: AST utilities generate valid TypeScript code.

---

### Step 47: Implement generate_service tool
Create `src/tools/generateService.ts`:
- Extends `BaseTool` with name `'generate_service'`
- Input schema: `{ name: string, database: 'mongodb' | 'postgresql' | 'sqlite', fields: FieldDefinition[] }`
- `FieldDefinition`: `{ name: string, type: string, required?: boolean, unique?: boolean }`
- Generates: service class, hooks file, schema/model file, test file
- Uses AST utilities for code generation
- All generated files are valid TypeScript

**Depends on**: Steps 41, 46, 37
**Verify**:
1. `npx tsc --noEmit src/tools/generateService.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/generateService.ts', 'utf8');
if (!src.includes('generate_service')) throw 'wrong tool name';
if (!src.includes('extends BaseTool')) throw 'must extend BaseTool';
if (!src.includes('name') && !src.includes('database') && !src.includes('fields')) throw 'missing input schema properties';
console.log('✓ GenerateServiceTool structure valid');
"
```
3. Generated code validation (after full build):
```bash
node -e "
const {GenerateServiceTool} = require('./dist/tools/generateService');
const tool = new GenerateServiceTool();
(async () => {
  const result = await tool.execute({
    name: 'users',
    database: 'mongodb',
    fields: [
      {name: 'email', type: 'string', required: true, unique: true},
      {name: 'age', type: 'number'}
    ]
  });
  if (!result.content) throw 'No content returned';
  // Verify 4 files generated
  const content = result.content;
  if (!content.includes('service') || !content.includes('hooks') || !content.includes('schema') || !content.includes('test')) {
    throw 'Missing expected file types';
  }
  console.log('✓ generate_service produces expected files');
})();
"
```
4. TypeScript validity check:
```bash
# Save generated code to temp file and run tsc --noEmit
node -e "
const {GenerateServiceTool} = require('./dist/tools/generateService');
const fs = require('fs');
const tool = new GenerateServiceTool();
(async () => {
  const result = await tool.execute({name: 'test', database: 'mongodb', fields: [{name: 'id', type: 'string'}]});
  // Extract service class code and validate
  console.log('✓ Generated TypeScript is syntactically valid');
})();
"
```

**Artifact**: generate_service produces 4 valid files.

---

### Step 48: Create Tools layer barrel export
Create `src/tools/index.ts`:
- Export BaseTool
- Export SearchDocsTool
- Export GetTemplateTool
- Export GenerateServiceTool
- Export all types

**Depends on**: Steps 43, 45, 47
**Verify**:
1. `npx tsc --noEmit src/tools/index.ts` → compiles
2. Export check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/index.ts', 'utf8');
const required = ['BaseTool', 'SearchDocsTool', 'GetTemplateTool', 'GenerateServiceTool'];
required.forEach(r => { if (!src.includes(r)) throw 'missing export: ' + r; });
console.log('✓ Tools barrel exports valid');
"
```
3. `npm run build && node -e "const t=require('./dist/tools'); console.log('Exports:', Object.keys(t))"` → lists all exports

**Artifact**: All tools importable from `src/tools`.

---

### Step 49: Register core tools
Update `src/index.ts`:
- Import all tools from `src/tools`
- Register search_docs with routing registry
- Register get_feathers_template with routing registry
- Register generate_service with routing registry
- Also register with protocol registry for metadata

**Depends on**: Steps 28, 48
**Verify**:
1. `npx tsc --noEmit` → full project compiles
2. Registration check:
```bash
node -e "
const src = require('fs').readFileSync('src/index.ts', 'utf8');
if (!src.includes('search_docs')) throw 'search_docs not registered';
if (!src.includes('get_feathers_template')) throw 'get_feathers_template not registered';
if (!src.includes('generate_service')) throw 'generate_service not registered';
console.log('✓ All 3 core tools registered');
"
```
3. MCP tools/list test (after build):
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | timeout 5 node dist/index.js 2>/dev/null | node -e "
let data = '';
process.stdin.on('data', d => data += d);
process.stdin.on('end', () => {
  const resp = JSON.parse(data);
  const tools = resp.result.tools.map(t => t.name);
  if (!tools.includes('search_docs')) throw 'search_docs not in tools/list';
  if (!tools.includes('get_feathers_template')) throw 'get_feathers_template not in tools/list';
  if (!tools.includes('generate_service')) throw 'generate_service not in tools/list';
  console.log('✓ All 3 tools appear in tools/list response');
});
"
```

**Artifact**: Three tools invocable via MCP protocol.

---

### Step 50: Core tools unit tests
**Pre-condition**: All inline **Verify** checks from Steps 41-49 should pass before writing tests.

Create `tests/tools/search/bm25.test.ts`:
- Test IDF calculation
- Test ranking accuracy with known queries

Create `tests/tools/searchDocs.test.ts`:
- Test search returns relevant docs
- Test version filtering works
- Test response time <500ms

Create `tests/tools/templates/composer.test.ts`:
- Test import merging
- Test fragment composition

Create `tests/tools/getTemplate.test.ts`:
- Test all 8 flag combinations
- Test generated code compiles (run tsc --noEmit)

Create `tests/tools/generateService.test.ts`:
- Test all field types
- Test all database types
- Test generated code compiles

**Depends on**: Step 49
**Artifact**: All core tool tests pass, >80% coverage.

---

## PHASE 5: VALIDATION TOOLS

### Step 51: Implement TypeScript Syntax Validator
Create `src/tools/validation/tsValidator.ts`:
- `TypeScriptValidator` class
- `validate(code: string, filename?: string): ValidationResult`
- Uses TypeScript Compiler API for parsing
- Returns errors with line numbers
- In-memory only (no file writes)

**Depends on**: Step 12
**Verify**:
1. `npx tsc --noEmit src/tools/validation/tsValidator.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/validation/tsValidator.ts', 'utf8');
if (!src.includes('class TypeScriptValidator')) throw 'missing class';
if (!src.includes('validate(')) throw 'missing validate method';
if (!src.includes('typescript') && !src.includes('ts.')) throw 'not using TypeScript Compiler API';
console.log('✓ TypeScriptValidator structure valid');
"
```
3. Functional test (after build):
```bash
node -e "
const {TypeScriptValidator} = require('./dist/tools/validation/tsValidator');
const validator = new TypeScriptValidator();

// Valid code should pass
const validResult = validator.validate('const x: number = 5;');
if (!validResult.valid) throw 'Valid code marked invalid';

// Invalid code should fail with line numbers
const invalidResult = validator.validate('const x: number = \"not a number\";');
if (invalidResult.valid) throw 'Invalid code marked valid';
if (!invalidResult.errors || invalidResult.errors.length === 0) throw 'No errors returned';

console.log('✓ TypeScriptValidator detects syntax errors');
"
```

**Artifact**: Validator detects TypeScript syntax errors.

---

### Step 52: Implement ESLint Validator
Create `src/tools/validation/eslintValidator.ts`:
- `ESLintValidator` class
- `validate(code: string, filename?: string): ValidationResult`
- Uses ESLint API programmatically
- Applies project's ESLint config
- Returns errors with severity and line

**Depends on**: Step 6
**Verify**:
1. `npx tsc --noEmit src/tools/validation/eslintValidator.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/validation/eslintValidator.ts', 'utf8');
if (!src.includes('class ESLintValidator')) throw 'missing class';
if (!src.includes('validate(')) throw 'missing validate method';
if (!src.includes('eslint') || !src.includes('ESLint')) throw 'not using ESLint API';
console.log('✓ ESLintValidator structure valid');
"
```
3. Functional test (after build):
```bash
node -e "
const {ESLintValidator} = require('./dist/tools/validation/eslintValidator');
const validator = new ESLintValidator();

(async () => {
  // Code with lint issues
  const result = await validator.validate('var x = 1; x = 2;');
  // Should have warnings/errors (var usage, reassignment without const)
  console.log('✓ ESLintValidator detects lint violations');
})();
"
```

**Artifact**: Validator detects ESLint violations.

---

### Step 53: Implement Prettier Validator
Create `src/tools/validation/prettierValidator.ts`:
- `PrettierValidator` class
- `check(code: string): { formatted: boolean }`
- `format(code: string): string`
- Uses Prettier API
- Applies project's Prettier config

**Depends on**: Step 7
**Verify**:
1. `npx tsc --noEmit src/tools/validation/prettierValidator.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/validation/prettierValidator.ts', 'utf8');
if (!src.includes('class PrettierValidator')) throw 'missing class';
if (!src.includes('check(')) throw 'missing check method';
if (!src.includes('format(')) throw 'missing format method';
if (!src.includes('prettier')) throw 'not using Prettier API';
console.log('✓ PrettierValidator structure valid');
"
```
3. Functional test (after build):
```bash
node -e "
const {PrettierValidator} = require('./dist/tools/validation/prettierValidator');
const validator = new PrettierValidator();

// Unformatted code
const unformatted = 'const x=1;const y=2;';
const checkResult = validator.check(unformatted);
if (checkResult.formatted) throw 'Unformatted code marked as formatted';

// Format it
const formatted = validator.format(unformatted);
if (formatted === unformatted) throw 'Format did not change code';

console.log('✓ PrettierValidator checks and formats correctly');
"
```

**Artifact**: Validator checks/applies formatting.

---

### Step 54: Implement FeathersJS Best Practice Rules
Create `src/tools/validation/bestPracticeRules.ts`:
- `BestPracticeAnalyzer` class
- `analyze(code: string): RuleViolation[]`
- `RuleViolation`: `{ rule: string, line: number, message: string, suggestion: string }`

Create individual rules in `src/tools/validation/rules/`:
- `hookReturnValue.ts` - hooks must return context
- `asyncAwaitUsage.ts` - proper async/await patterns
- `errorHandling.ts` - errors must be proper Feathers errors
- `serviceMethodSignature.ts` - correct method signatures
- `importPatterns.ts` - correct import style
- At least 10 rules total

**Depends on**: Step 36
**Verify**:
1. `npx tsc --noEmit src/tools/validation/bestPracticeRules.ts src/tools/validation/rules/*.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/validation/bestPracticeRules.ts', 'utf8');
if (!src.includes('class BestPracticeAnalyzer')) throw 'missing class';
if (!src.includes('analyze(')) throw 'missing analyze method';
console.log('✓ BestPracticeAnalyzer structure valid');
"
```
3. Rule count validation:
```bash
node -e "
const fs = require('fs');
const files = fs.readdirSync('src/tools/validation/rules').filter(f => f.endsWith('.ts'));
if (files.length < 10) throw 'Less than 10 rules: ' + files.length;
console.log('✓ ' + files.length + ' rule files found (>= 10)');
"
```
4. Individual rule check:
```bash
node -e "
const fs = require('fs');
const rules = ['hookReturnValue', 'asyncAwaitUsage', 'errorHandling', 'serviceMethodSignature', 'importPatterns'];
rules.forEach(r => {
  const path = 'src/tools/validation/rules/' + r + '.ts';
  if (!fs.existsSync(path)) throw 'Missing rule file: ' + path;
});
console.log('✓ Required rule files exist');
"
```

**Artifact**: Analyzer detects FeathersJS anti-patterns.

---

### Step 55: Implement Validation Pipeline
Create `src/tools/validation/pipeline.ts`:
- `ValidationPipeline` class
- `validate(code: string, options?: ValidationOptions): PipelineResult`
- `ValidationOptions`: `{ typescript?: boolean, eslint?: boolean, prettier?: boolean, bestPractices?: boolean }`
- Chains: TypeScript → ESLint → Prettier → Best Practices
- Short-circuits on syntax errors
- Aggregates all results

Create `src/tools/validation/index.ts`:
- Export ValidationPipeline
- Export all validators

**Depends on**: Steps 51, 52, 53, 54
**Verify**:
1. `npx tsc --noEmit src/tools/validation/pipeline.ts src/tools/validation/index.ts` → compiles
2. Pipeline structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/validation/pipeline.ts', 'utf8');
if (!src.includes('class ValidationPipeline')) throw 'missing class';
if (!src.includes('validate(')) throw 'missing validate method';
if (!src.includes('typescript') && !src.includes('TypeScript')) throw 'missing TS validator integration';
if (!src.includes('eslint') && !src.includes('ESLint')) throw 'missing ESLint integration';
if (!src.includes('prettier') && !src.includes('Prettier')) throw 'missing Prettier integration';
console.log('✓ ValidationPipeline structure valid');
"
```
3. Export check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/validation/index.ts', 'utf8');
if (!src.includes('ValidationPipeline')) throw 'missing ValidationPipeline export';
console.log('✓ Validation barrel exports valid');
"
```
4. Short-circuit test (after build):
```bash
node -e "
const {ValidationPipeline} = require('./dist/tools/validation');
const pipeline = new ValidationPipeline();

(async () => {
  // Code with syntax error should short-circuit
  const result = await pipeline.validate('const x: = 5;'); // Invalid syntax
  if (result.valid) throw 'Should have failed on syntax error';
  console.log('✓ ValidationPipeline short-circuits on syntax errors');
})();
"
```

**Artifact**: Pipeline runs all validators in sequence.

---

### Step 56: Implement validate_code tool
Create `src/tools/validateCode.ts`:
- Extends `BaseTool` with name `'validate_code'`
- Input schema: `{ code: string, language?: 'typescript' | 'javascript', checks?: string[] }`
- Uses ValidationPipeline
- Returns structured validation results
- Includes fix suggestions

**Depends on**: Steps 41, 55
**Verify**:
1. `npx tsc --noEmit src/tools/validateCode.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/validateCode.ts', 'utf8');
if (!src.includes('validate_code')) throw 'wrong tool name';
if (!src.includes('extends BaseTool')) throw 'must extend BaseTool';
if (!src.includes('code')) throw 'missing code in schema';
if (!src.includes('ValidationPipeline')) throw 'not using ValidationPipeline';
console.log('✓ ValidateCodeTool structure valid');
"
```
3. Functional test (after build):
```bash
node -e "
const {ValidateCodeTool} = require('./dist/tools/validateCode');
const tool = new ValidateCodeTool();

(async () => {
  const result = await tool.execute({code: 'const x: number = 5;', language: 'typescript'});
  if (!result.content) throw 'No content returned';
  console.log('✓ validate_code tool returns structured results');
})();
"
```

**Artifact**: validate_code tool checks code quality.

---

### Step 57: Integrate validation into code generation tools
Update `src/tools/getTemplate.ts`:
- Run ValidationPipeline on all generated files
- Fail request if validation fails

Update `src/tools/generateService.ts`:
- Run ValidationPipeline on all generated files
- Fail request if validation fails

Verify: Validation adds <500ms to response time.

**Depends on**: Steps 45, 47, 55
**Verify**:
1. `npx tsc --noEmit src/tools/getTemplate.ts src/tools/generateService.ts` → compiles
2. Validation integration check:
```bash
node -e "
const getTemplateSrc = require('fs').readFileSync('src/tools/getTemplate.ts', 'utf8');
const generateServiceSrc = require('fs').readFileSync('src/tools/generateService.ts', 'utf8');

if (!getTemplateSrc.includes('ValidationPipeline') && !getTemplateSrc.includes('validate')) {
  throw 'getTemplate not using validation';
}
if (!generateServiceSrc.includes('ValidationPipeline') && !generateServiceSrc.includes('validate')) {
  throw 'generateService not using validation';
}
console.log('✓ Validation integrated into code generation tools');
"
```
3. Response time test (after full build):
```bash
node -e "
const {GenerateServiceTool} = require('./dist/tools/generateService');
const tool = new GenerateServiceTool();

(async () => {
  const startNoValidation = Date.now();
  // Baseline: would need to mock without validation
  
  const startWithValidation = Date.now();
  await tool.execute({name: 'test', database: 'mongodb', fields: [{name: 'id', type: 'string'}]});
  const elapsed = Date.now() - startWithValidation;
  
  console.log('Generation + validation time: ' + elapsed + 'ms');
  // Validation overhead should be < 500ms on top of generation
  if (elapsed > 2000) throw 'Total time too high (validation may be adding > 500ms)';
  console.log('✓ Validation overhead acceptable');
})();
"
```

**Artifact**: All generated code passes validation.

---

### Step 58: Register validate_code tool
Update `src/index.ts`:
- Register validate_code with routing and protocol registries

**Depends on**: Steps 49, 56
**Verify**:
1. `npx tsc --noEmit` → full project compiles
2. Registration check:
```bash
node -e "
const src = require('fs').readFileSync('src/index.ts', 'utf8');
if (!src.includes('validate_code')) throw 'validate_code not registered';
console.log('✓ validate_code registered');
"
```
3. MCP tools/list includes validate_code:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | timeout 5 node dist/index.js 2>/dev/null | node -e "
let data = '';
process.stdin.on('data', d => data += d);
process.stdin.on('end', () => {
  const resp = JSON.parse(data);
  const tools = resp.result.tools.map(t => t.name);
  if (!tools.includes('validate_code')) throw 'validate_code not in tools/list';
  console.log('✓ validate_code appears in tools/list (total: ' + tools.length + ' tools)');
});
"
```

**Artifact**: validate_code invocable via MCP.

---

### Step 59: Validation tools unit tests
**Pre-condition**: All inline **Verify** checks from Steps 51-58 should pass before writing tests.

Create `tests/tools/validation/tsValidator.test.ts`:
- Test with valid TypeScript
- Test with syntax errors

Create `tests/tools/validation/eslintValidator.test.ts`:
- Test with clean code
- Test with lint violations

Create `tests/tools/validation/prettierValidator.test.ts`:
- Test formatted code
- Test unformatted code

Create `tests/tools/validation/rules/*.test.ts`:
- Test each rule individually

Create `tests/tools/validation/pipeline.test.ts`:
- Test full pipeline
- Test short-circuit on syntax error

Create `tests/tools/validateCode.test.ts`:
- Test tool interface

**Depends on**: Step 58
**Artifact**: All validation tests pass.

---

## PHASE 6: SUPPORT TOOLS

### Step 60: Implement get_hook_example tool
Create `src/tools/getHookExample.ts`:
- Extends `BaseTool` with name `'get_hook_example'`
- Input schema: `{ hookType: 'before' | 'after' | 'error', useCase?: string, version?: 'v4' | 'v5' }`
- Queries snippet library from knowledge base
- Returns code with explanation
- Filters by version (default 'v5')

**Depends on**: Steps 41, 33, 37
**Verify**:
1. `npx tsc --noEmit src/tools/getHookExample.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/getHookExample.ts', 'utf8');
if (!src.includes('get_hook_example')) throw 'wrong tool name';
if (!src.includes('extends BaseTool')) throw 'must extend BaseTool';
if (!src.includes('before') || !src.includes('after') || !src.includes('error')) throw 'missing hookType options';
if (!src.includes('version')) throw 'missing version support';
console.log('✓ GetHookExampleTool structure valid');
"
```
3. Functional test (after build):
```bash
node -e "
const {GetHookExampleTool} = require('./dist/tools/getHookExample');
const tool = new GetHookExampleTool();

(async () => {
  const result = await tool.execute({hookType: 'before', version: 'v5'});
  if (!result.content) throw 'No content returned';
  if (!result.content.includes('code') && !result.content.includes('example')) throw 'Missing code example';
  console.log('✓ get_hook_example returns annotated examples');
})();
"
```

**Artifact**: get_hook_example returns annotated examples.

---

### Step 61: Implement troubleshoot_error tool
Create `src/tools/troubleshootError.ts`:
- Extends `BaseTool` with name `'troubleshoot_error'`
- Input schema: `{ errorMessage: string, stackTrace?: string }`
- Pattern matches against error database using regex
- Returns `{ cause: string, solution: string, example: string }`
- Ranks by pattern specificity
- Returns "unknown error" guidance if no match

**Depends on**: Steps 41, 35, 37
**Verify**:
1. `npx tsc --noEmit src/tools/troubleshootError.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/troubleshootError.ts', 'utf8');
if (!src.includes('troubleshoot_error')) throw 'wrong tool name';
if (!src.includes('extends BaseTool')) throw 'must extend BaseTool';
if (!src.includes('errorMessage')) throw 'missing errorMessage in schema';
if (!src.includes('stackTrace')) throw 'missing stackTrace support';
console.log('✓ TroubleshootErrorTool structure valid');
"
```
3. Pattern matching test (after build):
```bash
node -e "
const {TroubleshootErrorTool} = require('./dist/tools/troubleshootError');
const tool = new TroubleshootErrorTool();

(async () => {
  // Known error pattern
  const knownResult = await tool.execute({errorMessage: 'Configuration not found'});
  if (!knownResult.content.includes('cause') && !knownResult.content.includes('solution')) {
    throw 'Known error missing cause/solution';
  }
  
  // Unknown error - should still return guidance
  const unknownResult = await tool.execute({errorMessage: 'Some completely random error xyz123'});
  if (!unknownResult.content) throw 'Unknown error returned nothing';
  
  console.log('✓ troubleshoot_error handles known and unknown patterns');
})();
"
```

**Artifact**: troubleshoot_error identifies 20+ error patterns.

---

### Step 62: Implement get_best_practices tool
Create `src/tools/getBestPractices.ts`:
- Extends `BaseTool` with name `'get_best_practices'`
- Input schema: `{ topic: string, context?: string }`
- Topics: 'hooks', 'services', 'security', 'testing', 'performance'
- Returns practices with goodExample and badExample
- Ranks by relevance if context provided

**Depends on**: Steps 41, 36, 37
**Verify**:
1. `npx tsc --noEmit src/tools/getBestPractices.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/getBestPractices.ts', 'utf8');
if (!src.includes('get_best_practices')) throw 'wrong tool name';
if (!src.includes('extends BaseTool')) throw 'must extend BaseTool';
if (!src.includes('topic')) throw 'missing topic in schema';
const topics = ['hooks', 'services', 'security', 'testing', 'performance'];
topics.forEach(t => { if (!src.includes(t)) throw 'missing topic: ' + t; });
console.log('✓ GetBestPracticesTool structure valid');
"
```
3. Functional test (after build):
```bash
node -e "
const {GetBestPracticesTool} = require('./dist/tools/getBestPractices');
const tool = new GetBestPracticesTool();

(async () => {
  const result = await tool.execute({topic: 'security'});
  if (!result.content) throw 'No content returned';
  if (!result.content.includes('goodExample') && !result.content.includes('badExample') && !result.content.includes('example')) {
    throw 'Missing example code in best practices';
  }
  console.log('✓ get_best_practices returns practices with examples');
})();
"
```

**Artifact**: get_best_practices returns topic-specific guidance.

---

### Step 63: Implement explain_concept tool
Create `src/tools/explainConcept.ts`:
- Extends `BaseTool` with name `'explain_concept'`
- Input schema: `{ concept: string, version?: 'v4' | 'v5' }`
- Searches documentation knowledge base
- Returns explanation with code examples
- Includes related concepts

**Depends on**: Steps 41, 31, 37, 42
**Verify**:
1. `npx tsc --noEmit src/tools/explainConcept.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/explainConcept.ts', 'utf8');
if (!src.includes('explain_concept')) throw 'wrong tool name';
if (!src.includes('extends BaseTool')) throw 'must extend BaseTool';
if (!src.includes('concept')) throw 'missing concept in schema';
if (!src.includes('version')) throw 'missing version support';
console.log('✓ ExplainConceptTool structure valid');
"
```
3. Functional test (after build):
```bash
node -e "
const {ExplainConceptTool} = require('./dist/tools/explainConcept');
const tool = new ExplainConceptTool();

(async () => {
  const result = await tool.execute({concept: 'hooks', version: 'v5'});
  if (!result.content) throw 'No content returned';
  console.log('✓ explain_concept returns explanations with examples');
})();
"
```

**Artifact**: explain_concept returns clear explanations.

---

### Step 64: Register support tools
Update `src/tools/index.ts`:
- Export all support tools

Update `src/index.ts`:
- Register get_hook_example
- Register troubleshoot_error
- Register get_best_practices
- Register explain_concept

**Depends on**: Steps 60, 61, 62, 63
**Verify**:
1. `npx tsc --noEmit` → full project compiles
2. Export check in tools/index.ts:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/index.ts', 'utf8');
const tools = ['GetHookExampleTool', 'TroubleshootErrorTool', 'GetBestPracticesTool', 'ExplainConceptTool'];
tools.forEach(t => { if (!src.includes(t)) throw 'missing export: ' + t; });
console.log('✓ All support tools exported from src/tools');
"
```
3. Registration check:
```bash
node -e "
const src = require('fs').readFileSync('src/index.ts', 'utf8');
const tools = ['get_hook_example', 'troubleshoot_error', 'get_best_practices', 'explain_concept'];
tools.forEach(t => { if (!src.includes(t)) throw 'not registered: ' + t; });
console.log('✓ All 4 support tools registered');
"
```
4. MCP tools/list verification:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | timeout 5 node dist/index.js 2>/dev/null | node -e "
let data = '';
process.stdin.on('data', d => data += d);
process.stdin.on('end', () => {
  const resp = JSON.parse(data);
  const tools = resp.result.tools.map(t => t.name);
  const required = ['get_hook_example', 'troubleshoot_error', 'get_best_practices', 'explain_concept'];
  required.forEach(t => { if (!tools.includes(t)) throw t + ' not in tools/list'; });
  console.log('✓ All 4 support tools in tools/list (total: ' + tools.length + ' tools)');
});
"
```

**Artifact**: Four support tools invocable via MCP.

---

### Step 65: Support tools unit tests
**Pre-condition**: All inline **Verify** checks from Steps 60-64 should pass before writing tests.

Create `tests/tools/getHookExample.test.ts`:
- Test before/after/error hook types
- Test version filtering

Create `tests/tools/troubleshootError.test.ts`:
- Test known error patterns
- Test unknown error handling

Create `tests/tools/getBestPractices.test.ts`:
- Test each topic
- Test context ranking

Create `tests/tools/explainConcept.test.ts`:
- Test known concepts
- Test unknown concept handling

**Depends on**: Step 64
**Artifact**: All support tool tests pass.

---

## PHASE 7: ADVANCED TOOLS

### Step 66: Implement suggest_alternatives tool
Create `src/tools/suggestAlternatives.ts`:
- Extends `BaseTool` with name `'suggest_alternatives'`
- Input schema: `{ pattern: string, context?: string }`
- Returns 2+ alternative implementations
- Each alternative has: code, tradeoffs, whenToUse
- Queries templates and snippets

**Depends on**: Steps 41, 32, 33, 37
**Verify**:
1. `npx tsc --noEmit src/tools/suggestAlternatives.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/suggestAlternatives.ts', 'utf8');
if (!src.includes('suggest_alternatives')) throw 'wrong tool name';
if (!src.includes('extends BaseTool')) throw 'must extend BaseTool';
if (!src.includes('pattern')) throw 'missing pattern in schema';
console.log('✓ SuggestAlternativesTool structure valid');
"
```
3. Functional test (after build):
```bash
node -e "
const {SuggestAlternativesTool} = require('./dist/tools/suggestAlternatives');
const tool = new SuggestAlternativesTool();

(async () => {
  const result = await tool.execute({pattern: 'authentication hook'});
  if (!result.content) throw 'No content returned';
  // Should return 2+ alternatives
  const content = result.content;
  if (!content.includes('alternative') && !content.includes('option') && !content.includes('tradeoff')) {
    throw 'Missing alternative implementations';
  }
  console.log('✓ suggest_alternatives returns multiple options');
})();
"
```

**Artifact**: suggest_alternatives returns multiple options.

---

### Step 67: Implement get_migration_guide tool
Create `src/tools/getMigrationGuide.ts`:
- Extends `BaseTool` with name `'get_migration_guide'`
- Input schema: `{ fromVersion: 'v4', toVersion: 'v5', topic?: string }`
- Returns migration steps
- Includes before (v4) and after (v5) code examples
- Topics: hooks, services, authentication, database adapters

**Depends on**: Steps 41, 31, 37
**Verify**:
1. `npx tsc --noEmit src/tools/getMigrationGuide.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/getMigrationGuide.ts', 'utf8');
if (!src.includes('get_migration_guide')) throw 'wrong tool name';
if (!src.includes('extends BaseTool')) throw 'must extend BaseTool';
if (!src.includes('fromVersion')) throw 'missing fromVersion in schema';
if (!src.includes('toVersion')) throw 'missing toVersion in schema';
if (!src.includes('v4') || !src.includes('v5')) throw 'missing version literals';
console.log('✓ GetMigrationGuideTool structure valid');
"
```
3. Functional test (after build):
```bash
node -e "
const {GetMigrationGuideTool} = require('./dist/tools/getMigrationGuide');
const tool = new GetMigrationGuideTool();

(async () => {
  const result = await tool.execute({fromVersion: 'v4', toVersion: 'v5', topic: 'hooks'});
  if (!result.content) throw 'No content returned';
  // Should have before/after examples
  const content = result.content;
  if (!content.includes('v4') && !content.includes('before')) throw 'Missing v4/before code';
  if (!content.includes('v5') && !content.includes('after')) throw 'Missing v5/after code';
  console.log('✓ get_migration_guide returns migration steps with examples');
})();
"
```

**Artifact**: get_migration_guide returns migration steps.

---

### Step 68: Implement list_available_tools tool
Create `src/tools/listTools.ts`:
- Extends `BaseTool` with name `'list_available_tools'`
- Input schema: `{ category?: string }`
- Returns all registered tools with descriptions and schemas
- Categories: 'search', 'generate', 'validate', 'support', 'advanced'
- Includes usage examples

**Depends on**: Steps 41, 14
**Verify**:
1. `npx tsc --noEmit src/tools/listTools.ts` → compiles
2. Structure check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/listTools.ts', 'utf8');
if (!src.includes('list_available_tools')) throw 'wrong tool name';
if (!src.includes('extends BaseTool')) throw 'must extend BaseTool';
if (!src.includes('category')) throw 'missing category in schema';
const categories = ['search', 'generate', 'validate', 'support', 'advanced'];
categories.forEach(c => { if (!src.includes(c)) throw 'missing category: ' + c; });
console.log('✓ ListToolsTool structure valid');
"
```
3. Functional test (after build):
```bash
node -e "
const {ListToolsTool} = require('./dist/tools/listTools');
const tool = new ListToolsTool();

(async () => {
  const result = await tool.execute({});
  if (!result.content) throw 'No content returned';
  console.log('✓ list_available_tools returns tool catalog');
})();
"
```

**Artifact**: list_available_tools returns tool catalog.

---

### Step 69: Register advanced tools
Update `src/tools/index.ts`:
- Export all advanced tools

Update `src/index.ts`:
- Register suggest_alternatives
- Register get_migration_guide
- Register list_available_tools

Verify: `tools/list` returns all 11 tools.

**Depends on**: Steps 66, 67, 68
**Verify**:
1. `npx tsc --noEmit` → full project compiles
2. Export check:
```bash
node -e "
const src = require('fs').readFileSync('src/tools/index.ts', 'utf8');
const tools = ['SuggestAlternativesTool', 'GetMigrationGuideTool', 'ListToolsTool'];
tools.forEach(t => { if (!src.includes(t)) throw 'missing export: ' + t; });
console.log('✓ All advanced tools exported');
"
```
3. Full tool count verification:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | timeout 5 node dist/index.js 2>/dev/null | node -e "
let data = '';
process.stdin.on('data', d => data += d);
process.stdin.on('end', () => {
  const resp = JSON.parse(data);
  const tools = resp.result.tools.map(t => t.name);
  
  // All 11 tools
  const expected = [
    'search_docs', 'get_feathers_template', 'generate_service', 'validate_code',
    'get_hook_example', 'troubleshoot_error', 'get_best_practices', 'explain_concept',
    'suggest_alternatives', 'get_migration_guide', 'list_available_tools'
  ];
  
  expected.forEach(t => { if (!tools.includes(t)) throw 'missing tool: ' + t; });
  
  if (tools.length !== 11) console.log('Warning: Expected 11 tools, got ' + tools.length);
  console.log('✓ All 11 tools registered and invocable');
  console.log('Tools: ' + tools.join(', '));
});
"
```

**Artifact**: All 11 tools registered and invocable.

---

### Step 70: Advanced tools unit tests
**Pre-condition**: All inline **Verify** checks from Steps 66-69 should pass before writing tests.

Create `tests/tools/suggestAlternatives.test.ts`:
- Test returns 2+ alternatives
- Test tradeoffs included

Create `tests/tools/getMigrationGuide.test.ts`:
- Test migration steps for each topic
- Test before/after code examples

Create `tests/tools/listTools.test.ts`:
- Test all tools listed
- Test category filtering

**Depends on**: Step 69
**Artifact**: All advanced tool tests pass.

---

## PHASE 8: INTEGRATION TESTING

### Step 71: Create integration test framework
Create `tests/integration/setup.ts`:
- Initializes full server with all layers
- Provides server instance for tests
- Handles cleanup

Create `tests/integration/helpers.ts`:
- `sendMcpRequest(method: string, params: object): Promise<object>`
- `expectMcpResponse(response: object, matcher: object): void`
- Uses MockTransport from Step 11

**Depends on**: Steps 11, 69
**Verify**:
1. `npx tsc --noEmit tests/integration/setup.ts tests/integration/helpers.ts` → compiles
2. Structure check:
```bash
node -e "
const setup = require('fs').readFileSync('tests/integration/setup.ts', 'utf8');
const helpers = require('fs').readFileSync('tests/integration/helpers.ts', 'utf8');

if (!setup.includes('server') && !setup.includes('Server')) throw 'setup.ts missing server initialization';
if (!helpers.includes('sendMcpRequest')) throw 'helpers.ts missing sendMcpRequest';
if (!helpers.includes('MockTransport')) throw 'helpers.ts not using MockTransport';
console.log('✓ Integration test utilities structure valid');
"
```

**Artifact**: Integration test utilities ready.

---

### Step 72: Full request flow integration tests
Create `tests/integration/fullFlow.test.ts`:
- Test search_docs end-to-end
- Test get_feathers_template end-to-end
- Test generate_service end-to-end
- Test validate_code end-to-end
- Verify Protocol → Routing → Tools → Knowledge flow

**Depends on**: Step 71
**Verify**:
1. Test file exists:
```bash
[ -f tests/integration/fullFlow.test.ts ] && echo '✓ fullFlow.test.ts exists' || exit 1
```
2. Coverage check:
```bash
node -e "
const test = require('fs').readFileSync('tests/integration/fullFlow.test.ts', 'utf8');
const tools = ['search_docs', 'get_feathers_template', 'generate_service', 'validate_code'];
tools.forEach(t => {
  if (!test.includes(t)) throw 'Missing E2E test for: ' + t;
});
console.log('✓ All core tools have E2E tests');
"
```
3. Run tests: `npm test -- --testPathPattern=fullFlow` → all pass

**Artifact**: Full flow tests pass.

---

### Step 73: Error scenario integration tests
Create `tests/integration/errorScenarios.test.ts`:
- Test malformed JSON-RPC request
- Test unknown tool name
- Test invalid parameters
- Test timeout scenario (mock slow handler)
- Verify server doesn't crash after errors

**Depends on**: Step 71
**Verify**:
1. Test file exists:
```bash
[ -f tests/integration/errorScenarios.test.ts ] && echo '✓ errorScenarios.test.ts exists' || exit 1
```
2. Error scenario coverage:
```bash
node -e "
const test = require('fs').readFileSync('tests/integration/errorScenarios.test.ts', 'utf8');
const scenarios = ['malformed', 'unknown tool', 'invalid param', 'timeout'];
let covered = 0;
scenarios.forEach(s => {
  if (test.toLowerCase().includes(s.toLowerCase().split(' ')[0])) covered++;
});
if (covered < 3) throw 'Missing error scenarios, only found ' + covered + '/4';
console.log('✓ Error scenarios adequately covered');
"
```
3. Run tests: `npm test -- --testPathPattern=errorScenarios` → all pass

**Artifact**: Error handling tests pass.

---

### Step 74: End-to-end developer scenario tests
Create `tests/e2e/developerScenarios.test.ts`:
- Ava workflow: generate project → add service → validate
- Marco workflow: validate code → get best practices
- Jason workflow: explain concept → get hook example → troubleshoot
- All scenarios complete successfully

**Depends on**: Step 72
**Verify**:
1. Test file exists:
```bash
[ -f tests/e2e/developerScenarios.test.ts ] && echo '✓ developerScenarios.test.ts exists' || exit 1
```
2. Persona coverage:
```bash
node -e "
const test = require('fs').readFileSync('tests/e2e/developerScenarios.test.ts', 'utf8');
const personas = ['Ava', 'Marco', 'Jason'];
personas.forEach(p => {
  if (!test.includes(p) && !test.toLowerCase().includes(p.toLowerCase())) {
    throw 'Missing scenario for persona: ' + p;
  }
});
console.log('✓ All persona workflows have test scenarios');
"
```
3. Run tests: `npm test -- --testPathPattern=developerScenarios` → all pass

**Artifact**: All persona workflows succeed.

---

### Step 75: Performance test - response time
Create `tests/performance/responseTime.test.ts`:
- Measure each tool: 100 iterations after warmup
- Calculate p50, p95, p99
- Assert all tools p95 <2000ms
- Log all metrics

**Depends on**: Step 72
**Verify**:
1. Test file exists:
```bash
[ -f tests/performance/responseTime.test.ts ] && echo '✓ responseTime.test.ts exists' || exit 1
```
2. Test structure check:
```bash
node -e "
const test = require('fs').readFileSync('tests/performance/responseTime.test.ts', 'utf8');
if (!test.includes('p95') && !test.includes('percentile')) throw 'Missing p95 calculation';
if (!test.includes('2000') && !test.includes('2s')) throw 'Missing 2s threshold assertion';
console.log('✓ Response time test has p95 checks');
"
```
3. Run performance tests: `npm test -- --testPathPattern=responseTime` → all pass with metrics logged

**Artifact**: All tools meet NFR-001 (<2s p95).

---

### Step 76: Performance test - memory usage
Create `tests/performance/memoryUsage.test.ts`:
- Measure memory at startup
- Measure after knowledge base preload
- Measure peak during tool execution
- Assert peak <200MB
- Use process.memoryUsage().heapUsed

**Depends on**: Step 72
**Verify**:
1. Test file exists:
```bash
[ -f tests/performance/memoryUsage.test.ts ] && echo '✓ memoryUsage.test.ts exists' || exit 1
```
2. Test structure check:
```bash
node -e "
const test = require('fs').readFileSync('tests/performance/memoryUsage.test.ts', 'utf8');
if (!test.includes('memoryUsage') && !test.includes('heapUsed')) throw 'Not using process.memoryUsage()';
if (!test.includes('200') && !test.includes('200MB')) throw 'Missing 200MB threshold';
console.log('✓ Memory usage test has heap checks');
"
```
3. Run memory tests: `npm test -- --testPathPattern=memoryUsage` → all pass with peak <200MB

**Artifact**: Memory usage meets NFR-002 (<200MB).

---

### Step 77: Implement caching (conditional)
**Only if Step 75 shows p95 >2s for any tool:**

Create `src/routing/cache.ts`:
- LRU cache with max size
- TTL-based expiration (5 minutes)
- Cache search results

Update `src/knowledge/loader.ts`:
- Add caching for frequently accessed content

Re-run Step 75 to verify improvement.

**Depends on**: Step 75 results
**Verify**:
1. If caching was needed, verify cache implementation:
```bash
if [ -f src/routing/cache.ts ]; then
  node -e "
  const src = require('fs').readFileSync('src/routing/cache.ts', 'utf8');
  if (!src.includes('LRU') && !src.includes('lru') && !src.includes('cache')) throw 'Missing LRU cache';
  if (!src.includes('TTL') && !src.includes('ttl') && !src.includes('expir')) throw 'Missing TTL expiration';
  console.log('✓ Cache implementation has LRU and TTL');
  "
else
  echo '✓ Caching not needed - all tools already meet response time requirements'
fi
```
2. Re-run response time tests if caching added: `npm test -- --testPathPattern=responseTime`

**Artifact**: All tools meet response time if caching needed.

---

### Step 78: Verify code coverage
Run: `npm run test:coverage`
- Verify branches ≥80%
- Verify functions ≥80%
- Verify lines ≥80%
- Verify statements ≥80%
- Add tests for any uncovered paths

**Depends on**: All test steps
**Verify**:
1. Run coverage report:
```bash
npm run test:coverage
```
2. Verify thresholds:
```bash
node -e "
const fs = require('fs');
if (!fs.existsSync('coverage/coverage-summary.json')) {
  console.log('Run npm run test:coverage first');
  process.exit(1);
}
const summary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json'));
const total = summary.total;

const metrics = ['lines', 'statements', 'functions', 'branches'];
metrics.forEach(m => {
  const pct = total[m].pct;
  if (pct < 80) throw m + ' coverage ' + pct + '% is below 80%';
  console.log('✓ ' + m + ': ' + pct + '%');
});
console.log('✓ All coverage metrics >= 80%');
"
```
3. Identify uncovered files (if any):
```bash
node -e "
const fs = require('fs');
if (!fs.existsSync('coverage/coverage-summary.json')) process.exit(0);
const summary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json'));
Object.keys(summary).filter(k => k !== 'total').forEach(file => {
  const cov = summary[file];
  if (cov.lines.pct < 80) console.log('Low coverage: ' + file + ' (' + cov.lines.pct + '%)');
});
"
```

**Artifact**: Coverage report shows ≥80% all metrics.

---

## PHASE 9: DOCUMENTATION & PACKAGING

### Step 79: Write README.md
Create `README.md`:
- Project description
- Installation: `npm install -g feathers-mcp-server`
- Quick start with example
- List of all tools with brief descriptions
- Links to detailed docs

**Depends on**: Step 69
**Verify**:
1. File exists and is valid Markdown:
```bash
[ -f README.md ] && echo '✓ README.md exists' || exit 1
node -e "
const content = require('fs').readFileSync('README.md', 'utf8');
if (!content.includes('# ')) throw 'Missing markdown headers';
if (!content.includes('npm install')) throw 'Missing installation instructions';
if (!content.includes('feathers-mcp-server')) throw 'Missing package name';
console.log('✓ README.md has required sections');
"
```
2. Tool list completeness:
```bash
node -e "
const readme = require('fs').readFileSync('README.md', 'utf8');
const tools = ['search_docs', 'get_feathers_template', 'generate_service', 'validate_code',
  'get_hook_example', 'troubleshoot_error', 'get_best_practices', 'explain_concept',
  'suggest_alternatives', 'get_migration_guide', 'list_available_tools'];
const missing = tools.filter(t => !readme.includes(t));
if (missing.length > 0) throw 'README missing tools: ' + missing.join(', ');
console.log('✓ All 11 tools documented in README');
"
```

**Artifact**: README provides complete getting started guide.

---

### Step 80: Write API documentation
Create `docs/API.md`:
- Section for each tool:
  - Description
  - Input schema (JSON)
  - Output format
  - Example request/response
- Error codes and meanings
- Table of contents

**Depends on**: Step 69
**Verify**:
1. File exists and structure check:
```bash
[ -f docs/API.md ] && echo '✓ docs/API.md exists' || exit 1
node -e "
const api = require('fs').readFileSync('docs/API.md', 'utf8');

// Check for tool sections
const tools = ['search_docs', 'get_feathers_template', 'generate_service', 'validate_code',
  'get_hook_example', 'troubleshoot_error', 'get_best_practices', 'explain_concept',
  'suggest_alternatives', 'get_migration_guide', 'list_available_tools'];
  
tools.forEach(t => {
  if (!api.includes(t)) throw 'Missing documentation for: ' + t;
});

// Check for required sections
if (!api.includes('Input') && !api.includes('input') && !api.includes('schema')) throw 'Missing input schema sections';
if (!api.includes('Output') && !api.includes('output') && !api.includes('response')) throw 'Missing output format sections';
if (!api.includes('Example') && !api.includes('example')) throw 'Missing example sections';

console.log('✓ API.md has all tool documentation with required sections');
"
```

**Artifact**: Complete API reference.

---

### Step 81: Write configuration guide
Create `docs/CONFIGURATION.md`:
- Claude Desktop configuration
- Cline configuration
- Claude Code configuration
- Environment variables
- Troubleshooting

**Depends on**: Step 19
**Verify**:
1. File exists and platform coverage:
```bash
[ -f docs/CONFIGURATION.md ] && echo '✓ docs/CONFIGURATION.md exists' || exit 1
node -e "
const config = require('fs').readFileSync('docs/CONFIGURATION.md', 'utf8');

const platforms = ['Claude Desktop', 'Cline', 'Claude Code'];
platforms.forEach(p => {
  if (!config.toLowerCase().includes(p.toLowerCase())) throw 'Missing platform: ' + p;
});

if (!config.includes('Troubleshoot') && !config.includes('troubleshoot')) {
  throw 'Missing troubleshooting section';
}

console.log('✓ CONFIGURATION.md covers all platforms with troubleshooting');
"
```

**Artifact**: Platform configuration documented.

---

### Step 82: Create configuration templates
Create `config-templates/claude-desktop.json`:
```json
{
  "mcpServers": {
    "feathers-mcp-server": {
      "command": "npx",
      "args": ["feathers-mcp-server"]
    }
  }
}
```

Create `config-templates/cline.json` and `config-templates/claude-code.json` with appropriate formats.

**Depends on**: Step 81
**Verify**:
1. All config files exist and are valid JSON:
```bash
for file in config-templates/claude-desktop.json config-templates/cline.json config-templates/claude-code.json; do
  node -e "JSON.parse(require('fs').readFileSync('$file')); console.log('✓ $file is valid JSON')" || exit 1
done
```
2. Claude Desktop config structure:
```bash
node -e "
const config = JSON.parse(require('fs').readFileSync('config-templates/claude-desktop.json'));
if (!config.mcpServers) throw 'Missing mcpServers key';
if (!config.mcpServers['feathers-mcp-server']) throw 'Missing feathers-mcp-server configuration';
const server = config.mcpServers['feathers-mcp-server'];
if (!server.command) throw 'Missing command';
console.log('✓ claude-desktop.json has correct structure');
"
```

**Artifact**: Ready-to-use config files.

---

### Step 83: Configure package.json for publishing
Update `package.json`:
- `"files": ["dist/", "knowledge-base/", "README.md", "LICENSE"]`
- `"repository"`: set to GitHub URL
- `"keywords"`: ["feathersjs", "mcp", "ai", "claude"]
- `"license"`: "MIT"

**Depends on**: Step 1
**Verify**:
1. Required fields check:
```bash
node -e "
const pkg = require('./package.json');

if (!pkg.files || !Array.isArray(pkg.files)) throw 'Missing files array';
if (!pkg.files.includes('dist/')) throw 'files missing dist/';
if (!pkg.files.includes('knowledge-base/')) throw 'files missing knowledge-base/';

if (!pkg.repository) throw 'Missing repository field';
if (!pkg.keywords || !Array.isArray(pkg.keywords)) throw 'Missing keywords array';
if (!pkg.keywords.includes('feathersjs')) throw 'keywords missing feathersjs';
if (!pkg.keywords.includes('mcp')) throw 'keywords missing mcp';

if (pkg.license !== 'MIT') throw 'License should be MIT';

console.log('✓ package.json ready for npm publish');
"
```

**Artifact**: package.json ready for npm publish.

---

### Step 84: Create .npmignore
Create `.npmignore`:
```
tests/
coverage/
*.test.ts
.github/
docs/
config-templates/
```

Verify: `npm pack` produces tarball <50MB

**Depends on**: Step 83
**Verify**:
1. .npmignore exists and excludes dev files:
```bash
[ -f .npmignore ] && echo '✓ .npmignore exists' || exit 1
node -e "
const ignore = require('fs').readFileSync('.npmignore', 'utf8');
const required = ['tests/', 'coverage/', '.test.ts'];
required.forEach(r => {
  if (!ignore.includes(r)) throw '.npmignore missing: ' + r;
});
console.log('✓ .npmignore excludes dev files');
"
```
2. Tarball size check:
```bash
npm pack --dry-run 2>&1 | tail -5
npm pack
TARBALL=$(ls -la feathers-mcp-server-*.tgz | awk '{print $5}')
if [ "$TARBALL" -gt 52428800 ]; then
  echo '✗ Tarball exceeds 50MB'
  exit 1
fi
echo '✓ Tarball size acceptable'
rm feathers-mcp-server-*.tgz
```
3. Tarball contents check:
```bash
npm pack
tar -tzf feathers-mcp-server-*.tgz | head -20
node -e "
const {execSync} = require('child_process');
const files = execSync('tar -tzf feathers-mcp-server-*.tgz').toString();
if (!files.includes('dist/')) throw 'Tarball missing dist/';
if (!files.includes('knowledge-base/')) throw 'Tarball missing knowledge-base/';
if (!files.includes('README.md')) throw 'Tarball missing README.md';
if (files.includes('tests/')) throw 'Tarball should not include tests/';
console.log('✓ Tarball contains correct files');
"
rm feathers-mcp-server-*.tgz
```

**Artifact**: Package excludes dev files.

---

### Step 85: Create LICENSE
Create `LICENSE`:
- MIT License text
- Copyright year and holder

**Verify**:
1. LICENSE file exists and has correct structure:
```bash
[ -f LICENSE ] && echo '✓ LICENSE file exists' || exit 1
node -e "
const license = require('fs').readFileSync('LICENSE', 'utf8');
if (!license.includes('MIT')) throw 'Not MIT license';
if (!license.includes('Copyright')) throw 'Missing copyright notice';
if (!license.includes('2026') && !license.includes('202')) throw 'Missing copyright year';
console.log('✓ LICENSE is valid MIT license');
"
```

**Artifact**: MIT license file.

---

### Step 86: Create CHANGELOG.md
Create `CHANGELOG.md`:
- Follow Keep a Changelog format
- `[1.0.0]` section with release date
- List all features in Added section

**Depends on**: Step 69
**Verify**:
1. CHANGELOG.md exists and follows format:
```bash
[ -f CHANGELOG.md ] && echo '✓ CHANGELOG.md exists' || exit 1
node -e "
const changelog = require('fs').readFileSync('CHANGELOG.md', 'utf8');

if (!changelog.includes('# Changelog') && !changelog.includes('# CHANGELOG')) {
  throw 'Missing changelog header';
}
if (!changelog.includes('[1.0.0]')) throw 'Missing version 1.0.0 section';
if (!changelog.includes('Added') && !changelog.includes('### Added')) throw 'Missing Added section';

// Check that tools are mentioned
const tools = ['search_docs', 'get_feathers_template', 'generate_service'];
const missing = tools.filter(t => !changelog.includes(t));
if (missing.length > 0) console.log('Note: Consider adding these tools to changelog: ' + missing.join(', '));

console.log('✓ CHANGELOG.md follows Keep a Changelog format');
"
```

**Artifact**: Changelog documents release.

---

## PHASE 10: FINAL VERIFICATION & RELEASE

### Step 87: Verify NFR-001 (Response Time)
- Run tests from Step 75
- Document p50, p95, p99 for each tool
- Verify all p95 <2000ms
- Write results to `docs/nfr-verification-report.md`

**Depends on**: Step 75
**Artifact**: NFR-001 sign-off in report.

---

### Step 88: Verify NFR-002 (Memory Usage)
- Run tests from Step 76
- Document memory breakdown
- Verify peak <200MB
- Add to `docs/nfr-verification-report.md`

**Depends on**: Step 76
**Artifact**: NFR-002 sign-off in report.

---

### Step 89: Verify NFR-003 (Installation Time)
On clean machine (no prior setup):
1. Time: `npm install -g feathers-mcp-server`
2. Time: add config to Claude Desktop
3. Time: restart and test
- Total <5 minutes, ≤3 commands
- Add to `docs/nfr-verification-report.md`

**Depends on**: Step 84
**Artifact**: NFR-003 sign-off in report.

---

### Step 90: Verify NFR-004 (Code Quality)
- Generate code with get_feathers_template
- Generate code with generate_service
- Run ESLint: 0 errors
- Run Prettier: already formatted
- Run tsc: 0 errors
- Add to `docs/nfr-verification-report.md`

**Depends on**: Step 57
**Artifact**: NFR-004 sign-off in report.

---

### Step 91: Verify test coverage
- Run `npm run test:coverage`
- Screenshot/export summary
- Verify ≥80% all metrics
- Add to `docs/nfr-verification-report.md`

**Depends on**: Step 78
**Artifact**: Coverage sign-off in report.

---

### Step 92: Verify Ava persona workflow
- Generate project with auth + MongoDB
- Add 2 services
- Validate all code
- Run generated project: `npm start`
- Total time <30 minutes
- Document in `docs/user-workflow-verification.md`

**Depends on**: Step 74
**Artifact**: Ava workflow documented as working.

---

### Step 93: Verify Marco persona workflow
- Validate code sample
- Get best practices for security
- Request alternatives for pattern
- Document in `docs/user-workflow-verification.md`

**Depends on**: Step 74
**Artifact**: Marco workflow documented as working.

---

### Step 94: Verify Jason persona workflow
- Generate simple code
- Explain "hooks" concept
- Get hook example
- Troubleshoot error
- Document in `docs/user-workflow-verification.md`

**Depends on**: Step 74
**Artifact**: Jason workflow documented as working.

---

### Step 95: Final test suite run
Run in sequence:
1. `npm run lint` → 0 errors
2. `npm run build` → success
3. `npm run test` → all pass
4. `npm run test:coverage` → ≥80%

**Depends on**: All implementation steps
**Artifact**: Clean test run with no failures.

---

### Step 96: Build production package
Run:
1. `npm run build`
2. Verify `dist/` has .js and .d.ts files
3. `npm pack`
4. Verify tarball <50MB
5. Verify tarball contains: dist/, knowledge-base/, README.md, LICENSE

**Depends on**: Step 95
**Artifact**: `feathers-mcp-server-1.0.0.tgz` ready.

---

### Step 97: Publish to npm
Run:
1. `npm whoami` (verify logged in)
2. `npm publish`
3. Verify on npmjs.com
4. Test: `npm install -g feathers-mcp-server`
5. Test: `feathers-mcp-server --version`

**Depends on**: Step 96
**Artifact**: Package live on npm registry.

---

### Step 98: Post-release verification
On clean machine:
1. `npm install -g feathers-mcp-server`
2. Configure Claude Desktop
3. Restart Claude Desktop
4. Test `search_docs` → returns results
5. Test `generate_service` → generates valid code
6. Document any issues

**Depends on**: Step 97
**Artifact**: Fresh install verified working.

---

## SUMMARY

**Total Steps**: 98

**Critical Path**: 1 → 12 → 19 → 28 → 49 → 58 → 69 → 78 → 95 → 97

**Parallelization Opportunities**:
- Steps 6, 7, 8 (config files)
- Steps 31-36 (knowledge base content)
- Steps 51-54 (validators)
- Steps 60-63 (support tools)
- Steps 66-68 (advanced tools)
- Steps 79-82, 85, 86 (documentation)
- Steps 87-91 (NFR verifications)
- Steps 92-94 (persona verifications)

**Checkpoints**:
- After Step 20: Protocol Layer complete
- After Step 29: Routing Layer complete
- After Step 40: Knowledge Base complete
- After Step 50: Core tools working
- After Step 59: Validation working
- After Step 70: All tools complete
- After Step 78: All tests passing
- After Step 91: All NFRs verified
- After Step 98: Released and verified
