# FeathersJS MCP Server — Technical Documentation

*Last updated: March 2, 2026*

---

## 1. Project Overview and Purpose

### 1.1 What this project is

`feathers-mcp-server` is a TypeScript-based [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that exposes FeathersJS-focused tools to AI coding assistants through JSON-RPC over stdio.

### 1.2 Why it exists

The server provides structured, machine-invocable capabilities so an AI assistant can:
- Search the FeathersJS v5/v6 documentation corpus via dense vector (BGE-M3) semantic search.
- Submit, update, or request removal of documentation files via automated GitHub Pull Requests.

### 1.3 Current implementation scope

The codebase implements **4 MCP tools** registered in `src/protocol/index.ts`:

| # | Tool | Network | Description |
|---|------|---------|-------------|
| 1 | `search_docs` | ✗ offline | BGE-M3 dense semantic search over FeathersJS v5/v6 chunks |
| 2 | `submit_documentation` | ✓ gated | Submit a new doc as a GitHub PR (6-stage validation pipeline) |
| 3 | `update_documentation` | ✓ gated | Update an existing doc via a GitHub PR |
| 4 | `remove_documentation` | ✓ gated | Delete a doc + its knowledge-base chunks via a GitHub PR |

---

## 2. System Architecture and High-Level Design

### 2.1 Logical architecture

```text
AI Client (Claude / VS Code / Cline)
        |
        | JSON-RPC over stdio
        v
Protocol Layer (McpServer + ToolRegistry + handlers)
        |
        v
Routing Layer (Router → ParameterValidator → Network Gate → withTimeout → ErrorHandler)
        |
        v
Tools Layer (BaseTool subclasses: search_docs, submit, update, remove)
        |               |
        v               v
Knowledge Layer     GitHub API (via GitHubClient)
(chunks JSON +      (PRs, file commits, chunk cleanup)
 BGE-M3 embeddings)
```

### 2.2 Four-layer wiring

All four layers are fully wired end-to-end:

- `McpServer` registers `tools/list` and `tools/call` handlers.
- `tools/call` routes through the `Router`, which validates parameters (AJV), enforces the network-tier gate, applies a 10-second timeout, and maps errors to structured codes.
- Tool results flow back up through the router as `ToolResponse`, normalized to MCP `content[]` by `McpServer`.

### 2.3 Architectural properties

- **Stateless request handling**: each tool call is independent.
- **Offline-first**: `search_docs` loads from local JSON; network tools require explicit opt-in.
- **Defense-in-depth**: both the Router and the tool's `execute()` enforce the `ALLOW_NETWORK_TOOLS` gate independently.
- **Single-process MCP server**: stdio transport, no HTTP surface.

---

## 3. Tech Stack and Dependencies

### 3.1 Runtime

| Package | Version | Purpose |
|---------|---------|---------|
| Node.js | ≥ 20 | Runtime |
| TypeScript | ^5.9 | Language |
| `@modelcontextprotocol/sdk` | ^1.26 | MCP server + stdio transport |
| `@xenova/transformers` | ^2.17 | BGE-M3 embedding model (in-process) |
| `ajv` | ^8.18 | JSON schema validation |

### 3.2 Dev / QA

| Package | Purpose |
|---------|---------|
| Jest + ts-jest | Test runner |
| `@types/jest` | Jest type definitions |
| ESLint + `@typescript-eslint` | Linting |
| Prettier | Formatting |

### 3.3 Build output

- Source: `src/`
- Compiled output: `dist/`
- Coverage output: `coverage/` (≥ 80% line coverage enforced)

---

## 4. Setup and Installation

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
npm test               # all 24 suites, ~260+ tests, coverage report
npm test -- --runInBand  # sequential (avoids flakiness in CI)
```

**Coverage thresholds:** `coverageThreshold.global.lines ≥ 80` (enforced by `jest.config.js`).

### 4.4 Run the MCP server locally

```bash
node dist/index.js
```

The server is stdio-based and does not print a CLI menu. It expects MCP JSON-RPC messages from a connected client.

### 4.5 Quick protocol smoke test

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | node dist/index.js
```

---

## 5. Project Structure

```text
.
├── src/
│   ├── index.ts                    # Entry point: wires all layers, starts server
│   ├── protocol/
│   │   ├── server.ts               # McpServer (SDK Server + StdioServerTransport)
│   │   ├── registry.ts             # ToolRegistry (protocol-layer, stores metadata + handlers)
│   │   ├── index.ts                # Barrel: registers all 4 tools into default registry
│   │   ├── types.ts                # JsonSchema, ToolResult, ToolRegistration, ToolHandler
│   │   └── handlers/
│   │       ├── listTools.ts        # listToolsHandler factory
│   │       └── callTool.ts         # callToolHandler factory (delegates to Router or ToolRegistry)
│   ├── routing/
│   │   ├── router.ts               # Router (validate → gate → execute → timeout → error map)
│   │   ├── validator.ts            # ParameterValidator (AJV, compiled-schema cache)
│   │   ├── errorHandler.ts         # ErrorHandler → INVALID_PARAMS / TIMEOUT / INTERNAL_ERROR
│   │   ├── timeout.ts              # withTimeout() + TimeoutError
│   │   ├── toolRegistry.ts         # ToolHandlerRegistry (routing-layer, stores handler + schema)
│   │   ├── index.ts                # Barrel export
│   │   └── types.ts                # ToolRequest, ToolResponse, ToolError, ValidationResult
│   ├── tools/
│   │   ├── baseTool.ts             # BaseTool abstract class (name/description/schema/execute/register)
│   │   ├── searchDocs.ts           # SearchDocsTool — BGE-M3 semantic search
│   │   ├── submitDocumentation.ts  # SubmitDocumentationTool — new docs via GitHub PR
│   │   ├── updateDocumentation.ts  # UpdateDocumentationTool — update existing docs via GitHub PR
│   │   ├── removeDocumentation.ts  # RemoveDocumentationTool — delete docs + chunks via GitHub PR
│   │   ├── types.ts                # Re-exports ToolResult from protocol layer
│   │   ├── index.ts                # Barrel export for all tools
│   │   ├── github/
│   │   │   ├── githubClient.ts     # GitHubClient (https-only REST adapter, Content-Length aware)
│   │   │   ├── sanitizer.ts        # sanitizeContent() — accept/reject, never modify
│   │   │   ├── types.ts            # CreatePRParams, DeletePRParams, GitHubPRResult
│   │   │   └── index.ts
│   │   └── search/
│   │       └── vectorSearch.ts     # VectorSearch (BGE-M3 cosine similarity, source dedup)
│   └── knowledge/
│       ├── loader.ts               # KnowledgeLoader (file-backed, recursive, LRU cache)
│       ├── searchIndex.ts          # SearchIndex (substring fallback stub — not used in production)
│       └── types.ts                # DocEntry, TemplateFragment, CodeSnippet, ErrorPattern, BestPractice
├── knowledge-base/
│   └── chunks/
│       ├── v5-chunks.json          # Pre-chunked v5 docs with 1024-dim BGE-M3 embeddings
│       └── v6-chunks.json          # Pre-chunked v6 docs with 1024-dim BGE-M3 embeddings
├── tests/
│   ├── tools/                      # Unit tests (baseTool, searchDocs, submit, update, remove, github, search)
│   ├── integration/                # Router → Tool → GitHub mock flows (all 4 tools)
│   ├── e2e/                        # Developer scenario tests
│   ├── performance/                # Response-time benchmarks
│   ├── knowledge/                  # KnowledgeLoader + chunk index integrity tests
│   ├── protocol/                   # McpServer, ToolRegistry, callTool errors
│   ├── routing/                    # Router, Validator, ErrorHandler, Timeout
│   └── helpers/                    # MockTransport, shared utilities
├── scripts/                        # Knowledge-base build/update/debug scripts
└── docs/                           # Design documents and this file
```

---

## 6. Key Modules and Components

### 6.1 Entry point: `src/index.ts`

Registers all 4 tools into both the protocol registry and the routing registry, wires all layers, and starts `McpServer` with graceful `SIGINT`/`SIGTERM` shutdown.

### 6.2 Protocol layer (`src/protocol/`)

#### `server.ts` — `McpServer`

- Initializes MCP SDK `Server` with `tools` capability.
- Uses `StdioServerTransport`.
- Registers two request handlers: `tools/list` and `tools/call`.
- `tools/call` handler normalizes tool return values into MCP `content[]` format.

#### `registry.ts` — `ToolRegistry`

In-memory map keyed by tool name. API:
- `register(ToolRegistration)` — throws on duplicate name
- `getTools(): ToolMetadata[]`
- `getHandler(name): ToolHandler`
- `has(name): boolean`

#### `handlers/callTool.ts`

Accepts either a `Router` or a `ToolRegistry`. When given a `Router`, it delegates through the full routing pipeline (validation, gate, timeout, error mapping).

### 6.3 Routing layer (`src/routing/`)

#### `router.ts` — `Router`

Request pipeline for every `tools/call`:

1. `lookup(toolName)` → `ToolHandlerEntry | undefined`
2. If `requiresNetwork && ALLOW_NETWORK_TOOLS !== 'true'` → `NETWORK_NOT_ALLOWED`
3. `validator.validate(params, schema)` → `INVALID_PARAMS` on failure
4. `withTimeout(() => handler(params), timeoutMs)` → `TIMEOUT` on expiry
5. `errorHandler.handle(err)` → `INTERNAL_ERROR` on uncaught exception

#### `validator.ts` — `ParameterValidator`

AJV-based. Compiles schemas on first use and caches by JSON fingerprint. Returns `ValidationResult { valid, errors?: ValidationError[] }`.

#### `errorHandler.ts` — `ErrorHandler`

Maps to three codes: `INVALID_PARAMS`, `TIMEOUT`, `INTERNAL_ERROR`. Sanitizes stack traces before exposing them.

#### `timeout.ts`

`withTimeout<T>(fn, ms)` races the function against a `setTimeout`. Throws `TimeoutError` (`.code = 'TIMEOUT'`) on expiry.

#### `toolRegistry.ts` — `ToolHandlerRegistry`

Routing-layer registry: stores `{ handler, schema, requiresNetwork }`. Separate from the protocol-layer `ToolRegistry`.

### 6.4 Tools layer (`src/tools/`)

#### `BaseTool`

Abstract class. Subclasses implement `name`, `description`, `inputSchema`, `execute()`. `requiresNetwork` defaults to `false`. `register()` returns a `ToolRegistration` for both registries.

#### `SearchDocsTool` (`search_docs`)

Pipeline:
1. Load `knowledge-base/chunks/` via `KnowledgeLoader`
2. Filter by version (`v5` / `v6` / `both` / `all`)
3. BGE-M3 vector search → up to 50 candidates ranked by cosine similarity
4. Source deduplication → max 2 results per `sourceFile`
5. Optional token-budget trim
6. Slice to `limit` (default 10, max 50)

Returns JSON: `{ query, version, totalTokens, results: [{ id, heading, version, category, score, snippet, breadcrumb, covers, tags, tokens, sourceFile }] }`.

#### `SubmitDocumentationTool` (`submit_documentation`)

Six-stage pipeline (see §8). Checks if the target file already exists via GitHub API `fetch`; if so, marks `isUpdate: true` in the PR. Falls back to `pending-contributions/` when `GITHUB_TOKEN` is absent.

#### `UpdateDocumentationTool` (`update_documentation`)

Same six stages as `SubmitDocumentationTool` but the existence check is **inverted** — rejects if the file does *not* exist. Always passes `isUpdate: true` to `GitHubClient`.

#### `RemoveDocumentationTool` (`remove_documentation`)

Stages: schema → path → existence check (file must exist via GitHub `fetch`) → rate limit → dispatch. No content sanitization or markdown lint (no content parameter). Dispatches `GitHubClient.createRemovalPR()`.

### 6.5 GitHub integration (`src/tools/github/`)

#### `GitHubClient`

Pure `https`-based REST adapter. Uses `Content-Length` header on all requests with bodies (required for DELETE). No third-party HTTP library.

**`createDocsPR(params)`** — 4–5 API calls:
1. `GET /git/ref/heads/main` — get base SHA
2. `POST /git/refs` — create branch
3. `GET /contents/<filePath>?ref=main` — check for existing file (catches 404 silently)
4. `PUT /contents/<filePath>` — create or update file
5. `POST /pulls` — open PR

**`createRemovalPR(params)`** — 5–7 API calls:
1. `GET /git/ref/heads/main`
2. `POST /git/refs`
3. `GET /contents/<filePath>?ref=<branch>` — get file SHA
4. `DELETE /contents/<filePath>` — delete file (body: `message`, `sha`, `branch`)
5. `GET /contents/knowledge-base/chunks/<version>-chunks.json` — fetch chunks
6. `PUT /contents/knowledge-base/chunks/<version>-chunks.json` — write filtered chunks (step 6 skipped if no matching chunks)
7. `POST /pulls`

Token is never echoed in error responses (redacted by regex).

#### `sanitizeContent()`

Accept/reject model — never silently modifies content. Hard-rejects: `<script>`, `</script>`, `<iframe>`, `</iframe>`, `javascript:` URIs, large `data:` base64 URIs (> 1 KB). Warns (non-blocking) on inline event handlers.

### 6.6 Knowledge layer (`src/knowledge/`)

#### `KnowledgeLoader`

- `load<T>(category, file?)` — recursive JSON array loader with in-memory cache.
- `preload()` — eagerly loads `chunks/` and `templates/` into cache.
- `clearCache()` — clears all cached entries.
- `buildIndex()` — returns `KnowledgeIndex` grouped by category.

Production path: `knowledge-base/chunks/` (two files: `v5-chunks.json`, `v6-chunks.json`).

#### `DocEntry` shape

```typescript
{
  id: string;         // unique chunk ID
  heading: string;    // section heading
  content: string;    // context-prefixed content
  rawContent: string; // plain content for scoring
  breadcrumb: string; // navigation path
  version: 'v5' | 'v6' | 'both';
  tokens: number;     // estimated token count
  category: string;
  sourceFile: string; // e.g. "docs/v6_docs/guides/hooks.md"
  hasCode: boolean;
  codeLanguages: string[];
  tags?: string[];
  embedding?: number[]; // 1024-dim BGE-M3 embedding
}
```

---

## 7. Data Flow

### 7.1 `tools/list` flow

```
Client → McpServer.setRequestHandler(ListToolsRequestSchema)
       → ToolRegistry.getTools()
       → [{ name, description, inputSchema }, ...]
```

### 7.2 `tools/call` flow (happy path)

```
Client → McpServer.setRequestHandler(CallToolRequestSchema)
       → callToolHandler(Router)
       → Router.route({ toolName, params })
           → ToolHandlerRegistry.lookup(toolName)
           → network gate check (ALLOW_NETWORK_TOOLS)
           → ParameterValidator.validate(params, schema)
           → withTimeout(() => tool.execute(params), 10000)
           → tool.execute(params)
               → [validation stages]
               → GitHubClient / KnowledgeLoader
       → ToolResponse { success: true, data: ToolResult }
       → McpServer.normalizeResult(result)
       → { content: [{ type: "text", text: "..." }] }
```

### 7.3 Error mapping

| Condition | Router code | JSON-RPC code |
|-----------|-------------|---------------|
| AJV schema failure | `INVALID_PARAMS` | `-32602` |
| Tool timeout | `TIMEOUT` | `-32001` |
| Unknown tool | `INTERNAL_ERROR` → message starts "Unknown tool" | `-32601` |
| Network gate blocked | `NETWORK_NOT_ALLOWED` | `-32000` |
| Uncaught exception | `INTERNAL_ERROR` | `-32000` |

---

## 8. Six-Stage Validation Pipeline

Applied by `submit_documentation` and `update_documentation` (stages 1–6) and `remove_documentation` (stages 1, 2, 5, 6):

| Stage | Tool(s) | What is checked |
|-------|---------|----------------|
| 1. Schema | all | Required fields, types, string lengths |
| 2. Path restriction | all | Regex allowlist · posix normalize · no `\0` · no `\\` · no `//` · version–path match |
| 3. Content sanitization | submit, update | `<script>` · `<iframe>` · `javascript:` · large base64 data URIs |
| 4. Markdown lint | submit, update | Requires `# Heading` · ≥ 50 chars prose after stripping code fences |
| 5. Existence check | submit: warns if exists · update/remove: rejects if missing | GitHub API `fetch` |
| 6. Rate limiting | all | 1 operation / 60 s per server instance (`Date.now()` comparison) |

---

## 9. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_TOKEN` | — | Fine-grained PAT (`contents:write`, `pull_requests:write`). Without it, `submit`/`update` fall back to local staging; `remove` fails. |
| `GITHUB_OWNER` | `owner` | GitHub repository owner |
| `GITHUB_REPO` | `cspc319_feathersJS_C` | GitHub repository name |
| `ALLOW_NETWORK_TOOLS` | — | Set to `"true"` to allow network-tier tools through the G1.5 gate |

### Logging

All operational logs and stack traces go to **stderr**. stdout is reserved for MCP protocol traffic.

---

## 10. Test Suite

### 10.1 Overview

```
24 test suites · 260+ tests · ≥ 80% line coverage
```

| Directory | Scope |
|-----------|-------|
| `tests/tools/` | Unit: baseTool, searchDocs, submitDocumentation, updateDocumentation, removeDocumentation, githubClient, sanitizer, vectorSearch |
| `tests/routing/` | Unit: Router, ParameterValidator, ErrorHandler, withTimeout |
| `tests/protocol/` | Unit: McpServer, ToolRegistry, callTool errors, all-4-tools registration |
| `tests/knowledge/` | Unit: KnowledgeLoader (cache, chunks, v5/v6 files) |
| `tests/integration/` | Integration: Router→Tool→mock GitHub flows for all 4 tools, error scenarios |
| `tests/e2e/` | E2E: Developer search scenarios, contributor workflows, network gate |
| `tests/performance/` | Benchmark: `search_docs` p95 < 2000 ms |

### 10.2 Key mocking patterns

- **`vectorSearch`** — mocked via `jest.mock` in all search tests; avoids loading the BGE-M3 model in Jest.
- **`GitHubClient`** — mocked via `jest.mock` in tool unit tests and integration tests.
- **`global.fetch`** — mocked with `jest.fn()` to control existence-check responses in `submitDocumentation`, `updateDocumentation`, and `removeDocumentation` tests.
- **`https.request`** — mocked in `githubClient.test.ts` via `jest.mock('https', ...)` with sequential response helpers.

### 10.3 Running specific suites

```bash
npx jest tests/tools/submitDocumentation.test.ts --runInBand
npx jest tests/integration/ --runInBand
npx jest tests/e2e/ --runInBand
npx jest tests/performance/ --runInBand --testTimeout=240000
```

---

## 11. Deployment

### 11.1 Build and deploy

```bash
npm ci
npm run build
node dist/index.js   # MCP server (stdio)
```

### 11.2 Typical deployment target

Local developer-side MCP process attached to an AI assistant (Claude Desktop, VS Code Copilot, Cline).

### 11.3 CI pipeline

GitHub Actions (`.github/workflows/ci.yml`):
1. Checkout
2. Node 20
3. `npm ci`
4. `npm test -- --runInBand --coverage=false`

### 11.4 Knowledge-base rebuild workflow

GitHub Actions (`.github/workflows/rebuild-knowledge-base.yml`) triggers on push to `main` when `docs/v5_docs/**` or `docs/v6_docs/**` change:
1. Re-chunks all documentation
2. Re-embeds with BGE-M3
3. Commits updated `knowledge-base/chunks/v5-chunks.json` and `v6-chunks.json`

---

## 12. Common Workflows

### 12.1 Development

```bash
npm ci
npm run build
npm test -- --runInBand
npm run lint
```

### 12.2 Add a new tool

1. Create a class extending `BaseTool` in `src/tools/`.
2. Implement `name`, `description`, `inputSchema`, `execute()`.
3. If network-dependent, set `requiresNetwork = true`.
4. Export from `src/tools/index.ts`.
5. Register in `src/protocol/index.ts` (protocol registry) and `src/index.ts` (routing registry).
6. Add unit tests under `tests/tools/` and integration tests under `tests/integration/`.
7. Add the tool to the `tools/list` assertion in `tests/protocol/protocol.spec.ts`.

### 12.3 Rebuild knowledge base

```bash
npm run rebuild:kb    # full re-chunk + re-embed
npm run update:kb     # incremental (changed files only)
```

### 12.4 Debugging

```bash
node dist/index.js   # direct server run (inspect stderr)
npx jest tests/protocol/mcpserver.spec.ts --runInBand --verbose
npx jest tests/tools/searchDocs.test.ts --runInBand --verbose
```

---

## 13. Security Model

| Concern | Mitigation |
|---------|-----------|
| Path traversal | 4-layer validation: regex allowlist, posix normalize, null bytes, backslash check |
| XSS / injection | `sanitizeContent()` hard-rejects `<script>`, `<iframe>`, `javascript:`, large base64 |
| Token leakage | `GitHubClient` redacts `token \S+` from all error strings |
| Uncontrolled network access | G1.5 gate: `requiresNetwork = true` tools blocked unless `ALLOW_NETWORK_TOOLS=true` |
| Abuse / spam | Rate limit: 1 operation/60 s per server instance + GitHub's 5,000 req/hr cap |
| Content size | 50 KB max per submission |
| Branch naming | Server-generated only: `docs/contrib/<ISO-timestamp>-<slug>` |

---

## 14. Known Limitations

1. **Rate limiting is per-instance** — resets on server restart; not shared across multiple processes.
2. **`search_docs` embeddings are static** — query embeddings are computed at request time by BGE-M3 in-process; doc embeddings are pre-computed at knowledge-base build time.
3. **`remove_documentation` requires `GITHUB_TOKEN`** — no local staging fallback (needs live file SHA from GitHub).
4. **No `bin` entry in `package.json`** — global executable install (`npm install -g`) is not wired.
5. **`knowledge-base/chunks/` only** — the `templates/`, `snippets/`, `errors/`, and `best-practices/` sub-directories referenced in older docs were removed when the codebase moved to a pure vector-search architecture.
