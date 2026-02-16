# FeathersJS MCP Server - Peer Testing Tasks

## 🎯 Context for Testers

### What is this project?
You're testing a developer tool called an "MCP Server" that enhances AI coding assistants (like Claude) with specialized knowledge about FeathersJS - a backend web framework. Think of it as a plugin that makes AI assistants smarter about a specific technology.

### Who are you?
You're a **full-stack developer** who uses an AI coding assistant (like Claude Code or Cline in VS Code). You want the AI to help you build a FeathersJS backend application.

### How does it work?
The MCP server provides 3 core tools:
1. **`search_docs`** - Find documentation about FeathersJS concepts
2. **`get_feathers_template`** - Generate a complete project starter template
3. **`generate_service`** - Create service files for your application

---

## 📝 Testing Tasks (10-12 minutes total)

### Task 1: Search Documentation (~2-3 min)

**Goal:** Find information about a FeathersJS concept using the documentation search tool.

**Starting Point:** Terminal with the MCP server running

**Steps:**
1. Use the `search_docs` tool to search for "hooks" in the FeathersJS documentation
2. Review the results returned
3. Try another search for "authentication"

**Success Criteria:**
- [ ] Search returns relevant documentation entries
- [ ] Results include title, snippet, and relevance score
- [ ] Response time is under 2 seconds

---

### Task 2: Generate a Project Template (~3-4 min)

**Goal:** Generate a FeathersJS project template with specific configuration.

**Starting Point:** Terminal with the MCP server running

**Steps:**
1. Use the `get_feathers_template` tool with these options:
   - Database: `mongodb`
   - Authentication: `true`
   - TypeScript: `true`
2. Review the generated project structure
3. Try generating another template with `postgresql` instead

**Success Criteria:**
- [ ] Template includes project files (index.ts, configuration, etc.)
- [ ] Database-specific configuration is included
- [ ] Authentication setup appears when requested
- [ ] File structure makes sense for a web application

---

### Task 3: Generate a Service (~3-4 min)

**Goal:** Generate a complete service (like a "products" API endpoint) for a FeathersJS app.

**Starting Point:** Terminal with the MCP server running

**Steps:**
1. Use the `generate_service` tool to create a "products" service with:
   - Database: `mongodb`
   - Fields:
     - `name` (string, required)
     - `price` (number, required)
     - `description` (string)
     - `inStock` (boolean)
2. Review the 4 generated files (service, hooks, schema, test)
3. Check that all fields appear correctly in the schema

**Success Criteria:**
- [ ] Generates 4 files: service, hooks, schema, and test
- [ ] All requested fields appear in the schema
- [ ] Field types are correctly applied
- [ ] Code appears syntactically valid

---

### Task 4: Error Handling (~2 min)

**Goal:** Test how the system handles invalid inputs.

**Starting Point:** Terminal with the MCP server running

**Steps:**
1. Try `generate_service` with an invalid database type (e.g., "mysql")
2. Try `generate_service` with an empty fields array
3. Try `search_docs` with an empty query

**Success Criteria:**
- [ ] System returns a clear, helpful error message
- [ ] System does NOT crash
- [ ] Error message explains what went wrong

---

### Task 5: List Available Tools (~1 min)

**Goal:** Discover what tools are available in the MCP server.

**Starting Point:** Terminal with the MCP server running

**Steps:**
1. Send a `tools/list` request to the MCP server
2. Review the list of available tools and their descriptions

**Success Criteria:**
- [ ] Returns list of tools with names and descriptions
- [ ] `search_docs`, `get_feathers_template`, and `generate_service` are listed

---

## 🔧 Quick Reference - Test Commands

For testers who need to interact directly with the MCP server, here are example JSON-RPC commands:

### List Tools
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | node dist/index.js | jq
```

### Search Documentation
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_docs","arguments":{"query":"hooks","limit":5}}}' | node dist/index.js | jq
```

### Get Template
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_feathers_template","arguments":{"database":"mongodb","auth":true,"typescript":true}}}' | node dist/index.js | jq
```

### Generate Service
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"generate_service","arguments":{"name":"products","database":"mongodb","fields":[{"name":"name","type":"string","required":true},{"name":"price","type":"number","required":true},{"name":"description","type":"string"},{"name":"inStock","type":"boolean"}]}}}' | node dist/index.js | jq
```

---

## 📋 Optional Feedback Form

If you want to provide testers with a feedback form, here's a suggested 5-question format:

| # | Question | Response Type |
|---|----------|---------------|
| 1 | Were you able to complete all tasks without help? | Yes / Partially / No |
| 2 | Rate the clarity of tool responses (1-5) | 1 (unclear) to 5 (very clear) |
| 3 | What was most confusing about using this tool? | Open text |
| 4 | Did error messages help you understand what went wrong? | Yes / Somewhat / No |
| 5 | What one thing would you improve? | Open text |

---

## ✅ Pre-Session Checklist (For Hosts)

Before your hosting session:

- [ ] Run `npm run build` to ensure latest code is compiled
- [ ] Run `npm test` to verify all tests pass
- [ ] Test all 5 tasks yourself to confirm they work
- [ ] Have the terminal ready with `cd cspc319_feathersJS_C`
- [ ] Print or display these tasks for testers
- [ ] Have a notebook ready to take observation notes
- [ ] Prepare bug report template for documenting issues found
- [ ] Laptop charged and stable build/branch ready

---

## 📌 Tips for Testers

- **Think aloud** - Share what you're thinking as you test
- **Be honest** - Your feedback helps improve the project
- **Don't hesitate to ask** - If you're stuck for more than 1-2 minutes
- **Note confusing parts** - Even small UI/UX issues are valuable feedback

## 📌 Tips for Hosts

- **Don't help immediately** - Let testers struggle a bit (that's valuable data!)
- **Take notes** - Write down where they get confused
- **Stay quiet** - Resist the urge to explain or defend
- **Ask follow-up questions** - "What were you expecting to happen?"
