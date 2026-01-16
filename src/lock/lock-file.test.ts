/**
 * @famgia/omnify-atlas - Lock File Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { SchemaCollection } from '@famgia/omnify-types';
import type { SchemaSnapshot, PropertySnapshot, LockFileV2 } from './types.js';

// Helper to create minimal schema snapshot for tests
const mockSchemaSnapshot = (
  name: string,
  hash: string,
  relativePath: string,
  modifiedAt = '2024-01-01'
): SchemaSnapshot => ({
  name,
  kind: 'object',
  hash,
  relativePath,
  modifiedAt,
  properties: {},
});

import {
  computeHash,
  computeSchemaHash,
  createEmptyLockFile,
  readLockFile,
  writeLockFile,
  buildSchemaHashes,
  compareSchemas,
  compareSchemasDeep,
  updateLockFile,
  addMigrationRecord,
  propertyToSnapshot,
  schemaToSnapshot,
  isLockFileV2,
  LOCK_FILE_VERSION,
} from './lock-file.js';

describe('computeHash', () => {
  it('computes consistent SHA-256 hash', () => {
    const content = 'test content';
    const hash1 = computeHash(content);
    const hash2 = computeHash(content);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex is 64 chars
  });

  it('produces different hashes for different content', () => {
    const hash1 = computeHash('content 1');
    const hash2 = computeHash('content 2');

    expect(hash1).not.toBe(hash2);
  });
});

describe('computeSchemaHash', () => {
  it('computes hash from schema structure', () => {
    const schema = {
      name: 'User',
      relativePath: 'User.yaml',
      properties: {
        name: { type: 'String' },
        email: { type: 'Email' },
      },
    };

    const hash = computeSchemaHash(schema);
    expect(hash).toHaveLength(64);
  });

  it('produces same hash for equivalent schemas', () => {
    const schema1 = {
      name: 'User',
      relativePath: 'User.yaml',
      properties: { name: { type: 'String' } },
    };
    const schema2 = {
      name: 'User',
      relativePath: 'different/User.yaml', // path shouldn't affect hash
      properties: { name: { type: 'String' } },
    };

    expect(computeSchemaHash(schema1)).toBe(computeSchemaHash(schema2));
  });

  it('produces different hash for different properties', () => {
    const schema1 = {
      name: 'User',
      relativePath: 'User.yaml',
      properties: { name: { type: 'String' } },
    };
    const schema2 = {
      name: 'User',
      relativePath: 'User.yaml',
      properties: { email: { type: 'Email' } },
    };

    expect(computeSchemaHash(schema1)).not.toBe(computeSchemaHash(schema2));
  });
});

describe('createEmptyLockFile', () => {
  it('creates lock file with correct structure', () => {
    const lockFile = createEmptyLockFile('mysql');

    expect(lockFile.version).toBe(LOCK_FILE_VERSION);
    expect(lockFile.driver).toBe('mysql');
    expect(lockFile.schemas).toEqual({});
    expect(lockFile.migrations).toEqual([]);
    expect(lockFile.updatedAt).toBeDefined();
  });
});

describe('readLockFile / writeLockFile', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `omnify-test-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('reads and writes lock file correctly', async () => {
    const lockFilePath = join(tempDir, '.omnify.lock');
    const original = createEmptyLockFile('postgres');

    await writeLockFile(lockFilePath, original);
    const read = await readLockFile(lockFilePath);

    expect(read).toEqual(original);
  });

  it('returns null for non-existent file', async () => {
    const lockFilePath = join(tempDir, 'nonexistent.lock');
    const result = await readLockFile(lockFilePath);

    expect(result).toBeNull();
  });

  it('writes formatted JSON', async () => {
    const lockFilePath = join(tempDir, '.omnify.lock');
    await writeLockFile(lockFilePath, createEmptyLockFile('mysql'));

    const content = await readFile(lockFilePath, 'utf8');
    expect(content).toContain('\n'); // Should be formatted
    expect(content.endsWith('\n')).toBe(true); // Should end with newline
  });
});

describe('compareSchemas', () => {
  it('detects added schemas', () => {
    const currentHashes = {
      User: mockSchemaSnapshot('User', 'abc123', 'User.yaml'),
      Post: mockSchemaSnapshot('Post', 'def456', 'Post.yaml'),
    };
    const lockFile = createEmptyLockFile('mysql');

    const result = compareSchemas(currentHashes, lockFile);

    expect(result.hasChanges).toBe(true);
    expect(result.changes).toHaveLength(2);
    expect(result.changes.map(c => c.schemaName).sort()).toEqual(['Post', 'User']);
    expect(result.changes.every(c => c.changeType === 'added')).toBe(true);
  });

  it('detects removed schemas', () => {
    const currentHashes = {};
    const lockFile = {
      ...createEmptyLockFile('mysql'),
      schemas: {
        User: mockSchemaSnapshot('User', 'abc123', 'User.yaml', '2024-01-01'),
      },
    };

    const result = compareSchemas(currentHashes, lockFile);

    expect(result.hasChanges).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].changeType).toBe('removed');
    expect(result.changes[0].schemaName).toBe('User');
  });

  it('detects modified schemas', () => {
    const currentHashes = {
      User: mockSchemaSnapshot('User', 'newhash', 'User.yaml', '2024-01-02'),
    };
    const lockFile = {
      ...createEmptyLockFile('mysql'),
      schemas: {
        User: mockSchemaSnapshot('User', 'oldhash', 'User.yaml', '2024-01-01'),
      },
    };

    const result = compareSchemas(currentHashes, lockFile);

    expect(result.hasChanges).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].changeType).toBe('modified');
    expect(result.changes[0].previousHash).toBe('oldhash');
    expect(result.changes[0].currentHash).toBe('newhash');
  });

  it('identifies unchanged schemas', () => {
    const hash = 'samehash';
    const currentHashes = {
      User: mockSchemaSnapshot('User', hash, 'User.yaml'),
    };
    const lockFile = {
      ...createEmptyLockFile('mysql'),
      schemas: {
        User: mockSchemaSnapshot('User', hash, 'User.yaml'),
      },
    };

    const result = compareSchemas(currentHashes, lockFile);

    expect(result.hasChanges).toBe(false);
    expect(result.changes).toHaveLength(0);
    expect(result.unchanged).toEqual(['User']);
  });

  it('handles null lock file', () => {
    const currentHashes = {
      User: mockSchemaSnapshot('User', 'abc', 'User.yaml', '2024-01-01'),
    };

    const result = compareSchemas(currentHashes, null);

    expect(result.hasChanges).toBe(true);
    expect(result.changes[0].changeType).toBe('added');
  });
});

describe('updateLockFile', () => {
  it('creates new lock file from hashes', () => {
    const hashes = {
      User: mockSchemaSnapshot('User', 'abc', 'User.yaml', '2024-01-01'),
    };

    const result = updateLockFile(null, hashes, 'mysql');

    expect(result.version).toBe(LOCK_FILE_VERSION);
    expect(result.driver).toBe('mysql');
    expect(result.schemas).toEqual(hashes);
    expect(result.migrations).toEqual([]);
  });

  it('preserves existing migrations', () => {
    const existingLockFile = {
      ...createEmptyLockFile('mysql'),
      migrations: [{ fileName: 'old.php', generatedAt: '2024-01-01', schemas: ['User'], checksum: 'xyz' }],
    };
    const hashes = {
      User: mockSchemaSnapshot('User', 'abc', 'User.yaml', '2024-01-01'),
    };

    const result = updateLockFile(existingLockFile, hashes, 'mysql');

    expect(result.migrations).toHaveLength(1);
    expect(result.migrations[0].fileName).toBe('old.php');
  });

  it('strips renamedFrom from properties (transient migration info)', () => {
    const snapshots: Record<string, SchemaSnapshot> = {
      User: {
        name: 'User',
        kind: 'object',
        hash: 'abc123',
        relativePath: 'User.yaml',
        modifiedAt: '2024-01-01T00:00:00Z',
        properties: {
          fullName: { type: 'String', renamedFrom: 'name' },
          email: { type: 'Email' },
        },
      },
    };

    const result = updateLockFile(null, snapshots, 'mysql');

    // renamedFrom should be stripped before persisting
    expect(result.schemas.User.properties.fullName.renamedFrom).toBeUndefined();
    expect(result.schemas.User.properties.fullName.type).toBe('String');
    // Other properties should remain
    expect(result.schemas.User.properties.email.type).toBe('Email');
  });
});

describe('addMigrationRecord', () => {
  it('adds migration to lock file', () => {
    const lockFile = createEmptyLockFile('mysql');
    const migrationContent = 'migration content';

    const result = addMigrationRecord(
      lockFile,
      '2024_01_01_create_users.php',
      ['User'],
      migrationContent
    );

    expect(result.migrations).toHaveLength(1);
    expect(result.migrations[0].fileName).toBe('2024_01_01_create_users.php');
    expect(result.migrations[0].schemas).toEqual(['User']);
    expect(result.migrations[0].checksum).toBe(computeHash(migrationContent));
  });
});

// ============================================
// V2 Lock File Tests - Deep Diff
// ============================================

describe('propertyToSnapshot', () => {
  it('converts basic property to snapshot', () => {
    const prop = { type: 'String', nullable: true, unique: false };
    const snapshot = propertyToSnapshot(prop);

    expect(snapshot.type).toBe('String');
    expect(snapshot.nullable).toBe(true);
    expect(snapshot.unique).toBe(false);
  });

  it('handles all property fields', () => {
    const prop = {
      type: 'Enum',
      nullable: false,
      unique: true,
      default: 'active',
      length: 255,
      unsigned: true,
      enum: ['active', 'inactive'],
    };
    const snapshot = propertyToSnapshot(prop);

    expect(snapshot.type).toBe('Enum');
    expect(snapshot.nullable).toBe(false);
    expect(snapshot.unique).toBe(true);
    expect(snapshot.default).toBe('active');
    expect(snapshot.length).toBe(255);
    expect(snapshot.unsigned).toBe(true);
    expect(snapshot.enum).toEqual(['active', 'inactive']);
  });

  it('handles association properties', () => {
    const prop = {
      type: 'Lookup',
      relation: 'ManyToOne',
      target: 'Category',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    };
    const snapshot = propertyToSnapshot(prop);

    expect(snapshot.relation).toBe('ManyToOne');
    expect(snapshot.target).toBe('Category');
    expect(snapshot.onDelete).toBe('CASCADE');
    expect(snapshot.onUpdate).toBe('CASCADE');
  });

  it('preserves renamedFrom for rename detection', () => {
    const prop = {
      type: 'String',
      nullable: true,
      renamedFrom: 'oldName',
    };
    const snapshot = propertyToSnapshot(prop);

    expect(snapshot.type).toBe('String');
    expect(snapshot.nullable).toBe(true);
    // renamedFrom IS preserved in snapshot for comparison
    // It gets stripped in updateLockFile before persisting
    expect(snapshot.renamedFrom).toBe('oldName');
  });
});

describe('schemaToSnapshot', () => {
  it('creates snapshot with basic properties', () => {
    const schema = {
      name: 'User',
      kind: 'object' as const,
      filePath: '/path/to/User.yaml',
      relativePath: 'User.yaml',
      properties: {
        name: { type: 'String' },
        email: { type: 'Email', unique: true },
      },
    };

    const snapshot = schemaToSnapshot(schema, 'hash123', '2024-01-01T00:00:00Z');

    expect(snapshot.name).toBe('User');
    expect(snapshot.kind).toBe('object');
    expect(snapshot.hash).toBe('hash123');
    expect(snapshot.relativePath).toBe('User.yaml');
    expect(snapshot.modifiedAt).toBe('2024-01-01T00:00:00Z');
    expect(snapshot.properties.name.type).toBe('String');
    expect(snapshot.properties.email.type).toBe('Email');
    expect(snapshot.properties.email.unique).toBe(true);
  });

  it('includes options in snapshot', () => {
    const schema = {
      name: 'Post',
      kind: 'object' as const,
      filePath: '/path/to/Post.yaml',
      relativePath: 'Post.yaml',
      properties: { title: { type: 'String' } },
      options: {
        timestamps: true,
        softDelete: true,
        idType: 'Uuid' as const,
      },
    };

    const snapshot = schemaToSnapshot(schema, 'hash456', '2024-01-01T00:00:00Z');

    expect(snapshot.timestamps).toBe(true);
    expect(snapshot.softDelete).toBe(true);
    expect(snapshot.idType).toBe('Uuid');
  });

  it('includes id: false option in snapshot for pivot tables', () => {
    const schema = {
      name: 'UserRole',
      kind: 'object' as const,
      filePath: '/path/to/UserRole.yaml',
      relativePath: 'UserRole.yaml',
      properties: {
        userId: { type: 'Int' },
        roleId: { type: 'Int' },
      },
      options: {
        id: false,
        timestamps: false,
      },
    };

    const snapshot = schemaToSnapshot(schema, 'hash789', '2024-01-01T00:00:00Z');

    expect(snapshot.id).toBe(false);
    expect(snapshot.timestamps).toBe(false);
  });

  it('includes indexes in snapshot', () => {
    const schema = {
      name: 'Product',
      kind: 'object' as const,
      filePath: '/path/to/Product.yaml',
      relativePath: 'Product.yaml',
      properties: {
        sku: { type: 'String' },
        category: { type: 'String' },
      },
      options: {
        indexes: [
          { columns: ['sku'], unique: true },
          { columns: ['category', 'sku'], unique: false },
        ],
      },
    };

    const snapshot = schemaToSnapshot(schema, 'hash789', '2024-01-01T00:00:00Z');

    expect(snapshot.indexes).toHaveLength(2);
    expect(snapshot.indexes![0].columns).toEqual(['sku']);
    expect(snapshot.indexes![0].unique).toBe(true);
    expect(snapshot.indexes![1].columns).toEqual(['category', 'sku']);
    expect(snapshot.indexes![1].unique).toBe(false);
  });

  it('handles enum schemas', () => {
    const schema = {
      name: 'Status',
      kind: 'enum' as const,
      filePath: '/path/to/Status.yaml',
      relativePath: 'Status.yaml',
      values: ['active', 'inactive', 'pending'],
    };

    const snapshot = schemaToSnapshot(schema, 'enumhash', '2024-01-01T00:00:00Z');

    expect(snapshot.kind).toBe('enum');
    expect(snapshot.values).toEqual(['active', 'inactive', 'pending']);
  });
});

describe('isLockFileV2', () => {
  it('returns true for v2 lock file', () => {
    const lockFile: LockFileV2 = {
      version: 2,
      updatedAt: '2024-01-01T00:00:00Z',
      driver: 'mysql',
      schemas: {},
      migrations: [],
    };

    expect(isLockFileV2(lockFile)).toBe(true);
  });

  it('returns false for v1 lock file', () => {
    const lockFile = {
      version: 1,
      updatedAt: '2024-01-01T00:00:00Z',
      driver: 'mysql',
      schemas: {},
      migrations: [],
    };

    expect(isLockFileV2(lockFile as any)).toBe(false);
  });
});

describe('compareSchemasDeep', () => {
  const createSnapshot = (
    name: string,
    properties: Record<string, PropertySnapshot>,
    options?: Partial<SchemaSnapshot>
  ): SchemaSnapshot => ({
    name,
    kind: 'object',
    hash: computeHash(JSON.stringify({ name, properties, options })),
    relativePath: `${name}.yaml`,
    modifiedAt: '2024-01-01T00:00:00Z',
    properties,
    ...options,
  });

  describe('schema-level changes', () => {
    it('detects added schemas', () => {
      const current = {
        User: createSnapshot('User', { name: { type: 'String' } }),
        Post: createSnapshot('Post', { title: { type: 'String' } }),
      };

      const result = compareSchemasDeep(current, null);

      expect(result.hasChanges).toBe(true);
      expect(result.changes).toHaveLength(2);
      expect(result.changes.every(c => c.changeType === 'added')).toBe(true);
    });

    it('detects removed schemas', () => {
      const current = {};
      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: {
          User: createSnapshot('User', { name: { type: 'String' } }),
        },
        migrations: [],
      };

      const result = compareSchemasDeep(current, lockFile);

      expect(result.hasChanges).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].changeType).toBe('removed');
      expect(result.changes[0].schemaName).toBe('User');
    });

    it('identifies unchanged schemas', () => {
      const snapshot = createSnapshot('User', { name: { type: 'String' } });
      const current = { User: snapshot };
      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { User: snapshot },
        migrations: [],
      };

      const result = compareSchemasDeep(current, lockFile);

      expect(result.hasChanges).toBe(false);
      expect(result.unchanged).toEqual(['User']);
    });
  });

  describe('column-level changes', () => {
    it('detects added columns', () => {
      const prevSnapshot = createSnapshot('User', { name: { type: 'String' } });
      const currSnapshot = createSnapshot('User', {
        name: { type: 'String' },
        email: { type: 'Email', unique: true },
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { User: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ User: currSnapshot }, lockFile);

      expect(result.hasChanges).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].changeType).toBe('modified');
      expect(result.changes[0].columnChanges).toHaveLength(1);
      expect(result.changes[0].columnChanges![0].changeType).toBe('added');
      expect(result.changes[0].columnChanges![0].column).toBe('email');
      expect(result.changes[0].columnChanges![0].currentDef?.type).toBe('Email');
    });

    it('detects removed columns', () => {
      const prevSnapshot = createSnapshot('User', {
        name: { type: 'String' },
        email: { type: 'Email' },
        phone: { type: 'String' },
      });
      const currSnapshot = createSnapshot('User', {
        name: { type: 'String' },
        email: { type: 'Email' },
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { User: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ User: currSnapshot }, lockFile);

      expect(result.hasChanges).toBe(true);
      expect(result.changes[0].columnChanges).toHaveLength(1);
      expect(result.changes[0].columnChanges![0].changeType).toBe('removed');
      expect(result.changes[0].columnChanges![0].column).toBe('phone');
      expect(result.changes[0].columnChanges![0].previousDef?.type).toBe('String');
    });

    it('detects modified column type', () => {
      const prevSnapshot = createSnapshot('User', {
        bio: { type: 'String', length: 255 },
      });
      const currSnapshot = createSnapshot('User', {
        bio: { type: 'Text' },
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { User: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ User: currSnapshot }, lockFile);

      expect(result.hasChanges).toBe(true);
      expect(result.changes[0].columnChanges![0].changeType).toBe('modified');
      expect(result.changes[0].columnChanges![0].modifications).toContain('type');
      expect(result.changes[0].columnChanges![0].modifications).toContain('length');
    });

    it('detects modified nullable property', () => {
      const prevSnapshot = createSnapshot('User', {
        nickname: { type: 'String' },
      });
      const currSnapshot = createSnapshot('User', {
        nickname: { type: 'String', nullable: true },
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { User: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ User: currSnapshot }, lockFile);

      expect(result.changes[0].columnChanges![0].modifications).toContain('nullable');
    });

    it('detects modified unique property', () => {
      const prevSnapshot = createSnapshot('User', {
        email: { type: 'Email' },
      });
      const currSnapshot = createSnapshot('User', {
        email: { type: 'Email', unique: true },
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { User: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ User: currSnapshot }, lockFile);

      expect(result.changes[0].columnChanges![0].modifications).toContain('unique');
    });

    it('detects modified default value', () => {
      const prevSnapshot = createSnapshot('User', {
        status: { type: 'String', default: 'active' },
      });
      const currSnapshot = createSnapshot('User', {
        status: { type: 'String', default: 'pending' },
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { User: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ User: currSnapshot }, lockFile);

      expect(result.changes[0].columnChanges![0].modifications).toContain('default');
    });

    it('detects multiple column changes', () => {
      const prevSnapshot = createSnapshot('User', {
        name: { type: 'String' },
        email: { type: 'String' },
        age: { type: 'Int' },
      });
      const currSnapshot = createSnapshot('User', {
        name: { type: 'String', nullable: true }, // modified
        email: { type: 'Email', unique: true }, // modified (type + unique)
        phone: { type: 'String' }, // added
        // age removed
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { User: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ User: currSnapshot }, lockFile);

      expect(result.changes[0].columnChanges).toHaveLength(4);

      const changes = result.changes[0].columnChanges!;
      const added = changes.filter(c => c.changeType === 'added');
      const removed = changes.filter(c => c.changeType === 'removed');
      const modified = changes.filter(c => c.changeType === 'modified');

      expect(added).toHaveLength(1);
      expect(added[0].column).toBe('phone');

      expect(removed).toHaveLength(1);
      expect(removed[0].column).toBe('age');

      expect(modified).toHaveLength(2);
      expect(modified.map(m => m.column).sort()).toEqual(['email', 'name']);
    });
  });

  describe('column renames', () => {
    it('detects renamed column with renamedFrom annotation', () => {
      const prevSnapshot = createSnapshot('User', {
        name: { type: 'String' },
      });
      const currSnapshot = createSnapshot('User', {
        fullName: { type: 'String', renamedFrom: 'name' },
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { User: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ User: currSnapshot }, lockFile);

      expect(result.hasChanges).toBe(true);
      expect(result.changes[0].columnChanges).toHaveLength(1);
      expect(result.changes[0].columnChanges![0].changeType).toBe('renamed');
      expect(result.changes[0].columnChanges![0].column).toBe('fullName');
      expect(result.changes[0].columnChanges![0].previousColumn).toBe('name');
    });

    it('detects renamed column with additional modifications', () => {
      const prevSnapshot = createSnapshot('User', {
        name: { type: 'String' },
      });
      const currSnapshot = createSnapshot('User', {
        fullName: { type: 'String', nullable: true, renamedFrom: 'name' },
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { User: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ User: currSnapshot }, lockFile);

      expect(result.changes[0].columnChanges![0].changeType).toBe('renamed');
      expect(result.changes[0].columnChanges![0].modifications).toContain('nullable');
    });

    it('does not treat renamed column as added or removed', () => {
      const prevSnapshot = createSnapshot('User', {
        name: { type: 'String' },
        email: { type: 'Email' },
      });
      const currSnapshot = createSnapshot('User', {
        fullName: { type: 'String', renamedFrom: 'name' },
        email: { type: 'Email' },
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { User: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ User: currSnapshot }, lockFile);

      const changes = result.changes[0].columnChanges!;
      const added = changes.filter(c => c.changeType === 'added');
      const removed = changes.filter(c => c.changeType === 'removed');
      const renamed = changes.filter(c => c.changeType === 'renamed');

      expect(added).toHaveLength(0);
      expect(removed).toHaveLength(0);
      expect(renamed).toHaveLength(1);
    });

    it('handles multiple renames in same schema', () => {
      const prevSnapshot = createSnapshot('User', {
        name: { type: 'String' },
        email: { type: 'Email' },
      });
      const currSnapshot = createSnapshot('User', {
        fullName: { type: 'String', renamedFrom: 'name' },
        emailAddress: { type: 'Email', renamedFrom: 'email' },
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { User: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ User: currSnapshot }, lockFile);

      const renamed = result.changes[0].columnChanges!.filter(c => c.changeType === 'renamed');
      expect(renamed).toHaveLength(2);
      expect(renamed.map(r => r.column).sort()).toEqual(['emailAddress', 'fullName']);
    });

    it('ignores renamedFrom if source column does not exist', () => {
      const prevSnapshot = createSnapshot('User', {
        email: { type: 'Email' },
      });
      const currSnapshot = createSnapshot('User', {
        email: { type: 'Email' },
        fullName: { type: 'String', renamedFrom: 'name' }, // 'name' doesn't exist in prev
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { User: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ User: currSnapshot }, lockFile);

      const changes = result.changes[0].columnChanges!;
      const added = changes.filter(c => c.changeType === 'added');
      const renamed = changes.filter(c => c.changeType === 'renamed');

      // Should be treated as added since source doesn't exist
      expect(added).toHaveLength(1);
      expect(added[0].column).toBe('fullName');
      expect(renamed).toHaveLength(0);
    });

    it('detects type change along with rename', () => {
      const prevSnapshot = createSnapshot('User', {
        name: { type: 'String' },
      });
      const currSnapshot = createSnapshot('User', {
        description: { type: 'Text', renamedFrom: 'name' },
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { User: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ User: currSnapshot }, lockFile);

      const renamed = result.changes[0].columnChanges!.filter(c => c.changeType === 'renamed');
      expect(renamed).toHaveLength(1);
      expect(renamed[0].column).toBe('description');
      expect(renamed[0].modifications).toContain('type');
    });
  });

  describe('index changes', () => {
    it('detects added indexes', () => {
      const prevSnapshot = createSnapshot('Product', { sku: { type: 'String' } });
      const currSnapshot = createSnapshot('Product', { sku: { type: 'String' } }, {
        indexes: [{ columns: ['sku'], unique: true }],
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { Product: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ Product: currSnapshot }, lockFile);

      expect(result.hasChanges).toBe(true);
      expect(result.changes[0].indexChanges).toHaveLength(1);
      expect(result.changes[0].indexChanges![0].changeType).toBe('added');
      expect(result.changes[0].indexChanges![0].index.columns).toEqual(['sku']);
      expect(result.changes[0].indexChanges![0].index.unique).toBe(true);
    });

    it('detects removed indexes', () => {
      const prevSnapshot = createSnapshot('Product', { sku: { type: 'String' } }, {
        indexes: [{ columns: ['sku'], unique: true }],
      });
      const currSnapshot = createSnapshot('Product', { sku: { type: 'String' } });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { Product: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ Product: currSnapshot }, lockFile);

      expect(result.changes[0].indexChanges).toHaveLength(1);
      expect(result.changes[0].indexChanges![0].changeType).toBe('removed');
    });

    it('detects composite index changes', () => {
      const prevSnapshot = createSnapshot('Order', {
        userId: { type: 'Int' },
        status: { type: 'String' },
      }, {
        indexes: [{ columns: ['userId'], unique: false }],
      });
      const currSnapshot = createSnapshot('Order', {
        userId: { type: 'Int' },
        status: { type: 'String' },
      }, {
        indexes: [{ columns: ['userId', 'status'], unique: false }],
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { Order: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ Order: currSnapshot }, lockFile);

      expect(result.changes[0].indexChanges).toHaveLength(2);
      const added = result.changes[0].indexChanges!.find(i => i.changeType === 'added');
      const removed = result.changes[0].indexChanges!.find(i => i.changeType === 'removed');

      expect(removed!.index.columns).toEqual(['userId']);
      expect(added!.index.columns).toEqual(['userId', 'status']);
    });
  });

  describe('option changes', () => {
    it('detects timestamps enabled', () => {
      const prevSnapshot = createSnapshot('Post', { title: { type: 'String' } });
      const currSnapshot = createSnapshot('Post', { title: { type: 'String' } }, {
        timestamps: true,
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { Post: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ Post: currSnapshot }, lockFile);

      expect(result.changes[0].optionChanges?.timestamps).toEqual({
        from: undefined,
        to: true,
      });
    });

    it('detects timestamps disabled', () => {
      const prevSnapshot = createSnapshot('Post', { title: { type: 'String' } }, {
        timestamps: true,
      });
      const currSnapshot = createSnapshot('Post', { title: { type: 'String' } });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { Post: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ Post: currSnapshot }, lockFile);

      expect(result.changes[0].optionChanges?.timestamps).toEqual({
        from: true,
        to: undefined,
      });
    });

    it('detects softDelete changes', () => {
      const prevSnapshot = createSnapshot('User', { name: { type: 'String' } });
      const currSnapshot = createSnapshot('User', { name: { type: 'String' } }, {
        softDelete: true,
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { User: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ User: currSnapshot }, lockFile);

      expect(result.changes[0].optionChanges?.softDelete).toEqual({
        from: undefined,
        to: true,
      });
    });

    it('detects idType changes', () => {
      const prevSnapshot = createSnapshot('User', { name: { type: 'String' } }, {
        idType: 'BigInt',
      });
      const currSnapshot = createSnapshot('User', { name: { type: 'String' } }, {
        idType: 'Uuid',
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { User: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ User: currSnapshot }, lockFile);

      expect(result.changes[0].optionChanges?.idType).toEqual({
        from: 'BigInt',
        to: 'Uuid',
      });
    });

    it('detects id option changes (disable auto id)', () => {
      const prevSnapshot = createSnapshot('UserRole', { userId: { type: 'Int' } });
      const currSnapshot = createSnapshot('UserRole', { userId: { type: 'Int' } }, {
        id: false,
      });

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: { UserRole: prevSnapshot },
        migrations: [],
      };

      const result = compareSchemasDeep({ UserRole: currSnapshot }, lockFile);

      expect(result.changes[0].optionChanges?.id).toEqual({
        from: undefined,
        to: false,
      });
    });

  });

  describe('complex scenarios', () => {
    it('handles multiple schemas with various changes', () => {
      const prevSnapshots = {
        User: createSnapshot('User', { name: { type: 'String' } }),
        Post: createSnapshot('Post', { title: { type: 'String' } }),
        Category: createSnapshot('Category', { name: { type: 'String' } }),
      };

      const currSnapshots = {
        User: createSnapshot('User', {
          name: { type: 'String' },
          email: { type: 'Email' }, // added
        }),
        // Post removed
        Category: createSnapshot('Category', { name: { type: 'String' } }), // unchanged
        Tag: createSnapshot('Tag', { label: { type: 'String' } }), // added
      };

      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: prevSnapshots,
        migrations: [],
      };

      const result = compareSchemasDeep(currSnapshots, lockFile);

      expect(result.hasChanges).toBe(true);
      expect(result.unchanged).toEqual(['Category']);

      const addedSchemas = result.changes.filter(c => c.changeType === 'added');
      const removedSchemas = result.changes.filter(c => c.changeType === 'removed');
      const modifiedSchemas = result.changes.filter(c => c.changeType === 'modified');

      expect(addedSchemas).toHaveLength(1);
      expect(addedSchemas[0].schemaName).toBe('Tag');

      expect(removedSchemas).toHaveLength(1);
      expect(removedSchemas[0].schemaName).toBe('Post');

      expect(modifiedSchemas).toHaveLength(1);
      expect(modifiedSchemas[0].schemaName).toBe('User');
      expect(modifiedSchemas[0].columnChanges).toHaveLength(1);
    });

    it('handles null lock file (first run)', () => {
      const current = {
        User: createSnapshot('User', { name: { type: 'String' } }),
        Post: createSnapshot('Post', { title: { type: 'String' } }),
      };

      const result = compareSchemasDeep(current, null);

      expect(result.hasChanges).toBe(true);
      expect(result.changes).toHaveLength(2);
      expect(result.changes.every(c => c.changeType === 'added')).toBe(true);
      expect(result.unchanged).toHaveLength(0);
    });

    it('handles empty current schemas', () => {
      const lockFile: LockFileV2 = {
        version: 2,
        updatedAt: '2024-01-01T00:00:00Z',
        driver: 'mysql',
        schemas: {
          User: createSnapshot('User', { name: { type: 'String' } }),
        },
        migrations: [],
      };

      const result = compareSchemasDeep({}, lockFile);

      expect(result.hasChanges).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].changeType).toBe('removed');
    });
  });
});

// ============================================
// Migration File Tracking Tests
// ============================================

import {
  extractTimestampFromFilename,
  extractTableNameFromFilename,
  getMigrationsToRegenerate,
  addEnhancedMigrationRecord,
} from './lock-file.js';

describe('extractTimestampFromFilename', () => {
  it('extracts timestamp from create migration', () => {
    const result = extractTimestampFromFilename('2026_01_13_100000_create_users_table.php');
    expect(result).toBe('2026_01_13_100000');
  });

  it('extracts timestamp from update migration', () => {
    const result = extractTimestampFromFilename('2026_02_15_143022_update_posts_table.php');
    expect(result).toBe('2026_02_15_143022');
  });

  it('returns null for invalid filename', () => {
    const result = extractTimestampFromFilename('invalid_filename.php');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = extractTimestampFromFilename('');
    expect(result).toBeNull();
  });
});

describe('extractTableNameFromFilename', () => {
  it('extracts table name from create migration', () => {
    const result = extractTableNameFromFilename('2026_01_13_100000_create_users_table.php');
    expect(result).toBe('users');
  });

  it('extracts table name from update migration', () => {
    const result = extractTableNameFromFilename('2026_01_13_100000_update_posts_table.php');
    expect(result).toBe('posts');
  });

  it('extracts table name from drop migration', () => {
    const result = extractTableNameFromFilename('2026_01_13_100000_drop_old_logs_table.php');
    expect(result).toBe('old_logs');
  });

  it('handles composite table names', () => {
    const result = extractTableNameFromFilename('2026_01_13_100000_create_user_role_table.php');
    expect(result).toBe('user_role');
  });

  it('returns null for non-matching pattern', () => {
    const result = extractTableNameFromFilename('2026_01_13_100000_add_column_to_users.php');
    expect(result).toBeNull();
  });
});

describe('addEnhancedMigrationRecord', () => {
  it('adds migration with all enhanced fields', () => {
    const lockFile = createEmptyLockFile('mysql');
    const content = 'migration content';

    const result = addEnhancedMigrationRecord(lockFile, {
      fileName: '2026_01_13_100000_create_users_table.php',
      timestamp: '2026_01_13_100000',
      tableName: 'users',
      type: 'create',
      schemas: ['User'],
      content,
    });

    expect(result.migrations).toHaveLength(1);
    const migration = result.migrations[0];
    expect(migration.fileName).toBe('2026_01_13_100000_create_users_table.php');
    expect(migration.timestamp).toBe('2026_01_13_100000');
    expect(migration.tableName).toBe('users');
    expect(migration.type).toBe('create');
    expect(migration.schemas).toEqual(['User']);
    expect(migration.checksum).toBe(computeHash(content));
  });

  it('preserves existing migrations', () => {
    const lockFile1 = createEmptyLockFile('mysql');
    const lockFile2 = addEnhancedMigrationRecord(lockFile1, {
      fileName: '2026_01_13_100000_create_users_table.php',
      timestamp: '2026_01_13_100000',
      tableName: 'users',
      type: 'create',
      schemas: ['User'],
      content: 'content1',
    });
    const lockFile3 = addEnhancedMigrationRecord(lockFile2, {
      fileName: '2026_01_13_100001_create_posts_table.php',
      timestamp: '2026_01_13_100001',
      tableName: 'posts',
      type: 'create',
      schemas: ['Post'],
      content: 'content2',
    });

    expect(lockFile3.migrations).toHaveLength(2);
  });
});

describe('getMigrationsToRegenerate', () => {
  it('returns migrations for missing files', () => {
    const lockFile: LockFileV2 = {
      version: 2,
      updatedAt: '2024-01-01T00:00:00Z',
      driver: 'mysql',
      schemas: {},
      migrations: [
        {
          fileName: '2026_01_13_100000_create_users_table.php',
          timestamp: '2026_01_13_100000',
          tableName: 'users',
          type: 'create',
          generatedAt: '2026-01-13T10:00:00Z',
          schemas: ['User'],
          checksum: 'abc123',
        },
        {
          fileName: '2026_01_13_100001_create_posts_table.php',
          timestamp: '2026_01_13_100001',
          tableName: 'posts',
          type: 'create',
          generatedAt: '2026-01-13T10:00:01Z',
          schemas: ['Post'],
          checksum: 'def456',
        },
      ],
    };

    const missingFiles = ['2026_01_13_100000_create_users_table.php'];
    const result = getMigrationsToRegenerate(lockFile, missingFiles);

    expect(result).toHaveLength(1);
    expect(result[0].fileName).toBe('2026_01_13_100000_create_users_table.php');
    expect(result[0].timestamp).toBe('2026_01_13_100000');
    expect(result[0].tableName).toBe('users');
    expect(result[0].type).toBe('create');
  });

  it('returns empty array if no missing files', () => {
    const lockFile = createEmptyLockFile('mysql');
    const result = getMigrationsToRegenerate(lockFile, []);
    expect(result).toHaveLength(0);
  });

  it('extracts info from filename for legacy migrations without enhanced fields', () => {
    const lockFile: LockFileV2 = {
      version: 2,
      updatedAt: '2024-01-01T00:00:00Z',
      driver: 'mysql',
      schemas: {},
      migrations: [
        {
          fileName: '2026_01_13_100000_create_users_table.php',
          // No timestamp, tableName, type fields (legacy format)
          generatedAt: '2026-01-13T10:00:00Z',
          schemas: ['User'],
          checksum: 'abc123',
        },
      ],
    };

    const missingFiles = ['2026_01_13_100000_create_users_table.php'];
    const result = getMigrationsToRegenerate(lockFile, missingFiles);

    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe('2026_01_13_100000');
    expect(result[0].tableName).toBe('users');
    expect(result[0].type).toBe('create');
  });
});
