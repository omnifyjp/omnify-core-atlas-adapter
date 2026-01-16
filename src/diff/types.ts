/**
 * @famgia/omnify-atlas - Diff Types
 *
 * Types for parsed schema diff results.
 */

/**
 * Type of SQL operation.
 */
export type SqlOperationType =
  | 'CREATE_TABLE'
  | 'DROP_TABLE'
  | 'ALTER_TABLE'
  | 'CREATE_INDEX'
  | 'DROP_INDEX'
  | 'ADD_COLUMN'
  | 'DROP_COLUMN'
  | 'MODIFY_COLUMN'
  | 'ADD_FOREIGN_KEY'
  | 'DROP_FOREIGN_KEY'
  | 'ADD_CONSTRAINT'
  | 'DROP_CONSTRAINT'
  | 'UNKNOWN';

/**
 * Severity of a change.
 */
export type ChangeSeverity = 'safe' | 'warning' | 'destructive';

/**
 * A single parsed SQL statement.
 */
export interface ParsedStatement {
  /** Original SQL statement */
  readonly sql: string;
  /** Type of operation */
  readonly type: SqlOperationType;
  /** Table name affected */
  readonly tableName: string;
  /** Column name (if applicable) */
  readonly columnName?: string;
  /** Index name (if applicable) */
  readonly indexName?: string;
  /** Constraint name (if applicable) */
  readonly constraintName?: string;
  /** Severity of the change */
  readonly severity: ChangeSeverity;
}

/**
 * Table change summary.
 */
export interface TableChange {
  /** Table name */
  readonly tableName: string;
  /** Whether the table is new */
  readonly isNew: boolean;
  /** Whether the table is being dropped */
  readonly isDropped: boolean;
  /** Columns being added */
  readonly addedColumns: readonly string[];
  /** Columns being dropped */
  readonly droppedColumns: readonly string[];
  /** Columns being modified */
  readonly modifiedColumns: readonly string[];
  /** Indexes being added */
  readonly addedIndexes: readonly string[];
  /** Indexes being dropped */
  readonly droppedIndexes: readonly string[];
  /** Foreign keys being added */
  readonly addedForeignKeys: readonly string[];
  /** Foreign keys being dropped */
  readonly droppedForeignKeys: readonly string[];
}

/**
 * Complete diff result.
 */
export interface DiffResult {
  /** Whether there are any changes */
  readonly hasChanges: boolean;
  /** Whether there are destructive changes */
  readonly hasDestructiveChanges: boolean;
  /** All parsed statements */
  readonly statements: readonly ParsedStatement[];
  /** Changes grouped by table */
  readonly tableChanges: Record<string, TableChange>;
  /** Summary counts */
  readonly summary: DiffSummary;
  /** Raw SQL output */
  readonly rawSql: string;
}

/**
 * Summary of changes.
 */
export interface DiffSummary {
  /** Total statement count */
  readonly totalStatements: number;
  /** Tables created */
  readonly tablesCreated: number;
  /** Tables dropped */
  readonly tablesDropped: number;
  /** Tables altered */
  readonly tablesAltered: number;
  /** Columns added */
  readonly columnsAdded: number;
  /** Columns dropped */
  readonly columnsDropped: number;
  /** Columns modified */
  readonly columnsModified: number;
  /** Indexes added */
  readonly indexesAdded: number;
  /** Indexes dropped */
  readonly indexesDropped: number;
  /** Foreign keys added */
  readonly foreignKeysAdded: number;
  /** Foreign keys dropped */
  readonly foreignKeysDropped: number;
}
