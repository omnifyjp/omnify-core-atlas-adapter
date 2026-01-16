/**
 * @famgia/omnify-atlas - Diff Parser
 *
 * Parses Atlas SQL diff output into structured format.
 */

import type {
  ParsedStatement,
  TableChange,
  DiffResult,
  DiffSummary,
} from './types.js';

/**
 * Regex patterns for parsing SQL statements.
 */
const PATTERNS = {
  createTable: /^CREATE TABLE\s+[`"]?(\w+)[`"]?/i,
  dropTable: /^DROP TABLE\s+(?:IF EXISTS\s+)?[`"]?(\w+)[`"]?/i,
  alterTable: /^ALTER TABLE\s+[`"]?(\w+)[`"]?/i,
  addColumn: /ADD\s+(?:COLUMN\s+)?[`"]?(\w+)[`"]?/i,
  dropColumn: /DROP\s+(?:COLUMN\s+)?[`"]?(\w+)[`"]?/i,
  modifyColumn: /MODIFY\s+(?:COLUMN\s+)?[`"]?(\w+)[`"]?/i,
  changeColumn: /CHANGE\s+(?:COLUMN\s+)?[`"]?(\w+)[`"]?/i,
  alterColumn: /ALTER\s+(?:COLUMN\s+)?[`"]?(\w+)[`"]?/i,
  createIndex: /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+[`"]?(\w+)[`"]?\s+ON\s+[`"]?(\w+)[`"]?/i,
  dropIndex: /^DROP\s+INDEX\s+[`"]?(\w+)[`"]?(?:\s+ON\s+[`"]?(\w+)[`"]?)?/i,
  addConstraint: /ADD\s+CONSTRAINT\s+[`"]?(\w+)[`"]?/i,
  dropConstraint: /DROP\s+CONSTRAINT\s+[`"]?(\w+)[`"]?/i,
  addForeignKey: /ADD\s+(?:CONSTRAINT\s+[`"]?\w+[`"]?\s+)?FOREIGN KEY/i,
  dropForeignKey: /DROP\s+FOREIGN KEY\s+[`"]?(\w+)[`"]?/i,
};


/**
 * Splits SQL into individual statements.
 */
function splitStatements(sql: string): string[] {
  // Split by semicolons, but handle edge cases
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];

    // Track string literals
    if ((char === "'" || char === '"') && sql[i - 1] !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    // Split on semicolons outside strings
    if (char === ';' && !inString) {
      const stmt = current.trim();
      if (stmt) {
        statements.push(stmt);
      }
      current = '';
    } else {
      current += char;
    }
  }

  // Add final statement
  const final = current.trim();
  if (final) {
    statements.push(final);
  }

  return statements;
}

/**
 * Parses a single SQL statement.
 */
function parseStatement(sql: string): ParsedStatement {
  const trimmedSql = sql.trim();

  // CREATE TABLE
  let match = trimmedSql.match(PATTERNS.createTable);
  if (match && match[1]) {
    return {
      sql: trimmedSql,
      type: 'CREATE_TABLE',
      tableName: match[1],
      severity: 'safe',
    };
  }

  // DROP TABLE
  match = trimmedSql.match(PATTERNS.dropTable);
  if (match && match[1]) {
    return {
      sql: trimmedSql,
      type: 'DROP_TABLE',
      tableName: match[1],
      severity: 'destructive',
    };
  }

  // CREATE INDEX
  match = trimmedSql.match(PATTERNS.createIndex);
  if (match && match[1] && match[2]) {
    return {
      sql: trimmedSql,
      type: 'CREATE_INDEX',
      tableName: match[2],
      indexName: match[1],
      severity: 'safe',
    };
  }

  // DROP INDEX
  match = trimmedSql.match(PATTERNS.dropIndex);
  if (match && match[1]) {
    return {
      sql: trimmedSql,
      type: 'DROP_INDEX',
      tableName: match[2] ?? '',
      indexName: match[1],
      severity: 'warning',
    };
  }

  // ALTER TABLE
  match = trimmedSql.match(PATTERNS.alterTable);
  if (match && match[1]) {
    const tableName = match[1];
    const alterPart = trimmedSql.slice(match[0].length);

    // ADD COLUMN
    const addColMatch = alterPart.match(PATTERNS.addColumn);
    if (addColMatch && addColMatch[1]) {
      return {
        sql: trimmedSql,
        type: 'ADD_COLUMN',
        tableName,
        columnName: addColMatch[1],
        severity: 'safe',
      };
    }

    // DROP COLUMN
    const dropColMatch = alterPart.match(PATTERNS.dropColumn);
    if (dropColMatch && dropColMatch[1]) {
      return {
        sql: trimmedSql,
        type: 'DROP_COLUMN',
        tableName,
        columnName: dropColMatch[1],
        severity: 'destructive',
      };
    }

    // MODIFY COLUMN
    const modifyColMatch =
      alterPart.match(PATTERNS.modifyColumn) ||
      alterPart.match(PATTERNS.changeColumn) ||
      alterPart.match(PATTERNS.alterColumn);
    if (modifyColMatch && modifyColMatch[1]) {
      return {
        sql: trimmedSql,
        type: 'MODIFY_COLUMN',
        tableName,
        columnName: modifyColMatch[1],
        severity: 'warning',
      };
    }

    // ADD FOREIGN KEY
    if (PATTERNS.addForeignKey.test(alterPart)) {
      const constraintMatch = alterPart.match(PATTERNS.addConstraint);
      const fkConstraintName = constraintMatch?.[1];
      if (fkConstraintName) {
        return {
          sql: trimmedSql,
          type: 'ADD_FOREIGN_KEY',
          tableName,
          constraintName: fkConstraintName,
          severity: 'safe',
        };
      }
      // FK without explicit constraint name
      return {
        sql: trimmedSql,
        type: 'ADD_FOREIGN_KEY',
        tableName,
        severity: 'safe',
      };
    }

    // DROP FOREIGN KEY
    const dropFkMatch = alterPart.match(PATTERNS.dropForeignKey);
    if (dropFkMatch && dropFkMatch[1]) {
      return {
        sql: trimmedSql,
        type: 'DROP_FOREIGN_KEY',
        tableName,
        constraintName: dropFkMatch[1],
        severity: 'warning',
      };
    }

    // ADD CONSTRAINT
    const addConstraintMatch = alterPart.match(PATTERNS.addConstraint);
    if (addConstraintMatch && addConstraintMatch[1]) {
      return {
        sql: trimmedSql,
        type: 'ADD_CONSTRAINT',
        tableName,
        constraintName: addConstraintMatch[1],
        severity: 'safe',
      };
    }

    // DROP CONSTRAINT
    const dropConstraintMatch = alterPart.match(PATTERNS.dropConstraint);
    if (dropConstraintMatch && dropConstraintMatch[1]) {
      return {
        sql: trimmedSql,
        type: 'DROP_CONSTRAINT',
        tableName,
        constraintName: dropConstraintMatch[1],
        severity: 'warning',
      };
    }

    // Generic ALTER TABLE
    return {
      sql: trimmedSql,
      type: 'ALTER_TABLE',
      tableName,
      severity: 'warning',
    };
  }

  // Unknown statement
  return {
    sql: trimmedSql,
    type: 'UNKNOWN',
    tableName: '',
    severity: 'warning',
  };
}

/**
 * Creates a new empty table change entry.
 */
function createEmptyTableChange(tableName: string): TableChange {
  return {
    tableName,
    isNew: false,
    isDropped: false,
    addedColumns: [],
    droppedColumns: [],
    modifiedColumns: [],
    addedIndexes: [],
    droppedIndexes: [],
    addedForeignKeys: [],
    droppedForeignKeys: [],
  };
}

/**
 * Gets or creates a table change entry.
 */
function getOrCreateTable(
  tables: Record<string, TableChange>,
  tableName: string
): TableChange {
  const existing = tables[tableName];
  if (existing) {
    return existing;
  }
  const newTable = createEmptyTableChange(tableName);
  tables[tableName] = newTable;
  return newTable;
}

/**
 * Groups statements by table.
 */
function groupByTable(statements: ParsedStatement[]): Record<string, TableChange> {
  const tables: Record<string, TableChange> = {};

  for (const stmt of statements) {
    if (!stmt.tableName) continue;

    const table = getOrCreateTable(tables, stmt.tableName);

    switch (stmt.type) {
      case 'CREATE_TABLE':
        tables[stmt.tableName] = { ...table, isNew: true };
        break;
      case 'DROP_TABLE':
        tables[stmt.tableName] = { ...table, isDropped: true };
        break;
      case 'ADD_COLUMN':
        if (stmt.columnName) {
          tables[stmt.tableName] = {
            ...table,
            addedColumns: [...table.addedColumns, stmt.columnName],
          };
        }
        break;
      case 'DROP_COLUMN':
        if (stmt.columnName) {
          tables[stmt.tableName] = {
            ...table,
            droppedColumns: [...table.droppedColumns, stmt.columnName],
          };
        }
        break;
      case 'MODIFY_COLUMN':
        if (stmt.columnName) {
          tables[stmt.tableName] = {
            ...table,
            modifiedColumns: [...table.modifiedColumns, stmt.columnName],
          };
        }
        break;
      case 'CREATE_INDEX':
        if (stmt.indexName) {
          tables[stmt.tableName] = {
            ...table,
            addedIndexes: [...table.addedIndexes, stmt.indexName],
          };
        }
        break;
      case 'DROP_INDEX':
        if (stmt.indexName) {
          tables[stmt.tableName] = {
            ...table,
            droppedIndexes: [...table.droppedIndexes, stmt.indexName],
          };
        }
        break;
      case 'ADD_FOREIGN_KEY':
        tables[stmt.tableName] = {
          ...table,
          addedForeignKeys: [
            ...table.addedForeignKeys,
            stmt.constraintName ?? 'unnamed',
          ],
        };
        break;
      case 'DROP_FOREIGN_KEY':
        if (stmt.constraintName) {
          tables[stmt.tableName] = {
            ...table,
            droppedForeignKeys: [...table.droppedForeignKeys, stmt.constraintName],
          };
        }
        break;
    }
  }

  return tables;
}

/**
 * Calculates summary statistics.
 */
function calculateSummary(statements: ParsedStatement[]): DiffSummary {
  return {
    totalStatements: statements.length,
    tablesCreated: statements.filter((s) => s.type === 'CREATE_TABLE').length,
    tablesDropped: statements.filter((s) => s.type === 'DROP_TABLE').length,
    tablesAltered: statements.filter((s) => s.type === 'ALTER_TABLE').length,
    columnsAdded: statements.filter((s) => s.type === 'ADD_COLUMN').length,
    columnsDropped: statements.filter((s) => s.type === 'DROP_COLUMN').length,
    columnsModified: statements.filter((s) => s.type === 'MODIFY_COLUMN').length,
    indexesAdded: statements.filter((s) => s.type === 'CREATE_INDEX').length,
    indexesDropped: statements.filter((s) => s.type === 'DROP_INDEX').length,
    foreignKeysAdded: statements.filter((s) => s.type === 'ADD_FOREIGN_KEY').length,
    foreignKeysDropped: statements.filter((s) => s.type === 'DROP_FOREIGN_KEY').length,
  };
}

/**
 * Parses Atlas SQL diff output.
 */
export function parseDiffOutput(sql: string): DiffResult {
  const trimmedSql = sql.trim();

  // Handle empty or no-change output
  if (!trimmedSql || trimmedSql === '-- No changes') {
    return {
      hasChanges: false,
      hasDestructiveChanges: false,
      statements: [],
      tableChanges: {},
      summary: {
        totalStatements: 0,
        tablesCreated: 0,
        tablesDropped: 0,
        tablesAltered: 0,
        columnsAdded: 0,
        columnsDropped: 0,
        columnsModified: 0,
        indexesAdded: 0,
        indexesDropped: 0,
        foreignKeysAdded: 0,
        foreignKeysDropped: 0,
      },
      rawSql: trimmedSql,
    };
  }

  // Filter out comments
  const sqlWithoutComments = trimmedSql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  // Split and parse statements
  const rawStatements = splitStatements(sqlWithoutComments);
  const statements = rawStatements.map(parseStatement);

  // Check for destructive changes
  const hasDestructiveChanges = statements.some(
    (s) => s.severity === 'destructive'
  );

  return {
    hasChanges: statements.length > 0,
    hasDestructiveChanges,
    statements,
    tableChanges: groupByTable(statements),
    summary: calculateSummary(statements),
    rawSql: trimmedSql,
  };
}

/**
 * Formats diff result for display.
 */
export function formatDiffSummary(result: DiffResult): string {
  if (!result.hasChanges) {
    return 'No schema changes detected.';
  }

  const lines: string[] = ['Schema changes detected:'];
  const { summary } = result;

  if (summary.tablesCreated > 0) {
    lines.push(`  + ${summary.tablesCreated} table(s) created`);
  }
  if (summary.tablesDropped > 0) {
    lines.push(`  - ${summary.tablesDropped} table(s) dropped [DESTRUCTIVE]`);
  }
  if (summary.columnsAdded > 0) {
    lines.push(`  + ${summary.columnsAdded} column(s) added`);
  }
  if (summary.columnsDropped > 0) {
    lines.push(`  - ${summary.columnsDropped} column(s) dropped [DESTRUCTIVE]`);
  }
  if (summary.columnsModified > 0) {
    lines.push(`  ~ ${summary.columnsModified} column(s) modified`);
  }
  if (summary.indexesAdded > 0) {
    lines.push(`  + ${summary.indexesAdded} index(es) added`);
  }
  if (summary.indexesDropped > 0) {
    lines.push(`  - ${summary.indexesDropped} index(es) dropped`);
  }
  if (summary.foreignKeysAdded > 0) {
    lines.push(`  + ${summary.foreignKeysAdded} foreign key(s) added`);
  }
  if (summary.foreignKeysDropped > 0) {
    lines.push(`  - ${summary.foreignKeysDropped} foreign key(s) dropped`);
  }

  lines.push('');
  lines.push(`Total: ${summary.totalStatements} statement(s)`);

  if (result.hasDestructiveChanges) {
    lines.push('');
    lines.push('WARNING: This diff contains destructive changes!');
  }

  return lines.join('\n');
}
