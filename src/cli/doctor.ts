/**
 * doctor.ts — Diagnostics for feathersjs-mcp.
 *
 * Checks and reports:
 *   - Knowledge base cache status (age, staleness)
 *   - GitHub token validity
 *   - Network tools flag
 *   - MCP client configuration across all supported tools
 *   - GitHub reachability
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CACHE_DIR = path.join(os.homedir(), '.feathersjs-mcp');
const SYNC_STATE_FILE = path.join(CACHE_DIR, 'sync-state.json');
const CHUNKS_CACHE_DIR = path.join(CACHE_DIR, 'chunks');
const TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function pass(label: string, detail: string): void {
  console.log(`  \x1b[32m✓\x1b[0m  ${label.padEnd(22)} ${detail}`);
}

function fail(label: string, detail: string, hint?: string): void {
  console.log(`  \x1b[31m✗\x1b[0m  ${label.padEnd(22)} ${detail}`);
  if (hint) console.log(`         \x1b[2m→ ${hint}\x1b[0m`);
}

function warn(label: string, detail: string, hint?: string): void {
  console.log(`  \x1b[33m!\x1b[0m  ${label.padEnd(22)} ${detail}`);
  if (hint) console.log(`         \x1b[2m→ ${hint}\x1b[0m`);
}

function section(title: string): void {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
  console.log('─'.repeat(50));
}

function humanAge(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function checkKnowledgeBase(): void {
  section('Knowledge Base');

  const chunksDir = fs.existsSync(CHUNKS_CACHE_DIR)
    ? CHUNKS_CACHE_DIR
    : path.join(process.cwd(), 'knowledge-base', 'chunks');

  const files = fs.existsSync(chunksDir)
    ? fs.readdirSync(chunksDir).filter(f => f.endsWith('.json'))
    : [];

  if (files.length === 0) {
    fail('Chunks', 'No chunk files found', 'Run: npx feathersjs-mcp-server (will auto-sync on startup)');
    return;
  }

  const source = fs.existsSync(CHUNKS_CACHE_DIR) ? '~/.feathersjs-mcp/chunks' : 'bundled';
  pass('Chunks', `${files.filter(f => f !== 'metadata.json').length} files (${source})`);

  // Sync state
  if (!fs.existsSync(SYNC_STATE_FILE)) {
    warn('Sync state', 'Never synced', 'Will sync on next startup');
    return;
  }

  try {
    const state = JSON.parse(fs.readFileSync(SYNC_STATE_FILE, 'utf8')) as {
      last_synced: string;
      remote_version: string;
    };
    const age = Date.now() - new Date(state.last_synced).getTime();
    const remaining = Math.max(0, TTL_MS - age);
    const remainingH = Math.ceil(remaining / 3_600_000);

    if (age > TTL_MS) {
      warn('Last synced', humanAge(age), 'Stale — will refresh on next startup');
    } else {
      pass('Last synced', `${humanAge(age)} (next sync in ~${remainingH}h)`);
    }
    pass('Remote version', state.remote_version);
  } catch {
    warn('Sync state', 'Unreadable', 'Delete ~/.feathersjs-mcp/sync-state.json to reset');
  }
}

function checkCredentials(): void {
  section('Credentials & Network Tools');

  const token = process.env.GITHUB_TOKEN;
  const networkEnabled = process.env.ALLOW_NETWORK_TOOLS === 'true';

  if (!token) {
    warn('GITHUB_TOKEN', 'Not set', 'Run: npx feathersjs-mcp-server@latest init');
  } else {
    pass('GITHUB_TOKEN', `set (${token.slice(0, 12)}...)`);
  }

  if (networkEnabled) {
    pass('Network tools', 'enabled (ALLOW_NETWORK_TOOLS=true)');
  } else {
    warn('Network tools', 'disabled', 'Run: npx feathersjs-mcp-server@latest init');
  }
}

function checkMcpClients(): void {
  section('MCP Client Configuration');

  const home = os.homedir();
  const isWin = process.platform === 'win32';
  const appData = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');

  const clients = [
    {
      name: 'Claude Code (CLI)',
      configPath: path.join(home, '.claude', 'settings.json'),
      serverKey: 'mcpServers',
    },
    {
      name: 'Codex (CLI)',
      configPath: path.join(home, '.codex', 'config.toml'),
      serverKey: 'codex',
    },
    {
      name: 'Claude Desktop',
      configPath: isWin
        ? path.join(appData, 'Claude', 'claude_desktop_config.json')
        : path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      serverKey: 'mcpServers',
    },
    {
      name: 'Cursor',
      configPath: path.join(home, '.cursor', 'mcp.json'),
      serverKey: 'mcpServers',
    },
    {
      name: 'Windsurf',
      configPath: path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
      serverKey: 'mcpServers',
    },
    {
      name: 'VS Code',
      configPath: isWin
        ? path.join(appData, 'Code', 'User', 'mcp.json')
        : path.join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json'),
      serverKey: 'servers',
    },
  ];

  for (const client of clients) {
    if (!fs.existsSync(path.dirname(client.configPath))) {
      // Tool not installed — skip silently
      continue;
    }

    if (!fs.existsSync(client.configPath)) {
      fail(client.name, 'Config file missing', `Run: npx feathersjs-mcp-server init`);
      continue;
    }

    try {
      const raw = fs.readFileSync(client.configPath, 'utf8');

      // Codex uses TOML — check with a simple regex instead of JSON.parse
      if (client.serverKey === 'codex') {
        if (/\[mcp_servers\.feathersjs\]/.test(raw)) {
          pass(client.name, 'configured  (npx feathersjs-mcp-server)');
        } else {
          fail(client.name, 'feathersjs entry missing', `Run: npx feathersjs-mcp-server init`);
        }
        continue;
      }

      const config = JSON.parse(raw);
      const servers = config[client.serverKey] ?? {};
      if ('feathersjs' in servers) {
        const entry = servers['feathersjs'];
        const cmd = [entry.command, ...(entry.args ?? [])].join(' ');
        pass(client.name, `configured  (${cmd})`);
      } else {
        fail(client.name, 'feathersjs entry missing', `Run: npx feathersjs-mcp-server init`);
      }
    } catch {
      fail(client.name, 'Config file unreadable', `Run: npx feathersjs-mcp-server init`);
    }
  }
}

async function checkGitHub(): Promise<void> {
  section('GitHub Connectivity');

  const owner = process.env.GITHUB_OWNER ?? 'TeaBreeze00';
  const repo = process.env.GITHUB_REPO ?? 'cspc319_feathersJS_C';

  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/main/knowledge-base/chunks/metadata.json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      pass('Raw content', `github.com/${owner}/${repo} reachable`);
    } else {
      fail('Raw content', `HTTP ${res.status}`, 'Check GITHUB_OWNER / GITHUB_REPO env vars');
    }
  } catch {
    fail('Raw content', 'Unreachable', 'No internet or GitHub is down');
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function runDoctor(): Promise<void> {
  console.log('\n\x1b[1mfeathersjs-mcp doctor\x1b[0m');
  console.log('═'.repeat(50));

  checkKnowledgeBase();
  checkCredentials();
  checkMcpClients();
  await checkGitHub();

  console.log('\n' + '═'.repeat(50) + '\n');
}
