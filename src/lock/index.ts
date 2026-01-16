/**
 * @famgia/omnify-atlas - Lock File Module
 */

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
} from './types.js';

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
} from './lock-file.js';

// Version Chain (blockchain-like immutability)
export type {
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
} from './version-chain.types.js';

export {
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
} from './version-chain.js';
