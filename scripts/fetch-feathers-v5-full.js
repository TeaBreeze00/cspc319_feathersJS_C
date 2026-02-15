#!/usr/bin/env node
/**
 * Fetch ALL FeathersJS v5 documentation from feathersjs.com
 * Replaces the v5 entries in knowledge-base/docs/ with comprehensive content.
 * Run: node scripts/fetch-feathers-v5-full.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');

// ── All v5 doc URLs with categories ──────────────────────────────────────────
const V5_PAGES = [
  // ─── Guides ────────────────────────────────────────────────────────
  { url: 'https://feathersjs.com/guides/', cat: 'guides' },
  { url: 'https://feathersjs.com/guides/basics/starting.html', cat: 'guides' },
  { url: 'https://feathersjs.com/guides/basics/generator.html', cat: 'guides' },
  { url: 'https://feathersjs.com/guides/basics/authentication.html', cat: 'authentication' },
  { url: 'https://feathersjs.com/guides/basics/services.html', cat: 'services' },
  { url: 'https://feathersjs.com/guides/basics/hooks.html', cat: 'hooks' },
  { url: 'https://feathersjs.com/guides/basics/schemas.html', cat: 'guides' },
  { url: 'https://feathersjs.com/guides/basics/login.html', cat: 'authentication' },
  { url: 'https://feathersjs.com/guides/frontend/javascript.html', cat: 'guides' },

  // ─── CLI / Generated files ─────────────────────────────────────────
  { url: 'https://feathersjs.com/guides/cli/', cat: 'guides' },
  { url: 'https://feathersjs.com/guides/cli/default.json.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/guides/cli/custom-environment-variables.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/guides/cli/hook.html', cat: 'hooks' },
  { url: 'https://feathersjs.com/guides/cli/log-error.html', cat: 'hooks' },
  { url: 'https://feathersjs.com/guides/cli/service.html', cat: 'services' },
  { url: 'https://feathersjs.com/guides/cli/service.class.html', cat: 'services' },
  { url: 'https://feathersjs.com/guides/cli/service.schemas.html', cat: 'services' },
  { url: 'https://feathersjs.com/guides/cli/service.shared.html', cat: 'services' },
  { url: 'https://feathersjs.com/guides/cli/app.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/guides/cli/authentication.html', cat: 'authentication' },
  { url: 'https://feathersjs.com/guides/cli/client.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/guides/cli/configuration.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/guides/cli/declarations.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/guides/cli/logger.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/guides/cli/validators.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/guides/cli/databases.html', cat: 'databases' },
  { url: 'https://feathersjs.com/guides/cli/client.test.html', cat: 'guides' },
  { url: 'https://feathersjs.com/guides/cli/app.test.html', cat: 'guides' },
  { url: 'https://feathersjs.com/guides/cli/service.test.html', cat: 'guides' },
  { url: 'https://feathersjs.com/guides/cli/prettierrc.html', cat: 'guides' },
  { url: 'https://feathersjs.com/guides/cli/knexfile.html', cat: 'databases' },
  { url: 'https://feathersjs.com/guides/cli/package.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/guides/whats-new.html', cat: 'guides' },
  { url: 'https://feathersjs.com/guides/migrating.html', cat: 'guides' },

  // ─── API core ──────────────────────────────────────────────────────
  { url: 'https://feathersjs.com/api/', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/api/application.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/api/services.html', cat: 'services' },
  { url: 'https://feathersjs.com/api/hooks.html', cat: 'hooks' },
  { url: 'https://feathersjs.com/api/events.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/api/errors.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/api/configuration.html', cat: 'core-concepts' },

  // ─── API transports ────────────────────────────────────────────────
  { url: 'https://feathersjs.com/api/koa.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/api/express.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/api/socketio.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/api/channels.html', cat: 'core-concepts' },

  // ─── API authentication ────────────────────────────────────────────
  { url: 'https://feathersjs.com/api/authentication/', cat: 'authentication' },
  { url: 'https://feathersjs.com/api/authentication/service.html', cat: 'authentication' },
  { url: 'https://feathersjs.com/api/authentication/hook.html', cat: 'authentication' },
  { url: 'https://feathersjs.com/api/authentication/strategy.html', cat: 'authentication' },
  { url: 'https://feathersjs.com/api/authentication/jwt.html', cat: 'authentication' },
  { url: 'https://feathersjs.com/api/authentication/local.html', cat: 'authentication' },
  { url: 'https://feathersjs.com/api/authentication/oauth.html', cat: 'authentication' },

  // ─── API client ────────────────────────────────────────────────────
  { url: 'https://feathersjs.com/api/client.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/api/client/rest.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/api/client/socketio.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/api/authentication/client.html', cat: 'authentication' },

  // ─── API schema ────────────────────────────────────────────────────
  { url: 'https://feathersjs.com/api/schema/', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/api/schema/typebox.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/api/schema/schema.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/api/schema/validators.html', cat: 'core-concepts' },
  { url: 'https://feathersjs.com/api/schema/resolvers.html', cat: 'core-concepts' },

  // ─── API databases ─────────────────────────────────────────────────
  { url: 'https://feathersjs.com/api/databases/adapters.html', cat: 'databases' },
  { url: 'https://feathersjs.com/api/databases/common.html', cat: 'databases' },
  { url: 'https://feathersjs.com/api/databases/querying.html', cat: 'databases' },
  { url: 'https://feathersjs.com/api/databases/mongodb.html', cat: 'databases' },
  { url: 'https://feathersjs.com/api/databases/knex.html', cat: 'databases' },
  { url: 'https://feathersjs.com/api/databases/memory.html', cat: 'databases' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fetchUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'feathers-mcp-server-fetch' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects === 0) return reject(new Error('Too many redirects'));
        const next = new URL(res.headers.location, url).toString();
        return resolve(fetchUrl(next, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      }
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

/** Strip HTML tags and decode entities — keeps code blocks readable */
function htmlToText(html) {
  // Remove <script> and <style>
  let t = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  t = t.replace(/<style\b[\s\S]*?<\/style>/gi, '');
  t = t.replace(/<nav\b[\s\S]*?<\/nav>/gi, '');

  // Replace <pre><code> blocks with fenced code blocks
  t = t.replace(/<pre[^>]*>\s*<code[^>]*class="[^"]*language-(\w+)[^"]*"[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_, lang, code) => '\n```' + lang + '\n' + decodeEntities(code.replace(/<[^>]+>/g, '')) + '\n```\n');
  t = t.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_, code) => '\n```\n' + decodeEntities(code.replace(/<[^>]+>/g, '')) + '\n```\n');

  // Replace inline <code> with backticks
  t = t.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => '`' + decodeEntities(c.replace(/<[^>]+>/g, '')) + '`');

  // Replace headings with markdown
  t = t.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => '\n# ' + strip(c) + '\n');
  t = t.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => '\n## ' + strip(c) + '\n');
  t = t.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => '\n### ' + strip(c) + '\n');
  t = t.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, c) => '\n#### ' + strip(c) + '\n');

  // Lists
  t = t.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => '• ' + strip(c) + '\n');

  // Paragraphs / divs → newlines
  t = t.replace(/<\/?(p|div|br|tr|section|article|header|footer)[^>]*>/gi, '\n');

  // Strip remaining tags
  t = t.replace(/<[^>]+>/g, '');
  t = decodeEntities(t);

  // Clean up whitespace
  t = t.replace(/\n{3,}/g, '\n\n').trim();
  return t;
}

function strip(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).trim();
}

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  if (m) return m[1].replace(/\s*[|–-]\s*Feathers.*$/i, '').trim();
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return strip(h1[1]);
  return 'Untitled';
}

function tokenize(text) {
  return [...new Set(
    text.toLowerCase().slice(0, 2000)
      .match(/\b[a-z][a-z0-9]{2,}\b/g) || []
  )];
}

function idFromUrl(url) {
  return 'v5-' + url
    .replace('https://feathersjs.com/', '')
    .replace(/\.html$/, '')
    .replace(/\/$/g, '')
    .replace(/\//g, '-') || 'index';
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Fetching ${V5_PAGES.length} v5 documentation pages...\n`);

  const entries = [];
  let failures = 0;

  for (const page of V5_PAGES) {
    const short = page.url.replace('https://feathersjs.com/', '');
    process.stdout.write(`  ${short} ... `);

    try {
      const html = await fetchUrl(page.url);
      const title = extractTitle(html);
      const content = htmlToText(html);
      const id = idFromUrl(page.url);

      entries.push({
        id,
        title,
        content: content.slice(0, 5000),   // generous limit; code examples are valuable
        version: 'v5',
        tokens: tokenize(title + ' ' + content),
        category: page.cat,
      });
      console.log(`✓  (${title})`);
    } catch (err) {
      failures++;
      console.log(`✗  ${err.message}`);
    }

    // small delay to be polite
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n✓ Fetched ${entries.length} / ${V5_PAGES.length} pages (${failures} failed)\n`);

  // ── Write category JSON files ──────────────────────────────────────────
  const docsDir = path.join(__dirname, '..', 'knowledge-base', 'docs');
  await fs.mkdir(docsDir, { recursive: true });

  const cats = {};
  for (const e of entries) {
    (cats[e.category] = cats[e.category] || []).push(e);
  }

  for (const [cat, catEntries] of Object.entries(cats)) {
    const filePath = path.join(docsDir, `${cat}.json`);

    // Load existing file and keep only v4 entries
    let v4Entries = [];
    try {
      const existing = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      v4Entries = existing.filter((e) => e.version === 'v4');
    } catch { /* first run or missing file */ }

    const merged = [...v4Entries, ...catEntries];
    await fs.writeFile(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
    console.log(`  ${cat}.json: ${merged.length} entries (${v4Entries.length} v4 + ${catEntries.length} v5)`);
  }

  console.log('\n✓ Done! knowledge-base/docs/ updated.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
