// ui/server.js
/**
 * FeathersJS MCP Server - Testing UI Bridge
 *
 * This Express server keeps a single persistent MCP server child process
 * and sends JSON-RPC messages over stdio, returning parsed results to the
 * browser frontend.
 */

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;
const PROJECT_ROOT = path.join(__dirname, '..');
const MCP_ENTRY = path.join(PROJECT_ROOT, 'dist', 'index.js');

// ---------------------------------------------------------------------------
// Load .env file (no external dependency)
// ---------------------------------------------------------------------------
const ENV_PATH = path.join(__dirname, '.env');
const envVars = {};
if (fs.existsSync(ENV_PATH)) {
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    envVars[key] = val;
  }
  console.log(`  [env] Loaded ${Object.keys(envVars).length} vars from ui/.env`);
  if (envVars.GITHUB_TOKEN) {
    console.log('  [env] GITHUB_TOKEN is set — submit_documentation will create GitHub PRs');
  }
} else {
  console.log('  [env] No ui/.env file found — submit_documentation will use local staging');
}

// Merge into a child-process env: inherit current process.env + overlay .env vars
const childEnv = { ...process.env, ...envVars };

app.use(express.json());
app.use(express.static(__dirname));

// ---------------------------------------------------------------------------
// Persistent MCP child process
// ---------------------------------------------------------------------------

let mcpChild = null;
let mcpReady = false;
let nextId = 10; // start above the init handshake ids
let pendingRequests = new Map(); // id → { resolve, reject, timer }
let stdoutBuffer = '';

function ensureMCP() {
  if (mcpChild && !mcpChild.killed) return Promise.resolve();

  return new Promise((resolve, reject) => {
    console.log('  [mcp] Spawning MCP server process…');
    mcpReady = false;
    stdoutBuffer = '';
    pendingRequests.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(new Error('MCP process restarting'));
    });
    pendingRequests.clear();

    mcpChild = spawn('node', [MCP_ENTRY], {
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: childEnv,
    });

    mcpChild.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();

      // Process complete JSON lines
      let newlineIdx;
      while ((newlineIdx = stdoutBuffer.indexOf('\n')) !== -1) {
        const line = stdoutBuffer.slice(0, newlineIdx).trim();
        stdoutBuffer = stdoutBuffer.slice(newlineIdx + 1);
        if (!line) continue;

        try {
          const msg = JSON.parse(line);
          // Init response
          if (msg.id === 1 && !mcpReady) {
            mcpReady = true;
            console.log('  [mcp] Server initialized and ready.');
            resolve();
          }
          // Pending request response
          const pending = pendingRequests.get(msg.id);
          if (pending) {
            clearTimeout(pending.timer);
            pendingRequests.delete(msg.id);
            if (msg.error) {
              pending.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            } else {
              pending.resolve(msg.result);
            }
          }
        } catch {
          // not valid JSON — ignore
        }
      }
    });

    mcpChild.stderr.on('data', (chunk) => {
      // Log server debug output but don't fail
      const text = chunk.toString().trim();
      if (text) console.log('  [mcp:stderr]', text);
    });

    mcpChild.on('close', (code) => {
      console.log(`  [mcp] Process exited (code ${code}).`);
      mcpChild = null;
      mcpReady = false;
      // Reject all pending
      pendingRequests.forEach((p) => {
        clearTimeout(p.timer);
        p.reject(new Error('MCP process exited unexpectedly'));
      });
      pendingRequests.clear();
      if (!mcpReady) reject(new Error('MCP process exited before init'));
    });

    mcpChild.on('error', (err) => {
      console.error('  [mcp] Spawn error:', err.message);
      mcpChild = null;
      reject(err);
    });

    // Send the initialize handshake
    const initMsg = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'feathers-mcp-ui', version: '1.0' },
      },
    });
    mcpChild.stdin.write(initMsg + '\n');

    // Timeout for init
    setTimeout(() => {
      if (!mcpReady) {
        if (mcpChild) mcpChild.kill();
        reject(new Error('MCP server did not initialize within 30 seconds'));
      }
    }, 30000);
  });
}

/**
 * Send a JSON-RPC request to the persistent MCP process and return the result.
 */
function sendToMCP(method, params, timeoutMs = 60000) {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureMCP();
    } catch (err) {
      return reject(err);
    }

    if (!mcpChild || mcpChild.killed) {
      return reject(new Error('MCP process is not running'));
    }

    const id = nextId++;
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });

    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`MCP request timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timer });

    try {
      mcpChild.stdin.write(msg + '\n');
    } catch (err) {
      clearTimeout(timer);
      pendingRequests.delete(id);
      reject(new Error('Failed to write to MCP stdin: ' + err.message));
    }
  });
}

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

/**
 * POST /api/call
 * Body: { tool: string, args: object }
 */
app.post('/api/call', async (req, res) => {
  const { tool, args } = req.body;

  if (!tool || typeof tool !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing or invalid "tool" field.' });
  }

  try {
    const result = await sendToMCP('tools/call', { name: tool, arguments: args || {} });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/tools
 */
app.get('/api/tools', async (req, res) => {
  try {
    const result = await sendToMCP('tools/list', {});
    res.json({ ok: true, tools: result.tools || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/health
 */
app.get('/api/health', async (req, res) => {
  const built = fs.existsSync(MCP_ENTRY);
  const githubMode = !!(envVars.GITHUB_TOKEN && envVars.ALLOW_NETWORK_TOOLS === 'true');

  if (!built) {
    return res.json({
      ok: false,
      message: 'dist/index.js not found. Run "npm run build" first.',
      mcpEntry: MCP_ENTRY,
      githubMode,
    });
  }

  try {
    await ensureMCP();
    res.json({
      ok: true,
      message: githubMode
        ? 'MCP server ready — GitHub PR mode active'
        : 'MCP server ready — local staging mode (no GITHUB_TOKEN)',
      mcpEntry: MCP_ENTRY,
      githubMode,
    });
  } catch (err) {
    res.json({
      ok: false,
      message: 'MCP server failed to start: ' + err.message,
      mcpEntry: MCP_ENTRY,
      githubMode,
    });
  }
});

// ---------------------------------------------------------------------------
// Catch-all: serve index.html for any non-API route
// ---------------------------------------------------------------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log('');
  console.log('  🪶  FeathersJS MCP  —  Testing UI');
  console.log('  ─────────────────────────────────');
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Project: ${PROJECT_ROOT}`);
  console.log('');
  console.log('  Open the URL above in your browser to start testing.');
  console.log('  Press Ctrl+C to stop.\n');

  // Pre-start the MCP process so the first request is fast
  ensureMCP().catch((err) => {
    console.error('  [mcp] Failed to pre-start:', err.message);
    console.error('  [mcp] The server will retry on the first request.\n');
  });
});

// Cleanup on exit
process.on('SIGINT', () => {
  if (mcpChild) mcpChild.kill();
  process.exit(0);
});
process.on('SIGTERM', () => {
  if (mcpChild) mcpChild.kill();
  process.exit(0);
});
