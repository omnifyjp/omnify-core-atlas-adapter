/**
 * @famgia/omnify-atlas - Atlas Types
 *
 * Types for Atlas CLI integration.
 */

import type { DatabaseDriver } from '@famgia/omnify-types';

/**
 * Atlas CLI configuration.
 */
export interface AtlasConfig {
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
export interface AtlasDiffOptions {
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
export interface AtlasResult {
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
export interface AtlasDiffResult extends AtlasResult {
  /** Whether there are schema changes */
  readonly hasChanges: boolean;
  /** SQL statements for changes */
  readonly sql: string;
}

/**
 * Atlas schema inspect result.
 */
export interface AtlasInspectResult extends AtlasResult {
  /** HCL schema content */
  readonly hcl: string;
}

/**
 * Atlas version info.
 */
export interface AtlasVersion {
  /** Atlas version string */
  readonly version: string;
  /** Whether Atlas is available */
  readonly available: boolean;
}
