/**
 * cli.ts — CLI entry point for feathersjs-mcp.
 *
 * Usage:
 *   feathersjs-mcp                Start the MCP server (default)
 *   feathersjs-mcp init           Run the interactive setup wizard
 *   feathersjs-mcp doctor         Run diagnostics
 *   feathersjs-mcp --version      Print version
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../package.json') as { version: string };

const command = process.argv[2];

if (command === '--version' || command === '-v') {
  console.log(version);
  process.exit(0);
} else if (command === 'init') {
  import('./cli/init').then(m => m.runInit()).catch(err => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
} else if (command === 'doctor') {
  import('./cli/doctor').then(m => m.runDoctor()).catch(err => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
} else {
  // Default: start the MCP server
  require('./index');
}
