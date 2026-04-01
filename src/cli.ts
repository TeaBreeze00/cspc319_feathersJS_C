/**
 * cli.ts — CLI entry point for feathersjs-mcp.
 *
 * Usage:
 *   feathersjs-mcp           Start the MCP server (default)
 *   feathersjs-mcp init      Run the interactive setup wizard
 */

const command = process.argv[2];

if (command === 'init') {
  import('./cli/init').then(m => m.runInit()).catch(err => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
} else {
  // Default: start the MCP server
  require('./index');
}
