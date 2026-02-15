#!/usr/bin/env node
/**
 * Builds knowledge-base JSON files from docs/v5_docs/ markdown sources.
 * Generates: docs/, templates/, snippets/, errors/, best-practices/
 */
const fs = require('fs');
const path = require('path');

const V5_DOCS = path.join(__dirname, '..', 'docs', 'v5_docs');
const KB_DIR = path.join(__dirname, '..', 'knowledge-base');

// Simple tokenizer: lowercase, split on non-alpha, remove stopwords, deduplicate
const STOPWORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','shall','should','may','might','must','can','could',
  'and','but','or','nor','not','so','yet','both','either','neither','each','every',
  'all','any','few','more','most','other','some','such','no','only','own','same',
  'than','too','very','just','because','as','until','while','of','at','by','for',
  'with','about','against','between','through','during','before','after','above',
  'below','to','from','up','down','in','out','on','off','over','under','again',
  'further','then','once','here','there','when','where','why','how','what','which',
  'who','whom','this','that','these','those','it','its','i','me','my','myself',
  'we','our','ours','you','your','he','him','his','she','her','they','them','their',
]);

function tokenize(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 1);
  const unique = [...new Set(words.filter(w => !STOPWORDS.has(w)))];
  return unique;
}

// Read markdown file, strip frontmatter and HTML-like tags
function readMd(relPath) {
  const full = path.join(V5_DOCS, relPath);
  if (!fs.existsSync(full)) return '';
  let text = fs.readFileSync(full, 'utf8');
  // Strip frontmatter
  text = text.replace(/^---[\s\S]*?---\n?/, '');
  // Strip badge/blockquote HTML-like components
  text = text.replace(/<Badges>[\s\S]*?<\/Badges>/g, '');
  text = text.replace(/<BlockQuote[^>]*>[\s\S]*?<\/BlockQuote>/g, '');
  return text.trim();
}

// Truncate content to roughly maxChars (keep it searchable but manageable)
function truncate(text, maxChars = 4000) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[... content truncated for knowledge base ...]';
}

// ============================================================
// 1. DOCUMENTATION ENTRIES (knowledge-base/docs/)
// ============================================================
function buildDocs() {
  const entries = [];
  let idCounter = 1;

  function addEntry(title, content, category, tags = [], sourcePath) {
    const trimmed = truncate(content);
    entries.push({
      id: `v5-doc-${String(idCounter++).padStart(3, '0')}`,
      title,
      content: trimmed,
      version: 'v5',
      tokens: tokenize(title + ' ' + trimmed),
      category,
      source: { path: sourcePath },
      tags,
    });
  }

  // --- Core Concepts ---
  addEntry('FeathersJS Application', readMd('api/application.md'), 'core-concepts',
    ['application', 'app', 'setup', 'configure', 'listen'], 'api/application.md');
  addEntry('FeathersJS Configuration', readMd('api/configuration.md'), 'core-concepts',
    ['configuration', 'node-config', 'environment'], 'api/configuration.md');
  addEntry('FeathersJS Events', readMd('api/events.md'), 'core-concepts',
    ['events', 'eventemitter', 'real-time', 'created', 'updated', 'patched', 'removed'], 'api/events.md');
  addEntry('FeathersJS Errors', readMd('api/errors.md'), 'core-concepts',
    ['errors', 'badrequest', 'notfound', 'notauthenticated', 'featherserror'], 'api/errors.md');
  addEntry('FeathersJS Channels', readMd('api/channels.md'), 'core-concepts',
    ['channels', 'real-time', 'publishing', 'connections'], 'api/channels.md');
  addEntry('Express Integration', readMd('api/express.md'), 'core-concepts',
    ['express', 'rest', 'http', 'middleware'], 'api/express.md');
  addEntry('Koa Integration', readMd('api/koa.md'), 'core-concepts',
    ['koa', 'rest', 'http', 'middleware'], 'api/koa.md');
  addEntry('Socket.io Transport', readMd('api/socketio.md'), 'core-concepts',
    ['socketio', 'websocket', 'real-time', 'transport'], 'api/socketio.md');
  addEntry('Feathers Client', readMd('api/client.md'), 'core-concepts',
    ['client', 'browser', 'react-native', 'node'], 'api/client.md');
  addEntry('Client REST Transport', readMd('api/client/rest.md'), 'core-concepts',
    ['client', 'rest', 'fetch', 'axios'], 'api/client/rest.md');
  addEntry('Client Socket.io Transport', readMd('api/client/socketio.md'), 'core-concepts',
    ['client', 'socketio', 'websocket'], 'api/client/socketio.md');

  // --- Services ---
  addEntry('Services Overview', readMd('api/services.md'), 'services',
    ['services', 'crud', 'find', 'get', 'create', 'update', 'patch', 'remove'], 'api/services.md');

  // Split services into sub-entries for better searchability
  const servicesMd = readMd('api/services.md');
  const svcSections = servicesMd.split(/^## /m).filter(s => s.trim());
  for (const section of svcSections) {
    const titleMatch = section.match(/^(.+?)$/m);
    if (!titleMatch) continue;
    const sectionTitle = titleMatch[1].trim();
    if (['Service methods', 'Custom Methods', 'Feathers functionality'].includes(sectionTitle)) {
      addEntry(`Services: ${sectionTitle}`, truncate(section), 'services',
        ['services', ...tokenize(sectionTitle).slice(0, 5)], 'api/services.md');
    }
  }

  // Additional granular service entries from subsections
  const svcMethodSections = servicesMd.split(/^### /m).filter(s => s.trim());
  for (const section of svcMethodSections) {
    const titleMatch = section.match(/^(.+?)$/m);
    if (!titleMatch) continue;
    const name = titleMatch[1].trim();
    if (['.find(params)', '.get(id, params)', '.create(data, params)', '.update(id, data, params)',
         '.patch(id, data, params)', '.remove(id, params)'].includes(name)) {
      addEntry(`Services: ${name}`, truncate(section, 2000), 'services',
        ['services', 'method', ...tokenize(name).slice(0, 3)], 'api/services.md');
    }
  }

  // --- Hooks ---
  addEntry('Hooks Overview', readMd('api/hooks.md'), 'hooks',
    ['hooks', 'before', 'after', 'around', 'error', 'middleware'], 'api/hooks.md');

  const hooksMd = readMd('api/hooks.md');
  const hookSections = hooksMd.split(/^## /m).filter(s => s.trim());
  for (const section of hookSections) {
    const titleMatch = section.match(/^(.+?)$/m);
    if (!titleMatch) continue;
    const sectionTitle = titleMatch[1].trim();
    if (['Hook functions', 'Hook flow', 'Hook context', 'Registering hooks', 'Application hooks'].includes(sectionTitle)) {
      addEntry(`Hooks: ${sectionTitle}`, truncate(section), 'hooks',
        ['hooks', ...tokenize(sectionTitle).slice(0, 5)], 'api/hooks.md');
    }
  }

  // Additional granular hook entries for important subsections
  const hookSubSections = hooksMd.split(/^### /m).filter(s => s.trim());
  for (const section of hookSubSections) {
    const titleMatch = section.match(/^(.+?)$/m);
    if (!titleMatch) continue;
    const name = titleMatch[1].trim();
    if (['before, after and error', 'around', '`context.result`', '`context.data`'].includes(name)) {
      addEntry(`Hooks: ${name}`, truncate(section, 2000), 'hooks',
        ['hooks', ...tokenize(name).slice(0, 5)], 'api/hooks.md');
    }
  }

  // --- Authentication ---
  addEntry('Authentication Overview', readMd('api/authentication/index.md'), 'authentication',
    ['authentication', 'auth', 'strategies'], 'api/authentication/index.md');
  addEntry('Authentication Service', readMd('api/authentication/service.md'), 'authentication',
    ['authentication', 'service', 'jwt', 'create', 'accesstoken'], 'api/authentication/service.md');
  addEntry('JWT Strategy', readMd('api/authentication/jwt.md'), 'authentication',
    ['jwt', 'jsonwebtoken', 'strategy', 'bearer', 'token'], 'api/authentication/jwt.md');
  addEntry('Local Strategy', readMd('api/authentication/local.md'), 'authentication',
    ['local', 'password', 'username', 'bcrypt', 'strategy'], 'api/authentication/local.md');
  addEntry('OAuth Strategy', readMd('api/authentication/oauth.md'), 'authentication',
    ['oauth', 'google', 'github', 'facebook', 'strategy', 'social'], 'api/authentication/oauth.md');
  addEntry('Authentication Hook', readMd('api/authentication/hook.md'), 'authentication',
    ['authenticate', 'hook', 'protect', 'authorization'], 'api/authentication/hook.md');
  addEntry('Authentication Client', readMd('api/authentication/client.md'), 'authentication',
    ['authentication', 'client', 'login', 'logout', 'reAuthenticate'], 'api/authentication/client.md');
  addEntry('Authentication Base Strategy', readMd('api/authentication/strategy.md'), 'authentication',
    ['strategy', 'base', 'custom', 'authenticate', 'parse'], 'api/authentication/strategy.md');

  // Cookbook auth entries
  const cookbookAuthFiles = [
    ['Anonymous Authentication', 'cookbook/authentication/anonymous.md', ['anonymous', 'guest']],
    ['API Key Authentication', 'cookbook/authentication/apiKey.md', ['apikey', 'header', 'custom']],
    ['Auth0 Integration', 'cookbook/authentication/auth0.md', ['auth0', 'oauth']],
    ['Google OAuth', 'cookbook/authentication/google.md', ['google', 'oauth', 'social']],
    ['Facebook OAuth', 'cookbook/authentication/facebook.md', ['facebook', 'oauth', 'social']],
    ['Firebase Authentication', 'cookbook/authentication/firebase.md', ['firebase', 'custom']],
    ['Revoking JWTs', 'cookbook/authentication/revoke-jwt.md', ['jwt', 'revoke', 'blacklist']],
    ['Stateless Authentication', 'cookbook/authentication/stateless.md', ['stateless', 'jwt', 'entity']],
  ];
  for (const [title, file, tags] of cookbookAuthFiles) {
    const content = readMd(file);
    if (content.length > 50) {
      addEntry(title, content, 'authentication', ['cookbook', ...tags], file);
    }
  }

  // --- Databases ---
  addEntry('Database Adapters Overview', readMd('api/databases/adapters.md'), 'databases',
    ['database', 'adapters', 'knex', 'mongodb', 'memory'], 'api/databases/adapters.md');
  addEntry('Common Database API', readMd('api/databases/common.md'), 'databases',
    ['database', 'common', 'pagination', 'multi', 'params', 'find', 'get', 'create', 'patch', 'remove'], 'api/databases/common.md');
  addEntry('Knex (SQL) Adapter', readMd('api/databases/knex.md'), 'databases',
    ['knex', 'sql', 'postgresql', 'mysql', 'sqlite', 'transactions'], 'api/databases/knex.md');
  addEntry('MongoDB Adapter', readMd('api/databases/mongodb.md'), 'databases',
    ['mongodb', 'nosql', 'aggregation', 'objectid', 'pipeline'], 'api/databases/mongodb.md');
  addEntry('Memory Adapter', readMd('api/databases/memory.md'), 'databases',
    ['memory', 'inmemory', 'testing', 'prototype'], 'api/databases/memory.md');
  addEntry('Query Syntax', readMd('api/databases/querying.md'), 'databases',
    ['query', 'filter', 'sort', 'limit', 'skip', 'select', 'operators', '$gt', '$lt', '$in'], 'api/databases/querying.md');

  // Additional granular database entries from common.md subsections
  const commonDbMd = readMd('api/databases/common.md');
  const commonDbSections = commonDbMd.split(/^## /m).filter(s => s.trim());
  for (const section of commonDbSections) {
    const titleMatch = section.match(/^(.+?)$/m);
    if (!titleMatch) continue;
    const sectionTitle = titleMatch[1].trim();
    if (['Pagination', 'Extending Adapters', 'params.adapter', 'Querying'].includes(sectionTitle)
      || sectionTitle.includes('Multi') || sectionTitle.includes('Options')) {
      addEntry(`Databases: ${sectionTitle}`, truncate(section, 2000), 'databases',
        ['database', ...tokenize(sectionTitle).slice(0, 5)], 'api/databases/common.md');
    }
  }

  // Granular query operator entries
  const queryMd = readMd('api/databases/querying.md');
  const querySections = queryMd.split(/^## /m).filter(s => s.trim());
  for (const section of querySections) {
    const titleMatch = section.match(/^(.+?)$/m);
    if (!titleMatch) continue;
    const name = titleMatch[1].trim();
    addEntry(`Query: ${name}`, truncate(section, 2000), 'databases',
      ['query', ...tokenize(name).slice(0, 5)], 'api/databases/querying.md');
  }

  // --- Schema / Validation ---
  addEntry('Schema & Resolvers Overview', readMd('api/schema/index.md'), 'core-concepts',
    ['schema', 'resolvers', 'validation', 'typebox', 'json-schema'], 'api/schema/index.md');
  addEntry('Schema Definition', readMd('api/schema/schema.md'), 'core-concepts',
    ['schema', 'json-schema', 'definition', 'types'], 'api/schema/schema.md');
  addEntry('TypeBox Schema', readMd('api/schema/typebox.md'), 'core-concepts',
    ['typebox', 'type', 'static', 'querysyntax', 'json-schema'], 'api/schema/typebox.md');
  addEntry('Resolvers', readMd('api/schema/resolvers.md'), 'core-concepts',
    ['resolvers', 'resolve', 'resolvedata', 'resolveresult', 'resolveexternal', 'resolvequery', 'virtual'], 'api/schema/resolvers.md');
  addEntry('Validators', readMd('api/schema/validators.md'), 'core-concepts',
    ['validators', 'ajv', 'validation', 'validatedata', 'validatequery', 'coerce'], 'api/schema/validators.md');

  // --- Guides ---
  const guideFiles = [
    ['Getting Started', 'guides/basics/starting.md', 'guides', ['getting-started', 'quickstart', 'setup']],
    ['Services Guide', 'guides/basics/services.md', 'guides', ['services', 'guide', 'tutorial']],
    ['Hooks Guide', 'guides/basics/hooks.md', 'guides', ['hooks', 'guide', 'tutorial']],
    ['Schemas Guide', 'guides/basics/schemas.md', 'guides', ['schemas', 'validation', 'guide']],
    ['Authentication Guide', 'guides/basics/authentication.md', 'guides', ['authentication', 'guide', 'tutorial']],
    ['Testing Guide', 'guides/basics/testing.md', 'guides', ['testing', 'jest', 'guide']],
    ['Generator Guide', 'guides/basics/generator.md', 'guides', ['generator', 'cli', 'scaffold']],
    ['Security Best Practices', 'guides/security.md', 'guides', ['security', 'xss', 'csrf', 'helmet']],
    ['What\'s New in v5', 'guides/whats-new.md', 'guides', ['v5', 'new-features', 'migration']],
    ['Migrating to v5', 'guides/migrating.md', 'guides', ['migration', 'upgrade', 'v5']],
    ['Frameworks (Express/Koa)', 'guides/frameworks.md', 'guides', ['express', 'koa', 'framework']],
    ['Frontend Integration', 'guides/frontend/javascript.md', 'guides', ['frontend', 'javascript', 'client']],
    ['CLI Generated Files', 'guides/cli/index.md', 'guides', ['cli', 'generator', 'files']],
  ];
  for (const [title, file, cat, tags] of guideFiles) {
    const content = readMd(file);
    if (content.length > 50) {
      addEntry(title, content, cat, tags, file);
    }
  }

  // --- Cookbook ---
  const cookbookFiles = [
    ['Docker Deployment', 'cookbook/deploy/docker.md', 'cookbook', ['docker', 'deployment', 'container']],
    ['File Uploading', 'cookbook/express/file-uploading.md', 'cookbook', ['upload', 'files', 'multer', 'express']],
    ['View Engine', 'cookbook/express/view-engine.md', 'cookbook', ['view', 'template', 'ejs', 'express']],
    ['Client Testing', 'cookbook/general/client-test.md', 'cookbook', ['testing', 'client', 'mock']],
    ['Scaling', 'cookbook/general/scaling.md', 'cookbook', ['scaling', 'cluster', 'redis', 'performance']],
  ];
  for (const [title, file, cat, tags] of cookbookFiles) {
    const content = readMd(file);
    if (content.length > 50) {
      addEntry(title, content, cat, tags, file);
    }
  }

  // Split by category files
  const categories = {};
  for (const entry of entries) {
    const cat = entry.category;
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(entry);
  }

  // Write category-based files
  for (const [cat, catEntries] of Object.entries(categories)) {
    const fileName = cat + '.json';
    const filePath = path.join(KB_DIR, 'docs', fileName);
    fs.writeFileSync(filePath, JSON.stringify(catEntries, null, 2));
    console.log(`  docs/${fileName}: ${catEntries.length} entries`);
  }

  return entries.length;
}

// ============================================================
// 2. TEMPLATE FRAGMENTS (knowledge-base/templates/)
// ============================================================
function buildTemplates() {
  const templates = [];

  function addTemplate(id, name, code, imports, deps, featureFlags, desc, tags = []) {
    templates.push({
      id,
      name,
      code,
      imports: imports || [],
      dependencies: deps || [],
      featureFlags: featureFlags || [],
      version: 'v5',
      description: desc,
      language: 'typescript',
      tags,
    });
  }

  // Base project template
  addTemplate('tpl-base-project', 'Base Feathers v5 Application',
`import { feathers } from '@feathersjs/feathers'
import configuration from '@feathersjs/configuration'
import { koa, rest, bodyParser, errorHandler, cors } from '@feathersjs/koa'
import socketio from '@feathersjs/socketio'

import type { Application } from './declarations'

const app: Application = koa(feathers())

app.configure(configuration())
app.use(cors())
app.use(errorHandler())
app.use(bodyParser())
app.configure(rest())
app.configure(socketio())

export { app }`,
    ['@feathersjs/feathers', '@feathersjs/configuration', '@feathersjs/koa', '@feathersjs/socketio'],
    ['@feathersjs/feathers', '@feathersjs/configuration', '@feathersjs/koa', '@feathersjs/socketio'],
    [],
    'Base FeathersJS v5 application setup with Koa, REST, and Socket.io',
    ['project', 'setup', 'koa']);

  // Express base project
  addTemplate('tpl-base-express', 'Base Feathers v5 Application (Express)',
`import { feathers } from '@feathersjs/feathers'
import configuration from '@feathersjs/configuration'
import express, { rest, json, urlencoded, errorHandler } from '@feathersjs/express'
import socketio from '@feathersjs/socketio'

import type { Application } from './declarations'

const app: Application = express(feathers())

app.configure(configuration())
app.use(json())
app.use(urlencoded({ extended: true }))
app.configure(rest())
app.configure(socketio())
app.use(errorHandler())

export { app }`,
    ['@feathersjs/feathers', '@feathersjs/configuration', '@feathersjs/express', '@feathersjs/socketio'],
    ['@feathersjs/feathers', '@feathersjs/configuration', '@feathersjs/express', '@feathersjs/socketio'],
    ['express'],
    'Base FeathersJS v5 application setup with Express, REST, and Socket.io',
    ['project', 'setup', 'express']);

  // Service template
  addTemplate('tpl-service-class', 'Custom Service Class',
`import type { Id, NullableId, Params } from '@feathersjs/feathers'
import type { Application } from '../../declarations'

export class MyService {
  app: Application

  constructor(app: Application) {
    this.app = app
  }

  async find(params: Params) {
    return []
  }

  async get(id: Id, params: Params) {
    return { id }
  }

  async create(data: any, params: Params) {
    return data
  }

  async patch(id: NullableId, data: any, params: Params) {
    return { id, ...data }
  }

  async remove(id: NullableId, params: Params) {
    return { id }
  }
}`,
    ['@feathersjs/feathers'],
    ['@feathersjs/feathers'],
    [],
    'Custom Feathers v5 service class with CRUD methods',
    ['service', 'class', 'crud']);

  // MongoDB service
  addTemplate('tpl-mongodb-service', 'MongoDB Service',
`import { MongoDBService } from '@feathersjs/mongodb'
import type { MongoDBAdapterParams } from '@feathersjs/mongodb'
import type { Application } from '../../declarations'

type MessageData = { text: string; createdAt: number }
type MessageParams = MongoDBAdapterParams<{}>

export class MessageService extends MongoDBService<MessageData, MessageData, MessageParams> {}

export const messageService = (app: Application) => {
  const options = {
    paginate: app.get('paginate'),
    Model: app.get('mongodbClient').then((db: any) => db.collection('messages'))
  }
  app.use('messages', new MessageService(options))
}`,
    ['@feathersjs/mongodb'],
    ['@feathersjs/mongodb', 'mongodb'],
    ['mongodb'],
    'MongoDB database service using @feathersjs/mongodb adapter',
    ['service', 'mongodb', 'database']);

  // Knex/PostgreSQL service
  addTemplate('tpl-knex-postgresql', 'PostgreSQL Service (Knex)',
`import { KnexService } from '@feathersjs/knex'
import type { KnexAdapterParams } from '@feathersjs/knex'
import type { Application } from '../../declarations'

type MessageData = { text: string; createdAt: number }
type MessageParams = KnexAdapterParams<{}>

export class MessageService extends KnexService<MessageData, MessageData, MessageParams> {}

export const messageService = (app: Application) => {
  const options = {
    paginate: app.get('paginate'),
    Model: app.get('postgresqlClient'),
    name: 'messages'
  }
  app.use('messages', new MessageService(options))
}`,
    ['@feathersjs/knex'],
    ['@feathersjs/knex', 'knex', 'pg'],
    ['postgresql'],
    'PostgreSQL database service using @feathersjs/knex adapter',
    ['service', 'knex', 'postgresql', 'sql']);

  // SQLite service
  addTemplate('tpl-knex-sqlite', 'SQLite Service (Knex)',
`import { KnexService } from '@feathersjs/knex'
import type { KnexAdapterParams } from '@feathersjs/knex'
import type { Application } from '../../declarations'

type MessageData = { text: string; createdAt: number }
type MessageParams = KnexAdapterParams<{}>

export class MessageService extends KnexService<MessageData, MessageData, MessageParams> {}

export const messageService = (app: Application) => {
  const options = {
    paginate: app.get('paginate'),
    Model: app.get('sqliteClient'),
    name: 'messages'
  }
  app.use('messages', new MessageService(options))
}`,
    ['@feathersjs/knex'],
    ['@feathersjs/knex', 'knex', 'better-sqlite3'],
    ['sqlite'],
    'SQLite database service using @feathersjs/knex adapter',
    ['service', 'knex', 'sqlite', 'sql']);

  // Authentication setup
  addTemplate('tpl-authentication', 'Authentication Setup',
`import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication'
import { LocalStrategy } from '@feathersjs/authentication-local'
import type { Application } from './declarations'

export const authentication = (app: Application) => {
  const authentication = new AuthenticationService(app)

  authentication.register('jwt', new JWTStrategy())
  authentication.register('local', new LocalStrategy())

  app.use('authentication', authentication)
}`,
    ['@feathersjs/authentication', '@feathersjs/authentication-local'],
    ['@feathersjs/authentication', '@feathersjs/authentication-local'],
    ['authentication'],
    'JWT + Local authentication setup for FeathersJS v5',
    ['authentication', 'jwt', 'local']);

  // OAuth authentication
  addTemplate('tpl-oauth', 'OAuth Authentication',
`import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication'
import { LocalStrategy } from '@feathersjs/authentication-local'
import { OAuthStrategy, oauth } from '@feathersjs/authentication-oauth'
import type { Application } from './declarations'

export const authentication = (app: Application) => {
  const authentication = new AuthenticationService(app)

  authentication.register('jwt', new JWTStrategy())
  authentication.register('local', new LocalStrategy())
  authentication.register('google', new OAuthStrategy())
  authentication.register('github', new OAuthStrategy())

  app.use('authentication', authentication)
  app.configure(oauth())
}`,
    ['@feathersjs/authentication', '@feathersjs/authentication-local', '@feathersjs/authentication-oauth'],
    ['@feathersjs/authentication', '@feathersjs/authentication-local', '@feathersjs/authentication-oauth'],
    ['authentication', 'oauth'],
    'JWT + Local + OAuth (Google/GitHub) authentication setup',
    ['authentication', 'jwt', 'local', 'oauth', 'google', 'github']);

  // Schema + Resolvers
  addTemplate('tpl-schema-resolvers', 'TypeBox Schema with Resolvers',
`import { resolve, virtual } from '@feathersjs/schema'
import { Type, getValidator, querySyntax } from '@feathersjs/typebox'
import type { Static } from '@feathersjs/typebox'
import type { HookContext } from '../../declarations'
import { dataValidator, queryValidator } from '../../validators'

export const messageSchema = Type.Object(
  {
    id: Type.Number(),
    text: Type.String(),
    createdAt: Type.Number(),
    userId: Type.Number(),
    user: Type.Optional(Type.Object({ id: Type.Number(), email: Type.String() }))
  },
  { $id: 'Message', additionalProperties: false }
)
export type Message = Static<typeof messageSchema>

export const messageDataSchema = Type.Pick(messageSchema, ['text'], {
  $id: 'MessageData',
  additionalProperties: false
})
export type MessageData = Static<typeof messageDataSchema>

export const messageQuerySchema = Type.Intersect([
  querySyntax(Type.Pick(messageSchema, ['id', 'text', 'createdAt', 'userId'])),
], { additionalProperties: false })
export type MessageQuery = Static<typeof messageQuerySchema>

export const messageDataValidator = getValidator(messageDataSchema, dataValidator)
export const messageQueryValidator = getValidator(messageQuerySchema, queryValidator)

export const messageDataResolver = resolve<Message, HookContext>({
  userId: async (value, message, context) => context.params?.user?.id,
  createdAt: async () => Date.now()
})

export const messageResultResolver = resolve<Message, HookContext>({
  user: virtual(async (message, context) => {
    return context.app.service('users').get(message.userId)
  })
})

export const messageExternalResolver = resolve<Message, HookContext>({})

export const messageQueryResolver = resolve<MessageQuery, HookContext>({
  userId: async (value, query, context) => {
    if (context.params?.user) return context.params.user.id
    return value
  }
})`,
    ['@feathersjs/schema', '@feathersjs/typebox'],
    ['@feathersjs/schema', '@feathersjs/typebox'],
    ['schema', 'resolvers'],
    'TypeBox schema definition with data, result, external, and query resolvers',
    ['schema', 'typebox', 'resolvers', 'validation']);

  // Channels
  addTemplate('tpl-channels', 'Real-time Channels',
`import type { RealTimeConnection, Params } from '@feathersjs/feathers'
import type { Application, HookContext } from './declarations'

export const channels = (app: Application) => {
  if (typeof app.channel !== 'function') return

  app.on('connection', (connection: RealTimeConnection) => {
    app.channel('anonymous').join(connection)
  })

  app.on('login', (authResult: any, { connection }: Params) => {
    if (connection) {
      app.channel('anonymous').leave(connection)
      app.channel('authenticated').join(connection)
    }
  })

  app.publish((data: any, context: HookContext) => {
    return app.channel('authenticated')
  })
}`,
    ['@feathersjs/feathers'],
    ['@feathersjs/feathers'],
    ['channels', 'real-time'],
    'Real-time channel configuration for authenticated/anonymous users',
    ['channels', 'real-time', 'websocket']);

  // Write files
  // base-project.json: project templates
  const projectTemplates = templates.filter(t =>
    t.id.includes('base') || t.id.includes('auth') || t.id.includes('oauth') || t.id.includes('channels'));
  const serviceTemplates = templates.filter(t =>
    t.id.includes('service') || t.id.includes('mongodb') || t.id.includes('knex') || t.id.includes('sqlite'));
  const schemaTemplates = templates.filter(t =>
    t.id.includes('schema'));

  fs.writeFileSync(path.join(KB_DIR, 'templates', 'base-project.json'), JSON.stringify(projectTemplates, null, 2));
  fs.writeFileSync(path.join(KB_DIR, 'templates', 'service.json'), JSON.stringify(serviceTemplates, null, 2));
  fs.writeFileSync(path.join(KB_DIR, 'templates', 'authentication.json'),
    JSON.stringify(templates.filter(t => t.tags.includes('authentication')), null, 2));
  fs.writeFileSync(path.join(KB_DIR, 'templates', 'mongodb.json'),
    JSON.stringify(templates.filter(t => t.tags.includes('mongodb')), null, 2));
  fs.writeFileSync(path.join(KB_DIR, 'templates', 'postgresql.json'),
    JSON.stringify(templates.filter(t => t.tags.includes('postgresql')), null, 2));
  fs.writeFileSync(path.join(KB_DIR, 'templates', 'sqlite.json'),
    JSON.stringify(templates.filter(t => t.tags.includes('sqlite')), null, 2));

  console.log(`  templates/: ${templates.length} fragments across 6 files`);
  return templates.length;
}

// ============================================================
// 3. CODE SNIPPETS (knowledge-base/snippets/)
// ============================================================
function buildSnippets() {
  const snippets = [];
  let idCounter = 1;

  function addSnippet(type, useCase, code, explanation, tags = []) {
    snippets.push({
      id: `snp-${String(idCounter++).padStart(3, '0')}`,
      type,
      useCase,
      code,
      explanation,
      version: 'v5',
      language: 'typescript',
      tags,
    });
  }

  // Before hooks
  addSnippet('before', 'Validate data before create',
`app.service('messages').hooks({
  before: {
    create: [
      async (context: HookContext) => {
        if (!context.data.text || context.data.text.trim() === '') {
          throw new BadRequest('Message text cannot be empty')
        }
      }
    ]
  }
})`,
    'Validates that message text is not empty before creating. Throws BadRequest error if validation fails.',
    ['validation', 'create', 'error']);

  addSnippet('before', 'Set createdAt timestamp',
`app.service('messages').hooks({
  before: {
    create: [
      async (context: HookContext) => {
        context.data = {
          ...context.data,
          createdAt: Date.now()
        }
      }
    ]
  }
})`,
    'Adds createdAt timestamp to data before creating a new record.',
    ['timestamp', 'create', 'data']);

  addSnippet('before', 'Restrict to authenticated users',
`import { authenticate } from '@feathersjs/authentication'

app.service('messages').hooks({
  before: {
    all: [authenticate('jwt')]
  }
})`,
    'Requires JWT authentication for all methods on the service. Uses the authenticate hook from @feathersjs/authentication.',
    ['authentication', 'jwt', 'protect']);

  addSnippet('before', 'Set owner on create',
`app.service('messages').hooks({
  before: {
    create: [
      async (context: HookContext) => {
        const { user } = context.params
        if (!user) throw new NotAuthenticated('Not authenticated')
        context.data.userId = user.id
      }
    ]
  }
})`,
    'Sets the userId field to the authenticated user ID before creating a record. Ensures data ownership.',
    ['authorization', 'owner', 'userId']);

  addSnippet('before', 'Limit query results',
`app.service('messages').hooks({
  before: {
    find: [
      async (context: HookContext) => {
        context.params.query = {
          ...context.params.query,
          $limit: Math.min(context.params.query?.$limit || 25, 100)
        }
      }
    ]
  }
})`,
    'Limits the maximum number of results to 100, defaulting to 25. Prevents large query result sets.',
    ['pagination', 'limit', 'query', 'performance']);

  // After hooks
  addSnippet('after', 'Remove sensitive fields from response',
`app.service('users').hooks({
  after: {
    all: [
      async (context: HookContext) => {
        const removePassword = (user: any) => {
          const { password, ...rest } = user
          return rest
        }
        if (Array.isArray(context.result)) {
          context.result = context.result.map(removePassword)
        } else if (context.result.data) {
          context.result.data = context.result.data.map(removePassword)
        } else {
          context.result = removePassword(context.result)
        }
      }
    ]
  }
})`,
    'Removes password field from user data in responses. Handles both single and paginated results. Prefer resolveExternal for this in v5.',
    ['security', 'password', 'sanitize']);

  addSnippet('after', 'Populate associated data',
`import { resolve, virtual } from '@feathersjs/schema'

export const messageResultResolver = resolve<Message, HookContext>({
  user: virtual(async (message, context) => {
    return context.app.service('users').get(message.userId)
  })
})

// Register as around hook
app.service('messages').hooks({
  around: {
    all: [resolveResult(messageResultResolver)]
  }
})`,
    'Populates the user field on message results using a virtual resolver. This is the v5 recommended pattern for associations.',
    ['resolver', 'populate', 'association', 'virtual']);

  addSnippet('after', 'Log service method calls',
`app.hooks({
  after: {
    all: [
      async (context: HookContext) => {
        console.log(\`\${context.method} on \${context.path} completed\`)
      }
    ]
  }
})`,
    'Application-level hook that logs all successful service method calls.',
    ['logging', 'debug', 'application']);

  // Around hooks
  addSnippet('around', 'Measure method execution time',
`app.service('messages').hooks({
  around: {
    all: [
      async (context: HookContext, next: NextFunction) => {
        const startTime = Date.now()
        await next()
        const duration = Date.now() - startTime
        console.log(\`\${context.method} on \${context.path} took \${duration}ms\`)
      }
    ]
  }
})`,
    'Around hook that wraps a service method to measure and log execution time.',
    ['performance', 'timing', 'logging', 'monitoring']);

  addSnippet('around', 'Transaction wrapper for Knex',
`import { transaction } from '@feathersjs/knex'

app.service('orders').hooks({
  around: {
    create: [transaction.start(), transaction.end()],
  },
  error: {
    create: [transaction.rollback()],
  }
})`,
    'Wraps the create method in a Knex database transaction. Automatically commits on success and rolls back on error.',
    ['transaction', 'knex', 'sql', 'database']);

  addSnippet('around', 'Soft delete pattern',
`app.service('messages').hooks({
  around: {
    remove: [
      async (context: HookContext, next: NextFunction) => {
        // Instead of deleting, patch with deletedAt
        context.result = await context.service.patch(context.id, {
          deletedAt: Date.now()
        })
        // Skip the actual remove by not calling next()
      }
    ],
    find: [
      async (context: HookContext, next: NextFunction) => {
        // Filter out soft-deleted records
        context.params.query = {
          ...context.params.query,
          deletedAt: null
        }
        await next()
      }
    ]
  }
})`,
    'Implements soft delete by patching a deletedAt field instead of actually removing records. Filters soft-deleted records from find queries.',
    ['soft-delete', 'remove', 'pattern']);

  // Error hooks
  addSnippet('error', 'Global error handler',
`app.hooks({
  error: {
    all: [
      async (context: HookContext) => {
        console.error(\`Error in '\${context.path}' service method '\${context.method}'\`, context.error.stack)
        // Don't expose internal errors to clients
        if (!context.error.code) {
          context.error = new GeneralError('An internal error occurred')
        }
      }
    ]
  }
})`,
    'Application-level error hook that logs errors and sanitizes internal errors before sending to clients.',
    ['error-handling', 'logging', 'security']);

  addSnippet('error', 'Handle not found errors',
`app.service('messages').hooks({
  error: {
    get: [
      async (context: HookContext) => {
        if (context.error.code === 404) {
          context.error = new NotFound(\`Message \${context.id} not found\`)
        }
      }
    ]
  }
})`,
    'Customizes the NotFound error message for a specific service.',
    ['error-handling', 'notfound', '404']);

  // Service snippets
  addSnippet('service', 'Custom method service',
`class PaymentService {
  async create(data: any, params: Params) {
    return this.processPayment(data)
  }

  async refund(data: { paymentId: string }, params: Params) {
    return this.processRefund(data.paymentId)
  }

  private async processPayment(data: any) { /* ... */ }
  private async processRefund(id: string) { /* ... */ }
}

app.use('payments', new PaymentService(), {
  methods: ['create', 'refund']
})`,
    'Registers a service with a custom method (refund). Custom methods must be listed in the methods option.',
    ['custom-method', 'service', 'registration']);

  addSnippet('service', 'Service with setup/teardown',
`class DatabaseService {
  connection: any = null

  async setup(app: Application, path: string) {
    this.connection = await createDatabaseConnection(app.get('dbUrl'))
    console.log(\`Service \${path} connected to database\`)
  }

  async teardown(app: Application, path: string) {
    if (this.connection) {
      await this.connection.close()
      console.log(\`Service \${path} disconnected from database\`)
    }
  }

  async find(params: Params) {
    return this.connection.query('SELECT * FROM items')
  }
}`,
    'Service with setup (initialize on app start) and teardown (cleanup on shutdown) lifecycle methods.',
    ['lifecycle', 'setup', 'teardown', 'database']);

  // Channel snippets
  addSnippet('channels', 'Room-based channel pattern',
`app.service('messages').publish('created', (data: Message, context: HookContext) => {
  return app.channel(\`room/\${data.roomId}\`)
})

// Join room when user connects
app.on('login', (authResult: any, { connection }: Params) => {
  if (connection) {
    const user = authResult.user
    user.rooms.forEach((roomId: string) => {
      app.channel(\`room/\${roomId}\`).join(connection)
    })
  }
})`,
    'Room-based real-time messaging pattern using channels. Users join room channels on login; messages are published to the specific room channel.',
    ['channels', 'rooms', 'real-time', 'publish']);

  addSnippet('channels', 'User-specific events',
`app.service('notifications').publish((data: any, context: HookContext) => {
  return app.channel(app.channels).filter(connection =>
    connection.user?.id === data.userId
  )
})`,
    'Publishes events only to the specific user the notification belongs to, using channel filtering.',
    ['channels', 'filter', 'user-specific', 'notifications']);

  // Additional before hooks to reach minimums
  addSnippet('before', 'Sanitize HTML in input data',
`import sanitize from 'sanitize-html'

app.service('messages').hooks({
  before: {
    create: [
      async (context: HookContext) => {
        if (context.data.text) {
          context.data.text = sanitize(context.data.text)
        }
      }
    ]
  }
})`,
    'Sanitizes HTML from user input to prevent XSS attacks.',
    ['sanitize', 'xss', 'security']);

  addSnippet('before', 'Normalize email to lowercase',
`app.service('users').hooks({
  before: {
    create: [
      async (context: HookContext) => {
        if (context.data.email) {
          context.data.email = context.data.email.toLowerCase().trim()
        }
      }
    ]
  }
})`,
    'Normalizes email addresses to lowercase before creating user accounts.',
    ['email', 'normalize', 'create']);

  // Additional after hooks
  addSnippet('after', 'Add computed field to result',
`app.service('orders').hooks({
  after: {
    all: [
      async (context: HookContext) => {
        const addTotal = (order: any) => ({
          ...order,
          total: order.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0)
        })
        if (Array.isArray(context.result?.data)) {
          context.result.data = context.result.data.map(addTotal)
        } else if (context.result) {
          context.result = addTotal(context.result)
        }
      }
    ]
  }
})`,
    'Adds a computed total field to order results based on line items.',
    ['computed', 'transform', 'after']);

  addSnippet('after', 'Send notification after create',
`app.service('messages').hooks({
  after: {
    create: [
      async (context: HookContext) => {
        await context.app.service('notifications').create({
          type: 'new-message',
          userId: context.result.userId,
          message: \`New message: \${context.result.text.substring(0, 50)}\`
        })
      }
    ]
  }
})`,
    'Sends a notification to the relevant user after a new message is created.',
    ['notification', 'create', 'after']);

  addSnippet('after', 'Cache results after find',
`const cache = new Map<string, { data: any; expires: number }>()

app.service('config').hooks({
  after: {
    find: [
      async (context: HookContext) => {
        const key = JSON.stringify(context.params.query)
        cache.set(key, { data: context.result, expires: Date.now() + 60000 })
      }
    ]
  },
  before: {
    find: [
      async (context: HookContext) => {
        const key = JSON.stringify(context.params.query)
        const cached = cache.get(key)
        if (cached && cached.expires > Date.now()) {
          context.result = cached.data
        }
      }
    ]
  }
})`,
    'Simple in-memory cache for find results with 60-second TTL.',
    ['cache', 'performance', 'find']);

  // Additional error hooks
  addSnippet('error', 'Retry on database connection error',
`app.service('messages').hooks({
  error: {
    all: [
      async (context: HookContext) => {
        if (context.error.message?.includes('ECONNREFUSED') && !context.params._retried) {
          context.params._retried = true
          // Wait and retry once
          await new Promise(resolve => setTimeout(resolve, 1000))
          context.result = await context.service[context.method](...context.arguments)
          context.error = null
        }
      }
    ]
  }
})`,
    'Retries a service call once when a database connection error occurs.',
    ['error-handling', 'retry', 'database']);

  addSnippet('error', 'Map database errors to Feathers errors',
`import { BadRequest, Conflict, GeneralError } from '@feathersjs/errors'

app.hooks({
  error: {
    all: [
      async (context: HookContext) => {
        if (context.error.code === 'SQLITE_CONSTRAINT') {
          context.error = new Conflict('A record with that value already exists')
        } else if (context.error.code === '23505') {
          context.error = new Conflict('Duplicate key violation')
        } else if (context.error.code === '23502') {
          context.error = new BadRequest('Required field is missing')
        }
      }
    ]
  }
})`,
    'Maps low-level database constraint errors to proper Feathers error types.',
    ['error-handling', 'database', 'mapping']);

  addSnippet('error', 'Rate limit error response',
`app.hooks({
  error: {
    all: [
      async (context: HookContext) => {
        if (context.error.code === 429) {
          context.error.message = 'Too many requests. Please wait and try again.'
          context.error.data = {
            retryAfter: 60
          }
        }
      }
    ]
  }
})`,
    'Customizes rate limit error responses with retry-after information.',
    ['error-handling', 'rate-limit', '429']);

  addSnippet('error', 'Log errors to external service',
`app.hooks({
  error: {
    all: [
      async (context: HookContext) => {
        // Log to external error tracking
        if (context.error.code >= 500 || !context.error.code) {
          console.error({
            service: context.path,
            method: context.method,
            error: context.error.message,
            stack: context.error.stack,
            params: { provider: context.params.provider }
          })
        }
      }
    ]
  }
})`,
    'Logs server errors (5xx) to console/external service for monitoring. Skips client errors (4xx).',
    ['error-handling', 'logging', 'monitoring']);

  // Additional common/around hooks
  addSnippet('around', 'Cache with invalidation',
`const cache = new Map()

app.service('settings').hooks({
  around: {
    find: [async (context: HookContext, next: NextFunction) => {
      const key = 'settings:' + JSON.stringify(context.params.query || {})
      const cached = cache.get(key)
      if (cached) { context.result = cached; return }
      await next()
      cache.set(key, context.result)
    }],
    create: [async (context: HookContext, next: NextFunction) => {
      await next()
      cache.clear() // Invalidate on write
    }],
    patch: [async (context: HookContext, next: NextFunction) => {
      await next()
      cache.clear()
    }]
  }
})`,
    'Around hook implementing read-through cache with automatic invalidation on writes.',
    ['cache', 'performance', 'around']);

  addSnippet('around', 'Request context propagation',
`app.hooks({
  around: {
    all: [
      async (context: HookContext, next: NextFunction) => {
        // Add request ID for tracing
        context.params.requestId = context.params.requestId ||
          Math.random().toString(36).substring(2, 15)
        await next()
      }
    ]
  }
})`,
    'Adds a unique request ID to all service calls for distributed tracing.',
    ['tracing', 'context', 'around', 'monitoring']);

  // Additional service snippets
  addSnippet('service', 'External API wrapper service',
`class WeatherService {
  async find(params: Params) {
    const { city } = params.query || {}
    const response = await fetch(\`https://api.weather.com/v1/\${city}\`)
    if (!response.ok) throw new BadRequest('City not found')
    return response.json()
  }

  async get(id: Id, params: Params) {
    const response = await fetch(\`https://api.weather.com/v1/forecast/\${id}\`)
    return response.json()
  }
}

app.use('weather', new WeatherService(), {
  methods: ['find', 'get']
})`,
    'Custom service wrapping an external REST API. Only exposes find and get methods.',
    ['custom-service', 'api', 'external']);

  addSnippet('service', 'Service with events',
`class NotificationService {
  events = ['statusChanged']

  async create(data: any, params: Params) {
    const notification = { ...data, id: Date.now(), status: 'sent' }
    this.emit('statusChanged', notification)
    return notification
  }
}

// Listen for custom events
app.service('notifications').on('statusChanged', (data: any) => {
  console.log('Notification status changed:', data)
})`,
    'Service emitting custom events that can be listened to in real-time.',
    ['events', 'custom-service', 'real-time']);

  addSnippet('service', 'Audit logging service pattern',
`class AuditService {
  async create(data: any, params: Params) {
    return { ...data, id: Date.now(), timestamp: new Date().toISOString() }
  }
}

// Register as application hook to audit all service calls
app.hooks({
  after: {
    all: [async (context: HookContext) => {
      if (context.path !== 'audit-logs') {
        await context.app.service('audit-logs').create({
          service: context.path,
          method: context.method,
          userId: context.params.user?.id,
          data: context.method === 'remove' ? { id: context.id } : undefined
        })
      }
    }]
  }
})`,
    'Audit logging pattern that records all service operations using an application-level after hook.',
    ['audit', 'logging', 'pattern']);

  addSnippet('service', 'Multi-tenant service pattern',
`app.service('messages').hooks({
  before: {
    all: [
      async (context: HookContext) => {
        // Add tenant filter to all queries
        const tenantId = context.params.user?.tenantId
        if (!tenantId) throw new NotAuthenticated('No tenant')
        context.params.query = {
          ...context.params.query,
          tenantId
        }
      }
    ],
    create: [
      async (context: HookContext) => {
        // Set tenant on create
        context.data.tenantId = context.params.user.tenantId
      }
    ]
  }
})`,
    'Multi-tenant data isolation using hooks to automatically filter by tenant ID.',
    ['multi-tenant', 'pattern', 'isolation']);

  addSnippet('service', 'Batch processing service',
`class BatchService {
  async create(data: { items: any[] }, params: Params) {
    const results = []
    const errors = []
    for (const item of data.items) {
      try {
        const result = await this.app.service('items').create(item, params)
        results.push(result)
      } catch (error: any) {
        errors.push({ item, error: error.message })
      }
    }
    return { processed: results.length, failed: errors.length, errors }
  }
}`,
    'Batch processing service that creates multiple items with individual error handling.',
    ['batch', 'bulk', 'pattern']);

  addSnippet('service', 'File upload service pattern',
`import multer from 'multer'

class UploadService {
  async create(data: any, params: Params) {
    const file = params.file
    if (!file) throw new BadRequest('No file uploaded')
    return {
      id: Date.now(),
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      path: file.path
    }
  }
}

// Express middleware for file uploads
app.use('uploads',
  multer({ dest: 'uploads/' }).single('file'),
  new UploadService()
)`,
    'File upload service using multer middleware for handling multipart form data.',
    ['upload', 'file', 'multer', 'express']);

  // Write files in the structure expected by verification scripts
  // Step 33: hook snippets split into 4 files
  fs.writeFileSync(path.join(KB_DIR, 'snippets', 'hooks-before.json'), JSON.stringify(
    snippets.filter(s => s.type === 'before'), null, 2));
  fs.writeFileSync(path.join(KB_DIR, 'snippets', 'hooks-after.json'), JSON.stringify(
    snippets.filter(s => s.type === 'after'), null, 2));
  fs.writeFileSync(path.join(KB_DIR, 'snippets', 'hooks-error.json'), JSON.stringify(
    snippets.filter(s => s.type === 'error'), null, 2));
  fs.writeFileSync(path.join(KB_DIR, 'snippets', 'hooks-common.json'), JSON.stringify(
    snippets.filter(s => ['around', 'channels'].includes(s.type)), null, 2));

  // Step 34: service snippets split into 2 files
  const serviceSnippets = snippets.filter(s => s.type === 'service');
  const customSnippets = serviceSnippets.filter(s =>
    s.tags.some(t => ['custom-service', 'api', 'external', 'events', 'upload', 'lifecycle'].includes(t)));
  const patternSnippets = serviceSnippets.filter(s =>
    s.tags.some(t => ['pattern', 'audit', 'multi-tenant', 'batch', 'custom-method'].includes(t)));
  fs.writeFileSync(path.join(KB_DIR, 'snippets', 'services-custom.json'), JSON.stringify(customSnippets, null, 2));
  fs.writeFileSync(path.join(KB_DIR, 'snippets', 'services-patterns.json'), JSON.stringify(patternSnippets, null, 2));

  const hookSnippetCount = snippets.filter(s => ['before', 'after', 'around', 'error', 'channels'].includes(s.type)).length;
  const serviceSnippetCount = serviceSnippets.length;
  console.log(`  snippets/: ${snippets.length} code snippets (${hookSnippetCount} hook + ${serviceSnippetCount} service) across 6 files`);
  return snippets.length;
}

// ============================================================
// 4. ERROR PATTERNS (knowledge-base/errors/)
// ============================================================
function buildErrors() {
  const errors = [];
  let idCounter = 1;

  function addError(pattern, cause, solution, example, tags = [], category = 'runtime') {
    errors.push({
      id: `err-${String(idCounter++).padStart(3, '0')}`,
      pattern,
      cause,
      solution,
      example,
      version: 'v5',
      tags,
      category,
    });
  }

  // === AUTHENTICATION errors ===
  addError('NotAuthenticated: Not authenticated',
    'A service method was called without valid authentication credentials (no JWT or invalid JWT).',
    'Ensure the client sends a valid JWT token. Use `client.authenticate()` before making service calls. Check that the `authenticate` hook is registered correctly.',
    'await client.authenticate({ strategy: "local", email: "user@example.com", password: "secret" })',
    ['authentication', 'jwt', '401'], 'authentication');

  addError('Forbidden: You do not have the correct permissions',
    'The authenticated user does not have permission to perform this action.',
    'Check your authorization/permission hooks. Verify the user has the required role. Review the `abilityFor` or custom permission logic.',
    'app.service("admin").hooks({ before: { all: [authenticate("jwt"), authorize()] } })',
    ['authorization', 'permissions', '403'], 'authentication');

  addError('BadRequest: Password must be provided',
    'Local authentication strategy received a request without the password field.',
    'Ensure both email/username and password fields are sent. Check the field names match your authentication configuration.',
    'await client.authenticate({ strategy: "local", email: "user@example.com", password: "mysecret" })',
    ['authentication', 'local', 'password', '400'], 'authentication');

  addError('NotAuthenticated: jwt expired',
    'The JWT access token has expired.',
    'Re-authenticate to get a new token. Configure appropriate `expiresIn` in authentication config. Implement token refresh logic.',
    'try { await client.reAuthenticate() } catch(e) { await client.authenticate({ strategy: "local", ...credentials }) }',
    ['authentication', 'jwt', 'expired', '401'], 'authentication');

  addError('NotAuthenticated: invalid algorithm',
    'The JWT was signed with a different algorithm than expected.',
    'Ensure the JWT algorithm in authentication configuration matches between server and client. Default is HS256.',
    'Check config/default.json: authentication.jwtOptions.algorithm should be "HS256"',
    ['authentication', 'jwt', 'algorithm', '401'], 'authentication');

  addError('BadRequest: A "header" must be provided',
    'Socket.io or REST transport is missing required headers for authentication.',
    'Ensure authentication headers are set. For Socket.io, use `extraHeaders` option. For REST, include the Authorization header.',
    'const socket = io({ extraHeaders: { Authorization: `Bearer ${token}` } })',
    ['transport', 'headers', 'socketio', '400'], 'authentication');

  // === DATABASE errors ===
  addError('NotFound: No record found for id',
    'Attempted to get, update, patch, or remove a record with an ID that does not exist in the database.',
    'Check that the ID is correct and the record exists. Handle 404 errors gracefully in the client.',
    'try { await app.service("messages").get(id) } catch(e) { if (e.code === 404) { /* handle */ } }',
    ['database', 'crud', '404'], 'database');

  addError('GeneralError: .*SQLITE_CONSTRAINT',
    'A SQLite database constraint was violated (unique constraint, foreign key, not null).',
    'Check for duplicate values on unique columns. Ensure required fields are provided. Verify foreign key references exist.',
    'await app.service("users").create({ email: "unique@email.com" }) // fails if email already exists',
    ['sqlite', 'knex', 'database', 'constraint'], 'database');

  addError('Conflict: .*duplicate key',
    'Attempted to create or update a record with a value that violates a unique constraint.',
    'Check for existing records with the same unique field value. Use upsert pattern or check existence before create.',
    'const existing = await service.find({ query: { email } }); if (existing.total > 0) throw new Conflict("Email exists")',
    ['database', 'unique', 'duplicate', '409'], 'database');

  addError('Unprocessable: .*cast to ObjectId',
    'MongoDB received an invalid ObjectId string (not a valid 24-character hex string).',
    'Validate ID format before using in queries. Use ObjectIdSchema from @feathersjs/mongodb for schema validation with automatic conversion.',
    'import { ObjectIdSchema } from "@feathersjs/mongodb"; const schema = Type.Object({ userId: ObjectIdSchema() })',
    ['mongodb', 'objectid', 'validation', '422'], 'database');

  addError('GeneralError: .*ECONNREFUSED',
    'Cannot connect to the database or external service.',
    'Check that the database server is running. Verify connection string/URL. Check network connectivity and firewall rules.',
    'Check config/default.json for correct database connection settings',
    ['database', 'connection', 'network'], 'database');

  addError('Error: .*migration.*failed',
    'A database migration failed to apply.',
    'Check the migration file for syntax errors. Ensure the database state matches expectations. Run migrations in order. Use `knex migrate:status` to check.',
    'npx knex migrate:latest --knexfile knexfile.ts',
    ['database', 'migration', 'knex'], 'database');

  // === CONFIGURATION errors ===
  addError('BadRequest: Invalid query parameter',
    'The query contains a parameter or operator not defined in the query schema.',
    'Define all query parameters and operators in your TypeBox query schema using `querySyntax()`. Add custom operators to the extensions parameter.',
    'const querySchema = querySyntax(Type.Pick(schema, ["id", "name"]), { name: { $ilike: Type.String() } })',
    ['query', 'validation', 'schema', '400'], 'configuration');

  addError('BadRequest: Validation failed',
    'Data sent to the service did not pass schema validation (AJV).',
    'Check that the request data matches the schema. Review the validation errors in `error.data` for specific field issues. Ensure required fields are present.',
    'const error = new BadRequest("Validation failed", { errors: { email: "must be a valid email" } })',
    ['validation', 'schema', 'ajv', '400'], 'configuration');

  addError('Error: Could not find.*module',
    'A required npm package or module is not installed or cannot be resolved.',
    'Install the missing package with `npm install <package>`. Check import paths. Ensure dependencies are in package.json.',
    'npm install @feathersjs/feathers @feathersjs/koa @feathersjs/socketio',
    ['dependency', 'import', 'module'], 'configuration');

  addError('Error: listen EADDRINUSE',
    'The port is already in use by another process.',
    'Stop the other process using the port, or change the port in your configuration. Use `lsof -i :PORT` to find the process.',
    'app.listen(app.get("port") || 3030).then(() => console.log("Server started"))',
    ['server', 'port', 'startup'], 'configuration');

  addError('Error: Configuration key .* not found',
    'Accessing a configuration key that is not defined in any config file.',
    'Add the key to config/default.json. Check for typos in the key name. Ensure @feathersjs/configuration is configured.',
    'app.configure(configuration()); const port = app.get("port"); // key must exist in config/default.json',
    ['configuration', 'setup', 'missing-key'], 'configuration');

  // === RUNTIME errors ===
  addError('MethodNotAllowed: Method .* is not supported',
    'Called a service method that is not implemented or not listed in the `methods` option.',
    'Implement the missing method on the service, or add it to the `methods` option in `app.use()`. Check spelling of method name.',
    'app.use("myservice", new MyService(), { methods: ["find", "get", "create", "myCustomMethod"] })',
    ['service', 'method', '405'], 'runtime');

  addError('Timeout: Operation timed out',
    'A service method or database query took too long to complete.',
    'Check database connection. Optimize slow queries. Increase timeout configuration if appropriate. Check for deadlocks.',
    'app.use("messages", new MessageService(), { timeout: 10000 })',
    ['timeout', 'performance', 'database'], 'runtime');

  addError('NotImplemented: .* is not implemented',
    'The service does not implement the called method (find, get, create, etc.).',
    'Implement the required method on your service class. Feathers automatically throws NotImplemented for missing standard methods.',
    'class MyService { async find(params: Params) { return [] } /* implement needed methods */ }',
    ['service', 'method', '501'], 'runtime');

  addError('NotFound: Service .* not found',
    'Tried to access a service that has not been registered with `app.use()`.',
    'Check the service path spelling. Ensure the service is registered before it is accessed. Verify import/configuration order.',
    'app.use("messages", new MessageService()); const svc = app.service("messages"); // path must match exactly',
    ['service', 'registration', '404'], 'runtime');

  addError('Error: .* is not a function',
    'Accessing the service object directly instead of through `app.service()`, or calling a method that doesn\'t exist.',
    'Always use `app.service(path)` to access services, not the raw service object. Check method name spelling.',
    'const svc = app.service("messages"); await svc.find(); // NOT: await rawServiceObj.find()',
    ['service', 'usage', 'TypeError'], 'runtime');

  addError('Error: Channel .* does not exist',
    'Tried to publish or send to a channel that has no connections or hasn\'t been created.',
    'Ensure connections join the channel (e.g., on login). Check channel naming. Channels only exist while they have connections.',
    'app.on("login", (result, { connection }) => { if (connection) app.channel("authenticated").join(connection) })',
    ['channels', 'real-time', 'connection'], 'runtime');

  // Write 4 category files as expected by step 35 verification
  const errorCategories = { configuration: [], runtime: [], database: [], authentication: [] };
  for (const err of errors) {
    if (errorCategories[err.category]) {
      errorCategories[err.category].push(err);
    }
  }
  for (const [cat, items] of Object.entries(errorCategories)) {
    fs.writeFileSync(path.join(KB_DIR, 'errors', cat + '.json'), JSON.stringify(items, null, 2));
  }

  console.log(`  errors/: ${errors.length} error patterns across 4 files`);
  return errors.length;
}

// ============================================================
// 5. BEST PRACTICES (knowledge-base/best-practices/)
// ============================================================
function buildBestPractices() {
  const practices = [];
  let idCounter = 1;

  function addPractice(topic, rule, rationale, goodExample, badExample, tags = []) {
    practices.push({
      id: `bp-${String(idCounter++).padStart(3, '0')}`,
      topic,
      rule,
      rationale,
      goodExample,
      badExample,
      version: 'v5',
      tags,
    });
  }

  // Hooks best practices
  addPractice('hooks', 'Use around hooks for wrapping logic',
    'Around hooks provide the most control by wrapping the entire before/after/error flow in a single function. They are the recommended pattern in Feathers v5.',
`app.service('messages').hooks({
  around: {
    all: [
      async (context, next) => {
        console.log('Before:', context.method)
        await next()
        console.log('After:', context.method)
      }
    ]
  }
})`,
`// Anti-pattern: duplicating logic across before/after
app.service('messages').hooks({
  before: { all: [logBefore] },
  after: { all: [logAfter] },
  error: { all: [logError] }
})`,
    ['hooks', 'around', 'pattern']);

  addPractice('hooks', 'Keep hooks small and focused',
    'Each hook should do one thing well. Chain multiple small hooks rather than creating large monolithic hooks.',
`// Good: composable, reusable hooks
app.service('messages').hooks({
  before: {
    create: [authenticate('jwt'), validateData, setTimestamp, setOwner]
  }
})`,
`// Bad: one massive hook doing everything
app.service('messages').hooks({
  before: {
    create: [async (context) => {
      // 200 lines of auth + validation + data manipulation
    }]
  }
})`,
    ['hooks', 'composition', 'reusability']);

  addPractice('hooks', 'Use resolvers for data transformation in v5',
    'Feathers v5 recommends using schema resolvers instead of manual hooks for setting computed properties, populating associations, and securing response data.',
`// v5 recommended: resolvers
const messageDataResolver = resolve<Message, HookContext>({
  userId: async (value, message, context) => context.params.user.id,
  createdAt: async () => Date.now()
})

app.service('messages').hooks({
  around: { all: [resolveResult(resultResolver)] },
  before: { create: [resolveData(messageDataResolver)] }
})`,
`// Less ideal for v5: manual hooks
app.service('messages').hooks({
  before: {
    create: [
      async (context) => {
        context.data.userId = context.params.user.id
        context.data.createdAt = Date.now()
      }
    ]
  }
})`,
    ['hooks', 'resolvers', 'schema', 'v5']);

  addPractice('hooks', 'Use application hooks for cross-cutting concerns',
    'Register hooks at the application level for logic that applies to all services, such as logging, error handling, or authentication.',
`// Good: application-level hook for cross-cutting concern
app.hooks({
  around: {
    all: [async (context, next) => {
      const start = Date.now()
      await next()
      console.log(\`\${context.path}.\${context.method}: \${Date.now() - start}ms\`)
    }]
  }
})`,
`// Bad: duplicating the same hook on every service
app.service('messages').hooks({ around: { all: [logTime] } })
app.service('users').hooks({ around: { all: [logTime] } })
app.service('orders').hooks({ around: { all: [logTime] } })`,
    ['hooks', 'application', 'cross-cutting']);

  addPractice('hooks', 'Always call next() in around hooks',
    'Forgetting to call next() in an around hook will prevent the service method and subsequent hooks from executing.',
`app.service('messages').hooks({
  around: {
    all: [async (context, next) => {
      // Do something before
      await next() // MUST call next()
      // Do something after
    }]
  }
})`,
`// Bug: forgetting next() - service method never executes
app.service('messages').hooks({
  around: {
    all: [async (context, next) => {
      console.log('This runs, but service method never does')
      // Missing: await next()
    }]
  }
})`,
    ['hooks', 'around', 'next', 'bug']);

  // Services best practices
  addPractice('services', 'Always use app.service() to get services',
    'The service returned by app.service() has all Feathers functionality (hooks, events, etc.). Using the raw service object directly bypasses these features.',
`// Correct: use app.service()
const messages = app.service('messages')
const result = await messages.find()`,
`// Wrong: using the raw service object
const rawService = new MessageService()
const result = await rawService.find() // No hooks, no events!`,
    ['services', 'usage', 'hooks']);

  addPractice('services', 'Use TypeScript generics for type safety',
    'Define ServiceTypes on the app and use typed service methods for compile-time safety.',
`type ServiceTypes = {
  messages: MessageService
  users: UserService
}
const app = feathers<ServiceTypes>()
// app.service('messages') is now fully typed`,
`// No type safety
const app = feathers()
// app.service('messages') returns unknown type`,
    ['services', 'typescript', 'types']);

  addPractice('services', 'Register services with explicit methods option',
    'Use the methods option to explicitly control which methods are available externally. This improves security by limiting the API surface.',
`app.use('payments', new PaymentService(), {
  methods: ['create', 'get', 'find'] // only expose needed methods
})`,
`// Dangerous: all methods exposed by default
app.use('payments', new PaymentService())
// Now update, patch, remove are all available externally`,
    ['services', 'security', 'methods']);

  addPractice('services', 'Use params.query for filtering, params for internal data',
    'Keep query parameters separate from internal params. params.query is for database queries; use custom params properties for internal context.',
`// Good: separate concerns
app.service('messages').hooks({
  before: {
    find: [async (context) => {
      // Internal data on params
      context.params.user = await getUser(context)
      // Database filtering on params.query
      context.params.query.$sort = { createdAt: -1 }
    }]
  }
})`,
`// Bad: mixing internal data into query
app.service('messages').hooks({
  before: {
    find: [async (context) => {
      context.params.query.user = await getUser(context) // This gets sent to DB!
    }]
  }
})`,
    ['services', 'params', 'query']);

  addPractice('services', 'Handle paginated and non-paginated results correctly',
    'Service find() returns either paginated (object with data array) or non-paginated (plain array) results. Handle both cases.',
`// Good: handle both result types
const result = await app.service('messages').find({ query })
const items = Array.isArray(result) ? result : result.data
const total = Array.isArray(result) ? result.length : result.total`,
`// Bug: assuming always paginated
const result = await app.service('messages').find()
const items = result.data // Crashes if paginate: false
const total = result.total // undefined if not paginated`,
    ['services', 'pagination', 'find']);

  // Security best practices
  addPractice('security', 'Never expose internal errors to clients',
    'Internal errors can leak sensitive information about your system. Sanitize errors in application error hooks.',
`app.hooks({
  error: {
    all: [async (context) => {
      if (!context.error.code) {
        context.error = new GeneralError('Internal server error')
      }
      if (process.env.NODE_ENV === 'production') {
        context.error.stack = undefined
      }
    }]
  }
})`,
`// Bad: raw errors sent to client
// No error hooks - database errors go directly to client
// Client sees: "SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email"`,
    ['security', 'errors', 'production']);

  addPractice('security', 'Use resolveExternal for safe response data',
    'Always use resolveExternal to create safe representations of data that is sent to external clients. This prevents leaking sensitive fields like passwords.',
`const userExternalResolver = resolve<User, HookContext>({
  password: async () => undefined, // Always remove password
  internalNotes: async () => undefined,
})

app.service('users').hooks({
  around: {
    all: [resolveExternal(userExternalResolver)]
  }
})`,
`// Bad: manually trying to remove fields in after hooks
// Easy to miss fields, doesn't handle nested/associated data
app.service('users').hooks({
  after: { all: [protect('password')] } // deprecated pattern
})`,
    ['security', 'resolver', 'password']);

  addPractice('security', 'Validate and sanitize all input data',
    'Always validate incoming data with schemas. Use TypeBox or JSON Schema validators in the hook chain before any data processing.',
`// Schema-based validation
const messageDataValidator = getValidator(messageDataSchema, dataValidator)
app.service('messages').hooks({
  before: {
    create: [schemaHooks.validateData(messageDataValidator)],
    patch: [schemaHooks.validateData(messageDataValidator)]
  }
})`,
`// Bad: trusting client data without validation
app.service('messages').hooks({
  before: {
    create: [async (context) => {
      // No validation - client could send anything
      // SQL injection, XSS, huge payloads all possible
    }]
  }
})`,
    ['security', 'validation', 'input', 'schema']);

  addPractice('security', 'Use query resolvers to restrict access',
    'Use resolveQuery to ensure users can only access their own data or data they are authorized to see.',
`const messageQueryResolver = resolve<MessageQuery, HookContext>({
  userId: async (value, query, context) => {
    // Regular users can only see their own messages
    if (context.params.user && !context.params.user.isAdmin) {
      return context.params.user.id
    }
    return value
  }
})`,
`// Bad: relying on client to send correct userId
// Client could query any user's messages
app.service('messages').hooks({
  before: {
    find: [] // no query restriction - anyone sees everything
  }
})`,
    ['security', 'authorization', 'query', 'resolver']);

  addPractice('security', 'Rate-limit authentication attempts',
    'Protect authentication endpoints from brute force attacks by limiting login attempts per IP or account.',
`// Use rate-limiting middleware
import rateLimit from 'express-rate-limit'

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts'
})

app.use('/authentication', authLimiter)`,
`// Bad: no rate limiting on authentication
// Allows unlimited brute force attempts
app.use('authentication', authentication)`,
    ['security', 'rate-limit', 'authentication', 'brute-force']);

  // Testing best practices
  addPractice('testing', 'Test services in isolation with app.setup()',
    'Create a test app, register services, call app.setup() and test service methods directly without HTTP.',
`const app = feathers()
app.use('messages', new MessageService())
await app.setup()
const result = await app.service('messages').create({ text: 'test' })
expect(result.text).toBe('test')
await app.teardown()`,
`// Bad: testing through HTTP/WebSocket (slow, brittle)
const response = await fetch('http://localhost:3030/messages', {
  method: 'POST',
  body: JSON.stringify({ text: 'test' })
})`,
    ['testing', 'unit', 'jest']);

  addPractice('testing', 'Use the Memory adapter for testing',
    'The Memory adapter is perfect for tests - no database setup needed, fast, and implements the full service interface.',
`import { MemoryService } from '@feathersjs/memory'

const app = feathers()
app.use('messages', new MemoryService({
  paginate: { default: 10, max: 100 }
}))`,
`// Avoid in tests: real database connections
// Slow, requires setup, can fail due to connection issues
app.use('messages', new MongoDBService({ Model: mongoCollection }))`,
    ['testing', 'memory', 'mock', 'adapter']);

  addPractice('testing', 'Test hooks independently',
    'Export and test hook functions in isolation rather than only through full service calls. This makes tests faster and more focused.',
`// Export hook for direct testing
export const setTimestamp = async (context: HookContext) => {
  context.data.createdAt = Date.now()
  return context
}

// Test in isolation
const context = { data: { text: 'test' } } as HookContext
const result = await setTimestamp(context)
expect(result.data.createdAt).toBeDefined()`,
`// Bad: only testing hooks through service calls
// Slow, unclear what's being tested
const result = await app.service('messages').create({ text: 'test' })
expect(result.createdAt).toBeDefined() // Which hook set this?`,
    ['testing', 'hooks', 'unit', 'isolation']);

  addPractice('testing', 'Test error cases explicitly',
    'Always test that your services and hooks return appropriate errors for invalid inputs, unauthorized access, and edge cases.',
`// Good: explicit error testing
await expect(
  app.service('messages').create({}) // empty data
).rejects.toThrow(BadRequest)

await expect(
  app.service('messages').get('nonexistent-id')
).rejects.toThrow(NotFound)

await expect(
  app.service('protected').find({ provider: 'rest' }) // unauthenticated
).rejects.toThrow(NotAuthenticated)`,
`// Bad: only testing happy path
const result = await app.service('messages').create({ text: 'hello' })
expect(result).toBeDefined()
// Never tests: what if text is missing? What if not authenticated?`,
    ['testing', 'errors', 'validation', 'edge-cases']);

  addPractice('testing', 'Clean up test data between tests',
    'Use beforeEach/afterEach to reset service state. Prevents test pollution and order-dependent failures.',
`describe('messages service', () => {
  let app: Application

  beforeEach(async () => {
    app = feathers()
    app.use('messages', new MemoryService())
    await app.setup()
  })

  afterEach(async () => {
    await app.teardown()
  })

  it('creates a message', async () => {
    // Each test gets a fresh app
  })
})`,
`// Bad: shared state between tests
const app = feathers()
app.use('messages', new MemoryService())
// Tests depend on each other's data - fragile!`,
    ['testing', 'cleanup', 'beforeEach', 'isolation']);

  // Performance best practices
  addPractice('performance', 'Use pagination for find queries',
    'Always enable pagination to prevent loading entire datasets into memory. Set sensible defaults and maximums.',
`const options = {
  paginate: {
    default: 10,  // return 10 items by default
    max: 100      // never return more than 100
  }
}
app.use('messages', new KnexService(options))`,
`// Dangerous: no pagination
app.use('messages', new KnexService({ paginate: false }))
// service.find() could return millions of records`,
    ['performance', 'pagination', 'database']);

  addPractice('performance', 'Use $select to limit response fields',
    'Use $select in queries to only return needed fields. Reduces data transfer and improves response times.',
`// Only fetch id and text fields
const messages = await app.service('messages').find({
  query: { $select: ['id', 'text'] }
})`,
`// Bad: fetching all fields when only a few are needed
const messages = await app.service('messages').find()
// Returns every field including large content, metadata, etc.`,
    ['performance', 'query', 'select', 'database']);

  addPractice('performance', 'Use hookless methods for bulk operations',
    'Prefix methods with _ (e.g., _find, _patch) for server-only operations that bypass hooks. Much faster for migrations and bulk updates.',
`// Fast: bypass hooks for internal migration
const allUsers = await app.service('users')._find({ paginate: false })
await app.service('users')._patch(null, { migrated: true })`,
`// Slow: every record goes through all hooks
const allUsers = await app.service('users').find({ paginate: false })
for (const user of allUsers) {
  await app.service('users').patch(user.id, { migrated: true })
}`,
    ['performance', 'hookless', 'bulk', 'database']);

  addPractice('performance', 'Avoid N+1 queries with resolvers',
    'Use batch resolvers or dataloader patterns to avoid fetching related data one record at a time.',
`// Good: batch loading with a single query
const messageResultResolver = resolve<Message, HookContext>({
  user: virtual(async (message, context) => {
    // This gets called per-record but can be batch-optimized
    return context.app.service('users').get(message.userId)
  })
})
// Better: use a dataloader for batching
import DataLoader from 'dataloader'`,
`// Bad: N+1 query pattern
const messages = await app.service('messages').find()
for (const msg of messages.data) {
  msg.user = await app.service('users').get(msg.userId) // N queries!
}`,
    ['performance', 'n+1', 'resolver', 'dataloader']);

  addPractice('performance', 'Index database fields used in queries',
    'Create database indexes for fields commonly used in $sort, query filters, and $select. Without indexes, queries scan entire tables.',
`// Good: create indexes for queried fields
export async function up(knex: Knex) {
  await knex.schema.createTable('messages', (table) => {
    table.increments('id')
    table.string('text')
    table.integer('userId').index() // indexed for lookups
    table.bigInteger('createdAt').index() // indexed for sorting
  })
}`,
`// Bad: no indexes on frequently queried columns
export async function up(knex: Knex) {
  await knex.schema.createTable('messages', (table) => {
    table.increments('id')
    table.string('text')
    table.integer('userId') // no index - slow lookups
    table.bigInteger('createdAt') // no index - slow sorting
  })
}`,
    ['performance', 'database', 'index', 'query']);

  fs.writeFileSync(path.join(KB_DIR, 'best-practices', 'hooks.json'),
    JSON.stringify(practices.filter(p => p.topic === 'hooks'), null, 2));
  fs.writeFileSync(path.join(KB_DIR, 'best-practices', 'services.json'),
    JSON.stringify(practices.filter(p => p.topic === 'services'), null, 2));
  fs.writeFileSync(path.join(KB_DIR, 'best-practices', 'security.json'),
    JSON.stringify(practices.filter(p => p.topic === 'security'), null, 2));
  fs.writeFileSync(path.join(KB_DIR, 'best-practices', 'testing.json'),
    JSON.stringify(practices.filter(p => p.topic === 'testing'), null, 2));
  fs.writeFileSync(path.join(KB_DIR, 'best-practices', 'performance.json'),
    JSON.stringify(practices.filter(p => p.topic === 'performance'), null, 2));
  fs.writeFileSync(path.join(KB_DIR, 'best-practices', 'databases.json'),
    JSON.stringify(practices.filter(p => p.topic === 'databases'), null, 2));

  console.log(`  best-practices/: ${practices.length} best practices across 6 files`);
  return practices.length;
}

// ============================================================
// MAIN
// ============================================================
function main() {
  console.log('Building knowledge base from docs/v5_docs/ ...\n');

  const docsCount = buildDocs();
  const templatesCount = buildTemplates();
  const snippetsCount = buildSnippets();
  const errorsCount = buildErrors();
  const practicesCount = buildBestPractices();

  console.log(`\n✓ Knowledge base built successfully!`);
  console.log(`  Total: ${docsCount} docs, ${templatesCount} templates, ${snippetsCount} snippets, ${errorsCount} errors, ${practicesCount} best practices`);
}

main();
