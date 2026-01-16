/**
 * @famgia/omnify-atlas - Change Preview
 *
 * Generates human-readable change previews.
 */

import type { SchemaCollection } from '@famgia/omnify-types';
import type { AtlasConfig } from '../atlas/types.js';
import type { ChangePreview, PreviewOptions, PreviewFormat } from './types.js';
import {
  buildSchemaHashes,
  compareSchemas,
  readLockFile,
  LOCK_FILE_NAME,
} from '../lock/index.js';
import { generateHclSchema, renderHcl } from '../hcl/index.js';
import { diffHclSchemas, checkAtlasVersion } from '../atlas/index.js';
import { parseDiffOutput, formatDiffSummary } from '../diff/index.js';
import { join } from 'node:path';
import { atlasNotFoundError } from '@famgia/omnify-core';

/**
 * Generates a change preview for schemas.
 */
export async function generatePreview(
  schemas: SchemaCollection,
  atlasConfig: AtlasConfig,
  options: PreviewOptions = {}
): Promise<ChangePreview> {
  // Check Atlas availability
  const atlasVersion = await checkAtlasVersion(atlasConfig);
  if (!atlasVersion.available) {
    throw atlasNotFoundError();
  }

  // Build current schema hashes
  const currentHashes = await buildSchemaHashes(schemas);

  // Read existing lock file
  const lockFilePath = join(atlasConfig.workDir ?? process.cwd(), LOCK_FILE_NAME);
  const existingLockFile = await readLockFile(lockFilePath);

  // Compare schema files
  const schemaChanges = compareSchemas(currentHashes, existingLockFile);

  // Generate current HCL
  const currentHcl = renderHcl(
    generateHclSchema(schemas, {
      driver: atlasConfig.driver,
    })
  );

  // Get previous HCL from lock file or empty
  let previousHcl: string | null = null;
  if (existingLockFile?.hclChecksum) {
    // For now, we regenerate from scratch each time
    // In production, we might cache the HCL
    previousHcl = null;
  }

  // Run Atlas diff
  const atlasDiff = await diffHclSchemas(atlasConfig, previousHcl, currentHcl);

  // Parse diff output
  const databaseChanges = parseDiffOutput(atlasDiff.sql);

  // Build summary
  const summary = buildSummary(schemaChanges, databaseChanges, options);

  return {
    hasChanges: schemaChanges.hasChanges || databaseChanges.hasChanges,
    hasDestructiveChanges: databaseChanges.hasDestructiveChanges,
    schemaChanges,
    databaseChanges,
    summary,
    sql: atlasDiff.sql,
  };
}

/**
 * Builds a human-readable summary.
 */
function buildSummary(
  schemaChanges: { hasChanges: boolean; changes: readonly { schemaName: string; changeType: string }[] },
  databaseChanges: { hasChanges: boolean; hasDestructiveChanges: boolean; summary: { totalStatements: number } },
  options: PreviewOptions
): string {
  const lines: string[] = [];

  if (!schemaChanges.hasChanges && !databaseChanges.hasChanges) {
    return 'No changes detected. Schema is up to date.';
  }

  // Schema file changes
  if (schemaChanges.hasChanges) {
    lines.push('Schema file changes:');
    for (const change of schemaChanges.changes) {
      const icon =
        change.changeType === 'added'
          ? '+'
          : change.changeType === 'removed'
            ? '-'
            : '~';
      lines.push(`  ${icon} ${change.schemaName} (${change.changeType})`);
    }
    lines.push('');
  }

  // Database changes
  if (databaseChanges.hasChanges) {
    lines.push(formatDiffSummary(databaseChanges as any));
  }

  // Destructive warning
  if (options.warnDestructive && databaseChanges.hasDestructiveChanges) {
    lines.push('');
    lines.push('⚠️  WARNING: This preview contains destructive changes!');
    lines.push('   Review carefully before generating migrations.');
  }

  return lines.join('\n');
}

/**
 * Previews changes without running Atlas (schema files only).
 */
export async function previewSchemaChanges(
  schemas: SchemaCollection,
  lockFilePath: string
): Promise<{ hasChanges: boolean; changes: readonly { schemaName: string; changeType: string }[] }> {
  const currentHashes = await buildSchemaHashes(schemas);
  const existingLockFile = await readLockFile(lockFilePath);
  return compareSchemas(currentHashes, existingLockFile);
}

/**
 * Formats preview for display.
 */
export function formatPreview(
  preview: ChangePreview,
  format: PreviewFormat = 'text'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(preview, null, 2);

    case 'minimal':
      if (!preview.hasChanges) {
        return 'No changes';
      }
      const parts: string[] = [];
      const { summary } = preview.databaseChanges;
      if (summary.tablesCreated > 0) parts.push(`+${summary.tablesCreated} tables`);
      if (summary.tablesDropped > 0) parts.push(`-${summary.tablesDropped} tables`);
      if (summary.columnsAdded > 0) parts.push(`+${summary.columnsAdded} columns`);
      if (summary.columnsDropped > 0) parts.push(`-${summary.columnsDropped} columns`);
      return parts.join(', ') || 'Changes detected';

    case 'text':
    default:
      return preview.summary;
  }
}

/**
 * Checks if preview has blocking issues.
 */
export function hasBlockingIssues(_preview: ChangePreview): boolean {
  // Currently, we don't block on any issues
  // This could be extended to check for specific conditions
  return false;
}
