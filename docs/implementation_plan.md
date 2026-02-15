# FeathersJS MCP Server — Implementation Plan

## Overview

This document provides a step-by-step implementation plan for the FeathersJS MCP Server, strictly following the four-layer architecture defined in the Design Report. The plan is structured for incremental building using an AI coding agent, with explicit dependencies between steps.

Each phase includes:
- **Objective** — What this phase accomplishes
- **Components/Layers** — Which architectural layers are involved
- **Prerequisites** — What must be completed before starting
- **Exit Artifacts** — What must exist when the phase ends

---

## ⚠️ ARCHITECTURAL GUARDRAILS — MUST NEVER VIOLATE

The following constraints are **non-negotiable**. Any code that violates these guardrails must be rejected and rewritten. These constraints derive directly from the Design Report and NFR requirements.

---

### 🔒 G1: Offline-First Operation

| ID | Constraint | Rationale |
|----|------------|-----------|
| G1.1 | **NEVER make network requests at runtime.** All knowledge must be embedded in the npm package. | NFR-001 requires <2s response time; network latency is unpredictable. |
| G1.2 | **NEVER fetch documentation, templates, or examples from external URLs.** | Assumption A-002 states offline operation is required. |
| G1.3 | **NEVER require internet connectivity after `npm install`.** | Users may work in air-gapped environments. |
| G1.4 | **ALL knowledge base content MUST be JSON files shipped with the package.** | Embedded content guarantees availability and performance. |

**Violation Example (FORBIDDEN):**
```typescript
// ❌ NEVER DO THIS
const docs = await fetch('https://feathersjs.com/api/docs');
```

**Correct Pattern:**
```typescript
// ✅ CORRECT
const docs = await loader.load('knowledge-base/docs/services.json');
```

---

### 🔒 G2: Stateless Tool Design

| ID | Constraint | Rationale |
|----|------------|-----------|
| G2.1 | **NEVER store session state between tool invocations.** Each tool call must be independent. | NFR-002 memory limit; simplifies testing and debugging. |
| G2.2 | **NEVER persist user data or conversation context in the MCP server.** The AI client manages state. | MCP protocol design; server is stateless by specification. |
| G2.3 | **NEVER use global mutable variables to share state between requests.** | Prevents race conditions and memory leaks. |
| G2.4 | **NEVER cache results that depend on previous tool invocations.** | Each request must produce identical results given identical inputs. |
| G2.5 | **Tool handlers MUST be pure functions of their inputs** (plus immutable knowledge base). | Enables parallel execution and deterministic testing. |

**Violation Example (FORBIDDEN):**
```typescript
// ❌ NEVER DO THIS
let lastQuery: string;
function searchDocs(params) {
  if (!params.query) params.query = lastQuery; // Using previous state
  lastQuery = params.query;
  // ...
}
```

**Correct Pattern:**
```typescript
// ✅ CORRECT
function searchDocs(params: { query: string }): SearchResult {
  // All inputs explicit, no external state
  return bm25Search(knowledgeBase.docs, params.query);
}
```

---

### 🔒 G3: Version-Aware Knowledge Handling

| ID | Constraint | Rationale |
|----|------------|-----------|
| G3.1 | **ALL documentation entries MUST have a `version` field** with value `'v5'`. | All content targets FeathersJS v5 only. |
| G3.2 | **ALL template fragments MUST have a `version` field.** | Generated code must be version-consistent. |
| G3.3 | **ALL code snippets MUST have a `version` field.** | Examples must match FeathersJS v5. |
| G3.4 | **All content is v5 only.** No v4 content is provided or supported. | v4 is deprecated; v5 is the current stable release. |
| G3.5 | **Default version is `'v5'`** — the only supported version. | Simplifies implementation; no version-mixing risk. |

**Violation Example (FORBIDDEN):**
```json
// ❌ NEVER DO THIS - missing version
{
  "id": "service-basics",
  "title": "Creating Services",
  "content": "..."
}
```

**Correct Pattern:**
```json
// ✅ CORRECT
{
  "id": "service-basics",
  "title": "Creating Services",
  "version": "v5",
  "content": "..."
}
```

---

### 🔒 G4: Response Time Limits (NFR-001)

| ID | Constraint | Rationale |
|----|------------|-----------|
| G4.1 | **ALL tool handlers MUST complete in <2 seconds** (p95 latency). | NFR-001 explicit requirement. |
| G4.2 | **Server initialization MUST complete in <3 seconds.** | FR-001 explicit requirement. |
| G4.3 | **NEVER perform synchronous blocking operations** that could exceed timeout. | Blocks event loop, degrades all responses. |
| G4.4 | **ALL tool handlers MUST be wrapped in 10-second timeout.** | Prevents resource exhaustion from runaway operations. |
| G4.5 | **Validation step MUST complete in <500ms.** | Budget allocated in design decisions. |
| G4.6 | **PREFER pre-computation over runtime computation.** Pre-tokenize docs, pre-compile schemas. | Shifts work to build time, not request time. |

**Violation Example (FORBIDDEN):**
```typescript
// ❌ NEVER DO THIS - unbounded operation
function searchDocs(query: string) {
  const allDocs = fs.readdirSync('/docs').map(f => fs.readFileSync(f)); // Sync I/O
  return allDocs.filter(d => d.includes(query)); // No limit
}
```

**Correct Pattern:**
```typescript
// ✅ CORRECT - pre-loaded, bounded
function searchDocs(query: string, limit = 10) {
  return preloadedIndex.search(query).slice(0, limit);
}
```

---

### 🔒 G5: Memory Limits (NFR-002)

| ID | Constraint | Rationale |
|----|------------|-----------|
| G5.1 | **Peak memory usage MUST stay under 200MB.** | NFR-002 explicit requirement. |
| G5.2 | **Preloaded knowledge base content MUST stay under 100MB.** | Leaves 100MB for runtime operations. |
| G5.3 | **NEVER load entire knowledge base into memory at once** if it would exceed limits. | Use hybrid loading: preload frequent, lazy-load rare. |
| G5.4 | **NEVER accumulate unbounded arrays or objects.** Always have size limits. | Prevents memory leaks over long-running sessions. |
| G5.5 | **NEVER store generated code in memory after returning.** | Generated code is for client, not server storage. |
| G5.6 | **Cache eviction MUST be implemented** if caching is used. LRU with max size. | Prevents unbounded cache growth. |

**Violation Example (FORBIDDEN):**
```typescript
// ❌ NEVER DO THIS - unbounded accumulation
const generatedCodeHistory: string[] = [];
function generateService(params) {
  const code = buildCode(params);
  generatedCodeHistory.push(code); // Memory leak!
  return code;
}
```

**Correct Pattern:**
```typescript
// ✅ CORRECT - no accumulation
function generateService(params): GeneratedCode {
  return buildCode(params); // Return only, don't store
}
```

---

### 🔒 G6: Validation-First Code Generation (NFR-004)

| ID | Constraint | Rationale |
|----|------------|-----------|
| G6.1 | **ALL generated code MUST pass TypeScript compilation** before being returned. | NFR-004 requires quality outputs. |
| G6.2 | **ALL generated code MUST pass ESLint validation** before being returned. | Ensures code follows best practices. |
| G6.3 | **ALL generated code MUST pass Prettier formatting** before being returned. | Consistent code style. |
| G6.4 | **NEVER return code that fails validation.** Fail the request instead. | Broken code wastes user time. |
| G6.5 | **Validation errors MUST be reported with line numbers and messages.** | Enables debugging if validation is bypassed for inspection. |
| G6.6 | **Template fragments MUST be pre-validated** during development. | Catches errors at build time, not runtime. |

**Violation Example (FORBIDDEN):**
```typescript
// ❌ NEVER DO THIS - returning unvalidated code
function generateService(params) {
  const code = buildCode(params);
  return code; // What if it has syntax errors?
}
```

**Correct Pattern:**
```typescript
// ✅ CORRECT - validate before return
function generateService(params): GeneratedCode {
  const code = buildCode(params);
  const validation = validationPipeline.validate(code);
  if (!validation.valid) {
    throw new ValidationError(validation.errors);
  }
  return code;
}
```

---

### 🔒 G7: Four-Layer Architecture

| ID | Constraint | Rationale |
|----|------------|-----------|
| G7.1 | **Protocol Layer MUST NOT directly access Knowledge Base.** Must go through Tools. | Maintains separation of concerns. |
| G7.2 | **Tool Routing Layer MUST NOT implement business logic.** Only validation, routing, timeout. | Single responsibility principle. |
| G7.3 | **Tool Implementation Layer MUST NOT handle JSON-RPC serialization.** That's Protocol Layer's job. | Layer isolation. |
| G7.4 | **Knowledge Base Layer MUST NOT know about MCP protocol.** It only stores and retrieves data. | Enables testing without protocol overhead. |
| G7.5 | **Cross-layer imports MUST flow downward only:** Protocol → Routing → Tools → Knowledge. | Prevents circular dependencies. |
| G7.6 | **Each layer MUST be independently testable** with mocked adjacent layers. | Enables unit testing. |

**Violation Example (FORBIDDEN):**
```typescript
// ❌ NEVER DO THIS - Protocol Layer accessing Knowledge directly
// In src/protocol/handlers/callTool.ts
import { loader } from '../../knowledge/loader';
const docs = loader.load('docs'); // Wrong! Should go through Tools layer
```

**Correct Pattern:**
```typescript
// ✅ CORRECT - Protocol delegates to Routing, which invokes Tools
// In src/protocol/handlers/callTool.ts
import { router } from '../../routing';
const result = await router.route({ tool: 'search_docs', params });
```

---

### 🔒 G8: MCP Protocol Compliance

| ID | Constraint | Rationale |
|----|------------|-----------|
| G8.1 | **ALL communication MUST use stdio transport** (stdin/stdout). | MCP specification requirement. |
| G8.2 | **NEVER write non-JSON-RPC content to stdout.** Use stderr for logs. | stdout is exclusively for MCP messages. |
| G8.3 | **ALL tool metadata MUST include JSON Schema for parameters.** | Enables AI assistant parameter validation. |
| G8.4 | **Error responses MUST follow MCP error format** with code and message. | Protocol compliance. |
| G8.5 | **Tool names MUST be snake_case** (e.g., `search_docs`, not `searchDocs`). | MCP convention. |
| G8.6 | **NEVER block the event loop.** All I/O must be async. | Maintains responsiveness to MCP messages. |

**Violation Example (FORBIDDEN):**
```typescript
// ❌ NEVER DO THIS - logging to stdout
console.log('Processing request...'); // Corrupts MCP message stream!
```

**Correct Pattern:**
```typescript
// ✅ CORRECT - logging to stderr
console.error('Processing request...'); // stderr is safe for logs
```

---

### 🔒 G9: Testing Requirements

| ID | Constraint | Rationale |
|----|------------|-----------|
| G9.1 | **Code coverage MUST be ≥80%** for branches, functions, lines, statements. | Quality requirement from Design Report. |
| G9.2 | **ALL tools MUST have unit tests.** | Ensures tool correctness. |
| G9.3 | **ALL generated code MUST be tested** by compiling it. | Validates code generation. |
| G9.4 | **Integration tests MUST cover full request flow.** | Catches layer integration issues. |
| G9.5 | **Performance tests MUST verify NFR-001 and NFR-002.** | Prevents regression. |

---

### 🔒 G10: Technology Constraints

| ID | Constraint | Rationale |
|----|------------|-----------|
| G10.1 | **Runtime MUST be Node.js v20 LTS.** No other runtimes (Deno, Bun). | Design Report decision. |
| G10.2 | **Language MUST be TypeScript with strict mode.** | Design Report decision. |
| G10.3 | **MCP SDK MUST be `@modelcontextprotocol/sdk`.** Official Anthropic SDK only. | Design Report decision. |
| G10.4 | **JSON Schema validation MUST use Ajv.** | Design Report decision. |
| G10.5 | **Testing MUST use Jest with ts-jest.** | Design Report decision. |
| G10.6 | **Search MUST use custom BM25 implementation.** No external search libraries. | Design Report decision. |
| G10.7 | **NEVER add dependencies not specified in Design Report** without explicit approval. | Prevents scope creep and bloat. |

---

### Guardrail Checklist for Every Code Change

Before committing any code, verify:

- [ ] No network requests at runtime (G1)
- [ ] No session state between tool calls (G2)
- [ ] All knowledge content has version tags (G3)
- [ ] Response time budget respected (G4)
- [ ] Memory allocations bounded (G5)
- [ ] Generated code passes validation (G6)
- [ ] Layer boundaries respected (G7)
- [ ] MCP protocol followed (G8)
- [ ] Tests written and passing (G9)
- [ ] Only approved technologies used (G10)

---

## 🛠️ MCP Tool Implementation Order

This section defines the optimal order for implementing the 11 MCP tools, designed to minimize rework, maximize code reuse, and enable early end-to-end testing.

### Implementation Order Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 1: Foundation Tools (Week 3-4)                                         │
│ Enable core testing, validate infrastructure                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. search_docs        → First tool, validates full stack                   │
│  2. list_available_tools → Meta-tool, tests registry                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 2: Code Generation Tools (Week 4-5)                                    │
│ Build shared codegen utilities, enable primary workflows                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  3. validate_code      → Required by all codegen tools                      │
│  4. get_feathers_template → Uses validation, template composer              │
│  5. generate_service   → Reuses validation + AST utils                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 3: Knowledge Lookup Tools (Week 5-6)                                   │
│ Simple query tools, reuse search infrastructure                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  6. explain_concept    → Reuses search_docs BM25                            │
│  7. get_hook_example   → Simple snippet lookup                              │
│  8. get_best_practices → Simple lookup with filtering                       │
│  9. troubleshoot_error → Pattern matching (independent logic)               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 4: Advanced Tools (Week 6-7)                                           │
│ Complex tools building on all prior infrastructure                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  10. suggest_alternatives → Needs templates + snippets + search             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Tool 1: `search_docs` (IMPLEMENT FIRST)

| Attribute | Details |
|-----------|---------|
| **Why First** | (1) Simplest tool with clear inputs/outputs — validates entire stack works. (2) Exercises Knowledge Base loader. (3) Requires BM25 implementation which is reused by other tools. (4) Enables immediate end-to-end testing of MCP protocol. (5) Low risk of rework — search logic is standalone. |
| **Layers Touched** | Protocol → Routing → **Tools** → **Knowledge Base** |
| **Prerequisites** | • `BaseTool` interface (Task 4.1) <br> • Knowledge Base loader (Task 3.8) <br> • Documentation JSON files (Task 3.2) <br> • BM25 module (Task 4.2) |
| **Shared Utilities Created** | • `src/tools/search/bm25.ts` — reused by `explain_concept` <br> • `src/tools/search/tokenizer.ts` — reused by all search |
| **Testability Benefit** | Once working, can verify: server boots, routing works, tools execute, knowledge loads, responses serialize correctly. |

---

### Tool 2: `list_available_tools` (IMPLEMENT SECOND)

| Attribute | Details |
|-----------|---------|
| **Why Second** | (1) Meta-tool that tests the registry system. (2) Zero knowledge base dependency — only queries Protocol Layer. (3) Useful for debugging — "what tools are available?" (4) Validates tool registration is working correctly. |
| **Layers Touched** | Protocol → Routing → **Tools** → Protocol (registry query) |
| **Prerequisites** | • `BaseTool` interface (Task 4.1) <br> • Tool Registry (Task 1.5) <br> • At least one tool registered (`search_docs`) |
| **Shared Utilities Created** | None (consumes existing registry) |
| **Testability Benefit** | Confirms all registered tools are discoverable. Use this to verify new tools are properly registered. |

---

### Tool 3: `validate_code` (IMPLEMENT THIRD)

| Attribute | Details |
|-----------|---------|
| **Why Third** | (1) **CRITICAL DEPENDENCY** — all code generation tools require validation. (2) Building it early prevents rework when integrating validation later. (3) Can be tested independently with hardcoded code strings. (4) Establishes validation pipeline pattern used everywhere. |
| **Layers Touched** | Protocol → Routing → **Tools** → (ESLint, Prettier, TS Compiler APIs) |
| **Prerequisites** | • `BaseTool` interface (Task 4.1) <br> • ESLint configured (Task 0.5) <br> • Prettier configured (Task 0.6) <br> • TypeScript Compiler API knowledge |
| **Shared Utilities Created** | • `src/tools/validation/pipeline.ts` — **reused by tools 4, 5** <br> • `src/tools/validation/tsValidator.ts` <br> • `src/tools/validation/eslintValidator.ts` <br> • `src/tools/validation/prettierValidator.ts` <br> • `src/tools/validation/bestPracticeRules.ts` |
| **Testability Benefit** | Can test with known-good and known-bad code samples. Validation is deterministic and easy to verify. |

**Why not later?** If implemented after code generation tools, would require retrofitting validation into `get_feathers_template` and `generate_service`, causing rework.

---

### Tool 4: `get_feathers_template` (IMPLEMENT FOURTH)

| Attribute | Details |
|-----------|---------|
| **Why Fourth** | (1) Primary user workflow — Ava persona needs this first. (2) Requires validation pipeline (Tool 3) to ensure quality. (3) Template composer is complex but standalone. (4) Exercises template fragments from Knowledge Base. |
| **Layers Touched** | Protocol → Routing → **Tools** → **Knowledge Base** (templates) → **Validation** |
| **Prerequisites** | • `validate_code` tool working (Tool 3) <br> • Template fragments JSON (Task 3.3) <br> • Template Composer engine (Task 4.4) <br> • Import merger utility (Task 4.4) |
| **Shared Utilities Created** | • `src/tools/templates/composer.ts` — **reused by tool 5** <br> • `src/tools/templates/importMerger.ts` — **reused by tool 5** |
| **Testability Benefit** | Generated projects can be tested by running `tsc` on output. Validates template composition logic. |

---

### Tool 5: `generate_service` (IMPLEMENT FIFTH)

| Attribute | Details |
|-----------|---------|
| **Why Fifth** | (1) Second primary workflow tool. (2) Reuses validation pipeline from Tool 3. (3) Reuses import merger from Tool 4. (4) Requires AST utilities for code generation. (5) Completes the "generate project → add service" workflow. |
| **Layers Touched** | Protocol → Routing → **Tools** → **Knowledge Base** (templates) → **Validation** → **AST** |
| **Prerequisites** | • `validate_code` tool working (Tool 3) <br> • Import merger from Tool 4 <br> • AST utilities (Task 4.6) <br> • Schema generators (Task 4.6) |
| **Shared Utilities Created** | • `src/tools/codegen/astUtils.ts` — potentially reused <br> • `src/tools/codegen/schemaGenerator.ts` |
| **Testability Benefit** | Generated services can be tested by compiling and instantiating. Can integration test with Tool 4 output. |

**Milestone:** After Tool 5, the complete "Ava workflow" (generate project → add services) is testable end-to-end.

---

### Tool 6: `explain_concept` (IMPLEMENT SIXTH)

| Attribute | Details |
|-----------|---------|
| **Why Sixth** | (1) Reuses BM25 search from Tool 1 — minimal new code. (2) Simple retrieval tool — low complexity. (3) Supports Jason (learning) persona. (4) Good candidate for parallel implementation with Tools 7-8. |
| **Layers Touched** | Protocol → Routing → **Tools** → **Knowledge Base** (docs) |
| **Prerequisites** | • BM25 module from Tool 1 <br> • Documentation JSON (Task 3.2) <br> • Version filtering logic |
| **Shared Utilities Created** | None (reuses search infrastructure) |
| **Testability Benefit** | Easy to test with known concept names. Validates documentation content quality. |

---

### Tool 7: `get_hook_example` (IMPLEMENT SEVENTH)

| Attribute | Details |
|-----------|---------|
| **Why Seventh** | (1) Simple snippet lookup — query by type and use case. (2) No complex logic — just filtering and retrieval. (3) Independent of other tools — can parallelize with 6, 8. (4) Supports learning and code assistance workflows. |
| **Layers Touched** | Protocol → Routing → **Tools** → **Knowledge Base** (snippets) |
| **Prerequisites** | • Hook snippet JSON files (Task 3.4) <br> • Basic filtering logic |
| **Shared Utilities Created** | Snippet lookup pattern (informal, not extracted) |
| **Testability Benefit** | Test each hook type (before/after/error) returns appropriate examples. |

---

### Tool 8: `get_best_practices` (IMPLEMENT EIGHTH)

| Attribute | Details |
|-----------|---------|
| **Why Eighth** | (1) Simple topic-based lookup. (2) Independent of other tools — can parallelize with 6, 7. (3) Supports Marco (quality) persona. (4) Content-heavy but logic-light. |
| **Layers Touched** | Protocol → Routing → **Tools** → **Knowledge Base** (best-practices) |
| **Prerequisites** | • Best practices JSON files (Task 3.7) <br> • Topic filtering logic |
| **Shared Utilities Created** | None |
| **Testability Benefit** | Test each topic returns relevant practices with good/bad examples. |

---

### Tool 9: `troubleshoot_error` (IMPLEMENT NINTH)

| Attribute | Details |
|-----------|---------|
| **Why Ninth** | (1) Unique pattern-matching logic — doesn't reuse other tool code. (2) Can be developed independently. (3) Error database is self-contained. (4) Important for debugging workflows but not blocking other tools. |
| **Layers Touched** | Protocol → Routing → **Tools** → **Knowledge Base** (errors) |
| **Prerequisites** | • Error pattern JSON files (Task 3.6) <br> • Regex pattern matching logic <br> • Error ranking by specificity |
| **Shared Utilities Created** | • `src/tools/errorMatcher.ts` (internal to tool) |
| **Testability Benefit** | Test with known error messages from FeathersJS issues. Verify pattern matching accuracy. |

---

### Tool 10: `suggest_alternatives` (IMPLEMENT TENTH)

| Attribute | Details |
|-----------|---------|
| **Why Tenth** | (1) Complex tool requiring multiple knowledge sources. (2) Needs templates, snippets, and search to find alternatives. (3) Lower priority (COULD HAVE). (4) Benefits from all prior infrastructure being stable. |
| **Layers Touched** | Protocol → Routing → **Tools** → **Knowledge Base** (templates, snippets, docs) |
| **Prerequisites** | • All Tier 1-3 tools working <br> • Template fragments <br> • Code snippets <br> • Search infrastructure |
| **Shared Utilities Created** | None (composes existing utilities) |
| **Testability Benefit** | Test with common patterns; verify 2+ alternatives returned with trade-offs. |

---

### Tool 11: ~~REMOVED~~ (`get_migration_guide` — v4 support dropped)

> This tool has been removed. v4 migration support is not provided. The server targets FeathersJS v5 only.

---

### Dependency Graph for Tools

```
                    ┌─────────────────────┐
                    │   BaseTool (4.1)    │
                    │   KnowledgeLoader   │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
    ┌─────────────────┐ ┌─────────────┐ ┌──────────────────┐
    │ 1. search_docs  │ │ 2. list_    │ │ 3. validate_code │
    │                 │ │ available_  │ │                  │
    │ Creates: BM25   │ │ tools       │ │ Creates:         │
    └────────┬────────┘ └─────────────┘ │ ValidationPipeline│
             │                          └─────────┬────────┘
             │                                    │
             │          ┌─────────────────────────┤
             │          │                         │
             │          ▼                         ▼
             │  ┌───────────────────┐   ┌─────────────────────┐
             │  │ 4. get_feathers_  │   │ 5. generate_service │
             │  │ template          │──▶│                     │
             │  │                   │   │ Reuses: Validation, │
             │  │ Creates: Composer │   │ ImportMerger, AST   │
             │  └───────────────────┘   └─────────────────────┘
             │
    ┌────────┴────────────────────────────────────┐
    │                                             │
    ▼                                             │
┌─────────────────┐                               │
│ 6. explain_     │                               │
│ concept         │                               │
│ Reuses: BM25    │                               │
└─────────────────┘                               │
                                                  │
┌─────────────────┐ ┌─────────────────┐ ┌─────────┴───────┐
│ 7. get_hook_    │ │ 8. get_best_    │ │ 9. troubleshoot_│
│ example         │ │ practices       │ │ error           │
│ (independent)   │ │ (independent)   │ │ (independent)   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼                                 ▼
    ┌─────────────────────┐
    │ 10. suggest_        │
    │ alternatives        │
    │ (uses all above)    │
    └─────────────────────┘
```

---

### Parallelization Within Tiers

| Tier | Tools | Can Parallelize? |
|------|-------|------------------|
| **Tier 1** | 1, 2 | Yes — after `BaseTool` exists, both can be built simultaneously |
| **Tier 2** | 3, 4, 5 | Partial — Tool 3 must complete before 4 and 5. Tools 4 and 5 can partially overlap |
| **Tier 3** | 6, 7, 8, 9 | Yes — all four tools are independent and can be built in parallel |
| **Tier 4** | 10, 11 | Yes — both are independent of each other |

---

### Shared Utility Extraction Summary

Building tools in this order creates reusable utilities that reduce code in later tools:

| Utility | Created By | Reused By |
|---------|------------|-----------|
| `bm25.ts` | Tool 1 | Tool 6 |
| `tokenizer.ts` | Tool 1 | Tool 6, potentially others |
| `ValidationPipeline` | Tool 3 | Tools 4, 5 |
| `tsValidator.ts` | Tool 3 | Tools 4, 5 |
| `eslintValidator.ts` | Tool 3 | Tools 4, 5 |
| `prettierValidator.ts` | Tool 3 | Tools 4, 5 |
| `bestPracticeRules.ts` | Tool 3 | Tools 4, 5 |
| `composer.ts` | Tool 4 | Tool 5 |
| `importMerger.ts` | Tool 4 | Tool 5 |
| `astUtils.ts` | Tool 5 | Potentially Tool 10 |

---

### Risk Mitigation Through Order

| Risk | How Order Mitigates |
|------|---------------------|
| **Protocol Layer bugs** | Tool 1 (`search_docs`) validates full protocol stack early |
| **Validation integration pain** | Tool 3 built before any code generation tools |
| **Template composition complexity** | Tool 4 isolates composer logic before service generation |
| **Knowledge Base format issues** | Tools 1, 6, 7, 8 exercise all content types early |
| **Version mixing** | N/A — v4 support dropped; server targets v5 only |

---

## Phase 0: Project Initialization & Infrastructure Setup

### Objective
Establish the foundational project structure, install all dependencies, and configure development tooling to enable parallel development across all four architectural layers.

### Components/Layers Involved
- Infrastructure (build system, testing framework, linting)
- Project scaffolding for all four layers

### Prerequisites
- Node.js v20 LTS installed on development machine
- npm available
- Git initialized (optional but recommended)

### Exit Artifacts
When Phase 0 is complete, the following must exist:
- [ ] `package.json` with all dependencies installed and scripts configured
- [ ] `tsconfig.json` with strict TypeScript configuration
- [ ] `.eslintrc.json` with TypeScript rules
- [ ] `.prettierrc` with formatting rules
- [ ] `jest.config.js` with ts-jest preset and 80% coverage threshold
- [ ] Directory structure: `src/protocol/`, `src/routing/`, `src/tools/`, `src/knowledge/`
- [ ] Directory structure: `knowledge-base/docs/`, `templates/`, `snippets/`, `errors/`, `best-practices/`
- [ ] Directory structure: `tests/`
- [ ] `tests/helpers/mockTransport.ts` — reusable mock stdio transport for testing
- [ ] `npm run build`, `npm run test`, `npm run lint` commands working

---

### Tasks

#### Task 0.1: Initialize Node.js Project Structure
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `package.json`, `tsconfig.json`, `src/`, `src/index.ts`, `src/protocol/`, `src/routing/`, `src/tools/`, `src/knowledge/`, `tests/`, `knowledge-base/`, `knowledge-base/docs/`, `knowledge-base/templates/`, `knowledge-base/snippets/`, `knowledge-base/errors/`, `knowledge-base/best-practices/` |
| **Definition of Done** | (1) `npm init` completed with `package.json` containing `name`, `version`, `main`, `engines: { node: ">=20.0.0" }`. (2) `tsconfig.json` exists with `strict: true`, `target: "ES2022"`, `module: "NodeNext"`, `outDir: "./dist"`. (3) All directories created and empty placeholder `.gitkeep` or `index.ts` files present. (4) `src/index.ts` contains minimal placeholder export. |
| **Dependencies** | None |
| **Parallelizable** | No (must complete first) |

#### Task 0.2: Install Production Dependencies
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `package.json`, `package-lock.json` |
| **Definition of Done** | (1) `@modelcontextprotocol/sdk` installed. (2) `ajv` installed. (3) `typescript` installed as devDependency. (4) All dependencies listed in `package.json`. (5) `npm install` runs without errors. |
| **Dependencies** | Task 0.1 |
| **Parallelizable** | No |

#### Task 0.3: Install Development Dependencies
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `package.json`, `package-lock.json` |
| **Definition of Done** | (1) `ts-node` installed. (2) `jest` and `ts-jest` installed. (3) `@types/jest` and `@types/node` installed. (4) `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin` installed. (5) `prettier` installed. |
| **Dependencies** | Task 0.1 |
| **Parallelizable** | Yes (can run with Task 0.2 if done atomically, but safer sequential) |

#### Task 0.4: Configure TypeScript Compiler
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `tsconfig.json` |
| **Definition of Done** | (1) `strict: true` enabled. (2) `esModuleInterop: true` set. (3) `resolveJsonModule: true` for JSON imports. (4) `declaration: true` for type definitions. (5) `npx tsc --noEmit` runs without errors on empty project. |
| **Dependencies** | Task 0.2 |
| **Parallelizable** | Yes |

#### Task 0.5: Configure ESLint
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `.eslintrc.json`, `package.json` (scripts) |
| **Definition of Done** | (1) `.eslintrc.json` extends `@typescript-eslint/recommended`. (2) Parser set to `@typescript-eslint/parser`. (3) `npm run lint` script added to `package.json`. (4) Running `npm run lint` on empty `src/` produces no errors. |
| **Dependencies** | Task 0.3 |
| **Parallelizable** | Yes (with Task 0.6, 0.7) |

#### Task 0.6: Configure Prettier
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `.prettierrc`, `.prettierignore`, `package.json` (scripts) |
| **Definition of Done** | (1) `.prettierrc` with `semi: true`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: "es5"`. (2) `.prettierignore` excludes `dist/`, `node_modules/`, `coverage/`. (3) `npm run format` script added. (4) Running `npm run format` completes without errors. |
| **Dependencies** | Task 0.3 |
| **Parallelizable** | Yes (with Task 0.5, 0.7) |

#### Task 0.7: Configure Jest Testing Framework
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `jest.config.js`, `package.json` (scripts) |
| **Definition of Done** | (1) `jest.config.js` uses `ts-jest` preset. (2) `testMatch` set to `["**/tests/**/*.test.ts"]`. (3) `coverageThreshold` set to `global: { branches: 80, functions: 80, lines: 80, statements: 80 }`. (4) `npm run test` script added. (5) Running `npm run test` with no tests shows "No tests found" (not an error). |
| **Dependencies** | Task 0.3 |
| **Parallelizable** | Yes (with Task 0.5, 0.6) |

#### Task 0.8: Configure npm Scripts
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `package.json` |
| **Definition of Done** | Scripts exist: (1) `build`: `tsc`. (2) `start`: `node dist/index.js`. (3) `dev`: `ts-node src/index.ts`. (4) `test`: `jest`. (5) `test:coverage`: `jest --coverage`. (6) `lint`: `eslint src/ tests/`. (7) `format`: `prettier --write src/ tests/`. (8) All scripts execute without configuration errors. |
| **Dependencies** | Tasks 0.4, 0.5, 0.6, 0.7 |
| **Parallelizable** | No (aggregates previous tasks) |

#### Task 0.9: Create .gitignore
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `.gitignore` |
| **Definition of Done** | `.gitignore` includes: `node_modules/`, `dist/`, `coverage/`, `*.log`, `.env`, `.DS_Store`. |
| **Dependencies** | Task 0.1 |
| **Parallelizable** | Yes |

#### Task 0.10: Create Mock stdio Transport Helper
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `tests/helpers/mockTransport.ts`, `tests/helpers/index.ts` |
| **Definition of Done** | (1) `MockTransport` class created with `send(message: string)` and `receive(): Promise<string>` methods. (2) Simulates stdin/stdout for MCP protocol testing. (3) Exported from `tests/helpers/index.ts`. (4) JSDoc comments documenting usage. (5) Can be imported in test files. |
| **Dependencies** | Tasks 0.2, 0.4 |
| **Parallelizable** | Yes |

---

## Phase 1: Protocol Layer Implementation

### Objective
Implement the MCP server that handles stdio transport communication, performs protocol handshakes, registers tools dynamically, and serializes/deserializes JSON-RPC messages. This layer is the entry point for all AI assistant interactions.

### Components/Layers Involved
- Protocol Layer (`src/protocol/`)
- Entry point (`src/index.ts`)

### Prerequisites
- Phase 0 complete (all infrastructure and dependencies ready)
- MCP SDK installed and importable

### Exit Artifacts
When Phase 1 is complete, the following must exist:
- [ ] `src/protocol/server.ts` — MCP server initialization, stdio transport, handshake
- [ ] `src/protocol/registry.ts` — Dynamic tool registration mechanism
- [ ] `src/index.ts` — Main entry point that boots server and registers tools
- [ ] Server initializes within 3 seconds (FR-001 requirement)
- [ ] `ListTools` request returns empty tool list (tools added in later phases)
- [ ] JSON-RPC messages serialize/deserialize correctly
- [ ] `tests/protocol/` — Unit tests for all Protocol Layer components
- [ ] Running `npm start` launches the MCP server on stdio

---

### Tasks

#### Task 1.1: Create MCP Server Class
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/protocol/server.ts`, `src/protocol/index.ts` |
| **Definition of Done** | (1) `McpServer` class created using `@modelcontextprotocol/sdk`. (2) Constructor accepts configuration options. (3) `start()` method initializes server and begins listening. (4) `stop()` method cleanly shuts down. (5) Exported from `src/protocol/index.ts`. (6) TypeScript compiles without errors. |
| **Dependencies** | Task 0.2, Task 0.4 |
| **Parallelizable** | Yes (with Task 1.2 initial work) |

#### Task 1.2: Implement stdio Transport Handler
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/protocol/transport.ts` |
| **Definition of Done** | (1) `StdioTransport` class wraps `process.stdin` and `process.stdout`. (2) Implements MCP SDK transport interface. (3) Handles message framing per MCP specification. (4) Gracefully handles stream errors. (5) Unit test verifies message round-trip. |
| **Dependencies** | Task 1.1 |
| **Parallelizable** | No |

#### Task 1.3: Implement Connection Handshake
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/protocol/handshake.ts` |
| **Definition of Done** | (1) `performHandshake()` function handles MCP `initialize` request. (2) Returns server capabilities and protocol version. (3) Validates client capabilities. (4) Handshake completes in <500ms. (5) Unit test verifies successful handshake flow. |
| **Dependencies** | Task 1.2 |
| **Parallelizable** | No |

#### Task 1.4: Create Tool Metadata Interface
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/protocol/types.ts` |
| **Definition of Done** | (1) `ToolMetadata` interface defined with: `name: string`, `description: string`, `inputSchema: JSONSchema`, `examples?: ToolExample[]`. (2) `ToolHandler` type defined as async function signature. (3) `ToolRegistration` interface combining metadata and handler. (4) All types exported. |
| **Dependencies** | Task 0.4 |
| **Parallelizable** | Yes |

#### Task 1.5: Implement Tool Registry
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/protocol/registry.ts` |
| **Definition of Done** | (1) `ToolRegistry` class with `register(tool: ToolRegistration)` method. (2) `getTools(): ToolMetadata[]` returns all registered tool metadata. (3) `getHandler(name: string): ToolHandler` retrieves handler by name. (4) Throws descriptive error for unknown tools. (5) Unit tests for register, get, and error cases. |
| **Dependencies** | Task 1.4 |
| **Parallelizable** | Yes (with Task 1.2, 1.3) |

#### Task 1.6: Implement ListTools Request Handler
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/protocol/handlers/listTools.ts` |
| **Definition of Done** | (1) Handler responds to MCP `tools/list` request. (2) Returns array of tool metadata from registry. (3) Response format matches MCP specification. (4) Unit test verifies correct response structure. |
| **Dependencies** | Task 1.5 |
| **Parallelizable** | Yes (with Task 1.7) |

#### Task 1.7: Implement CallTool Request Handler
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/protocol/handlers/callTool.ts` |
| **Definition of Done** | (1) Handler responds to MCP `tools/call` request. (2) Extracts tool name and arguments from request. (3) Delegates to Tool Routing Layer (placeholder for now). (4) Formats response per MCP specification. (5) Returns structured error for unknown tools. |
| **Dependencies** | Task 1.5 |
| **Parallelizable** | Yes (with Task 1.6) |

#### Task 1.8: Create Main Entry Point
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/index.ts` |
| **Definition of Done** | (1) Imports and instantiates `McpServer`. (2) Calls `server.start()` on process launch. (3) Registers `SIGINT` and `SIGTERM` handlers for graceful shutdown. (4) Logs startup message to stderr (not stdout, which is for MCP). (5) Server initializes in <3 seconds (FR-001). (6) Running `npm run dev` starts the server. |
| **Dependencies** | Tasks 1.1, 1.3, 1.5, 1.6, 1.7 |
| **Parallelizable** | No (integration point) |

#### Task 1.9: Protocol Layer Unit Tests
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `tests/protocol/server.test.ts`, `tests/protocol/registry.test.ts`, `tests/protocol/handlers.test.ts` |
| **Definition of Done** | (1) Test server initialization completes <3s. (2) Test tool registration and retrieval. (3) Test ListTools response format. (4) Test CallTool with mock handler. (5) Test error handling for unknown tools. (6) All tests pass with `npm run test`. (7) >80% coverage for `src/protocol/`. |
| **Dependencies** | Task 1.8, Task 0.10 |
| **Parallelizable** | No (requires implementation complete) |

---

## Phase 2: Tool Routing Layer Implementation

### Objective
Build the middleware layer that validates incoming tool requests against JSON schemas, routes requests to appropriate handlers, enforces timeouts, and formats errors consistently. This layer sits between Protocol and Tool Implementation layers.

### Components/Layers Involved
- Tool Routing Layer (`src/routing/`)

### Prerequisites
- Phase 1 complete (Protocol Layer operational)
- Ajv JSON Schema validator installed

### Exit Artifacts
When Phase 2 is complete, the following must exist:
- [ ] `src/routing/toolRegistry.ts` — Registry pattern mapping tool names to handlers
- [ ] `src/routing/validator.ts` — Ajv-based parameter validation
- [ ] `src/routing/errorHandler.ts` — Centralized error handling and formatting
- [ ] `src/routing/timeout.ts` — 10-second timeout wrapper utility
- [ ] `src/routing/router.ts` — Main router integrating all components
- [ ] Invalid parameters return descriptive validation errors
- [ ] Handlers exceeding 10 seconds are terminated with timeout error
- [ ] `tests/routing/` — Unit tests for validation, timeout, error handling
- [ ] Router can be invoked from Protocol Layer with mock tool handlers

---

### Tasks

#### Task 2.1: Create Routing Types and Interfaces
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/routing/types.ts` |
| **Definition of Done** | (1) `ToolRequest` interface with `toolName: string`, `params: unknown`. (2) `ToolResponse` interface with `success: boolean`, `data?: unknown`, `error?: ToolError`. (3) `ToolError` interface with `code: string`, `message: string`, `details?: unknown`. (4) `RouterConfig` interface for configuration. (5) All types exported. |
| **Dependencies** | Task 0.4 |
| **Parallelizable** | Yes |

#### Task 2.2: Implement Tool Handler Registry
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/routing/toolRegistry.ts` |
| **Definition of Done** | (1) `ToolHandlerRegistry` class with `register(name: string, handler: ToolHandler, schema: JSONSchema)`. (2) `lookup(name: string)` returns handler or throws. (3) `getSchema(name: string)` returns JSON schema for tool. (4) `has(name: string)` checks if tool exists. (5) Unit tests for all methods. |
| **Dependencies** | Task 2.1 |
| **Parallelizable** | Yes |

#### Task 2.3: Implement Ajv Parameter Validator
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/routing/validator.ts` |
| **Definition of Done** | (1) `ParameterValidator` class wraps Ajv. (2) `validate(params: unknown, schema: JSONSchema): ValidationResult`. (3) `ValidationResult` contains `valid: boolean`, `errors?: ValidationError[]`. (4) Errors include path, message, and expected type. (5) Unit tests with valid/invalid params against sample schemas. |
| **Dependencies** | Task 0.2 (Ajv installed), Task 2.1 |
| **Parallelizable** | Yes |

#### Task 2.4: Implement Error Handler
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/routing/errorHandler.ts` |
| **Definition of Done** | (1) `ErrorHandler` class with `handle(error: Error): ToolError`. (2) Maps known error types to structured `ToolError`. (3) Sanitizes stack traces (no internal paths exposed). (4) Logs full error to stderr for debugging. (5) Returns user-safe error messages. (6) Unit tests for various error types. |
| **Dependencies** | Task 2.1 |
| **Parallelizable** | Yes (with Task 2.3) |

#### Task 2.5: Implement Timeout Wrapper
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/routing/timeout.ts` |
| **Definition of Done** | (1) `withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T>` utility. (2) Rejects with `TimeoutError` if `fn` exceeds `ms`. (3) `TimeoutError` extends `Error` with `code: 'TIMEOUT'`. (4) Properly cleans up timeout on success. (5) Default timeout is 10000ms. (6) Unit test verifies timeout behavior. |
| **Dependencies** | Task 2.1 |
| **Parallelizable** | Yes (with Task 2.3, 2.4) |

#### Task 2.6: Implement Request Router
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/routing/router.ts`, `src/routing/index.ts` |
| **Definition of Done** | (1) `Router` class with `route(request: ToolRequest): Promise<ToolResponse>`. (2) Flow: validate params → lookup handler → execute with timeout → format response. (3) Catches all errors via ErrorHandler. (4) Constructor accepts `RouterConfig` with timeout setting. (5) Exported from `src/routing/index.ts`. (6) Integration test with mock handler. |
| **Dependencies** | Tasks 2.2, 2.3, 2.4, 2.5 |
| **Parallelizable** | No (depends on all above) |

#### Task 2.7: Integrate Router with Protocol Layer
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/protocol/handlers/callTool.ts`, `src/index.ts` |
| **Definition of Done** | (1) `callTool` handler delegates to `Router.route()`. (2) Router instantiated in `src/index.ts` with registry. (3) Tool invocation flows through full Protocol → Routing path. (4) Integration test verifies end-to-end with mock tool. |
| **Dependencies** | Task 2.6, Task 1.7 |
| **Parallelizable** | No |

#### Task 2.8: Tool Routing Layer Unit Tests
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `tests/routing/validator.test.ts`, `tests/routing/timeout.test.ts`, `tests/routing/router.test.ts`, `tests/routing/errorHandler.test.ts` |
| **Definition of Done** | (1) Test valid params pass validation. (2) Test invalid params return descriptive errors. (3) Test timeout triggers after configured duration. (4) Test router handles validation failure. (5) Test router handles handler exception. (6) Test router handles timeout. (7) >80% coverage for `src/routing/`. |
| **Dependencies** | Task 2.7 |
| **Parallelizable** | No |

---

## Phase 3: Knowledge Base Layer Implementation

### Objective
Create the embedded knowledge base containing all FeathersJS v5 documentation, template fragments, code snippets, error patterns, and best practices. All content targets v5 only and is pre-tokenized for fast search. This is the data layer that all tools query.

### Components/Layers Involved
- Knowledge Base Layer (`src/knowledge/`, `knowledge-base/`)

### Prerequisites
- Phase 0 complete (directory structure exists)
- Can proceed in parallel with Phases 1 and 2

### Exit Artifacts
When Phase 3 is complete, the following must exist:
- [ ] `knowledge-base/docs/*.json` — FeathersJS documentation entries, version-tagged
- [ ] `knowledge-base/templates/*.json` — Composable template fragments for projects/services
- [ ] `knowledge-base/snippets/*.json` — Hook and service code examples
- [ ] `knowledge-base/errors/*.json` — 20+ common error patterns with solutions
- [ ] `knowledge-base/best-practices/*.json` — Best practice rules and examples
- [ ] `src/knowledge/loader.ts` — Hybrid loader (preload frequent, lazy-load rare)
- [ ] `src/knowledge/types.ts` — TypeScript interfaces for all knowledge base content
- [ ] All JSON files valid and parseable
- [ ] Memory usage of preloaded content <100MB (leaving room for runtime)
- [ ] `tests/knowledge/` — Tests for loader and content integrity

---

### Tasks

#### Task 3.1: Define Knowledge Base Type Interfaces
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/knowledge/types.ts` |
| **Definition of Done** | (1) `DocEntry` interface: `id`, `title`, `content`, `version: 'v5'`, `tokens: string[]`, `category`. (2) `TemplateFragment` interface: `id`, `name`, `code`, `imports`, `dependencies`, `featureFlags`, `version`. (3) `CodeSnippet` interface: `id`, `type`, `useCase`, `code`, `explanation`, `version`. (4) `ErrorPattern` interface: `id`, `pattern: RegExp`, `cause`, `solution`, `example`. (5) `BestPractice` interface: `id`, `topic`, `rule`, `rationale`, `goodExample`, `badExample`. |
| **Dependencies** | Task 0.4 |
| **Parallelizable** | Yes |

#### Task 3.2: Create Documentation JSON Files
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `knowledge-base/docs/core-concepts.json`, `knowledge-base/docs/services.json`, `knowledge-base/docs/hooks.json`, `knowledge-base/docs/authentication.json`, `knowledge-base/docs/databases.json` |
| **Definition of Done** | (1) Each file contains array of `DocEntry` objects. (2) All entries have `version: 'v5'`. (3) Content pre-tokenized in `tokens` array. (4) Minimum 10 documentation entries per file. (5) JSON validates against `DocEntry` schema. (6) Covers: services, hooks, authentication, database adapters, configuration. |
| **Dependencies** | Task 3.1 |
| **Parallelizable** | Yes (each file independent) |

#### Task 3.3: Create Template Fragment JSON Files
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `knowledge-base/templates/base-project.json`, `knowledge-base/templates/service.json`, `knowledge-base/templates/authentication.json`, `knowledge-base/templates/mongodb.json`, `knowledge-base/templates/postgresql.json`, `knowledge-base/templates/sqlite.json` |
| **Definition of Done** | (1) Each file contains composable `TemplateFragment` objects. (2) `base-project.json` has minimal FeathersJS app structure. (3) Database adapters (`mongodb`, `postgresql`, `sqlite`) include connection config and adapter setup. (4) `authentication.json` includes JWT and local strategy fragments. (5) All fragments have `imports` array for composition. (6) `featureFlags` specify when fragment applies. |
| **Dependencies** | Task 3.1 |
| **Parallelizable** | Yes (each file independent) |

#### Task 3.4: Create Hook Snippet JSON Files
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `knowledge-base/snippets/hooks-before.json`, `knowledge-base/snippets/hooks-after.json`, `knowledge-base/snippets/hooks-error.json`, `knowledge-base/snippets/hooks-common.json` |
| **Definition of Done** | (1) Each file contains `CodeSnippet` objects for hook type. (2) `hooks-before.json`: validation, authentication, data transformation. (3) `hooks-after.json`: response formatting, logging, notifications. (4) `hooks-error.json`: error handling, retry logic, fallbacks. (5) Each snippet has `explanation` with usage guidance. (6) Minimum 5 snippets per hook type. |
| **Dependencies** | Task 3.1 |
| **Parallelizable** | Yes (each file independent) |

#### Task 3.5: Create Service Snippet JSON Files
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `knowledge-base/snippets/services-custom.json`, `knowledge-base/snippets/services-patterns.json` |
| **Definition of Done** | (1) `services-custom.json`: custom service class examples, external API integration. (2) `services-patterns.json`: common patterns like soft delete, audit logging, caching. (3) Each snippet has `useCase` describing when to use. (4) Includes both TypeScript and JavaScript variants where relevant. (5) Minimum 8 service snippets total. |
| **Dependencies** | Task 3.1 |
| **Parallelizable** | Yes |

#### Task 3.6: Create Error Pattern Database
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `knowledge-base/errors/configuration.json`, `knowledge-base/errors/runtime.json`, `knowledge-base/errors/database.json`, `knowledge-base/errors/authentication.json` |
| **Definition of Done** | (1) Each file contains `ErrorPattern` objects for category. (2) `pattern` field contains regex string for matching. (3) Minimum 20 error patterns total across all files. (4) Each error has `cause`, `solution`, and `example` fix. (5) Covers: missing config, connection errors, auth failures, hook errors, service registration. (6) Patterns tested against real error messages. |
| **Dependencies** | Task 3.1 |
| **Parallelizable** | Yes (each file independent) |

#### Task 3.7: Create Best Practices JSON Files
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `knowledge-base/best-practices/hooks.json`, `knowledge-base/best-practices/services.json`, `knowledge-base/best-practices/security.json`, `knowledge-base/best-practices/testing.json`, `knowledge-base/best-practices/performance.json` |
| **Definition of Done** | (1) Each file contains `BestPractice` objects for topic. (2) Each practice has `goodExample` and `badExample` code. (3) `rationale` explains why the practice matters. (4) Minimum 5 practices per topic (25+ total). (5) Covers: hook ordering, error handling, input validation, testing strategies, query optimization. |
| **Dependencies** | Task 3.1 |
| **Parallelizable** | Yes (each file independent) |

#### Task 3.8: Implement Knowledge Base Loader
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/knowledge/loader.ts`, `src/knowledge/index.ts` |
| **Definition of Done** | (1) `KnowledgeLoader` class with `load(category: string): Promise<T[]>`. (2) Preloads `templates/` and core `docs/` on initialization. (3) Lazy-loads `errors/`, `snippets/`, `best-practices/` on first access. (4) Implements in-memory cache for loaded content. (5) `getAll<T>(category): T[]` returns cached or loads. (6) Memory usage of preloaded content <100MB. (7) Exported from `src/knowledge/index.ts`. |
| **Dependencies** | Tasks 3.2-3.7 |
| **Parallelizable** | No (depends on content) |

#### Task 3.9: Implement Content Search Index
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/knowledge/searchIndex.ts` |
| **Definition of Done** | (1) `SearchIndex` class builds index from `DocEntry` tokens. (2) `index(entries: DocEntry[])` adds entries to index. (3) `search(query: string): DocEntry[]` returns matching entries. (4) Uses pre-tokenized content for fast lookup. (5) Index built during loader initialization. |
| **Dependencies** | Task 3.8 |
| **Parallelizable** | No |

#### Task 3.10: Knowledge Base Layer Tests
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `tests/knowledge/loader.test.ts`, `tests/knowledge/content.test.ts`, `tests/knowledge/searchIndex.test.ts` |
| **Definition of Done** | (1) All JSON files parse without errors. (2) All entries conform to type interfaces. (3) Version tags present on all versioned content. (4) Loader preloads expected content. (5) Lazy loading works correctly. (6) Search index returns relevant results. (7) Memory usage verified <100MB for preloaded content. (8) >80% coverage for `src/knowledge/`. |
| **Dependencies** | Task 3.9 |
| **Parallelizable** | No |

---

## Phase 4: Tool Implementation Layer — Core Tools

### Objective
Implement the three most critical MCP tools: `search_docs` (documentation search with BM25 ranking), `get_feathers_template` (project template composition), and `generate_service` (service code generation). These tools directly address the primary user workflows.

### Components/Layers Involved
- Tool Implementation Layer (`src/tools/`)
- Knowledge Base Layer (queried by tools)

### Prerequisites
- Phase 2 complete (Tool Routing Layer ready to route requests)
- Phase 3 complete (Knowledge Base populated and loader working)

### Exit Artifacts
When Phase 4 is complete, the following must exist:
- [ ] `src/tools/baseTool.ts` — Base interface/abstract class for all tools
- [ ] `src/tools/searchDocs.ts` — Documentation search with BM25 ranking
- [ ] `src/tools/search/bm25.ts` — Custom BM25 algorithm implementation
- [ ] `src/tools/getTemplate.ts` — Template composition from fragments
- [ ] `src/tools/templates/composer.ts` — Fragment merging and import deduplication
- [ ] `src/tools/generateService.ts` — Service generation with schema parsing
- [ ] `src/tools/codegen/astUtils.ts` — TypeScript AST manipulation utilities
- [ ] All three tools registered and invocable via MCP protocol
- [ ] `search_docs` returns ranked results with version filtering
- [ ] `get_feathers_template` composes 8+ feature flag combinations
- [ ] `generate_service` produces service, hooks, schema, and test files
- [ ] `tests/tools/` — Unit tests for each tool
- [ ] Response time <2 seconds for typical queries

---

### Tasks

#### Task 4.1: Create Base Tool Interface
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/baseTool.ts`, `src/tools/types.ts`, `src/tools/index.ts` |
| **Definition of Done** | (1) `BaseTool` abstract class with `name`, `description`, `inputSchema` properties. (2) Abstract `execute(params: unknown): Promise<ToolResult>` method. (3) `register()` method returns `ToolRegistration` for routing layer. (4) `ToolResult` type with `content: string`, `metadata?: Record<string, unknown>`. (5) Exported from `src/tools/index.ts`. |
| **Dependencies** | Task 2.1, Task 1.4 |
| **Parallelizable** | Yes |

#### Task 4.2: Implement BM25 Search Algorithm
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/search/bm25.ts`, `src/tools/search/tokenizer.ts` |
| **Definition of Done** | (1) `BM25` class with `index(documents: Document[])` and `search(query: string, limit: number): ScoredDocument[]`. (2) Configurable parameters: `k1` (term saturation), `b` (length normalization). (3) `tokenizer.ts` splits text into lowercase tokens, removes stopwords. (4) IDF calculation for query terms. (5) Score normalization 0-1. (6) Unit tests with known relevance judgments. |
| **Dependencies** | Task 0.4 |
| **Parallelizable** | Yes |

#### Task 4.3: Implement `search_docs` Tool
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/searchDocs.ts` |
| **Definition of Done** | (1) Extends `BaseTool` with name `search_docs`. (2) Input schema: `{ query: string, limit?: number }`. (3) Two-stage search: keyword filter → BM25 rank. (4) Title matches weighted 2x body matches. (5) Returns top N results with snippets and scores. (6) Response time <500ms for typical queries. |
| **Dependencies** | Tasks 4.1, 4.2, 3.8 |
| **Parallelizable** | No (depends on 4.1, 4.2) |

#### Task 4.4: Implement Template Composer Engine
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/templates/composer.ts`, `src/tools/templates/importMerger.ts` |
| **Definition of Done** | (1) `TemplateComposer` class with `compose(fragments: TemplateFragment[]): ComposedTemplate`. (2) `importMerger.ts` deduplicates and sorts imports. (3) Handles fragment dependency ordering. (4) Merges code blocks with proper spacing. (5) `ComposedTemplate` has `files: Map<string, string>` (path → content). (6) Unit tests for all fragment combinations (8+ combinations). |
| **Dependencies** | Task 3.3 |
| **Parallelizable** | Yes |

#### Task 4.5: Implement `get_feathers_template` Tool
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/getTemplate.ts` |
| **Definition of Done** | (1) Extends `BaseTool` with name `get_feathers_template`. (2) Input schema: `{ database: 'mongodb' \| 'postgresql' \| 'sqlite', auth?: boolean, typescript?: boolean }`. (3) Loads appropriate fragments from knowledge base. (4) Uses `TemplateComposer` to build project. (5) Returns complete file tree with contents. (6) Supports all 8 flag combinations (3 DBs × auth × TS). (7) Generated code is syntactically valid. |
| **Dependencies** | Tasks 4.1, 4.4, 3.3 |
| **Parallelizable** | No (depends on 4.4) |

#### Task 4.6: Implement Code Generation AST Utilities
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/codegen/astUtils.ts`, `src/tools/codegen/schemaGenerator.ts` |
| **Definition of Done** | (1) `astUtils.ts`: `createImport()`, `createClass()`, `createMethod()`, `printNode()` using TypeScript Compiler API. (2) `schemaGenerator.ts`: `generateMongooseSchema(fields)`, `generateKnexSchema(fields)`. (3) Handles field types: `string`, `number`, `boolean`, `date`, `objectId`, `array`. (4) Generates proper TypeScript types for schemas. (5) Unit tests for each generator. |
| **Dependencies** | Task 0.4 |
| **Parallelizable** | Yes (with Task 4.2, 4.4) |

#### Task 4.7: Implement `generate_service` Tool
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/generateService.ts` |
| **Definition of Done** | (1) Extends `BaseTool` with name `generate_service`. (2) Input schema: `{ name: string, database: 'mongodb' \| 'postgresql' \| 'sqlite', fields: FieldDefinition[] }`. (3) `FieldDefinition`: `{ name: string, type: string, required?: boolean, unique?: boolean }`. (4) Generates: service class, hooks file, schema/model file, test file. (5) Uses AST utilities for code generation. (6) All generated files are syntactically valid TypeScript. |
| **Dependencies** | Tasks 4.1, 4.6, 3.3 |
| **Parallelizable** | No (depends on 4.6) |

#### Task 4.8: Register Core Tools with Router
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/index.ts`, `src/tools/index.ts` |
| **Definition of Done** | (1) `src/tools/index.ts` exports all tool instances. (2) `src/index.ts` imports tools and registers with router. (3) All three tools (`search_docs`, `get_feathers_template`, `generate_service`) accessible via MCP. (4) `tools/list` returns all three tools with schemas. (5) Integration test invokes each tool via MCP protocol. |
| **Dependencies** | Tasks 4.3, 4.5, 4.7, 2.7 |
| **Parallelizable** | No |

#### Task 4.9: Core Tools Unit Tests
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `tests/tools/searchDocs.test.ts`, `tests/tools/getTemplate.test.ts`, `tests/tools/generateService.test.ts`, `tests/tools/search/bm25.test.ts`, `tests/tools/templates/composer.test.ts` |
| **Definition of Done** | (1) `search_docs`: test ranking quality with known queries. (2) `get_feathers_template`: test all 8 flag combinations. (3) `generate_service`: test various field types and databases. (4) BM25: test IDF calculation, scoring, ranking. (5) Composer: test import merging, fragment ordering. (6) All generated code passes `tsc --noEmit`. (7) >80% coverage for `src/tools/`. |
| **Dependencies** | Task 4.8 |
| **Parallelizable** | No |

---

## Phase 5: Tool Implementation Layer — Validation & Quality Tools

### Objective
Implement the `validate_code` tool and integrate validation into all code-generating tools. Ensure all generated code passes TypeScript compilation, ESLint, Prettier, and FeathersJS best-practice rules before being returned to the AI assistant.

### Components/Layers Involved
- Tool Implementation Layer (`src/tools/validation/`)
- Integration with Phase 4 tools

### Prerequisites
- Phase 4 complete (core tools generating code)
- ESLint and Prettier configured (from Phase 0)

### Exit Artifacts
When Phase 5 is complete, the following must exist:
- [ ] `src/tools/validateCode.ts` — Standalone code validation tool
- [ ] `src/tools/validation/pipeline.ts` — Chained validation (TS → ESLint → Prettier → Best Practices)
- [ ] `src/tools/validation/bestPracticeRules.ts` — 10+ FeathersJS-specific AST rules
- [ ] `get_feathers_template` returns only code that passes validation
- [ ] `generate_service` returns only code that passes validation
- [ ] Validation adds <500ms to response time
- [ ] `tests/tools/validation/` — Tests with valid and invalid code samples
- [ ] Each best practice rule tested individually

---

### Tasks

#### Task 5.1: Implement TypeScript Syntax Validator
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/validation/tsValidator.ts` |
| **Definition of Done** | (1) `TypeScriptValidator` class with `validate(code: string): ValidationResult`. (2) Uses TypeScript Compiler API to parse and check syntax. (3) Returns array of `{ line: number, column: number, message: string }` for errors. (4) Returns `{ valid: true }` for valid code. (5) Does not write files (in-memory only). (6) Unit tests with valid/invalid TypeScript. |
| **Dependencies** | Task 0.4 |
| **Parallelizable** | Yes |

#### Task 5.2: Implement ESLint Validator
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/validation/eslintValidator.ts` |
| **Definition of Done** | (1) `ESLintValidator` class with `validate(code: string, filename?: string): ValidationResult`. (2) Uses ESLint API programmatically. (3) Applies project's ESLint config. (4) Returns lint errors with severity, line, message. (5) Supports both `.ts` and `.js` files. (6) Unit tests with code containing lint errors. |
| **Dependencies** | Task 0.5 |
| **Parallelizable** | Yes (with Task 5.1) |

#### Task 5.3: Implement Prettier Format Checker
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/validation/prettierValidator.ts` |
| **Definition of Done** | (1) `PrettierValidator` class with `check(code: string): { formatted: boolean, diff?: string }`. (2) Uses Prettier API to check if code matches format. (3) `format(code: string): string` returns formatted code. (4) Applies project's Prettier config. (5) Unit tests with formatted/unformatted code. |
| **Dependencies** | Task 0.6 |
| **Parallelizable** | Yes (with Task 5.1, 5.2) |

#### Task 5.4: Implement FeathersJS Best Practice Rules
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/validation/bestPracticeRules.ts`, `src/tools/validation/rules/*.ts` |
| **Definition of Done** | (1) `BestPracticeAnalyzer` class with `analyze(code: string): RuleViolation[]`. (2) Implements 10+ rules using TypeScript AST: hook return values, error handling, service method signatures, async/await usage, import patterns. (3) Each rule in separate file under `rules/`. (4) `RuleViolation`: `{ rule: string, line: number, message: string, suggestion: string }`. (5) Unit tests for each rule. |
| **Dependencies** | Task 0.4, Task 3.7 |
| **Parallelizable** | Yes |

#### Task 5.5: Implement Validation Pipeline
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/validation/pipeline.ts`, `src/tools/validation/index.ts` |
| **Definition of Done** | (1) `ValidationPipeline` class with `validate(code: string, options?: ValidationOptions): PipelineResult`. (2) Chains: TypeScript → ESLint → Prettier → Best Practices. (3) `ValidationOptions`: `{ typescript?: boolean, eslint?: boolean, prettier?: boolean, bestPractices?: boolean }`. (4) Aggregates all results into single response. (5) Short-circuits on syntax errors (skip later stages). (6) Exported from `src/tools/validation/index.ts`. |
| **Dependencies** | Tasks 5.1, 5.2, 5.3, 5.4 |
| **Parallelizable** | No |

#### Task 5.6: Implement `validate_code` Tool
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/validateCode.ts` |
| **Definition of Done** | (1) Extends `BaseTool` with name `validate_code`. (2) Input schema: `{ code: string, language?: 'typescript' \| 'javascript', checks?: string[] }`. (3) Uses `ValidationPipeline` to run checks. (4) Returns structured validation results. (5) Includes fix suggestions where available. (6) Registered with router. |
| **Dependencies** | Tasks 4.1, 5.5 |
| **Parallelizable** | No |

#### Task 5.7: Integrate Validation into Code Generation Tools
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/getTemplate.ts`, `src/tools/generateService.ts` |
| **Definition of Done** | (1) `get_feathers_template` runs validation on all generated files. (2) `generate_service` runs validation on all generated files. (3) Validation errors prevent code return (fail-fast). (4) Validation adds <500ms to total response time. (5) Generated code always passes all validation checks. |
| **Dependencies** | Tasks 4.5, 4.7, 5.5 |
| **Parallelizable** | No |

#### Task 5.8: Validation Tools Unit Tests
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `tests/tools/validation/tsValidator.test.ts`, `tests/tools/validation/eslintValidator.test.ts`, `tests/tools/validation/pipeline.test.ts`, `tests/tools/validation/rules/*.test.ts` |
| **Definition of Done** | (1) Test TypeScript validator with syntax errors. (2) Test ESLint validator with lint violations. (3) Test Prettier validator with formatting issues. (4) Test each best practice rule individually. (5) Test pipeline aggregation. (6) Test validation integration in `get_feathers_template`. (7) Test validation integration in `generate_service`. (8) >80% coverage for `src/tools/validation/`. |
| **Dependencies** | Task 5.7 |
| **Parallelizable** | No |

---

## Phase 6: Tool Implementation Layer — Support Tools

### Objective
Implement secondary tools that support developer workflows: `get_hook_example` (hook patterns), `troubleshoot_error` (error diagnosis), `get_best_practices` (recommendations), and `explain_concept` (documentation lookup). These tools enhance the learning and debugging experience.

### Components/Layers Involved
- Tool Implementation Layer (`src/tools/`)
- Knowledge Base Layer (snippets, errors, best-practices, docs)

### Prerequisites
- Phase 4 complete (tool base interface established)
- Phase 3 complete (Knowledge Base populated with snippets, errors, best-practices)

### Exit Artifacts
When Phase 6 is complete, the following must exist:
- [ ] `src/tools/getHookExample.ts` — Returns annotated hook examples by type/use case
- [ ] `src/tools/troubleshootError.ts` — Pattern matches errors against 20+ known patterns
- [ ] `src/tools/getBestPractices.ts` — Returns best practices by topic
- [ ] `src/tools/explainConcept.ts` — Returns concept documentation with examples
- [ ] All four tools registered and invocable via MCP protocol
- [ ] `troubleshoot_error` correctly identifies at least 20 common error patterns
- [ ] `tests/tools/` — Unit tests for each support tool

---

### Tasks

#### Task 6.1: Implement `get_hook_example` Tool
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/getHookExample.ts` |
| **Definition of Done** | (1) Extends `BaseTool` with name `get_hook_example`. (2) Input schema: `{ hookType: 'before' \| 'after' \| 'error', useCase?: string }`. (3) Queries snippet library from knowledge base. (4) Returns code with inline explanation comments. (5) Returns multiple examples if `useCase` not specified. (6) Registered with router. |
| **Dependencies** | Tasks 4.1, 3.4, 3.8 |
| **Parallelizable** | Yes (with Tasks 6.2, 6.3, 6.4) |

#### Task 6.2: Implement `troubleshoot_error` Tool
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/troubleshootError.ts` |
| **Definition of Done** | (1) Extends `BaseTool` with name `troubleshoot_error`. (2) Input schema: `{ errorMessage: string, stackTrace?: string }`. (3) Pattern matches against error database using regex. (4) Returns `{ cause: string, solution: string, example: string }`. (5) Ranks matches by pattern specificity. (6) Returns "unknown error" guidance if no match. (7) Correctly identifies 20+ error patterns. (8) Registered with router. |
| **Dependencies** | Tasks 4.1, 3.6, 3.8 |
| **Parallelizable** | Yes (with Tasks 6.1, 6.3, 6.4) |

#### Task 6.3: Implement `get_best_practices` Tool
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/getBestPractices.ts` |
| **Definition of Done** | (1) Extends `BaseTool` with name `get_best_practices`. (2) Input schema: `{ topic: string, context?: string }`. (3) Queries best practices from knowledge base by topic. (4) Topics: `hooks`, `services`, `security`, `testing`, `performance`. (5) Returns practices with `goodExample` and `badExample`. (6) Ranks by relevance to context if provided. (7) Registered with router. |
| **Dependencies** | Tasks 4.1, 3.7, 3.8 |
| **Parallelizable** | Yes (with Tasks 6.1, 6.2, 6.4) |

#### Task 6.4: Implement `explain_concept` Tool
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/explainConcept.ts` |
| **Definition of Done** | (1) Extends `BaseTool` with name `explain_concept`. (2) Input schema: `{ concept: string }`. (3) Searches documentation knowledge base. (4) Returns concept explanation with code examples. (5) Includes links to related concepts. (6) Registered with router. |
| **Dependencies** | Tasks 4.1, 3.2, 3.8 |
| **Parallelizable** | Yes (with Tasks 6.1, 6.2, 6.3) |

#### Task 6.5: Register Support Tools with Router
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/index.ts`, `src/index.ts` |
| **Definition of Done** | (1) All four support tools exported from `src/tools/index.ts`. (2) All tools registered in `src/index.ts`. (3) `tools/list` includes all support tools. (4) Each tool invocable via MCP protocol. |
| **Dependencies** | Tasks 6.1, 6.2, 6.3, 6.4 |
| **Parallelizable** | No |

#### Task 6.6: Support Tools Unit Tests
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `tests/tools/getHookExample.test.ts`, `tests/tools/troubleshootError.test.ts`, `tests/tools/getBestPractices.test.ts`, `tests/tools/explainConcept.test.ts` |
| **Definition of Done** | (1) Test hook example retrieval for all types (before/after/error). (2) Test error matching with 5+ known error messages. (3) Test best practice retrieval for each topic. (4) Test concept explanation for core concepts. (5) Test version filtering. (6) Test graceful handling of unknown queries. (7) >80% coverage for support tools. |
| **Dependencies** | Task 6.5 |
| **Parallelizable** | No |

---

## Phase 7: Tool Implementation Layer — Advanced Tools

### Objective
Implement optional/advanced tools: `suggest_alternatives` (alternative implementations) and `list_available_tools` (tool discovery). These are lower-priority SHOULD HAVE/COULD HAVE features. (`get_migration_guide` has been removed — v4 support dropped.)

### Components/Layers Involved
- Tool Implementation Layer (`src/tools/`)
- Protocol Layer (for tool listing)

### Prerequisites
- Phase 4 complete (core tools working)
- Phase 6 complete (support tools working)

### Exit Artifacts
When Phase 7 is complete, the following must exist:
- [ ] `src/tools/suggestAlternatives.ts` — Returns 2+ alternative implementations with trade-offs
- [ ] `src/tools/listTools.ts` — Returns all available tools with descriptions and schemas
- [ ] Both tools registered and invocable via MCP protocol
- [ ] `tests/tools/` — Unit tests for advanced tools

---

### Tasks

#### Task 7.1: Implement `suggest_alternatives` Tool
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/suggestAlternatives.ts` |
| **Definition of Done** | (1) Extends `BaseTool` with name `suggest_alternatives`. (2) Input schema: `{ pattern: string, context?: string }`. (3) Identifies pattern type (hook, service, query, etc.). (4) Returns 2+ alternative implementations. (5) Each alternative includes: `code`, `tradeoffs`, `whenToUse`. (6) Uses template and snippet knowledge base. (7) Registered with router. |
| **Dependencies** | Tasks 4.1, 3.3, 3.4, 3.8 |
| **Parallelizable** | Yes (with Tasks 7.2, 7.3) |

#### Task 7.2: ~~REMOVED~~ (`get_migration_guide` — v4 support dropped)

> This task has been removed. v4 migration support is not provided.

#### Task 7.3: Implement `list_available_tools` Tool
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/listTools.ts` |
| **Definition of Done** | (1) Extends `BaseTool` with name `list_available_tools`. (2) Input schema: `{ category?: string }`. (3) Returns all registered tools with descriptions and schemas. (4) Supports filtering by category: `search`, `generate`, `validate`, `support`. (5) Includes usage examples for each tool. (6) Uses protocol registry for tool list. (7) Registered with router. |
| **Dependencies** | Tasks 4.1, 1.5 |
| **Parallelizable** | Yes (with Tasks 7.1, 7.2) |

#### Task 7.4: Register Advanced Tools with Router
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/tools/index.ts`, `src/index.ts` |
| **Definition of Done** | (1) All advanced tools exported from `src/tools/index.ts`. (2) All tools registered in `src/index.ts`. (3) `tools/list` includes all advanced tools. (4) Total tool count is now 10 tools. |
| **Dependencies** | Tasks 7.1, 7.2, 7.3 |
| **Parallelizable** | No |

#### Task 7.5: Advanced Tools Unit Tests
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `tests/tools/suggestAlternatives.test.ts`, `tests/tools/listTools.test.ts` |
| **Definition of Done** | (1) Test alternative suggestions for hook patterns. (2) Test alternative suggestions for service patterns. (3) Test tool listing returns all tools. (4) Test category filtering. (5) >80% coverage for advanced tools. |
| **Dependencies** | Task 7.4 |
| **Parallelizable** | No |

---

## Phase 8: Integration & End-to-End Testing

### Objective
Verify the complete system works end-to-end through all four layers. Profile performance to ensure NFR compliance. Implement caching if needed to meet response time requirements.

### Components/Layers Involved
- All layers (Protocol, Routing, Tools, Knowledge Base)
- Performance optimization (conditional)

### Prerequisites
- Phases 1-7 complete (all layers and tools implemented)

### Exit Artifacts
When Phase 8 is complete, the following must exist:
- [ ] `tests/integration/` — Integration tests covering full request flows
- [ ] `tests/e2e/` — End-to-end tests simulating AI assistant interactions
- [ ] Performance profile report showing p95 latency and memory usage
- [ ] All tools respond in <2 seconds (NFR-001 verified)
- [ ] Peak memory usage <200MB (NFR-002 verified)
- [ ] (Conditional) `src/routing/cache.ts` — Caching layer if needed for performance
- [ ] Error scenarios tested (malformed requests, invalid params, timeouts)
- [ ] 80% code coverage achieved across all modules

---

### Tasks

#### Task 8.1: Create Integration Test Framework
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `tests/integration/setup.ts`, `tests/integration/helpers.ts` |
| **Definition of Done** | (1) `setup.ts` initializes full server with all layers. (2) `helpers.ts` provides `sendMcpRequest()` and `expectMcpResponse()` utilities. (3) Can send JSON-RPC requests through mock stdio. (4) Can assert on response structure and timing. (5) Teardown cleans up server resources. |
| **Dependencies** | Task 0.10, All Phase 1-7 implementation tasks |
| **Parallelizable** | No |

#### Task 8.2: Integration Tests — Full Request Flow
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `tests/integration/fullFlow.test.ts` |
| **Definition of Done** | (1) Test complete flow: Protocol → Routing → Tool → Knowledge Base → Response. (2) Test `search_docs` end-to-end with real knowledge base. (3) Test `generate_service` end-to-end with validation. (4) Test `troubleshoot_error` end-to-end. (5) All tests complete in <30 seconds. |
| **Dependencies** | Task 8.1 |
| **Parallelizable** | No |

#### Task 8.3: Integration Tests — Error Scenarios
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `tests/integration/errorScenarios.test.ts` |
| **Definition of Done** | (1) Test malformed JSON-RPC request returns error. (2) Test unknown tool name returns error. (3) Test invalid parameters return validation error. (4) Test timeout scenario (mock slow handler). (5) Test server continues after error (doesn't crash). (6) All error responses match MCP spec. |
| **Dependencies** | Task 8.1 |
| **Parallelizable** | Yes (with Task 8.2) |

#### Task 8.4: End-to-End Tests — Developer Scenarios
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `tests/e2e/developerScenarios.test.ts` |
| **Definition of Done** | (1) Simulate Ava workflow: generate project → add service → validate. (2) Simulate Marco workflow: validate code → get best practices. (3) Simulate Jason workflow: explain concept → get example → troubleshoot. (4) All scenarios complete successfully. (5) Tests document expected tool sequences. |
| **Dependencies** | Task 8.2 |
| **Parallelizable** | No |

#### Task 8.5: Performance Profiling — Response Time
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `tests/performance/responseTime.test.ts`, `docs/performance-report.md` |
| **Definition of Done** | (1) Measure response time for each tool (100 iterations). (2) Calculate p50, p95, p99 latencies. (3) Verify all tools p95 <2 seconds (NFR-001). (4) Identify any tools exceeding budget. (5) Document results in `performance-report.md`. |
| **Dependencies** | Task 8.2 |
| **Parallelizable** | Yes (with Task 8.6) |

#### Task 8.6: Performance Profiling — Memory Usage
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `tests/performance/memoryUsage.test.ts`, `docs/performance-report.md` |
| **Definition of Done** | (1) Measure memory usage at startup. (2) Measure memory after knowledge base preload. (3) Measure peak memory during tool execution. (4) Verify peak <200MB (NFR-002). (5) Identify memory hotspots. (6) Document results in `performance-report.md`. |
| **Dependencies** | Task 8.2 |
| **Parallelizable** | Yes (with Task 8.5) |

#### Task 8.7: Implement Caching Layer (Conditional)
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `src/routing/cache.ts`, `src/knowledge/cachedLoader.ts` |
| **Definition of Done** | (1) Only implement if p95 latency >2s from Task 8.5. (2) `CacheLayer` with LRU eviction. (3) Cache search results for repeated queries. (4) Cache compiled templates. (5) TTL-based expiration (5 minutes). (6) Re-run performance tests to verify improvement. |
| **Dependencies** | Tasks 8.5, 8.6 (conditional on results) |
| **Parallelizable** | No |

#### Task 8.8: Code Coverage Verification
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `package.json` (scripts), coverage reports |
| **Definition of Done** | (1) Run `npm run test:coverage`. (2) Verify global coverage ≥80% (branches, functions, lines, statements). (3) Identify any modules below threshold. (4) Add tests for uncovered code paths. (5) Coverage report saved in `coverage/`. |
| **Dependencies** | All test tasks complete |
| **Parallelizable** | No |

---

## Phase 9: Documentation & Packaging

### Objective
Prepare the project for npm publication with comprehensive documentation. Create installation guides for each supported AI assistant (Claude Desktop, Cline, Claude Code).

### Components/Layers Involved
- Infrastructure (packaging, npm configuration)
- Documentation

### Prerequisites
- Phase 8 complete (all tests passing, performance verified)

### Exit Artifacts
When Phase 9 is complete, the following must exist:
- [ ] `README.md` — Comprehensive documentation with:
  - Installation instructions (≤3 commands)
  - Configuration for Claude Desktop, Cline, Claude Code
  - Tool usage examples
  - Troubleshooting section
- [ ] `docs/API.md` — Complete tool API documentation with schemas
- [ ] `docs/CONFIGURATION.md` — Platform-specific configuration templates
- [ ] `package.json` configured for npm publishing:
  - `bin` entry for global installation
  - `files` array including knowledge-base
  - Version number set
- [ ] Package size <50MB (verified)
- [ ] `npm pack` produces installable tarball

---

### Tasks

#### Task 9.1: Write README Documentation
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `README.md` |
| **Definition of Done** | (1) Project description and purpose. (2) Installation: `npm install -g feathers-mcp-server` (1 command). (3) Quick start guide with example usage. (4) List of all available tools with brief descriptions. (5) Links to detailed documentation. (6) Badges: npm version, tests passing, coverage. (7) Passes markdown lint. |
| **Dependencies** | All implementation complete |
| **Parallelizable** | Yes (with Tasks 9.2, 9.3, 9.4) |

#### Task 9.2: Write Tool API Documentation
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `docs/API.md` |
| **Definition of Done** | (1) Documentation for each tool. (2) Each tool section includes: description, input schema, output format, examples. (3) JSON schema for each tool's parameters. (4) Example request/response pairs. (5) Error codes and meanings. (6) Table of contents with links. |
| **Dependencies** | All tools implemented |
| **Parallelizable** | Yes (with Tasks 9.1, 9.3, 9.4) |

#### Task 9.3: Write Configuration Guide
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `docs/CONFIGURATION.md` |
| **Definition of Done** | (1) Claude Desktop configuration with JSON example. (2) Cline configuration with JSON example. (3) Claude Code configuration instructions. (4) Environment variables (if any). (5) Troubleshooting section for common config issues. (6) Screenshots or diagrams where helpful. |
| **Dependencies** | Task 1.8 (server entry point) |
| **Parallelizable** | Yes (with Tasks 9.1, 9.2, 9.4) |

#### Task 9.4: Create Configuration Templates
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `config-templates/claude-desktop.json`, `config-templates/cline.json`, `config-templates/claude-code.json` |
| **Definition of Done** | (1) Ready-to-use JSON config for each platform. (2) Comments explaining each field. (3) Placeholder for installation path. (4) Includes all required MCP fields. (5) Validated against each platform's schema. |
| **Dependencies** | Task 9.3 |
| **Parallelizable** | No |

#### Task 9.5: Configure package.json for npm Publishing
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `package.json` |
| **Definition of Done** | (1) `name`: `feathers-mcp-server`. (2) `version`: `1.0.0`. (3) `bin`: `{ "feathers-mcp-server": "./dist/index.js" }`. (4) `files`: `["dist/", "knowledge-base/", "README.md", "LICENSE"]`. (5) `main`: `dist/index.js`. (6) `types`: `dist/index.d.ts`. (7) `repository`, `author`, `license` fields set. (8) `engines`: `{ "node": ">=20.0.0" }`. |
| **Dependencies** | Task 0.4 (TypeScript config) |
| **Parallelizable** | Yes |

#### Task 9.6: Verify Package Size
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `package.json`, `.npmignore` |
| **Definition of Done** | (1) Run `npm pack` and verify tarball <50MB. (2) Create `.npmignore` excluding: `tests/`, `coverage/`, `*.test.ts`, `.github/`. (3) Verify `knowledge-base/` is included. (4) Verify `dist/` is included. (5) Document final package size. |
| **Dependencies** | Task 9.5 |
| **Parallelizable** | No |

#### Task 9.7: Create LICENSE File
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `LICENSE` |
| **Definition of Done** | (1) MIT License text. (2) Copyright year and holder set. (3) File included in `files` array. |
| **Dependencies** | None |
| **Parallelizable** | Yes |

#### Task 9.8: Create CHANGELOG
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `CHANGELOG.md` |
| **Definition of Done** | (1) Follows Keep a Changelog format. (2) `[1.0.0]` section with release date. (3) Lists all features in `Added` section. (4) Notes any known limitations. |
| **Dependencies** | All implementation complete |
| **Parallelizable** | Yes |

---

## Phase 10: Final Verification & Release

### Objective
Perform final NFR verification, test real-world user workflows for all three personas, and publish the package to npm.

### Components/Layers Involved
- All layers (final verification)
- npm registry (publication)

### Prerequisites
- Phase 9 complete (documentation and packaging ready)

### Exit Artifacts
When Phase 10 is complete, the following must exist:
- [ ] NFR verification report confirming:
  - NFR-001: Response time <2 seconds ✓
  - NFR-002: Memory usage <200MB ✓
  - NFR-003: Installation <5 minutes, ≤3 commands ✓
  - NFR-004: Generated code passes ESLint/Prettier ✓
  - 80% test coverage ✓
- [ ] User workflow verification:
  - Ava workflow: Project generated and running in <30 minutes ✓
  - Marco workflow: Code quality validation working ✓
  - Jason workflow: Explanations and learning aids working ✓
- [ ] Package published to npm registry
- [ ] Fresh installation verified on clean machine
- [ ] Release notes/changelog created

---

### Tasks

#### Task 10.1: NFR-001 Verification — Response Time
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `docs/nfr-verification-report.md` |
| **Definition of Done** | (1) Run performance tests from Task 8.5. (2) Verify all tools respond in <2 seconds (p95). (3) Document measured latencies per tool. (4) Sign-off that NFR-001 is met. |
| **Dependencies** | Task 8.5 |
| **Parallelizable** | Yes (with Tasks 10.2, 10.3, 10.4) |

#### Task 10.2: NFR-002 Verification — Memory Usage
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `docs/nfr-verification-report.md` |
| **Definition of Done** | (1) Run memory tests from Task 8.6. (2) Verify peak memory <200MB. (3) Document memory usage breakdown. (4) Sign-off that NFR-002 is met. |
| **Dependencies** | Task 8.6 |
| **Parallelizable** | Yes (with Tasks 10.1, 10.3, 10.4) |

#### Task 10.3: NFR-003 Verification — Installation Time
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `docs/nfr-verification-report.md` |
| **Definition of Done** | (1) Test installation on clean machine (no prior setup). (2) Time: `npm install -g feathers-mcp-server`. (3) Time: add config to AI assistant. (4) Time: restart and verify working. (5) Total time <5 minutes. (6) Total commands ≤3. (7) Sign-off that NFR-003 is met. |
| **Dependencies** | Task 9.6 |
| **Parallelizable** | Yes (with Tasks 10.1, 10.2, 10.4) |

#### Task 10.4: NFR-004 Verification — Code Quality
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `docs/nfr-verification-report.md` |
| **Definition of Done** | (1) Generate code using `get_feathers_template` and `generate_service`. (2) Run ESLint on all generated code — 0 errors. (3) Run Prettier on all generated code — already formatted. (4) Run TypeScript compiler — 0 errors. (5) Sign-off that NFR-004 is met. |
| **Dependencies** | Task 5.7 |
| **Parallelizable** | Yes (with Tasks 10.1, 10.2, 10.3) |

#### Task 10.5: Test Coverage Verification
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `docs/nfr-verification-report.md`, `coverage/` |
| **Definition of Done** | (1) Run `npm run test:coverage`. (2) Verify ≥80% coverage: branches, functions, lines, statements. (3) Screenshot or export coverage summary. (4) Sign-off that coverage requirement is met. |
| **Dependencies** | Task 8.8 |
| **Parallelizable** | No |

#### Task 10.6: User Workflow Verification — Ava Persona
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `docs/user-workflow-verification.md` |
| **Definition of Done** | (1) Simulate full Ava workflow using MCP tools. (2) Generate project → Add 2 services → Validate → Total time <30 minutes. (3) Generated project runs successfully (`npm start`). (4) Document workflow steps and timing. |
| **Dependencies** | Task 8.4 |
| **Parallelizable** | Yes (with Tasks 10.7, 10.8) |

#### Task 10.7: User Workflow Verification — Marco Persona
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `docs/user-workflow-verification.md` |
| **Definition of Done** | (1) Simulate full Marco workflow. (2) Validate code → Get best practices → Request alternatives. (3) All tools return expert-level guidance. (4) Document workflow steps. |
| **Dependencies** | Task 8.4 |
| **Parallelizable** | Yes (with Tasks 10.6, 10.8) |

#### Task 10.8: User Workflow Verification — Jason Persona
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `docs/user-workflow-verification.md` |
| **Definition of Done** | (1) Simulate full Jason workflow. (2) Generate code → Explain concepts → Get hook examples → Troubleshoot error. (3) All explanations clear and educational. (4) Document workflow steps. |
| **Dependencies** | Task 8.4 |
| **Parallelizable** | Yes (with Tasks 10.6, 10.7) |

#### Task 10.9: Final Test Suite Run
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | CI/terminal output |
| **Definition of Done** | (1) Run `npm run lint` — 0 errors. (2) Run `npm run build` — builds successfully. (3) Run `npm run test` — all tests pass. (4) Run `npm run test:coverage` — coverage ≥80%. (5) No warnings or deprecations. |
| **Dependencies** | All previous tasks |
| **Parallelizable** | No |

#### Task 10.10: Build Production Package
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | `dist/`, `*.tgz` |
| **Definition of Done** | (1) Run `npm run build`. (2) Verify `dist/` contains compiled JavaScript. (3) Verify `dist/` contains type definitions (`.d.ts`). (4) Run `npm pack`. (5) Verify tarball contains expected files. (6) Tarball <50MB. |
| **Dependencies** | Task 10.9 |
| **Parallelizable** | No |

#### Task 10.11: Publish to npm Registry
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | npm registry |
| **Definition of Done** | (1) Logged into npm (`npm whoami`). (2) Run `npm publish`. (3) Verify package visible on npmjs.com. (4) Verify `npm install -g feathers-mcp-server` works. (5) Verify installed binary runs (`feathers-mcp-server --version`). |
| **Dependencies** | Task 10.10 |
| **Parallelizable** | No |

#### Task 10.12: Post-Release Verification
| Attribute | Value |
|-----------|-------|
| **Files/Directories** | Fresh machine/environment |
| **Definition of Done** | (1) On clean machine: `npm install -g feathers-mcp-server`. (2) Configure Claude Desktop with published package. (3) Invoke `search_docs` tool — returns results. (4) Invoke `generate_service` tool — generates valid code. (5) Document any issues found. |
| **Dependencies** | Task 10.11 |
| **Parallelizable** | No |

---

## Dependency Graph Summary

```
Phase 0 (Infrastructure) ─────────────────────────────────────────────────┐
    │                                                                      │
    ├──► Phase 1 (Protocol Layer)                                          │
    │        │                                                             │
    │        └──► Phase 2 (Tool Routing Layer)                             │
    │                 │                                                    │
    │                 └──► Phase 4 (Core Tools) ◄──────────────────────────┤
    │                          │                                           │
    │                          ├──► Phase 5 (Validation Tools)             │
    │                          │                                           │
    │                          ├──► Phase 6 (Support Tools) ◄──────────────┤
    │                          │                                           │
    │                          └──► Phase 7 (Advanced Tools)               │
    │                                    │                                 │
    └──► Phase 3 (Knowledge Base) ───────┘                                 │
                                         │                                 │
                                         ▼                                 │
                               Phase 8 (Integration Testing)               │
                                         │                                 │
                                         ▼                                 │
                               Phase 9 (Documentation) ◄───────────────────┘
                                         │
                                         ▼
                               Phase 10 (Final Verification & Release)
```

---

## Task Summary by Phase

| Phase | Task Count | Parallelizable Tasks | Sequential Tasks |
|-------|------------|---------------------|------------------|
| 0     | 10         | 5 (0.4-0.7, 0.9-0.10) | 5 |
| 1     | 9          | 4 (1.4-1.7) | 5 |
| 2     | 8          | 4 (2.1-2.5) | 4 |
| 3     | 10         | 7 (3.2-3.7) | 3 |
| 4     | 9          | 3 (4.2, 4.4, 4.6) | 6 |
| 5     | 8          | 4 (5.1-5.4) | 4 |
| 6     | 6          | 4 (6.1-6.4) | 2 |
| 7     | 5          | 3 (7.1-7.3) | 2 |
| 8     | 8          | 2 (8.5, 8.6) | 6 |
| 9     | 8          | 5 (9.1-9.3, 9.7, 9.8) | 3 |
| 10    | 12         | 6 (10.1-10.4, 10.6-10.8) | 6 |
| **Total** | **93** | **47** | **46** |

---

## Parallelization Opportunities

The following work can proceed in parallel once dependencies are met:

**Phase 0:**
- Tasks 0.5, 0.6, 0.7 (ESLint, Prettier, Jest config) can run in parallel after Task 0.3

**Phase 1:**
- Tasks 1.4, 1.5 (types, registry) can run in parallel
- Tasks 1.6, 1.7 (ListTools, CallTool handlers) can run in parallel

**Phase 3 (highly parallelizable):**
- Tasks 3.2-3.7 (all content creation) can be distributed across team members
- Each JSON file category is independent

**Phase 4:**
- Tasks 4.2, 4.4, 4.6 (BM25, Composer, AST utils) can run in parallel

**Phase 5:**
- Tasks 5.1-5.4 (validators) can run in parallel

**Phase 6:**
- Tasks 6.1-6.4 (all support tools) can run in parallel

**Phase 7:**
- Tasks 7.1-7.3 (all advanced tools) can run in parallel

**Phase 10:**
- Tasks 10.1-10.4 (NFR verifications) can run in parallel
- Tasks 10.6-10.8 (persona workflow tests) can run in parallel

---

## Critical Path

The critical path for minimum viable product (MVP):

1. **Task 0.1-0.4** → Initialize project (must complete first)
2. **Task 1.1-1.8** → Protocol Layer (MCP server operational)
3. **Task 2.1-2.7** → Tool Routing Layer (request handling)
4. **Task 3.1, 3.8** → Knowledge Base types + loader (parallel with 1-2)
5. **Task 4.1, 4.3, 4.5, 4.7** → Core tools (search, template, service)
6. **Task 5.5-5.7** → Validation pipeline integration
7. **Task 8.1-8.2** → Integration testing
8. **Task 9.1, 9.5-9.6** → README and npm packaging
9. **Task 10.9-10.11** → Build and publish

**Estimated critical path duration:** 8-9 weeks (with 1-2 week buffer)

---

## Risk Mitigation Checkpoints

| Checkpoint | Week | Task(s) | Verification |
|------------|------|---------|--------------|
| MCP SDK integration | 2 | 1.1-1.3 | Protocol Layer passes handshake test |
| First tool end-to-end | 3 | 4.3 | `search_docs` returns results via stdio |
| Code generation works | 5 | 4.7 | `generate_service` produces valid files |
| Validation integrated | 6 | 5.7 | Generated code passes all validators |
| Response time verified | 7 | 8.5 | p95 latency <2s |
| Memory limit verified | 8 | 8.6 | Peak usage <200MB |
| Installation verified | 9 | 10.3 | Fresh install <5 minutes |
| Release ready | 10 | 10.9 | All tests pass, coverage ≥80% |

---

## File Tree Summary

Upon completion, the project will have this structure:

```
feathers-mcp-server/
├── package.json
├── package-lock.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.json
├── .prettierrc
├── .gitignore
├── .npmignore
├── README.md
├── LICENSE
├── CHANGELOG.md
├── src/
│   ├── index.ts
│   ├── protocol/
│   │   ├── index.ts
│   │   ├── server.ts
│   │   ├── transport.ts
│   │   ├── handshake.ts
│   │   ├── registry.ts
│   │   ├── types.ts
│   │   └── handlers/
│   │       ├── listTools.ts
│   │       └── callTool.ts
│   ├── routing/
│   │   ├── index.ts
│   │   ├── router.ts
│   │   ├── toolRegistry.ts
│   │   ├── validator.ts
│   │   ├── errorHandler.ts
│   │   ├── timeout.ts
│   │   ├── cache.ts (conditional)
│   │   └── types.ts
│   ├── tools/
│   │   ├── index.ts
│   │   ├── baseTool.ts
│   │   ├── types.ts
│   │   ├── searchDocs.ts
│   │   ├── getTemplate.ts
│   │   ├── generateService.ts
│   │   ├── validateCode.ts
│   │   ├── getHookExample.ts
│   │   ├── troubleshootError.ts
│   │   ├── getBestPractices.ts
│   │   ├── explainConcept.ts
│   │   ├── suggestAlternatives.ts
│   │   ├── listTools.ts
│   │   ├── search/
│   │   │   ├── bm25.ts
│   │   │   └── tokenizer.ts
│   │   ├── templates/
│   │   │   ├── composer.ts
│   │   │   └── importMerger.ts
│   │   ├── codegen/
│   │   │   ├── astUtils.ts
│   │   │   └── schemaGenerator.ts
│   │   └── validation/
│   │       ├── index.ts
│   │       ├── pipeline.ts
│   │       ├── tsValidator.ts
│   │       ├── eslintValidator.ts
│   │       ├── prettierValidator.ts
│   │       ├── bestPracticeRules.ts
│   │       └── rules/
│   │           └── *.ts
│   └── knowledge/
│       ├── index.ts
│       ├── loader.ts
│       ├── searchIndex.ts
│       ├── cachedLoader.ts (conditional)
│       └── types.ts
├── knowledge-base/
│   ├── docs/
│   │   ├── core-concepts.json
│   │   ├── services.json
│   │   ├── hooks.json
│   │   ├── authentication.json
│   │   └── databases.json
│   ├── templates/
│   │   ├── base-project.json
│   │   ├── service.json
│   │   ├── authentication.json
│   │   ├── mongodb.json
│   │   ├── postgresql.json
│   │   └── sqlite.json
│   ├── snippets/
│   │   ├── hooks-before.json
│   │   ├── hooks-after.json
│   │   ├── hooks-error.json
│   │   ├── hooks-common.json
│   │   ├── services-custom.json
│   │   └── services-patterns.json
│   ├── errors/
│   │   ├── configuration.json
│   │   ├── runtime.json
│   │   ├── database.json
│   │   └── authentication.json
│   └── best-practices/
│       ├── hooks.json
│       ├── services.json
│       ├── security.json
│       ├── testing.json
│       └── performance.json
├── tests/
│   ├── helpers/
│   │   ├── index.ts
│   │   └── mockTransport.ts
│   ├── protocol/
│   │   ├── server.test.ts
│   │   ├── registry.test.ts
│   │   └── handlers.test.ts
│   ├── routing/
│   │   ├── validator.test.ts
│   │   ├── timeout.test.ts
│   │   ├── router.test.ts
│   │   └── errorHandler.test.ts
│   ├── knowledge/
│   │   ├── loader.test.ts
│   │   ├── content.test.ts
│   │   └── searchIndex.test.ts
│   ├── tools/
│   │   ├── searchDocs.test.ts
│   │   ├── getTemplate.test.ts
│   │   ├── generateService.test.ts
│   │   ├── getHookExample.test.ts
│   │   ├── troubleshootError.test.ts
│   │   ├── getBestPractices.test.ts
│   │   ├── explainConcept.test.ts
│   │   ├── suggestAlternatives.test.ts
│   │   ├── listTools.test.ts
│   │   ├── search/
│   │   │   └── bm25.test.ts
│   │   ├── templates/
│   │   │   └── composer.test.ts
│   │   └── validation/
│   │       ├── tsValidator.test.ts
│   │       ├── eslintValidator.test.ts
│   │       ├── pipeline.test.ts
│   │       └── rules/*.test.ts
│   ├── integration/
│   │   ├── setup.ts
│   │   ├── helpers.ts
│   │   ├── fullFlow.test.ts
│   │   └── errorScenarios.test.ts
│   ├── e2e/
│   │   └── developerScenarios.test.ts
│   └── performance/
│       ├── responseTime.test.ts
│       └── memoryUsage.test.ts
├── config-templates/
│   ├── claude-desktop.json
│   ├── cline.json
│   └── claude-code.json
├── docs/
│   ├── API.md
│   ├── CONFIGURATION.md
│   ├── performance-report.md
│   ├── nfr-verification-report.md
│   └── user-workflow-verification.md
└── dist/  (generated)
    └── *.js, *.d.ts
```

---

## 🧪 Testing and Verification Plan

This section maps all requirements to specific tests and defines measurement strategies for non-functional requirements.

---

### Functional Requirements → Test Mapping

#### FR-001: Server Initialization (<3 seconds)

| Test Type | Test Name | Test Location | Verification Method |
|-----------|-----------|---------------|---------------------|
| Unit | Server boot time | `tests/protocol/server.test.ts` | Measure `Date.now()` before/after `server.start()`, assert <3000ms |
| Integration | Cold start timing | `tests/integration/fullFlow.test.ts` | Spawn fresh process, measure time to first successful response |
| Performance | Startup benchmark | `tests/performance/responseTime.test.ts` | Run 10 cold starts, report p50/p95/p99 |

**Pass Criteria:** p95 startup time <3 seconds across 10 runs.

---

#### FR-003: Template Generation (get_feathers_template)

| Test Type | Test Name | Test Location | Verification Method |
|-----------|-----------|---------------|---------------------|
| Unit | MongoDB + Auth + TS | `tests/tools/getTemplate.test.ts` | Invoke with `{db: 'mongodb', auth: true, typescript: true}`, verify files generated |
| Unit | PostgreSQL + No Auth | `tests/tools/getTemplate.test.ts` | Invoke with `{db: 'postgresql', auth: false}`, verify files generated |
| Unit | SQLite + Auth + JS | `tests/tools/getTemplate.test.ts` | Invoke with `{db: 'sqlite', auth: true, typescript: false}` |
| Unit | All 8 combinations | `tests/tools/getTemplate.test.ts` | Parameterized test covering all flag combinations |
| Integration | Generated code compiles | `tests/tools/getTemplate.test.ts` | Run `tsc --noEmit` on generated output |
| Integration | Generated code lints | `tests/tools/getTemplate.test.ts` | Run ESLint on generated output, assert 0 errors |

**Pass Criteria:** All 8 feature combinations generate valid, compilable, lintable code.

---

#### FR-004: Service Generation (generate_service)

| Test Type | Test Name | Test Location | Verification Method |
|-----------|-----------|---------------|---------------------|
| Unit | Basic service | `tests/tools/generateService.test.ts` | Generate service with 3 fields, verify 4 files output |
| Unit | MongoDB schema | `tests/tools/generateService.test.ts` | Verify Mongoose schema syntax correct |
| Unit | PostgreSQL schema | `tests/tools/generateService.test.ts` | Verify Knex migration syntax correct |
| Unit | All field types | `tests/tools/generateService.test.ts` | Test: string, number, boolean, date, objectId, array |
| Unit | Required/unique constraints | `tests/tools/generateService.test.ts` | Verify constraints appear in schema |
| Integration | Service compiles | `tests/tools/generateService.test.ts` | Run TypeScript compiler on output |
| Integration | Service integrates | `tests/integration/fullFlow.test.ts` | Generate template, then service, verify files compatible |

**Pass Criteria:** All field types generate valid schemas; service files compile without errors.

---

#### FR-006: Documentation Search (search_docs)

| Test Type | Test Name | Test Location | Verification Method |
|-----------|-----------|---------------|---------------------|
| Unit | Exact match ranking | `tests/tools/searchDocs.test.ts` | Search "hooks", verify "hooks" doc ranks #1 |
| Unit | Partial match | `tests/tools/searchDocs.test.ts` | Search "authenticate", verify auth docs returned |
| Unit | Version filtering v5 | `tests/tools/searchDocs.test.ts` | All results are v5 (only version supported) |
| Unit | Version filtering (v4 removed) | `tests/tools/searchDocs.test.ts` | N/A — v4 not supported |
| Unit | Empty results | `tests/tools/searchDocs.test.ts` | Search "xyznonexistent", verify empty array returned |
| Unit | Result limit | `tests/tools/searchDocs.test.ts` | Search with `limit: 5`, verify ≤5 results |
| Unit | BM25 ranking quality | `tests/tools/search/bm25.test.ts` | Test known relevance judgments (query → expected top result) |

**Pass Criteria:** Relevant documents rank in top 3 for known queries; version filtering works correctly.

---

#### FR-007: Code Validation (validate_code)

| Test Type | Test Name | Test Location | Verification Method |
|-----------|-----------|---------------|---------------------|
| Unit | Valid TypeScript | `tests/tools/validateCode.test.ts` | Pass valid code, verify `{valid: true}` |
| Unit | Syntax error detection | `tests/tools/validateCode.test.ts` | Pass code with missing semicolon, verify error with line number |
| Unit | ESLint error detection | `tests/tools/validateCode.test.ts` | Pass code with `var` usage, verify lint error |
| Unit | Prettier format check | `tests/tools/validateCode.test.ts` | Pass unformatted code, verify formatting issue reported |
| Unit | Best practice rules | `tests/tools/validation/rules/*.test.ts` | Test each of 10+ rules individually |
| Unit | Combined pipeline | `tests/tools/validation/pipeline.test.ts` | Verify all validators run in sequence |
| Integration | Validation speed | `tests/tools/validateCode.test.ts` | Measure validation time, assert <500ms |

**Pass Criteria:** All syntax errors, lint violations, and best practice violations detected with accurate line numbers.

---

#### FR-008: Hook Examples (get_hook_example)

| Test Type | Test Name | Test Location | Verification Method |
|-----------|-----------|---------------|---------------------|
| Unit | Before hook | `tests/tools/getHookExample.test.ts` | Request `hookType: 'before'`, verify example returned |
| Unit | After hook | `tests/tools/getHookExample.test.ts` | Request `hookType: 'after'`, verify example returned |
| Unit | Error hook | `tests/tools/getHookExample.test.ts` | Request `hookType: 'error'`, verify example returned |
| Unit | Use case filtering | `tests/tools/getHookExample.test.ts` | Request `useCase: 'validation'`, verify relevant example |
| Unit | Version filtering | `tests/tools/getHookExample.test.ts` | Request `version: 'v5'`, verify v5 syntax |

**Pass Criteria:** Each hook type returns valid, runnable example code.

---

#### FR-009: Error Troubleshooting (troubleshoot_error)

| Test Type | Test Name | Test Location | Verification Method |
|-----------|-----------|---------------|---------------------|
| Unit | Known error match | `tests/tools/troubleshootError.test.ts` | Pass "Cannot read property 'find' of undefined", verify solution |
| Unit | Database connection error | `tests/tools/troubleshootError.test.ts` | Pass MongoDB connection error, verify cause/solution |
| Unit | Auth error | `tests/tools/troubleshootError.test.ts` | Pass "NotAuthenticated" error, verify cause/solution |
| Unit | Unknown error handling | `tests/tools/troubleshootError.test.ts` | Pass random error, verify graceful "unknown" response |
| Unit | Pattern coverage | `tests/tools/troubleshootError.test.ts` | Test at least 20 known error patterns |
| Unit | Regex accuracy | `tests/tools/troubleshootError.test.ts` | Verify patterns don't false-positive on unrelated errors |

**Pass Criteria:** 20+ error patterns correctly identified; no false positives on unrelated errors.

---

#### FR-010: Best Practices (get_best_practices)

| Test Type | Test Name | Test Location | Verification Method |
|-----------|-----------|---------------|---------------------|
| Unit | Hooks topic | `tests/tools/getBestPractices.test.ts` | Request `topic: 'hooks'`, verify practices returned |
| Unit | Services topic | `tests/tools/getBestPractices.test.ts` | Request `topic: 'services'`, verify practices returned |
| Unit | Security topic | `tests/tools/getBestPractices.test.ts` | Request `topic: 'security'`, verify practices returned |
| Unit | Good/bad examples | `tests/tools/getBestPractices.test.ts` | Verify each practice has `goodExample` and `badExample` |
| Unit | Unknown topic | `tests/tools/getBestPractices.test.ts` | Request unknown topic, verify graceful handling |

**Pass Criteria:** Each topic returns ≥3 practices with code examples.

---

#### FR-011: Concept Explanations (explain_concept)

| Test Type | Test Name | Test Location | Verification Method |
|-----------|-----------|---------------|---------------------|
| Unit | Known concept | `tests/tools/explainConcept.test.ts` | Request "services", verify explanation returned |
| Unit | Version-specific | `tests/tools/explainConcept.test.ts` | Request with `version: 'v5'`, verify v5-specific info |
| Unit | Unknown concept | `tests/tools/explainConcept.test.ts` | Request "xyznonexistent", verify graceful handling |
| Unit | Related concepts | `tests/tools/explainConcept.test.ts` | Verify response includes related concept links |

**Pass Criteria:** Core concepts (services, hooks, auth, adapters) return clear explanations.

---

#### FR-012: Alternative Suggestions (suggest_alternatives)

| Test Type | Test Name | Test Location | Verification Method |
|-----------|-----------|---------------|---------------------|
| Unit | Hook pattern | `tests/tools/suggestAlternatives.test.ts` | Request alternatives for validation hook, verify 2+ returned |
| Unit | Service pattern | `tests/tools/suggestAlternatives.test.ts` | Request alternatives for custom service, verify 2+ returned |
| Unit | Trade-offs included | `tests/tools/suggestAlternatives.test.ts` | Verify each alternative has `tradeoffs` field |

**Pass Criteria:** Each pattern query returns ≥2 alternatives with trade-off explanations.

---

#### FR-013: ~~REMOVED~~ (Migration Guide — v4 support dropped)

> This test section has been removed. `get_migration_guide` tool is not implemented.

**Pass Criteria:** N/A

---

#### FR-014: Tool Listing (list_available_tools)

| Test Type | Test Name | Test Location | Verification Method |
|-----------|-----------|---------------|---------------------|
| Unit | All tools listed | `tests/tools/listTools.test.ts` | Invoke tool, verify all 11 tools in response |
| Unit | Schemas included | `tests/tools/listTools.test.ts` | Verify each tool has `inputSchema` |
| Unit | Category filtering | `tests/tools/listTools.test.ts` | Request `category: 'generate'`, verify only codegen tools |

**Pass Criteria:** All registered tools returned with valid JSON schemas.

---

### Non-Functional Requirements → Measurement Strategy

#### NFR-001: Response Time (<2 seconds)

| Metric | Measurement Method | Tool/Technique | Threshold |
|--------|-------------------|----------------|-----------|
| **p50 latency** | Measure wall-clock time for 100 invocations per tool | `performance.now()` or `Date.now()` | <1000ms |
| **p95 latency** | 95th percentile of 100 invocations | Sort times, take index 95 | <2000ms |
| **p99 latency** | 99th percentile of 100 invocations | Sort times, take index 99 | <3000ms (informational) |

**Test Implementation:**
```
File: tests/performance/responseTime.test.ts

For each tool:
1. Warm up: invoke tool 5 times (discard results)
2. Measure: invoke tool 100 times, record each duration
3. Calculate: p50, p95, p99
4. Assert: p95 < 2000ms
5. Log: all percentiles for performance report
```

**Tools to Measure:**
| Tool | Expected p95 | Notes |
|------|-------------|-------|
| `search_docs` | <500ms | Simple BM25 lookup |
| `get_feathers_template` | <1500ms | Template composition + validation |
| `generate_service` | <1500ms | AST generation + validation |
| `validate_code` | <500ms | Pipeline of validators |
| `get_hook_example` | <200ms | Simple lookup |
| `troubleshoot_error` | <300ms | Regex matching |
| `get_best_practices` | <200ms | Simple lookup |
| `explain_concept` | <500ms | Search + retrieval |
| `suggest_alternatives` | <1000ms | Multi-source query |
| `list_available_tools` | <100ms | Registry query only |

---

#### NFR-002: Memory Usage (<200MB)

| Metric | Measurement Method | Tool/Technique | Threshold |
|--------|-------------------|----------------|-----------|
| **Startup memory** | Measure after server initialization | `process.memoryUsage().heapUsed` | <50MB |
| **Post-preload memory** | Measure after knowledge base preloaded | `process.memoryUsage().heapUsed` | <100MB |
| **Peak memory** | Maximum during tool execution | Periodic sampling during tests | <200MB |
| **Memory after GC** | Force GC, then measure | `global.gc()` (with `--expose-gc`) | <150MB |

**Test Implementation:**
```
File: tests/performance/memoryUsage.test.ts

1. Record baseline: process.memoryUsage() at startup
2. Initialize server, record memory
3. Preload knowledge base, record memory
4. For each tool, invoke 10 times:
   a. Record memory before
   b. Invoke tool
   c. Record memory after
   d. Force GC if available
   e. Record memory after GC
5. Report: max heap used across all measurements
6. Assert: max < 200MB (200 * 1024 * 1024 bytes)
```

**Memory Budget Breakdown:**
| Component | Budget | Verification |
|-----------|--------|--------------|
| Node.js baseline | ~30MB | Measured at startup |
| MCP SDK | ~10MB | Included in baseline |
| Knowledge Base (preloaded) | ~60MB | Measured after preload |
| Runtime (tool execution) | ~50MB | Peak during execution |
| Buffer | ~50MB | Safety margin |
| **Total** | **200MB** | |

---

#### NFR-003: Installation Time (<5 minutes, ≤3 commands)

| Metric | Measurement Method | Tool/Technique | Threshold |
|--------|-------------------|----------------|-----------|
| **Command count** | Manual count of documented steps | Review README.md | ≤3 |
| **Install time** | Time from `npm install` start to completion | Stopwatch / `time` command | <3 minutes |
| **Config time** | Time to edit AI assistant config | Stopwatch | <1 minute |
| **Verify time** | Time from restart to first successful tool call | Stopwatch | <1 minute |
| **Total time** | Sum of all steps | Manual timing | <5 minutes |

**Test Implementation:**
```
File: Manual test on clean machine (documented in nfr-verification-report.md)

Environment: Fresh macOS/Linux/Windows VM with only Node.js 20 installed

Steps:
1. Start timer
2. Run: npm install -g feathers-mcp-server (Command 1)
3. Record time for install to complete
4. Edit Claude Desktop config.json to add MCP server (Command 2: edit file)
5. Record time for config edit
6. Restart Claude Desktop (Command 3: restart app)
7. In Claude, ask: "List available FeathersJS MCP tools"
8. Stop timer when response received
9. Assert: total time < 5 minutes
10. Assert: command count ≤ 3
```

---

#### NFR-004: Code Quality (Generated code passes validation)

| Metric | Measurement Method | Tool/Technique | Threshold |
|--------|-------------------|----------------|-----------|
| **TypeScript compilation** | Run `tsc --noEmit` on generated code | TypeScript compiler | 0 errors |
| **ESLint validation** | Run ESLint on generated code | ESLint CLI/API | 0 errors |
| **Prettier formatting** | Run Prettier check on generated code | Prettier CLI/API | Already formatted |
| **Best practice compliance** | Run custom rules on generated code | AST analysis | 0 violations |

**Test Implementation:**
```
File: tests/integration/codeQuality.test.ts

For get_feathers_template (all 8 combinations):
1. Generate template
2. Write files to temp directory
3. Run: npx tsc --noEmit --project <temp>/tsconfig.json
4. Assert: exit code 0
5. Run: npx eslint <temp>/src/**/*.ts
6. Assert: exit code 0
7. Run: npx prettier --check <temp>/src/**/*.ts
8. Assert: exit code 0

For generate_service (all database types):
1. Generate service files
2. Write to temp directory within valid project
3. Run same validation steps
4. Assert: all pass
```

---

### Unit Test Focus Areas

#### Protocol Layer (`tests/protocol/`)

| Focus Area | What to Test | Risk if Untested |
|------------|--------------|------------------|
| **Server initialization** | Boot time, resource cleanup, error handling | Slow startup, resource leaks |
| **Tool registration** | Dynamic registration, duplicate handling, metadata format | Tools not discoverable |
| **JSON-RPC handling** | Serialization, deserialization, error formatting | Protocol violations, AI assistant failures |
| **Transport** | stdin/stdout handling, message framing | Communication failures |

---

#### Tool Routing Layer (`tests/routing/`)

| Focus Area | What to Test | Risk if Untested |
|------------|--------------|------------------|
| **Parameter validation** | Valid params, invalid params, missing required, extra fields | Invalid data reaching tools |
| **Timeout enforcement** | Handler exceeds timeout, handler completes in time | Resource exhaustion |
| **Error handling** | Exception mapping, error sanitization, logging | Exposed internals, poor error messages |
| **Registry lookup** | Existing tool, non-existing tool, case sensitivity | Wrong tool invoked, crashes |

---

#### Knowledge Base Layer (`tests/knowledge/`)

| Focus Area | What to Test | Risk if Untested |
|------------|--------------|------------------|
| **JSON parsing** | All files parse without error | Startup failures |
| **Schema compliance** | All entries match TypeScript interfaces | Runtime type errors |
| **Version tagging** | All entries have valid version field | API mixing bugs |
| **Loader behavior** | Preloading, lazy loading, caching, memory limits | Performance issues, memory leaks |
| **Search index** | Tokenization, indexing, query accuracy | Poor search results |

---

#### Tool Implementation Layer (`tests/tools/`)

| Focus Area | What to Test | Risk if Untested |
|------------|--------------|------------------|
| **Input handling** | All parameter combinations, edge cases, invalid inputs | Crashes, wrong outputs |
| **Output format** | Response structure matches schema | AI assistant parsing failures |
| **Business logic** | Core algorithm correctness (BM25, template composition, AST generation) | Wrong results |
| **Error cases** | Graceful handling of missing data, invalid state | Crashes, unhelpful errors |

---

### Integration Test Boundaries

Integration tests verify that layers work together correctly. Each test crosses at least two layer boundaries.

#### Boundary 1: Protocol → Routing

| Test | Input | Expected Behavior |
|------|-------|-------------------|
| Valid tool call | JSON-RPC with valid tool name and params | Response returned via stdout |
| Invalid tool name | JSON-RPC with unknown tool | Error response with "tool not found" |
| Invalid params | JSON-RPC with schema-violating params | Error response with validation details |
| Malformed JSON-RPC | Invalid JSON | Error response with parse error |

**Test File:** `tests/integration/protocolRouting.test.ts`

---

#### Boundary 2: Routing → Tools

| Test | Input | Expected Behavior |
|------|-------|-------------------|
| Tool execution success | Valid routed request | Tool result returned to routing layer |
| Tool execution timeout | Slow tool (mocked) | Timeout error returned |
| Tool execution error | Tool throws exception | Error formatted and returned |

**Test File:** `tests/integration/routingTools.test.ts`

---

#### Boundary 3: Tools → Knowledge Base

| Test | Input | Expected Behavior |
|------|-------|-------------------|
| Documentation query | search_docs request | Docs loaded and searched correctly |
| Template retrieval | get_feathers_template request | Fragments loaded and composed |
| Snippet retrieval | get_hook_example request | Snippets loaded and filtered |
| Error pattern matching | troubleshoot_error request | Error database queried correctly |

**Test File:** `tests/integration/toolsKnowledge.test.ts`

---

#### Boundary 4: Full Stack (Protocol → Routing → Tools → Knowledge)

| Test | Input | Expected Behavior |
|------|-------|-------------------|
| End-to-end search | MCP request for search_docs | Complete flow returns results |
| End-to-end generation | MCP request for generate_service | Complete flow returns valid code |
| End-to-end validation | MCP request for validate_code | Complete flow returns validation result |

**Test File:** `tests/integration/fullFlow.test.ts`

---

### Performance Test Strategy

#### Response Time Measurement

```
┌─────────────────────────────────────────────────────────────────┐
│                    Response Time Test Flow                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Setup                                                        │
│     ├── Start MCP server                                         │
│     ├── Wait for initialization                                  │
│     └── Warm-up: 5 tool invocations (discard)                   │
│                                                                  │
│  2. Measurement Loop (100 iterations per tool)                   │
│     ├── Record start time: performance.now()                     │
│     ├── Invoke tool via mock transport                           │
│     ├── Wait for response                                        │
│     ├── Record end time: performance.now()                       │
│     └── Store duration: end - start                              │
│                                                                  │
│  3. Analysis                                                     │
│     ├── Sort durations ascending                                 │
│     ├── p50 = durations[49]                                      │
│     ├── p95 = durations[94]                                      │
│     ├── p99 = durations[98]                                      │
│     └── max = durations[99]                                      │
│                                                                  │
│  4. Assertions                                                   │
│     ├── Assert p95 < 2000ms (NFR-001)                           │
│     └── Log all metrics for report                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

#### Memory Usage Measurement

```
┌─────────────────────────────────────────────────────────────────┐
│                    Memory Usage Test Flow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Baseline Measurement                                         │
│     ├── Record: process.memoryUsage().heapUsed                   │
│     └── Expected: ~30MB (Node.js baseline)                       │
│                                                                  │
│  2. Post-Initialization Measurement                              │
│     ├── Initialize MCP server                                    │
│     ├── Record: process.memoryUsage().heapUsed                   │
│     └── Expected: ~50MB                                          │
│                                                                  │
│  3. Post-Preload Measurement                                     │
│     ├── Trigger knowledge base preload                           │
│     ├── Record: process.memoryUsage().heapUsed                   │
│     └── Expected: ~100MB                                         │
│                                                                  │
│  4. Peak Usage Measurement                                       │
│     ├── For each tool:                                           │
│     │   ├── Invoke tool with typical params                      │
│     │   ├── Sample memory every 10ms during execution            │
│     │   └── Record max sample                                    │
│     └── Expected peak: <200MB                                    │
│                                                                  │
│  5. Post-GC Measurement (if --expose-gc available)               │
│     ├── global.gc()                                              │
│     ├── Record: process.memoryUsage().heapUsed                   │
│     └── Expected: <150MB (no leaks)                              │
│                                                                  │
│  6. Assertions                                                   │
│     ├── Assert max heap < 200MB (NFR-002)                        │
│     ├── Assert post-GC < preload + 50MB (no major leaks)         │
│     └── Log all metrics for report                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

#### Startup Time Measurement

```
┌─────────────────────────────────────────────────────────────────┐
│                    Startup Time Test Flow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Cold Start Measurement (10 iterations)                       │
│     ├── Record start: Date.now()                                 │
│     ├── Spawn: node dist/index.js                                │
│     ├── Send: MCP initialize request                             │
│     ├── Wait for: initialize response                            │
│     ├── Record end: Date.now()                                   │
│     ├── Kill process                                             │
│     └── Store duration: end - start                              │
│                                                                  │
│  2. Analysis                                                     │
│     ├── Calculate p50, p95 of 10 measurements                    │
│     └── Expected p95: <3000ms                                    │
│                                                                  │
│  3. Assertions                                                   │
│     ├── Assert p95 < 3000ms (FR-001)                             │
│     └── Log all metrics for report                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Test Coverage Requirements

| Metric | Threshold | Enforcement |
|--------|-----------|-------------|
| **Line coverage** | ≥80% | Jest `coverageThreshold` in `jest.config.js` |
| **Branch coverage** | ≥80% | Jest `coverageThreshold` |
| **Function coverage** | ≥80% | Jest `coverageThreshold` |
| **Statement coverage** | ≥80% | Jest `coverageThreshold` |

**Jest Configuration:**
```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  }
}
```

**Coverage Exclusions (reasonable to exclude):**
- `src/index.ts` (entry point, tested via integration)
- Type definition files (`*.d.ts`)
- Test helper files (`tests/helpers/*`)

---

### Test Execution Summary

| Test Suite | Files | Estimated Tests | Run Time |
|------------|-------|-----------------|----------|
| Protocol Layer | 3 | ~25 | <5s |
| Routing Layer | 4 | ~30 | <5s |
| Knowledge Base | 3 | ~20 | <10s |
| Tool Unit Tests | 15 | ~100 | <30s |
| Validation Rules | 10+ | ~50 | <10s |
| Integration Tests | 4 | ~30 | <20s |
| E2E Tests | 1 | ~10 | <30s |
| Performance Tests | 2 | ~15 | <60s |
| **Total** | **~42** | **~280** | **<3 min** |

---

### Verification Checkpoints

| Checkpoint | Week | Tests Required | Pass Criteria |
|------------|------|----------------|---------------|
| Protocol working | 2 | Protocol unit tests | All pass, <3s startup |
| First tool working | 3 | search_docs tests | Ranking correct, <500ms |
| Validation pipeline | 4 | Validation tests | All validators work |
| Code generation | 5 | Template + service tests | Generated code compiles |
| All tools complete | 7 | All tool unit tests | >80% coverage |
| Integration verified | 8 | Integration tests | Full flow works |
| NFRs verified | 9 | Performance tests | All NFRs pass |
| Release ready | 10 | All tests | 100% pass rate |
