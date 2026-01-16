/**
 * @famgia/omnify-atlas - Version Chain Tests
 *
 * Tests for blockchain-like version locking.
 * ブロックチェーン風バージョンロックのテスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createEmptyChain,
  computeSha256,
  computeBlockHash,
  createDeployBlock,
  verifyChain,
  checkLockViolation,
  checkBulkLockViolation,
  getLockedSchemas,
  getChainSummary,
  writeVersionChain,
  readVersionChain,
  buildCurrentSchemaEntries,
  deployVersion,
} from './version-chain.js';
import type { VersionChain, ChainSchemaEntry } from './version-chain.types.js';

describe('version-chain', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'omnify-chain-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('computeSha256', () => {
    it('should compute consistent hash for same content', () => {
      const hash1 = computeSha256('test content');
      const hash2 = computeSha256('test content');
      expect(hash1).toBe(hash2);
    });

    it('should compute different hash for different content', () => {
      const hash1 = computeSha256('content A');
      const hash2 = computeSha256('content B');
      expect(hash1).not.toBe(hash2);
    });

    it('should return 64 character hex string', () => {
      const hash = computeSha256('test');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('computeBlockHash', () => {
    it('should include all relevant data in hash', () => {
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
      ];

      const hash1 = computeBlockHash(null, 'v1.0.0', '2026-01-01T00:00:00Z', 'production', schemas);
      const hash2 = computeBlockHash(null, 'v1.0.1', '2026-01-01T00:00:00Z', 'production', schemas);

      expect(hash1).not.toBe(hash2);
    });

    it('should chain blocks with previousHash', () => {
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
      ];

      const hash1 = computeBlockHash(null, 'v1.0.0', '2026-01-01T00:00:00Z', 'production', schemas);
      const hash2 = computeBlockHash(hash1, 'v1.0.1', '2026-01-02T00:00:00Z', 'production', schemas);

      expect(hash1).not.toBe(hash2);
      expect(hash2).toBeTruthy();
    });
  });

  describe('createEmptyChain', () => {
    it('should create valid empty chain', () => {
      const chain = createEmptyChain();

      expect(chain.version).toBe(1);
      expect(chain.type).toBe('omnify-version-chain');
      expect(chain.genesisHash).toBeNull();
      expect(chain.latestHash).toBeNull();
      expect(chain.blocks).toHaveLength(0);
      expect(chain.createdAt).toBeTruthy();
      expect(chain.updatedAt).toBeTruthy();
    });
  });

  describe('createDeployBlock', () => {
    it('should create first block with null previousHash', () => {
      const chain = createEmptyChain();
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
      ];

      const { chain: newChain, block } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });

      expect(block.previousHash).toBeNull();
      expect(block.version).toBe('v1.0.0');
      expect(block.environment).toBe('production');
      expect(block.schemas).toHaveLength(1);
      expect(newChain.genesisHash).toBe(block.blockHash);
      expect(newChain.latestHash).toBe(block.blockHash);
      expect(newChain.blocks).toHaveLength(1);
    });

    it('should chain blocks correctly', () => {
      let chain = createEmptyChain();
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
      ];

      // First block
      const result1 = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });
      chain = result1.chain;

      // Second block
      const result2 = createDeployBlock(chain, schemas, {
        version: 'v1.0.1',
        environment: 'production',
      });

      expect(result2.block.previousHash).toBe(result1.block.blockHash);
      expect(result2.chain.genesisHash).toBe(result1.block.blockHash);
      expect(result2.chain.latestHash).toBe(result2.block.blockHash);
      expect(result2.chain.blocks).toHaveLength(2);
    });
  });

  describe('verifyChain', () => {
    it('should verify valid empty chain', async () => {
      const chain = createEmptyChain();
      const result = await verifyChain(chain, tempDir);

      expect(result.valid).toBe(true);
      expect(result.blockCount).toBe(0);
    });

    it('should verify valid chain with blocks and matching files', async () => {
      // Create schema file
      const schemasDir = join(tempDir, 'schemas');
      await mkdir(schemasDir, { recursive: true });
      const userContent = 'name: User\nproperties:\n  email: String';
      await writeFile(join(schemasDir, 'User.yaml'), userContent);

      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: computeSha256(userContent) },
      ];

      let chain = createEmptyChain();
      const { chain: newChain } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });

      const result = await verifyChain(newChain, schemasDir);

      expect(result.valid).toBe(true);
      expect(result.blockCount).toBe(1);
      expect(result.tamperedSchemas).toHaveLength(0);
      expect(result.deletedLockedSchemas).toHaveLength(0);
    });

    it('should detect tampered schema files', async () => {
      // Create schema file
      const schemasDir = join(tempDir, 'schemas');
      await mkdir(schemasDir, { recursive: true });
      const originalContent = 'name: User\nproperties:\n  email: String';
      await writeFile(join(schemasDir, 'User.yaml'), originalContent);

      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: computeSha256(originalContent) },
      ];

      let chain = createEmptyChain();
      const { chain: newChain } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });

      // Modify the file after locking
      await writeFile(join(schemasDir, 'User.yaml'), 'MODIFIED CONTENT');

      const result = await verifyChain(newChain, schemasDir);

      expect(result.valid).toBe(false);
      expect(result.tamperedSchemas).toHaveLength(1);
      expect(result.tamperedSchemas[0].schemaName).toBe('User');
    });

    it('should detect deleted locked schemas', async () => {
      // Create schema file
      const schemasDir = join(tempDir, 'schemas');
      await mkdir(schemasDir, { recursive: true });
      const content = 'name: User\nproperties:\n  email: String';
      await writeFile(join(schemasDir, 'User.yaml'), content);

      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: computeSha256(content) },
      ];

      let chain = createEmptyChain();
      const { chain: newChain } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });

      // Delete the file
      await rm(join(schemasDir, 'User.yaml'));

      const result = await verifyChain(newChain, schemasDir);

      expect(result.valid).toBe(false);
      expect(result.deletedLockedSchemas).toHaveLength(1);
      expect(result.deletedLockedSchemas[0].schemaName).toBe('User');
    });
  });

  describe('checkLockViolation', () => {
    it('should allow operations on unlocked schemas', () => {
      const chain = createEmptyChain();
      const result = checkLockViolation(chain, 'NewSchema', 'delete');

      expect(result.allowed).toBe(true);
    });

    it('should block deletion of locked schemas', () => {
      let chain = createEmptyChain();
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
      ];

      const { chain: newChain } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });

      const result = checkLockViolation(newChain, 'User', 'delete');

      expect(result.allowed).toBe(false);
      expect(result.affectedSchemas).toContain('User');
      expect(result.lockedInVersions).toContain('v1.0.0');
    });

    it('should block modification of locked schemas', () => {
      let chain = createEmptyChain();
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
      ];

      const { chain: newChain } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });

      const result = checkLockViolation(newChain, 'User', 'modify');

      expect(result.allowed).toBe(false);
    });
  });

  describe('checkBulkLockViolation', () => {
    it('should check multiple schemas at once', () => {
      let chain = createEmptyChain();
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
        { name: 'Post', relativePath: 'Post.yaml', contentHash: 'def456' },
      ];

      const { chain: newChain } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });

      const result = checkBulkLockViolation(newChain, [
        { name: 'User', action: 'delete' },
        { name: 'NewSchema', action: 'delete' },
      ]);

      expect(result.allowed).toBe(false);
      expect(result.affectedSchemas).toContain('User');
      expect(result.affectedSchemas).not.toContain('NewSchema');
    });
  });

  describe('getLockedSchemas', () => {
    it('should return empty map for empty chain', () => {
      const chain = createEmptyChain();
      const locked = getLockedSchemas(chain);

      expect(locked.size).toBe(0);
    });

    it('should return all locked schemas', () => {
      let chain = createEmptyChain();
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
        { name: 'Post', relativePath: 'Post.yaml', contentHash: 'def456' },
      ];

      const { chain: newChain } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });

      const locked = getLockedSchemas(newChain);

      expect(locked.size).toBe(2);
      expect(locked.has('User')).toBe(true);
      expect(locked.has('Post')).toBe(true);
    });
  });

  describe('getChainSummary', () => {
    it('should return correct summary', () => {
      let chain = createEmptyChain();
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
      ];

      const { chain: chain1 } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });

      const { chain: chain2 } = createDeployBlock(chain1, schemas, {
        version: 'v1.0.1',
        environment: 'staging',
      });

      const summary = getChainSummary(chain2);

      expect(summary.blockCount).toBe(2);
      expect(summary.schemaCount).toBe(1);
      expect(summary.firstVersion).toBe('v1.0.0');
      expect(summary.latestVersion).toBe('v1.0.1');
      expect(summary.environments).toContain('production');
      expect(summary.environments).toContain('staging');
    });
  });

  describe('writeVersionChain / readVersionChain', () => {
    it('should write and read chain correctly', async () => {
      const chainPath = join(tempDir, '.omnify.chain');
      let chain = createEmptyChain();
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
      ];

      const { chain: newChain } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });

      await writeVersionChain(chainPath, newChain);
      const loaded = await readVersionChain(chainPath);

      expect(loaded).not.toBeNull();
      expect(loaded!.blocks).toHaveLength(1);
      expect(loaded!.blocks[0].version).toBe('v1.0.0');
    });

    it('should return null for non-existent file', async () => {
      const loaded = await readVersionChain(join(tempDir, 'nonexistent.chain'));
      expect(loaded).toBeNull();
    });
  });

  describe('deployVersion', () => {
    it('should deploy first version successfully', async () => {
      // Setup
      const schemasDir = join(tempDir, 'schemas');
      await mkdir(schemasDir, { recursive: true });
      const userContent = 'name: User\nproperties:\n  email: String';
      await writeFile(join(schemasDir, 'User.yaml'), userContent);

      const chainPath = join(tempDir, '.omnify.chain');
      const schemaFiles = [
        { name: 'User', relativePath: 'User.yaml', filePath: join(schemasDir, 'User.yaml') },
      ];

      const result = await deployVersion(chainPath, schemasDir, schemaFiles, {
        version: 'v1.0.0',
        environment: 'production',
        skipConfirmation: true,
      });

      expect(result.success).toBe(true);
      expect(result.block).toBeDefined();
      expect(result.block!.version).toBe('v1.0.0');
      expect(result.addedSchemas).toContain('User');

      // Verify chain was written
      const chain = await readVersionChain(chainPath);
      expect(chain).not.toBeNull();
      expect(chain!.blocks).toHaveLength(1);
    });

    it('should fail when no schema files provided', async () => {
      const schemasDir = join(tempDir, 'schemas');
      await mkdir(schemasDir, { recursive: true });

      const chainPath = join(tempDir, '.omnify.chain');
      const schemaFiles: { name: string; relativePath: string; filePath: string }[] = [];

      const result = await deployVersion(chainPath, schemasDir, schemaFiles, {
        version: 'v1.0.0',
        environment: 'production',
        skipConfirmation: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No schema files found');
    });

    it('should deploy multiple versions with chained blocks', async () => {
      const schemasDir = join(tempDir, 'schemas');
      await mkdir(schemasDir, { recursive: true });
      const userContent = 'name: User\nproperties:\n  email: String';
      await writeFile(join(schemasDir, 'User.yaml'), userContent);

      const chainPath = join(tempDir, '.omnify.chain');
      const schemaFiles = [
        { name: 'User', relativePath: 'User.yaml', filePath: join(schemasDir, 'User.yaml') },
      ];

      // Deploy v1.0.0
      await deployVersion(chainPath, schemasDir, schemaFiles, {
        version: 'v1.0.0',
        environment: 'production',
        skipConfirmation: true,
      });

      // Deploy v1.0.1
      const result = await deployVersion(chainPath, schemasDir, schemaFiles, {
        version: 'v1.0.1',
        environment: 'production',
        skipConfirmation: true,
      });

      expect(result.success).toBe(true);
      expect(result.block!.version).toBe('v1.0.1');

      // Verify chain has 2 blocks
      const chain = await readVersionChain(chainPath);
      expect(chain!.blocks).toHaveLength(2);
      expect(chain!.blocks[1]!.previousHash).toBe(chain!.blocks[0]!.blockHash);
    });

    it('should detect modified schemas and generate warnings', async () => {
      const schemasDir = join(tempDir, 'schemas');
      await mkdir(schemasDir, { recursive: true });
      const userContent = 'name: User\nproperties:\n  email: String';
      await writeFile(join(schemasDir, 'User.yaml'), userContent);

      const chainPath = join(tempDir, '.omnify.chain');
      const schemaFiles = [
        { name: 'User', relativePath: 'User.yaml', filePath: join(schemasDir, 'User.yaml') },
      ];

      // Deploy v1.0.0
      await deployVersion(chainPath, schemasDir, schemaFiles, {
        version: 'v1.0.0',
        environment: 'production',
        skipConfirmation: true,
      });

      // Modify the schema
      await writeFile(join(schemasDir, 'User.yaml'), 'name: User\nproperties:\n  email: String\n  name: String');

      // Deploy v1.0.1
      const result = await deployVersion(chainPath, schemasDir, schemaFiles, {
        version: 'v1.0.1',
        environment: 'production',
        skipConfirmation: true,
      });

      expect(result.success).toBe(true);
      expect(result.modifiedSchemas).toContain('User');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('User');
      expect(result.warnings[0]).toContain('modified');
    });

    it('should detect newly added schemas', async () => {
      const schemasDir = join(tempDir, 'schemas');
      await mkdir(schemasDir, { recursive: true });
      await writeFile(join(schemasDir, 'User.yaml'), 'name: User');

      const chainPath = join(tempDir, '.omnify.chain');

      // Deploy v1.0.0 with User
      await deployVersion(chainPath, schemasDir, [
        { name: 'User', relativePath: 'User.yaml', filePath: join(schemasDir, 'User.yaml') },
      ], {
        version: 'v1.0.0',
        environment: 'production',
        skipConfirmation: true,
      });

      // Add Post schema
      await writeFile(join(schemasDir, 'Post.yaml'), 'name: Post');

      // Deploy v1.0.1 with User and Post
      const result = await deployVersion(chainPath, schemasDir, [
        { name: 'User', relativePath: 'User.yaml', filePath: join(schemasDir, 'User.yaml') },
        { name: 'Post', relativePath: 'Post.yaml', filePath: join(schemasDir, 'Post.yaml') },
      ], {
        version: 'v1.0.1',
        environment: 'production',
        skipConfirmation: true,
      });

      expect(result.success).toBe(true);
      expect(result.addedSchemas).toContain('Post');
      expect(result.addedSchemas).not.toContain('User'); // User was already in previous version
    });
  });

  // ===========================================================================
  // Edge Cases - Corrupted/Invalid Chain
  // ===========================================================================

  describe('Edge Cases - Corrupted Chain', () => {
    it('should throw error for invalid chain file format', async () => {
      const chainPath = join(tempDir, 'invalid.chain');
      await writeFile(chainPath, JSON.stringify({ invalid: 'data' }));

      await expect(readVersionChain(chainPath)).rejects.toThrow('Invalid version chain file');
    });

    it('should throw error for wrong version number', async () => {
      const chainPath = join(tempDir, 'wrong-version.chain');
      await writeFile(chainPath, JSON.stringify({
        version: 999,
        type: 'omnify-version-chain',
        blocks: [],
      }));

      await expect(readVersionChain(chainPath)).rejects.toThrow('Invalid version chain file');
    });

    it('should throw error for malformed JSON', async () => {
      const chainPath = join(tempDir, 'malformed.chain');
      await writeFile(chainPath, 'not valid json {{{');

      await expect(readVersionChain(chainPath)).rejects.toThrow();
    });

    it('should detect block hash tampering in verification', async () => {
      const schemasDir = join(tempDir, 'schemas');
      await mkdir(schemasDir, { recursive: true });
      const content = 'name: User';
      await writeFile(join(schemasDir, 'User.yaml'), content);

      let chain = createEmptyChain();
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: computeSha256(content) },
      ];

      const { chain: validChain, block } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });

      // Tamper with block hash
      const tamperedChain: VersionChain = {
        ...validChain,
        blocks: [{
          ...block,
          blockHash: 'tampered-hash-12345',
        }],
      };

      const result = await verifyChain(tamperedChain, schemasDir);

      expect(result.valid).toBe(false);
      expect(result.corruptedBlocks.length).toBeGreaterThan(0);
      expect(result.corruptedBlocks[0]!.reason).toContain('Block hash mismatch');
    });

    it('should detect previous hash chain break in verification', async () => {
      const schemasDir = join(tempDir, 'schemas');
      await mkdir(schemasDir, { recursive: true });
      const content = 'name: User';
      await writeFile(join(schemasDir, 'User.yaml'), content);

      let chain = createEmptyChain();
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: computeSha256(content) },
      ];

      // Create two blocks
      const { chain: chain1, block: block1 } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });

      const { chain: chain2, block: block2 } = createDeployBlock(chain1, schemas, {
        version: 'v1.0.1',
        environment: 'production',
      });

      // Break the chain by modifying previousHash
      const brokenChain: VersionChain = {
        ...chain2,
        blocks: [
          block1,
          {
            ...block2,
            previousHash: 'wrong-previous-hash',
          },
        ],
      };

      const result = await verifyChain(brokenChain, schemasDir);

      expect(result.valid).toBe(false);
      expect(result.corruptedBlocks.length).toBeGreaterThan(0);
      expect(result.corruptedBlocks.some(b => b.reason.includes('Previous hash chain broken'))).toBe(true);
    });
  });

  // ===========================================================================
  // Edge Cases - Multiple Environments
  // ===========================================================================

  describe('Edge Cases - Multiple Environments', () => {
    it('should track multiple environments correctly', () => {
      let chain = createEmptyChain();
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
      ];

      // Deploy to production
      const { chain: chain1 } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });

      // Deploy to staging
      const { chain: chain2 } = createDeployBlock(chain1, schemas, {
        version: 'v1.0.1',
        environment: 'staging',
      });

      // Deploy to development
      const { chain: chain3 } = createDeployBlock(chain2, schemas, {
        version: 'v1.0.2',
        environment: 'development',
      });

      const summary = getChainSummary(chain3);

      expect(summary.blockCount).toBe(3);
      expect(summary.environments).toContain('production');
      expect(summary.environments).toContain('staging');
      expect(summary.environments).toContain('development');
      expect(summary.environments).toHaveLength(3);
    });

    it('should count unique schemas across multiple blocks', () => {
      let chain = createEmptyChain();

      // v1.0.0: User only
      const { chain: chain1 } = createDeployBlock(chain, [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
      ], {
        version: 'v1.0.0',
        environment: 'production',
      });

      // v1.0.1: User + Post
      const { chain: chain2 } = createDeployBlock(chain1, [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
        { name: 'Post', relativePath: 'Post.yaml', contentHash: 'def456' },
      ], {
        version: 'v1.0.1',
        environment: 'production',
      });

      const summary = getChainSummary(chain2);

      expect(summary.blockCount).toBe(2);
      expect(summary.schemaCount).toBe(2); // User and Post (unique)
    });
  });

  // ===========================================================================
  // Edge Cases - Schema Lifecycle
  // ===========================================================================

  describe('Edge Cases - Schema Lifecycle', () => {
    it('should get latest schema state from multiple blocks', () => {
      let chain = createEmptyChain();

      // v1.0.0: User with hash1
      const { chain: chain1 } = createDeployBlock(chain, [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'hash1' },
      ], {
        version: 'v1.0.0',
        environment: 'production',
      });

      // v1.0.1: User with hash2 (modified)
      const { chain: chain2 } = createDeployBlock(chain1, [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'hash2' },
      ], {
        version: 'v1.0.1',
        environment: 'production',
      });

      const locked = getLockedSchemas(chain2);

      expect(locked.size).toBe(1);
      expect(locked.get('User')!.hash).toBe('hash2'); // Latest hash
      expect(locked.get('User')!.version).toBe('v1.0.1'); // Latest version
    });

    it('should lock schema in multiple versions', () => {
      let chain = createEmptyChain();
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
      ];

      const { chain: chain1 } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });

      const { chain: chain2 } = createDeployBlock(chain1, schemas, {
        version: 'v1.0.1',
        environment: 'production',
      });

      const result = checkLockViolation(chain2, 'User', 'delete');

      expect(result.allowed).toBe(false);
      expect(result.lockedInVersions).toContain('v1.0.0');
      expect(result.lockedInVersions).toContain('v1.0.1');
      expect(result.lockedInVersions).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Edge Cases - Version Naming
  // ===========================================================================

  describe('Edge Cases - Version Naming', () => {
    it('should accept various version formats', () => {
      let chain = createEmptyChain();
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
      ];

      // Semantic version
      const { chain: chain1, block: block1 } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });
      expect(block1.version).toBe('v1.0.0');

      // Date-based version
      const { chain: chain2, block: block2 } = createDeployBlock(chain1, schemas, {
        version: '2026.01.14-120000',
        environment: 'production',
      });
      expect(block2.version).toBe('2026.01.14-120000');

      // Custom version
      const { block: block3 } = createDeployBlock(chain2, schemas, {
        version: 'release-candidate-1',
        environment: 'staging',
      });
      expect(block3.version).toBe('release-candidate-1');
    });

    it('should allow duplicate version names (not recommended but possible)', () => {
      let chain = createEmptyChain();
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
      ];

      // First deploy
      const { chain: chain1 } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });

      // Deploy again with same version (different content hash will make it different)
      const { chain: chain2, block: block2 } = createDeployBlock(chain1, [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'def456' },
      ], {
        version: 'v1.0.0', // Same version name
        environment: 'production',
      });

      expect(chain2.blocks).toHaveLength(2);
      expect(chain2.blocks[0]!.version).toBe('v1.0.0');
      expect(chain2.blocks[1]!.version).toBe('v1.0.0');
      // But block hashes should be different
      expect(chain2.blocks[0]!.blockHash).not.toBe(chain2.blocks[1]!.blockHash);
    });
  });

  // ===========================================================================
  // Edge Cases - Comment and Metadata
  // ===========================================================================

  describe('Edge Cases - Comment and Metadata', () => {
    it('should store comment in block', () => {
      let chain = createEmptyChain();
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
      ];

      const { block } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
        comment: 'Initial production release',
      });

      expect(block.comment).toBe('Initial production release');
    });

    it('should store deployedBy in block', () => {
      let chain = createEmptyChain();
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
      ];

      const { block } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
        deployedBy: 'github-actions',
      });

      expect(block.deployedBy).toBe('github-actions');
    });

    it('should have lockedAt timestamp', () => {
      let chain = createEmptyChain();
      const schemas: ChainSchemaEntry[] = [
        { name: 'User', relativePath: 'User.yaml', contentHash: 'abc123' },
      ];

      const before = new Date().toISOString();
      const { block } = createDeployBlock(chain, schemas, {
        version: 'v1.0.0',
        environment: 'production',
      });
      const after = new Date().toISOString();

      expect(block.lockedAt).toBeDefined();
      expect(block.lockedAt >= before).toBe(true);
      expect(block.lockedAt <= after).toBe(true);
    });
  });
});
