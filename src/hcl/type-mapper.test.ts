/**
 * @famgia/omnify-atlas - Type Mapper Tests
 */

import { describe, it, expect } from 'vitest';
import {
  mapPropertyToSql,
  getPrimaryKeyType,
  schemaNameToTableName,
  propertyNameToColumnName,
} from './type-mapper.js';

describe('mapPropertyToSql', () => {
  describe('MySQL driver', () => {
    it('maps String type correctly', () => {
      const result = mapPropertyToSql({ type: 'String' }, 'mysql');
      expect(result.type).toBe('varchar(255)');
      expect(result.nullable).toBe(false);
    });

    it('respects custom length for String', () => {
      const result = mapPropertyToSql({ type: 'String', length: 100 }, 'mysql');
      expect(result.type).toBe('varchar(100)');
    });

    it('maps Int type correctly', () => {
      const result = mapPropertyToSql({ type: 'Int' }, 'mysql');
      expect(result.type).toBe('int');
    });

    it('maps Boolean type correctly', () => {
      const result = mapPropertyToSql({ type: 'Boolean' }, 'mysql');
      expect(result.type).toBe('tinyint(1)');
    });

    it('maps Text type correctly', () => {
      const result = mapPropertyToSql({ type: 'Text' }, 'mysql');
      expect(result.type).toBe('text');
    });

    it('maps Json type correctly', () => {
      const result = mapPropertyToSql({ type: 'Json' }, 'mysql');
      expect(result.type).toBe('json');
    });

    it('maps Enum type correctly', () => {
      const result = mapPropertyToSql(
        { type: 'Enum', enum: ['active', 'inactive'] } as any,
        'mysql'
      );
      expect(result.type).toBe("enum('active', 'inactive')");
    });

    it('respects nullable option', () => {
      const result = mapPropertyToSql({ type: 'String', nullable: true }, 'mysql');
      expect(result.nullable).toBe(true);
    });

    it('handles default value', () => {
      const result = mapPropertyToSql(
        { type: 'String', default: 'test' },
        'mysql'
      );
      expect(result.default).toBe("'test'");
    });
  });

  describe('PostgreSQL driver', () => {
    it('maps Int type correctly', () => {
      const result = mapPropertyToSql({ type: 'Int' }, 'postgres');
      expect(result.type).toBe('integer');
    });

    it('maps Boolean type correctly', () => {
      const result = mapPropertyToSql({ type: 'Boolean' }, 'postgres');
      expect(result.type).toBe('boolean');
    });

    it('maps Json type to jsonb', () => {
      const result = mapPropertyToSql({ type: 'Json' }, 'postgres');
      expect(result.type).toBe('jsonb');
    });
  });

  describe('SQLite driver', () => {
    it('maps String to text', () => {
      const result = mapPropertyToSql({ type: 'String' }, 'sqlite');
      expect(result.type).toBe('text');
    });

    it('maps Boolean to integer', () => {
      const result = mapPropertyToSql({ type: 'Boolean' }, 'sqlite');
      expect(result.type).toBe('integer');
    });
  });
});

describe('getPrimaryKeyType', () => {
  it('returns serial for PostgreSQL Int', () => {
    const result = getPrimaryKeyType('Int', 'postgres');
    expect(result.type).toBe('serial');
    expect(result.autoIncrement).toBeFalsy(); // PostgreSQL uses serial type instead
  });

  it('returns auto_increment int for MySQL', () => {
    const result = getPrimaryKeyType('Int', 'mysql');
    expect(result.type).toBe('int');
    expect(result.autoIncrement).toBe(true);
    expect(result.unsigned).toBe(true);
  });

  it('returns uuid for PostgreSQL Uuid', () => {
    const result = getPrimaryKeyType('Uuid', 'postgres');
    expect(result.type).toBe('uuid');
  });

  it('returns char(36) for MySQL Uuid', () => {
    const result = getPrimaryKeyType('Uuid', 'mysql');
    expect(result.type).toBe('char(36)');
  });
});

describe('schemaNameToTableName', () => {
  it('converts PascalCase to snake_case plural', () => {
    expect(schemaNameToTableName('User')).toBe('users');
    expect(schemaNameToTableName('BlogPost')).toBe('blog_posts');
    expect(schemaNameToTableName('OrderItem')).toBe('order_items');
  });

  it('handles names ending in y', () => {
    expect(schemaNameToTableName('Category')).toBe('categories');
    expect(schemaNameToTableName('Company')).toBe('companies');
  });

  it('handles names ending in s/x/ch/sh', () => {
    expect(schemaNameToTableName('Address')).toBe('addresses');
    expect(schemaNameToTableName('Tax')).toBe('taxes');
  });
});

describe('propertyNameToColumnName', () => {
  it('converts camelCase to snake_case', () => {
    expect(propertyNameToColumnName('firstName')).toBe('first_name');
    expect(propertyNameToColumnName('createdAt')).toBe('created_at');
    expect(propertyNameToColumnName('userId')).toBe('user_id');
  });

  it('handles simple names', () => {
    expect(propertyNameToColumnName('name')).toBe('name');
    expect(propertyNameToColumnName('email')).toBe('email');
  });
});
