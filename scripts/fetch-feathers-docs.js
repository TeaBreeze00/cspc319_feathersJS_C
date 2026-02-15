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

// Feathers docs sources
const DOCS_SOURCES = {
  v5: 'https://api.github.com/repos/feathersjs/feathers/contents/docs?ref=dove',
  v4: 'https://api.github.com/repos/feathersjs/docs/contents/api?ref=master',
};

function fetch(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    const options = {
      headers: {
        'User-Agent': 'feathers-mcp-server-fetch',
      },
    };
    
    protocol.get(url, options, (res) => {
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

async function fetchGitHubTree(url) {
  console.error(`Fetching: ${url}`);
  const data = await fetch(url);
  return JSON.parse(data);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function markdownToEntry(filename, content, version) {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : filename.replace(/\.md$/, '');
  const category = filename.split('-')[0] || 'general';
  
  return {
    id: `${version}-${filename.replace(/\.md$/, '')}`,
    title,
    content: content.substring(0, 2000),
    version,
    tokens: tokenize(title + ' ' + content.substring(0, 500)),
    category,
  };
}

async function fetchMarkdownFiles(treeUrl, version) {
  const tree = await fetchGitHubTree(treeUrl);
  const entries = [];
  
  for (const item of tree) {
    if (item.type === 'file' && item.name.endsWith('.md')) {
      console.error(`  - ${item.name}`);
      try {
        const fileData = await fetch(item.download_url || item.url);
        let content;
        if (item.download_url) {
          content = fileData;
        } else {
          const parsed = JSON.parse(fileData);
          content = Buffer.from(parsed.content, 'base64').toString('utf8');
        }
        entries.push(markdownToEntry(item.name, content, version));
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        console.error(`    Error: ${err.message}`);
      }
    }
  }
  return entries;
}

async function main() {
  console.error('Fetching FeathersJS documentation...\n');
  ensureDir(path.join(OUTPUT_DIR, 'docs'));
  
  console.error('Fetching v5 docs...');
  const v5Entries = await fetchMarkdownFiles(DOCS_SOURCES.v5, 'v5');
  
  console.error('\nFetching v4 docs...');
  const v4Entries = await fetchMarkdownFiles(DOCS_SOURCES.v4, 'v4');
  
  const allEntries = [...v5Entries, ...v4Entries];
  const byCategory = (keyword) => allEntries.filter((e) =>
    e.title.match(keyword) || e.content.match(keyword)
  );
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'docs', 'core-concepts.json'),
    JSON.stringify(allEntries.filter((e) => e.category.match(/intro|app|service|hook|general/i)).slice(0, 20), null, 2)
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
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});