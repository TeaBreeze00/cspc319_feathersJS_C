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

---

### Query 1 — List All Available Tools

**Goal:** Confirm the server exposes exactly 3 tools with correct names and descriptions.
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
            {
                "name": "search_docs",
                "description": "Searches the FeathersJS documentation knowledge base and returns the most relevant entries.",
                "inputSchema": { "...": "..." }
            },
            {
                "name": "get_feathers_template",
                "description": "Generates a complete FeathersJS project structure based on database, authentication, and language preferences.",
                "inputSchema": { "...": "..." }
            },
            {
                "name": "generate_service",
                "description": "Generates a complete FeathersJS service with service class, hooks, schema/model, and test files.",
                "inputSchema": { "...": "..." }
            }
        ]
    },
    "jsonrpc": "2.0",
    "id": 2
}
```

**Pass Criteria:**
- [ ] Response is valid JSON
- [ ] Exactly 3 tools are listed
- [ ] Tool names are: `search_docs`, `get_feathers_template`, `generate_service`
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

## 📊 Results Summary Table

Use this table to track your pass/fail status across all queries during a test session.

| # | Query | Tool | Expected Outcome | Pass? |
|---|-------|------|-----------------|-------|
| 1 | List tools | `tools/list` | 3 tools returned | ☐ |
| 2 | Search "hooks" | `search_docs` | 3 hooks results, top score 1 | ☐ |
| 3 | Search "authentication" | `search_docs` | Auth Overview top result | ☐ |
| 4 | Search "real-time events" (both versions) | `search_docs` | Events + Socket.io results | ☐ |
| 5 | Template: MongoDB + auth + TypeScript | `get_feathers_template` | index.ts, auth deps included | ☐ |
| 6 | Template: PostgreSQL, no auth, JavaScript | `get_feathers_template` | index.js, no auth deps | ☐ |
| 7 | Service: "users", MongoDB, 2 fields | `generate_service` | 4 files, schema.ts | ☐ |
| 8 | Service: "products", MongoDB, mixed types | `generate_service` | Mongoose schema, optional fields | ☐ |
| 9 | Service: "orders", PostgreSQL, 5 fields | `generate_service` | Knex migration, notNullable() | ☐ |
| 10 | Service: "blogposts", SQLite, 7 field types | `generate_service` | All types mapped correctly | ☐ |
| E-A | Invalid DB type ("mysql") | `generate_service` | isError: true, helpful message | ☐ |
| E-B | Empty fields array | `generate_service` | isError: true, helpful message | ☐ |
| E-C | Empty search query | `search_docs` | Empty results array, no crash | ☐ |

---

## 🐛 Reporting Failures

If a query fails, record the following in [BUG_REPORT.md](./BUG_REPORT.md):

1. **Query number** (e.g., Query 9)
2. **The exact command you ran**
3. **Your actual output** (paste the full JSON)
4. **Expected output** (from this document)
5. **What differs** (e.g., missing field, wrong file name, crash)

---

*All expected outputs in this document were verified against the live MCP server build on the current `main` branch.*