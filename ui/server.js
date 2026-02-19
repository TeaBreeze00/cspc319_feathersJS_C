/**
 * FeathersJS MCP Server - Peer Testing UI Bridge
 *
 * This Express server acts as a bridge between the browser frontend and the
 * MCP server process. It spawns the MCP server as a child process, sends
 * JSON-RPC messages over stdio, and returns parsed results to the frontend.
 */

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const PROJECT_ROOT = path.join(__dirname, '..');
const MCP_ENTRY = path.join(PROJECT_ROOT, 'dist', 'index.js');

app.use(express.json());
app.use(express.static(__dirname));

// ---------------------------------------------------------------------------
// MCP stdio bridge
// ---------------------------------------------------------------------------

/**
 * Sends a single tool call to the MCP server via stdio and resolves with
 * the parsed result object from the JSON-RPC response.
 *
 * @param {string} toolName  - MCP tool name (e.g. "search_docs")
 * @param {object} toolArgs  - Arguments object for the tool
 * @returns {Promise<object>} - Resolves with { content, isError? }
 */
function callMCP(toolName, toolArgs) {
  return new Promise((resolve, reject) => {
    // Spawn the compiled MCP server
    const child = spawn('node', [MCP_ENTRY], {
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // JSON-RPC message 1 – initialize handshake (required by MCP protocol)
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

    // JSON-RPC message 2 – the actual tool call
    const callMsg = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: toolName, arguments: toolArgs },
    });

    child.stdin.write(initMsg + '\n');
    child.stdin.write(callMsg + '\n');
    child.stdin.end();

    let stdout = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    // Stderr is only server debug output – ignore silently
    child.stderr.on('data', () => {});

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('MCP server timed out after 15 seconds.'));
    }, 15000);

    child.on('close', () => {
      clearTimeout(timer);
      try {
        const lines = stdout.trim().split('\n').filter(Boolean);
        // Find the response whose id matches our tool call (id: 2)
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.id === 2) {
              resolve(parsed.result);
              return;
            }
          } catch {
            // Not valid JSON on this line – skip
          }
        }
        reject(new Error('No valid response received from the MCP server.'));
      } catch (err) {
        reject(err);
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to start MCP server: ${err.message}`));
    });
  });
}

/**
 * Sends a tools/list request to the MCP server.
 *
 * @returns {Promise<object[]>} - Resolves with the array of tool descriptors
 */
function listMCPTools() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [MCP_ENTRY], {
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

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

    const listMsg = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });

    child.stdin.write(initMsg + '\n');
    child.stdin.write(listMsg + '\n');
    child.stdin.end();

    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', () => {});

    const timer = setTimeout(() => { child.kill(); reject(new Error('Timed out')); }, 10000);

    child.on('close', () => {
      clearTimeout(timer);
      try {
        const lines = stdout.trim().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.id === 2 && parsed.result && parsed.result.tools) {
              resolve(parsed.result.tools);
              return;
            }
          } catch {}
        }
        reject(new Error('No tools list response'));
      } catch (err) {
        reject(err);
      }
    });

    child.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

/**
 * POST /api/call
 * Body: { tool: string, args: object }
 * Response: { ok: true, result: object } | { ok: false, error: string }
 */
app.post('/api/call', async (req, res) => {
  const { tool, args } = req.body;

  if (!tool || typeof tool !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing or invalid "tool" field.' });
  }

  try {
    const result = await callMCP(tool, args || {});
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/tools
 * Returns the list of available MCP tools with their schemas.
 */
app.get('/api/tools', async (req, res) => {
  try {
    const tools = await listMCPTools();
    res.json({ ok: true, tools });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/health
 * Simple health check – verifies the dist/index.js file exists.
 */
app.get('/api/health', (req, res) => {
  const fs = require('fs');
  const built = fs.existsSync(MCP_ENTRY);
  res.json({
    ok: built,
    message: built
      ? 'MCP server build found. Ready to test.'
      : 'dist/index.js not found. Run "npm run build" first.',
    mcpEntry: MCP_ENTRY,
  });
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
  console.log('  🪶  FeathersJS MCP  —  Peer Testing UI');
  console.log('  ─────────────────────────────────────');
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Project: ${PROJECT_ROOT}`);
  console.log('');
  console.log('  Open the URL above in your browser to start testing.');
  console.log('  Press Ctrl+C to stop.\n');
});
