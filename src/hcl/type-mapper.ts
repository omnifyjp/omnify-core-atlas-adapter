/**
 * @famgia/omnify-atlas - Type Mapper
 *
 * Maps Omnify property types to SQL types for different database drivers.
 */

import type { PropertyDefinition, DatabaseDriver, BasePropertyDefinition, LocalizedString } from '@famgia/omnify-types';
import type { SqlColumnType } from './types.js';

/**
 * Extended property with all possible optional fields for type mapping.
 */
interface ExtendedProperty {
  readonly type: string;
  readonly displayName?: LocalizedString;
  readonly nullable?: boolean;
  readonly default?: unknown;
  readonly unique?: boolean;
  readonly length?: number;
  readonly unsigned?: boolean;
  readonly enum?: string | readonly string[];
}

/**
 * Type mapping for a specific driver.
 */
type DriverTypeMap = Record<string, (prop: ExtendedProperty) => SqlColumnType>;

/**
 * MySQL type mappings.
 */
const MYSQL_TYPES: DriverTypeMap = {
  String: (prop) => ({
    type: `varchar(${prop.length ?? 255})`,
    nullable: prop.nullable ?? false,
    default: prop.default !== undefined ? `'${prop.default}'` : undefined,
  }),
  Int: (prop) => ({
    type: 'int',
    nullable: prop.nullable ?? false,
    default: prop.default !== undefined ? String(prop.default) : undefined,
    unsigned: prop.unsigned ?? false,
  }),
  BigInt: (prop) => ({
    type: 'bigint',
    nullable: prop.nullable ?? false,
    default: prop.default !== undefined ? String(prop.default) : undefined,
    unsigned: prop.unsigned ?? false,
  }),
  Float: (prop) => ({
    type: 'double',
    nullable: prop.nullable ?? false,
    default: prop.default !== undefined ? String(prop.default) : undefined,
  }),
  Boolean: (prop) => ({
    type: 'tinyint(1)',
    nullable: prop.nullable ?? false,
    default: prop.default !== undefined ? (prop.default ? '1' : '0') : undefined,
  }),
  Text: (prop) => ({
    type: 'text',
    nullable: prop.nullable ?? false,
  }),
  LongText: (prop) => ({
    type: 'longtext',
    nullable: prop.nullable ?? false,
  }),
  Date: (prop) => ({
    type: 'date',
    nullable: prop.nullable ?? false,
  }),
  Time: (prop) => ({
    type: 'time',
    nullable: prop.nullable ?? false,
  }),
  Timestamp: (prop) => ({
    type: 'timestamp',
    nullable: prop.nullable ?? false,
  }),
  Json: (prop) => ({
    type: 'json',
    nullable: prop.nullable ?? false,
  }),
  Email: (prop) => ({
    type: 'varchar(255)',
    nullable: prop.nullable ?? false,
  }),
  Password: (prop) => ({
    type: 'varchar(255)',
    nullable: prop.nullable ?? false,
  }),
  File: (prop) => ({
    type: 'varchar(500)',
    nullable: prop.nullable ?? false,
  }),
  MultiFile: (prop) => ({
    type: 'json',
    nullable: prop.nullable ?? false,
  }),
  Enum: (prop) => {
    const enumProp = prop as { enum?: readonly string[] };
    const values = enumProp.enum ?? [];
    const enumDef = values.map((v) => `'${v}'`).join(', ');
    return {
      type: `enum(${enumDef})`,
      nullable: prop.nullable ?? false,
      default: prop.default !== undefined ? `'${prop.default}'` : undefined,
    };
  },
  Select: (prop) => ({
    type: 'varchar(100)',
    nullable: prop.nullable ?? false,
  }),
  Lookup: (prop) => ({
    type: 'bigint',
    nullable: prop.nullable ?? false,
    unsigned: true,
  }),
};

/**
 * PostgreSQL type mappings.
 */
const POSTGRES_TYPES: DriverTypeMap = {
  String: (prop) => ({
    type: `varchar(${prop.length ?? 255})`,
    nullable: prop.nullable ?? false,
    default: prop.default !== undefined ? `'${prop.default}'` : undefined,
  }),
  Int: (prop) => ({
    type: 'integer',
    nullable: prop.nullable ?? false,
    default: prop.default !== undefined ? String(prop.default) : undefined,
  }),
  BigInt: (prop) => ({
    type: 'bigint',
    nullable: prop.nullable ?? false,
    default: prop.default !== undefined ? String(prop.default) : undefined,
  }),
  Float: (prop) => ({
    type: 'double precision',
    nullable: prop.nullable ?? false,
    default: prop.default !== undefined ? String(prop.default) : undefined,
  }),
  Boolean: (prop) => ({
    type: 'boolean',
    nullable: prop.nullable ?? false,
    default: prop.default !== undefined ? String(prop.default) : undefined,
  }),
  Text: (prop) => ({
    type: 'text',
    nullable: prop.nullable ?? false,
  }),
  LongText: (prop) => ({
    type: 'text',
    nullable: prop.nullable ?? false,
  }),
  Date: (prop) => ({
    type: 'date',
    nullable: prop.nullable ?? false,
  }),
  Time: (prop) => ({
    type: 'time',
    nullable: prop.nullable ?? false,
  }),
  Timestamp: (prop) => ({
    type: 'timestamp',
    nullable: prop.nullable ?? false,
  }),
  Json: (prop) => ({
    type: 'jsonb',
    nullable: prop.nullable ?? false,
  }),
  Email: (prop) => ({
    type: 'varchar(255)',
    nullable: prop.nullable ?? false,
  }),
  Password: (prop) => ({
    type: 'varchar(255)',
    nullable: prop.nullable ?? false,
  }),
  File: (prop) => ({
    type: 'varchar(500)',
    nullable: prop.nullable ?? false,
  }),
  MultiFile: (prop) => ({
    type: 'jsonb',
    nullable: prop.nullable ?? false,
  }),
  // For PostgreSQL, enums are separate types
  Enum: (prop) => ({
    type: 'varchar(100)',
    nullable: prop.nullable ?? false,
    default: prop.default !== undefined ? `'${prop.default}'` : undefined,
  }),
  Select: (prop) => ({
    type: 'varchar(100)',
    nullable: prop.nullable ?? false,
  }),
  Lookup: (prop) => ({
    type: 'bigint',
    nullable: prop.nullable ?? false,
  }),
};

/**
 * SQLite type mappings.
 */
const SQLITE_TYPES: DriverTypeMap = {
  String: (prop) => ({
    type: 'text',
    nullable: prop.nullable ?? false,
    default: prop.default !== undefined ? `'${prop.default}'` : undefined,
  }),
  Int: (prop) => ({
    type: 'integer',
    nullable: prop.nullable ?? false,
    default: prop.default !== undefined ? String(prop.default) : undefined,
  }),
  BigInt: (prop) => ({
    type: 'integer',
    nullable: prop.nullable ?? false,
    default: prop.default !== undefined ? String(prop.default) : undefined,
  }),
  Float: (prop) => ({
    type: 'real',
    nullable: prop.nullable ?? false,
    default: prop.default !== undefined ? String(prop.default) : undefined,
  }),
  Boolean: (prop) => ({
    type: 'integer',
    nullable: prop.nullable ?? false,
    default: prop.default !== undefined ? (prop.default ? '1' : '0') : undefined,
  }),
  Text: (prop) => ({
    type: 'text',
    nullable: prop.nullable ?? false,
  }),
  LongText: (prop) => ({
    type: 'text',
    nullable: prop.nullable ?? false,
  }),
  Date: (prop) => ({
    type: 'text',
    nullable: prop.nullable ?? false,
  }),
  Time: (prop) => ({
    type: 'text',
    nullable: prop.nullable ?? false,
  }),
  Timestamp: (prop) => ({
    type: 'text',
    nullable: prop.nullable ?? false,
  }),
  Json: (prop) => ({
    type: 'text',
    nullable: prop.nullable ?? false,
  }),
  Email: (prop) => ({
    type: 'text',
    nullable: prop.nullable ?? false,
  }),
  Password: (prop) => ({
    type: 'text',
    nullable: prop.nullable ?? false,
  }),
  File: (prop) => ({
    type: 'text',
    nullable: prop.nullable ?? false,
  }),
  MultiFile: (prop) => ({
    type: 'text',
    nullable: prop.nullable ?? false,
  }),
  Enum: (prop) => ({
    type: 'text',
    nullable: prop.nullable ?? false,
    default: prop.default !== undefined ? `'${prop.default}'` : undefined,
  }),
  Select: (prop) => ({
    type: 'text',
    nullable: prop.nullable ?? false,
  }),
  Lookup: (prop) => ({
    type: 'integer',
    nullable: prop.nullable ?? false,
  }),
};

/**
 * Driver type maps.
 */
const DRIVER_TYPE_MAPS: Record<DatabaseDriver, DriverTypeMap> = {
  mysql: MYSQL_TYPES,
  postgres: POSTGRES_TYPES,
  pgsql: POSTGRES_TYPES, // Alias for postgres
  sqlite: SQLITE_TYPES,
  mariadb: MYSQL_TYPES, // MariaDB uses same types as MySQL
  sqlsrv: MYSQL_TYPES, // SQL Server uses similar types to MySQL for now
};

/**
 * Maps a property type to SQL column type.
 */
export function mapPropertyToSql(
  property: PropertyDefinition,
  driver: DatabaseDriver
): SqlColumnType {
  const typeMap = DRIVER_TYPE_MAPS[driver];
  const mapper = typeMap[property.type];

  // Cast to BasePropertyDefinition since we only handle non-Association types here
  const baseProp = property as BasePropertyDefinition;

  if (mapper) {
    return mapper(baseProp);
  }

  // Default fallback for unknown types
  return {
    type: 'varchar(255)',
    nullable: baseProp.nullable ?? false,
  };
}

/**
 * Gets the SQL type for a primary key.
 */
export function getPrimaryKeyType(
  pkType: 'Int' | 'BigInt' | 'Uuid' | 'String',
  driver: DatabaseDriver
): SqlColumnType {
  switch (pkType) {
    case 'Int':
      return {
        type: driver === 'postgres' ? 'serial' : 'int',
        nullable: false,
        autoIncrement: driver !== 'postgres',
        unsigned: driver === 'mysql' || driver === 'mariadb',
      };
    case 'BigInt':
      return {
        type: driver === 'postgres' ? 'bigserial' : 'bigint',
        nullable: false,
        autoIncrement: driver !== 'postgres',
        unsigned: driver === 'mysql' || driver === 'mariadb',
      };
    case 'Uuid':
      return {
        type: driver === 'postgres' ? 'uuid' : 'char(36)',
        nullable: false,
      };
    case 'String':
      return {
        type: 'varchar(255)',
        nullable: false,
      };
    default:
      return {
        type: driver === 'postgres' ? 'bigserial' : 'bigint',
        nullable: false,
        autoIncrement: driver !== 'postgres',
        unsigned: driver === 'mysql' || driver === 'mariadb',
      };
  }
}

/**
 * Gets the SQL type for timestamp columns.
 */
export function getTimestampType(driver: DatabaseDriver): SqlColumnType {
  return {
    type: driver === 'postgres' ? 'timestamp' : 'timestamp',
    nullable: true,
  };
}

/**
 * Converts table name from PascalCase schema name.
 */
export function schemaNameToTableName(schemaName: string): string {
  // Convert PascalCase to snake_case and pluralize
  const snakeCase = schemaName
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');

  // Simple pluralization
  if (snakeCase.endsWith('y')) {
    return snakeCase.slice(0, -1) + 'ies';
  } else if (
    snakeCase.endsWith('s') ||
    snakeCase.endsWith('x') ||
    snakeCase.endsWith('ch') ||
    snakeCase.endsWith('sh')
  ) {
    return snakeCase + 'es';
  } else {
    return snakeCase + 's';
  }
}

/**
 * Converts property name to column name.
 */
export function propertyNameToColumnName(propertyName: string): string {
  // Convert camelCase to snake_case
  return propertyName.replace(/([A-Z])/g, '_$1').toLowerCase();
}
