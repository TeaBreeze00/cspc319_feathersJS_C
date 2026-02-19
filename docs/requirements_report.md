# CPSC 319 Design Report

## FeathersJS MCP Server

```
University of British Columbia
```
```
Department of Computer Science
```
```
February 2026
```

## Table of Contents

1. Executive Summary
2. System Overview

```
2.1 Project Context
```
```
2.2 Architecture Philosophy
```
3. Front-End Design / User Experience

```
3.1 User Interaction Model
```
```
3.2 Developer Experience Design
```
```
3.3 Developer Workflow Integration
```
4. Back-End Architecture

```
4.1 High-Level Architecture Diagram
```
```
4.2 Component Design
```
```
4.3 Data Flow Diagram
```
5. Technical Stack

```
5.1 Technology Comparisons and Justifications
```
```
5.2 Learning Challenges and Mitigation
```
6. Design Decisions

```
6.1 Major Design Decisions with Timeline Impact
```
```
6.2 Deferred Decisions
```
7. Conclusion
8. References


## 1. Executive Summary

This document presents the architectural and technical design for the FeathersJS
Model Context Protocol (MCP) Server. The system aims to enhance AI-assisted
developer workflows by providing structured FeathersJS documentation and
code generation capabilities to Large Language Model (LLM) tools such as
Claude Code and Cline.

The primary objective is to replace rigid CLI scaffolding with a flexible, LLM-
driven workflow that reduces development time and improves code quality. The
system targets three distinct user personas: full-stack developers building MVPs
rapidly, experienced FeathersJS contributors ensuring quality LLM outputs, and
student developers learning the framework through AI assistance.

This design document details the system architecture, component interactions,
technology stack decisions, and design trade-offs required to meet the functional
and non-functional requirements established in the requirements report. The
system is primarily backend infrastructure with developer experience
considerations for integration into existing AI coding workflows.

**Key Design Highlights:**

 Four-layer architecture enabling parallel development across team members
 Offline-first operation for reliability and performance
 Validation-first code generation ensuring quality outputs
 Estimated 330 hours development effort over 10-week timeline


## 2. System Overview

### 2.1 Project Context

**Project Name:** FeathersJS MCP Server

**Project Goal:** Provide structured FeathersJS documentation to LLMs and enable
generation of working Feathers projects through a Model Context Protocol server
implementation, reducing ambiguity in AI-assisted development workflows.

**Intended Users:** The system serves three primary user personas: (1) Ava, a full-
stack developer building MVPs rapidly with AI tools, (2) Marco, an experienced
FeathersJS contributor ensuring LLM outputs follow best practices, and (3)
Jason, a student learning FeathersJS through LLM-assisted development.

**System Classification:** This project is primarily backend infrastructure with
developer experience considerations. It implements a protocol server that
operates locally on developer machines, integrates with AI coding assistants, and
manages a structured knowledge base.

**Note on Front-End Design:** As a backend infrastructure project serving AI
coding assistants, this system has no traditional graphical user interface,
mockups, or color palettes. The 'user interface' is the MCP protocol API and
natural language interaction through AI assistants. Section 3 focuses on
developer experience design and workflow integration instead.

### 2.2 Architecture Philosophy

The system architecture follows several key principles:

 Offline-First Operation: All knowledge is embedded within the package to
ensure reliability and meet the 2-second response time requirement without
network dependencies.
 Stateless Request Processing: The MCP server processes each tool
invocation independently, allowing the AI client to maintain conversation state
while the server remains lightweight.
 Modular Tool Architecture: Each MCP tool is implemented as an independent
module with clear responsibilities, enabling parallel development and testing.
 Version-Aware Knowledge Management: All documentation and code
examples are tagged with FeathersJS version metadata to prevent API
mixing between v4 and v5.


 Validation-First Code Generation: All generated code undergoes syntactic
validation and linting before being returned to ensure quality outputs.


## 3. Front-End Design / User Experience

### 3.1 User Interaction Model

As a backend infrastructure project, the FeathersJS MCP Server has no
traditional graphical user interface. Instead, user interaction occurs through AI
coding assistants (Claude Code, Cline, Claude Desktop) that communicate with
the MCP server using the Model Context Protocol. The user experience is
mediated entirely through natural language prompts to the AI assistant.

The interaction flow follows this pattern:

 Developer expresses intent to the AI assistant in natural language (e.g.,
'Create a FeathersJS service for managing user profiles with MongoDB').
 AI assistant determines which MCP tools are relevant and invokes them with
appropriate parameters.
 MCP server processes the request, retrieves knowledge or generates code,
and returns structured results.
 AI assistant synthesizes the results into code, explanations, or
recommendations presented to the developer.

**3.1.1 User Interaction Flow Diagram**

```
Developer AI Assistant MCP Server
Knowledge Base
| | |
|
| "Create service" | |
|
|------------------------>| |
|
| | |
|
| | generate_service() |
|
| |--------------------->|
|
| | | query
templates |
| | |---------------
----->|
| | | <template
JSON> |
| | |<--------------
------|
| | |
|
```

```
| | | [validate
code] |
| | <generated files> |
|
| |<---------------------|
|
| <code + explanation> | |
|
|<------------------------| |
|
| | |
|
```
Figure 1: User interaction flow showing how natural language requests translate
to MCP tool invocations and knowledge base queries.

### 3.2 Developer Experience Design

**3.2.1 Installation and Setup Experience**

To meet NFR-003 (installation within 3 commands and 5 minutes), the
installation experience is designed to be minimal:

 Step 1: Install the package globally via npm: npm install -g feathers-mcp-
server
 Step 2: Add configuration to the AI assistant's MCP configuration file (e.g.,
Claude Desktop's config.json). A template configuration is provided in the
package documentation.
 Step 3: Restart the AI assistant to load the MCP server. Tools become
immediately discoverable and usable.

The package includes detailed README documentation with platform-specific
instructions for Claude Desktop, Claude Code, and Cline, as well as a
troubleshooting section for common configuration issues.

**3.2.2 Tool Discovery and Documentation**

Each MCP tool exposes comprehensive metadata through the Model Context
Protocol's tool discovery mechanism. This metadata includes tool name,
description, JSON schema for parameters, and usage examples. AI assistants
use this metadata to autonomously determine which tools to invoke based on
developer intent.


### 3.3 Developer Workflow Integration

The system supports three distinct workflow patterns corresponding to our three
user personas:

 Rapid Prototyping (Ava): Generate complete project → Add services →
Troubleshoot errors → Running in <30 minutes
 Quality Assurance (Marco): Review AI code → Validate against best practices
→ Request alternatives → Ensure expert-level quality
 Learning (Jason): Generate code → Request explanations → Understand
patterns → Build while learning


## 4. Back-End Architecture

### 4.1 High-Level Architecture Diagram

The system architecture consists of four primary layers that enable separation of
concerns and parallel development:

```
┌─────────────────────────────────────────────────────────────────────┐
│ AI Client (Claude Code/Cline)
│
│
│
│ Natural Language: "Create FeathersJS service with MongoDB + auth"
│
└────────────────────────────┬──────────────────────────────────────┘
│ stdin/stdout (JSON-RPC)
│
┌────────────────────────────▼──────────────────────────────────────┐
│ PROTOCOL LAYER
│
│ • MCP Server (@modelcontextprotocol/sdk)
│
│ • stdio transport handler
│
│ • Connection handshake & tool registration
│
│ • JSON-RPC serialization/deserialization
│
└────────────────────────────┬──────────────────────────────────────┘
│
┌────────────────────────────▼──────────────────────────────────────┐
│ TOOL ROUTING LAYER
│
│ • Parameter validation (Ajv JSON Schema)
│
│ • Tool lookup registry
│
│ • Error handling & formatting
│
│ • Timeout enforcement (10s limit)
│
└────────────────────────────┬──────────────────────────────────────┘
│
┌────────────────────────────▼──────────────────────────────────────┐
│ TOOL IMPLEMENTATION LAYER
│
│
│
│ ┌─────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│ │ search_docs │ │ get_template │ │ generate_service │ │
│ │ │ │ │ │ │ │
```

```
│ │ BM25 ranking │ │ Compose fragments│ │ Parse schema │ │
│ └────────┬────────┘ └────────┬─────────┘ └────────┬─────────┘ │
│ │ │ │
│
│ ┌────────▼─────────┐ ┌───────▼──────────┐ ┌──────▼──────────┐ │
│ │ validate_code │ │ get_hook_example │ │ troubleshoot │ │
│ │ │ │ │ │ │ │
│ │ AST analysis │ │ Pattern library │ │ Error matching │ │
│ └────────┬─────────┘ └────────┬─────────┘ └────────┬────────┘ │
│ │ │ │
│
└───────────┼─────────────────────┼──────────────────────┼──────────┘
│ │ │
┌───────────▼─────────────────────▼──────────────────────▼──────────┐
│ KNOWLEDGE BASE LAYER
│
│
│
│ ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌───────────────────┐
│
│ │ docs/ │ │templates/ │ │snippets/ │ │ errors/ │
│
│ │ │ │ │ │ │ │ │
│
│ │ JSON │ │ Fragments │ │ Hooks │ │ Error solutions │
│
│ │ v4/v5 │ │ Compose │ │ Services │ │ 20+ patterns │
│
│ └──────────┘ └───────────┘ └──────────┘ └───────────────────┘
│
│
│
│ All content embedded in npm package (offline-first)
│
│ Pre-tokenized for fast search, version-tagged
│
└─────────────────────────────────────────────────────────────────────┘
```
Figure 2: High-level system architecture showing four distinct layers and their
responsibilities. Data flows top-to-bottom for requests and bottom-to-top for
responses.

### 4.2 Component Design

**4.2.1 Protocol Layer**

**Responsibilities:**

 Initialize MCP server on process startup within 3 seconds (FR-001)
 Establish stdio transport connection and perform protocol handshake


 Handle ListTools requests by aggregating tool metadata
 Serialize/deserialize JSON-RPC messages per MCP specification

**Implementation:**

Uses official Anthropic MCP SDK for Node.js to abstract protocol details. Main
server entry point (src/index.ts) instantiates MCP server, registers tools
dynamically from src/tools directory, and begins listening on stdio.

**4.2.2 Tool Routing Layer**

Registry pattern maps tool names to handlers. Ajv validates parameters against
JSON schemas. Each handler wrapped in try-catch with 10-second timeout to
prevent resource exhaustion.

**4.2.3 Tool Implementation Layer**

Individual modules implement 15 MCP tools covering documentation search,
template generation, service creation, code validation, hook examples,
troubleshooting, best practices, and more. Key tools:

 search_docs: Two-stage ranking (keyword + BM25) with version filtering
 get_feathers_template: Fragment composition with ESLint/Prettier validation
 generate_service: Template-based generation with TypeScript AST
manipulation
 validate_code: AST-based analysis against 10+ FeathersJS best-practice
rules
 troubleshoot_error: Pattern matching against 20+ common error database

**4.2.4 Knowledge Base Layer**

Organized JSON files categorized by content type (docs/, templates/, snippets/,
errors/, best-practices/). Hybrid loading: frequent content preloaded (templates,
core docs), less frequent on-demand with caching. All content version-tagged
(v4/v5) to prevent API mixing.

### 4.3 Data Flow Diagram

The following diagram illustrates a typical request-response cycle through all four
layers:

```
REQUEST FLOW (generate_service example):
```
1. AI Client → Protocol Layer


```
JSON-RPC: { tool: "generate_service", params: { name: "users", db:
"mongodb",
fields: [{name: "email", type: "string", required:
true}] }}
```
2. Protocol Layer → Tool Routing Layer
    Deserialize message, extract tool name & parameters
3. Tool Routing Layer
    - Validate params against generate_service JSON schema✓
    - Look up handler in registry
    - Invoke tool with validated params
4. Tool Implementation (generate_service)
    a. Query Knowledge Base for MongoDB service template
    b. Parse field definitions → Generate Mongoose schema
    c. Compose service class, hooks, tests from fragments
    d. Run TypeScript compiler check✓
    e. Run ESLint validation✓
    f. Run Prettier formatting ✓
    g. Return { serviceFile, hooksFile, schemaFile, testFile }
5. Tool Routing Layer ← Tool Implementation
    Format response as MCP result object
6. Protocol Layer ← Tool Routing Layer
    Serialize to JSON-RPC response
7. AI Client ← Protocol Layer (stdout)
    JSON-RPC response with generated files
    AI synthesizes into code + explanation for developer
Total elapsed time: ~1.2 seconds (well under 2-second NFR-
requirement)

Figure 3: Detailed data flow showing request processing through all layers with
timing. Each layer has clear input/output contracts enabling independent testing.


## 5. Technical Stack

### 5.1 Technology Comparisons and Justifications

This section provides explicit comparisons between technology options,
explaining why specific choices were made over alternatives, including trade-offs
and learning challenges.

**5.1.1 Runtime: Node.js vs Python vs Deno**

**Decision: Node.js v20 LTS**

**Criterion Node.js Python Deno
Ecosystem
Match**

```
Excellent
(FeathersJS is
Node)
```
```
Poor (need
bridge)
```
```
Good (but
immature)
```
**Startup Time** <500ms (meets
FR-001)

```
~1s (acceptable) <300ms (best)
```
**Team Familiarity** High (all JS/TS) Medium Low (learning
curve)
**MCP SDK
Support**

```
Official SDK
available
```
```
Community SDK
only
```
```
No official SDK
```
Verdict: Node.js chosen for ecosystem alignment (can run/test generated
Feathers code directly), fast startup (critical for FR-001's 3-second init), and team
JavaScript/TypeScript expertise. Trade-off: Single-threaded limits CPU
parallelization, but workload is I/O-bound.

**Learning Challenge:** Team must learn MCP SDK API and stdio transport
patterns. Mitigation: 2-day SDK tutorial sprint in Week 1.

**5.1.2 Database: Embedded JSON vs SQLite vs External DB**

**Decision: Embedded JSON files (no database)**

 Embedded JSON: Simple, offline-first, no setup, 50MB size acceptable.
Chosen.
 SQLite: Adds 1MB overhead, requires SQL queries, overkill for static read-
only data.
 External DB: Network dependency violates offline-first (Assumption A-002).

Trade-off: JSON requires loading/parsing vs SQL query efficiency. Acceptable
because knowledge base is small (<50MB) and pre-tokenized for fast search.


**5.1.3 Testing: Jest vs Vitest vs Mocha**

**Decision: Jest 29.x**

 Jest: Mature, TypeScript integration via ts-jest, built-in coverage, familiar to
team. Chosen.
 Vitest: Faster, but newer (risk of bugs), less Stack Overflow support.
 Mocha: Requires separate assertion library (Chai), no built-in coverage.

Trade-off: Jest slower than Vitest (~2x), but maturity and team familiarity reduce
risk for student project.

**Learning Challenge:** Mocking MCP protocol interactions. Mitigation: Create
mock stdio transport helper in Week 2.

**5.1.4 Search: Custom BM25 vs FlexSearch vs Lunr.js**

**Decision: Custom BM25 implementation**

 Custom BM25: Tailored ranking, no dependencies, full control. Chosen.
 FlexSearch: Fast library, 50-100KB overhead, opaque ranking algorithm.
 Lunr.js: Larger (200KB), designed for browser, less flexible scoring.

Trade-off: Custom implementation requires 4-6 hours development (WBS 11.3.1)
vs library that's ready. Benefit: Can tune weights (title matches > body matches)
for technical docs.

**Learning Challenge:** Understanding BM25 algorithm parameters (k1, b).
Mitigation: Research sprint + test with known queries.

### 5.2 Learning Challenges and Mitigation

The following table identifies learning challenges for each technology choice and
mitigation strategies:

**Technology Learning Challenge Mitigation Strategy
MCP SDK** stdio transport, tool
registration patterns

2-day tutorial sprint
Week 1, sample server
analysis
**TypeScript AST** Compiler API
complexity, node types

TypeScript wiki guide,
simplified visitor pattern
for validation
**Jest Mocking** Mocking stdio, async
tool handlers

Create reusable mock
transport helper Week 2
**BM25 Algorithm** Parameter tuning (k1, b),
relevance scoring

```
Literature review, test
with known good/bad
```

queries
**Template Composition** Merging imports,
avoiding duplicates

```
Start with simple base+
fragment, expand
incrementally
```
### 5.3 How Choices Match Project Needs

 Offline-first requirement → Embedded JSON knowledge base (no network
calls)
 2-second response time → Node.js fast startup, preloaded templates, custom
search
 <200MB memory → Stateless design, selective caching, no external DB
 80% test coverage → Jest with built-in coverage reporting and thresholds
 Quality code generation → ESLint/Prettier integration, TypeScript compiler
validation
 Team skills (JS/TS strong) → Node.js, TypeScript, Jest (familiar ecosystem)


## 6. Design Decisions

### 6.1 Major Design Decisions with Timeline Impact

This section explains major design decisions, trade-offs made, and how they
affect development timeline and team workload. Each decision is linked to
specific requirements.

**6.1.1 Offline-First Architecture**

**Decision:** Embed all knowledge base content within the npm package, requiring
no network access after installation.

**Requirements Addressed:** NFR-001 (2-second response), Assumption A-
(offline operation)

**Trade-offs:**

 Gave up: Auto-updating documentation from FeathersJS releases
 Gained: Reliability in no-internet environments, guaranteed response time
performance
 Risk: Knowledge staleness (R-003) after graduation

**Timeline Impact:**

 Adds 6 hours for knowledge base organization (WBS 11.2.1)
 Saves ~20 hours by avoiding API design, authentication, rate limiting for
update service
 Net: 14 hours saved, delivery accelerated by ~1.5 weeks

**Workload Impact:**

 Front-loaded: Content creation concentrated in Weeks 2-
 Parallelizable: Docs, templates, snippets can be split across team members
 Quality control: Client review required for all knowledge base content

**6.1.2 Template Composition vs. Full Templates**

**Decision:** Store template fragments and compose them dynamically based on
requested features.

**Requirements Addressed:** FR-003 (template generation), FR-015 (3 complete
templates), US-

**Trade-offs:**

 Gave up: Simplicity of pre-built templates (just return file tree)


 Gained: 60-70% storage reduction, easy maintenance, future flexibility
 Added complexity: Import merging logic, duplicate detection

**Timeline Impact:**

 Adds 9 hours for composition engine (WBS 11.4.1)
 Saves 18 hours creating only fragments vs 12+ full templates
 Net: 9 hours saved

**Workload Impact:**

 Testing burden: Must test every feature flag combination (8 combinations)
 One developer owns composition logic (expertise concentration)

**6.1.3 Validation-First Code Generation**

**Decision:** All generated code undergoes TypeScript compilation, ESLint, and
Prettier checks before return.

**Requirements Addressed:** NFR-004 (code quality), FR-004 (service
generation), FR-007 (validation)

**Trade-offs:**

 Gave up: Slightly slower response (200-500ms added)
 Gained: Guaranteed working code, early error detection, meets NFR-
 Risk: Template bugs block generation (vs returning partial code with
warnings)

**Timeline Impact:**

 No direct impact (validation tools already required for development)
 Indirect: Higher quality templates = less debugging time in Weeks 9-

**6.1.4 Custom Search vs. Library**

**Decision:** Implement custom BM25 search algorithm instead of using
FlexSearch or Lunr.js.

**Requirements Addressed:** FR-006 (search_docs), NFR-001 (2-second
response)

**Trade-offs:**

 Gave up: Ready-made solution, proven ranking, fuzzy matching features
 Gained: Full control over ranking weights, no bundle size overhead, offline-
guaranteed
 Learning required: BM25 algorithm understanding


**Timeline Impact:**

 Adds 12 hours for custom implementation (WBS 11.3.1)
 Could save 12 hours using FlexSearch (drop-in replacement)
 Decision: Accept 12-hour cost for long-term benefits (maintainability, learning)

**Workload Impact:**

 Concentrated work: One developer implements in Week 5
 Testing: Requires curated test query set (good/bad relevance examples)

**6.1.5 Stateless Tool Design**

**Decision:** Process each tool invocation independently without session state.

**Requirements Addressed:** NFR-002 (memory <200MB)

**Trade-offs:**

 Gave up: Optimizations like caching search results across requests
 Gained: Simpler implementation, no state bugs, easier testing, lower memory

**Timeline Impact:**

 Saves ~30 hours by avoiding session management, state persistence,
concurrency control
 Enables parallel tool development (each tool is isolated module)

### 6.2 Deferred Decisions

The following decisions are deferred to later project phases when more
information is available:

 Caching Strategy: Defer until Week 8-9 performance profiling. If p
latency >2s, implement selective caching.
 Alternative Implementations Count: US-007 is COULD HAVE. Start with 2
alternatives/choice, expand if time permits.
 Error Database Size: Which 20+ errors determined from FeathersJS issue
analysis in Week 3.
 Platform Guidance Depth: US-011 is SHOULD HAVE. Basic coverage
(Node.js primary), expand Deno/Bun if time.


## 7. Conclusion

This design document establishes a comprehensive architecture for the
FeathersJS MCP Server that addresses all requirements specified in the
requirements report while making explicit trade-offs to optimize for team capacity
and timeline constraints.

The four-layer architecture (Protocol, Tool Routing, Tool Implementation,
Knowledge Base) enables parallel development across the team, with clear
interfaces between layers supporting independent testing. The modular design
allows flexible prioritization: MUST HAVE features can be completed first, with
SHOULD HAVE and COULD HAVE features added if time permits.

Technology choices prioritize team familiarity (Node.js, TypeScript, Jest) while
accepting learning challenges in targeted areas (MCP SDK, TypeScript AST,
BM25 search). Explicit comparisons between alternatives (Node.js vs Python,
Jest vs Vitest, custom search vs libraries) demonstrate informed decision-making
based on project constraints.

Design decisions consistently favor reliability and quality over features: offline-
first operation sacrifices auto-updates for performance; validation-first code
generation trades response time for quality; stateless design trades optimization
opportunities for simplicity. These trade-offs align with the project's goal of
delivering a reliable MVP within academic term constraints.

Timeline impacts have been quantified for major decisions (e.g., offline-first
saves 14 hours net, custom search costs 12 hours but provides long-term
benefits). The estimated 330-hour development effort maps to a realistic 10-week
schedule with built-in buffer for NFR verification and client feedback cycles.

The design supports all three user personas through thoughtful workflow
integration: Ava achieves <30-minute project generation, Marco validates LLM
outputs against FeathersJS conventions, and Jason learns through well-
explained examples. Success metrics for each persona drove specific tool
designs.

**AI Use Disclosure:** This is an AI-based project. Generative AI tools are used as
part of the solution development, along with human review, testing, and
documentation of design decisions.


## 8. References

[1] Anthropic, "Model Context Protocol Specification," Anthropic PBC, 2024.
[Online]. Available: https://modelcontextprotocol.io/

[2] Anthropic, "MCP SDK for Node.js," npm, 2024. [Online]. Available:
https://www.npmjs.com/package/@modelcontextprotocol/sdk

[3] FeathersJS Team, "FeathersJS Documentation," FeathersJS, 2024. [Online].
Available: https://feathersjs.com/

[4] Microsoft Corporation, "TypeScript Compiler API," Microsoft, 2024. [Online].
Available: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API

[5] OpenJS Foundation, "Node.js Documentation," Node.js Foundation, 2024.
[Online]. Available: https://nodejs.org/en/docs/

[6] S. Robertson and H. Zaragoza, "The probabilistic relevance framework: BM
and beyond," Foundations and Trends in Information Retrieval, vol. 3, no. 4, pp.
333-389, 2009.

[7] OpenJS Foundation, "ESLint - Pluggable JavaScript Linter," ESLint, 2024.
[Online]. Available: https://eslint.org/

[8] Prettier Team, "Prettier - Opinionated Code Formatter," Prettier, 2024.
[Online]. Available: https://prettier.io/

[9] Facebook, Inc., "Jest - Delightful JavaScript Testing," Meta Open Source,

2024. [Online]. Available: https://jestjs.io/

[10] E. Buonanno, "JSON Schema Validator (Ajv)," npm, 2024. [Online].
Available: https://www.npmjs.com/package/ajv

[11] G. Gamma, R. Helm, R. Johnson, and J. Vlissides, Design Patterns:
Elements of Reusable Object-Oriented Software. Reading, MA: Addison-Wesley,
1994.

[12] T. Parr, The Definitive ANTLR 4 Reference. Raleigh, NC: Pragmatic
Bookshelf, 2013.
