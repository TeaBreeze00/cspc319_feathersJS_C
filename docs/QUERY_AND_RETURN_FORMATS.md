# Query and Return Formats Reference

This document defines the query formats and return formats used by the project.
It is intended as a quick reference for developers integrating with the server or contributing new tools.

## 1. Scope and Terminology

### 1.1 Layers covered
- MCP protocol queries (`initialize`, `tools/list`, `tools/call`)
- Tool-specific argument and payload formats
- Internal module query/return contracts (`protocol` handlers, `routing`, `knowledge`)

### 1.2 Wrapper vs payload
For `tools/call`, there are two levels of data:
1. MCP result wrapper (from MCP SDK and protocol server)
2. Tool payload text (JSON string inside `content[0].text`)

For implemented tools, the payload is JSON-serialized text.

---

## 2. Query Types and When to Use Them

| Query Type | Layer | When to Use | Returns |
|---|---|---|---|
| `initialize` | MCP | First request in an MCP session | Server capability negotiation response |
| `tools/list` | MCP | Discover available tools and schemas | Tool metadata array |
| `tools/call` + `search_docs` | MCP Tool | Search documentation content | Ranked docs payload (as text JSON) |
| `tools/call` + `get_feathers_template` | MCP Tool | Build project template output from fragments | Template/file-tree payload (as text JSON) |
| `tools/call` + `generate_service` | MCP Tool | Generate service scaffolding files | Generated files payload (as text JSON) |
| `callToolHandler(...)` | Protocol module | Internal invocation of tool by name | `ToolResult` or throw |
| `Router.route(...)` | Routing module | Internal validated execution path | `ToolResponse` success/error wrapper |
| `KnowledgeLoader.load(...)` | Knowledge module | Read KB entries by category/file | Typed array of records |

---

## 3. MCP Protocol Query Formats

## 3.1 `initialize`

### When to use
Required first message before other MCP calls.

### Request format
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "your-client",
      "version": "1.0.0"
    }
  }
}
```

### Return format
Handled by MCP SDK handshake flow. Response contains negotiated protocol/capability info.

---

## 3.2 `tools/list`

### When to use
Use to discover supported tools and their input schemas.

### Request format
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

### Return format
`result.tools` is an array of:
```json
{
  "name": "string",
  "description": "string",
  "inputSchema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

### Example tool entry
```json
{
  "name": "search_docs",
  "description": "Searches the FeathersJS documentation knowledge base and returns the most relevant entries.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "limit": { "type": "number", "minimum": 1, "maximum": 50 },
      "version": { "type": "string", "enum": ["v4", "v5", "both", "all"] }
    },
    "required": ["query"],
    "additionalProperties": false
  }
}
```

---

## 3.3 `tools/call`

### When to use
Invoke any registered tool with arguments.

### Request format
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": {}
  }
}
```

### Generic success return format
```json
{
  "content": [
    {
      "type": "text",
      "text": "<tool payload JSON string>"
    }
  ]
}
```

### Generic error return format
```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: <message>"
    }
  ],
  "isError": true
}
```

### Error cases currently implemented
- Missing tool name -> `Error: Missing tool name`
- Unknown tool -> `Error: Unknown tool: <name>`
- Tool throw -> `Error: <exception message>`

---

## 4. Tool Query and Return Formats

## 4.1 `search_docs`

### When to use
Find relevant documentation entries by keyword/topic.

### `arguments` input structure
```json
{
  "query": "string, required",
  "limit": "number, optional, 1..50, default 10",
  "version": "optional enum: v4 | v5 | both | all, default v5"
}
```

### Input schema (exact)
```json
{
  "type": "object",
  "properties": {
    "query": { "type": "string" },
    "limit": { "type": "number", "minimum": 1, "maximum": 50 },
    "version": { "type": "string", "enum": ["v4", "v5", "both", "all"] }
  },
  "required": ["query"],
  "additionalProperties": false
}
```

### Tool payload return structure (inside `content[0].text`)
```json
{
  "query": "string",
  "version": "v4|v5|both|all",
  "results": [
    {
      "id": "string",
      "title": "string",
      "version": "v4|v5|both",
      "category": "string",
      "source": { "url": "string?", "path": "string?" },
      "score": "number (normalized)",
      "snippet": "string"
    }
  ]
}
```

### Notes
- Empty/invalid query resolves to an empty `results` array.
- Result ranking uses BM25.

---

## 4.2 `get_feathers_template`

### When to use
Generate a composed template/file tree for a selected DB/auth/language configuration.

### `arguments` input structure
```json
{
  "database": "required enum: mongodb | postgresql | sqlite",
  "auth": "optional boolean, default false",
  "typescript": "optional boolean, default true",
  "version": "optional enum: v4 | v5 | both, default v5"
}
```

### Input schema (exact)
```json
{
  "type": "object",
  "properties": {
    "database": { "type": "string", "enum": ["mongodb", "postgresql", "sqlite"] },
    "auth": { "type": "boolean" },
    "typescript": { "type": "boolean" },
    "version": { "type": "string", "enum": ["v4", "v5", "both"] }
  },
  "required": ["database"],
  "additionalProperties": false
}
```

### Success payload return structure (inside `content[0].text`)
```json
{
  "database": "mongodb|postgresql|sqlite",
  "auth": true,
  "typescript": true,
  "version": "v4|v5|both",
  "dependencies": ["string"],
  "featureFlags": ["string"],
  "files": {
    "<path>": {
      "path": "string",
      "content": "string",
      "size": "number"
    }
  }
}
```

### No-match payload variation
If no fragments match:
```json
{
  "error": "No matching templates found for the specified configuration",
  "database": "...",
  "auth": false,
  "typescript": true,
  "version": "v5"
}
```

### Notes
- This no-match case is returned as normal tool payload text (not MCP `isError: true`).

---

## 4.3 `generate_service`

### When to use
Generate service scaffolding files for a named service and field list.

### `arguments` input structure
```json
{
  "name": "string, required",
  "database": "required enum: mongodb | postgresql | sqlite",
  "fields": [
    {
      "name": "string, required",
      "type": "required enum: string|number|boolean|date|objectId|array|object",
      "required": "optional boolean",
      "unique": "optional boolean"
    }
  ]
}
```

### Input schema (exact)
```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "database": { "type": "string", "enum": ["mongodb", "postgresql", "sqlite"] },
    "fields": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "type": { "type": "string", "enum": ["string", "number", "boolean", "date", "objectId", "array", "object"] },
          "required": { "type": "boolean" },
          "unique": { "type": "boolean" }
        },
        "required": ["name", "type"]
      }
    }
  },
  "required": ["name", "database", "fields"],
  "additionalProperties": false
}
```

### Success payload return structure (inside `content[0].text`)
```json
{
  "name": "sanitized service name",
  "database": "mongodb|postgresql|sqlite",
  "fieldCount": 2,
  "files": {
    "src/services/<name>/<name>.service.ts": {
      "path": "string",
      "content": "string",
      "type": "service|hooks|schema|test",
      "size": "number"
    }
  }
}
```

### Notes
- `name` is normalized to lowercase alphanumeric (`sanitizeName` behavior).
- Invalid database, missing name, missing/empty fields, or invalid field type throws and becomes MCP error response (`isError: true`).

---

## 5. Variations by Tool and Module

## 5.1 Protocol vs direct tool invocation

### Via MCP (`McpServer`)
`tools/call` returns normalized MCP content parts:
```json
{
  "content": [{ "type": "text", "text": "..." }],
  "isError": false
}
```

### Via direct tool class call (`tool.execute(...)`)
Returns `ToolResult`:
```json
{
  "content": "JSON string",
  "metadata": {
    "tool": "search_docs",
    "...": "..."
  }
}
```

Important variation:
- Tool `metadata` is available in direct execution.
- MCP normalization currently returns `content` and optional `isError`; metadata is not forwarded in current server path.

---

## 5.2 `callToolHandler(...)` variations (`src/protocol/handlers/callTool.ts`)

### If constructed with `Router`
Input:
```ts
{ name: string; arguments?: unknown }
```
Output:
- On success: `Promise<ToolResult>`
- On failure: throws `Error`

### If constructed with `ToolRegistry`
Input:
```ts
{ name: string; arguments?: unknown }
```
Output:
- On success: `Promise<ToolResult>`
- On failure: throws `Error` (`Missing tool name`, `Unknown tool`, etc.)

---

## 5.3 Routing module query format (`Router.route`)

### Input format
```json
{
  "toolName": "string",
  "params": {}
}
```

### Return format
```json
{
  "success": true,
  "data": "tool result"
}
```
or
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMS|TIMEOUT|INTERNAL_ERROR",
    "message": "string",
    "details": {}
  }
}
```

---

## 5.4 Knowledge module query formats

## `KnowledgeLoader.load(category, file?)`

### Input format
- `category`: folder name under `knowledge-base`
- `file` (optional): file name without `.json`

Examples:
- `load("docs")`
- `load("snippets", "hooks-before")`

### Return format
- `Promise<T[]>` where `T` depends on category (`DocEntry`, `TemplateFragment`, etc.)
- Returns `[]` for missing category/file
- Throws on invalid JSON when loading a specific file path

## `KnowledgeLoader.buildIndex()`

### Return format
```json
{
  "byCategory": { "<category>": ["DocEntry", "..."] },
  "templates": [],
  "snippets": [],
  "patterns": [],
  "bestPractices": []
}
```

---

## 6. Tool-Specific Quick Reference

| Tool | Minimum Arguments | Key Optional Arguments | Payload Keys |
|---|---|---|---|
| `search_docs` | `query` | `limit`, `version` | `query`, `version`, `results[]` |
| `get_feathers_template` | `database` | `auth`, `typescript`, `version` | `database`, `auth`, `typescript`, `version`, `dependencies`, `featureFlags`, `files` |
| `generate_service` | `name`, `database`, `fields[]` | field-level `required`, `unique` | `name`, `database`, `fieldCount`, `files` |

---

## 7. End-to-End Example

## 7.1 Request
```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": {
    "name": "search_docs",
    "arguments": {
      "query": "hooks",
      "limit": 3,
      "version": "v5"
    }
  }
}
```

## 7.2 MCP result wrapper
```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\n  \"query\": \"hooks\",\n  \"version\": \"v5\",\n  \"results\": [ ... ]\n}"
      }
    ]
  }
}
```

## 7.3 Decoded tool payload (`JSON.parse(result.content[0].text)`)
```json
{
  "query": "hooks",
  "version": "v5",
  "results": [
    {
      "id": "...",
      "title": "...",
      "version": "v5",
      "category": "hooks",
      "score": 1,
      "snippet": "..."
    }
  ]
}
```

