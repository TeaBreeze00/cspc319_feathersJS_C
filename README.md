# FeathersJS MCP Server

A Model Context Protocol (MCP) server that provides AI coding assistants with structured FeathersJS documentation search and a contributor documentation pipeline.

## Overview

The FeathersJS MCP Server connects AI assistants (Claude Desktop, VS Code Copilot, Cline) to a curated FeathersJS knowledge base via the MCP standard. It exposes **2 tools**:

| Tool | Description |
|------|-------------|
| `search_docs` | Search FeathersJS v5/v6 documentation with BM25 + vector ranking |
| `submit_documentation` | Submit new docs or updates as GitHub PRs for admin review |

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
      "args": ["/absolute/path/to/cspc319_feathersJS_C/dist/index.js"]
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

The assistant now has access to FeathersJS documentation search and contribution tools.

### 5. Try it

```
Search the FeathersJS docs for how hooks work in v6
```

## Tools

### `search_docs`

Searches the embedded FeathersJS knowledge base using BM25 keyword matching combined with BGE-M3 vector similarity.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | yes | Search query |
| `version` | `"v5"` \| `"v6"` \| `"all"` | no | Filter by version (default: `"all"`) |
| `limit` | number | no | Max results (default: 10, max: 20) |

**Example:**
```json
{
  "name": "search_docs",
  "arguments": { "query": "authentication jwt", "version": "v6", "limit": 5 }
}
```

### `submit_documentation`

Submits documentation as a GitHub Pull Request (or saves locally if no token is set). Content passes a 6-stage validation pipeline before dispatch.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string (10–120 chars) | yes | PR title |
| `filePath` | string | yes | Path under `docs/(v5_docs\|v6_docs)/.../*.md` |
| `content` | string (100–50K chars) | yes | Full markdown content |
| `version` | `"v5"` \| `"v6"` | yes | Must match filePath prefix |
| `category` | string | no | Knowledge-base category |
| `description` | string (max 500) | no | PR body text |
| `contributorName` | string (max 100) | no | Attribution |

**Example:**
```json
{
  "name": "submit_documentation",
  "arguments": {
    "title": "Add Koa middleware guide",
    "filePath": "docs/v6_docs/cookbook/koa-middleware.md",
    "content": "# Koa Middleware\n\nGuide content here...\n\n## Steps\n\n1. Install\n2. Configure\n3. Run\n",
    "version": "v6",
    "category": "cookbook",
    "contributorName": "Jane Doe"
  }
}
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full content guidelines.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | No | Fine-grained PAT for creating PRs. Without it, submissions save locally to `pending-contributions/` |
| `GITHUB_OWNER` | No | GitHub repo owner (default: `owner`) |
| `GITHUB_REPO` | No | GitHub repo name (default: `cspc319_feathersJS_C`) |
| `ALLOW_NETWORK_TOOLS` | No | Set to `true` to enable `submit_documentation` GitHub integration |

## Development

```bash
npm install          # install dependencies
npm run build        # compile TypeScript
npm test             # run tests with coverage
npm run lint         # lint code
npm run format       # format code
```

### Knowledge Base Scripts

```bash
npm run rebuild:kb   # full re-chunk + re-embed all docs
npm run update:kb    # incremental: chunk + embed only changed files
npm run test:submit  # run the submit_documentation manual test suite
```

### Project Structure

```
src/
├── protocol/        # MCP protocol layer (server, registry, handlers)
├── routing/         # Tool routing, validation, error handling, timeout
├── tools/           # Tool implementations
│   ├── searchDocs.ts
│   ├── submitDocumentation.ts
│   ├── github/      # GitHub client + content sanitizer
│   └── search/      # BM25 + vector search
└── knowledge/       # Knowledge base loader + types
knowledge-base/
└── chunks/          # Pre-chunked v5/v6 docs with embeddings
tests/
├── tools/           # Unit tests
├── integration/     # Full-flow integration tests
├── e2e/             # Developer scenario tests
└── performance/     # Response-time benchmarks
```

## Architecture

```
AI Client (Claude / VS Code / Cline)
        │  JSON-RPC over stdin/stdout
        ▼
┌─ Protocol Layer ──────────────┐
│  MCP Server + Transport       │
└───────────┬───────────────────┘
            ▼
┌─ Routing Layer ───────────────┐
│  Validation · Timeout · Errors│
└───────────┬───────────────────┘
            ▼
┌─ Tool Layer ──────────────────┐
│  search_docs                  │
│  submit_documentation         │
└───────────┬───────────────────┘
            ▼
┌─ Knowledge Layer ─────────────┐
│  Chunked docs · Embeddings    │
└───────────────────────────────┘
```

## License

MIT

---

**CPSC 319 Project — University of British Columbia**
*Department of Computer Science — March 2026*