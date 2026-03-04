import fs from 'node:fs';
import path from 'node:path';
import { McpServer, ToolRegistry } from './protocol';
import { ToolHandlerRegistry, ParameterValidator, ErrorHandler, Router } from './routing';
import {
  SearchDocsTool,
  SubmitDocumentationTool,
  RemoveDocumentationTool,
  UpdateDocumentationTool,
} from './tools';

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const eqIdx = trimmed.indexOf('=');
  if (eqIdx <= 0) {
    return null;
  }

  const key = trimmed.slice(0, eqIdx).trim();
  if (!key) {
    return null;
  }

  let value = trimmed.slice(eqIdx + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

function loadEnvFile(filePath: string): number {
  if (!fs.existsSync(filePath)) {
    return 0;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let loaded = 0;

  for (const rawLine of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(rawLine);
    if (!parsed) {
      continue;
    }

    const [key, value] = parsed;
    if (process.env[key] === undefined) {
      process.env[key] = value;
      loaded += 1;
    }
  }

  return loaded;
}

function bootstrapEnv(): void {
  const cwd = process.cwd();
  const projectRoot = path.resolve(__dirname, '..');
  const candidates = [
    path.join(cwd, '.env'),
    path.join(cwd, 'ui', '.env'),
    path.join(projectRoot, '.env'),
    path.join(projectRoot, 'ui', '.env'),
  ];
  const seen = new Set<string>();

  let totalLoaded = 0;
  for (const envPath of candidates) {
    if (seen.has(envPath)) {
      continue;
    }
    seen.add(envPath);
    totalLoaded += loadEnvFile(envPath);
  }

  if (totalLoaded > 0) {
    console.error(`Loaded ${totalLoaded} env var(s) from .env files`);
  }
}

bootstrapEnv();

// Protocol-level registry (metadata + implementations)
const registry = new ToolRegistry();

// Routing-layer components
const routingRegistry = new ToolHandlerRegistry();
const validator = new ParameterValidator();
const errorHandler = new ErrorHandler();
const router = new Router(routingRegistry, validator, errorHandler);

// Create tool instances
const searchDocsTool = new SearchDocsTool();
const submitDocTool = new SubmitDocumentationTool();
const removeDocTool = new RemoveDocumentationTool();
const updateDocTool = new UpdateDocumentationTool();

// Register tools with protocol registry (metadata + handler for MCP)
registry.register(searchDocsTool.register());
registry.register(submitDocTool.register());
registry.register(removeDocTool.register());
registry.register(updateDocTool.register());

// Register tools with routing registry (handler + schema for routing layer)
routingRegistry.register(
  'search_docs',
  (params: unknown) => searchDocsTool.execute(params),
  searchDocsTool.inputSchema
);

routingRegistry.register(
  'submit_documentation',
  (params: unknown) => submitDocTool.execute(params),
  submitDocTool.inputSchema,
  true // requiresNetwork = true
);

routingRegistry.register(
  'remove_documentation',
  (params: unknown) => removeDocTool.execute(params),
  removeDocTool.inputSchema,
  true // requiresNetwork = true
);

routingRegistry.register(
  'update_documentation',
  (params: unknown) => updateDocTool.execute(params),
  updateDocTool.inputSchema,
  true // requiresNetwork = true
);

// Create MCP server (protocol layer)
const server = new McpServer(registry);

async function startServer() {
  try {
    await server.start();
    console.error('feathers-mcp-server started');
  } catch (err) {
    console.error('Failed to start MCP server:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

startServer();

async function shutdown(signal: string) {
  try {
    console.error(`Received ${signal}, shutting down`);
    await server.stop();
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
