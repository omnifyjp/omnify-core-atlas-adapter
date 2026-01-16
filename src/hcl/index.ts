/**
 * @famgia/omnify-atlas - HCL Module
 */

export type {
  SqlColumnType,
  HclColumn,
  HclIndex,
  HclForeignKey,
  HclTable,
  HclEnum,
  HclSchema,
  HclGenerationOptions,
} from './types.js';

export {
  mapPropertyToSql,
  getPrimaryKeyType,
  getTimestampType,
  schemaNameToTableName,
  propertyNameToColumnName,
} from './type-mapper.js';

export {
  generateHclTable,
  generateHclSchema,
  renderHcl,
} from './generator.js';
