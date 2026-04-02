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
