# Test Submission Guide

This is a manual test of the contributor pipeline for FeathersJS v6.

## Overview

The `submit_documentation` tool lets contributors submit docs as GitHub PRs
directly through the MCP interface.

## Steps

1. Call the tool with valid parameters
2. The server runs a 6-stage local validation pipeline
3. If `GITHUB_TOKEN` is set a PR is created; otherwise the submission is staged locally
4. An admin reviews and merges the PR
5. GitHub Actions rebuilds the knowledge base on merge

## Example

```typescript
const result = await tool.execute({
  title: 'Add new cookbook guide',
  filePath: 'docs/v6_docs/cookbook/my-guide.md',
  content: '# My Guide\n\n...',
  version: 'v6',
});
```
