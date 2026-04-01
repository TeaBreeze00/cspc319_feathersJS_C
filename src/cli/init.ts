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
// Readline helpers
// ---------------------------------------------------------------------------

function createRl(): readline.Interface {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

async function confirm(rl: readline.Interface, question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = (await ask(rl, `${question} ${hint} `)).trim().toLowerCase();
  if (answer === '') return defaultYes;
  return answer === 'y' || answer === 'yes';
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

interface McpTool {
  name: string;
  configPath: string;
  format: 'mcpServers' | 'vscode';
}

function getTools(): McpTool[] {
  const home = os.homedir();
  const isWin = process.platform === 'win32';
  const appData = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');

  return [
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

function buildServerEntry(env: Record<string, string>, format: 'mcpServers' | 'vscode'): object {
  if (format === 'vscode') {
    return {
      type: 'stdio',
      command: 'npx',
      args: ['feathersjs-mcp'],
      ...(Object.keys(env).length > 0 ? { env } : {}),
    };
  }
  return {
    command: 'npx',
    args: ['feathersjs-mcp'],
    ...(Object.keys(env).length > 0 ? { env } : {}),
  };
}

function writeConfig(tool: McpTool, env: Record<string, string>): void {
  const configDir = path.dirname(tool.configPath);
  fs.mkdirSync(configDir, { recursive: true });

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
  const rl = createRl();

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
    if (await confirm(rl, q, isDetected)) {
      toConfigure.push(tool);
    }
  }

  if (toConfigure.length === 0) {
    console.log('\nNothing to configure. Exiting.');
    rl.close();
    return;
  }

  // Network tools
  console.log('\n─'.repeat(40));
  console.log('\nNetwork tools (submit/update/remove docs via GitHub PR)');
  console.log('These require a GitHub token and ALLOW_NETWORK_TOOLS=true.\n');

  const enableNetwork = await confirm(rl, 'Enable network tools?', false);
  const env: Record<string, string> = {};

  if (enableNetwork) {
    const token = (await ask(rl, 'GitHub token (leave blank to set manually later): ')).trim();
    if (token) env.GITHUB_TOKEN = token;
    env.GITHUB_OWNER = 'TeaBreeze00';
    env.GITHUB_REPO = 'cspc319_feathersJS_C';
    env.ALLOW_NETWORK_TOOLS = 'true';
  }

  // Write configs
  console.log('\n─'.repeat(40));
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
    console.log('To enable network tools later, re-run: npx feathersjs-mcp init');
  }

  rl.close();
}
