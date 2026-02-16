/**
 * Import statement merger and deduplicator.
 *
 * Merges arrays of import statements, removing duplicates and organizing
 * them alphabetically for clean, consistent template composition.
 */

/**
 * Merge and deduplicate import statements from multiple sources.
 *
 * Takes arrays of import statements (as strings), removes duplicates,
 * sorts alphabetically, and groups by source package.
 *
 * @param imports - Array of arrays of import statement strings
 * @returns Deduplicated and sorted array of import statements
 *
 * @example
 * ```ts
 * const result = mergeImports([
 *   ['import { App } from "@feathersjs/feathers"'],
 *   ['import { App } from "@feathersjs/feathers"', 'import express from "express"'],
 *   ['import express from "express"']
 * ]);
 * // Returns: ['import { App } from "@feathersjs/feathers"', 'import express from "express"']
 * ```
 */
export function mergeImports(imports: string[][]): string[] {
  if (!imports || imports.length === 0) {
    return [];
  }

  // Flatten all import arrays into a single array
  const allImports = imports.flat();

  // Deduplicate using Set
  const uniqueImports = Array.from(new Set(allImports));

  // Filter out empty strings
  const validImports = uniqueImports.filter((imp) => imp && imp.trim().length > 0);

  // Sort alphabetically by the entire import statement
  // This naturally groups by source since imports typically follow:
  // import ... from "source"
  validImports.sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    return aLower.localeCompare(bLower);
  });

  return validImports;
}

/**
 * Merge import statements and format them as a complete import block.
 *
 * Similar to `mergeImports` but returns a formatted string with newlines,
 * ready to be placed at the top of a generated file.
 *
 * @param imports - Array of arrays of import statement strings
 * @returns Formatted import block as a single string with newlines
 */
export function mergeImportsToString(imports: string[][]): string {
  const merged = mergeImports(imports);
  if (merged.length === 0) {
    return '';
  }
  return merged.join('\n') + '\n';
}

/**
 * Extract package source from an import statement.
 *
 * Given an import statement like:
 * `import { foo } from "@package/name"`
 * Returns: `@package/name`
 *
 * @param importStatement - The import statement string
 * @returns The package source or empty string if not found
 */
export function extractImportSource(importStatement: string): string {
  // Match: from "source" or from 'source'
  const match = importStatement.match(/from\s+['"]([^'"]+)['"]/);
  return match ? match[1] : '';
}

/**
 * Group imports by their source package.
 *
 * Returns a Map where keys are package sources and values are arrays
 * of import statements from that source.
 *
 * @param imports - Array of import statement strings
 * @returns Map of source -> import statements
 */
export function groupImportsBySource(imports: string[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const imp of imports) {
    const source = extractImportSource(imp);
    if (!source) continue;

    if (!grouped.has(source)) {
      grouped.set(source, []);
    }
    grouped.get(source)!.push(imp);
  }

  return grouped;
}
