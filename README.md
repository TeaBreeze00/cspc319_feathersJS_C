# FeathersJS MCP Server

A Model Context Protocol (MCP) server that provides AI coding assistants with structured FeathersJS documentation search and a full contributor documentation pipeline.

## Overview

The FeathersJS MCP Server connects AI assistants (Claude Desktop, VS Code Copilot, Cline) to a curated FeathersJS knowledge base via the MCP standard. It exposes **4 tools**:

| Tool | Network? | Description |
|------|----------|-------------|
| `search_docs` | ✗ offline | BGE-M3 dense semantic search over FeathersJS v5/v6 documentation |
| `submit_documentation` | ✓ gated | Submit a **new** doc as a GitHub PR for admin review |
| `update_documentation` | ✓ gated | Update an **existing** doc via a GitHub PR |
| `remove_documentation` | ✓ gated | Request **removal** of an existing doc via a GitHub PR |

> **Network tools** (`submit_documentation`, `update_documentation`, `remove_documentation`) only activate when `ALLOW_NETWORK_TOOLS=true` is set.

## Quick Start

### Prerequisites

- **Node.js 20+**
- An MCP-compatible AI client (Claude Desktop, VS Code, Cline)

### 1. Clone & Install

```bash
git clone <repository-url>
cd cspc319_feathersJS_C
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Configure Your AI Client

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "feathers": {
      "command": "node",
      "args": ["/absolute/path/to/cspc319_feathersJS_C/dist/index.js"],
      "env": {
        "ALLOW_NETWORK_TOOLS": "true",
        "GITHUB_TOKEN": "ghp_yourtoken",
        "GITHUB_OWNER": "your-org",
        "GITHUB_REPO": "cspc319_feathersJS_C"
      }
    }
  }
}
```

#### VS Code (Copilot / Cline)

Add to `.vscode/settings.json` or your extension settings:

```json
{
  "mcp.servers": {
    "feathers": {
      "command": "node",
      "args": ["./dist/index.js"],
      "cwd": "/absolute/path/to/cspc319_feathersJS_C"
    }
  }
}
```

### 4. Restart your AI client

The assistant now has access to FeathersJS documentation search and all three contribution tools.

### 5. Try it

```
Search the FeathersJS docs for how hooks work in v6
```

---

## Tools

### `search_docs`

Searches the embedded FeathersJS knowledge base using **BGE-M3 dense vector similarity** (cosine distance over 1024-dim embeddings). Results are source-deduplicated (max 2 per file) and optionally trimmed to a token budget.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | yes | Natural language question or keyword phrase |
| `version` | `"v5"` \| `"v6"` \| `"both"` \| `"all"` | no | Version filter (default: `"all"`) |
| `limit` | number | no | Max results (default: 10, max: 50) |
| `tokensBudget` | number | no | Trim results so cumulative tokens ≤ this value |

**Example:**
```json
{
  "name": "search_docs",
  "arguments": { "query": "authentication jwt", "version": "v6", "limit": 5 }
}
```

---

### `submit_documentation`

Submits a **new** documentation file as a GitHub Pull Request. Content passes a six-stage validation pipeline before dispatch. Falls back to local staging when `GITHUB_TOKEN` is absent.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string (10–120 chars) | yes | PR title |
| `filePath` | string | yes | Path under `docs/(v5_docs\|v6_docs)/.../*.md` |
| `content` | string (100–50K chars) | yes | Full markdown content |
| `version` | `"v5"` \| `"v6"` | yes | Must match `filePath` prefix |
| `category` | string | no | Knowledge-base category |
| `description` | string (max 500) | no | PR body text |
| `contributorName` | string (max 100) | no | Attribution |

**Example:**
```json
{
  "name": "submit_documentation",
  "arguments": {
    "title": "Add Koa middleware guide for FeathersJS v6",
    "filePath": "docs/v6_docs/cookbook/koa-middleware.md",
    "content": "# Koa Middleware\n\nGuide content here...\n\n## Steps\n\n1. Install\n2. Configure\n",
    "version": "v6",
    "category": "cookbook",
    "contributorName": "Jane Doe"
  }
}
```

---

### `update_documentation`

Updates an **existing** documentation file via a GitHub Pull Request. The target file must already exist in the repository — use `submit_documentation` for new files instead.

**Parameters:** Same as `submit_documentation`.

**Example:**
```json
{
  "name": "update_documentation",
  "arguments": {
    "title": "Update hooks guide with around hook patterns",
    "filePath": "docs/v6_docs/guides/custom-hooks.md",
    "content": "# Custom Hooks (Updated)\n\nUpdated content here...\n\n## Around Hooks\n\n...",
    "version": "v6",
    "category": "hooks"
  }
}
```

---

### `remove_documentation`

Requests **removal** of an existing documentation file via a GitHub Pull Request. Verifies the file exists in the repository and also removes its corresponding chunks and embeddings from the knowledge-base JSON on the same branch.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filePath` | string | yes | Path of the file to remove |
| `version` | `"v5"` \| `"v6"` | yes | Must match `filePath` prefix |
| `reason` | string (10–500 chars) | yes | Why the document should be removed |
| `contributorName` | string (max 100) | no | Attribution |

**Example:**
```json
{
  "name": "remove_documentation",
  "arguments": {
    "filePath": "docs/v6_docs/cookbook/deprecated-guide.md",
    "version": "v6",
    "reason": "This guide covers a deprecated API removed in FeathersJS v6.",
    "contributorName": "Jane Doe"
  }
}
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full content guidelines.

---

## Six-Stage Validation Pipeline

All three contributor tools (`submit_documentation`, `update_documentation`, `remove_documentation`) share a validation pipeline before any GitHub API call is made:

| Stage | What is checked |
|-------|----------------|
| 1. Schema | Required fields, types, lengths |
| 2. Path restriction | Regex allowlist, no `..` / null bytes / backslashes, version–path consistency |
| 3. Content sanitization | Rejects `<script>`, `<iframe>`, `javascript:` URIs, large `data:` URIs |
| 4. Markdown lint | Requires `# Heading`, minimum prose content |
| 5. Existence check | `submit`: warns if file exists (update). `update`/`remove`: rejects if file does not exist |
| 6. Rate limiting | 1 operation per 60 seconds per server instance |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | No | Fine-grained PAT (`contents:write` + `pull_requests:write`). Without it, submissions save locally to `pending-contributions/` |
| `GITHUB_OWNER` | No | GitHub repo owner (default: `owner`) |
| `GITHUB_REPO` | No | GitHub repo name (default: `cspc319_feathersJS_C`) |
| `ALLOW_NETWORK_TOOLS` | No | Set to `"true"` to enable all three contributor tools. `search_docs` always works offline. |

---

## Development

```bash
npm install          # install dependencies
npm run build        # compile TypeScript
npm test             # run all tests with coverage
npm run lint         # lint code
npm run format       # format code
```

### Knowledge Base Scripts

```bash
npm run rebuild:kb   # full re-chunk + re-embed all docs
npm run update:kb    # incremental: chunk + embed only changed files
npm run test:submit  # run the submit_documentation manual test suite
```

### Run Tests

```bash
npm test                               # all 24 suites, ~260+ tests
npx jest tests/tools/ --runInBand      # unit tests only
npx jest tests/integration/ --runInBand # integration tests only
npx jest tests/e2e/ --runInBand        # e2e scenario tests only
```

---

## Project Structure

```
src/
├── index.ts               # entry point — wires all layers and starts server
├── protocol/              # MCP protocol layer
│   ├── server.ts          #   McpServer (SDK Server + stdio transport)
│   ├── registry.ts        #   ToolRegistry
│   ├── handlers/          #   listToolsHandler, callToolHandler
│   └── types.ts           #   JsonSchema, ToolResult, ToolRegistration
├── routing/               # Tool routing layer
│   ├── router.ts          #   Router (validate → gate → execute → timeout)
│   ├── validator.ts       #   ParameterValidator (AJV)
│   ├── errorHandler.ts    #   ErrorHandler (INVALID_PARAMS / TIMEOUT / INTERNAL_ERROR)
│   ├── timeout.ts         #   withTimeout + TimeoutError
│   └── toolRegistry.ts    #   ToolHandlerRegistry (routing-layer registry)
├── tools/                 # Tool implementations
│   ├── baseTool.ts        #   BaseTool abstract class
│   ├── searchDocs.ts      #   search_docs — BGE-M3 semantic search
│   ├── submitDocumentation.ts  # submit_documentation — new docs via PR
│   ├── updateDocumentation.ts  # update_documentation — update existing docs via PR
│   ├── removeDocumentation.ts  # remove_documentation — delete docs + chunks via PR
│   ├── github/            #   GitHubClient, sanitizer, types
│   └── search/            #   VectorSearch (BGE-M3 embeddings)
└── knowledge/             # Knowledge base loader + types
    ├── loader.ts          #   KnowledgeLoader (file-backed, cached)
    ├── searchIndex.ts     #   Substring fallback index (legacy stub)
    └── types.ts           #   DocEntry, TemplateFragment, etc.

knowledge-base/
└── chunks/
    ├── v5-chunks.json     # Pre-chunked v5 docs with BGE-M3 embeddings
    └── v6-chunks.json     # Pre-chunked v6 docs with BGE-M3 embeddings

tests/
├── tools/                 # Unit tests (baseTool, searchDocs, submit, update, remove, github, search)
├── integration/           # Router → Tool → GitHub mock flows (all 4 tools)
├── e2e/                   # Developer scenario tests (search + contributor workflows)
├── performance/           # Response-time benchmarks (p95 < 2000ms)
├── knowledge/             # KnowledgeLoader + chunk index tests
├── protocol/              # McpServer, ToolRegistry, callTool error tests
├── routing/               # Router, Validator, ErrorHandler, Timeout unit tests
└── helpers/               # MockTransport, shared test utilities
```

---

## Architecture

```
AI Client (Claude / VS Code / Cline)
        │  JSON-RPC over stdin/stdout
        ▼
┌─ Protocol Layer ──────────────────┐
│  McpServer · ToolRegistry         │
│  listToolsHandler · callToolHandler│
└───────────┬───────────────────────┘
            │
            ▼
┌─ Routing Layer ───────────────────┐
│  Router                           │
│  ParameterValidator (AJV)         │
│  Network-tier gate (G1.5)         │
│  withTimeout · ErrorHandler       │
└───────────┬───────────────────────┘
            │
            ▼
┌─ Tool Layer ──────────────────────┐
│  search_docs          (offline)   │
│  submit_documentation (network ✓) │
│  update_documentation (network ✓) │
│  remove_documentation (network ✓) │
└──────┬──────────────┬─────────────┘
       │              │
       ▼              ▼
┌─ Knowledge ──┐  ┌─ GitHub API ───┐
│  chunks/     │  │  PRs · Commits │
│  BGE-M3      │  │  Chunk cleanup │
└──────────────┘  └────────────────┘
```

### Network-Tier Gate (G1.5)

Tools that touch the network declare `requiresNetwork = true`. The `Router` blocks these unless `ALLOW_NETWORK_TOOLS=true` is set, returning a `NETWORK_NOT_ALLOWED` error. `search_docs` is always offline and unaffected.

---

## License

MIT

---

**CPSC 319 Project — University of British Columbia**
*Department of Computer Science — March 2026*
