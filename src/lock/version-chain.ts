/**
 * @famgia/omnify-atlas - Version Chain Management
 *
 * Blockchain-like immutable version tracking for production deployments.
 * ブロックチェーン風の不変性管理システム
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type {
  VersionChain,
  VersionBlock,
  ChainSchemaEntry,
  ChainVerificationResult,
  CorruptedBlockInfo,
  TamperedSchemaInfo,
  DeletedSchemaInfo,
  DeployOptions,
  DeployResult,
  LockCheckResult,
} from './version-chain.types.js';

/**
 * チェーンファイル名
 */
export const VERSION_CHAIN_FILE = '.omnify.chain';

/**
 * SHA-256ハッシュを計算
 */
export function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * ブロックのハッシュを計算
 * previousHash + version + lockedAt + schemas を含む
 */
export function computeBlockHash(
  previousHash: string | null,
  version: string,
  lockedAt: string,
  environment: string,
  schemas: readonly ChainSchemaEntry[]
): string {
  const content = JSON.stringify({
    previousHash,
    version,
    lockedAt,
    environment,
    schemas: schemas.map((s) => ({
      name: s.name,
      relativePath: s.relativePath,
      contentHash: s.contentHash,
    })),
  });
  return computeSha256(content);
}

/**
 * 空のチェーンを作成
 */
export function createEmptyChain(): VersionChain {
  const now = new Date().toISOString();
  return {
    version: 1,
    type: 'omnify-version-chain',
    genesisHash: null,
    latestHash: null,
    blocks: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * チェーンファイルを読み込む
 */
export async function readVersionChain(
  chainFilePath: string
): Promise<VersionChain | null> {
  try {
    const content = await readFile(chainFilePath, 'utf8');
    const parsed = JSON.parse(content) as unknown;
    const chain = parsed as { type?: string; version?: number };

    // 型検証
    if (chain.type !== 'omnify-version-chain' || chain.version !== 1) {
      throw new Error('Invalid version chain file format');
    }

    return parsed as VersionChain;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * チェーンファイルを書き込む
 */
export async function writeVersionChain(
  chainFilePath: string,
  chain: VersionChain
): Promise<void> {
  const content = JSON.stringify(chain, null, 2) + '\n';
  await writeFile(chainFilePath, content, 'utf8');
}

/**
 * ファイルコンテンツのハッシュを取得
 */
async function getFileContentHash(filePath: string): Promise<string | null> {
  try {
    const content = await readFile(filePath, 'utf8');
    return computeSha256(content);
  } catch {
    return null;
  }
}

/**
 * スキーマディレクトリから現在のスキーマエントリを構築
 */
export async function buildCurrentSchemaEntries(
  schemasDir: string,
  schemaFiles: readonly { name: string; relativePath: string; filePath: string }[]
): Promise<ChainSchemaEntry[]> {
  const entries: ChainSchemaEntry[] = [];

  for (const schema of schemaFiles) {
    const contentHash = await getFileContentHash(schema.filePath);
    if (contentHash) {
      entries.push({
        name: schema.name,
        relativePath: schema.relativePath,
        contentHash,
      });
    }
  }

  // 名前順にソート（決定的な順序）
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 自動バージョン名を生成
 */
export function generateVersionName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `v${year}.${month}.${day}-${hour}${minute}${second}`;
}

/**
 * チェーン整合性を検証
 */
export async function verifyChain(
  chain: VersionChain,
  schemasDir: string
): Promise<ChainVerificationResult> {
  const verifiedBlocks: string[] = [];
  const corruptedBlocks: CorruptedBlockInfo[] = [];
  const tamperedSchemas: TamperedSchemaInfo[] = [];
  const deletedLockedSchemas: DeletedSchemaInfo[] = [];

  // 全てのロック済みスキーマを追跡
  const lockedSchemas = new Map<
    string,
    { hash: string; version: string; relativePath: string }
  >();

  let previousHash: string | null = null;

  for (const block of chain.blocks) {
    // 1. ブロックハッシュを検証
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
        reason: 'Block hash mismatch - chain integrity compromised',
      });
    }

    // 2. previousHashチェーン検証
    if (block.previousHash !== previousHash) {
      corruptedBlocks.push({
        version: block.version,
        expectedHash: previousHash ?? 'null',
        actualHash: block.previousHash ?? 'null',
        reason: 'Previous hash chain broken',
      });
    }

    // 3. スキーマを記録
    for (const schema of block.schemas) {
      lockedSchemas.set(schema.name, {
        hash: schema.contentHash,
        version: block.version,
        relativePath: schema.relativePath,
      });
    }

    if (
      corruptedBlocks.length === 0 ||
      corruptedBlocks[corruptedBlocks.length - 1]?.version !== block.version
    ) {
      verifiedBlocks.push(block.version);
    }

    previousHash = block.blockHash;
  }

  // 4. 現在のスキーマファイルをロック済みと比較
  for (const [name, locked] of lockedSchemas) {
    const filePath = resolve(schemasDir, locked.relativePath);

    if (!existsSync(filePath)) {
      // ファイルが削除された
      deletedLockedSchemas.push({
        schemaName: name,
        filePath: locked.relativePath,
        lockedInVersion: locked.version,
        lockedHash: locked.hash,
      });
    } else {
      // ファイルが変更されたか確認
      const currentHash = await getFileContentHash(filePath);
      if (currentHash && currentHash !== locked.hash) {
        tamperedSchemas.push({
          schemaName: name,
          filePath: locked.relativePath,
          lockedHash: locked.hash,
          currentHash,
          lockedInVersion: locked.version,
        });
      }
    }
  }

  return {
    valid:
      corruptedBlocks.length === 0 &&
      tamperedSchemas.length === 0 &&
      deletedLockedSchemas.length === 0,
    blockCount: chain.blocks.length,
    verifiedBlocks,
    corruptedBlocks,
    tamperedSchemas,
    deletedLockedSchemas,
  };
}

/**
 * スキーマ削除/変更がロックに違反するかチェック
 */
export function checkLockViolation(
  chain: VersionChain,
  schemaName: string,
  action: 'delete' | 'modify'
): LockCheckResult {
  const affectedVersions: string[] = [];

  // 全ブロックをチェック
  for (const block of chain.blocks) {
    const schema = block.schemas.find((s) => s.name === schemaName);
    if (schema) {
      affectedVersions.push(block.version);
    }
  }

  if (affectedVersions.length > 0) {
    return {
      allowed: false,
      reason: `Schema '${schemaName}' is locked in production version(s): ${affectedVersions.join(', ')}. ${action === 'delete' ? 'Deletion' : 'Modification'} is not allowed.`,
      affectedSchemas: [schemaName],
      lockedInVersions: affectedVersions,
    };
  }

  return {
    allowed: true,
    affectedSchemas: [],
    lockedInVersions: [],
  };
}

/**
 * 複数スキーマのロック違反を一括チェック
 */
export function checkBulkLockViolation(
  chain: VersionChain,
  schemas: readonly { name: string; action: 'delete' | 'modify' }[]
): LockCheckResult {
  const violations: { name: string; versions: string[] }[] = [];

  for (const { name, action } of schemas) {
    const result = checkLockViolation(chain, name, action);
    if (!result.allowed) {
      violations.push({
        name,
        versions: [...result.lockedInVersions],
      });
    }
  }

  if (violations.length > 0) {
    const schemaList = violations.map((v) => v.name);
    const allVersions = [...new Set(violations.flatMap((v) => v.versions))];
    return {
      allowed: false,
      reason: `The following schemas are locked: ${schemaList.join(', ')}. They cannot be modified or deleted.`,
      affectedSchemas: schemaList,
      lockedInVersions: allVersions,
    };
  }

  return {
    allowed: true,
    affectedSchemas: [],
    lockedInVersions: [],
  };
}

/**
 * 新しいブロックを作成してチェーンに追加
 */
export function createDeployBlock(
  chain: VersionChain,
  schemas: readonly ChainSchemaEntry[],
  options: DeployOptions
): { chain: VersionChain; block: VersionBlock } {
  const version = options.version ?? generateVersionName();
  const lockedAt = new Date().toISOString();
  const previousHash = chain.latestHash;

  const blockHash = computeBlockHash(
    previousHash,
    version,
    lockedAt,
    options.environment,
    schemas
  );

  const block: VersionBlock = {
    version,
    blockHash,
    previousHash,
    lockedAt,
    environment: options.environment,
    deployedBy: options.deployedBy,
    schemas,
    comment: options.comment,
  };

  const updatedChain: VersionChain = {
    ...chain,
    genesisHash: chain.genesisHash ?? blockHash,
    latestHash: blockHash,
    blocks: [...chain.blocks, block],
    updatedAt: lockedAt,
  };

  return { chain: updatedChain, block };
}

/**
 * デプロイ実行（スキーマをロック）
 */
export async function deployVersion(
  chainFilePath: string,
  schemasDir: string,
  schemaFiles: readonly { name: string; relativePath: string; filePath: string }[],
  options: DeployOptions
): Promise<DeployResult> {
  // 既存チェーンを読み込み
  let chain = await readVersionChain(chainFilePath);
  if (!chain) {
    chain = createEmptyChain();
  }

  // 現在のスキーマエントリを構築
  const currentSchemas = await buildCurrentSchemaEntries(schemasDir, schemaFiles);

  if (currentSchemas.length === 0) {
    return {
      success: false,
      error: 'No schema files found to lock',
      addedSchemas: [],
      modifiedSchemas: [],
      warnings: [],
    };
  }

  // 変更されたスキーマを検出（警告用）
  const previousSchemas = new Map<string, string>();
  for (const block of chain.blocks) {
    for (const schema of block.schemas) {
      previousSchemas.set(schema.name, schema.contentHash);
    }
  }

  const addedSchemas: string[] = [];
  const modifiedSchemas: string[] = [];
  const warnings: string[] = [];

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

  // ブロック作成
  const { chain: updatedChain, block } = createDeployBlock(
    chain,
    currentSchemas,
    options
  );

  // ファイルに保存
  await writeVersionChain(chainFilePath, updatedChain);

  return {
    success: true,
    block,
    addedSchemas,
    modifiedSchemas,
    warnings,
  };
}

/**
 * ロック済みスキーマ一覧を取得
 */
export function getLockedSchemas(
  chain: VersionChain
): Map<string, { hash: string; version: string; relativePath: string }> {
  const locked = new Map<
    string,
    { hash: string; version: string; relativePath: string }
  >();

  for (const block of chain.blocks) {
    for (const schema of block.schemas) {
      // 最新のロック状態を保持
      locked.set(schema.name, {
        hash: schema.contentHash,
        version: block.version,
        relativePath: schema.relativePath,
      });
    }
  }

  return locked;
}

/**
 * チェーンのサマリーを取得
 */
export function getChainSummary(chain: VersionChain): {
  blockCount: number;
  schemaCount: number;
  firstVersion: string | null;
  latestVersion: string | null;
  environments: string[];
} {
  const schemaNames = new Set<string>();
  const environments = new Set<string>();

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
    environments: [...environments],
  };
}
