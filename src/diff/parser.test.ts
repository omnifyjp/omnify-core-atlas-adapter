/**
 * @famgia/omnify-atlas - Diff Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { parseDiffOutput, formatDiffSummary } from './parser.js';

describe('parseDiffOutput', () => {
  it('handles empty output', () => {
    const result = parseDiffOutput('');
    expect(result.hasChanges).toBe(false);
    expect(result.statements).toHaveLength(0);
  });

  it('handles no changes message', () => {
    const result = parseDiffOutput('-- No changes');
    expect(result.hasChanges).toBe(false);
  });

  it('parses CREATE TABLE statement', () => {
    const sql = 'CREATE TABLE users (id int, name varchar(255));';
    const result = parseDiffOutput(sql);

    expect(result.hasChanges).toBe(true);
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].type).toBe('CREATE_TABLE');
    expect(result.statements[0].tableName).toBe('users');
    expect(result.statements[0].severity).toBe('safe');
  });

  it('parses DROP TABLE statement', () => {
    const sql = 'DROP TABLE IF EXISTS users;';
    const result = parseDiffOutput(sql);

    expect(result.statements[0].type).toBe('DROP_TABLE');
    expect(result.statements[0].severity).toBe('destructive');
    expect(result.hasDestructiveChanges).toBe(true);
  });

  it('parses ALTER TABLE ADD COLUMN', () => {
    const sql = 'ALTER TABLE users ADD COLUMN email varchar(255);';
    const result = parseDiffOutput(sql);

    expect(result.statements[0].type).toBe('ADD_COLUMN');
    expect(result.statements[0].tableName).toBe('users');
    expect(result.statements[0].columnName).toBe('email');
    expect(result.statements[0].severity).toBe('safe');
  });

  it('parses ALTER TABLE DROP COLUMN', () => {
    const sql = 'ALTER TABLE users DROP COLUMN email;';
    const result = parseDiffOutput(sql);

    expect(result.statements[0].type).toBe('DROP_COLUMN');
    expect(result.statements[0].columnName).toBe('email');
    expect(result.statements[0].severity).toBe('destructive');
  });

  it('parses ALTER TABLE MODIFY COLUMN', () => {
    const sql = 'ALTER TABLE users MODIFY COLUMN name varchar(500);';
    const result = parseDiffOutput(sql);

    expect(result.statements[0].type).toBe('MODIFY_COLUMN');
    expect(result.statements[0].columnName).toBe('name');
    expect(result.statements[0].severity).toBe('warning');
  });

  it('parses CREATE INDEX', () => {
    const sql = 'CREATE INDEX idx_users_email ON users (email);';
    const result = parseDiffOutput(sql);

    expect(result.statements[0].type).toBe('CREATE_INDEX');
    expect(result.statements[0].tableName).toBe('users');
    expect(result.statements[0].indexName).toBe('idx_users_email');
  });

  it('parses CREATE UNIQUE INDEX', () => {
    const sql = 'CREATE UNIQUE INDEX idx_users_email_unique ON users (email);';
    const result = parseDiffOutput(sql);

    expect(result.statements[0].type).toBe('CREATE_INDEX');
    expect(result.statements[0].indexName).toBe('idx_users_email_unique');
  });

  it('parses DROP INDEX', () => {
    const sql = 'DROP INDEX idx_users_email ON users;';
    const result = parseDiffOutput(sql);

    expect(result.statements[0].type).toBe('DROP_INDEX');
    expect(result.statements[0].indexName).toBe('idx_users_email');
  });

  it('parses multiple statements', () => {
    const sql = `
      CREATE TABLE users (id int);
      ALTER TABLE users ADD COLUMN name varchar(255);
      CREATE INDEX idx_users_name ON users (name);
    `;
    const result = parseDiffOutput(sql);

    expect(result.statements).toHaveLength(3);
    expect(result.summary.tablesCreated).toBe(1);
    expect(result.summary.columnsAdded).toBe(1);
    expect(result.summary.indexesAdded).toBe(1);
  });

  it('filters out comments', () => {
    const sql = `
      -- This is a comment
      CREATE TABLE users (id int);
      -- Another comment
    `;
    const result = parseDiffOutput(sql);

    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].type).toBe('CREATE_TABLE');
  });

  it('groups changes by table', () => {
    const sql = `
      CREATE TABLE users (id int);
      ALTER TABLE users ADD COLUMN email varchar(255);
      ALTER TABLE users ADD COLUMN name varchar(255);
    `;
    const result = parseDiffOutput(sql);

    expect(result.tableChanges['users']).toBeDefined();
    expect(result.tableChanges['users'].isNew).toBe(true);
    expect(result.tableChanges['users'].addedColumns).toEqual(['email', 'name']);
  });

  it('calculates summary correctly', () => {
    const sql = `
      CREATE TABLE users (id int);
      CREATE TABLE posts (id int);
      ALTER TABLE users ADD COLUMN email varchar(255);
      DROP TABLE old_table;
    `;
    const result = parseDiffOutput(sql);

    expect(result.summary.tablesCreated).toBe(2);
    expect(result.summary.tablesDropped).toBe(1);
    expect(result.summary.columnsAdded).toBe(1);
    expect(result.summary.totalStatements).toBe(4);
  });
});

describe('formatDiffSummary', () => {
  it('formats no changes message', () => {
    const result = parseDiffOutput('');
    const formatted = formatDiffSummary(result);

    expect(formatted).toContain('No schema changes');
  });

  it('formats changes with counts', () => {
    const sql = `
      CREATE TABLE users (id int);
      ALTER TABLE users ADD COLUMN email varchar(255);
    `;
    const result = parseDiffOutput(sql);
    const formatted = formatDiffSummary(result);

    expect(formatted).toContain('1 table(s) created');
    expect(formatted).toContain('1 column(s) added');
  });

  it('includes destructive warning', () => {
    const sql = 'DROP TABLE users;';
    const result = parseDiffOutput(sql);
    const formatted = formatDiffSummary(result);

    expect(formatted).toContain('DESTRUCTIVE');
    expect(formatted).toContain('WARNING');
  });
});
