/**
 * @famgia/omnify-atlas - Atlas Runner
 *
 * Executes Atlas CLI commands via subprocess.
 */

import { execa } from 'execa';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { DatabaseDriver } from '@famgia/omnify-types';
import { atlasError, atlasNotFoundError } from '@famgia/omnify-core';
import type {
  AtlasConfig,
  AtlasDiffOptions,
  AtlasResult,
  AtlasDiffResult,
  AtlasVersion,
} from './types.js';

/**
 * Default Atlas configuration.
 */
const DEFAULT_CONFIG: Partial<AtlasConfig> = {
  binaryPath: 'atlas',
  timeout: 60000, // 60 seconds
};

/**
 * Gets the Atlas schema URL for a driver.
 */
function getSchemaUrl(_driver: DatabaseDriver, path: string): string {
  // Atlas uses file:// URLs for local HCL files
  return `file://${path}`;
}

/**
 * Gets the dev database URL format.
 */
function normalizeDevUrl(devUrl: string, driver: DatabaseDriver): string {
  // Atlas uses specific URL formats per driver
  // mysql://user:pass@host:port/dbname
  // postgres://user:pass@host:port/dbname
  // sqlite://path/to/file.db

  // If using docker for dev database
  if (devUrl === 'docker') {
    switch (driver) {
      case 'mysql':
        return 'docker://mysql/8/dev';
      case 'mariadb':
        return 'docker://mariadb/latest/dev';
      case 'postgres':
        return 'docker://postgres/15/dev';
      default:
        return devUrl;
    }
  }

  return devUrl;
}

/**
 * Creates a temporary directory for Atlas operations.
 */
async function createTempDir(): Promise<string> {
  const tempPath = join(tmpdir(), `omnify-atlas-${randomUUID()}`);
  await mkdir(tempPath, { recursive: true });
  return tempPath;
}

/**
 * Executes an Atlas command.
 */
async function executeAtlas(
  config: AtlasConfig,
  args: string[]
): Promise<AtlasResult> {
  const binaryPath = config.binaryPath ?? DEFAULT_CONFIG.binaryPath!;
  const timeout = config.timeout ?? DEFAULT_CONFIG.timeout!;
  const startTime = Date.now();

  try {
    const result = config.workDir
      ? await execa(binaryPath, args, {
          timeout,
          reject: false,
          cwd: config.workDir,
        })
      : await execa(binaryPath, args, {
          timeout,
          reject: false,
        });

    const stdout = typeof result.stdout === 'string' ? result.stdout : '';
    const stderr = typeof result.stderr === 'string' ? result.stderr : '';

    return {
      success: result.exitCode === 0,
      stdout,
      stderr,
      exitCode: result.exitCode ?? 0,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const err = error as Error & { code?: string };

    // Check if Atlas is not found
    if (err.code === 'ENOENT') {
      throw atlasNotFoundError();
    }

    throw atlasError(`Failed to execute Atlas: ${err.message}`, err);
  }
}

/**
 * Checks Atlas version and availability.
 */
export async function checkAtlasVersion(
  config: Partial<AtlasConfig> = {}
): Promise<AtlasVersion> {
  const fullConfig: AtlasConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    driver: config.driver ?? 'mysql',
    devUrl: config.devUrl ?? '',
  };

  try {
    const result = await executeAtlas(fullConfig, ['version']);

    if (result.success) {
      // Parse version from output like "atlas version v0.14.0-..."
      const match = result.stdout.match(/v?(\d+\.\d+\.\d+)/);
      return {
        version: match?.[1] ?? result.stdout.trim(),
        available: true,
      };
    }

    return {
      version: '',
      available: false,
    };
  } catch {
    return {
      version: '',
      available: false,
    };
  }
}

/**
 * Runs Atlas schema diff.
 */
export async function runAtlasDiff(
  config: AtlasConfig,
  options: AtlasDiffOptions
): Promise<AtlasDiffResult> {
  const devUrl = normalizeDevUrl(config.devUrl, config.driver);
  const toUrl = getSchemaUrl(config.driver, options.toPath);

  const args = [
    'schema',
    'diff',
    '--dev-url', devUrl,
    '--to', toUrl,
    '--format', '{{ sql . "  " }}',
  ];

  // If we have a "from" schema, add it
  if (options.fromPath) {
    const fromUrl = getSchemaUrl(config.driver, options.fromPath);
    args.push('--from', fromUrl);
  }

  const result = await executeAtlas(config, args);

  // Check if there are changes
  const sql = result.stdout.trim();
  const hasChanges = sql.length > 0 && !sql.includes('-- No changes');

  return {
    ...result,
    hasChanges,
    sql: hasChanges ? sql : '',
  };
}

/**
 * Runs Atlas schema diff comparing two HCL strings.
 */
export async function diffHclSchemas(
  config: AtlasConfig,
  fromHcl: string | null,
  toHcl: string
): Promise<AtlasDiffResult> {
  // Create temp directory for HCL files
  const tempDir = await createTempDir();

  try {
    const toPath = join(tempDir, 'to.hcl');
    await writeFile(toPath, toHcl, 'utf8');

    let fromPath: string | undefined;
    if (fromHcl) {
      fromPath = join(tempDir, 'from.hcl');
      await writeFile(fromPath, fromHcl, 'utf8');
    }

    return await runAtlasDiff(config, {
      fromPath,
      toPath,
    });
  } finally {
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Validates Atlas HCL schema.
 */
export async function validateHcl(
  config: AtlasConfig,
  hclPath: string
): Promise<AtlasResult> {
  const devUrl = normalizeDevUrl(config.devUrl, config.driver);

  return executeAtlas(config, [
    'schema',
    'inspect',
    '--dev-url', devUrl,
    '--url', getSchemaUrl(config.driver, hclPath),
    '--format', '{{ sql . }}',
  ]);
}

/**
 * Applies schema changes to the dev database (for testing).
 */
export async function applySchema(
  config: AtlasConfig,
  hclPath: string
): Promise<AtlasResult> {
  const devUrl = normalizeDevUrl(config.devUrl, config.driver);

  return executeAtlas(config, [
    'schema',
    'apply',
    '--dev-url', devUrl,
    '--to', getSchemaUrl(config.driver, hclPath),
    '--auto-approve',
  ]);
}
