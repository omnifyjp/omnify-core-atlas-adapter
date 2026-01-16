/**
 * @famgia/omnify-atlas - HCL Types
 *
 * Types for Atlas HCL schema generation.
 */

import type { DatabaseDriver } from '@famgia/omnify-types';

/**
 * SQL column type for a specific database driver.
 */
export interface SqlColumnType {
  /** The SQL type (e.g., 'varchar(255)', 'int', 'text') */
  readonly type: string;
  /** Whether the column is nullable */
  readonly nullable: boolean;
  /** Default value (if any) */
  readonly default?: string | undefined;
  /** Whether this is an auto-increment column */
  readonly autoIncrement?: boolean | undefined;
  /** Whether this column is unsigned (for numeric types) */
  readonly unsigned?: boolean | undefined;
}

/**
 * HCL column definition.
 */
export interface HclColumn {
  /** Column name */
  readonly name: string;
  /** SQL type info */
  readonly type: SqlColumnType;
  /** Whether this is a primary key */
  readonly primaryKey?: boolean;
  /** Whether this column has a unique constraint */
  readonly unique?: boolean;
}

/**
 * HCL index definition.
 */
export interface HclIndex {
  /** Index name */
  readonly name: string;
  /** Columns in the index */
  readonly columns: readonly string[];
  /** Whether this is a unique index */
  readonly unique?: boolean;
}

/**
 * HCL foreign key definition.
 */
export interface HclForeignKey {
  /** Foreign key constraint name */
  readonly name: string;
  /** Local column(s) */
  readonly columns: readonly string[];
  /** Referenced table */
  readonly refTable: string;
  /** Referenced column(s) */
  readonly refColumns: readonly string[];
  /** ON DELETE action */
  readonly onDelete?: string;
  /** ON UPDATE action */
  readonly onUpdate?: string;
}

/**
 * HCL table definition.
 */
export interface HclTable {
  /** Table name */
  readonly name: string;
  /** Table columns */
  readonly columns: readonly HclColumn[];
  /** Table indexes */
  readonly indexes: readonly HclIndex[];
  /** Foreign key constraints */
  readonly foreignKeys: readonly HclForeignKey[];
  /** Primary key columns (if composite) */
  readonly primaryKey?: readonly string[];
}

/**
 * HCL enum definition.
 */
export interface HclEnum {
  /** Enum name */
  readonly name: string;
  /** Enum values */
  readonly values: readonly string[];
}

/**
 * Complete HCL schema.
 */
export interface HclSchema {
  /** Database driver */
  readonly driver: DatabaseDriver;
  /** Schema/database name */
  readonly schemaName?: string | undefined;
  /** Tables in the schema */
  readonly tables: readonly HclTable[];
  /** Enums in the schema (PostgreSQL) */
  readonly enums: readonly HclEnum[];
}

/**
 * Options for HCL generation.
 */
export interface HclGenerationOptions {
  /** Database driver */
  readonly driver: DatabaseDriver;
  /** Schema/database name */
  readonly schemaName?: string;
  /** Whether to include soft delete column */
  readonly includeSoftDelete?: boolean;
  /** Whether to include timestamps */
  readonly includeTimestamps?: boolean;
}
