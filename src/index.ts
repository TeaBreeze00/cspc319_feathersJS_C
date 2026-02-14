import { McpServer, ToolRegistry } from './protocol';

const registry = new ToolRegistry();
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

