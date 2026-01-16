/**
 * @famgia/omnify-atlas - HCL Generator
 *
 * Generates Atlas HCL schema from Omnify schemas.
 */

import type { LoadedSchema, SchemaCollection, DatabaseDriver, BasePropertyDefinition } from '@famgia/omnify-types';
import type {
  HclSchema,
  HclTable,
  HclColumn,
  HclIndex,
  HclForeignKey,
  HclGenerationOptions,
} from './types.js';
import {
  mapPropertyToSql,
  getPrimaryKeyType,
  getTimestampType,
  schemaNameToTableName,
  propertyNameToColumnName,
} from './type-mapper.js';

/**
 * Generates HCL table from a schema.
 */
export function generateHclTable(
  schema: LoadedSchema,
  allSchemas: SchemaCollection,
  driver: DatabaseDriver
): HclTable {
  const tableName = schemaNameToTableName(schema.name);
  const columns: HclColumn[] = [];
  const indexes: HclIndex[] = [];
  const foreignKeys: HclForeignKey[] = [];

  // Primary key column (only if id is not disabled)
  if (schema.options?.id !== false) {
    const pkType = schema.options?.idType ?? 'BigInt';
    columns.push({
      name: 'id',
      type: getPrimaryKeyType(pkType as 'Int' | 'BigInt' | 'Uuid' | 'String', driver),
      primaryKey: true,
    });
  }

  // Process properties
  if (schema.properties) {
    for (const [propName, property] of Object.entries(schema.properties)) {
      // Skip associations - they're handled separately
      if (property.type === 'Association') {
        const assocProp = property as {
          relation?: string;
          target?: string;
          onDelete?: string;
          onUpdate?: string;
        };

        // Only create FK column for ManyToOne and OneToOne (owning side)
        if (assocProp.relation === 'ManyToOne' || assocProp.relation === 'OneToOne') {
          const columnName = propertyNameToColumnName(propName) + '_id';
          const targetSchema = assocProp.target ? allSchemas[assocProp.target] : undefined;
          const targetTable = assocProp.target
            ? schemaNameToTableName(assocProp.target)
            : 'unknown';

          // Get target PK type
          const targetPkType = targetSchema?.options?.idType ?? 'BigInt';
          const fkType = getPrimaryKeyType(
            targetPkType as 'Int' | 'BigInt' | 'Uuid' | 'String',
            driver
          );

          // FK columns are nullable when the relation is optional
          const isNullable = assocProp.relation === 'ManyToOne';

          columns.push({
            name: columnName,
            type: {
              ...fkType,
              nullable: isNullable,
              autoIncrement: false,
            },
          });

          // Create foreign key constraint
          foreignKeys.push({
            name: `fk_${tableName}_${columnName}`,
            columns: [columnName],
            refTable: targetTable,
            refColumns: ['id'],
            onDelete: assocProp.onDelete ?? 'RESTRICT',
            onUpdate: assocProp.onUpdate ?? 'CASCADE',
          });

          // Create index for FK
          indexes.push({
            name: `idx_${tableName}_${columnName}`,
            columns: [columnName],
          });
        }

        continue;
      }

      // Regular column - cast to base property for common props
      const baseProp = property as BasePropertyDefinition;
      const columnName = propertyNameToColumnName(propName);
      const sqlType = mapPropertyToSql(property, driver);

      columns.push({
        name: columnName,
        type: sqlType,
        unique: baseProp.unique ?? false,
      });

      // Create unique index if needed
      if (baseProp.unique) {
        indexes.push({
          name: `idx_${tableName}_${columnName}_unique`,
          columns: [columnName],
          unique: true,
        });
      }
    }
  }

  // Timestamps
  if (schema.options?.timestamps !== false) {
    const timestampType = getTimestampType(driver);
    columns.push(
      { name: 'created_at', type: timestampType },
      { name: 'updated_at', type: timestampType }
    );
  }

  // Soft delete
  if (schema.options?.softDelete) {
    columns.push({
      name: 'deleted_at',
      type: getTimestampType(driver),
    });
  }

  // Custom indexes from options
  if (schema.options?.indexes) {
    for (const index of schema.options.indexes) {
      const indexColumns = index.columns.map(propertyNameToColumnName);
      indexes.push({
        name: index.name ?? `idx_${tableName}_${indexColumns.join('_')}`,
        columns: indexColumns,
        unique: index.unique ?? false,
      });
    }
  }

  // Unique constraints from options
  if (schema.options?.unique) {
    const uniqueConstraints = Array.isArray(schema.options.unique[0])
      ? (schema.options.unique as readonly (readonly string[])[])
      : [schema.options.unique as readonly string[]];

    for (const constraint of uniqueConstraints) {
      const constraintColumns = constraint.map(propertyNameToColumnName);
      indexes.push({
        name: `idx_${tableName}_${constraintColumns.join('_')}_unique`,
        columns: constraintColumns,
        unique: true,
      });
    }
  }

  return {
    name: tableName,
    columns,
    indexes,
    foreignKeys,
  };
}

/**
 * Generates complete HCL schema from schema collection.
 */
export function generateHclSchema(
  schemas: SchemaCollection,
  options: HclGenerationOptions
): HclSchema {
  const tables: HclTable[] = [];

  for (const schema of Object.values(schemas)) {
    // Skip enum schemas - they don't create tables
    if (schema.kind === 'enum') {
      continue;
    }

    const table = generateHclTable(schema, schemas, options.driver);
    tables.push(table);
  }

  // Collect enums for PostgreSQL
  const enums = Object.values(schemas)
    .filter((s) => s.kind === 'enum')
    .map((s) => ({
      name: s.name.toLowerCase(),
      values: s.values ?? [],
    }));

  return {
    driver: options.driver,
    schemaName: options.schemaName,
    tables,
    enums,
  };
}

/**
 * Formats HCL column definition.
 */
function formatHclColumn(column: HclColumn, driver: DatabaseDriver): string {
  const parts: string[] = [`  column "${column.name}" {`];

  parts.push(`    type = ${formatSqlType(column.type.type, driver)}`);

  if (column.type.nullable) {
    parts.push('    null = true');
  }

  if (column.type.default !== undefined) {
    parts.push(`    default = ${column.type.default}`);
  }

  if (column.type.autoIncrement) {
    parts.push('    auto_increment = true');
  }

  if (column.type.unsigned && (driver === 'mysql' || driver === 'mariadb')) {
    parts.push('    unsigned = true');
  }

  parts.push('  }');
  return parts.join('\n');
}

/**
 * Formats SQL type for HCL.
 */
function formatSqlType(type: string, driver: DatabaseDriver): string {
  // Handle enum type
  if (type.startsWith('enum(')) {
    if (driver === 'mysql' || driver === 'mariadb') {
      return type;
    }
    return 'varchar(100)';
  }

  // Standard types
  return type;
}

/**
 * Formats HCL index definition.
 */
function formatHclIndex(index: HclIndex): string {
  const columns = index.columns.map((c) => `"${c}"`).join(', ');
  const unique = index.unique ? 'unique = true\n    ' : '';

  return `  index "${index.name}" {
    columns = [${columns}]
    ${unique}}`;
}

/**
 * Formats HCL foreign key definition.
 */
function formatHclForeignKey(fk: HclForeignKey): string {
  const columns = fk.columns.map((c) => `"${c}"`).join(', ');
  const refColumns = fk.refColumns.map((c) => `"${c}"`).join(', ');

  return `  foreign_key "${fk.name}" {
    columns     = [${columns}]
    ref_columns = [${refColumns}]
    on_update   = ${fk.onUpdate ?? 'CASCADE'}
    on_delete   = ${fk.onDelete ?? 'RESTRICT'}
  }`;
}

/**
 * Renders HCL schema to string.
 */
export function renderHcl(schema: HclSchema): string {
  const lines: string[] = [];

  // Add schema block if named
  const schemaPrefix = schema.schemaName ? `schema "${schema.schemaName}" {\n}\n\n` : '';
  lines.push(schemaPrefix);

  // Add tables
  for (const table of schema.tables) {
    lines.push(`table "${table.name}" {`);

    // Schema reference
    if (schema.schemaName) {
      lines.push(`  schema = schema.${schema.schemaName}`);
    }

    // Columns
    for (const column of table.columns) {
      lines.push(formatHclColumn(column, schema.driver));
    }

    // Primary key
    const pkColumn = table.columns.find((c) => c.primaryKey);
    if (pkColumn) {
      lines.push(`  primary_key {
    columns = ["${pkColumn.name}"]
  }`);
    }

    // Indexes
    for (const index of table.indexes) {
      lines.push(formatHclIndex(index));
    }

    // Foreign keys
    for (const fk of table.foreignKeys) {
      lines.push(formatHclForeignKey(fk));
    }

    lines.push('}\n');
  }

  return lines.join('\n');
}
