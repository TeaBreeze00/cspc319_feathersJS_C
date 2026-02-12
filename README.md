# FeathersJS MCP Server

A Model Context Protocol (MCP) server that provides AI coding assistants with structured FeathersJS documentation, templates, and code generation capabilities.

## Overview

The FeathersJS MCP Server enhances AI-assisted developer workflows by replacing rigid CLI scaffolding with a flexible, LLM-driven approach. It enables AI assistants like Claude Code and Cline to generate working FeathersJS projects, provide contextual documentation, and troubleshoot errors—all through natural language interactions.

### Key Features

- **Offline-First Operation**: All knowledge embedded in the package—no network requests at runtime
- **15 MCP Tools**: Documentation search, template generation, service creation, code validation, hook examples, troubleshooting, and more
- **Version-Aware**: Full support for both FeathersJS v4 and v5 with automatic version detection
- **Fast & Lightweight**: <2s response time (p95), <200MB memory usage, <3s startup
- **Validation-First**: All generated code passes TypeScript, ESLint, and Prettier validation
- **Comprehensive Knowledge Base**: Pre-tokenized documentation, templates, snippets, and error solutions

## Target Users

- **Full-Stack Developers**: Build MVPs rapidly with AI-assisted FeathersJS development
- **FeathersJS Contributors**: Ensure LLM outputs follow best practices and expert patterns
- **Student Developers**: Learn FeathersJS through AI assistance with quality code examples

## Installation

### Prerequisites

- Node.js 20 or higher
- An MCP-compatible AI coding assistant (Claude Code, Cline, or Claude Desktop)

### Install Package

```bash
npm install -g feathers-mcp-server
```

### Configure AI Assistant

Add the server to your AI assistant's MCP configuration file:

**For Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "feathers": {
      "command": "feathers-mcp-server",
      "args": []
    }
  }
}
```

**For VS Code Extensions** (Cline/Claude Code):

Add to your extension settings or workspace `.vscode/settings.json`:

```json
{
  "mcp.servers": {
    "feathers": {
      "command": "feathers-mcp-server"
    }
  }
}
```

### Verify Installation

Restart your AI assistant and try a prompt like:

```
Create a FeathersJS service for managing user profiles with MongoDB
```

The assistant should now have access to FeathersJS-specific tools and documentation.

## Quick Start

### Example Prompts

**Generate a complete project:**
```
Create a new FeathersJS v5 project with authentication, MongoDB database, and a users service
```

**Add a service:**
```
Add a messages service with real-time updates and user associations
```

**Get documentation:**
```
Show me how to implement custom hooks in FeathersJS v5
```

**Troubleshoot errors:**
```
I'm getting "Service not found" error. Help me debug it.
```

**Validate code:**
```
Check if this FeathersJS service follows best practices: [paste code]
```

## Architecture

The system follows a 4-layer architecture for clean separation of concerns:

```
┌─────────────────────────────────────────┐
│   AI Client (Claude Code/Cline)        │
└──────────────┬──────────────────────────┘
               │ JSON-RPC (stdin/stdout)
┌──────────────▼──────────────────────────┐
│   PROTOCOL LAYER                        │
│   MCP Server & Transport                │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│   TOOL ROUTING LAYER                    │
│   Validation & Error Handling           │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│   TOOL IMPLEMENTATION LAYER             │
│   15 MCP Tools (search, generate, etc)  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│   KNOWLEDGE BASE LAYER                  │
│   Docs, Templates, Snippets, Errors     │
└─────────────────────────────────────────┘
```

### Available Tools

1. `search_docs` - Search FeathersJS documentation with BM25 ranking
2. `get_feathers_template` - Retrieve project templates with fragment composition
3. `generate_service` - Generate complete service implementations
4. `generate_hook` - Create custom hook implementations
5. `validate_code` - AST-based validation against best practices
6. `get_hook_example` - Retrieve hook pattern examples
7. `troubleshoot_error` - Match errors against solution database
8. `get_best_practices` - Query architectural best practices
9. `generate_authentication` - Create authentication setup
10. `list_databases` - Show supported database adapters
11. `generate_schema` - Create TypeScript schemas and validation
12. `get_migration_guide` - v4 to v5 migration assistance
13. `explain_concept` - Detailed explanations of FeathersJS concepts
14. `generate_test` - Create service test suites
15. `get_deployment_guide` - Production deployment guidance

## Development

### Setup Development Environment

```bash
# Clone repository
git clone [repository-url]
cd cspc319_feathersJS_C

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Project Structure

```
├── src/
│   ├── protocol/         # MCP protocol layer
│   ├── routing/          # Tool routing & validation
│   ├── tools/            # Tool implementations
│   └── knowledge/        # Knowledge base loader
├── knowledge-base/       # Embedded content (JSON)
│   ├── docs/            # Documentation
│   ├── templates/       # Code templates
│   ├── snippets/        # Code examples
│   ├── errors/          # Error solutions
│   └── best-practices/  # Best practices
├── tests/               # Test suites
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── performance/
└── docs/                # Design documentation
    ├── requirements_report.md
    ├── implementation_plan.md
    └── build_steps.md
```

### Architectural Guardrails

The codebase enforces strict constraints:

- **G1**: No network requests at runtime (offline-first)
- **G2**: Stateless tool design (no session persistence)
- **G3**: Version-aware knowledge handling (v4/v5 separation)
- **G4**: Response time limits (<2s p95)
- **G5**: Memory limits (<200MB peak)
- **G6**: Validation-first code generation
- **G7**: Unidirectional layer dependencies
- **G8**: stdout reserved for MCP JSON-RPC only
- **G9**: Test coverage ≥80%
- **G10**: Strict TypeScript, modern Node.js

## Documentation

- [Requirements Report](docs/requirements_report.md) - Functional and non-functional requirements
- [Implementation Plan](docs/implementation_plan.md) - Architecture and development phases
- [Build Steps](docs/build_steps.md) - Linear build sequence for development

## Performance Targets

- **Startup Time**: <3 seconds
- **Response Time**: <2 seconds (p95 latency)
- **Memory Usage**: <200MB peak
- **Installation**: 3 commands, <5 minutes
- **Code Generation**: <5 seconds for complete services

## Technology Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript (strict mode)
- **MCP SDK**: @modelcontextprotocol/sdk
- **Validation**: Ajv (JSON Schema)
- **Testing**: Jest with ts-jest
- **Linting**: ESLint, Prettier

## License

[License information to be added]

## Contributing

[Contributing guidelines to be added]

## Support

For issues, questions, or contributions, please see the project documentation or contact the development team.

---

**CPSC 319 Project - University of British Columbia**  
*Department of Computer Science*  
*February 2026*
