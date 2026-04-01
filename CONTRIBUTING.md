# Contributing

This file is for people working on this repository. If you only want to use the published MCP server, follow the quick setup in [README.md](README.md) and run:

```sh
npx feathersjs-mcp-server@latest init
```

## Repo Layout

- Repository root: MCP server source, CLI, tests, docs, and knowledge base.
- `ui/`: optional browser-based test harness for local debugging.

## Local Development Prerequisites

- Node.js 20+
- `npm`
- `git`
- Internet access if you want to exercise GitHub-backed documentation tools

No database, seed step, or migration step is required.

## Local Setup

```sh
git clone https://github.com/TeaBreeze00/cspc319_feathersJS_C.git
cd cspc319_feathersJS_C
npm install
npm run build
```

## Running The Project Locally

### Start The MCP Server

```sh
npm start
```

The server runs over stdio. It does not open an HTTP port.

### Run The CLI Wizard From Source

```sh
node dist/cli.js init
```

This writes the same published-package MCP config as `npx feathersjs-mcp-server@latest init`. It does not automatically configure a client to launch your local checkout.

### Run Diagnostics From Source

```sh
node dist/cli.js doctor
```

## Tests And Quality Checks

```sh
npm test
npm run lint
npm run format
```

## Optional Browser Test UI

If you want a local browser bridge for manual testing:

```sh
cd ui
npm install
npm start
```

Open `http://localhost:4000`.

## Environment Variables For Source Development

The published `init` flow writes client configuration automatically. When you run the server directly from this repo, set environment variables yourself if you want the GitHub-backed tools to work.

```sh
export ALLOW_NETWORK_TOOLS=true
export GITHUB_TOKEN=<fine-grained-token>
export GITHUB_OWNER=TeaBreeze00
export GITHUB_REPO=cspc319_feathersJS_C
```

Notes:

- `search_docs` works without these variables.
- `submit_documentation`, `update_documentation`, and `remove_documentation` require both `ALLOW_NETWORK_TOOLS=true` and `GITHUB_TOKEN` when running from source.
- The server will also load `.env` files from the repo root or `ui/.env` if present.

## Documentation Tool Summary

The MCP server exposes four tools:

| Tool | Purpose | Network required? |
|------|---------|-------------------|
| `search_docs` | Search the bundled FeathersJS knowledge base | No |
| `submit_documentation` | Open a PR that adds a new documentation file | Yes |
| `update_documentation` | Open a PR that updates an existing documentation file | Yes |
| `remove_documentation` | Open a PR that removes an existing documentation file | Yes |

All three write-capable tools are rate-limited to one operation per 60 seconds per server instance.

## Knowledge Base Maintenance

Use these commands when you change the bundled documentation or chunk data:

```sh
npm run update:kb
npm run rebuild:kb
npm run test:submit
```

Guidance:

- Use `npm run update:kb` after normal documentation edits.
- Use `npm run rebuild:kb` when the full chunk set or embedding data needs regeneration.
- Do not hand-edit generated chunk files unless you are intentionally repairing generated output.

## Before Opening A PR

- Run `npm run build`.
- Run `npm test`.
- Update generated knowledge-base files if your change affects docs or chunk output.
- Keep README user-facing and keep repo-development details in this file.
