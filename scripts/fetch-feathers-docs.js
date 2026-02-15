#!/usr/bin/env node
/**
 * Fetch FeathersJS documentation and convert to knowledge-base format
 * Run: node scripts/fetch-feathers-docs.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const OUTPUT_DIR = path.join(__dirname, '..', 'knowledge-base');

// Feathers v5 docs sources (dove branch)
const V5_DOCS = [
  'https://api.github.com/repos/feathersjs/feathers/contents/docs/api/services.md?ref=dove',
  'https://api.github.com/repos/feathersjs/feathers/contents/docs/api/hooks.md?ref=dove',
  'https://api.github.com/repos/feathersjs/feathers/contents/docs/api/application.md?ref=dove',
  'https://api.github.com/repos/feathersjs/feathers/contents/docs/api/events.md?ref=dove',
  'https://api.github.com/repos/feathersjs/feathers/contents/docs/api/channels.md?ref=dove',
  'https://api.github.com/repos/feathersjs/feathers/contents/docs/api/errors.md?ref=dove',
  'https://api.github.com/repos/feathersjs/feathers/contents/docs/api/configuration.md?ref=dove',
  'https://api.github.com/repos/feathersjs/feathers/contents/docs/api/express.md?ref=dove',
  'https://api.github.com/repos/feathersjs/feathers/contents/docs/api/client.md?ref=dove',
];

function fetch(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      return reject(new Error('Too many redirects'));
    }
    
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    const options = {
      headers: {
        'User-Agent': 'feathers-mcp-server-fetch',
      },
    };
    
    protocol.get(url, options, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location, redirectCount + 1)
          .then(resolve)
          .catch(reject);
      }
      
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function markdownToEntry(filename, content, version) {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : filename.replace(/\.md$/, '');
  const category = filename.replace(/\.md$/, '');
  
  return {
    id: `${version}-${filename.replace(/\.md$/, '')}`,
    title,
    content: content.substring(0, 3000), // Keep more content for better context
    version,
    tokens: tokenize(title + ' ' + content.substring(0, 1000)),
    category,
  };
}

async function fetchSingleFile(url) {
  console.error(`  Fetching: ${url.split('/').pop().split('?')[0]}`);
  const data = await fetch(url);
  const parsed = JSON.parse(data);
  
  if (parsed.content && parsed.encoding === 'base64') {
    return Buffer.from(parsed.content, 'base64').toString('utf8');
  }
  
  throw new Error('Unexpected file format');
}

async function main() {
  console.error('Fetching FeathersJS v5 documentation...\n');
  ensureDir(path.join(OUTPUT_DIR, 'docs'));
  
  const v5Entries = [];
  
  for (const url of V5_DOCS) {
    try {
      const content = await fetchSingleFile(url);
      const filename = url.split('/').pop().split('?')[0];
      const entry = markdownToEntry(filename, content, 'v5');
      v5Entries.push(entry);
      await new Promise((r) => setTimeout(r, 500)); // Rate limit
    } catch (err) {
      console.error(`    Error: ${err.message}`);
    }
  }
  
  console.error(`\n✓ Fetched ${v5Entries.length} v5 docs`);
  
  // Categorize entries
  const byCategory = (keyword) => v5Entries.filter((e) =>
    e.title.match(keyword) || e.content.match(keyword)
  );
  
  // Write categorized files
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'docs', 'core-concepts.json'),
    JSON.stringify(v5Entries.filter((e) => 
      e.id.match(/application|service|hook|event/i)
    ).slice(0, 20), null, 2)
  );
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'docs', 'services.json'),
    JSON.stringify(byCategory(/service/i).slice(0, 15), null, 2)
  );
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'docs', 'hooks.json'),
    JSON.stringify(byCategory(/hook/i).slice(0, 15), null, 2)
  );
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'docs', 'authentication.json'),
    JSON.stringify(byCategory(/auth|jwt|oauth|login|passport/i).slice(0, 15), null, 2)
  );
  
  console.error('\n✓ Fetch complete!');
  console.error(`  Total entries: ${v5Entries.length}`);
  console.error(`  Files written to knowledge-base/docs/`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});