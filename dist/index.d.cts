import { PropertyDefinition, LoadedSchema, SchemaCollection, DatabaseDriver } from '@famgia/omnify-types';

/**
 * @famgia/omnify-atlas - Lock File Types
 *
 * Types for the .omnify.lock file that tracks schema state.
 */
/**
 * Property snapshot for lock file (normalized structure).
 */
interface PropertySnapshot {
    readonly type: string;
    readonly nullable?: boolean | undefined;
    readonly unique?: boolean | undefined;
    readonly default?: unknown;
    readonly length?: number | undefined;
    readonly unsigned?: boolean | undefined;
    /** Total number of digits for Decimal type (default: 8) */
    readonly precision?: number | undefined;
    /** Number of decimal places for Decimal type (default: 2) */
    readonly scale?: number | undefined;
    readonly enum?: readonly string[] | undefined;
    readonly relation?: string | undefined;
    readonly target?: string | undefined;
    readonly onDelete?: string | undefined;
    readonly onUpdate?: string | undefined;
    readonly mappedBy?: string | undefined;
    readonly joinTable?: string | undefined;
    /** Pivot table fields for ManyToMany relationships */
    readonly pivotFields?: Record<string, {
        type: string;
        nullable?: boolean;
        default?: unknown;
        length?: number;
        unsigned?: boolean;
    }> | undefined;
    readonly renamedFrom?: string | undefined;
    /** Laravel: hidden in serialization */
    readonly hidden?: boolean | undefined;
    /** Laravel: mass assignable */
    readonly fillable?: boolean | undefined;
    /** Per-field overrides for compound types */
    readonly fields?: Record<string, {
        nullable?: boolean;
        hidden?: boolean;
        fillable?: boolean;
    }> | undefined;
}
/**
 * Index snapshot for lock file.
 */
interface IndexSnapshot {
    readonly columns: readonly string[];
    readonly unique: boolean;
    readonly name?: string | undefined;
}
/**
 * Full schema snapshot for change detection.
 */
interface SchemaSnapshot {
    /** Schema name */
    readonly name: string;
    /** Schema kind (object, enum) */
    readonly kind: string;
    /** Content hash (SHA-256) for quick comparison */
    readonly hash: string;
    /** File path relative to schemas directory */
    readonly relativePath: string;
    /** Last modified timestamp (ISO 8601) */
    readonly modifiedAt: string;
    /** Whether auto-generated ID is enabled (default: true) */
    readonly id?: boolean | undefined;
    /** ID column type */
    readonly idType?: string | undefined;
    /** Properties snapshot */
    readonly properties: Record<string, PropertySnapshot>;
    /** Timestamps enabled */
    readonly timestamps?: boolean | undefined;
    /** Soft delete enabled */
    readonly softDelete?: boolean | undefined;
    /** Custom indexes */
    readonly indexes?: readonly IndexSnapshot[] | undefined;
    /** Unique constraints (composite) */
    readonly uniqueConstraints?: readonly (readonly string[])[] | undefined;
    /** Enum values (for enum schemas) */
    readonly values?: readonly string[] | undefined;
}
/**
 * Hash of a schema for change detection (legacy v1 format).
 */
interface SchemaHash {
    /** Schema name */
    readonly name: string;
    /** Content hash (SHA-256) */
    readonly hash: string;
    /** File path relative to schemas directory */
    readonly relativePath: string;
    /** Last modified timestamp (ISO 8601) */
    readonly modifiedAt: string;
}
/**
 * Generated migration record.
 * Enhanced for team development with file tracking and regeneration support.
 * Note: timestamp, tableName, type are optional for backwards compatibility with v1 lock files.
 */
interface GeneratedMigration {
    /** Migration file name (e.g., "2026_01_13_100000_create_users_table.php") */
    readonly fileName: string;
    /** Migration timestamp prefix for regeneration (e.g., "2026_01_13_100000") - Optional for backwards compatibility */
    readonly timestamp?: string | undefined;
    /** Table name for lookup (e.g., "users") - Optional for backwards compatibility */
    readonly tableName?: string | undefined;
    /** Migration type - Optional for backwards compatibility */
    readonly type?: 'create' | 'alter' | 'drop' | 'pivot' | undefined;
    /** Timestamp when generated (ISO 8601) */
    readonly generatedAt: string;
    /** Schemas involved in this migration */
    readonly schemas: readonly string[];
    /** Migration content checksum (SHA-256) for integrity verification */
    readonly checksum: string;
}
/**
 * Migration validation result.
 */
interface MigrationValidation {
    /** Whether all migrations are valid */
    readonly valid: boolean;
    /** List of missing migration files */
    readonly missingFiles: readonly string[];
    /** List of migrations with checksum mismatch (file modified) */
    readonly modifiedFiles: readonly string[];
    /** List of stale migrations (old timestamp, recently added to repo) */
    readonly staleFiles: readonly string[];
    /** Total migrations tracked */
    readonly totalTracked: number;
    /** Total migrations found on disk */
    readonly totalOnDisk: number;
}
/**
 * Lock file structure for tracking schema state (v1 - legacy).
 */
interface LockFileV1 {
    /** Lock file format version */
    readonly version: 1;
    /** When the lock file was last updated */
    readonly updatedAt: string;
    /** Database driver used */
    readonly driver: string;
    /** Hash of each schema */
    readonly schemas: Record<string, SchemaHash>;
    /** Record of generated migrations */
    readonly migrations: readonly GeneratedMigration[];
    /** HCL checksum for Atlas comparison */
    readonly hclChecksum?: string | undefined;
}
/**
 * Lock file structure for tracking schema state (v2 - with snapshots).
 */
interface LockFileV2 {
    /** Lock file format version */
    readonly version: 2;
    /** When the lock file was last updated */
    readonly updatedAt: string;
    /** Database driver used */
    readonly driver: string;
    /** Full schema snapshots for diff */
    readonly schemas: Record<string, SchemaSnapshot>;
    /** Record of generated migrations */
    readonly migrations: readonly GeneratedMigration[];
    /** HCL checksum for Atlas comparison */
    readonly hclChecksum?: string | undefined;
}
/**
 * Union of all lock file versions.
 */
type LockFile = LockFileV1 | LockFileV2;
/**
 * Schema change type.
 */
type ChangeType = 'added' | 'modified' | 'removed';
/**
 * Column change details.
 */
interface ColumnChange {
    readonly column: string;
    readonly changeType: 'added' | 'removed' | 'modified' | 'renamed';
    readonly previousDef?: PropertySnapshot | undefined;
    readonly currentDef?: PropertySnapshot | undefined;
    /** Specific modifications for 'modified' type */
    readonly modifications?: readonly string[] | undefined;
    /** Previous column name for 'renamed' type */
    readonly previousColumn?: string | undefined;
}
/**
 * Index change details.
 */
interface IndexChange {
    readonly changeType: 'added' | 'removed';
    readonly index: IndexSnapshot;
}
/**
 * Detailed schema change with column-level diff.
 */
interface SchemaChange {
    /** Schema name */
    readonly schemaName: string;
    /** Type of change */
    readonly changeType: ChangeType;
    /** Previous hash (for modified/removed) */
    readonly previousHash?: string | undefined;
    /** Current hash (for added/modified) */
    readonly currentHash?: string | undefined;
    /** Column-level changes (for modified schemas) */
    readonly columnChanges?: readonly ColumnChange[] | undefined;
    /** Index-level changes (for modified schemas) */
    readonly indexChanges?: readonly IndexChange[] | undefined;
    /** Options changes */
    readonly optionChanges?: {
        readonly timestamps?: {
            from?: boolean;
            to?: boolean;
        };
        readonly softDelete?: {
            from?: boolean;
            to?: boolean;
        };
        readonly id?: {
            from?: boolean;
            to?: boolean;
        };
        readonly idType?: {
            from?: string;
            to?: string;
        };
    } | undefined;
}
/**
 * Result of comparing current schemas to lock file.
 */
interface LockFileComparison {
    /** Whether any changes were detected */
    readonly hasChanges: boolean;
    /** List of detected changes */
    readonly changes: readonly SchemaChange[];
    /** Schemas that are unchanged */
    readonly unchanged: readonly string[];
}

/**
 * Default lock file name.
 */
declare const LOCK_FILE_NAME = ".omnify.lock";
/**
 * Current lock file format version.
 */
declare const LOCK_FILE_VERSION: 2;
/**
 * Computes SHA-256 hash of content.
 */
declare function computeHash(content: string): string;
/**
 * Computes hash for a schema.
 */
declare function computeSchemaHash(schema: {
    name: string;
    relativePath: string;
    properties?: unknown;
    options?: unknown;
    values?: readonly string[];
    kind?: string;
}): string;
/**
 * Creates a new empty lock file (v2).
 */
declare function createEmptyLockFile(driver: string): LockFileV2;
/**
 * Converts a PropertyDefinition to PropertySnapshot.
 */
declare function propertyToSnapshot(property: PropertyDefinition): PropertySnapshot;
/**
 * Creates a schema snapshot from a loaded schema.
 */
declare function schemaToSnapshot(schema: LoadedSchema, hash: string, modifiedAt: string): SchemaSnapshot;
/**
 * Checks if lock file is v2 format.
 */
declare function isLockFileV2(lockFile: LockFile): lockFile is LockFileV2;
/**
 * Reads lock file from disk.
 * Returns null if file doesn't exist.
 * Supports both v1 and v2 formats.
 */
declare function readLockFile(lockFilePath: string): Promise<LockFile | null>;
/**
 * Writes lock file to disk.
 */
declare function writeLockFile(lockFilePath: string, lockFile: LockFile): Promise<void>;
/**
 * Builds schema hashes from a schema collection (legacy v1 format).
 */
declare function buildSchemaHashes(schemas: SchemaCollection): Promise<Record<string, SchemaHash>>;
/**
 * Builds schema snapshots from a schema collection (v2 format).
 */
declare function buildSchemaSnapshots(schemas: SchemaCollection): Promise<Record<string, SchemaSnapshot>>;
/**
 * Compares current schemas to lock file and detects changes (v1 format - hash only).
 */
declare function compareSchemas(currentHashes: Record<string, SchemaHash>, lockFile: LockFile | null): LockFileComparison;
/**
 * Compares current schemas to lock file with deep diff (v2 format).
 * Returns detailed column-level changes.
 */
declare function compareSchemasDeep(currentSnapshots: Record<string, SchemaSnapshot>, lockFile: LockFileV2 | null): LockFileComparison;
/**
 * Updates lock file with current schema state (v2 format).
 */
declare function updateLockFile(existingLockFile: LockFile | null, currentSnapshots: Record<string, SchemaSnapshot>, driver: string): LockFileV2;
/**
 * Updates lock file with current schema state (legacy v1 format).
 */
declare function updateLockFileV1(existingLockFile: LockFile | null, currentHashes: Record<string, SchemaHash>, driver: string): LockFileV1;
/**
 * Adds a migration record to the lock file.
 */
declare function addMigrationRecord(lockFile: LockFile, fileName: string, schemas: readonly string[], migrationContent: string): LockFile;
/**
 * Adds an enhanced migration record to the lock file.
 * Includes timestamp and tableName for regeneration support.
 */
declare function addEnhancedMigrationRecord(lockFile: LockFile, options: {
    fileName: string;
    timestamp: string;
    tableName: string;
    type: 'create' | 'alter' | 'drop' | 'pivot';
    schemas: readonly string[];
    content: string;
}): LockFile;
/**
 * Extracts timestamp from migration filename.
 * @example "2026_01_13_100000_create_users_table.php" → "2026_01_13_100000"
 */
declare function extractTimestampFromFilename(fileName: string): string | null;
/**
 * Extracts table name from migration filename.
 * @example "2026_01_13_100000_create_users_table.php" → "users"
 */
declare function extractTableNameFromFilename(fileName: string): string | null;
/**
 * Validates migration files against lock file records.
 * Checks for missing files, modified files, and stale migrations.
 */
declare function validateMigrations(lockFile: LockFile, migrationsDir: string): Promise<MigrationValidation>;
/**
 * Finds migration record by table name.
 * Useful for regenerating deleted migrations.
 */
declare function findMigrationByTable(lockFile: LockFile, tableName: string, type?: 'create' | 'alter' | 'drop' | 'pivot'): GeneratedMigration | undefined;
/**
 * Gets migrations that need to be regenerated (missing files).
 * Returns migrations with their stored timestamps for consistent regeneration.
 */
declare function getMigrationsToRegenerate(lockFile: LockFile, missingFiles: readonly string[]): Array<{
    fileName: string;
    timestamp: string;
    tableName: string;
    type: 'create' | 'alter' | 'drop' | 'pivot';
    schemas: readonly string[];
}>;

/**
 * @famgia/omnify-atlas - Version Chain Types
 *
 * Blockchain-like immutable version tracking for production deployments.
 * 一度ロックされたスキーマは変更・削除不可能
 */
/**
 * スキーマファイルのハッシュ情報（ブロック内）
 */
interface ChainSchemaEntry {
    /** スキーマ名 */
    readonly name: string;
    /** ファイルの相対パス */
    readonly relativePath: string;
    /** コンテンツのSHA-256ハッシュ */
    readonly contentHash: string;
}
/**
 * バージョンブロック - チェーン内の1つのロック状態
 */
interface VersionBlock {
    /** バージョン識別子（semantic version または timestamp） */
    readonly version: string;
    /** このブロックのハッシュ（全コンテンツのSHA-256） */
    readonly blockHash: string;
    /** 前のブロックのハッシュ（genesis blockはnull） */
    readonly previousHash: string | null;
    /** ロック時刻（ISO 8601） */
    readonly lockedAt: string;
    /** デプロイ環境（production, staging等） */
    readonly environment: string;
    /** デプロイ者（オプション） */
    readonly deployedBy?: string | undefined;
    /** ロック時点のスキーマ一覧 */
    readonly schemas: readonly ChainSchemaEntry[];
    /** デプロイコメント（オプション） */
    readonly comment?: string | undefined;
}
/**
 * バージョンチェーン - ブロックチェーンライクな不変性管理
 */
interface VersionChain {
    /** フォーマットバージョン */
    readonly version: 1;
    /** チェーンのタイプ識別子 */
    readonly type: 'omnify-version-chain';
    /** 最初のブロックのハッシュ（genesis） */
    readonly genesisHash: string | null;
    /** 最新ブロックのハッシュ */
    readonly latestHash: string | null;
    /** 全てのブロック */
    readonly blocks: readonly VersionBlock[];
    /** チェーン作成日時 */
    readonly createdAt: string;
    /** 最終更新日時 */
    readonly updatedAt: string;
}
/**
 * チェーン検証結果
 */
interface ChainVerificationResult {
    /** チェーン全体が有効か */
    readonly valid: boolean;
    /** ブロック数 */
    readonly blockCount: number;
    /** 検証したブロック */
    readonly verifiedBlocks: readonly string[];
    /** 破損したブロック（もしあれば） */
    readonly corruptedBlocks: readonly CorruptedBlockInfo[];
    /** 不正に変更されたスキーマ */
    readonly tamperedSchemas: readonly TamperedSchemaInfo[];
    /** 削除されたがロック済みのスキーマ */
    readonly deletedLockedSchemas: readonly DeletedSchemaInfo[];
}
/**
 * 破損ブロック情報
 */
interface CorruptedBlockInfo {
    /** ブロックのバージョン */
    readonly version: string;
    /** 期待されるハッシュ */
    readonly expectedHash: string;
    /** 実際のハッシュ */
    readonly actualHash: string;
    /** 問題の詳細 */
    readonly reason: string;
}
/**
 * 改ざんされたスキーマ情報
 */
interface TamperedSchemaInfo {
    /** スキーマ名 */
    readonly schemaName: string;
    /** ファイルパス */
    readonly filePath: string;
    /** ロック時のハッシュ */
    readonly lockedHash: string;
    /** 現在のハッシュ */
    readonly currentHash: string;
    /** どのバージョンでロックされたか */
    readonly lockedInVersion: string;
}
/**
 * 削除されたロック済みスキーマ情報
 */
interface DeletedSchemaInfo {
    /** スキーマ名 */
    readonly schemaName: string;
    /** ファイルパス */
    readonly filePath: string;
    /** どのバージョンでロックされたか */
    readonly lockedInVersion: string;
    /** ロック時のハッシュ */
    readonly lockedHash: string;
}
/**
 * デプロイオプション
 */
interface DeployOptions {
    /** バージョン名（省略時は自動生成） */
    readonly version?: string | undefined;
    /** 環境名 */
    readonly environment: string;
    /** デプロイ者 */
    readonly deployedBy?: string | undefined;
    /** コメント */
    readonly comment?: string | undefined;
    /** 確認をスキップ（CI用） */
    readonly skipConfirmation?: boolean | undefined;
}
/**
 * デプロイ結果
 */
interface DeployResult {
    /** 成功したか */
    readonly success: boolean;
    /** 作成されたブロック（成功時） */
    readonly block?: VersionBlock | undefined;
    /** エラーメッセージ（失敗時） */
    readonly error?: string | undefined;
    /** 新しく追加されたスキーマ */
    readonly addedSchemas: readonly string[];
    /** 変更されたスキーマ（警告） */
    readonly modifiedSchemas: readonly string[];
    /** バージョン変更は警告だが許可される */
    readonly warnings: readonly string[];
}
/**
 * ロック状態チェック結果
 */
interface LockCheckResult {
    /** 操作が許可されるか */
    readonly allowed: boolean;
    /** ブロックされた理由（allowed=falseの場合） */
    readonly reason?: string | undefined;
    /** 影響を受けるロック済みスキーマ */
    readonly affectedSchemas: readonly string[];
    /** ロックを実行したバージョン */
    readonly lockedInVersions: readonly string[];
}

/**
 * @famgia/omnify-atlas - Version Chain Management
 *
 * Blockchain-like immutable version tracking for production deployments.
 * ブロックチェーン風の不変性管理システム
 */

/**
 * チェーンファイル名
 */
declare const VERSION_CHAIN_FILE = ".omnify.chain";
/**
 * SHA-256ハッシュを計算
 */
declare function computeSha256(content: string): string;
/**
 * ブロックのハッシュを計算
 * previousHash + version + lockedAt + schemas を含む
 */
declare function computeBlockHash(previousHash: string | null, version: string, lockedAt: string, environment: string, schemas: readonly ChainSchemaEntry[]): string;
/**
 * 空のチェーンを作成
 */
declare function createEmptyChain(): VersionChain;
/**
 * チェーンファイルを読み込む
 */
declare function readVersionChain(chainFilePath: string): Promise<VersionChain | null>;
/**
 * チェーンファイルを書き込む
 */
declare function writeVersionChain(chainFilePath: string, chain: VersionChain): Promise<void>;
/**
 * スキーマディレクトリから現在のスキーマエントリを構築
 */
declare function buildCurrentSchemaEntries(schemasDir: string, schemaFiles: readonly {
    name: string;
    relativePath: string;
    filePath: string;
}[]): Promise<ChainSchemaEntry[]>;
/**
 * 自動バージョン名を生成
 */
declare function generateVersionName(): string;
/**
 * チェーン整合性を検証
 */
declare function verifyChain(chain: VersionChain, schemasDir: string): Promise<ChainVerificationResult>;
/**
 * スキーマ削除/変更がロックに違反するかチェック
 */
declare function checkLockViolation(chain: VersionChain, schemaName: string, action: 'delete' | 'modify'): LockCheckResult;
/**
 * 複数スキーマのロック違反を一括チェック
 */
declare function checkBulkLockViolation(chain: VersionChain, schemas: readonly {
    name: string;
    action: 'delete' | 'modify';
}[]): LockCheckResult;
/**
 * 新しいブロックを作成してチェーンに追加
 */
declare function createDeployBlock(chain: VersionChain, schemas: readonly ChainSchemaEntry[], options: DeployOptions): {
    chain: VersionChain;
    block: VersionBlock;
};
/**
 * デプロイ実行（スキーマをロック）
 */
declare function deployVersion(chainFilePath: string, schemasDir: string, schemaFiles: readonly {
    name: string;
    relativePath: string;
    filePath: string;
}[], options: DeployOptions): Promise<DeployResult>;
/**
 * ロック済みスキーマ一覧を取得
 */
declare function getLockedSchemas(chain: VersionChain): Map<string, {
    hash: string;
    version: string;
    relativePath: string;
}>;
/**
 * チェーンのサマリーを取得
 */
declare function getChainSummary(chain: VersionChain): {
    blockCount: number;
    schemaCount: number;
    firstVersion: string | null;
    latestVersion: string | null;
    environments: string[];
};

/**
 * @famgia/omnify-atlas - HCL Types
 *
 * Types for Atlas HCL schema generation.
 */

/**
 * SQL column type for a specific database driver.
 */
interface SqlColumnType {
    /** The SQL type (e.g., 'varchar(255)', 'int', 'text') */
    readonly type: string;
    /** Whether the column is nullable */
    readonly nullable: boolean;
    /** Default value (if any) */
    readonly default?: string | undefined;
    /** Whether this is an auto-increment column */
    readonly autoIncrement?: boolean | undefined;
    /** Whether this column is unsigned (for numeric types) */
    readonly unsigned?: boolean | undefined;
}
/**
 * HCL column definition.
 */
interface HclColumn {
    /** Column name */
    readonly name: string;
    /** SQL type info */
    readonly type: SqlColumnType;
    /** Whether this is a primary key */
    readonly primaryKey?: boolean;
    /** Whether this column has a unique constraint */
    readonly unique?: boolean;
}
/**
 * HCL index definition.
 */
interface HclIndex {
    /** Index name */
    readonly name: string;
    /** Columns in the index */
    readonly columns: readonly string[];
    /** Whether this is a unique index */
    readonly unique?: boolean;
}
/**
 * HCL foreign key definition.
 */
interface HclForeignKey {
    /** Foreign key constraint name */
    readonly name: string;
    /** Local column(s) */
    readonly columns: readonly string[];
    /** Referenced table */
    readonly refTable: string;
    /** Referenced column(s) */
    readonly refColumns: readonly string[];
    /** ON DELETE action */
    readonly onDelete?: string;
    /** ON UPDATE action */
    readonly onUpdate?: string;
}
/**
 * HCL table definition.
 */
interface HclTable {
    /** Table name */
    readonly name: string;
    /** Table columns */
    readonly columns: readonly HclColumn[];
    /** Table indexes */
    readonly indexes: readonly HclIndex[];
    /** Foreign key constraints */
    readonly foreignKeys: readonly HclForeignKey[];
    /** Primary key columns (if composite) */
    readonly primaryKey?: readonly string[];
}
/**
 * HCL enum definition.
 */
interface HclEnum {
    /** Enum name */
    readonly name: string;
    /** Enum values */
    readonly values: readonly string[];
}
/**
 * Complete HCL schema.
 */
interface HclSchema {
    /** Database driver */
    readonly driver: DatabaseDriver;
    /** Schema/database name */
    readonly schemaName?: string | undefined;
    /** Tables in the schema */
    readonly tables: readonly HclTable[];
    /** Enums in the schema (PostgreSQL) */
    readonly enums: readonly HclEnum[];
}
/**
 * Options for HCL generation.
 */
interface HclGenerationOptions {
    /** Database driver */
    readonly driver: DatabaseDriver;
    /** Schema/database name */
    readonly schemaName?: string;
    /** Whether to include soft delete column */
    readonly includeSoftDelete?: boolean;
    /** Whether to include timestamps */
    readonly includeTimestamps?: boolean;
}

/**
 * @famgia/omnify-atlas - Type Mapper
 *
 * Maps Omnify property types to SQL types for different database drivers.
 */

/**
 * Maps a property type to SQL column type.
 */
declare function mapPropertyToSql(property: PropertyDefinition, driver: DatabaseDriver): SqlColumnType;
/**
 * Gets the SQL type for a primary key.
 */
declare function getPrimaryKeyType(pkType: 'Int' | 'BigInt' | 'Uuid' | 'String', driver: DatabaseDriver): SqlColumnType;
/**
 * Gets the SQL type for timestamp columns.
 */
declare function getTimestampType(driver: DatabaseDriver): SqlColumnType;
/**
 * Converts table name from PascalCase schema name.
 */
declare function schemaNameToTableName(schemaName: string): string;
/**
 * Converts property name to column name.
 */
declare function propertyNameToColumnName(propertyName: string): string;

/**
 * @famgia/omnify-atlas - HCL Generator
 *
 * Generates Atlas HCL schema from Omnify schemas.
 */

/**
 * Generates HCL table from a schema.
 */
declare function generateHclTable(schema: LoadedSchema, allSchemas: SchemaCollection, driver: DatabaseDriver): HclTable;
/**
 * Generates complete HCL schema from schema collection.
 */
declare function generateHclSchema(schemas: SchemaCollection, options: HclGenerationOptions): HclSchema;
/**
 * Renders HCL schema to string.
 */
declare function renderHcl(schema: HclSchema): string;

/**
 * @famgia/omnify-atlas - Atlas Types
 *
 * Types for Atlas CLI integration.
 */

/**
 * Atlas CLI configuration.
 */
interface AtlasConfig {
    /** Path to Atlas CLI binary (default: 'atlas') */
    readonly binaryPath?: string;
    /** Database driver */
    readonly driver: DatabaseDriver;
    /** Development database URL for diff operations */
    readonly devUrl: string;
    /** Working directory for Atlas operations */
    readonly workDir?: string;
    /** Timeout for Atlas commands in milliseconds */
    readonly timeout?: number;
}
/**
 * Atlas diff operation options.
 */
interface AtlasDiffOptions {
    /** Path to the "from" schema (previous state) */
    readonly fromPath?: string | undefined;
    /** Path to the "to" schema (current state) */
    readonly toPath: string;
    /** Output format */
    readonly format?: 'sql' | 'hcl' | undefined;
    /** Whether to include drop statements */
    readonly allowDestructive?: boolean | undefined;
}
/**
 * Atlas command result.
 */
interface AtlasResult {
    /** Whether the command succeeded */
    readonly success: boolean;
    /** Standard output */
    readonly stdout: string;
    /** Standard error */
    readonly stderr: string;
    /** Exit code */
    readonly exitCode: number;
    /** Execution time in milliseconds */
    readonly duration: number;
}
/**
 * Atlas diff result.
 */
interface AtlasDiffResult extends AtlasResult {
    /** Whether there are schema changes */
    readonly hasChanges: boolean;
    /** SQL statements for changes */
    readonly sql: string;
}
/**
 * Atlas schema inspect result.
 */
interface AtlasInspectResult extends AtlasResult {
    /** HCL schema content */
    readonly hcl: string;
}
/**
 * Atlas version info.
 */
interface AtlasVersion {
    /** Atlas version string */
    readonly version: string;
    /** Whether Atlas is available */
    readonly available: boolean;
}

/**
 * @famgia/omnify-atlas - Atlas Runner
 *
 * Executes Atlas CLI commands via subprocess.
 */

/**
 * Checks Atlas version and availability.
 */
declare function checkAtlasVersion(config?: Partial<AtlasConfig>): Promise<AtlasVersion>;
/**
 * Runs Atlas schema diff.
 */
declare function runAtlasDiff(config: AtlasConfig, options: AtlasDiffOptions): Promise<AtlasDiffResult>;
/**
 * Runs Atlas schema diff comparing two HCL strings.
 */
declare function diffHclSchemas(config: AtlasConfig, fromHcl: string | null, toHcl: string): Promise<AtlasDiffResult>;
/**
 * Validates Atlas HCL schema.
 */
declare function validateHcl(config: AtlasConfig, hclPath: string): Promise<AtlasResult>;
/**
 * Applies schema changes to the dev database (for testing).
 */
declare function applySchema(config: AtlasConfig, hclPath: string): Promise<AtlasResult>;

/**
 * @famgia/omnify-atlas - Diff Types
 *
 * Types for parsed schema diff results.
 */
/**
 * Type of SQL operation.
 */
type SqlOperationType = 'CREATE_TABLE' | 'DROP_TABLE' | 'ALTER_TABLE' | 'CREATE_INDEX' | 'DROP_INDEX' | 'ADD_COLUMN' | 'DROP_COLUMN' | 'MODIFY_COLUMN' | 'ADD_FOREIGN_KEY' | 'DROP_FOREIGN_KEY' | 'ADD_CONSTRAINT' | 'DROP_CONSTRAINT' | 'UNKNOWN';
/**
 * Severity of a change.
 */
type ChangeSeverity = 'safe' | 'warning' | 'destructive';
/**
 * A single parsed SQL statement.
 */
interface ParsedStatement {
    /** Original SQL statement */
    readonly sql: string;
    /** Type of operation */
    readonly type: SqlOperationType;
    /** Table name affected */
    readonly tableName: string;
    /** Column name (if applicable) */
    readonly columnName?: string;
    /** Index name (if applicable) */
    readonly indexName?: string;
    /** Constraint name (if applicable) */
    readonly constraintName?: string;
    /** Severity of the change */
    readonly severity: ChangeSeverity;
}
/**
 * Table change summary.
 */
interface TableChange {
    /** Table name */
    readonly tableName: string;
    /** Whether the table is new */
    readonly isNew: boolean;
    /** Whether the table is being dropped */
    readonly isDropped: boolean;
    /** Columns being added */
    readonly addedColumns: readonly string[];
    /** Columns being dropped */
    readonly droppedColumns: readonly string[];
    /** Columns being modified */
    readonly modifiedColumns: readonly string[];
    /** Indexes being added */
    readonly addedIndexes: readonly string[];
    /** Indexes being dropped */
    readonly droppedIndexes: readonly string[];
    /** Foreign keys being added */
    readonly addedForeignKeys: readonly string[];
    /** Foreign keys being dropped */
    readonly droppedForeignKeys: readonly string[];
}
/**
 * Complete diff result.
 */
interface DiffResult {
    /** Whether there are any changes */
    readonly hasChanges: boolean;
    /** Whether there are destructive changes */
    readonly hasDestructiveChanges: boolean;
    /** All parsed statements */
    readonly statements: readonly ParsedStatement[];
    /** Changes grouped by table */
    readonly tableChanges: Record<string, TableChange>;
    /** Summary counts */
    readonly summary: DiffSummary;
    /** Raw SQL output */
    readonly rawSql: string;
}
/**
 * Summary of changes.
 */
interface DiffSummary {
    /** Total statement count */
    readonly totalStatements: number;
    /** Tables created */
    readonly tablesCreated: number;
    /** Tables dropped */
    readonly tablesDropped: number;
    /** Tables altered */
    readonly tablesAltered: number;
    /** Columns added */
    readonly columnsAdded: number;
    /** Columns dropped */
    readonly columnsDropped: number;
    /** Columns modified */
    readonly columnsModified: number;
    /** Indexes added */
    readonly indexesAdded: number;
    /** Indexes dropped */
    readonly indexesDropped: number;
    /** Foreign keys added */
    readonly foreignKeysAdded: number;
    /** Foreign keys dropped */
    readonly foreignKeysDropped: number;
}

/**
 * @famgia/omnify-atlas - Diff Parser
 *
 * Parses Atlas SQL diff output into structured format.
 */

/**
 * Parses Atlas SQL diff output.
 */
declare function parseDiffOutput(sql: string): DiffResult;
/**
 * Formats diff result for display.
 */
declare function formatDiffSummary(result: DiffResult): string;

/**
 * @famgia/omnify-atlas - Preview Types
 *
 * Types for schema change preview.
 */

/**
 * Options for change preview.
 */
interface PreviewOptions {
    /** Whether to show raw SQL output */
    readonly showSql?: boolean;
    /** Whether to show detailed table changes */
    readonly showDetails?: boolean;
    /** Whether to include warnings for destructive changes */
    readonly warnDestructive?: boolean;
}
/**
 * Complete change preview result.
 */
interface ChangePreview {
    /** Whether any changes were detected */
    readonly hasChanges: boolean;
    /** Whether there are destructive changes */
    readonly hasDestructiveChanges: boolean;
    /** Schema file changes (from lock file comparison) */
    readonly schemaChanges: LockFileComparison;
    /** Database schema changes (from Atlas diff) */
    readonly databaseChanges: DiffResult;
    /** Human-readable summary */
    readonly summary: string;
    /** Raw SQL for changes */
    readonly sql: string;
}
/**
 * Preview display format.
 */
type PreviewFormat = 'text' | 'json' | 'minimal';

/**
 * @famgia/omnify-atlas - Change Preview
 *
 * Generates human-readable change previews.
 */

/**
 * Generates a change preview for schemas.
 */
declare function generatePreview(schemas: SchemaCollection, atlasConfig: AtlasConfig, options?: PreviewOptions): Promise<ChangePreview>;
/**
 * Previews changes without running Atlas (schema files only).
 */
declare function previewSchemaChanges(schemas: SchemaCollection, lockFilePath: string): Promise<{
    hasChanges: boolean;
    changes: readonly {
        schemaName: string;
        changeType: string;
    }[];
}>;
/**
 * Formats preview for display.
 */
declare function formatPreview(preview: ChangePreview, format?: PreviewFormat): string;
/**
 * Checks if preview has blocking issues.
 */
declare function hasBlockingIssues(_preview: ChangePreview): boolean;

export { type AtlasConfig, type AtlasDiffOptions, type AtlasDiffResult, type AtlasInspectResult, type AtlasResult, type AtlasVersion, type ChainSchemaEntry, type ChainVerificationResult, type ChangePreview, type ChangeSeverity, type ChangeType, type ColumnChange, type CorruptedBlockInfo, type DeletedSchemaInfo, type DeployOptions, type DeployResult, type DiffResult, type DiffSummary, type GeneratedMigration, type HclColumn, type HclEnum, type HclForeignKey, type HclGenerationOptions, type HclIndex, type HclSchema, type HclTable, type IndexChange, type IndexSnapshot, LOCK_FILE_NAME, LOCK_FILE_VERSION, type LockCheckResult, type LockFile, type LockFileComparison, type LockFileV1, type LockFileV2, type MigrationValidation, type ParsedStatement, type PreviewFormat, type PreviewOptions, type PropertySnapshot, type SchemaChange, type SchemaHash, type SchemaSnapshot, type SqlColumnType, type SqlOperationType, type TableChange, type TamperedSchemaInfo, VERSION_CHAIN_FILE, type VersionBlock, type VersionChain, addEnhancedMigrationRecord, addMigrationRecord, applySchema, buildCurrentSchemaEntries, buildSchemaHashes, buildSchemaSnapshots, checkAtlasVersion, checkBulkLockViolation, checkLockViolation, compareSchemas, compareSchemasDeep, computeBlockHash, computeHash, computeSchemaHash, computeSha256, createDeployBlock, createEmptyChain, createEmptyLockFile, deployVersion, diffHclSchemas, extractTableNameFromFilename, extractTimestampFromFilename, findMigrationByTable, formatDiffSummary, formatPreview, generateHclSchema, generateHclTable, generatePreview, generateVersionName, getChainSummary, getLockedSchemas, getMigrationsToRegenerate, getPrimaryKeyType, getTimestampType, hasBlockingIssues, isLockFileV2, mapPropertyToSql, parseDiffOutput, previewSchemaChanges, propertyNameToColumnName, propertyToSnapshot, readLockFile, readVersionChain, renderHcl, runAtlasDiff, schemaNameToTableName, schemaToSnapshot, updateLockFile, updateLockFileV1, validateHcl, validateMigrations, verifyChain, writeLockFile, writeVersionChain };
