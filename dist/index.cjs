"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  LOCK_FILE_NAME: () => LOCK_FILE_NAME,
  LOCK_FILE_VERSION: () => LOCK_FILE_VERSION,
  VERSION_CHAIN_FILE: () => VERSION_CHAIN_FILE,
  addEnhancedMigrationRecord: () => addEnhancedMigrationRecord,
  addMigrationRecord: () => addMigrationRecord,
  applySchema: () => applySchema,
  buildCurrentSchemaEntries: () => buildCurrentSchemaEntries,
  buildSchemaHashes: () => buildSchemaHashes,
  buildSchemaSnapshots: () => buildSchemaSnapshots,
  checkAtlasVersion: () => checkAtlasVersion,
  checkBulkLockViolation: () => checkBulkLockViolation,
  checkLockViolation: () => checkLockViolation,
  compareSchemas: () => compareSchemas,
  compareSchemasDeep: () => compareSchemasDeep,
  computeBlockHash: () => computeBlockHash,
  computeHash: () => computeHash,
  computeSchemaHash: () => computeSchemaHash,
  computeSha256: () => computeSha256,
  createDeployBlock: () => createDeployBlock,
  createEmptyChain: () => createEmptyChain,
  createEmptyLockFile: () => createEmptyLockFile,
  deployVersion: () => deployVersion,
  diffHclSchemas: () => diffHclSchemas,
  extractTableNameFromFilename: () => extractTableNameFromFilename,
  extractTimestampFromFilename: () => extractTimestampFromFilename,
  findMigrationByTable: () => findMigrationByTable,
  formatDiffSummary: () => formatDiffSummary,
  formatPreview: () => formatPreview,
  generateHclSchema: () => generateHclSchema,
  generateHclTable: () => generateHclTable,
  generatePreview: () => generatePreview,
  generateVersionName: () => generateVersionName,
  getChainSummary: () => getChainSummary,
  getLockedSchemas: () => getLockedSchemas,
  getMigrationsToRegenerate: () => getMigrationsToRegenerate,
  getPrimaryKeyType: () => getPrimaryKeyType,
  getTimestampType: () => getTimestampType,
  hasBlockingIssues: () => hasBlockingIssues,
  isLockFileV2: () => isLockFileV2,
  mapPropertyToSql: () => mapPropertyToSql,
  parseDiffOutput: () => parseDiffOutput,
  previewSchemaChanges: () => previewSchemaChanges,
  propertyNameToColumnName: () => propertyNameToColumnName,
  propertyToSnapshot: () => propertyToSnapshot,
  readLockFile: () => readLockFile,
  readVersionChain: () => readVersionChain,
  renderHcl: () => renderHcl,
  runAtlasDiff: () => runAtlasDiff,
  schemaNameToTableName: () => schemaNameToTableName,
  schemaToSnapshot: () => schemaToSnapshot,
  updateLockFile: () => updateLockFile,
  updateLockFileV1: () => updateLockFileV1,
  validateHcl: () => validateHcl,
  validateMigrations: () => validateMigrations,
  verifyChain: () => verifyChain,
  writeLockFile: () => writeLockFile,
  writeVersionChain: () => writeVersionChain
});
module.exports = __toCommonJS(index_exports);

// src/lock/lock-file.ts
var import_node_crypto = require("crypto");
var import_promises = require("fs/promises");
var LOCK_FILE_NAME = ".omnify.lock";
var LOCK_FILE_VERSION = 2;
function computeHash(content) {
  return (0, import_node_crypto.createHash)("sha256").update(content, "utf8").digest("hex");
}
function computeSchemaHash(schema) {
  const content = JSON.stringify({
    name: schema.name,
    kind: schema.kind ?? "object",
    properties: schema.properties ?? {},
    options: schema.options ?? {},
    values: schema.values ?? []
  });
  return computeHash(content);
}
function createEmptyLockFile(driver) {
  return {
    version: LOCK_FILE_VERSION,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    driver,
    schemas: {},
    migrations: []
  };
}
function propertyToSnapshot(property) {
  const prop = property;
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
    fields: prop.fields
  };
}
function schemaToSnapshot(schema, hash, modifiedAt) {
  const properties = {};
  if (schema.properties) {
    for (const [name, prop] of Object.entries(schema.properties)) {
      properties[name] = propertyToSnapshot(prop);
    }
  }
  const opts = schema.options;
  let indexes;
  if (opts?.indexes && opts.indexes.length > 0) {
    indexes = opts.indexes.map((idx) => ({
      columns: idx.columns,
      unique: idx.unique ?? false,
      name: idx.name
    }));
  }
  let uniqueConstraints;
  if (opts?.unique) {
    uniqueConstraints = Array.isArray(opts.unique[0]) ? opts.unique : [opts.unique];
  }
  return {
    name: schema.name,
    kind: schema.kind ?? "object",
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
    values: schema.values
  };
}
function isLockFileV2(lockFile) {
  return lockFile.version === 2;
}
async function readLockFile(lockFilePath) {
  try {
    const content = await (0, import_promises.readFile)(lockFilePath, "utf8");
    const parsed = JSON.parse(content);
    const lockFile = parsed;
    if (lockFile.version !== 1 && lockFile.version !== 2) {
      throw new Error(
        `Lock file version mismatch: expected 1 or 2, got ${lockFile.version}`
      );
    }
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
async function writeLockFile(lockFilePath, lockFile) {
  const content = JSON.stringify(lockFile, null, 2) + "\n";
  await (0, import_promises.writeFile)(lockFilePath, content, "utf8");
}
async function buildSchemaHashes(schemas) {
  const hashes = {};
  for (const [name, schema] of Object.entries(schemas)) {
    const hash = computeSchemaHash(schema);
    let modifiedAt;
    try {
      const stats = await (0, import_promises.stat)(schema.filePath);
      modifiedAt = stats.mtime.toISOString();
    } catch {
      modifiedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    hashes[name] = {
      name,
      hash,
      relativePath: schema.relativePath,
      modifiedAt
    };
  }
  return hashes;
}
async function buildSchemaSnapshots(schemas) {
  const snapshots = {};
  for (const [name, schema] of Object.entries(schemas)) {
    const hash = computeSchemaHash(schema);
    let modifiedAt;
    try {
      const stats = await (0, import_promises.stat)(schema.filePath);
      modifiedAt = stats.mtime.toISOString();
    } catch {
      modifiedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    snapshots[name] = schemaToSnapshot(schema, hash, modifiedAt);
  }
  return snapshots;
}
function diffPropertySnapshots(prev, curr) {
  const modifications = [];
  if (prev.type !== curr.type) modifications.push("type");
  if (prev.nullable !== curr.nullable) modifications.push("nullable");
  if (prev.unique !== curr.unique) modifications.push("unique");
  if (JSON.stringify(prev.default) !== JSON.stringify(curr.default)) modifications.push("default");
  if (prev.length !== curr.length) modifications.push("length");
  if (prev.unsigned !== curr.unsigned) modifications.push("unsigned");
  if (prev.precision !== curr.precision) modifications.push("precision");
  if (prev.scale !== curr.scale) modifications.push("scale");
  if (JSON.stringify(prev.enum) !== JSON.stringify(curr.enum)) modifications.push("enum");
  if (prev.relation !== curr.relation) modifications.push("relation");
  if (prev.target !== curr.target) modifications.push("target");
  if (prev.onDelete !== curr.onDelete) modifications.push("onDelete");
  if (prev.onUpdate !== curr.onUpdate) modifications.push("onUpdate");
  if (prev.mappedBy !== curr.mappedBy) modifications.push("mappedBy");
  return modifications;
}
function diffIndexes(prev, curr) {
  const changes = [];
  const prevIndexes = prev ?? [];
  const currIndexes = curr ?? [];
  const indexKey = (idx) => `${idx.columns.join(",")}:${idx.unique}`;
  const prevKeys = new Map(prevIndexes.map((idx) => [indexKey(idx), idx]));
  const currKeys = new Map(currIndexes.map((idx) => [indexKey(idx), idx]));
  for (const [key, idx] of currKeys) {
    if (!prevKeys.has(key)) {
      changes.push({ changeType: "added", index: idx });
    }
  }
  for (const [key, idx] of prevKeys) {
    if (!currKeys.has(key)) {
      changes.push({ changeType: "removed", index: idx });
    }
  }
  return changes;
}
function diffSchemaSnapshots(prev, curr) {
  const columnChanges = [];
  const prevProps = prev.properties;
  const currProps = curr.properties;
  const prevNames = new Set(Object.keys(prevProps));
  const currNames = new Set(Object.keys(currProps));
  const renamedNewNames = /* @__PURE__ */ new Set();
  const renamedOldNames = /* @__PURE__ */ new Set();
  for (const [name, currProp] of Object.entries(currProps)) {
    if (currProp.renamedFrom && prevProps[currProp.renamedFrom]) {
      const prevProp = prevProps[currProp.renamedFrom];
      const mods = diffPropertySnapshots(prevProp, currProp);
      const filteredMods = mods.filter((m) => m !== "renamedFrom");
      columnChanges.push({
        column: name,
        changeType: "renamed",
        previousColumn: currProp.renamedFrom,
        previousDef: prevProp,
        currentDef: currProp,
        modifications: filteredMods.length > 0 ? filteredMods : void 0
      });
      renamedNewNames.add(name);
      renamedOldNames.add(currProp.renamedFrom);
    }
  }
  for (const name of currNames) {
    if (!prevNames.has(name) && !renamedNewNames.has(name)) {
      columnChanges.push({
        column: name,
        changeType: "added",
        currentDef: currProps[name]
      });
    }
  }
  for (const name of prevNames) {
    if (!currNames.has(name) && !renamedOldNames.has(name)) {
      columnChanges.push({
        column: name,
        changeType: "removed",
        previousDef: prevProps[name]
      });
    }
  }
  for (const name of currNames) {
    if (prevNames.has(name) && !renamedNewNames.has(name)) {
      const prevProp = prevProps[name];
      const currProp = currProps[name];
      const mods = diffPropertySnapshots(prevProp, currProp);
      if (mods.length > 0) {
        columnChanges.push({
          column: name,
          changeType: "modified",
          previousDef: prevProp,
          currentDef: currProp,
          modifications: mods
        });
      }
    }
  }
  const indexChanges = diffIndexes(prev.indexes, curr.indexes);
  const optionChanges = {};
  let hasOptionChanges = false;
  if (prev.timestamps !== curr.timestamps) {
    optionChanges.timestamps = { from: prev.timestamps, to: curr.timestamps };
    hasOptionChanges = true;
  }
  if (prev.softDelete !== curr.softDelete) {
    optionChanges.softDelete = { from: prev.softDelete, to: curr.softDelete };
    hasOptionChanges = true;
  }
  if (prev.id !== curr.id) {
    optionChanges.id = { from: prev.id, to: curr.id };
    hasOptionChanges = true;
  }
  if (prev.idType !== curr.idType) {
    optionChanges.idType = { from: prev.idType, to: curr.idType };
    hasOptionChanges = true;
  }
  return {
    columnChanges: columnChanges.length > 0 ? columnChanges : void 0,
    indexChanges: indexChanges.length > 0 ? indexChanges : void 0,
    optionChanges: hasOptionChanges ? optionChanges : void 0
  };
}
function compareSchemas(currentHashes, lockFile) {
  const changes = [];
  const unchanged = [];
  const previousHashes = lockFile?.schemas ?? {};
  const previousNames = new Set(Object.keys(previousHashes));
  const currentNames = new Set(Object.keys(currentHashes));
  for (const name of currentNames) {
    if (!previousNames.has(name)) {
      const current = currentHashes[name];
      if (current) {
        changes.push({
          schemaName: name,
          changeType: "added",
          currentHash: current.hash
        });
      }
    }
  }
  for (const name of previousNames) {
    if (!currentNames.has(name)) {
      const previous = previousHashes[name];
      if (previous) {
        changes.push({
          schemaName: name,
          changeType: "removed",
          previousHash: previous.hash
        });
      }
    }
  }
  for (const name of currentNames) {
    if (previousNames.has(name)) {
      const current = currentHashes[name];
      const previous = previousHashes[name];
      if (current && previous) {
        if (current.hash !== previous.hash) {
          changes.push({
            schemaName: name,
            changeType: "modified",
            previousHash: previous.hash,
            currentHash: current.hash
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
    unchanged
  };
}
function compareSchemasDeep(currentSnapshots, lockFile) {
  const changes = [];
  const unchanged = [];
  const previousSnapshots = lockFile?.schemas ?? {};
  const previousNames = new Set(Object.keys(previousSnapshots));
  const currentNames = new Set(Object.keys(currentSnapshots));
  for (const name of currentNames) {
    if (!previousNames.has(name)) {
      const current = currentSnapshots[name];
      if (current) {
        changes.push({
          schemaName: name,
          changeType: "added",
          currentHash: current.hash
        });
      }
    }
  }
  for (const name of previousNames) {
    if (!currentNames.has(name)) {
      const previous = previousSnapshots[name];
      if (previous) {
        changes.push({
          schemaName: name,
          changeType: "removed",
          previousHash: previous.hash
        });
      }
    }
  }
  for (const name of currentNames) {
    if (previousNames.has(name)) {
      const current = currentSnapshots[name];
      const previous = previousSnapshots[name];
      if (current.hash !== previous.hash) {
        const diff = diffSchemaSnapshots(previous, current);
        changes.push({
          schemaName: name,
          changeType: "modified",
          previousHash: previous.hash,
          currentHash: current.hash,
          ...diff
        });
      } else {
        unchanged.push(name);
      }
    }
  }
  return {
    hasChanges: changes.length > 0,
    changes,
    unchanged
  };
}
function stripTransientInfo(snapshots) {
  const result = {};
  for (const [schemaName, snapshot] of Object.entries(snapshots)) {
    if (!snapshot.properties) {
      result[schemaName] = snapshot;
      continue;
    }
    const cleanProperties = {};
    for (const [propName, prop] of Object.entries(snapshot.properties)) {
      const { renamedFrom, ...rest } = prop;
      cleanProperties[propName] = rest;
    }
    result[schemaName] = {
      ...snapshot,
      properties: cleanProperties
    };
  }
  return result;
}
function updateLockFile(existingLockFile, currentSnapshots, driver) {
  const cleanSnapshots = stripTransientInfo(currentSnapshots);
  return {
    version: LOCK_FILE_VERSION,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    driver,
    schemas: cleanSnapshots,
    migrations: existingLockFile?.migrations ?? [],
    hclChecksum: existingLockFile?.hclChecksum
  };
}
function updateLockFileV1(existingLockFile, currentHashes, driver) {
  return {
    version: 1,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    driver,
    schemas: currentHashes,
    migrations: existingLockFile?.migrations ?? [],
    hclChecksum: existingLockFile?.hclChecksum
  };
}
function addMigrationRecord(lockFile, fileName, schemas, migrationContent) {
  const record = {
    fileName,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    schemas,
    checksum: computeHash(migrationContent)
  };
  return {
    ...lockFile,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    migrations: [...lockFile.migrations, record]
  };
}
function addEnhancedMigrationRecord(lockFile, options) {
  const record = {
    fileName: options.fileName,
    timestamp: options.timestamp,
    tableName: options.tableName,
    type: options.type,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    schemas: options.schemas,
    checksum: computeHash(options.content)
  };
  return {
    ...lockFile,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    migrations: [...lockFile.migrations, record]
  };
}
function extractTimestampFromFilename(fileName) {
  const match = fileName.match(/^(\d{4}_\d{2}_\d{2}_\d{6})_/);
  return match ? match[1] : null;
}
function extractTableNameFromFilename(fileName) {
  const createMatch = fileName.match(/_create_(.+)_table\.php$/);
  if (createMatch) return createMatch[1];
  const updateMatch = fileName.match(/_update_(.+)_table\.php$/);
  if (updateMatch) return updateMatch[1];
  const dropMatch = fileName.match(/_drop_(.+)_table\.php$/);
  if (dropMatch) return dropMatch[1];
  return null;
}
async function validateMigrations(lockFile, migrationsDir) {
  const missingFiles = [];
  const modifiedFiles = [];
  const staleFiles = [];
  let filesOnDisk = [];
  try {
    const { readdirSync } = await import("fs");
    filesOnDisk = readdirSync(migrationsDir).filter((f) => f.endsWith(".php"));
  } catch {
  }
  const filesOnDiskSet = new Set(filesOnDisk);
  for (const migration of lockFile.migrations) {
    const fileName = migration.fileName;
    if (!filesOnDiskSet.has(fileName)) {
      missingFiles.push(fileName);
      continue;
    }
    if (migration.checksum) {
      try {
        const { readFileSync } = await import("fs");
        const { join: join4 } = await import("path");
        const content = readFileSync(join4(migrationsDir, fileName), "utf8");
        const currentChecksum = computeHash(content);
        if (currentChecksum !== migration.checksum) {
          modifiedFiles.push(fileName);
        }
      } catch {
      }
    }
  }
  const trackedFileNames = new Set(lockFile.migrations.map((m) => m.fileName));
  const now = /* @__PURE__ */ new Date();
  for (const fileName of filesOnDisk) {
    if (!trackedFileNames.has(fileName)) {
      const timestamp = extractTimestampFromFilename(fileName);
      if (timestamp) {
        const [year, month, day] = timestamp.split("_").slice(0, 3).map(Number);
        const fileDate = new Date(year, month - 1, day);
        const daysDiff = (now.getTime() - fileDate.getTime()) / (1e3 * 60 * 60 * 24);
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
    totalOnDisk: filesOnDisk.length
  };
}
function findMigrationByTable(lockFile, tableName, type) {
  return lockFile.migrations.find((m) => {
    const mig = m;
    if (mig.tableName) {
      return mig.tableName === tableName && (!type || mig.type === type);
    }
    const extractedTable = extractTableNameFromFilename(m.fileName);
    return extractedTable === tableName;
  });
}
function getMigrationsToRegenerate(lockFile, missingFiles) {
  const missingSet = new Set(missingFiles);
  const result = [];
  for (const migration of lockFile.migrations) {
    if (!missingSet.has(migration.fileName)) continue;
    const mig = migration;
    const timestamp = mig.timestamp ?? extractTimestampFromFilename(migration.fileName);
    if (!timestamp) continue;
    const tableName = mig.tableName ?? extractTableNameFromFilename(migration.fileName);
    if (!tableName) continue;
    let type = mig.type ?? "create";
    if (!mig.type) {
      if (migration.fileName.includes("_create_")) type = "create";
      else if (migration.fileName.includes("_update_")) type = "alter";
      else if (migration.fileName.includes("_drop_")) type = "drop";
    }
    result.push({
      fileName: migration.fileName,
      timestamp,
      tableName,
      type,
      schemas: migration.schemas
    });
  }
  return result;
}

// src/lock/version-chain.ts
var import_node_crypto2 = require("crypto");
var import_promises2 = require("fs/promises");
var import_node_fs = require("fs");
var import_node_path = require("path");
var VERSION_CHAIN_FILE = ".omnify.chain";
function computeSha256(content) {
  return (0, import_node_crypto2.createHash)("sha256").update(content, "utf8").digest("hex");
}
function computeBlockHash(previousHash, version, lockedAt, environment, schemas) {
  const content = JSON.stringify({
    previousHash,
    version,
    lockedAt,
    environment,
    schemas: schemas.map((s) => ({
      name: s.name,
      relativePath: s.relativePath,
      contentHash: s.contentHash
    }))
  });
  return computeSha256(content);
}
function createEmptyChain() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    version: 1,
    type: "omnify-version-chain",
    genesisHash: null,
    latestHash: null,
    blocks: [],
    createdAt: now,
    updatedAt: now
  };
}
async function readVersionChain(chainFilePath) {
  try {
    const content = await (0, import_promises2.readFile)(chainFilePath, "utf8");
    const parsed = JSON.parse(content);
    const chain = parsed;
    if (chain.type !== "omnify-version-chain" || chain.version !== 1) {
      throw new Error("Invalid version chain file format");
    }
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
async function writeVersionChain(chainFilePath, chain) {
  const content = JSON.stringify(chain, null, 2) + "\n";
  await (0, import_promises2.writeFile)(chainFilePath, content, "utf8");
}
async function getFileContentHash(filePath) {
  try {
    const content = await (0, import_promises2.readFile)(filePath, "utf8");
    return computeSha256(content);
  } catch {
    return null;
  }
}
async function buildCurrentSchemaEntries(schemasDir, schemaFiles) {
  const entries = [];
  for (const schema of schemaFiles) {
    const contentHash = await getFileContentHash(schema.filePath);
    if (contentHash) {
      entries.push({
        name: schema.name,
        relativePath: schema.relativePath,
        contentHash
      });
    }
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}
function generateVersionName() {
  const now = /* @__PURE__ */ new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  return `v${year}.${month}.${day}-${hour}${minute}${second}`;
}
async function verifyChain(chain, schemasDir) {
  const verifiedBlocks = [];
  const corruptedBlocks = [];
  const tamperedSchemas = [];
  const deletedLockedSchemas = [];
  const lockedSchemas = /* @__PURE__ */ new Map();
  let previousHash = null;
  for (const block of chain.blocks) {
    const expectedHash = computeBlockHash(
      previousHash,
      block.version,
      block.lockedAt,
      block.environment,
      block.schemas
    );
    if (expectedHash !== block.blockHash) {
      corruptedBlocks.push({
        version: block.version,
        expectedHash,
        actualHash: block.blockHash,
        reason: "Block hash mismatch - chain integrity compromised"
      });
    }
    if (block.previousHash !== previousHash) {
      corruptedBlocks.push({
        version: block.version,
        expectedHash: previousHash ?? "null",
        actualHash: block.previousHash ?? "null",
        reason: "Previous hash chain broken"
      });
    }
    for (const schema of block.schemas) {
      lockedSchemas.set(schema.name, {
        hash: schema.contentHash,
        version: block.version,
        relativePath: schema.relativePath
      });
    }
    if (corruptedBlocks.length === 0 || corruptedBlocks[corruptedBlocks.length - 1]?.version !== block.version) {
      verifiedBlocks.push(block.version);
    }
    previousHash = block.blockHash;
  }
  for (const [name, locked] of lockedSchemas) {
    const filePath = (0, import_node_path.resolve)(schemasDir, locked.relativePath);
    if (!(0, import_node_fs.existsSync)(filePath)) {
      deletedLockedSchemas.push({
        schemaName: name,
        filePath: locked.relativePath,
        lockedInVersion: locked.version,
        lockedHash: locked.hash
      });
    } else {
      const currentHash = await getFileContentHash(filePath);
      if (currentHash && currentHash !== locked.hash) {
        tamperedSchemas.push({
          schemaName: name,
          filePath: locked.relativePath,
          lockedHash: locked.hash,
          currentHash,
          lockedInVersion: locked.version
        });
      }
    }
  }
  return {
    valid: corruptedBlocks.length === 0 && tamperedSchemas.length === 0 && deletedLockedSchemas.length === 0,
    blockCount: chain.blocks.length,
    verifiedBlocks,
    corruptedBlocks,
    tamperedSchemas,
    deletedLockedSchemas
  };
}
function checkLockViolation(chain, schemaName, action) {
  const affectedVersions = [];
  for (const block of chain.blocks) {
    const schema = block.schemas.find((s) => s.name === schemaName);
    if (schema) {
      affectedVersions.push(block.version);
    }
  }
  if (affectedVersions.length > 0) {
    return {
      allowed: false,
      reason: `Schema '${schemaName}' is locked in production version(s): ${affectedVersions.join(", ")}. ${action === "delete" ? "Deletion" : "Modification"} is not allowed.`,
      affectedSchemas: [schemaName],
      lockedInVersions: affectedVersions
    };
  }
  return {
    allowed: true,
    affectedSchemas: [],
    lockedInVersions: []
  };
}
function checkBulkLockViolation(chain, schemas) {
  const violations = [];
  for (const { name, action } of schemas) {
    const result = checkLockViolation(chain, name, action);
    if (!result.allowed) {
      violations.push({
        name,
        versions: [...result.lockedInVersions]
      });
    }
  }
  if (violations.length > 0) {
    const schemaList = violations.map((v) => v.name);
    const allVersions = [...new Set(violations.flatMap((v) => v.versions))];
    return {
      allowed: false,
      reason: `The following schemas are locked: ${schemaList.join(", ")}. They cannot be modified or deleted.`,
      affectedSchemas: schemaList,
      lockedInVersions: allVersions
    };
  }
  return {
    allowed: true,
    affectedSchemas: [],
    lockedInVersions: []
  };
}
function createDeployBlock(chain, schemas, options) {
  const version = options.version ?? generateVersionName();
  const lockedAt = (/* @__PURE__ */ new Date()).toISOString();
  const previousHash = chain.latestHash;
  const blockHash = computeBlockHash(
    previousHash,
    version,
    lockedAt,
    options.environment,
    schemas
  );
  const block = {
    version,
    blockHash,
    previousHash,
    lockedAt,
    environment: options.environment,
    deployedBy: options.deployedBy,
    schemas,
    comment: options.comment
  };
  const updatedChain = {
    ...chain,
    genesisHash: chain.genesisHash ?? blockHash,
    latestHash: blockHash,
    blocks: [...chain.blocks, block],
    updatedAt: lockedAt
  };
  return { chain: updatedChain, block };
}
async function deployVersion(chainFilePath, schemasDir, schemaFiles, options) {
  let chain = await readVersionChain(chainFilePath);
  if (!chain) {
    chain = createEmptyChain();
  }
  const currentSchemas = await buildCurrentSchemaEntries(schemasDir, schemaFiles);
  if (currentSchemas.length === 0) {
    return {
      success: false,
      error: "No schema files found to lock",
      addedSchemas: [],
      modifiedSchemas: [],
      warnings: []
    };
  }
  const previousSchemas = /* @__PURE__ */ new Map();
  for (const block2 of chain.blocks) {
    for (const schema of block2.schemas) {
      previousSchemas.set(schema.name, schema.contentHash);
    }
  }
  const addedSchemas = [];
  const modifiedSchemas = [];
  const warnings = [];
  for (const schema of currentSchemas) {
    const previousHash = previousSchemas.get(schema.name);
    if (!previousHash) {
      addedSchemas.push(schema.name);
    } else if (previousHash !== schema.contentHash) {
      modifiedSchemas.push(schema.name);
      warnings.push(
        `Schema '${schema.name}' has been modified since last lock. This version will include the new state.`
      );
    }
  }
  const { chain: updatedChain, block } = createDeployBlock(
    chain,
    currentSchemas,
    options
  );
  await writeVersionChain(chainFilePath, updatedChain);
  return {
    success: true,
    block,
    addedSchemas,
    modifiedSchemas,
    warnings
  };
}
function getLockedSchemas(chain) {
  const locked = /* @__PURE__ */ new Map();
  for (const block of chain.blocks) {
    for (const schema of block.schemas) {
      locked.set(schema.name, {
        hash: schema.contentHash,
        version: block.version,
        relativePath: schema.relativePath
      });
    }
  }
  return locked;
}
function getChainSummary(chain) {
  const schemaNames = /* @__PURE__ */ new Set();
  const environments = /* @__PURE__ */ new Set();
  for (const block of chain.blocks) {
    environments.add(block.environment);
    for (const schema of block.schemas) {
      schemaNames.add(schema.name);
    }
  }
  return {
    blockCount: chain.blocks.length,
    schemaCount: schemaNames.size,
    firstVersion: chain.blocks[0]?.version ?? null,
    latestVersion: chain.blocks[chain.blocks.length - 1]?.version ?? null,
    environments: [...environments]
  };
}

// src/hcl/type-mapper.ts
var MYSQL_TYPES = {
  String: (prop) => ({
    type: `varchar(${prop.length ?? 255})`,
    nullable: prop.nullable ?? false,
    default: prop.default !== void 0 ? `'${prop.default}'` : void 0
  }),
  Int: (prop) => ({
    type: "int",
    nullable: prop.nullable ?? false,
    default: prop.default !== void 0 ? String(prop.default) : void 0,
    unsigned: prop.unsigned ?? false
  }),
  BigInt: (prop) => ({
    type: "bigint",
    nullable: prop.nullable ?? false,
    default: prop.default !== void 0 ? String(prop.default) : void 0,
    unsigned: prop.unsigned ?? false
  }),
  Float: (prop) => ({
    type: "double",
    nullable: prop.nullable ?? false,
    default: prop.default !== void 0 ? String(prop.default) : void 0
  }),
  Boolean: (prop) => ({
    type: "tinyint(1)",
    nullable: prop.nullable ?? false,
    default: prop.default !== void 0 ? prop.default ? "1" : "0" : void 0
  }),
  Text: (prop) => ({
    type: "text",
    nullable: prop.nullable ?? false
  }),
  LongText: (prop) => ({
    type: "longtext",
    nullable: prop.nullable ?? false
  }),
  Date: (prop) => ({
    type: "date",
    nullable: prop.nullable ?? false
  }),
  Time: (prop) => ({
    type: "time",
    nullable: prop.nullable ?? false
  }),
  Timestamp: (prop) => ({
    type: "timestamp",
    nullable: prop.nullable ?? false
  }),
  Json: (prop) => ({
    type: "json",
    nullable: prop.nullable ?? false
  }),
  Email: (prop) => ({
    type: "varchar(255)",
    nullable: prop.nullable ?? false
  }),
  Password: (prop) => ({
    type: "varchar(255)",
    nullable: prop.nullable ?? false
  }),
  File: (prop) => ({
    type: "varchar(500)",
    nullable: prop.nullable ?? false
  }),
  MultiFile: (prop) => ({
    type: "json",
    nullable: prop.nullable ?? false
  }),
  Enum: (prop) => {
    const enumProp = prop;
    const values = enumProp.enum ?? [];
    const enumDef = values.map((v) => `'${v}'`).join(", ");
    return {
      type: `enum(${enumDef})`,
      nullable: prop.nullable ?? false,
      default: prop.default !== void 0 ? `'${prop.default}'` : void 0
    };
  },
  Select: (prop) => ({
    type: "varchar(100)",
    nullable: prop.nullable ?? false
  }),
  Lookup: (prop) => ({
    type: "bigint",
    nullable: prop.nullable ?? false,
    unsigned: true
  })
};
var POSTGRES_TYPES = {
  String: (prop) => ({
    type: `varchar(${prop.length ?? 255})`,
    nullable: prop.nullable ?? false,
    default: prop.default !== void 0 ? `'${prop.default}'` : void 0
  }),
  Int: (prop) => ({
    type: "integer",
    nullable: prop.nullable ?? false,
    default: prop.default !== void 0 ? String(prop.default) : void 0
  }),
  BigInt: (prop) => ({
    type: "bigint",
    nullable: prop.nullable ?? false,
    default: prop.default !== void 0 ? String(prop.default) : void 0
  }),
  Float: (prop) => ({
    type: "double precision",
    nullable: prop.nullable ?? false,
    default: prop.default !== void 0 ? String(prop.default) : void 0
  }),
  Boolean: (prop) => ({
    type: "boolean",
    nullable: prop.nullable ?? false,
    default: prop.default !== void 0 ? String(prop.default) : void 0
  }),
  Text: (prop) => ({
    type: "text",
    nullable: prop.nullable ?? false
  }),
  LongText: (prop) => ({
    type: "text",
    nullable: prop.nullable ?? false
  }),
  Date: (prop) => ({
    type: "date",
    nullable: prop.nullable ?? false
  }),
  Time: (prop) => ({
    type: "time",
    nullable: prop.nullable ?? false
  }),
  Timestamp: (prop) => ({
    type: "timestamp",
    nullable: prop.nullable ?? false
  }),
  Json: (prop) => ({
    type: "jsonb",
    nullable: prop.nullable ?? false
  }),
  Email: (prop) => ({
    type: "varchar(255)",
    nullable: prop.nullable ?? false
  }),
  Password: (prop) => ({
    type: "varchar(255)",
    nullable: prop.nullable ?? false
  }),
  File: (prop) => ({
    type: "varchar(500)",
    nullable: prop.nullable ?? false
  }),
  MultiFile: (prop) => ({
    type: "jsonb",
    nullable: prop.nullable ?? false
  }),
  // For PostgreSQL, enums are separate types
  Enum: (prop) => ({
    type: "varchar(100)",
    nullable: prop.nullable ?? false,
    default: prop.default !== void 0 ? `'${prop.default}'` : void 0
  }),
  Select: (prop) => ({
    type: "varchar(100)",
    nullable: prop.nullable ?? false
  }),
  Lookup: (prop) => ({
    type: "bigint",
    nullable: prop.nullable ?? false
  })
};
var SQLITE_TYPES = {
  String: (prop) => ({
    type: "text",
    nullable: prop.nullable ?? false,
    default: prop.default !== void 0 ? `'${prop.default}'` : void 0
  }),
  Int: (prop) => ({
    type: "integer",
    nullable: prop.nullable ?? false,
    default: prop.default !== void 0 ? String(prop.default) : void 0
  }),
  BigInt: (prop) => ({
    type: "integer",
    nullable: prop.nullable ?? false,
    default: prop.default !== void 0 ? String(prop.default) : void 0
  }),
  Float: (prop) => ({
    type: "real",
    nullable: prop.nullable ?? false,
    default: prop.default !== void 0 ? String(prop.default) : void 0
  }),
  Boolean: (prop) => ({
    type: "integer",
    nullable: prop.nullable ?? false,
    default: prop.default !== void 0 ? prop.default ? "1" : "0" : void 0
  }),
  Text: (prop) => ({
    type: "text",
    nullable: prop.nullable ?? false
  }),
  LongText: (prop) => ({
    type: "text",
    nullable: prop.nullable ?? false
  }),
  Date: (prop) => ({
    type: "text",
    nullable: prop.nullable ?? false
  }),
  Time: (prop) => ({
    type: "text",
    nullable: prop.nullable ?? false
  }),
  Timestamp: (prop) => ({
    type: "text",
    nullable: prop.nullable ?? false
  }),
  Json: (prop) => ({
    type: "text",
    nullable: prop.nullable ?? false
  }),
  Email: (prop) => ({
    type: "text",
    nullable: prop.nullable ?? false
  }),
  Password: (prop) => ({
    type: "text",
    nullable: prop.nullable ?? false
  }),
  File: (prop) => ({
    type: "text",
    nullable: prop.nullable ?? false
  }),
  MultiFile: (prop) => ({
    type: "text",
    nullable: prop.nullable ?? false
  }),
  Enum: (prop) => ({
    type: "text",
    nullable: prop.nullable ?? false,
    default: prop.default !== void 0 ? `'${prop.default}'` : void 0
  }),
  Select: (prop) => ({
    type: "text",
    nullable: prop.nullable ?? false
  }),
  Lookup: (prop) => ({
    type: "integer",
    nullable: prop.nullable ?? false
  })
};
var DRIVER_TYPE_MAPS = {
  mysql: MYSQL_TYPES,
  postgres: POSTGRES_TYPES,
  pgsql: POSTGRES_TYPES,
  // Alias for postgres
  sqlite: SQLITE_TYPES,
  mariadb: MYSQL_TYPES,
  // MariaDB uses same types as MySQL
  sqlsrv: MYSQL_TYPES
  // SQL Server uses similar types to MySQL for now
};
function mapPropertyToSql(property, driver) {
  const typeMap = DRIVER_TYPE_MAPS[driver];
  const mapper = typeMap[property.type];
  const baseProp = property;
  if (mapper) {
    return mapper(baseProp);
  }
  return {
    type: "varchar(255)",
    nullable: baseProp.nullable ?? false
  };
}
function getPrimaryKeyType(pkType, driver) {
  switch (pkType) {
    case "Int":
      return {
        type: driver === "postgres" ? "serial" : "int",
        nullable: false,
        autoIncrement: driver !== "postgres",
        unsigned: driver === "mysql" || driver === "mariadb"
      };
    case "BigInt":
      return {
        type: driver === "postgres" ? "bigserial" : "bigint",
        nullable: false,
        autoIncrement: driver !== "postgres",
        unsigned: driver === "mysql" || driver === "mariadb"
      };
    case "Uuid":
      return {
        type: driver === "postgres" ? "uuid" : "char(36)",
        nullable: false
      };
    case "String":
      return {
        type: "varchar(255)",
        nullable: false
      };
    default:
      return {
        type: driver === "postgres" ? "bigserial" : "bigint",
        nullable: false,
        autoIncrement: driver !== "postgres",
        unsigned: driver === "mysql" || driver === "mariadb"
      };
  }
}
function getTimestampType(driver) {
  return {
    type: driver === "postgres" ? "timestamp" : "timestamp",
    nullable: true
  };
}
function schemaNameToTableName(schemaName) {
  const snakeCase = schemaName.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
  if (snakeCase.endsWith("y")) {
    return snakeCase.slice(0, -1) + "ies";
  } else if (snakeCase.endsWith("s") || snakeCase.endsWith("x") || snakeCase.endsWith("ch") || snakeCase.endsWith("sh")) {
    return snakeCase + "es";
  } else {
    return snakeCase + "s";
  }
}
function propertyNameToColumnName(propertyName) {
  return propertyName.replace(/([A-Z])/g, "_$1").toLowerCase();
}

// src/hcl/generator.ts
function generateHclTable(schema, allSchemas, driver) {
  const tableName = schemaNameToTableName(schema.name);
  const columns = [];
  const indexes = [];
  const foreignKeys = [];
  if (schema.options?.id !== false) {
    const pkType = schema.options?.idType ?? "BigInt";
    columns.push({
      name: "id",
      type: getPrimaryKeyType(pkType, driver),
      primaryKey: true
    });
  }
  if (schema.properties) {
    for (const [propName, property] of Object.entries(schema.properties)) {
      if (property.type === "Association") {
        const assocProp = property;
        if (assocProp.relation === "ManyToOne" || assocProp.relation === "OneToOne") {
          const columnName2 = propertyNameToColumnName(propName) + "_id";
          const targetSchema = assocProp.target ? allSchemas[assocProp.target] : void 0;
          const targetTable = assocProp.target ? schemaNameToTableName(assocProp.target) : "unknown";
          const targetPkType = targetSchema?.options?.idType ?? "BigInt";
          const fkType = getPrimaryKeyType(
            targetPkType,
            driver
          );
          const isNullable = assocProp.relation === "ManyToOne";
          columns.push({
            name: columnName2,
            type: {
              ...fkType,
              nullable: isNullable,
              autoIncrement: false
            }
          });
          foreignKeys.push({
            name: `fk_${tableName}_${columnName2}`,
            columns: [columnName2],
            refTable: targetTable,
            refColumns: ["id"],
            onDelete: assocProp.onDelete ?? "RESTRICT",
            onUpdate: assocProp.onUpdate ?? "CASCADE"
          });
          indexes.push({
            name: `idx_${tableName}_${columnName2}`,
            columns: [columnName2]
          });
        }
        continue;
      }
      const baseProp = property;
      const columnName = propertyNameToColumnName(propName);
      const sqlType = mapPropertyToSql(property, driver);
      columns.push({
        name: columnName,
        type: sqlType,
        unique: baseProp.unique ?? false
      });
      if (baseProp.unique) {
        indexes.push({
          name: `idx_${tableName}_${columnName}_unique`,
          columns: [columnName],
          unique: true
        });
      }
    }
  }
  if (schema.options?.timestamps !== false) {
    const timestampType = getTimestampType(driver);
    columns.push(
      { name: "created_at", type: timestampType },
      { name: "updated_at", type: timestampType }
    );
  }
  if (schema.options?.softDelete) {
    columns.push({
      name: "deleted_at",
      type: getTimestampType(driver)
    });
  }
  if (schema.options?.indexes) {
    for (const index of schema.options.indexes) {
      const indexColumns = index.columns.map(propertyNameToColumnName);
      indexes.push({
        name: index.name ?? `idx_${tableName}_${indexColumns.join("_")}`,
        columns: indexColumns,
        unique: index.unique ?? false
      });
    }
  }
  if (schema.options?.unique) {
    const uniqueConstraints = Array.isArray(schema.options.unique[0]) ? schema.options.unique : [schema.options.unique];
    for (const constraint of uniqueConstraints) {
      const constraintColumns = constraint.map(propertyNameToColumnName);
      indexes.push({
        name: `idx_${tableName}_${constraintColumns.join("_")}_unique`,
        columns: constraintColumns,
        unique: true
      });
    }
  }
  return {
    name: tableName,
    columns,
    indexes,
    foreignKeys
  };
}
function generateHclSchema(schemas, options) {
  const tables = [];
  for (const schema of Object.values(schemas)) {
    if (schema.kind === "enum") {
      continue;
    }
    const table = generateHclTable(schema, schemas, options.driver);
    tables.push(table);
  }
  const enums = Object.values(schemas).filter((s) => s.kind === "enum").map((s) => ({
    name: s.name.toLowerCase(),
    values: s.values ?? []
  }));
  return {
    driver: options.driver,
    schemaName: options.schemaName,
    tables,
    enums
  };
}
function formatHclColumn(column, driver) {
  const parts = [`  column "${column.name}" {`];
  parts.push(`    type = ${formatSqlType(column.type.type, driver)}`);
  if (column.type.nullable) {
    parts.push("    null = true");
  }
  if (column.type.default !== void 0) {
    parts.push(`    default = ${column.type.default}`);
  }
  if (column.type.autoIncrement) {
    parts.push("    auto_increment = true");
  }
  if (column.type.unsigned && (driver === "mysql" || driver === "mariadb")) {
    parts.push("    unsigned = true");
  }
  parts.push("  }");
  return parts.join("\n");
}
function formatSqlType(type, driver) {
  if (type.startsWith("enum(")) {
    if (driver === "mysql" || driver === "mariadb") {
      return type;
    }
    return "varchar(100)";
  }
  return type;
}
function formatHclIndex(index) {
  const columns = index.columns.map((c) => `"${c}"`).join(", ");
  const unique = index.unique ? "unique = true\n    " : "";
  return `  index "${index.name}" {
    columns = [${columns}]
    ${unique}}`;
}
function formatHclForeignKey(fk) {
  const columns = fk.columns.map((c) => `"${c}"`).join(", ");
  const refColumns = fk.refColumns.map((c) => `"${c}"`).join(", ");
  return `  foreign_key "${fk.name}" {
    columns     = [${columns}]
    ref_columns = [${refColumns}]
    on_update   = ${fk.onUpdate ?? "CASCADE"}
    on_delete   = ${fk.onDelete ?? "RESTRICT"}
  }`;
}
function renderHcl(schema) {
  const lines = [];
  const schemaPrefix = schema.schemaName ? `schema "${schema.schemaName}" {
}

` : "";
  lines.push(schemaPrefix);
  for (const table of schema.tables) {
    lines.push(`table "${table.name}" {`);
    if (schema.schemaName) {
      lines.push(`  schema = schema.${schema.schemaName}`);
    }
    for (const column of table.columns) {
      lines.push(formatHclColumn(column, schema.driver));
    }
    const pkColumn = table.columns.find((c) => c.primaryKey);
    if (pkColumn) {
      lines.push(`  primary_key {
    columns = ["${pkColumn.name}"]
  }`);
    }
    for (const index of table.indexes) {
      lines.push(formatHclIndex(index));
    }
    for (const fk of table.foreignKeys) {
      lines.push(formatHclForeignKey(fk));
    }
    lines.push("}\n");
  }
  return lines.join("\n");
}

// src/atlas/runner.ts
var import_execa = require("execa");
var import_promises3 = require("fs/promises");
var import_node_path2 = require("path");
var import_node_os = require("os");
var import_node_crypto3 = require("crypto");
var import_omnify_core = require("@famgia/omnify-core");
var DEFAULT_CONFIG = {
  binaryPath: "atlas",
  timeout: 6e4
  // 60 seconds
};
function getSchemaUrl(_driver, path) {
  return `file://${path}`;
}
function normalizeDevUrl(devUrl, driver) {
  if (devUrl === "docker") {
    switch (driver) {
      case "mysql":
        return "docker://mysql/8/dev";
      case "mariadb":
        return "docker://mariadb/latest/dev";
      case "postgres":
        return "docker://postgres/15/dev";
      default:
        return devUrl;
    }
  }
  return devUrl;
}
async function createTempDir() {
  const tempPath = (0, import_node_path2.join)((0, import_node_os.tmpdir)(), `omnify-atlas-${(0, import_node_crypto3.randomUUID)()}`);
  await (0, import_promises3.mkdir)(tempPath, { recursive: true });
  return tempPath;
}
async function executeAtlas(config, args) {
  const binaryPath = config.binaryPath ?? DEFAULT_CONFIG.binaryPath;
  const timeout = config.timeout ?? DEFAULT_CONFIG.timeout;
  const startTime = Date.now();
  try {
    const result = config.workDir ? await (0, import_execa.execa)(binaryPath, args, {
      timeout,
      reject: false,
      cwd: config.workDir
    }) : await (0, import_execa.execa)(binaryPath, args, {
      timeout,
      reject: false
    });
    const stdout = typeof result.stdout === "string" ? result.stdout : "";
    const stderr = typeof result.stderr === "string" ? result.stderr : "";
    return {
      success: result.exitCode === 0,
      stdout,
      stderr,
      exitCode: result.exitCode ?? 0,
      duration: Date.now() - startTime
    };
  } catch (error) {
    const err = error;
    if (err.code === "ENOENT") {
      throw (0, import_omnify_core.atlasNotFoundError)();
    }
    throw (0, import_omnify_core.atlasError)(`Failed to execute Atlas: ${err.message}`, err);
  }
}
async function checkAtlasVersion(config = {}) {
  const fullConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    driver: config.driver ?? "mysql",
    devUrl: config.devUrl ?? ""
  };
  try {
    const result = await executeAtlas(fullConfig, ["version"]);
    if (result.success) {
      const match = result.stdout.match(/v?(\d+\.\d+\.\d+)/);
      return {
        version: match?.[1] ?? result.stdout.trim(),
        available: true
      };
    }
    return {
      version: "",
      available: false
    };
  } catch {
    return {
      version: "",
      available: false
    };
  }
}
async function runAtlasDiff(config, options) {
  const devUrl = normalizeDevUrl(config.devUrl, config.driver);
  const toUrl = getSchemaUrl(config.driver, options.toPath);
  const args = [
    "schema",
    "diff",
    "--dev-url",
    devUrl,
    "--to",
    toUrl,
    "--format",
    '{{ sql . "  " }}'
  ];
  if (options.fromPath) {
    const fromUrl = getSchemaUrl(config.driver, options.fromPath);
    args.push("--from", fromUrl);
  }
  const result = await executeAtlas(config, args);
  const sql = result.stdout.trim();
  const hasChanges = sql.length > 0 && !sql.includes("-- No changes");
  return {
    ...result,
    hasChanges,
    sql: hasChanges ? sql : ""
  };
}
async function diffHclSchemas(config, fromHcl, toHcl) {
  const tempDir = await createTempDir();
  try {
    const toPath = (0, import_node_path2.join)(tempDir, "to.hcl");
    await (0, import_promises3.writeFile)(toPath, toHcl, "utf8");
    let fromPath;
    if (fromHcl) {
      fromPath = (0, import_node_path2.join)(tempDir, "from.hcl");
      await (0, import_promises3.writeFile)(fromPath, fromHcl, "utf8");
    }
    return await runAtlasDiff(config, {
      fromPath,
      toPath
    });
  } finally {
    await (0, import_promises3.rm)(tempDir, { recursive: true, force: true });
  }
}
async function validateHcl(config, hclPath) {
  const devUrl = normalizeDevUrl(config.devUrl, config.driver);
  return executeAtlas(config, [
    "schema",
    "inspect",
    "--dev-url",
    devUrl,
    "--url",
    getSchemaUrl(config.driver, hclPath),
    "--format",
    "{{ sql . }}"
  ]);
}
async function applySchema(config, hclPath) {
  const devUrl = normalizeDevUrl(config.devUrl, config.driver);
  return executeAtlas(config, [
    "schema",
    "apply",
    "--dev-url",
    devUrl,
    "--to",
    getSchemaUrl(config.driver, hclPath),
    "--auto-approve"
  ]);
}

// src/diff/parser.ts
var PATTERNS = {
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
  dropForeignKey: /DROP\s+FOREIGN KEY\s+[`"]?(\w+)[`"]?/i
};
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let inString = false;
  let stringChar = "";
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if ((char === "'" || char === '"') && sql[i - 1] !== "\\") {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    if (char === ";" && !inString) {
      const stmt = current.trim();
      if (stmt) {
        statements.push(stmt);
      }
      current = "";
    } else {
      current += char;
    }
  }
  const final = current.trim();
  if (final) {
    statements.push(final);
  }
  return statements;
}
function parseStatement(sql) {
  const trimmedSql = sql.trim();
  let match = trimmedSql.match(PATTERNS.createTable);
  if (match && match[1]) {
    return {
      sql: trimmedSql,
      type: "CREATE_TABLE",
      tableName: match[1],
      severity: "safe"
    };
  }
  match = trimmedSql.match(PATTERNS.dropTable);
  if (match && match[1]) {
    return {
      sql: trimmedSql,
      type: "DROP_TABLE",
      tableName: match[1],
      severity: "destructive"
    };
  }
  match = trimmedSql.match(PATTERNS.createIndex);
  if (match && match[1] && match[2]) {
    return {
      sql: trimmedSql,
      type: "CREATE_INDEX",
      tableName: match[2],
      indexName: match[1],
      severity: "safe"
    };
  }
  match = trimmedSql.match(PATTERNS.dropIndex);
  if (match && match[1]) {
    return {
      sql: trimmedSql,
      type: "DROP_INDEX",
      tableName: match[2] ?? "",
      indexName: match[1],
      severity: "warning"
    };
  }
  match = trimmedSql.match(PATTERNS.alterTable);
  if (match && match[1]) {
    const tableName = match[1];
    const alterPart = trimmedSql.slice(match[0].length);
    const addColMatch = alterPart.match(PATTERNS.addColumn);
    if (addColMatch && addColMatch[1]) {
      return {
        sql: trimmedSql,
        type: "ADD_COLUMN",
        tableName,
        columnName: addColMatch[1],
        severity: "safe"
      };
    }
    const dropColMatch = alterPart.match(PATTERNS.dropColumn);
    if (dropColMatch && dropColMatch[1]) {
      return {
        sql: trimmedSql,
        type: "DROP_COLUMN",
        tableName,
        columnName: dropColMatch[1],
        severity: "destructive"
      };
    }
    const modifyColMatch = alterPart.match(PATTERNS.modifyColumn) || alterPart.match(PATTERNS.changeColumn) || alterPart.match(PATTERNS.alterColumn);
    if (modifyColMatch && modifyColMatch[1]) {
      return {
        sql: trimmedSql,
        type: "MODIFY_COLUMN",
        tableName,
        columnName: modifyColMatch[1],
        severity: "warning"
      };
    }
    if (PATTERNS.addForeignKey.test(alterPart)) {
      const constraintMatch = alterPart.match(PATTERNS.addConstraint);
      const fkConstraintName = constraintMatch?.[1];
      if (fkConstraintName) {
        return {
          sql: trimmedSql,
          type: "ADD_FOREIGN_KEY",
          tableName,
          constraintName: fkConstraintName,
          severity: "safe"
        };
      }
      return {
        sql: trimmedSql,
        type: "ADD_FOREIGN_KEY",
        tableName,
        severity: "safe"
      };
    }
    const dropFkMatch = alterPart.match(PATTERNS.dropForeignKey);
    if (dropFkMatch && dropFkMatch[1]) {
      return {
        sql: trimmedSql,
        type: "DROP_FOREIGN_KEY",
        tableName,
        constraintName: dropFkMatch[1],
        severity: "warning"
      };
    }
    const addConstraintMatch = alterPart.match(PATTERNS.addConstraint);
    if (addConstraintMatch && addConstraintMatch[1]) {
      return {
        sql: trimmedSql,
        type: "ADD_CONSTRAINT",
        tableName,
        constraintName: addConstraintMatch[1],
        severity: "safe"
      };
    }
    const dropConstraintMatch = alterPart.match(PATTERNS.dropConstraint);
    if (dropConstraintMatch && dropConstraintMatch[1]) {
      return {
        sql: trimmedSql,
        type: "DROP_CONSTRAINT",
        tableName,
        constraintName: dropConstraintMatch[1],
        severity: "warning"
      };
    }
    return {
      sql: trimmedSql,
      type: "ALTER_TABLE",
      tableName,
      severity: "warning"
    };
  }
  return {
    sql: trimmedSql,
    type: "UNKNOWN",
    tableName: "",
    severity: "warning"
  };
}
function createEmptyTableChange(tableName) {
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
    droppedForeignKeys: []
  };
}
function getOrCreateTable(tables, tableName) {
  const existing = tables[tableName];
  if (existing) {
    return existing;
  }
  const newTable = createEmptyTableChange(tableName);
  tables[tableName] = newTable;
  return newTable;
}
function groupByTable(statements) {
  const tables = {};
  for (const stmt of statements) {
    if (!stmt.tableName) continue;
    const table = getOrCreateTable(tables, stmt.tableName);
    switch (stmt.type) {
      case "CREATE_TABLE":
        tables[stmt.tableName] = { ...table, isNew: true };
        break;
      case "DROP_TABLE":
        tables[stmt.tableName] = { ...table, isDropped: true };
        break;
      case "ADD_COLUMN":
        if (stmt.columnName) {
          tables[stmt.tableName] = {
            ...table,
            addedColumns: [...table.addedColumns, stmt.columnName]
          };
        }
        break;
      case "DROP_COLUMN":
        if (stmt.columnName) {
          tables[stmt.tableName] = {
            ...table,
            droppedColumns: [...table.droppedColumns, stmt.columnName]
          };
        }
        break;
      case "MODIFY_COLUMN":
        if (stmt.columnName) {
          tables[stmt.tableName] = {
            ...table,
            modifiedColumns: [...table.modifiedColumns, stmt.columnName]
          };
        }
        break;
      case "CREATE_INDEX":
        if (stmt.indexName) {
          tables[stmt.tableName] = {
            ...table,
            addedIndexes: [...table.addedIndexes, stmt.indexName]
          };
        }
        break;
      case "DROP_INDEX":
        if (stmt.indexName) {
          tables[stmt.tableName] = {
            ...table,
            droppedIndexes: [...table.droppedIndexes, stmt.indexName]
          };
        }
        break;
      case "ADD_FOREIGN_KEY":
        tables[stmt.tableName] = {
          ...table,
          addedForeignKeys: [
            ...table.addedForeignKeys,
            stmt.constraintName ?? "unnamed"
          ]
        };
        break;
      case "DROP_FOREIGN_KEY":
        if (stmt.constraintName) {
          tables[stmt.tableName] = {
            ...table,
            droppedForeignKeys: [...table.droppedForeignKeys, stmt.constraintName]
          };
        }
        break;
    }
  }
  return tables;
}
function calculateSummary(statements) {
  return {
    totalStatements: statements.length,
    tablesCreated: statements.filter((s) => s.type === "CREATE_TABLE").length,
    tablesDropped: statements.filter((s) => s.type === "DROP_TABLE").length,
    tablesAltered: statements.filter((s) => s.type === "ALTER_TABLE").length,
    columnsAdded: statements.filter((s) => s.type === "ADD_COLUMN").length,
    columnsDropped: statements.filter((s) => s.type === "DROP_COLUMN").length,
    columnsModified: statements.filter((s) => s.type === "MODIFY_COLUMN").length,
    indexesAdded: statements.filter((s) => s.type === "CREATE_INDEX").length,
    indexesDropped: statements.filter((s) => s.type === "DROP_INDEX").length,
    foreignKeysAdded: statements.filter((s) => s.type === "ADD_FOREIGN_KEY").length,
    foreignKeysDropped: statements.filter((s) => s.type === "DROP_FOREIGN_KEY").length
  };
}
function parseDiffOutput(sql) {
  const trimmedSql = sql.trim();
  if (!trimmedSql || trimmedSql === "-- No changes") {
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
        foreignKeysDropped: 0
      },
      rawSql: trimmedSql
    };
  }
  const sqlWithoutComments = trimmedSql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
  const rawStatements = splitStatements(sqlWithoutComments);
  const statements = rawStatements.map(parseStatement);
  const hasDestructiveChanges = statements.some(
    (s) => s.severity === "destructive"
  );
  return {
    hasChanges: statements.length > 0,
    hasDestructiveChanges,
    statements,
    tableChanges: groupByTable(statements),
    summary: calculateSummary(statements),
    rawSql: trimmedSql
  };
}
function formatDiffSummary(result) {
  if (!result.hasChanges) {
    return "No schema changes detected.";
  }
  const lines = ["Schema changes detected:"];
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
  lines.push("");
  lines.push(`Total: ${summary.totalStatements} statement(s)`);
  if (result.hasDestructiveChanges) {
    lines.push("");
    lines.push("WARNING: This diff contains destructive changes!");
  }
  return lines.join("\n");
}

// src/preview/preview.ts
var import_node_path3 = require("path");
var import_omnify_core2 = require("@famgia/omnify-core");
async function generatePreview(schemas, atlasConfig, options = {}) {
  const atlasVersion = await checkAtlasVersion(atlasConfig);
  if (!atlasVersion.available) {
    throw (0, import_omnify_core2.atlasNotFoundError)();
  }
  const currentHashes = await buildSchemaHashes(schemas);
  const lockFilePath = (0, import_node_path3.join)(atlasConfig.workDir ?? process.cwd(), LOCK_FILE_NAME);
  const existingLockFile = await readLockFile(lockFilePath);
  const schemaChanges = compareSchemas(currentHashes, existingLockFile);
  const currentHcl = renderHcl(
    generateHclSchema(schemas, {
      driver: atlasConfig.driver
    })
  );
  let previousHcl = null;
  if (existingLockFile?.hclChecksum) {
    previousHcl = null;
  }
  const atlasDiff = await diffHclSchemas(atlasConfig, previousHcl, currentHcl);
  const databaseChanges = parseDiffOutput(atlasDiff.sql);
  const summary = buildSummary(schemaChanges, databaseChanges, options);
  return {
    hasChanges: schemaChanges.hasChanges || databaseChanges.hasChanges,
    hasDestructiveChanges: databaseChanges.hasDestructiveChanges,
    schemaChanges,
    databaseChanges,
    summary,
    sql: atlasDiff.sql
  };
}
function buildSummary(schemaChanges, databaseChanges, options) {
  const lines = [];
  if (!schemaChanges.hasChanges && !databaseChanges.hasChanges) {
    return "No changes detected. Schema is up to date.";
  }
  if (schemaChanges.hasChanges) {
    lines.push("Schema file changes:");
    for (const change of schemaChanges.changes) {
      const icon = change.changeType === "added" ? "+" : change.changeType === "removed" ? "-" : "~";
      lines.push(`  ${icon} ${change.schemaName} (${change.changeType})`);
    }
    lines.push("");
  }
  if (databaseChanges.hasChanges) {
    lines.push(formatDiffSummary(databaseChanges));
  }
  if (options.warnDestructive && databaseChanges.hasDestructiveChanges) {
    lines.push("");
    lines.push("\u26A0\uFE0F  WARNING: This preview contains destructive changes!");
    lines.push("   Review carefully before generating migrations.");
  }
  return lines.join("\n");
}
async function previewSchemaChanges(schemas, lockFilePath) {
  const currentHashes = await buildSchemaHashes(schemas);
  const existingLockFile = await readLockFile(lockFilePath);
  return compareSchemas(currentHashes, existingLockFile);
}
function formatPreview(preview, format = "text") {
  switch (format) {
    case "json":
      return JSON.stringify(preview, null, 2);
    case "minimal":
      if (!preview.hasChanges) {
        return "No changes";
      }
      const parts = [];
      const { summary } = preview.databaseChanges;
      if (summary.tablesCreated > 0) parts.push(`+${summary.tablesCreated} tables`);
      if (summary.tablesDropped > 0) parts.push(`-${summary.tablesDropped} tables`);
      if (summary.columnsAdded > 0) parts.push(`+${summary.columnsAdded} columns`);
      if (summary.columnsDropped > 0) parts.push(`-${summary.columnsDropped} columns`);
      return parts.join(", ") || "Changes detected";
    case "text":
    default:
      return preview.summary;
  }
}
function hasBlockingIssues(_preview) {
  return false;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LOCK_FILE_NAME,
  LOCK_FILE_VERSION,
  VERSION_CHAIN_FILE,
  addEnhancedMigrationRecord,
  addMigrationRecord,
  applySchema,
  buildCurrentSchemaEntries,
  buildSchemaHashes,
  buildSchemaSnapshots,
  checkAtlasVersion,
  checkBulkLockViolation,
  checkLockViolation,
  compareSchemas,
  compareSchemasDeep,
  computeBlockHash,
  computeHash,
  computeSchemaHash,
  computeSha256,
  createDeployBlock,
  createEmptyChain,
  createEmptyLockFile,
  deployVersion,
  diffHclSchemas,
  extractTableNameFromFilename,
  extractTimestampFromFilename,
  findMigrationByTable,
  formatDiffSummary,
  formatPreview,
  generateHclSchema,
  generateHclTable,
  generatePreview,
  generateVersionName,
  getChainSummary,
  getLockedSchemas,
  getMigrationsToRegenerate,
  getPrimaryKeyType,
  getTimestampType,
  hasBlockingIssues,
  isLockFileV2,
  mapPropertyToSql,
  parseDiffOutput,
  previewSchemaChanges,
  propertyNameToColumnName,
  propertyToSnapshot,
  readLockFile,
  readVersionChain,
  renderHcl,
  runAtlasDiff,
  schemaNameToTableName,
  schemaToSnapshot,
  updateLockFile,
  updateLockFileV1,
  validateHcl,
  validateMigrations,
  verifyChain,
  writeLockFile,
  writeVersionChain
});
//# sourceMappingURL=index.cjs.map