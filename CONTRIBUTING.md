# Contributing Documentation

Submit documentation updates through the `submit_documentation` MCP tool.

## Quick Example

```json
{
  "name": "submit_documentation",
  "arguments": {
    "title": "Add Koa middleware guide for FeathersJS v6",
    "filePath": "docs/v6_docs/cookbook/koa-middleware.md",
    "content": "# Koa Middleware\n\nGuide content...\n\n## Steps\n\n1. Install\n2. Configure\n\n```typescript\nimport { koa } from '@feathersjs/koa';\n```\n",
    "version": "v6",
    "category": "cookbook",
    "contributorName": "Jane Doe"
  }
}
```

## Parameters

**Required:** `title` (10–120 chars), `filePath` (under `docs/v5_docs/` or `docs/v6_docs/`, ending `.md`), `content` (100–50K chars), `version` (`"v5"` or `"v6"`)

**Optional:** `category`, `description` (max 500), `contributorName` (max 100)

## Content Rules

- Must have at least one `# Heading`
- At least 50 chars of prose (after stripping code blocks)
- No `<script>`, `<iframe>`, `javascript:` URIs, or large `data:` URIs
- No path traversal (`..`), backslashes, null bytes, or double slashes in filePath
- Version in filePath must match `version` parameter

## What Happens

1. **Without `GITHUB_TOKEN`** — saved to `pending-contributions/` as JSON
2. **With `GITHUB_TOKEN` + `ALLOW_NETWORK_TOOLS=true`** — creates a GitHub PR on branch `docs/contrib/<timestamp>-<slug>`

## Admin Setup

```bash
export GITHUB_TOKEN=ghp_xxx      # fine-grained PAT with contents:write + pull_requests:write
export GITHUB_OWNER=<owner>
export GITHUB_REPO=cspc319_feathersJS_C
export ALLOW_NETWORK_TOOLS=true
```

## Allowed Categories

`application`, `authentication`, `channels`, `cli`, `client`, `comparison`, `configuration`, `cookbook`, `cookbook-authentication`, `cookbook-express`, `databases`, `deployment`, `ecosystem`, `errors`, `events`, `express`, `frontend`, `frameworks`, `general`, `guides`, `help`, `hooks`, `koa`, `migration`, `release-notes`, `runtime`, `schema`, `security`, `services`, `socketio`, `testing`, `transport`