#!/usr/bin/env node

/**
 * Fetch FeathersJS v4 documentation from crow.docs.feathersjs.com
 * Converts HTML pages to DocEntry format for knowledge base
 */

const https = require('https');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');

// V4 docs to fetch (HTML pages)
const V4_DOCS = [
  // Core API
  { url: 'https://crow.docs.feathersjs.com/api/application.html', category: 'core-concepts' },
  { url: 'https://crow.docs.feathersjs.com/api/services.html', category: 'services' },
  { url: 'https://crow.docs.feathersjs.com/api/hooks.html', category: 'hooks' },
  { url: 'https://crow.docs.feathersjs.com/api/events.html', category: 'core-concepts' },
  { url: 'https://crow.docs.feathersjs.com/api/errors.html', category: 'core-concepts' },
  { url: 'https://crow.docs.feathersjs.com/api/configuration.html', category: 'core-concepts' },
  
  // Transports
  { url: 'https://crow.docs.feathersjs.com/api/express.html', category: 'core-concepts' },
  { url: 'https://crow.docs.feathersjs.com/api/channels.html', category: 'core-concepts' },
  
  // Client
  { url: 'https://crow.docs.feathersjs.com/api/client.html', category: 'core-concepts' },
  
  // Authentication
  { url: 'https://crow.docs.feathersjs.com/api/authentication/service.html', category: 'authentication' },
  { url: 'https://crow.docs.feathersjs.com/api/authentication/jwt.html', category: 'authentication' },
  { url: 'https://crow.docs.feathersjs.com/api/authentication/local.html', category: 'authentication' },
  { url: 'https://crow.docs.feathersjs.com/api/authentication/oauth.html', category: 'authentication' },
  { url: 'https://crow.docs.feathersjs.com/api/authentication/client.html', category: 'authentication' },
  
  // Databases
  { url: 'https://crow.docs.feathersjs.com/api/databases/adapters.html', category: 'databases' },
  { url: 'https://crow.docs.feathersjs.com/api/databases/common.html', category: 'databases' },
  { url: 'https://crow.docs.feathersjs.com/api/databases/querying.html', category: 'databases' },
  
  // Key guides
  { url: 'https://crow.docs.feathersjs.com/guides/basics/services.html', category: 'services' },
  { url: 'https://crow.docs.feathersjs.com/guides/basics/hooks.html', category: 'hooks' },
  { url: 'https://crow.docs.feathersjs.com/guides/basics/authentication.html', category: 'authentication' },
  
  // Additional hook-related pages
  { url: 'https://crow.docs.feathersjs.com/api/authentication/hook.html', category: 'hooks' },
  { url: 'https://crow.docs.feathersjs.com/cookbook/express/file-uploading.html', category: 'hooks' },
  { url: 'https://crow.docs.feathersjs.com/guides/security.html', category: 'hooks' },
  { url: 'https://crow.docs.feathersjs.com/api/authentication/', category: 'hooks' },

  // Additional service-related pages (REST/Socket client usage)
  { url: 'https://crow.docs.feathersjs.com/api/client/rest.html', category: 'services' },
  { url: 'https://crow.docs.feathersjs.com/api/client/socketio.html', category: 'services' },
  { url: 'https://crow.docs.feathersjs.com/api/client/primus.html', category: 'services' },
  { url: 'https://crow.docs.feathersjs.com/guides/basics/setup.html', category: 'guides' },
  { url: 'https://crow.docs.feathersjs.com/guides/basics/starting.html', category: 'guides' },
  { url: 'https://crow.docs.feathersjs.com/guides/basics/generator.html', category: 'guides' },
  { url: 'https://crow.docs.feathersjs.com/guides/basics/frontend.html', category: 'guides' },
  { url: 'https://crow.docs.feathersjs.com/guides/basics/testing.html', category: 'guides' },
  { url: 'https://crow.docs.feathersjs.com/api/socketio.html', category: 'core-concepts' },
  { url: 'https://crow.docs.feathersjs.com/api/primus.html', category: 'core-concepts' },
  { url: 'https://crow.docs.feathersjs.com/api/authentication/strategy.html', category: 'authentication' },
  { url: 'https://crow.docs.feathersjs.com/guides/migrating.html', category: 'guides' },
];

/**
 * Extract text content from HTML
 */
function extractTextFromHtml(html) {
  // Remove script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Extract content from main content area (VuePress uses .theme-default-content or .content)
  const contentMatch = text.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (contentMatch) {
    text = contentMatch[1];
  }
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decode HTML entities
  text = text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  
  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
  
  return text;
}

/**
 * Extract title from HTML
 */
function extractTitleFromHtml(html) {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].replace(/\s*\|\s*FeathersJS/, '').trim();
  }
  
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].replace(/#/g, '').trim();
  }
  
  return 'Untitled';
}

/**
 * Tokenize text for search (simple word extraction)
 */
function tokenize(text) {
  return [...new Set(
    text
      .toLowerCase()
      .slice(0, 1000)
      .match(/\b[a-z]{3,}\b/g) || []
  )];
}

/**
 * Convert HTML content to DocEntry
 */
function htmlToEntry(html, url, category) {
  const title = extractTitleFromHtml(html);
  const content = extractTextFromHtml(html);
  
  // Generate ID from URL
  const urlPath = url.replace('https://crow.docs.feathersjs.com/', '').replace('.html', '');
  const id = `v4-${urlPath.replace(/\//g, '-')}`;
  
  return {
    id,
    title,
    content: content.slice(0, 3000),
    version: 'v4',
    tokens: tokenize(content),
    category,
  };
}

/**
 * Fetch a single HTML page with redirect support
 */
async function fetchHtmlPage(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const request = client.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        if (maxRedirects === 0) {
          reject(new Error('Too many redirects'));
          return;
        }
        const redirectUrl = new URL(response.headers.location, url).toString();
        resolve(fetchHtmlPage(redirectUrl, maxRedirects - 1));
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${url}`));
        return;
      }
      
      let html = '';
      response.on('data', (chunk) => html += chunk);
      response.on('end', () => resolve(html));
    });
    
    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('Fetching FeathersJS v4 documentation...');
  
  const entries = [];
  
  // Fetch all v4 docs
  for (const doc of V4_DOCS) {
    const filename = doc.url.split('/').pop();
    console.log(`  Fetching: ${filename}`);
    
    try {
      const html = await fetchHtmlPage(doc.url);
      const entry = htmlToEntry(html, doc.url, doc.category);
      entries.push(entry);
    } catch (error) {
      console.error(`  ✗ Failed to fetch ${filename}: ${error.message}`);
    }
  }
  
  console.log(`✓ Fetched ${entries.length} v4 docs`);
  
  // Load existing v5 docs and merge
  // Derive all categories from entries dynamically
  const allCategories = [...new Set(entries.map(e => e.category))];
  const docsDir = path.join(__dirname, '..', 'knowledge-base', 'docs');
  
  for (const category of allCategories) {
    const filePath = path.join(docsDir, `${category}.json`);
    
    // Load existing entries and keep only non-v4 entries
    let existingEntries = [];
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      existingEntries = JSON.parse(content).filter(e => e.version !== 'v4');
    } catch (error) {
      // File doesn't exist yet, that's OK
    }
    
    // Add v4 entries for this category
    const v4Entries = entries.filter(e => e.category === category);
    const mergedEntries = [...existingEntries, ...v4Entries];
    
    // Write merged entries
    await fs.writeFile(
      filePath,
      JSON.stringify(mergedEntries, null, 2) + '\n',
      'utf-8'
    );
  }
  
  console.log('✓ Fetch complete!');
  console.log(`  Total v4 entries: ${entries.length}`);
  console.log(`  Files updated in knowledge-base/docs/`);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
