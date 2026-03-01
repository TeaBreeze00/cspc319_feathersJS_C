# Contributing Documentation to FeathersJS MCP Server

Thank you for your interest in contributing to the FeathersJS MCP Server documentation! This guide explains how to submit documentation updates or new docs using the built-in `submit_documentation` MCP tool.

## How It Works

The FeathersJS MCP Server includes a **contributor documentation pipeline** that allows you to submit documentation directly through the MCP interface. Your submission is:

1. **Validated locally** (schema, path, content sanitization, markdown lint, duplication check)
2. **Automatically turned into a GitHub Pull Request** for admin review
3. **Merged by admins** through GitHub's standard PR review workflow
4. **Automatically rebuilt** into the knowledge base upon merge

## Using the `submit_documentation` Tool

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `title` | string (10–120 chars) | PR title describing the documentation change |
| `filePath` | string | Target file path, must match `docs/(v5_docs\|v6_docs)/.../*.md` |
| `content` | string (100–50,000 chars) | Full markdown content |
| `version` | `"v5"` or `"v6"` | FeathersJS version (must match filePath prefix) |

### Optional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Knowledge-base category (e.g., `hooks`, `services`, `cookbook`) |
| `description` | string (max 500 chars) | PR body text explaining the change |
| `contributorName` | string (max 100 chars) | Your name for attribution in the PR |

### Example

```json
{
  "name": "submit_documentation",
  "arguments": {
    "title": "Add Koa middleware guide for FeathersJS v6",
    "filePath": "docs/v6_docs/cookbook/koa-middleware.md",
    "content": "# Koa Middleware\n\nThis guide explains how to use Koa middleware with FeathersJS v6.\n\n## Prerequisites\n\nYou need Node.js 20+ installed.\n\n## Steps\n\n1. Install the package\n2. Configure middleware\n3. Run the server\n\n```typescript\nimport { feathers } from '@feathersjs/feathers';\nimport { koa } from '@feathersjs/koa';\n\nconst app = koa(feathers());\n```\n",
    "version": "v6",
    "category": "cookbook",
    "description": "Comprehensive guide for Koa middleware integration",
    "contributorName": "Jane Doe"
  }
}
```

### Allowed Categories

`application`, `authentication`, `channels`, `cli`, `client`, `comparison`, `configuration`, `cookbook`, `cookbook-authentication`, `cookbook-express`, `databases`, `deployment`, `ecosystem`, `errors`, `events`, `express`, `frontend`, `frameworks`, `general`, `guides`, `help`, `hooks`, `koa`, `migration`, `release-notes`, `runtime`, `schema`, `security`, `services`, `socketio`, `testing`, `transport`

## Content Guidelines

### Requirements

- Must contain at least one top-level heading (`# Title`)
- Must have at least 100 characters of content (50 chars of prose after removing code blocks)
- Should include code examples where relevant (FeathersJS docs are example-rich)
- Must target either v5 or v6 documentation

### Prohibited Content

The following will cause your submission to be **rejected**:

- `<script>` tags
- `<iframe>` tags
- `javascript:` URIs
- Large base64 `data:` URIs (>1KB)

### File Path Rules

- Must be under `docs/v5_docs/` or `docs/v6_docs/`
- Must end in `.md`
- No path traversal (`..`, `.`)
- No backslashes, null bytes, or double slashes
- Version in path must match the `version` parameter

## Environment Setup (for Admins)

To enable the contributor pipeline, set these environment variables:

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Fine-grained PAT
export GITHUB_OWNER=<repo-owner>
export GITHUB_REPO=cspc319_feathersJS_C
export ALLOW_NETWORK_TOOLS=true
```

### Token Requirements

- **Type:** Fine-grained Personal Access Token (PAT)
- **Scope:** `contents:write` + `pull_requests:write` on the target repository
- **Rotation:** Rotate every 90 days
- **Storage:** Environment variable only — never commit to the repository

### Offline Mode

When `GITHUB_TOKEN` is not set, submissions are saved locally to `pending-contributions/` as JSON files. Admins can batch-submit these later.

## Review Process

1. Contributor submits via the `submit_documentation` tool
2. A PR is auto-created on branch `docs/contrib/<timestamp>-<slug>`
3. PR includes validation results, contributor attribution, and metadata
4. Admins review in GitHub's standard PR interface
5. On merge, GitHub Actions rebuilds the knowledge base automatically

## Rate Limits

- **Tool-level:** 1 submission per 60 seconds per server instance
- **GitHub API:** 5,000 requests/hour (authenticated)
- **Content size:** 50KB maximum per submission

## Questions?

For issues or questions about the contributor pipeline, please see the [Technical Documentation](docs/TECHNICAL_DOCUMENTATION.md) or the [Contributor Pipeline Plan](docs/CONTRIBUTOR_PIPELINE_PLAN.md).
