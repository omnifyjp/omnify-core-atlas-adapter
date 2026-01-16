/**
 * @famgia/omnify-atlas - Lock File Management
 *
 * Manages the .omnify.lock file for tracking schema state.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import type { SchemaCollection, PropertyDefinition, LoadedSchema } from '@famgia/omnify-types';
import type {
  LockFile,
  LockFileV1,
  LockFileV2,
  SchemaHash,
  SchemaSnapshot,
  PropertySnapshot,
  IndexSnapshot,
  SchemaChange,
  ColumnChange,
  IndexChange,
  LockFileComparison,
} from './types.js';

/**
 * Default lock file name.
 */
export const LOCK_FILE_NAME = '.omnify.lock';

/**
 * Current lock file format version.
 */
export const LOCK_FILE_VERSION = 2 as const;

/**
 * Computes SHA-256 hash of content.
 */
export function computeHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Computes hash for a schema.
 */
export function computeSchemaHash(schema: {
  name: string;
  relativePath: string;
  properties?: unknown;
  options?: unknown;
  values?: readonly string[];
  kind?: string;
}): string {
  // Hash only the structural content, not metadata
  const content = JSON.stringify({
    name: schema.name,
    kind: schema.kind ?? 'object',
    properties: schema.properties ?? {},
    options: schema.options ?? {},
    values: schema.values ?? [],
  });
  return computeHash(content);
}

/**
 * Creates a new empty lock file (v2).
 */
export function createEmptyLockFile(driver: string): LockFileV2 {
  return {
    version: LOCK_FILE_VERSION,
    updatedAt: new Date().toISOString(),
    driver,
    schemas: {},
    migrations: [],
  };
}

/**
 * Converts a PropertyDefinition to PropertySnapshot.
 */
export function propertyToSnapshot(property: PropertyDefinition): PropertySnapshot {
  // Extract fields from property (it could be various subtypes)
  const prop = property as {
    type: string;
    nullable?: boolean;
    unique?: boolean;
    default?: unknown;
    length?: number;
    unsigned?: boolean;
    precision?: number;
    scale?: number;
    enum?: readonly string[];
    relation?: string;
    target?: string;
    onDelete?: string;
    onUpdate?: string;
    mappedBy?: string;
    joinTable?: string;
    pivotFields?: Record<string, {
      type: string;
      nullable?: boolean;
      default?: unknown;
      length?: number;
      unsigned?: boolean;
    }>;
    renamedFrom?: string;
    // Laravel-specific
    hidden?: boolean;
    fillable?: boolean;
    fields?: Record<string, { nullable?: boolean; hidden?: boolean; fillable?: boolean }>;
  };

  return {
    type: prop.type,
    nullable: prop.nullable,
    unique: prop.unique,
    default: prop.default,
    length: prop.length,
    unsigned: prop.unsigned,
    precision: prop.precision,
    scale: prop.scale,
    enum: prop.enum,
    relation: prop.relation,
    target: prop.target,
    onDelete: prop.onDelete,
    onUpdate: prop.onUpdate,
    mappedBy: prop.mappedBy,
    joinTable: prop.joinTable,
    pivotFields: prop.pivotFields,
    // renamedFrom is kept in snapshot for comparison (rename detection),
    // but will be stripped when writing to lock file.
    renamedFrom: prop.renamedFrom,
    // Laravel-specific properties
    hidden: prop.hidden,
    fillable: prop.fillable,
    fields: prop.fields,
  };
}

/**
 * Creates a schema snapshot from a loaded schema.
 */
export function schemaToSnapshot(
  schema: LoadedSchema,
  hash: string,
  modifiedAt: string
): SchemaSnapshot {
  const properties: Record<string, PropertySnapshot> = {};

  if (schema.properties) {
    for (const [name, prop] of Object.entries(schema.properties)) {
      properties[name] = propertyToSnapshot(prop);
    }
  }

  const opts = schema.options;

  // Build indexes if present
  let indexes: readonly IndexSnapshot[] | undefined;
  if (opts?.indexes && opts.indexes.length > 0) {
    indexes = opts.indexes.map(idx => ({
      columns: idx.columns,
      unique: idx.unique ?? false,
      name: idx.name,
    }));
  }

  // Build unique constraints if present
  let uniqueConstraints: readonly (readonly string[])[] | undefined;
  if (opts?.unique) {
    uniqueConstraints = Array.isArray(opts.unique[0])
      ? opts.unique as readonly (readonly string[])[]
      : [opts.unique as readonly string[]];
  }

  return {
    name: schema.name,
    kind: schema.kind ?? 'object',
    hash,
    relativePath: schema.relativePath,
    modifiedAt,
    properties,
    id: opts?.id,
    idType: opts?.idType,
    timestamps: opts?.timestamps,
    softDelete: opts?.softDelete,
    indexes,
    uniqueConstraints,
    values: schema.values,
  };
}

/**
 * Checks if lock file is v2 format.
 */
export function isLockFileV2(lockFile: LockFile): lockFile is LockFileV2 {
  return lockFile.version === 2;
}

/**
 * Reads lock file from disk.
 * Returns null if file doesn't exist.
 * Supports both v1 and v2 formats.
 */
export async function readLockFile(lockFilePath: string): Promise<LockFile | null> {
  try {
    const content = await readFile(lockFilePath, 'utf8');
    const parsed = JSON.parse(content) as unknown;
    const lockFile = parsed as { version: number };

    // Validate version (accept v1 or v2)
    if (lockFile.version !== 1 && lockFile.version !== 2) {
      throw new Error(
        `Lock file version mismatch: expected 1 or 2, got ${lockFile.version}`
      );
    }

    return parsed as LockFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Writes lock file to disk.
 */
export async function writeLockFile(
  lockFilePath: string,
  lockFile: LockFile
): Promise<void> {
  const content = JSON.stringify(lockFile, null, 2) + '\n';
  await writeFile(lockFilePath, content, 'utf8');
}

/**
 * Builds schema hashes from a schema collection (legacy v1 format).
 */
export async function buildSchemaHashes(
  schemas: SchemaCollection
): Promise<Record<string, SchemaHash>> {
  const hashes: Record<string, SchemaHash> = {};

  for (const [name, schema] of Object.entries(schemas)) {
    const hash = computeSchemaHash(schema);

    // Get file modification time
    let modifiedAt: string;
    try {
      const stats = await stat(schema.filePath);
      modifiedAt = stats.mtime.toISOString();
    } catch {
      modifiedAt = new Date().toISOString();
    }

    hashes[name] = {
      name,
      hash,
      relativePath: schema.relativePath,
      modifiedAt,
    };
  }

  return hashes;
}

/**
 * Builds schema snapshots from a schema collection (v2 format).
 */
export async function buildSchemaSnapshots(
  schemas: SchemaCollection
): Promise<Record<string, SchemaSnapshot>> {
  const snapshots: Record<string, SchemaSnapshot> = {};

  for (const [name, schema] of Object.entries(schemas)) {
    const hash = computeSchemaHash(schema);

    // Get file modification time
    let modifiedAt: string;
    try {
      const stats = await stat(schema.filePath);
      modifiedAt = stats.mtime.toISOString();
    } catch {
      modifiedAt = new Date().toISOString();
    }

    snapshots[name] = schemaToSnapshot(schema, hash, modifiedAt);
  }

  return snapshots;
}

/**
 * Compares two property snapshots and returns modifications.
 */
function diffPropertySnapshots(
  prev: PropertySnapshot,
  curr: PropertySnapshot
): string[] {
  const modifications: string[] = [];

  if (prev.type !== curr.type) modifications.push('type');
  if (prev.nullable !== curr.nullable) modifications.push('nullable');
  if (prev.unique !== curr.unique) modifications.push('unique');
  if (JSON.stringify(prev.default) !== JSON.stringify(curr.default)) modifications.push('default');
  if (prev.length !== curr.length) modifications.push('length');
  if (prev.unsigned !== curr.unsigned) modifications.push('unsigned');
  if (prev.precision !== curr.precision) modifications.push('precision');
  if (prev.scale !== curr.scale) modifications.push('scale');
  if (JSON.stringify(prev.enum) !== JSON.stringify(curr.enum)) modifications.push('enum');
  // Association changes
  if (prev.relation !== curr.relation) modifications.push('relation');
  if (prev.target !== curr.target) modifications.push('target');
  if (prev.onDelete !== curr.onDelete) modifications.push('onDelete');
  if (prev.onUpdate !== curr.onUpdate) modifications.push('onUpdate');
  if (prev.mappedBy !== curr.mappedBy) modifications.push('mappedBy');

  return modifications;
}

/**
 * Compares two index arrays and returns changes.
 */
function diffIndexes(
  prev: readonly IndexSnapshot[] | undefined,
  curr: readonly IndexSnapshot[] | undefined
): IndexChange[] {
  const changes: IndexChange[] = [];
  const prevIndexes = prev ?? [];
  const currIndexes = curr ?? [];

  // Create keys for comparison
  const indexKey = (idx: IndexSnapshot) =>
    `${idx.columns.join(',')}:${idx.unique}`;

  const prevKeys = new Map(prevIndexes.map(idx => [indexKey(idx), idx]));
  const currKeys = new Map(currIndexes.map(idx => [indexKey(idx), idx]));

  // Find added indexes
  for (const [key, idx] of currKeys) {
    if (!prevKeys.has(key)) {
      changes.push({ changeType: 'added', index: idx });
    }
  }

  // Find removed indexes
  for (const [key, idx] of prevKeys) {
    if (!currKeys.has(key)) {
      changes.push({ changeType: 'removed', index: idx });
    }
  }

  return changes;
}

/**
 * Deep diff two schema snapshots to find column-level changes.
 */
function diffSchemaSnapshots(
  prev: SchemaSnapshot,
  curr: SchemaSnapshot
): Pick<SchemaChange, 'columnChanges' | 'indexChanges' | 'optionChanges'> {
  const columnChanges: ColumnChange[] = [];

  const prevProps = prev.properties;
  const currProps = curr.properties;
  const prevNames = new Set(Object.keys(prevProps));
  const currNames = new Set(Object.keys(currProps));

  // Track columns handled by renames to exclude from added/removed
  const renamedNewNames = new Set<string>();
  const renamedOldNames = new Set<string>();

  // 1. First, detect RENAMES (columns with renamedFrom that match a previous column)
  for (const [name, currProp] of Object.entries(currProps)) {
    if (currProp.renamedFrom && prevProps[currProp.renamedFrom]) {
      const prevProp = prevProps[currProp.renamedFrom]!;

      // Check if there are also property modifications beyond the rename
      const mods = diffPropertySnapshots(prevProp, currProp);
      // Remove 'renamedFrom' from modifications since it's not a property change
      const filteredMods = mods.filter(m => m !== 'renamedFrom');

      columnChanges.push({
        column: name,
        changeType: 'renamed',
        previousColumn: currProp.renamedFrom,
        previousDef: prevProp,
        currentDef: currProp,
        modifications: filteredMods.length > 0 ? filteredMods : undefined,
      });

      renamedNewNames.add(name);
      renamedOldNames.add(currProp.renamedFrom);
    }
  }

  // 2. Find added columns (excluding renamed columns)
  for (const name of currNames) {
    if (!prevNames.has(name) && !renamedNewNames.has(name)) {
      columnChanges.push({
        column: name,
        changeType: 'added',
        currentDef: currProps[name],
      });
    }
  }

  // 3. Find removed columns (excluding rename sources)
  for (const name of prevNames) {
    if (!currNames.has(name) && !renamedOldNames.has(name)) {
      columnChanges.push({
        column: name,
        changeType: 'removed',
        previousDef: prevProps[name],
      });
    }
  }

  // 4. Find modified columns (excluding renamed columns)
  for (const name of currNames) {
    if (prevNames.has(name) && !renamedNewNames.has(name)) {
      const prevProp = prevProps[name]!;
      const currProp = currProps[name]!;
      const mods = diffPropertySnapshots(prevProp, currProp);

      if (mods.length > 0) {
        columnChanges.push({
          column: name,
          changeType: 'modified',
          previousDef: prevProp,
          currentDef: currProp,
          modifications: mods,
        });
      }
    }
  }

  // Index changes
  const indexChanges = diffIndexes(prev.indexes, curr.indexes);

  // Option changes
  const optionChanges: SchemaChange['optionChanges'] = {};
  let hasOptionChanges = false;

  if (prev.timestamps !== curr.timestamps) {
    (optionChanges as Record<string, unknown>).timestamps = { from: prev.timestamps, to: curr.timestamps };
    hasOptionChanges = true;
  }
  if (prev.softDelete !== curr.softDelete) {
    (optionChanges as Record<string, unknown>).softDelete = { from: prev.softDelete, to: curr.softDelete };
    hasOptionChanges = true;
  }
  if (prev.id !== curr.id) {
    (optionChanges as Record<string, unknown>).id = { from: prev.id, to: curr.id };
    hasOptionChanges = true;
  }
  if (prev.idType !== curr.idType) {
    (optionChanges as Record<string, unknown>).idType = { from: prev.idType, to: curr.idType };
    hasOptionChanges = true;
  }

  return {
    columnChanges: columnChanges.length > 0 ? columnChanges : undefined,
    indexChanges: indexChanges.length > 0 ? indexChanges : undefined,
    optionChanges: hasOptionChanges ? optionChanges : undefined,
  };
}

/**
 * Compares current schemas to lock file and detects changes (v1 format - hash only).
 */
export function compareSchemas(
  currentHashes: Record<string, SchemaHash>,
  lockFile: LockFile | null
): LockFileComparison {
  const changes: SchemaChange[] = [];
  const unchanged: string[] = [];

  const previousHashes = lockFile?.schemas ?? {};
  const previousNames = new Set(Object.keys(previousHashes));
  const currentNames = new Set(Object.keys(currentHashes));

  // Find added schemas
  for (const name of currentNames) {
    if (!previousNames.has(name)) {
      const current = currentHashes[name];
      if (current) {
        changes.push({
          schemaName: name,
          changeType: 'added',
          currentHash: current.hash,
        });
      }
    }
  }

  // Find removed schemas
  for (const name of previousNames) {
    if (!currentNames.has(name)) {
      const previous = previousHashes[name];
      if (previous) {
        changes.push({
          schemaName: name,
          changeType: 'removed',
          previousHash: previous.hash,
        });
      }
    }
  }

  // Find modified schemas
  for (const name of currentNames) {
    if (previousNames.has(name)) {
      const current = currentHashes[name];
      const previous = previousHashes[name];

      if (current && previous) {
        if (current.hash !== previous.hash) {
          changes.push({
            schemaName: name,
            changeType: 'modified',
            previousHash: previous.hash,
            currentHash: current.hash,
          });
        } else {
          unchanged.push(name);
        }
      }
    }
  }

  return {
    hasChanges: changes.length > 0,
    changes,
    unchanged,
  };
}

/**
 * Compares current schemas to lock file with deep diff (v2 format).
 * Returns detailed column-level changes.
 */
export function compareSchemasDeep(
  currentSnapshots: Record<string, SchemaSnapshot>,
  lockFile: LockFileV2 | null
): LockFileComparison {
  const changes: SchemaChange[] = [];
  const unchanged: string[] = [];

  const previousSnapshots = lockFile?.schemas ?? {};
  const previousNames = new Set(Object.keys(previousSnapshots));
  const currentNames = new Set(Object.keys(currentSnapshots));

  // Find added schemas
  for (const name of currentNames) {
    if (!previousNames.has(name)) {
      const current = currentSnapshots[name];
      if (current) {
        changes.push({
          schemaName: name,
          changeType: 'added',
          currentHash: current.hash,
        });
      }
    }
  }

  // Find removed schemas
  for (const name of previousNames) {
    if (!currentNames.has(name)) {
      const previous = previousSnapshots[name];
      if (previous) {
        changes.push({
          schemaName: name,
          changeType: 'removed',
          previousHash: previous.hash,
        });
      }
    }
  }

  // Find modified schemas with deep diff
  for (const name of currentNames) {
    if (previousNames.has(name)) {
      const current = currentSnapshots[name]!;
      const previous = previousSnapshots[name]!;

      if (current.hash !== previous.hash) {
        const diff = diffSchemaSnapshots(previous, current);
        changes.push({
          schemaName: name,
          changeType: 'modified',
          previousHash: previous.hash,
          currentHash: current.hash,
          ...diff,
        });
      } else {
        unchanged.push(name);
      }
    }
  }

  return {
    hasChanges: changes.length > 0,
    changes,
    unchanged,
  };
}

/**
 * Strips transient info (like renamedFrom) from properties before persisting.
 * renamedFrom is only used for migration detection, not stored in lock file.
 */
function stripTransientInfo(
  snapshots: Record<string, SchemaSnapshot>
): Record<string, SchemaSnapshot> {
  const result: Record<string, SchemaSnapshot> = {};

  for (const [schemaName, snapshot] of Object.entries(snapshots)) {
    // Handle case where snapshot might not have properties (legacy format)
    if (!snapshot.properties) {
      result[schemaName] = snapshot;
      continue;
    }

    const cleanProperties: Record<string, PropertySnapshot> = {};

    for (const [propName, prop] of Object.entries(snapshot.properties)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { renamedFrom, ...rest } = prop;
      cleanProperties[propName] = rest;
    }

    result[schemaName] = {
      ...snapshot,
      properties: cleanProperties,
    };
  }

  return result;
}

/**
 * Updates lock file with current schema state (v2 format).
 */
export function updateLockFile(
  existingLockFile: LockFile | null,
  currentSnapshots: Record<string, SchemaSnapshot>,
  driver: string
): LockFileV2 {
  // Strip transient info (renamedFrom) before persisting
  const cleanSnapshots = stripTransientInfo(currentSnapshots);

  return {
    version: LOCK_FILE_VERSION,
    updatedAt: new Date().toISOString(),
    driver,
    schemas: cleanSnapshots,
    migrations: existingLockFile?.migrations ?? [],
    hclChecksum: existingLockFile?.hclChecksum,
  };
}

/**
 * Updates lock file with current schema state (legacy v1 format).
 */
export function updateLockFileV1(
  existingLockFile: LockFile | null,
  currentHashes: Record<string, SchemaHash>,
  driver: string
): LockFileV1 {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    driver,
    schemas: currentHashes,
    migrations: existingLockFile?.migrations ?? [],
    hclChecksum: existingLockFile?.hclChecksum,
  };
}

/**
 * Adds a migration record to the lock file.
 */
export function addMigrationRecord(
  lockFile: LockFile,
  fileName: string,
  schemas: readonly string[],
  migrationContent: string
): LockFile {
  const record = {
    fileName,
    generatedAt: new Date().toISOString(),
    schemas,
    checksum: computeHash(migrationContent),
  };

  return {
    ...lockFile,
    updatedAt: new Date().toISOString(),
    migrations: [...lockFile.migrations, record],
  };
}

/**
 * Adds an enhanced migration record to the lock file.
 * Includes timestamp and tableName for regeneration support.
 */
export function addEnhancedMigrationRecord(
  lockFile: LockFile,
  options: {
    fileName: string;
    timestamp: string;
    tableName: string;
    type: 'create' | 'alter' | 'drop' | 'pivot';
    schemas: readonly string[];
    content: string;
  }
): LockFile {
  const record: import('./types.js').GeneratedMigration = {
    fileName: options.fileName,
    timestamp: options.timestamp,
    tableName: options.tableName,
    type: options.type,
    generatedAt: new Date().toISOString(),
    schemas: options.schemas,
    checksum: computeHash(options.content),
  };

  return {
    ...lockFile,
    updatedAt: new Date().toISOString(),
    migrations: [...lockFile.migrations, record],
  };
}

/**
 * Extracts timestamp from migration filename.
 * @example "2026_01_13_100000_create_users_table.php" → "2026_01_13_100000"
 */
export function extractTimestampFromFilename(fileName: string): string | null {
  const match = fileName.match(/^(\d{4}_\d{2}_\d{2}_\d{6})_/);
  return match ? match[1] : null;
}

/**
 * Extracts table name from migration filename.
 * @example "2026_01_13_100000_create_users_table.php" → "users"
 */
export function extractTableNameFromFilename(fileName: string): string | null {
  // Pattern: timestamp_create_tablename_table.php
  const createMatch = fileName.match(/_create_(.+)_table\.php$/);
  if (createMatch) return createMatch[1];

  // Pattern: timestamp_update_tablename_table.php
  const updateMatch = fileName.match(/_update_(.+)_table\.php$/);
  if (updateMatch) return updateMatch[1];

  // Pattern: timestamp_drop_tablename_table.php
  const dropMatch = fileName.match(/_drop_(.+)_table\.php$/);
  if (dropMatch) return dropMatch[1];

  return null;
}

/**
 * Validates migration files against lock file records.
 * Checks for missing files, modified files, and stale migrations.
 */
export async function validateMigrations(
  lockFile: LockFile,
  migrationsDir: string
): Promise<import('./types.js').MigrationValidation> {
  const missingFiles: string[] = [];
  const modifiedFiles: string[] = [];
  const staleFiles: string[] = [];

  // Get all .php files in migrations directory
  let filesOnDisk: string[] = [];
  try {
    const { readdirSync } = await import('node:fs');
    filesOnDisk = readdirSync(migrationsDir).filter(f => f.endsWith('.php'));
  } catch {
    // Directory doesn't exist
  }

  const filesOnDiskSet = new Set(filesOnDisk);

  // Check each tracked migration
  for (const migration of lockFile.migrations) {
    const fileName = migration.fileName;

    // Check if file exists
    if (!filesOnDiskSet.has(fileName)) {
      missingFiles.push(fileName);
      continue;
    }

    // Check if file content matches checksum (only if checksum exists)
    if (migration.checksum) {
      try {
        const { readFileSync } = await import('node:fs');
        const { join } = await import('node:path');
        const content = readFileSync(join(migrationsDir, fileName), 'utf8');
        const currentChecksum = computeHash(content);

        if (currentChecksum !== migration.checksum) {
          modifiedFiles.push(fileName);
        }
      } catch {
        // File read error, already in missingFiles if not found
      }
    }
  }

  // Detect stale migrations (files on disk not in lock file, with old timestamps)
  const trackedFileNames = new Set(lockFile.migrations.map(m => m.fileName));
  const now = new Date();

  for (const fileName of filesOnDisk) {
    if (!trackedFileNames.has(fileName)) {
      // File exists but not tracked - might be from merged branch
      const timestamp = extractTimestampFromFilename(fileName);
      if (timestamp) {
        // Parse timestamp: YYYY_MM_DD_HHMMSS
        const [year, month, day] = timestamp.split('_').slice(0, 3).map(Number);
        const fileDate = new Date(year, month - 1, day);
        const daysDiff = (now.getTime() - fileDate.getTime()) / (1000 * 60 * 60 * 24);

        // If file timestamp is more than 7 days old but not tracked, it's potentially stale
        if (daysDiff > 7) {
          staleFiles.push(fileName);
        }
      }
    }
  }

  return {
    valid: missingFiles.length === 0 && modifiedFiles.length === 0,
    missingFiles,
    modifiedFiles,
    staleFiles,
    totalTracked: lockFile.migrations.length,
    totalOnDisk: filesOnDisk.length,
  };
}

/**
 * Finds migration record by table name.
 * Useful for regenerating deleted migrations.
 */
export function findMigrationByTable(
  lockFile: LockFile,
  tableName: string,
  type?: 'create' | 'alter' | 'drop' | 'pivot'
): import('./types.js').GeneratedMigration | undefined {
  return lockFile.migrations.find(m => {
    // Check if migration has tableName field (enhanced format)
    const mig = m as import('./types.js').GeneratedMigration;
    if (mig.tableName) {
      return mig.tableName === tableName && (!type || mig.type === type);
    }
    // Fallback: extract from filename
    const extractedTable = extractTableNameFromFilename(m.fileName);
    return extractedTable === tableName;
  });
}

/**
 * Gets migrations that need to be regenerated (missing files).
 * Returns migrations with their stored timestamps for consistent regeneration.
 */
export function getMigrationsToRegenerate(
  lockFile: LockFile,
  missingFiles: readonly string[]
): Array<{
  fileName: string;
  timestamp: string;
  tableName: string;
  type: 'create' | 'alter' | 'drop' | 'pivot';
  schemas: readonly string[];
}> {
  const missingSet = new Set(missingFiles);
  const result: Array<{
    fileName: string;
    timestamp: string;
    tableName: string;
    type: 'create' | 'alter' | 'drop' | 'pivot';
    schemas: readonly string[];
  }> = [];

  for (const migration of lockFile.migrations) {
    if (!missingSet.has(migration.fileName)) continue;

    const mig = migration as import('./types.js').GeneratedMigration;

    // Get timestamp (from enhanced format or extract from filename)
    const timestamp = mig.timestamp ?? extractTimestampFromFilename(migration.fileName);
    if (!timestamp) continue;

    // Get table name (from enhanced format or extract from filename)
    const tableName = mig.tableName ?? extractTableNameFromFilename(migration.fileName);
    if (!tableName) continue;

    // Get type (from enhanced format or infer from filename)
    let type: 'create' | 'alter' | 'drop' | 'pivot' = mig.type ?? 'create';
    if (!mig.type) {
      if (migration.fileName.includes('_create_')) type = 'create';
      else if (migration.fileName.includes('_update_')) type = 'alter';
      else if (migration.fileName.includes('_drop_')) type = 'drop';
    }

    result.push({
      fileName: migration.fileName,
      timestamp,
      tableName,
      type,
      schemas: migration.schemas,
    });
  }

  return result;
}
