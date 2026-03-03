# Contributing Documentation

The FeathersJS MCP Server provides **three contributor tools** for managing documentation via GitHub Pull Requests. All three tools share the same validation pipeline and require `ALLOW_NETWORK_TOOLS=true` to create PRs.

---

## Tools at a Glance

| Tool | Purpose | File must exist? |
|------|---------|-----------------|
| `submit_documentation` | Submit a **new** doc | No (warns if it already exists) |
| `update_documentation` | Update an **existing** doc | **Yes** (rejects if missing) |
| `remove_documentation` | Delete an **existing** doc + its chunks/embeddings | **Yes** (rejects if missing) |

---

## `submit_documentation`

Creates a PR adding a new documentation file.

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

**Parameters:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title` | string | yes | 10–120 characters |
| `filePath` | string | yes | Must match `docs/(v5_docs\|v6_docs)/.../*.md` |
| `content` | string | yes | 100–50,000 characters |
| `version` | `"v5"` \| `"v6"` | yes | Must match `filePath` prefix |
| `category` | string | no | See allowed categories below |
| `description` | string | no | Max 500 characters, goes into PR body |
| `contributorName` | string | no | Max 100 characters, for attribution |

---

## `update_documentation`

Creates a PR updating an existing documentation file. The target file **must already exist** in the repository.

```json
{
  "name": "update_documentation",
  "arguments": {
    "title": "Update hooks guide with around hook patterns for v6",
    "filePath": "docs/v6_docs/guides/custom-hooks.md",
    "content": "# Custom Hooks (Updated)\n\nThis guide covers the updated hook patterns in FeathersJS v6.\n\n## Around Hooks\n\nAround hooks wrap the entire service method call.\n",
    "version": "v6",
    "category": "hooks",
    "contributorName": "Jane Doe"
  }
}
```

**Parameters:** Same as `submit_documentation`. If the file does not exist, the tool rejects the request and suggests using `submit_documentation` instead.

---

## `remove_documentation`

Creates a PR deleting an existing documentation file **and** removing its related chunks and embeddings from `knowledge-base/chunks/*.json` on the same branch. The target file **must already exist** in the repository.

```json
{
  "name": "remove_documentation",
  "arguments": {
    "filePath": "docs/v6_docs/cookbook/deprecated-guide.md",
    "version": "v6",
    "reason": "This guide covers a deprecated API that was removed in FeathersJS v6. The replacement guide is at docs/v6_docs/cookbook/koa-middleware.md.",
    "contributorName": "Jane Doe"
  }
}
```

**Parameters:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `filePath` | string | yes | Must match `docs/(v5_docs\|v6_docs)/.../*.md` |
| `version` | `"v5"` \| `"v6"` | yes | Must match `filePath` prefix |
| `reason` | string | yes | 10–500 characters |
| `contributorName` | string | no | Max 100 characters |

---

## Six-Stage Validation Pipeline

Every contributor tool runs through this pipeline before touching GitHub:

1. **Schema validation** — Required fields, type checks, length constraints
2. **Path restriction** — Regex allowlist · no `..` · no null bytes · no backslashes · version–path consistency
3. **Content sanitization** — Hard-rejects `<script>`, `<iframe>`, `javascript:` URIs, large `data:` URIs (`submit`/`update` only)
4. **Markdown lint** — Requires `# Heading`, minimum 50 chars of prose after stripping code blocks (`submit`/`update` only)
5. **Existence check** — `submit`: warns if file exists. `update`/`remove`: rejects if file does not exist
6. **Rate limiting** — 1 operation per 60 seconds per server instance

---

## Content Rules (submit & update)

- Must have at least one `# Heading`
- At least 50 chars of prose (after stripping code blocks)
- No `<script>`, `<iframe>`, `javascript:` URIs, or large `data:` URIs
- No path traversal (`..`), backslashes, null bytes, or double slashes in `filePath`
- `version` in `filePath` must match the `version` parameter

---

## What Happens on Dispatch

### With `GITHUB_TOKEN` + `ALLOW_NETWORK_TOOLS=true`

| Tool | GitHub API calls | What is created |
|------|-----------------|----------------|
| `submit_documentation` | 4–5 | Branch → commit file → open PR |
| `update_documentation` | 5 | Branch → get existing SHA → update file → open PR |
| `remove_documentation` | 5–7 | Branch → delete file → remove chunks from JSON → open PR |

Branch names are server-generated: `docs/contrib/<timestamp>-<slug>`

### Without `GITHUB_TOKEN`

Submissions are saved as JSON files in `pending-contributions/` (gitignored). Admins can batch-submit these later. **Note:** `remove_documentation` requires `GITHUB_TOKEN` as it needs to read the live file SHA from GitHub — it does not support local staging.

---

## Admin Setup

```bash
export GITHUB_TOKEN=ghp_xxx            # fine-grained PAT: contents:write + pull_requests:write
export GITHUB_OWNER=<owner>
export GITHUB_REPO=cspc319_feathersJS_C
export ALLOW_NETWORK_TOOLS=true
```

---

## Allowed Categories

`application`, `authentication`, `channels`, `cli`, `client`, `comparison`, `configuration`, `cookbook`, `cookbook-authentication`, `cookbook-express`, `databases`, `deployment`, `ecosystem`, `errors`, `events`, `express`, `frontend`, `frameworks`, `general`, `guides`, `help`, `hooks`, `koa`, `migration`, `release-notes`, `runtime`, `schema`, `security`, `services`, `socketio`, `testing`, `transport`