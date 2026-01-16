/**
 * @famgia/omnify-atlas - Version Chain Types
 *
 * Blockchain-like immutable version tracking for production deployments.
 * 一度ロックされたスキーマは変更・削除不可能
 */

/**
 * スキーマファイルのハッシュ情報（ブロック内）
 */
export interface ChainSchemaEntry {
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
export interface VersionBlock {
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
export interface VersionChain {
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
export interface ChainVerificationResult {
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
export interface CorruptedBlockInfo {
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
export interface TamperedSchemaInfo {
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
export interface DeletedSchemaInfo {
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
export interface DeployOptions {
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
export interface DeployResult {
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
export interface LockCheckResult {
  /** 操作が許可されるか */
  readonly allowed: boolean;
  /** ブロックされた理由（allowed=falseの場合） */
  readonly reason?: string | undefined;
  /** 影響を受けるロック済みスキーマ */
  readonly affectedSchemas: readonly string[];
  /** ロックを実行したバージョン */
  readonly lockedInVersions: readonly string[];
}
