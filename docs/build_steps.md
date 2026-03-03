<!-- This document is archived. The original build steps referenced 15 tools.
     The server now provides 2 tools: search_docs and submit_documentation.
     See README.md for the current architecture and tool documentation. -->


# Build Steps

## Standard build

```bash
npm ci
npm run build    # tsc → dist/
npm test         # 24 suites, ~260+ tests, ≥ 80% coverage
```

## Knowledge-base rebuild

```bash
npm run rebuild:kb   # full re-chunk + re-embed all docs (v5 + v6)
npm run update:kb    # incremental: only changed files
```

## Run the server

```bash
node dist/index.js   # MCP stdio server
```

## Environment variables (for contributor tools)

```bash
export GITHUB_TOKEN=ghp_xxx
export GITHUB_OWNER=<owner>
export GITHUB_REPO=cspc319_feathersJS_C
export ALLOW_NETWORK_TOOLS=true
```

> See [README.md](../README.md) and [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md) for full documentation.