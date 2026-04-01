# FeathersJS MCP Server

FeathersJS MCP Server is a published Model Context Protocol (MCP) server for FeathersJS documentation. It gives supported AI clients four tools: `search_docs`, `submit_documentation`, `update_documentation`, and `remove_documentation`.

## Project Overview

This project lets an AI coding assistant search a bundled FeathersJS knowledge base and, when network tools are enabled, open GitHub pull requests for documentation changes. The recommended way to use it is the published npm release, not a manual clone-and-build workflow.

## Repository / Folder To Use

Use the repository root, `cspc319_feathersJS_C/`, for all server, test, and build commands in this README.

- Root folder: the MCP server, CLI setup wizard, tests, and knowledge base.
- `ui/`: optional browser-based test harness for local debugging. It is not required for normal use.

## Quick Setup (Recommended)

This is the setup path the teaching team should use.

### Environment Assumptions

- Operating system: macOS or Windows is assumed for the guided client setup flow.
- Runtime: Node.js 20 or newer.
- Package manager: `npm` / `npx`.
- Database: none.
- Migrations / seeding / background services: none.
- Environment variables: none are required for the basic `search_docs` flow.
- Third-party services / accounts: one supported AI client is required. GitHub access is only needed if you enable the documentation write tools.
- Local login: no login exists inside this MCP server, but you must already be signed in to your chosen AI client if that client requires an account.

### Prerequisites

<<<<<<< HEAD
- **Node.js 20+** — [nodejs.org](https://nodejs.org/)
- An MCP-compatible AI client: Claude Desktop, Claude Code CLI, Cursor, Windsurf, VS Code (GitHub Copilot), or Codex CLI

### 1. Run the setup wizard

```bash
npx feathersjs-mcp-server@latest init
```

The wizard will:
- Detect which AI tools are installed on your machine
- Ask which ones to configure
- Optionally enable network tools (submit/update/remove docs via GitHub PR — no token required)
- Write the MCP config into each tool's config file automatically

### 2. Restart your AI client

The assistant now has access to FeathersJS documentation search and all three contribution tools.

### 3. Try it

```
Search the FeathersJS docs for how hooks work in v6
```

### Diagnostics

If something isn't working, run:

```bash
npx feathersjs-mcp-server@latest doctor
```

---

### Manual Configuration (optional)

If you prefer to configure your AI client by hand instead of using the wizard:

#### Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS)

```json
{
  "mcpServers": {
    "feathersjs": {
      "command": "npx",
      "args": ["feathersjs-mcp-server"]
    }
  }
}
```

#### Cursor (`~/.cursor/mcp.json`) / Windsurf (`~/.codeium/windsurf/mcp_config.json`)

```json
{
  "mcpServers": {
    "feathersjs": {
      "command": "npx",
      "args": ["feathersjs-mcp-server"]
    }
  }
}
```

#### VS Code — GitHub Copilot (`~/Library/Application Support/Code/User/mcp.json` on macOS)

```json
{
  "servers": {
    "feathersjs": {
      "type": "stdio",
      "command": "npx",
      "args": ["feathersjs-mcp-server"]
    }
  }
}
```

To enable network tools, add an `env` block to any of the above:

```json
"env": {
  "ALLOW_NETWORK_TOOLS": "true"
}
```

No GitHub token is required — the wizard and the package include a shared token scoped to this project.

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
=======
Install Node.js and at least one MCP-compatible client.

- Node.js download: [nodejs.org/en/download](https://nodejs.org/en/download)
- Claude Code: [docs.anthropic.com/en/docs/claude-code/overview](https://docs.anthropic.com/en/docs/claude-code/overview)
- Claude Desktop: [claude.ai/download](https://claude.ai/download)
- Cursor: [cursor.com](https://cursor.com)
- Windsurf: [windsurf.com/editor](https://windsurf.com/editor)
- VS Code: [code.visualstudio.com/download](https://code.visualstudio.com/download)

The setup wizard can configure these supported clients when they are installed:

- Claude Code (CLI)
- Codex (CLI)
- Claude Desktop
- Cursor
- Windsurf
- VS Code (GitHub Copilot)

### Setup Steps

1. Run the published setup wizard:

```sh
npx feathersjs-mcp-server@latest init
```

2. In the wizard:

- Select the AI client(s) you want configured.
- Choose whether to enable network tools.

3. Restart the AI client you configured.

4. Verify the install:

```sh
npx feathersjs-mcp-server@latest doctor
```

5. Try a prompt in your AI client, for example:

```text
Search the FeathersJS docs for hooks in v6
```

### How The App Runs

For normal usage, there is no separate web app to open and no database to start. After `init`, your AI client launches the MCP server automatically when needed.

If you want to start the published server manually from a terminal, run:

```sh
npx feathersjs-mcp-server@latest
```

The MCP server communicates over stdio, so it does not expose a default HTTP port.

## Local Access Points

- Main MCP server: stdio only, no default localhost URL.
- Optional browser test UI: `http://localhost:4000` after starting `ui/server.js`.

## Features And Requirements

- `search_docs` works locally without a database.
- `submit_documentation`, `update_documentation`, and `remove_documentation` require network access.
- No personal GitHub token is required for the recommended `init` workflow; the wizard writes the needed MCP configuration for you.
- If your machine is offline, only `search_docs` is expected to work.
- There are no deployment-only features; the same MCP server can be used locally.

## Run From A Repository Checkout

Use this only if you want to inspect or develop the code locally. For normal usage, prefer the `npx ... init` flow above.

### Clone The Repo

```sh
git clone https://github.com/TeaBreeze00/cspc319_feathersJS_C.git
cd cspc319_feathersJS_C
```

### Install Dependencies

```sh
npm install
```

### Build The Server

```sh
npm run build
```

### Optional: Run The Setup Wizard From A Local Checkout

```sh
node dist/cli.js init
```

This runs the same wizard as the published release and writes client config that launches `npx feathersjs-mcp-server`. It does not point the client at your local checkout automatically.

### Run The Doctor Check From Source

```sh
node dist/cli.js doctor
```

### Start The Server From Source

```sh
npm start
```

This also runs over stdio, not an HTTP port.
>>>>>>> 434a832b8600039ad161dcafdb76c3529359fa3e

### Run Tests

```sh
npm test
```

### Run Linting

```sh
npm run lint
```

### Knowledge Base Commands

These are only needed for repo development:

```sh
npm run update:kb
npm run rebuild:kb
npm run test:submit
```

## Optional Browser Test UI

The optional UI lives in `ui/` and is only for local debugging.

```sh
cd ui
npm install
npm start
```

Then open `http://localhost:4000`.

## Additional Notes

- No database setup is required.
- No seed command is required.
- No migration command is required.
- If you only want to use the server, you do not need to clone this repository.

For implementation details and architecture, see [docs/TECHNICAL_DOCUMENTATION.md](docs/TECHNICAL_DOCUMENTATION.md).

## License

MIT
