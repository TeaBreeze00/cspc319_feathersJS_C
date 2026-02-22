import { BaseTool } from './baseTool';
import { ToolResult } from './types';
import { ToolRegistration, ToolHandler } from '../protocol/types';
import { KnowledgeLoader } from '../knowledge';
import { TemplateFragment, DocVersion, DocEntry } from '../knowledge/types';
import { TemplateComposer } from './templates/composer';
import { ValidationPipeline } from './validation';
import { vectorSearch } from './search/vectorSearch';

type DatabaseType = 'mongodb' | 'postgresql' | 'sqlite';

interface GetTemplateParams {
  database: DatabaseType;
  auth?: boolean;
  typescript?: boolean;
  version?: DocVersion;
}

/**
 * Tool that generates a complete FeathersJS project structure from template fragments.
 *
 * Name: `get_feathers_template`
 *
 * Input:
 *   - database: 'mongodb' | 'postgresql' | 'sqlite' (required) - database adapter to use
 *   - auth: boolean (optional, default false) - include authentication setup
 *   - typescript: boolean (optional, default true) - generate TypeScript or JavaScript
 *   - version: 'v5' | 'v6' | 'both' (optional, default 'v6') - FeathersJS version
 *
 * Behavior:
 *   - Loads template fragments from knowledge base
 *   - Uses vector search to intelligently select relevant template fragments
 *   - Falls back to hardcoded logic if vector search doesn't find good matches
 *   - Uses TemplateComposer to merge fragments into cohesive files
 *   - Returns complete project file tree with contents
 */
export class GetTemplateTool extends BaseTool {
  name = 'get_feathers_template';

  description =
    'Generates a complete FeathersJS project structure based on database, authentication, and language preferences.';

  inputSchema = {
    type: 'object',
    properties: {
      database: {
        type: 'string',
        enum: ['mongodb', 'postgresql', 'sqlite'],
        description: 'Database adapter to use for the project.',
      },
      auth: {
        type: 'boolean',
        description: 'Include authentication setup (default: false).',
      },
      typescript: {
        type: 'boolean',
        description: 'Generate TypeScript project (default: true).',
      },
      version: {
        type: 'string',
        enum: ['v5', 'v6', 'both'],
        description: 'FeathersJS version (default: v6).',
      },
    },
    required: ['database'],
    additionalProperties: false,
  };

  private loader: KnowledgeLoader;
  private composer: TemplateComposer;
  private validator: ValidationPipeline;

  constructor(
    loader?: KnowledgeLoader,
    composer?: TemplateComposer,
    validator?: ValidationPipeline
  ) {
    super();
    this.loader = loader ?? new KnowledgeLoader();
    this.composer = composer ?? new TemplateComposer();
    this.validator = validator ?? new ValidationPipeline({ typeCheck: false });
  }

  /**
   * Execute the get_feathers_template tool.
   */
  async execute(params: unknown): Promise<ToolResult> {
    const normalized = this.normalizeParams(params);
    const { database, auth, typescript, version } = normalized;

    // Load all template fragments from knowledge base
    const allFragments = await this.loader.load<TemplateFragment>('templates');

    // Filter fragments by version
    const versionedFragments = allFragments.filter((f) => this.matchesVersion(f.version, version));

    // Select fragments based on flags using hybrid approach (vector search + fallback)
    const selectedFragments = await this.selectFragmentsWithVectorSearch(
      versionedFragments,
      database,
      auth,
      typescript
    );

    if (selectedFragments.length === 0) {
      return {
        content: JSON.stringify(
          {
            error: 'No matching templates found for the specified configuration',
            database,
            auth,
            typescript,
            version,
          },
          null,
          2
        ),
        metadata: {
          tool: 'get_feathers_template',
          fragmentCount: 0,
        },
      };
    }

    // Compose fragments into files
    const composed = this.composer.compose(selectedFragments, {
      targetFile: typescript ? 'index.ts' : 'index.js',
      includeComments: true,
    });

    const validationErrors = await this.validateGeneratedFiles(composed.files);
    if (validationErrors.length > 0) {
      return {
        content: JSON.stringify(
          {
            error: 'Generated template failed validation',
            issues: validationErrors,
          },
          null,
          2
        ),
        metadata: {
          tool: 'get_feathers_template',
          validationFailed: true,
          issueCount: validationErrors.length,
        },
      };
    }

    // Build file tree structure
    const fileTree = this.buildFileTree(composed.files, typescript);

    // Generate project metadata
    const projectInfo = {
      database,
      auth,
      typescript,
      version,
      dependencies: composed.dependencies,
      featureFlags: composed.featureFlags,
      files: fileTree,
    };

    return {
      content: JSON.stringify(projectInfo, null, 2),
      metadata: {
        tool: 'get_feathers_template',
        database,
        auth,
        typescript,
        version,
        fragmentCount: selectedFragments.length,
        fileCount: composed.files.size,
        dependencies: composed.dependencies,
        featureFlags: composed.featureFlags,
      },
    };
  }

  private async validateGeneratedFiles(
    files: Map<string, string>
  ): Promise<Array<{ path: string; result: unknown }>> {
    const errors: Array<{ path: string; result: unknown }> = [];

    for (const [filePath, content] of Array.from(files.entries())) {
      if (!filePath.endsWith('.ts') && !filePath.endsWith('.js')) {
        continue;
      }

      const result = await this.validator.validate(content, {
        typescript: true,
        eslint: false,
        prettier: false,
        bestPractices: false,
      });
      if (!result.valid) {
        errors.push({
          path: filePath,
          result,
        });
      }
    }

    return errors;
  }

  /**
   * Normalize and validate incoming parameters.
   */
  private normalizeParams(params: unknown): Required<GetTemplateParams> {
    const obj = (params ?? {}) as Partial<GetTemplateParams>;

    const database = this.validateDatabase(obj.database);
    const auth = typeof obj.auth === 'boolean' ? obj.auth : false;
    const typescript = typeof obj.typescript === 'boolean' ? obj.typescript : true;
    const version: DocVersion =
      obj.version === 'v5' || obj.version === 'v6' || obj.version === 'both' ? obj.version : 'v6';

    return { database, auth, typescript, version };
  }

  /**
   * Validate database parameter.
   */
  private validateDatabase(db: unknown): DatabaseType {
    if (db === 'mongodb' || db === 'postgresql' || db === 'sqlite') {
      return db;
    }
    throw new Error(`Invalid database type: ${db}. Must be one of: mongodb, postgresql, sqlite`);
  }

  /**
   * Check if a fragment version matches the requested version filter.
   */
  private matchesVersion(fragVersion: DocVersion, requestedVersion: DocVersion): boolean {
    if (requestedVersion === 'both') {
      return true;
    }
    if (fragVersion === 'both') {
      return true;
    }
    return fragVersion === requestedVersion;
  }

  /**
   * Select appropriate fragments using vector search with fallback to hardcoded logic.
   *
   * This hybrid approach:
   * 1. Uses vector search to find semantically relevant templates
   * 2. Falls back to hardcoded selection if vector search returns insufficient results
   * 3. Ensures we always get base, database, and optional auth fragments
   */
  private async selectFragmentsWithVectorSearch(
    fragments: TemplateFragment[],
    database: DatabaseType,
    auth: boolean,
    typescript: boolean
  ): Promise<TemplateFragment[]> {
    const selected: TemplateFragment[] = [];
    const selectedIds = new Set<string>();

    // Convert TemplateFragments to DocEntry format for vector search
    const fragmentsAsDocEntries = fragments.map((f) => this.templateToDocEntry(f));

    // 1. Select base project template using vector search
    const baseQuery = typescript
      ? 'base TypeScript FeathersJS project template with Koa'
      : 'base JavaScript FeathersJS project template with Express';

    const baseResults = await vectorSearch.search(baseQuery, fragmentsAsDocEntries, 3, 0.3);

    if (baseResults.length > 0) {
      const baseFragment = fragments.find((f) => f.id === baseResults[0].id);
      if (baseFragment) {
        selected.push(baseFragment);
        selectedIds.add(baseFragment.id);
      }
    } else {
      // Fallback to hardcoded logic
      const baseId = typescript ? 'tpl-base-project' : 'tpl-base-express';
      const baseFragment = fragments.find((f) => f.id === baseId);
      if (baseFragment) {
        selected.push(baseFragment);
        selectedIds.add(baseFragment.id);
      } else {
        const fallback = fragments.find((f) => f.tags?.includes('project'));
        if (fallback) {
          selected.push(fallback);
          selectedIds.add(fallback.id);
        }
      }
    }

    // 2. Add database adapter fragment using vector search
    const dbQuery = `${database} database adapter service template for FeathersJS`;
    const dbResults = await vectorSearch.search(dbQuery, fragmentsAsDocEntries, 3, 0.3);

    if (dbResults.length > 0) {
      // Find the first result that isn't already selected
      for (const result of dbResults) {
        if (!selectedIds.has(result.id)) {
          const dbFragment = fragments.find((f) => f.id === result.id);
          if (dbFragment) {
            selected.push(dbFragment);
            selectedIds.add(dbFragment.id);
            break;
          }
        }
      }
    } else {
      // Fallback to hardcoded logic
      const dbFragmentId = this.getDatabaseFragmentId(database);
      const dbFragment = fragments.find((f) => f.id === dbFragmentId);
      if (dbFragment && !selectedIds.has(dbFragment.id)) {
        selected.push(dbFragment);
        selectedIds.add(dbFragment.id);
      } else {
        const fallbackDb = fragments.find(
          (f) =>
            !selectedIds.has(f.id) &&
            (f.featureFlags?.includes(database) ||
              f.tags?.includes(database) ||
              f.name.toLowerCase().includes(database))
        );
        if (fallbackDb) {
          selected.push(fallbackDb);
          selectedIds.add(fallbackDb.id);
        }
      }
    }

    // 3. Optionally add authentication fragment using vector search
    if (auth) {
      const authQuery = 'authentication JWT local strategy template for FeathersJS';
      const authResults = await vectorSearch.search(authQuery, fragmentsAsDocEntries, 3, 0.3);

      if (authResults.length > 0) {
        // Find the first result that isn't already selected
        for (const result of authResults) {
          if (!selectedIds.has(result.id)) {
            const authFragment = fragments.find((f) => f.id === result.id);
            if (authFragment) {
              selected.push(authFragment);
              selectedIds.add(authFragment.id);
              break;
            }
          }
        }
      } else {
        // Fallback to hardcoded logic
        const authFragment = fragments.find((f) => f.id === 'tpl-authentication');
        if (authFragment && !selectedIds.has(authFragment.id)) {
          selected.push(authFragment);
          selectedIds.add(authFragment.id);
        } else {
          const fallbackAuth = fragments.find(
            (f) =>
              !selectedIds.has(f.id) &&
              (f.featureFlags?.includes('authentication') || f.tags?.includes('authentication'))
          );
          if (fallbackAuth) {
            selected.push(fallbackAuth);
            selectedIds.add(fallbackAuth.id);
          }
        }
      }
    }

    return selected;
  }

  /**
   * Convert TemplateFragment to DocEntry format for vector search compatibility.
   */
  private templateToDocEntry(template: TemplateFragment): DocEntry {
    // Combine relevant fields into content for better semantic matching
    const content = [
      template.name,
      template.description || '',
      template.featureFlags?.join(' ') || '',
      template.tags?.join(' ') || '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      id: template.id,
      title: template.name,
      content,
      version: template.version,
      tokens: [],
      category: 'templates',
      tags: template.tags,
      embedding: undefined,
    };
  }

  /**
   * Map database type to template fragment ID.
   */
  private getDatabaseFragmentId(database: DatabaseType): string {
    switch (database) {
      case 'mongodb':
        return 'tpl-mongodb-service';
      case 'postgresql':
        return 'tpl-knex-postgresql';
      case 'sqlite':
        return 'tpl-knex-sqlite';
    }
  }

  /**
   * Build a structured file tree from the composed files.
   */
  private buildFileTree(
    files: Map<string, string>,
    typescript: boolean
  ): Record<string, { path: string; content: string; size: number }> {
    const tree: Record<string, { path: string; content: string; size: number }> = {};

    for (const [filePath, content] of Array.from(files.entries())) {
      const adjustedPath = this.adjustFilePath(filePath, typescript);
      tree[adjustedPath] = {
        path: adjustedPath,
        content,
        size: content.length,
      };
    }

    return tree;
  }

  /**
   * Adjust file path based on TypeScript/JavaScript preference.
   */
  private adjustFilePath(filePath: string, typescript: boolean): string {
    if (!typescript && filePath.endsWith('.ts')) {
      return filePath.replace(/\.ts$/, '.js');
    }
    if (typescript && filePath.endsWith('.js')) {
      return filePath.replace(/\.js$/, '.ts');
    }
    return filePath;
  }

  register(): ToolRegistration {
    const handler: ToolHandler = async (params: unknown) => {
      return this.execute(params);
    };

    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      handler,
    };
  }
}

export default GetTemplateTool;
