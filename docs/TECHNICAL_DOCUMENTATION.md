# FeathersJS MCP Server - Technical Documentation

## 1. Project Overview and Purpose

### 1.1 What this project is
`feathers-mcp-server` is a TypeScript-based [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that exposes FeathersJS-focused tools to AI coding assistants through JSON-RPC over stdio.

### 1.2 Why it exists
The server provides structured, machine-invocable capabilities so an AI assistant can:
- Search FeathersJS documentation content.
- Generate starter template outputs.
- Generate service code scaffolding.

### 1.3 Current implementation scope
The codebase currently implements **3 MCP tools**:
1. `search_docs`
2. `get_feathers_template`
3. `generate_service`

The architecture and planning documents describe a broader roadmap, but this documentation reflects what is implemented in the repository today.

---

## 2. System Architecture and High-Level Design

### 2.1 Logical architecture

```text
AI Client (Claude/Cline/etc.)
        |
        | JSON-RPC over stdio
        v
Protocol Layer (MCP SDK server)
        |
        v
Routing Layer (validation/timeout/error mapping)
        |
        v
Tools Layer (business/tool logic)
        |
        v
Knowledge Layer (JSON knowledge base loader/indexing)
```

### 2.2 Runtime behavior in current code
The intended four-layer design exists in source structure, but current runtime wiring is partially direct:
- `McpServer` registers MCP handlers internally and executes tool handlers from `ToolRegistry`.
- `Router`/`ParameterValidator`/`ErrorHandler` are instantiated in `src/index.ts`, but MCP calls are currently served by `McpServer`'s internal handler path.

Implication: routing-layer validation/timeout behavior is implemented and tested in isolation, but not fully applied in the live MCP request path.

### 2.3 Architectural properties
- **Stateless request handling**: each tool call is independent.
- **Offline-first data access**: knowledge comes from local JSON files under `knowledge-base/`.
- **Single process MCP server**: stdio transport with no HTTP surface.

---

## 3. Tech Stack and Dependencies

### 3.1 Runtime
- Node.js >= 20 (`package.json` engines)
- TypeScript (compiled to CommonJS)
- `@modelcontextprotocol/sdk` (MCP server and stdio transport)
- `ajv` (JSON schema validation, currently in routing layer)

### 3.2 Tooling and QA
- Jest + ts-jest (unit/integration-style tests)
- ESLint (`@typescript-eslint`)
- Prettier
- GitHub Actions CI (`.github/workflows/ci.yml`)

### 3.3 Build output
- Source: `src/`
- Compiled output: `dist/`
- Coverage output: `coverage/`

---

## 4. Setup and Installation Instructions

### 4.1 Prerequisites
- Node.js 20+
- npm

### 4.2 Local setup
```bash
git clone <repo-url>
cd cspc319_feathersJS_C
npm ci
npm run build
```

### 4.3 Run tests
```bash
npm test -- --runInBand
```

Current observed state:
- 18/18 test suites pass
- 300/300 tests pass
- ~90% line coverage overall

### 4.4 Run the MCP server locally
```bash
node dist/index.js
```

The server is stdio-based and does not print a CLI menu. It expects MCP JSON-RPC messages from a client.

### 4.5 Quick protocol smoke test (`tools/list`)
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | node dist/index.js
```

---

## 5. Folder/Project Structure Explanation

```text
.
|-- src/
|   |-- protocol/         # MCP server, protocol types, registry, handlers
|   |-- routing/          # Validation, timeout, error mapping, router
|   |-- tools/            # MCP tool implementations and helper modules
|   `-- knowledge/        # Knowledge loader/index/types
|-- knowledge-base/       # Embedded JSON content consumed by tools
|   |-- docs/
|   |-- templates/
|   |-- snippets/
|   |-- errors/
|   `-- best-practices/
|-- tests/                # Unit and component-level tests
|-- scripts/              # Knowledge-base build/check scripts
|-- docs/                 # Design docs, plans, and this technical documentation
|-- .github/workflows/    # CI pipeline
`-- dist/                 # Compiled JS output
```

---

## 6. Key Modules and Components

### 6.1 Entry point: `src/index.ts`
Responsibilities:
- Instantiate tool objects.
- Register tools into protocol registry.
- Instantiate routing services.
- Start MCP server and graceful shutdown handlers (`SIGINT`, `SIGTERM`).

### 6.2 Protocol layer (`src/protocol/`)

#### `server.ts` (`McpServer`)
- Initializes MCP SDK `Server` with `tools` capability.
- Uses `StdioServerTransport`.
- Registers handlers for:
  - `tools/list`
  - `tools/call`
- Normalizes tool return values into MCP `content[]` format.

#### `registry.ts` (`ToolRegistry`)
- In-memory registry keyed by tool name.
- Stores metadata + executable handler.
- Provides:
  - `register`
  - `getTools`
  - `getHandler`
  - `has`

#### `types.ts`
Defines protocol contracts:
- `JsonSchema`
- `ToolMetadata`
- `ToolResult`
- `ToolHandler`
- `ToolRegistration`

#### `handlers/`
Contains reusable handler factories (`listToolsHandler`, `callToolHandler`) that can bridge protocol to either `ToolRegistry` or `Router`.

### 6.3 Routing layer (`src/routing/`)

#### `router.ts` (`Router`)
Pipeline:
1. lookup handler by tool name
2. validate params against JSON schema
3. execute tool with timeout wrapper
4. map failures via `ErrorHandler`

#### `validator.ts` (`ParameterValidator`)
- AJV-based schema validation.
- Compiled-schema cache by schema fingerprint.

#### `timeout.ts`
- `withTimeout` helper
- `TimeoutError`

#### `errorHandler.ts` (`ErrorHandler`)
Maps runtime errors to standardized codes:
- `INVALID_PARAMS`
- `TIMEOUT`
- `INTERNAL_ERROR`

### 6.4 Tools layer (`src/tools/`)

#### Base abstraction
- `BaseTool` standardizes metadata/schema/execute + registration.

#### Implemented tools
1. **`search_docs`** (`searchDocs.ts`)
- Loads docs from knowledge base.
- Filters by version.
- BM25 relevance ranking (`tools/search/bm25.ts`).
- Returns ranked docs with snippet + score.

2. **`get_feathers_template`** (`getTemplate.ts`)
- Loads template fragments.
- Selects fragments by DB/auth/typescript/version options.
- Composes imports/code via `TemplateComposer`.
- Returns synthesized file tree + dependencies/feature flags.

3. **`generate_service`** (`generateService.ts`)
- Generates 4 files for a service:
  - service
  - hooks
  - schema/model
  - test
- Supports MongoDB/PostgreSQL/SQLite variants.
- Uses codegen helpers in `tools/codegen/`.

### 6.5 Knowledge layer (`src/knowledge/`)

#### `loader.ts` (`KnowledgeLoader`)
- Reads JSON arrays from `knowledge-base/<category>/`.
- Preloads docs/templates.
- Lazily loads snippets/errors/best-practices.
- Provides `buildIndex` and in-memory cache.

#### `searchIndex.ts`
Simple token inverted index implementation (separate from BM25 implementation used by `search_docs`).

#### `types.ts`
Defines typed content models for docs/templates/snippets/errors/best-practices.

---

## 7. Data Flow and API Interactions

### 7.1 Startup flow
1. Process starts (`node dist/index.js`).
2. `src/index.ts` constructs registries/tools/server.
3. `McpServer.start()` initializes MCP SDK + stdio transport.
4. MCP client sends `initialize`, then tool requests.

### 7.2 MCP request flow (`tools/list`)
1. Client sends `tools/list` request.
2. Protocol server reads registered tool metadata from `ToolRegistry`.
3. Response returns array of `{ name, description, inputSchema }`.

### 7.3 MCP request flow (`tools/call`)
1. Client sends tool name + arguments.
2. Protocol server verifies tool existence.
3. Tool handler executes.
4. Return value is normalized to MCP `content[]` result format.

### 7.4 API surface
This service exposes MCP tools only (no REST/GraphQL endpoints).

### 7.5 Example MCP payloads

#### `tools/list`
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

#### `tools/call` (`search_docs`)
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "search_docs",
    "arguments": {
      "query": "hooks",
      "limit": 5
    }
  }
}
```

---

## 8. Database Schema (Applicable Data Models)

### 8.1 Runtime persistence
The MCP server itself does **not** use a runtime database. It is file-backed via JSON knowledge assets.

### 8.2 Knowledge-base data model
Current content inventory:
- `docs`: 83 entries
- `templates`: 14 entries
- `snippets`: 34 entries
- `errors`: 23 entries
- `best-practices`: 25 entries

All current entries are tagged `version: "v5"`.

Primary shapes (from `src/knowledge/types.ts`):
- `DocEntry`
- `TemplateFragment`
- `CodeSnippet`
- `ErrorPattern`
- `BestPractice`

### 8.3 Generated service schema outputs
`generate_service` produces schema/model code for target DBs:
- **MongoDB**: Mongoose-style schema file (`*.schema.ts`)
- **PostgreSQL/SQLite**: Knex migration/model-style file (`*.model.ts`)

This is generated output for consumers, not the MCP server's own persistence layer.

---

## 9. Environment Variables and Configuration

### 9.1 Environment variables
No required `.env` variables are currently used by the server.

### 9.2 Runtime configuration points
- **Knowledge base root path**:
  - `KnowledgeLoader` defaults to `path.join(process.cwd(), "knowledge-base")`.
  - Ensure process CWD is repository root (or provide custom `kbRoot` in code).

- **MCP client config**:
  - MCP host must launch `node dist/index.js` (or equivalent command).

### 9.3 Logging behavior
- Operational logs/errors are written to **stderr**.
- stdout must remain reserved for MCP protocol traffic.

---

## 10. Deployment Process

### 10.1 Build artifact deployment
1. Install dependencies (`npm ci`).
2. Build (`npm run build`).
3. Deploy/run `dist/index.js` as the MCP server command.

### 10.2 Typical deployment target
This project is typically deployed as a **local developer-side MCP process** attached to an AI assistant.

### 10.3 CI process
GitHub Actions workflow (`.github/workflows/ci.yml`):
1. Checkout
2. Use Node 20
3. `npm ci`
4. `npm test -- --runInBand --coverage=false`

### 10.4 Packaging note
Current `package.json` does not define a `bin` entry, so direct global executable installation flow is not fully wired yet.

---

## 11. Common Workflows

### 11.1 Development workflow
```bash
npm ci
npm run build
npm test -- --runInBand
npm run lint
```

### 11.2 Add a new tool (recommended sequence)
1. Create a class extending `BaseTool` in `src/tools/`.
2. Define `name`, `description`, `inputSchema`, `execute`.
3. Export from `src/tools/index.ts`.
4. Register it in `src/index.ts` protocol registry.
5. (Optional, recommended) register routing handler/schema in routing registry.
6. Add tests under `tests/tools/` and protocol coverage for `tools/list` / `tools/call`.

### 11.3 Regenerate knowledge base from markdown sources
```bash
node scripts/build-knowledge-base.js
```
Source markdown: `docs/v5_docs/`  
Output JSON: `knowledge-base/`

### 11.4 Debugging workflow
- Run server directly:
  ```bash
  node dist/index.js
  ```
- Send raw MCP JSON-RPC messages (see `docs/Peer_Testing_Tasks.md`).
- Observe stderr for stack traces and router/protocol errors.
- Use focused test runs:
  ```bash
  npx jest tests/protocol/mcpserver.spec.ts --runInBand
  npx jest tests/tools/searchDocs.test.ts --runInBand
  ```

---

## 12. Known Issues and Limitations

1. **Planned vs implemented feature gap**
- README/design docs describe 10-15 tools; current code registers 3 tools only.

2. **Routing layer not fully wired into live MCP path**
- `Router`, `ParameterValidator`, and `ErrorHandler` are implemented and tested, but live `McpServer` call handling currently executes handlers via `ToolRegistry` directly.

3. **Script/packaging mismatches**
- `package.json` lacks `start`/`dev` scripts and `bin` mapping despite docs implying CLI-style startup and global command install.

4. **Documentation drift**
- Some planning docs reference v4/v5 mixed support and future tools; actual knowledge-base data is currently v5-only and tool surface is smaller.

5. **Generated code quality caveats in `generate_service`**
- Mongo service import path uses `./schema` while generated schema filename is `<name>.schema.ts`.
- SQL service generation still emits `I<name>` type references without corresponding interface generation/import.
- Generated test file setup is MongoDB-oriented even when SQL databases are selected.

6. **`config-templates/` currently empty**
- No ready-to-use MCP host config templates are shipped in that directory yet.

---

## 13. Contributor Recommendations

1. Wire `McpServer` `tools/call` handling through `Router` to enforce schema validation, timeouts, and structured error codes consistently.
2. Align `package.json` scripts and `bin` metadata with onboarding docs.
3. Reconcile roadmap docs with current implementation status (or gate roadmap sections clearly as future work).
4. Add compile/validation tests for generated service outputs to catch template/codegen regressions.
