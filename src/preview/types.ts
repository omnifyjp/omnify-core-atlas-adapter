/**
 * @famgia/omnify-atlas - Preview Types
 *
 * Types for schema change preview.
 */

import type { DiffResult } from '../diff/types.js';
import type { LockFileComparison } from '../lock/types.js';

/**
 * Options for change preview.
 */
export interface PreviewOptions {
  /** Whether to show raw SQL output */
  readonly showSql?: boolean;
  /** Whether to show detailed table changes */
  readonly showDetails?: boolean;
  /** Whether to include warnings for destructive changes */
  readonly warnDestructive?: boolean;
}

/**
 * Complete change preview result.
 */
export interface ChangePreview {
  /** Whether any changes were detected */
  readonly hasChanges: boolean;
  /** Whether there are destructive changes */
  readonly hasDestructiveChanges: boolean;
  /** Schema file changes (from lock file comparison) */
  readonly schemaChanges: LockFileComparison;
  /** Database schema changes (from Atlas diff) */
  readonly databaseChanges: DiffResult;
  /** Human-readable summary */
  readonly summary: string;
  /** Raw SQL for changes */
  readonly sql: string;
}

/**
 * Preview display format.
 */
export type PreviewFormat = 'text' | 'json' | 'minimal';
