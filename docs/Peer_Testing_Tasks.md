# FeathersJS MCP Server - Peer Testing Tasks

## 🎯 Context for Testers

### What is this project?
You're testing a developer tool called an "MCP Server" that enhances AI coding assistants (like Claude) with specialized knowledge about FeathersJS — a backend web framework. Think of it as a plugin that makes AI assistants smarter about a specific technology.

### Who are you?
You're a **full-stack developer** who uses an AI coding assistant (like Claude Code or Cline in VS Code). You want the AI to help you build a FeathersJS backend application.

### How does it work?
The MCP server provides 5 core tools accessible through a web interface — no terminal required:

1. **`search_docs`** — Search FeathersJS documentation semantically
2. **`explain_concept`** — Get a focused explanation of a specific concept
3. **`validate_code`** — Check FeathersJS code for syntax and best practices
4. **`generate_service`** — Scaffold a complete service with hooks, schema, and tests
5. **`list_tools`** — See all available tools and their descriptions

---

## 📝 Testing Tasks (12-15 minutes total)

### Task 1: Search Documentation (~2-3 min)

**Goal:** Find information about a FeathersJS concept using the documentation search tool.

**Starting Point:** Open the web interface in your browser.

**Steps:**
1. Navigate to the **Search Docs** panel
2. Search for **"hooks"** with version set to **v6**, limit **5**
3. Review the results — check the relevance scores, breadcrumb paths, and snippets
4. Try a second search for **"authentication"**

**Success Criteria:**
- [ ] Search returns relevant documentation sections
- [ ] Results show heading, breadcrumb path, relevance score, and snippet
- [ ] Code examples in snippets are formatted as code blocks, not raw text
- [ ] Response feels fast (under 2 seconds)

---

### Task 2: Explain a Concept (~2-3 min)

**Goal:** Get a focused explanation of a FeathersJS concept.

**Starting Point:** Web interface.

**Steps:**
1. Navigate to the **Explain Concept** panel
2. Enter **"around hooks"** and submit
3. Review the explanation — check the heading, breadcrumb, definition, and related concepts
4. Try another concept: **"hook context"**

**Success Criteria:**
- [ ] Returns a clear explanation with a heading and breadcrumb path
- [ ] Definition comes from actual documentation, not generic text
- [ ] Related concepts are listed with their full breadcrumb paths
- [ ] Version (v5 or v6) is clearly indicated

---

### Task 3: Validate Code (~2-3 min)

**Goal:** Check whether a piece of FeathersJS code is valid.

**Starting Point:** Web interface.

**Steps:**
1. Navigate to the **Validate Code** panel
2. Paste this valid TypeScript hook and run validation:
```ts
import type { HookContext, NextFunction } from '../declarations'

export const logRuntime = async (context: HookContext, next: NextFunction) => {
  const startTime = Date.now()
  await next()
  const duration = Date.now() - startTime
  console.log(`${context.method} on ${context.path} took ${duration}ms`)
}
```
3. Note whether it passes or fails and what checks ran
4. Now paste intentionally broken code (e.g. remove a closing brace) and validate again

**Success Criteria:**
- [ ] Valid code returns a passing result
- [ ] Invalid code returns a clear failure with useful feedback
- [ ] The response indicates which checks ran (TypeScript, ESLint, etc.)
- [ ] System does not crash on bad input

---

### Task 4: Generate a Service (~3-4 min)

**Goal:** Scaffold a complete FeathersJS service from field definitions.

**Starting Point:** Web interface.

**Steps:**
1. Navigate to the **Generate Service** panel
2. Create a **"products"** service with:
   - Database: **mongodb**
   - Fields:
     - `name` (string, required)
     - `price` (number, required)
     - `description` (string)
     - `inStock` (boolean)
3. Review the 4 generated files: service, hooks, schema, and test
4. Check that all fields appear correctly in the schema file

**Success Criteria:**
- [ ] Generates 4 files: service, hooks, schema, and test
- [ ] All requested fields appear in the schema with correct types
- [ ] Code appears syntactically reasonable
- [ ] Files have appropriate import statements

---

### Task 5: List Available Tools (~1-2 min)

**Goal:** Discover what tools the MCP server exposes.

**Starting Point:** Web interface.

**Steps:**
1. Navigate to the **List Tools** panel
2. Trigger the tool list request
3. Review the names, descriptions, and input schemas for each tool

**Success Criteria:**
- [ ] Returns all 5 tools with names and descriptions
- [ ] Each tool shows its required and optional parameters
- [ ] Descriptions are clear enough that you'd know when to use each tool

---

### Task 6: Error Handling (~2 min)

**Goal:** Test how the system handles invalid or missing inputs.

**Starting Point:** Web interface.

**Steps:**
1. In **Search Docs**, submit an empty query
2. In **Generate Service**, try an invalid database type if the UI allows it
3. In **Validate Code**, submit with no code entered
4. In **Explain Concept**, submit a completely nonsensical term like "xyzfoo123"

**Success Criteria:**
- [ ] System returns a clear, helpful message for each case
- [ ] System does NOT crash or show a blank screen
- [ ] Error messages explain what went wrong or what to try instead

---

## 📋 Optional Feedback Form

| # | Question | Response Type |
|---|----------|---------------|
| 1 | Were you able to complete all tasks without help? | Yes / Partially / No |
| 2 | Rate the clarity of tool responses (1–5) | 1 (unclear) → 5 (very clear) |
| 3 | Which tool felt most useful to you as a developer? | Open text |
| 4 | What was most confusing about using this tool? | Open text |
| 5 | Did error messages help you understand what went wrong? | Yes / Somewhat / No |
| 6 | What one thing would you improve? | Open text |

---

## ✅ Pre-Session Checklist (For Hosts)

Before your testing session:

- [ ] Run `npm run build` to ensure the latest code is compiled
- [ ] Run `npx ts-node scripts/improved-chunking.ts` to generate the chunks- 
- [ ] Run `npx ts-node scripts/generate-embeddings.ts` to ensure chunks have embeddings
- [ ] Run `npm test` to verify all tests pass (Fine if it fails)
- [ ] Open the web interface and confirm all 5 tool panels load
- [ ] Test all 6 tasks yourself to confirm they work end-to-end
- [ ] Have the web interface URL ready to share with testers
- [ ] Prepare a notebook or doc to record observations
- [ ] Laptop charged and on a stable branch

---

## 📌 Tips for Testers

- **Think aloud** — Share what you're expecting before you click
- **Be honest** — Your confusion is valuable data, not a failure
- **Don't hesitate to ask** — If you're stuck for more than 2 minutes
- **Note confusing parts** — Even small UI issues are worth mentioning

## 📌 Tips for Hosts

- **Don't help immediately** — Let testers struggle a bit (that's the data)
- **Take notes on hesitations** — Where do they pause? What do they re-read?
- **Stay quiet** — Resist the urge to explain or defend design decisions
- **Ask follow-up questions** — "What were you expecting to happen there?"
