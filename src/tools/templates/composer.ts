/**
 * Template Composer for FeathersJS code generation.
 *
 * Composes multiple template fragments into a cohesive file structure,
 * handling dependency ordering, import merging, and code organization.
 */

import { TemplateFragment } from '../../knowledge/types';
import { mergeImports } from './importMerger';

/**
 * Options for template composition.
 */
export interface ComposerOptions {
  /** Target file path for the composed output (default: 'index.ts') */
  targetFile?: string;
  /** Whether to include fragment descriptions as comments (default: false) */
  includeComments?: boolean;
  /** Custom file mapping: fragment ID -> file path */
  fileMapping?: Map<string, string>;
  /** Language/file extension (default: 'typescript') */
  language?: string;
}

/**
 * Result of template composition.
 */
export interface ComposedTemplate {
  /** Map of file paths to their complete content */
  files: Map<string, string>;
  /** List of npm dependencies required by the composed fragments */
  dependencies: string[];
  /** Feature flags enabled by the composition */
  featureFlags: string[];
}

/**
 * Template Composer orchestrates the composition of multiple template fragments
 * into a coherent file structure.
 *
 * Handles:
 * - Dependency ordering (topological sort of fragments)
 * - Import deduplication and merging
 * - Code concatenation
 * - Multi-file output organization
 */
export class TemplateComposer {
  /**
   * Compose multiple template fragments into a file structure.
   *
   * @param fragments - Array of template fragments to compose
   * @param options - Composition options
   * @returns Composed template with file contents and metadata
   */
  compose(fragments: TemplateFragment[], options: ComposerOptions = {}): ComposedTemplate {
    if (!fragments || fragments.length === 0) {
      return {
        files: new Map(),
        dependencies: [],
        featureFlags: [],
      };
    }

    const {
      targetFile = 'index.ts',
      includeComments = false,
      fileMapping = new Map(),
      language = 'typescript',
    } = options;

    // Step 1: Order fragments by dependencies
    const orderedFragments = this.orderByDependencies(fragments);

    // Step 2: Group fragments by target file
    const fragmentsByFile = this.groupByFile(orderedFragments, fileMapping, targetFile);

    // Step 3: Compose each file
    const files = new Map<string, string>();
    for (const [filePath, fileFragments] of Array.from(fragmentsByFile.entries())) {
      const fileContent = this.composeFile(fileFragments, includeComments);
      files.set(filePath, fileContent);
    }

    // Step 4: Collect dependencies and feature flags
    const dependencies = this.collectDependencies(fragments);
    const featureFlags = this.collectFeatureFlags(fragments);

    return {
      files,
      dependencies,
      featureFlags,
    };
  }

  /**
   * Order fragments by their dependencies using topological sort.
   *
   * Fragments with no dependencies come first, followed by those
   * that depend on them, and so on.
   */
  private orderByDependencies(fragments: TemplateFragment[]): TemplateFragment[] {
    // Build a map of fragment ID -> fragment
    const fragmentMap = new Map<string, TemplateFragment>();
    for (const frag of fragments) {
      fragmentMap.set(frag.id, frag);
    }

    // Build dependency graph
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const frag of fragments) {
      graph.set(frag.id, []);
      inDegree.set(frag.id, 0);
    }

    for (const frag of fragments) {
      for (const depId of frag.dependencies || []) {
        // Only consider dependencies that are in our fragment set
        if (fragmentMap.has(depId)) {
          graph.get(depId)!.push(frag.id);
          inDegree.set(frag.id, (inDegree.get(frag.id) || 0) + 1);
        }
      }
    }

    // Topological sort (Kahn's algorithm)
    const queue: string[] = [];
    const ordered: string[] = [];

    // Start with fragments that have no dependencies
    for (const [id, degree] of Array.from(inDegree.entries())) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    while (queue.length > 0) {
      const id = queue.shift()!;
      ordered.push(id);

      for (const neighbor of graph.get(id) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // If we haven't ordered all fragments, there's a cycle.
    // In that case, fall back to original order.
    if (ordered.length !== fragments.length) {
      return fragments;
    }

    // Map ordered IDs back to fragments
    return ordered.map((id) => fragmentMap.get(id)!).filter(Boolean);
  }

  /**
   * Group fragments by their target file path.
   */
  private groupByFile(
    fragments: TemplateFragment[],
    fileMapping: Map<string, string>,
    defaultFile: string
  ): Map<string, TemplateFragment[]> {
    const grouped = new Map<string, TemplateFragment[]>();

    for (const frag of fragments) {
      const filePath = fileMapping.get(frag.id) || defaultFile;
      if (!grouped.has(filePath)) {
        grouped.set(filePath, []);
      }
      grouped.get(filePath)!.push(frag);
    }

    return grouped;
  }

  /**
   * Compose a single file from multiple fragments.
   */
  private composeFile(fragments: TemplateFragment[], includeComments: boolean): string {
    if (fragments.length === 0) {
      return '';
    }

    const parts: string[] = [];

    // Step 1: Merge all imports
    const importArrays = fragments.map((f) => f.imports || []);
    const mergedImports = mergeImports(importArrays);

    if (mergedImports.length > 0) {
      parts.push(mergedImports.join('\n'));
      parts.push(''); // blank line after imports
    }

    // Step 2: Add each fragment's code
    for (const frag of fragments) {
      if (includeComments && frag.description) {
        parts.push(`// ${frag.name}`);
        parts.push(`// ${frag.description}`);
      }

      if (frag.code && frag.code.trim()) {
        parts.push(frag.code.trim());
        parts.push(''); // blank line between fragments
      }
    }

    // Remove trailing blank lines
    while (parts.length > 0 && parts[parts.length - 1] === '') {
      parts.pop();
    }

    return parts.join('\n') + (parts.length > 0 ? '\n' : '');
  }

  /**
   * Collect all unique npm dependencies from fragments.
   */
  private collectDependencies(fragments: TemplateFragment[]): string[] {
    const deps = new Set<string>();
    for (const frag of fragments) {
      for (const dep of frag.dependencies || []) {
        deps.add(dep);
      }
    }
    return Array.from(deps).sort();
  }

  /**
   * Collect all unique feature flags from fragments.
   */
  private collectFeatureFlags(fragments: TemplateFragment[]): string[] {
    const flags = new Set<string>();
    for (const frag of fragments) {
      for (const flag of frag.featureFlags || []) {
        flags.add(flag);
      }
    }
    return Array.from(flags).sort();
  }
}

export default TemplateComposer;
