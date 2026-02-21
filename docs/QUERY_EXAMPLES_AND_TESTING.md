# FeathersJS MCP Server — Query Examples & Self-Testing Guide

> All 10 queries below were executed against the live MCP server and outputs were verified.
> Use this document for self-testing, peer testing, and validation of expected behaviour.

---

## 🛠️ Before You Begin

Run these two commands to ensure you are on a clean, working build:

```bash
npm run build
npm test
```

Then use the query commands below. Each one pipes JSON-RPC messages into the server and
formats the output with `python3 -m json.tool` (available by default on macOS/Linux).

---

## 📐 How to Read This Document

Each example includes:

| Section | Description |
|---|---|
| **Goal** | What this query is testing |
| **Tool** | Which MCP tool is called |
| **Complexity** | Simple / Intermediate / Advanced |
| **Query** | The exact bash command to run |
| **Expected Output** | The real, verified output structure |
| **Pass Criteria** | What to check to decide if the result is correct |

---

## 📋 Testing Process

### Step 1 — Run the query

Copy the bash command exactly and paste it into your terminal from the project root
(`cspc319_feathersJS_C/`). The server starts, processes the request, and exits automatically.

### Step 2 — Compare the output

Check your output against the **Expected Output** section. You do not need exact word-for-word
matches on snippets or code content — focus on:

- Correct JSON structure (`jsonrpc`, `id`, `result`, `content`)
- Presence of key fields listed in the Pass Criteria
- Error cases return `"isError": true` and a descriptive message
- No unhandled exceptions or crash output

### Step 3 — Mark pass or fail

Use the Pass Criteria checklist. If any item fails, record it in the
[Bug Report](./BUG_REPORT.md) template.

### Step 4 — Repeat for all 10 queries

Work through the queries in order — they progress from simple to advanced.

---

## 🔟 Query Examples

> **Note:** The server now exposes **9 tools** across four categories. Queries 1–10 cover the original core tools. Queries 11–21 cover the support and advanced tools added in Steps 60–70.


---

### Query 1 — List All Available Tools

**Goal:** Confirm the server exposes all 9 registered tools with correct names and descriptions.
**Tool:** `tools/list`
**Complexity:** Simple

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Expected Output:**
```json
{
    "result": {
        "tools": [
            { "name": "search_docs",           "description": "...", "inputSchema": { "...": "..." } },
            { "name": "get_feathers_template",  "description": "...", "inputSchema": { "...": "..." } },
            { "name": "generate_service",       "description": "...", "inputSchema": { "...": "..." } },
            { "name": "get_hook_example",       "description": "...", "inputSchema": { "...": "..." } },
            { "name": "troubleshoot_error",     "description": "...", "inputSchema": { "...": "..." } },
            { "name": "get_best_practices",     "description": "...", "inputSchema": { "...": "..." } },
            { "name": "explain_concept",        "description": "...", "inputSchema": { "...": "..." } },
            { "name": "suggest_alternatives",   "description": "...", "inputSchema": { "...": "..." } },
            { "name": "list_available_tools",   "description": "...", "inputSchema": { "...": "..." } }
        ]
    },
    "jsonrpc": "2.0",
    "id": 2
}
```

**Pass Criteria:**
- [ ] Response is valid JSON
- [ ] Exactly 9 tools are listed
- [ ] All 9 tool names are present: `search_docs`, `get_feathers_template`, `generate_service`, `get_hook_example`, `troubleshoot_error`, `get_best_practices`, `explain_concept`, `suggest_alternatives`, `list_available_tools`
- [ ] Each tool has a `description` and `inputSchema`

---

### Query 2 — Search Documentation: "hooks"

**Goal:** Search for the most fundamental FeathersJS concept and get relevant results.
**Tool:** `search_docs`
**Complexity:** Simple

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_docs","arguments":{"query":"hooks","limit":3}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Expected Output:**
```json
{
    "result": {
        "content": [
            {
                "type": "text",
                "text": "{ \"query\": \"hooks\", \"version\": \"v5\", \"results\": [ { \"id\": \"v5-doc-030\", \"title\": \"Hooks: `context.data`\", \"version\": \"v5\", \"category\": \"hooks\", \"score\": 1, ... }, { \"id\": \"v5-doc-031\", \"title\": \"Hooks: `context.result`\", \"score\": 0.938, ... }, { \"id\": \"v5-doc-028\", \"title\": \"Hooks: before, after and error\", \"score\": 0.927, ... } ] }"
            }
        ]
    },
    "jsonrpc": "2.0",
    "id": 2
}
```

**Verified Result Summary (from live run):**

| # | Title | Category | Score |
|---|-------|----------|-------|
| 1 | Hooks: `context.data` | hooks | 1.000 |
| 2 | Hooks: `context.result` | hooks | 0.939 |
| 3 | Hooks: before, after and error | hooks | 0.927 |

**Pass Criteria:**
- [ ] Returns exactly 3 results (matching the `limit`)
- [ ] All results have `category: "hooks"`
- [ ] Top result has `score: 1`
- [ ] Each result contains `id`, `title`, `version`, `category`, `score`, `snippet`

---

### Query 3 — Search Documentation: "authentication"

**Goal:** Retrieve authentication-related documentation entries.
**Tool:** `search_docs`
**Complexity:** Simple

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_docs","arguments":{"query":"authentication","limit":3}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Verified Result Summary (from live run):**

| # | Title | Category | Score |
|---|-------|----------|-------|
| 1 | Authentication Overview | authentication | 1.000 |
| 2 | Authentication Hook | authentication | 0.945 |
| 3 | Services: Custom Methods | services | 0.935 |

**Pass Criteria:**
- [ ] Returns 3 results
- [ ] Top result title contains "Authentication"
- [ ] Top result `score` is `1`
- [ ] Snippet for result 1 mentions `@feathersjs/authentication`, JWT, or OAuth

---

### Query 4 — Search Documentation: "real-time events" (cross-version)

**Goal:** Search across both v4 and v5 documentation using the `version: "both"` filter.
**Tool:** `search_docs`
**Complexity:** Intermediate

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_docs","arguments":{"query":"real-time events","limit":3,"version":"both"}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Verified Result Summary (from live run):**

| # | Title | Version | Score |
|---|-------|---------|-------|
| 1 | FeathersJS Events | v5 | 1.000 |
| 2 | Client Socket.io Transport | v5 | 0.949 |
| 3 | Socket.io Transport | v5 | 0.916 |

**Pass Criteria:**
- [ ] `"version"` field in the response body is `"both"`
- [ ] Results relate to events, Socket.io, or real-time functionality
- [ ] Result 1 title is `"FeathersJS Events"` with score `1`
- [ ] Snippets mention `EventEmitter`, `Socket.io`, or `.on()`

---

### Query 5 — Generate Template: MongoDB + Auth + TypeScript

**Goal:** Generate a complete TypeScript project template with MongoDB and authentication.
**Tool:** `get_feathers_template`
**Complexity:** Intermediate

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_feathers_template","arguments":{"database":"mongodb","auth":true,"typescript":true}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Verified Result Summary (from live run):**

```
database:     mongodb
auth:         true
typescript:   true
version:      v5
file output:  index.ts
dependencies: @feathersjs/authentication, @feathersjs/authentication-local,
              @feathersjs/configuration, @feathersjs/feathers,
              @feathersjs/koa, @feathersjs/mongodb, @feathersjs/socketio, mongodb
featureFlags: ["authentication", "mongodb"]
```

**Pass Criteria:**
- [ ] `database` field is `"mongodb"`
- [ ] `auth` field is `true`
- [ ] `typescript` field is `true`
- [ ] `dependencies` includes `@feathersjs/authentication` and `@feathersjs/mongodb`
- [ ] `featureFlags` includes `"authentication"` and `"mongodb"`
- [ ] Generated file is named `index.ts` (not `index.js`)
- [ ] File content references `MongoDBService` or MongoDB adapter imports

---

### Query 6 — Generate Template: PostgreSQL, No Auth, JavaScript

**Goal:** Generate a minimal JavaScript template with PostgreSQL and no authentication.
**Tool:** `get_feathers_template`
**Complexity:** Intermediate

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_feathers_template","arguments":{"database":"postgresql","auth":false,"typescript":false}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Verified Result Summary (from live run):**

```
database:    postgresql
auth:        false
typescript:  false
file output: index.js  (JavaScript — no .ts extension)
```

**Pass Criteria:**
- [ ] `database` is `"postgresql"`
- [ ] `auth` is `false`
- [ ] `typescript` is `false`
- [ ] Generated entry file is `index.js`, not `index.ts`
- [ ] `dependencies` does NOT include `@feathersjs/authentication`

---

### Query 7 — Generate Service: "users" (MongoDB, 2 fields)

**Goal:** Generate a minimal service with only 2 required fields using MongoDB.
**Tool:** `generate_service`
**Complexity:** Simple

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"generate_service","arguments":{"name":"users","database":"mongodb","fields":[{"name":"email","type":"string","required":true},{"name":"password","type":"string","required":true}]}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Verified Result Summary (from live run):**

```
name:     users
database: mongodb
files:
  - src/services/users/users.schema.ts
  - src/services/users/users.service.ts
  - src/services/users/users.hooks.ts
  - src/services/users/users.test.ts
```

**Pass Criteria:**
- [ ] Exactly 4 files are generated
- [ ] File names follow the pattern `users.<role>.ts`
- [ ] `users.schema.ts` exists (MongoDB uses schema, not model)
- [ ] Schema file content includes `email` and `password` as required fields

---

### Query 8 — Generate Service: "products" (MongoDB, mixed field types)

**Goal:** Generate a service with all 4 basic field types (string, number, boolean, optional fields).
**Tool:** `generate_service`
**Complexity:** Intermediate

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"generate_service","arguments":{"name":"products","database":"mongodb","fields":[{"name":"name","type":"string","required":true},{"name":"price","type":"number","required":true},{"name":"description","type":"string"},{"name":"inStock","type":"boolean"}]}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Verified Schema Output (from live run):**

```typescript
import { Schema, model, Document } from 'mongoose';

export interface IProducts extends Document {
  name: string;
  price: number;
  description?: string;
  inStock?: boolean;
}

const schema = new Schema<IProducts>(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String },
    inStock: { type: Boolean }
  },
  { timestamps: true }
);

export const ProductsModel = model<IProducts>('Products', schema);
export default schema;
```

**Pass Criteria:**
- [ ] 4 files generated (schema, service, hooks, test)
- [ ] `name` and `price` are marked `required: true` in schema
- [ ] `description` and `inStock` are optional (no `required` flag)
- [ ] TypeScript interface `IProducts` is present
- [ ] Interface uses `?` suffix on optional fields (`description?`, `inStock?`)

---

### Query 9 — Generate Service: "orders" (PostgreSQL, 5 fields, Knex migration)

**Goal:** Generate a service with PostgreSQL, verifying that a Knex migration file is
produced instead of a Mongoose schema.
**Tool:** `generate_service`
**Complexity:** Advanced

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"generate_service","arguments":{"name":"orders","database":"postgresql","fields":[{"name":"customerId","type":"string","required":true},{"name":"total","type":"number","required":true},{"name":"status","type":"string","required":true},{"name":"notes","type":"string"},{"name":"shipped","type":"boolean"}]}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Verified Model Output (from live run):**

```typescript
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('orders', (table) => {
    table.increments('id').primary();
    table.string('customerId').notNullable();
    table.float('total').notNullable();
    table.string('status').notNullable();
    table.string('notes').nullable();
    table.boolean('shipped').nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('orders');
}
```

**Pass Criteria:**
- [ ] 4 files generated (model, service, hooks, test)
- [ ] File is named `orders.model.ts` (PostgreSQL uses `model`, not `schema`)
- [ ] Model file uses `knex.schema.createTable`, NOT Mongoose `Schema`
- [ ] Required fields use `.notNullable()`
- [ ] Optional fields use `.nullable()`
- [ ] A `down` migration function is included for rollback support
- [ ] Auto-incremented `id` primary key is present

---

### Query 10 — Generate Service: "blogposts" (SQLite, all 7 field types)

**Goal:** Stress-test field type coverage by providing fields of every supported type:
string, number, boolean, date, array, object, and float.
**Tool:** `generate_service`
**Complexity:** Advanced

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"generate_service","arguments":{"name":"blogposts","database":"sqlite","fields":[{"name":"title","type":"string","required":true},{"name":"body","type":"string","required":true},{"name":"authorId","type":"string","required":true},{"name":"publishedAt","type":"date"},{"name":"tags","type":"array"},{"name":"metadata","type":"object"},{"name":"viewCount","type":"number"},{"name":"featured","type":"boolean"}]}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Verified Model Output (from live run):**

```typescript
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('blogposts', (table) => {
    table.increments('id').primary();
    table.string('title').notNullable();
    table.string('body').notNullable();
    table.string('authorId').notNullable();
    table.timestamp('publishedAt').nullable();
    table.json('tags').nullable();
    table.json('metadata').nullable();
    table.float('viewCount').nullable();
    table.boolean('featured').nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('blogposts');
}
```

**Pass Criteria:**
- [ ] 4 files generated (model, service, hooks, test)
- [ ] `date` type maps to `table.timestamp()`
- [ ] `array` type maps to `table.json()`
- [ ] `object` type maps to `table.json()`
- [ ] `number` type maps to `table.float()`
- [ ] `boolean` type maps to `table.boolean()`
- [ ] `string` type maps to `table.string()`
- [ ] Required fields are `.notNullable()`, optional fields are `.nullable()`

---

---

### Query 11 — Get Hook Example: "before" hook

**Goal:** Retrieve a best-practice example for a `before` hook.
**Tool:** `get_hook_example`
**Complexity:** Simple

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_hook_example","arguments":{"hookType":"before","version":"v5"}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Expected Output Structure:**
```
Rule:
<a best-practice rule statement for before hooks>

Why:
<rationale explaining the rule>

Good Example:
<working TypeScript/JavaScript code>

Bad Example:
<code showing the anti-pattern>
```

**Pass Criteria:**
- [ ] Response is valid JSON with no `"isError"` field
- [ ] `content` contains the headings `Rule:`, `Why:`, `Good Example:`, `Bad Example:`
- [ ] The code in `Good Example:` is non-empty

---

### Query 12 — Get Hook Example: "error" hook

**Goal:** Retrieve a best-practice example specifically for an `error` hook type.
**Tool:** `get_hook_example`
**Complexity:** Simple

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_hook_example","arguments":{"hookType":"error","version":"v5"}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Expected Output Structure:**
```
Rule:
<rule for error hooks, or nearest v5 hook practice if no error-tagged entry exists>

Why:
<rationale>

Good Example:
<code>

Bad Example:
<code>
```

> ⚠️ **Note:** If no entry is tagged `"error"` in the knowledge base, the tool falls back
> to the first `v5` hook practice and prepends:
> `Note: No exact "error" tagged example found; showing closest "v5" hook practice.`
> This is expected behaviour — not a bug.

**Pass Criteria:**
- [ ] Response is valid JSON
- [ ] `content` contains `Rule:` and `Good Example:` sections
- [ ] If no exact tag match, a `Note:` line appears explaining the fallback
- [ ] Server does not crash

---

### Query 13 — Troubleshoot Error: Known Pattern ("NotAuthenticated")

**Goal:** Verify the tool matches a well-known FeathersJS authentication error to a specific
database entry and returns cause, solution, and example.
**Tool:** `troubleshoot_error`
**Complexity:** Simple

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"troubleshoot_error","arguments":{"errorMessage":"NotAuthenticated: No auth token","version":"v5"}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Expected Output Structure:**
```
Category: authentication
Error ID: <e.g. auth-001>

Cause:
<description of why NotAuthenticated is thrown>

Solution:
<steps to resolve the error>

Example:
<code snippet showing the fix>
```

**Pass Criteria:**
- [ ] Response is valid JSON with no `"isError"` field
- [ ] `content` contains `Category:`, `Cause:`, `Solution:`, and `Example:` headings
- [ ] `Category` value is `authentication`
- [ ] `Solution` section is non-empty

---

### Query 14 — Troubleshoot Error: Unknown Pattern (graceful fallback)

**Goal:** Confirm the tool returns helpful generic guidance rather than crashing when no
pattern in the database matches the input.
**Tool:** `troubleshoot_error`
**Complexity:** Simple

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"troubleshoot_error","arguments":{"errorMessage":"SomeCompletelyRandomError_xyz999abc","version":"v5"}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Expected Output Structure:**
```
Unknown error.
No known solution for this exact pattern.

Solution:
General troubleshooting steps:
- Check the full stack trace.
- Verify authentication setup.
...

Error Received:
SomeCompletelyRandomError_xyz999abc
```

**Pass Criteria:**
- [ ] Response is valid JSON — no crash, no `"isError"` field
- [ ] `content` includes the phrase `No known solution`
- [ ] A `Solution:` section with general troubleshooting steps is present
- [ ] The original `errorMessage` is echoed back in the response

---

### Query 15 — Get Best Practices: "security" topic

**Goal:** Retrieve the top 3 security best practices for FeathersJS.
**Tool:** `get_best_practices`
**Complexity:** Simple

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_best_practices","arguments":{"topic":"security"}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Expected Output Structure:**
```
Rule:
<security rule statement>

Why:
<rationale>

Good Example:
<secure code pattern>

Bad Example:
<insecure code pattern>

----------------------------------------

Rule:
<second security rule>
...
```

**Pass Criteria:**
- [ ] Response is valid JSON
- [ ] `content` includes at least one `Rule:` section
- [ ] Both `Good Example:` and `Bad Example:` sections are present
- [ ] Content is security-related (mentions auth, sanitization, permissions, etc.)
- [ ] Up to 3 practices are returned, separated by `---`

---

### Query 16 — Get Best Practices: "hooks" topic with context ranking

**Goal:** Confirm that providing a `context` string re-ranks practices so the most relevant
one appears first.
**Tool:** `get_best_practices`
**Complexity:** Intermediate

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_best_practices","arguments":{"topic":"hooks","context":"authentication"}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Expected Output Structure:**
```
Rule:
<hook rule most relevant to authentication>

Why:
<rationale>

Good Example:
<code>

Bad Example:
<code>
```

**Pass Criteria:**
- [ ] Response is valid JSON
- [ ] `content` includes `Rule:`, `Good Example:`, and `Bad Example:` sections
- [ ] The top result's rule or rationale is more relevant to authentication than a generic hook rule would be
- [ ] Server does not crash when `context` is provided

---

### Query 17 — Explain Concept: "hooks"

**Goal:** Retrieve a full explanation of the FeathersJS hooks concept, including related
topics and a code example.
**Tool:** `explain_concept`
**Complexity:** Simple

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"explain_concept","arguments":{"concept":"hooks"}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Expected Output Structure:**
```
Concept: <title of the best-matching doc entry>
Version: v5

Definition:
<full documentation content for the concept>

Related Concepts:
- <related doc title 1>
- <related doc title 2>
- <related doc title 3>
```

**Pass Criteria:**
- [ ] Response is valid JSON
- [ ] `content` contains `Concept:`, `Version:`, and `Definition:` headings
- [ ] The matched concept title is related to hooks (e.g. "Hooks: before, after and error")
- [ ] `Related Concepts:` section lists at least 1 other entry
- [ ] `Definition:` content is non-empty

---

### Query 18 — Explain Concept: Unknown term (graceful fallback)

**Goal:** Confirm the tool returns a helpful "not found" message rather than an empty
response or a crash when the concept does not exist in the knowledge base.
**Tool:** `explain_concept`
**Complexity:** Simple

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"explain_concept","arguments":{"concept":"quantumEntangledMiddleware"}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Expected Output Structure:**
```
Concept "quantumEntangledMiddleware" not found in documentation.

Try:
- Checking spelling
- Using a broader term
- Searching related topics like "services", "hooks", or "authentication"
```

**Pass Criteria:**
- [ ] Response is valid JSON — no crash, no `"isError"` field
- [ ] `content` contains the phrase `not found`
- [ ] A suggestion to try alternative terms is included
- [ ] Server exits cleanly

---

### Query 19 — Suggest Alternatives: "authentication hook"

**Goal:** Verify the tool returns at least 2 distinct implementation alternatives with
code, tradeoffs, and when-to-use guidance.
**Tool:** `suggest_alternatives`
**Complexity:** Intermediate

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"suggest_alternatives","arguments":{"pattern":"authentication hook","context":"JWT"}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Expected Output Structure:**
```
Alternative 1: <title from template or snippet match>
Code:
<code snippet>

Tradeoffs:
<description of tradeoffs>

When to use:
<guidance>

----------------------------------------

Alternative 2: <title>
Code:
<code snippet>
...
```

**Pass Criteria:**
- [ ] Response is valid JSON
- [ ] `content` contains both `Alternative 1:` and `Alternative 2:` blocks
- [ ] Each alternative has `Code:`, `Tradeoffs:`, and `When to use:` sections
- [ ] Code blocks are non-empty
- [ ] `metadata.count` is `>= 2`

---

### Query 20 — Suggest Alternatives: Obscure pattern (fallback to defaults)

**Goal:** Confirm the built-in fallback fires when no template or snippet matches,
always guaranteeing at least 2 alternatives are returned.
**Tool:** `suggest_alternatives`
**Complexity:** Intermediate

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"suggest_alternatives","arguments":{"pattern":"zzz_nonexistent_pattern_xyz"}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Expected Output Structure:**
```
Alternative 1: Hook-based approach
Code:
// around hook example
export const wrapLogic = async (context, next) => {
  // pre logic
  await next();
  // post logic
};

Tradeoffs:
Centralizes cross-cutting logic, but can become hard to trace when many hooks stack.

When to use:
Use when behavior should run consistently around service methods.

----------------------------------------

Alternative 2: Service-class approach
Code:
class MyService {
  async create(data, params) {
    return { ...data };
  }
}
...
```

**Pass Criteria:**
- [ ] Response is valid JSON
- [ ] `Alternative 1:` is `Hook-based approach`
- [ ] `Alternative 2:` is `Service-class approach`
- [ ] Both alternatives contain code, tradeoffs, and when-to-use text
- [ ] Server does not crash on an unrecognised pattern

---

### Query 21 — List Available Tools: all tools (no category filter)

**Goal:** Use the `list_available_tools` MCP tool (distinct from the protocol-level
`tools/list`) to retrieve the built-in catalog of all 9 tools with descriptions and
example payloads.
**Tool:** `list_available_tools`
**Complexity:** Simple

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_available_tools","arguments":{}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Expected Output Structure:**
```
Available tools (9):

Tool: search_docs
Category: search
Description: Search FeathersJS documentation using semantic similarity.
Input Schema: {...}
Example: {"name":"search_docs","arguments":{"query":"hooks"}}

Tool: get_feathers_template
...

Tool: suggest_alternatives
Category: advanced
...

Tool: list_available_tools
Category: advanced
...
```

**Pass Criteria:**
- [ ] Response is valid JSON
- [ ] Header reads `Available tools (9):`
- [ ] All 9 tool names appear in the content
- [ ] Each entry includes `Category:`, `Description:`, `Input Schema:`, and `Example:`
- [ ] `metadata.count` equals `9`

---

### Query 22 — List Available Tools: filtered by "support" category

**Goal:** Confirm category filtering returns only the 4 support-category tools and excludes
all others.
**Tool:** `list_available_tools`
**Complexity:** Simple

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_available_tools","arguments":{"category":"support"}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Expected Output Structure:**
```
Available tools in category "support" (4):

Tool: get_hook_example
Category: support
...

Tool: troubleshoot_error
Category: support
...

Tool: get_best_practices
Category: support
...

Tool: explain_concept
Category: support
...
```

**Pass Criteria:**
- [ ] Response is valid JSON
- [ ] Header reads `Available tools in category "support" (4):`
- [ ] Exactly 4 tools are listed: `get_hook_example`, `troubleshoot_error`, `get_best_practices`, `explain_concept`
- [ ] Tools from other categories (`search_docs`, `generate_service`, `suggest_alternatives`, etc.) do NOT appear
- [ ] `metadata.count` equals `4`

---

## ❌ Error Case Queries

These three queries test invalid inputs. The server must return a clear error message
and must NOT crash.

---

### Error Case A — Invalid Database Type

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"generate_service","arguments":{"name":"orders","database":"mysql","fields":[{"name":"total","type":"number","required":true}]}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Verified Output (from live run):**
```json
{
    "result": {
        "content": [
            {
                "type": "text",
                "text": "Error: Database must be one of: mongodb, postgresql, sqlite"
            }
        ],
        "isError": true
    },
    "jsonrpc": "2.0",
    "id": 2
}
```

**Pass Criteria:**
- [ ] `"isError": true` is present
- [ ] Error message lists the valid database options
- [ ] Server does not crash or exit with an unhandled exception

---

### Error Case B — Empty Fields Array

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"generate_service","arguments":{"name":"products","database":"mongodb","fields":[]}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Verified Output (from live run):**
```json
{
    "result": {
        "content": [
            {
                "type": "text",
                "text": "Error: Fields array is required and must not be empty."
            }
        ],
        "isError": true
    },
    "jsonrpc": "2.0",
    "id": 2
}
```

**Pass Criteria:**
- [ ] `"isError": true` is present
- [ ] Message references the `fields` array requirement
- [ ] Server does not crash

---

### Error Case C — Empty Search Query

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_docs","arguments":{"query":""}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Verified Output (from live run):**
```json
{
    "result": {
        "content": [
            {
                "type": "text",
                "text": "{ \"query\": \"\", \"version\": \"v5\", \"results\": [] }"
            }
        ]
    },
    "jsonrpc": "2.0",
    "id": 2
}
```

> ⚠️ **Note:** An empty query does not return `isError: true` — the server returns an
> empty results array instead. This is valid behaviour (graceful degradation). If your
> project requires an error for empty queries, this is a potential improvement to log.

**Pass Criteria:**
- [ ] Server does not crash
- [ ] Response is valid JSON
- [ ] `results` array is empty (`[]`)

---

### Error Case D — Missing Required Field (`troubleshoot_error`)

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"troubleshoot_error","arguments":{}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Expected Output:**
```json
{
    "result": {
        "content": [
            {
                "type": "text",
                "text": "Validation error: ..."
            }
        ],
        "isError": true
    },
    "jsonrpc": "2.0",
    "id": 2
}
```

**Pass Criteria:**
- [ ] `"isError": true` is present
- [ ] Error message references the missing `errorMessage` field
- [ ] Server does not crash or exit with an unhandled exception

---

### Error Case E — Invalid Topic (`get_best_practices`)

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_best_practices","arguments":{"topic":"devops"}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Expected Output:**
```json
{
    "result": {
        "content": [
            {
                "type": "text",
                "text": "Validation error: ..."
            }
        ],
        "isError": true
    },
    "jsonrpc": "2.0",
    "id": 2
}
```

> ⚠️ **Note:** `"devops"` is not a valid enum value. The `topic` field only accepts:
> `hooks`, `services`, `security`, `testing`, `performance`.

**Pass Criteria:**
- [ ] `"isError": true` is present
- [ ] Error message indicates an invalid or unrecognised `topic` value
- [ ] Server does not crash

---

### Error Case F — Invalid Category (`list_available_tools`)

**Query:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_available_tools","arguments":{"category":"unknown"}}}' | node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

**Expected Output:**
```json
{
    "result": {
        "content": [
            {
                "type": "text",
                "text": "Invalid category: unknown"
            }
        ],
        "isError": true
    },
    "jsonrpc": "2.0",
    "id": 2
}
```

> ⚠️ **Note:** Valid categories are: `search`, `generate`, `validate`, `support`, `advanced`.

**Pass Criteria:**
- [ ] `"isError": true` is present
- [ ] Error message includes `"Invalid category: unknown"`
- [ ] Server does not crash

---

## 📊 Results Summary Table

Use this table to track your pass/fail status across all queries during a test session.

| # | Query | Tool | Expected Outcome | Pass? |
|---|-------|------|-----------------|-------|
| 1 | List tools | `tools/list` | 9 tools returned | ☐ |
| 2 | Search "hooks" | `search_docs` | 3 hooks results, top score 1 | ☐ |
| 3 | Search "authentication" | `search_docs` | Auth Overview top result | ☐ |
| 4 | Search "real-time events" (both versions) | `search_docs` | Events + Socket.io results | ☐ |
| 5 | Template: MongoDB + auth + TypeScript | `get_feathers_template` | index.ts, auth deps included | ☐ |
| 6 | Template: PostgreSQL, no auth, JavaScript | `get_feathers_template` | index.js, no auth deps | ☐ |
| 7 | Service: "users", MongoDB, 2 fields | `generate_service` | 4 files, schema.ts | ☐ |
| 8 | Service: "products", MongoDB, mixed types | `generate_service` | Mongoose schema, optional fields | ☐ |
| 9 | Service: "orders", PostgreSQL, 5 fields | `generate_service` | Knex migration, notNullable() | ☐ |
| 10 | Service: "blogposts", SQLite, 7 field types | `generate_service` | All types mapped correctly | ☐ |
| 11 | Hook example: "before" | `get_hook_example` | Rule + Good/Bad examples | ☐ |
| 12 | Hook example: "error" (with fallback) | `get_hook_example` | Rule shown, Note if fallback used | ☐ |
| 13 | Troubleshoot: known error "NotAuthenticated" | `troubleshoot_error` | Category + Cause + Solution | ☐ |
| 14 | Troubleshoot: unknown error (fallback) | `troubleshoot_error` | "No known solution" + general steps | ☐ |
| 15 | Best practices: "security" topic | `get_best_practices` | ≥1 Rule with Good/Bad examples | ☐ |
| 16 | Best practices: "hooks" + context ranking | `get_best_practices` | Auth-relevant rule ranked first | ☐ |
| 17 | Explain concept: "hooks" | `explain_concept` | Definition + Related Concepts | ☐ |
| 18 | Explain concept: unknown term (fallback) | `explain_concept` | "not found" + suggestions | ☐ |
| 19 | Suggest alternatives: "authentication hook" | `suggest_alternatives` | ≥2 alternatives with code | ☐ |
| 20 | Suggest alternatives: obscure pattern | `suggest_alternatives` | Default Hook + Service alternatives | ☐ |
| 21 | List tools catalog: all (no filter) | `list_available_tools` | 9 tools with descriptions | ☐ |
| 22 | List tools catalog: "support" category | `list_available_tools` | 4 support tools only | ☐ |
| E-A | Invalid DB type ("mysql") | `generate_service` | isError: true, helpful message | ☐ |
| E-B | Empty fields array | `generate_service` | isError: true, helpful message | ☐ |
| E-C | Empty search query | `search_docs` | Empty results array, no crash | ☐ |
| E-D | Missing `errorMessage` field | `troubleshoot_error` | isError: true, validation message | ☐ |
| E-E | Invalid topic ("devops") | `get_best_practices` | isError: true, invalid enum value | ☐ |
| E-F | Invalid category ("unknown") | `list_available_tools` | isError: true, invalid category | ☐ |

---

## 🐛 Reporting Failures

If a query fails, record the following in [BUG_REPORT.md](./BUG_REPORT.md):

1. **Query number** (e.g., Query 9)
2. **The exact command you ran**
3. **Your actual output** (paste the full JSON)
4. **Expected output** (from this document)
5. **What differs** (e.g., missing field, wrong file name, crash)

---

## 📝 To start the front end

1. **From the project root:**
2. **cd ui && node server.js**
3. **Then open: http://localhost:4000**

---

*All expected outputs in this document were verified against the live MCP server build on the current `main` branch.*
