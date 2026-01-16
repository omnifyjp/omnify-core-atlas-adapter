/**
 * @famgia/omnify-atlas
 * Atlas CLI integration for schema diffing and migration generation.
 *
 * This package provides:
 * - Lock file management for tracking schema state
 * - HCL schema generation for Atlas
 * - Atlas CLI subprocess execution
 * - SQL diff output parsing
 * - Change preview functionality
 */

// ============================================================================
// Lock File Management
// ============================================================================

export type {
  PropertySnapshot,
  IndexSnapshot,
  SchemaSnapshot,
  SchemaHash,
  GeneratedMigration,
  MigrationValidation,
  LockFile,
  LockFileV1,
  LockFileV2,
  ChangeType,
  ColumnChange,
  IndexChange,
  SchemaChange,
  LockFileComparison,
  // Version Chain types
  ChainSchemaEntry,
  VersionBlock,
  VersionChain,
  ChainVerificationResult,
  CorruptedBlockInfo,
  TamperedSchemaInfo,
  DeletedSchemaInfo,
  DeployOptions,
  DeployResult,
  LockCheckResult,
} from './lock/index.js';

export {
  LOCK_FILE_NAME,
  LOCK_FILE_VERSION,
  computeHash,
  computeSchemaHash,
  createEmptyLockFile,
  propertyToSnapshot,
  schemaToSnapshot,
  isLockFileV2,
  readLockFile,
  writeLockFile,
  buildSchemaHashes,
  buildSchemaSnapshots,
  compareSchemas,
  compareSchemasDeep,
  updateLockFile,
  updateLockFileV1,
  addMigrationRecord,
  addEnhancedMigrationRecord,
  extractTimestampFromFilename,
  extractTableNameFromFilename,
  validateMigrations,
  findMigrationByTable,
  getMigrationsToRegenerate,
  // Version Chain functions
  VERSION_CHAIN_FILE,
  computeSha256,
  computeBlockHash,
  createEmptyChain,
  readVersionChain,
  writeVersionChain,
  buildCurrentSchemaEntries,
  generateVersionName,
  verifyChain,
  checkLockViolation,
  checkBulkLockViolation,
  createDeployBlock,
  deployVersion,
  getLockedSchemas,
  getChainSummary,
} from './lock/index.js';

// ============================================================================
// HCL Schema Generation
// ============================================================================

export type {
  SqlColumnType,
  HclColumn,
  HclIndex,
  HclForeignKey,
  HclTable,
  HclEnum,
  HclSchema,
  HclGenerationOptions,
} from './hcl/index.js';

export {
  mapPropertyToSql,
  getPrimaryKeyType,
  getTimestampType,
  schemaNameToTableName,
  propertyNameToColumnName,
  generateHclTable,
  generateHclSchema,
  renderHcl,
} from './hcl/index.js';

// ============================================================================
// Atlas CLI Integration
// ============================================================================

export type {
  AtlasConfig,
  AtlasDiffOptions,
  AtlasResult,
  AtlasDiffResult,
  AtlasInspectResult,
  AtlasVersion,
} from './atlas/index.js';

export {
  checkAtlasVersion,
  runAtlasDiff,
  diffHclSchemas,
  validateHcl,
  applySchema,
} from './atlas/index.js';

// ============================================================================
// Diff Parsing
// ============================================================================

export type {
  SqlOperationType,
  ChangeSeverity,
  ParsedStatement,
  TableChange,
  DiffResult,
  DiffSummary,
} from './diff/index.js';

export {
  parseDiffOutput,
  formatDiffSummary,
} from './diff/index.js';

// ============================================================================
// Change Preview
// ============================================================================

export type {
  PreviewOptions,
  ChangePreview,
  PreviewFormat,
} from './preview/index.js';

export {
  generatePreview,
  previewSchemaChanges,
  formatPreview,
  hasBlockingIssues,
} from './preview/index.js';
