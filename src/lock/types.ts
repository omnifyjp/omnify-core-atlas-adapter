/**
 * @famgia/omnify-atlas - Lock File Types
 *
 * Types for the .omnify.lock file that tracks schema state.
 */

/**
 * Property snapshot for lock file (normalized structure).
 */
export interface PropertySnapshot {
  readonly type: string;
  readonly nullable?: boolean | undefined;
  readonly unique?: boolean | undefined;
  readonly default?: unknown;
  readonly length?: number | undefined;
  readonly unsigned?: boolean | undefined;
  /** Total number of digits for Decimal type (default: 8) */
  readonly precision?: number | undefined;
  /** Number of decimal places for Decimal type (default: 2) */
  readonly scale?: number | undefined;
  readonly enum?: readonly string[] | undefined;
  // Association fields
  readonly relation?: string | undefined;
  readonly target?: string | undefined;
  readonly onDelete?: string | undefined;
  readonly onUpdate?: string | undefined;
  readonly mappedBy?: string | undefined;
  readonly joinTable?: string | undefined;
  /** Pivot table fields for ManyToMany relationships */
  readonly pivotFields?: Record<string, {
    type: string;
    nullable?: boolean;
    default?: unknown;
    length?: number;
    unsigned?: boolean;
  }> | undefined;
  // Rename tracking (used during migration, then removed)
  readonly renamedFrom?: string | undefined;
  // Laravel-specific fields
  /** Laravel: hidden in serialization */
  readonly hidden?: boolean | undefined;
  /** Laravel: mass assignable */
  readonly fillable?: boolean | undefined;
  /** Per-field overrides for compound types */
  readonly fields?: Record<string, { nullable?: boolean; hidden?: boolean; fillable?: boolean }> | undefined;
}

/**
 * Index snapshot for lock file.
 */
export interface IndexSnapshot {
  readonly columns: readonly string[];
  readonly unique: boolean;
  readonly name?: string | undefined;
}

/**
 * Full schema snapshot for change detection.
 */
export interface SchemaSnapshot {
  /** Schema name */
  readonly name: string;
  /** Schema kind (object, enum) */
  readonly kind: string;
  /** Content hash (SHA-256) for quick comparison */
  readonly hash: string;
  /** File path relative to schemas directory */
  readonly relativePath: string;
  /** Last modified timestamp (ISO 8601) */
  readonly modifiedAt: string;
  /** Whether auto-generated ID is enabled (default: true) */
  readonly id?: boolean | undefined;
  /** ID column type */
  readonly idType?: string | undefined;
  /** Properties snapshot */
  readonly properties: Record<string, PropertySnapshot>;
  /** Timestamps enabled */
  readonly timestamps?: boolean | undefined;
  /** Soft delete enabled */
  readonly softDelete?: boolean | undefined;
  /** Custom indexes */
  readonly indexes?: readonly IndexSnapshot[] | undefined;
  /** Unique constraints (composite) */
  readonly uniqueConstraints?: readonly (readonly string[])[] | undefined;
  /** Enum values (for enum schemas) */
  readonly values?: readonly string[] | undefined;
}

/**
 * Hash of a schema for change detection (legacy v1 format).
 */
export interface SchemaHash {
  /** Schema name */
  readonly name: string;
  /** Content hash (SHA-256) */
  readonly hash: string;
  /** File path relative to schemas directory */
  readonly relativePath: string;
  /** Last modified timestamp (ISO 8601) */
  readonly modifiedAt: string;
}

/**
 * Generated migration record.
 * Enhanced for team development with file tracking and regeneration support.
 * Note: timestamp, tableName, type are optional for backwards compatibility with v1 lock files.
 */
export interface GeneratedMigration {
  /** Migration file name (e.g., "2026_01_13_100000_create_users_table.php") */
  readonly fileName: string;
  /** Migration timestamp prefix for regeneration (e.g., "2026_01_13_100000") - Optional for backwards compatibility */
  readonly timestamp?: string | undefined;
  /** Table name for lookup (e.g., "users") - Optional for backwards compatibility */
  readonly tableName?: string | undefined;
  /** Migration type - Optional for backwards compatibility */
  readonly type?: 'create' | 'alter' | 'drop' | 'pivot' | undefined;
  /** Timestamp when generated (ISO 8601) */
  readonly generatedAt: string;
  /** Schemas involved in this migration */
  readonly schemas: readonly string[];
  /** Migration content checksum (SHA-256) for integrity verification */
  readonly checksum: string;
}

/**
 * Migration validation result.
 */
export interface MigrationValidation {
  /** Whether all migrations are valid */
  readonly valid: boolean;
  /** List of missing migration files */
  readonly missingFiles: readonly string[];
  /** List of migrations with checksum mismatch (file modified) */
  readonly modifiedFiles: readonly string[];
  /** List of stale migrations (old timestamp, recently added to repo) */
  readonly staleFiles: readonly string[];
  /** Total migrations tracked */
  readonly totalTracked: number;
  /** Total migrations found on disk */
  readonly totalOnDisk: number;
}

/**
 * Lock file structure for tracking schema state (v1 - legacy).
 */
export interface LockFileV1 {
  /** Lock file format version */
  readonly version: 1;
  /** When the lock file was last updated */
  readonly updatedAt: string;
  /** Database driver used */
  readonly driver: string;
  /** Hash of each schema */
  readonly schemas: Record<string, SchemaHash>;
  /** Record of generated migrations */
  readonly migrations: readonly GeneratedMigration[];
  /** HCL checksum for Atlas comparison */
  readonly hclChecksum?: string | undefined;
}

/**
 * Lock file structure for tracking schema state (v2 - with snapshots).
 */
export interface LockFileV2 {
  /** Lock file format version */
  readonly version: 2;
  /** When the lock file was last updated */
  readonly updatedAt: string;
  /** Database driver used */
  readonly driver: string;
  /** Full schema snapshots for diff */
  readonly schemas: Record<string, SchemaSnapshot>;
  /** Record of generated migrations */
  readonly migrations: readonly GeneratedMigration[];
  /** HCL checksum for Atlas comparison */
  readonly hclChecksum?: string | undefined;
}

/**
 * Union of all lock file versions.
 */
export type LockFile = LockFileV1 | LockFileV2;

/**
 * Schema change type.
 */
export type ChangeType = 'added' | 'modified' | 'removed';

/**
 * Column change details.
 */
export interface ColumnChange {
  readonly column: string;
  readonly changeType: 'added' | 'removed' | 'modified' | 'renamed';
  readonly previousDef?: PropertySnapshot | undefined;
  readonly currentDef?: PropertySnapshot | undefined;
  /** Specific modifications for 'modified' type */
  readonly modifications?: readonly string[] | undefined;
  /** Previous column name for 'renamed' type */
  readonly previousColumn?: string | undefined;
}

/**
 * Index change details.
 */
export interface IndexChange {
  readonly changeType: 'added' | 'removed';
  readonly index: IndexSnapshot;
}

/**
 * Detailed schema change with column-level diff.
 */
export interface SchemaChange {
  /** Schema name */
  readonly schemaName: string;
  /** Type of change */
  readonly changeType: ChangeType;
  /** Previous hash (for modified/removed) */
  readonly previousHash?: string | undefined;
  /** Current hash (for added/modified) */
  readonly currentHash?: string | undefined;
  /** Column-level changes (for modified schemas) */
  readonly columnChanges?: readonly ColumnChange[] | undefined;
  /** Index-level changes (for modified schemas) */
  readonly indexChanges?: readonly IndexChange[] | undefined;
  /** Options changes */
  readonly optionChanges?: {
    readonly timestamps?: { from?: boolean; to?: boolean };
    readonly softDelete?: { from?: boolean; to?: boolean };
    readonly id?: { from?: boolean; to?: boolean };
    readonly idType?: { from?: string; to?: string };
  } | undefined;
}

/**
 * Result of comparing current schemas to lock file.
 */
export interface LockFileComparison {
  /** Whether any changes were detected */
  readonly hasChanges: boolean;
  /** List of detected changes */
  readonly changes: readonly SchemaChange[];
  /** Schemas that are unchanged */
  readonly unchanged: readonly string[];
}
