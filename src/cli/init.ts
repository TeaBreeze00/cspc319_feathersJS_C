/**
 * init.ts — Interactive setup wizard for feathersjs-mcp.
 *
 * Detects installed AI tools, asks the user which ones to configure,
 * and writes the correct MCP config snippet into each tool's config file.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

// ---------------------------------------------------------------------------
// Readline helpers — queue-based so piped and TTY input both work correctly
// ---------------------------------------------------------------------------

interface Prompter {
  ask(question: string): Promise<string>;
  close(): void;
}

function createPrompter(): Prompter {
  const lineQueue: string[] = [];
  const waiters: Array<(line: string) => void> = [];

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.on('line', (line: string) => {
    if (waiters.length > 0) {
      waiters.shift()!(line);
    } else {
      lineQueue.push(line);
    }
  });

  return {
    ask(question: string): Promise<string> {
      process.stdout.write(question);
      return new Promise(resolve => {
        if (lineQueue.length > 0) {
          resolve(lineQueue.shift()!);
        } else {
          waiters.push(resolve);
        }
      });
    },
    close() {
      rl.close();
    },
  };
}

async function confirm(prompter: Prompter, question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = (await prompter.ask(`${question} ${hint} `)).trim().toLowerCase();
  process.stdout.write('\n');
  if (answer === '') return defaultYes;
  return answer === 'y' || answer === 'yes';
}

async function ask(prompter: Prompter, question: string): Promise<string> {
  const answer = await prompter.ask(question);
  process.stdout.write('\n');
  return answer;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

interface McpTool {
  name: string;
  configPath: string;
  format: 'mcpServers' | 'vscode' | 'claude-code' | 'codex';
}

function getTools(): McpTool[] {
  const home = os.homedir();
  const isWin = process.platform === 'win32';
  const appData = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');

  return [
    {
      name: 'Claude Code (CLI)',
      configPath: path.join(home, '.claude', 'settings.json'),
      format: 'claude-code',
    },
    {
      name: 'Codex (CLI)',
      configPath: path.join(home, '.codex', 'config.toml'),
      format: 'codex',
    },
    {
      name: 'Claude Desktop',
      configPath: isWin
        ? path.join(appData, 'Claude', 'claude_desktop_config.json')
        : path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      format: 'mcpServers',
    },
    {
      name: 'Cursor',
      configPath: path.join(home, '.cursor', 'mcp.json'),
      format: 'mcpServers',
    },
    {
      name: 'Windsurf',
      configPath: path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
      format: 'mcpServers',
    },
    {
      name: 'VS Code (GitHub Copilot)',
      configPath: isWin
        ? path.join(appData, 'Code', 'User', 'mcp.json')
        : path.join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json'),
      format: 'vscode',
    },
  ];
}

// ---------------------------------------------------------------------------
// Config writers
// ---------------------------------------------------------------------------

function buildServerEntry(env: Record<string, string>, format: 'mcpServers' | 'vscode' | 'claude-code' | 'codex'): object {
  if (format === 'vscode') {
    return {
      type: 'stdio',
      command: 'npx',
      args: ['feathersjs-mcp-server'],
      ...(Object.keys(env).length > 0 ? { env } : {}),
    };
  }
  // mcpServers and claude-code both use the same shape
  return {
    command: 'npx',
    args: ['feathersjs-mcp-server'],
    ...(Object.keys(env).length > 0 ? { env } : {}),
  };
}

function writeCodexConfig(configPath: string, env: Record<string, string>): void {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  let toml = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';

  // Remove any existing feathersjs mcp_servers blocks (main table and any sub-tables like .env)
  toml = toml.replace(/\n?\[mcp_servers\.feathersjs(?:\.[^\]]+)?\][\s\S]*?(?=\n\[|\n*$)/g, '').trimEnd();

  // Append new block
  let block = '\n\n[mcp_servers.feathersjs]\ncommand = "npx"\nargs = ["feathersjs-mcp-server"]';
  if (Object.keys(env).length > 0) {
    block += '\n\n[mcp_servers.feathersjs.env]';
    for (const [k, v] of Object.entries(env)) {
      block += `\n${k} = "${v}"`;
    }
  }

  fs.writeFileSync(configPath, toml + block + '\n', 'utf8');
}

function writeConfig(tool: McpTool, env: Record<string, string>): void {
  const configDir = path.dirname(tool.configPath);
  fs.mkdirSync(configDir, { recursive: true });

  if (tool.format === 'codex') {
    writeCodexConfig(tool.configPath, env);
    return;
  }

  let existing: Record<string, any> = {};
  if (fs.existsSync(tool.configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(tool.configPath, 'utf8'));
    } catch {
      // Treat unreadable config as empty
    }
  }

  const serverEntry = buildServerEntry(env, tool.format);
  const serverKey = tool.format === 'vscode' ? 'servers' : 'mcpServers';

  existing[serverKey] = existing[serverKey] ?? {};
  existing[serverKey]['feathersjs'] = serverEntry;

  fs.writeFileSync(tool.configPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export async function runInit(): Promise<void> {
  const prompter = createPrompter();

  console.log('\nfeathersjs-mcp setup wizard');
  console.log('─'.repeat(40));

  const tools = getTools();

  // Detect which tools are already installed (config dir exists)
  const detected = tools.filter(t => fs.existsSync(path.dirname(t.configPath)));
  const undetected = tools.filter(t => !fs.existsSync(path.dirname(t.configPath)));

  if (detected.length > 0) {
    console.log('\nDetected AI tools on this machine:');
    detected.forEach(t => console.log(`  • ${t.name}`));
  }
  if (undetected.length > 0) {
    console.log('\nNot detected (can still configure):');
    undetected.forEach(t => console.log(`  • ${t.name}`));
  }

  console.log('');

  // Ask which tools to configure
  const toConfigure: McpTool[] = [];
  for (const tool of tools) {
    const isDetected = detected.includes(tool);
    const q = isDetected
      ? `Configure feathersjs-mcp for ${tool.name}?`
      : `Configure feathersjs-mcp for ${tool.name} (not detected)?`;
    if (await confirm(prompter, q, isDetected)) {
      toConfigure.push(tool);
    }
  }

  if (toConfigure.length === 0) {
    console.log('\nNothing to configure. Exiting.');
    prompter.close();
    return;
  }

  // Network tools
  console.log('\n' + '─'.repeat(40));
  console.log('\nNetwork tools (submit/update/remove docs via GitHub PR)');
  console.log('These require a GitHub token and ALLOW_NETWORK_TOOLS=true.\n');

  const enableNetwork = await confirm(prompter, 'Enable network tools?', false);
  const env: Record<string, string> = {};

  if (enableNetwork) {
    const token = (await ask(prompter, 'GitHub token (leave blank to set manually later): ')).trim();
    if (token) env.GITHUB_TOKEN = token;
    env.GITHUB_OWNER = 'TeaBreeze00';
    env.GITHUB_REPO = 'cspc319_feathersJS_C';
    env.ALLOW_NETWORK_TOOLS = 'true';
  }

  // Write configs
  console.log('\n' + '─'.repeat(40));
  const configured: string[] = [];
  const failed: string[] = [];

  for (const tool of toConfigure) {
    try {
      writeConfig(tool, env);
      configured.push(tool.name);
    } catch (err) {
      failed.push(`${tool.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Summary
  console.log('\nDone!\n');
  if (configured.length > 0) {
    console.log('Configured:');
    configured.forEach(name => console.log(`  ✓ ${name}`));
  }
  if (failed.length > 0) {
    console.log('\nFailed:');
    failed.forEach(msg => console.log(`  ✗ ${msg}`));
  }

  console.log('\nRestart your AI tool for the changes to take effect.');
  if (!enableNetwork) {
    console.log('To enable network tools later, re-run: npx feathersjs-mcp-server init');
  }

  prompter.close();
}
