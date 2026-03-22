import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runDatabaseMigrations, type MigrationConnectionLike } from '../server/migrations.ts';

class FakeMigrationConnection implements MigrationConnectionLike {
  appliedMigrations = new Set<string>();
  executedSql: string[] = [];
  insertedVersions: string[] = [];
  transactionCount = 0;
  commitCount = 0;
  rollbackCount = 0;
  releasedLocks = 0;
  ended = false;
  lockResult = 1;

  async beginTransaction() {
    this.transactionCount += 1;
  }

  async commit() {
    this.commitCount += 1;
  }

  async rollback() {
    this.rollbackCount += 1;
  }

  async end() {
    this.ended = true;
  }

  async query(sql: string, values: unknown[] = []) {
    if (sql.startsWith('SELECT GET_LOCK')) {
      return [[{ migration_lock: this.lockResult }], undefined];
    }

    if (sql.startsWith('SELECT RELEASE_LOCK')) {
      this.releasedLocks += 1;
      return [[{ released_lock: 1 }], undefined];
    }

    if (sql.startsWith('CREATE TABLE IF NOT EXISTS schema_migrations')) {
      return [[], undefined];
    }

    if (sql.startsWith('SELECT version FROM schema_migrations')) {
      return [[...this.appliedMigrations].sort().map(version => ({ version })), undefined];
    }

    this.executedSql.push(sql);
    return [[], undefined];
  }

  async execute(sql: string, values: unknown[] = []) {
    if (sql.startsWith('INSERT INTO schema_migrations')) {
      const version = String(values[0]);
      this.appliedMigrations.add(version);
      this.insertedVersions.push(version);
      return [[], undefined];
    }

    return [[], undefined];
  }
}

describe('migration runner', () => {
  it('applies only unapplied migrations and records them', async () => {
    const connection = new FakeMigrationConnection();

    await runDatabaseMigrations({
      createConnection: async () => connection,
      listMigrationFiles: async () => ['001_first.sql', '002_second.sql'],
      readMigrationFile: async filename => `-- ${filename}`,
      log: { info() {}, warn() {} },
    });

    assert.deepEqual(connection.executedSql, ['-- 001_first.sql', '-- 002_second.sql']);
    assert.deepEqual(connection.insertedVersions, ['001_first.sql', '002_second.sql']);
    assert.equal(connection.transactionCount, 2);
    assert.equal(connection.commitCount, 2);
    assert.equal(connection.rollbackCount, 0);
    assert.equal(connection.releasedLocks, 1);
    assert.equal(connection.ended, true);
  });

  it('skips migrations that were already recorded', async () => {
    const state = {
      appliedMigrations: new Set<string>(['001_first.sql']),
    };

    const createConnection = async () => {
      const connection = new FakeMigrationConnection();
      connection.appliedMigrations = state.appliedMigrations;
      return connection;
    };

    const firstRunConnection = await createConnection();
    await runDatabaseMigrations({
      createConnection: async () => firstRunConnection,
      listMigrationFiles: async () => ['001_first.sql', '002_second.sql'],
      readMigrationFile: async filename => `-- ${filename}`,
      log: { info() {}, warn() {} },
    });

    assert.deepEqual(firstRunConnection.executedSql, ['-- 002_second.sql']);
    assert.deepEqual([...state.appliedMigrations].sort(), ['001_first.sql', '002_second.sql']);

    const secondRunConnection = await createConnection();
    await runDatabaseMigrations({
      createConnection: async () => secondRunConnection,
      listMigrationFiles: async () => ['001_first.sql', '002_second.sql'],
      readMigrationFile: async filename => `-- ${filename}`,
      log: { info() {}, warn() {} },
    });

    assert.deepEqual(secondRunConnection.executedSql, []);
    assert.deepEqual(secondRunConnection.insertedVersions, []);
  });

  it('fails when the advisory lock cannot be acquired', async () => {
    const connection = new FakeMigrationConnection();
    connection.lockResult = 0;

    await assert.rejects(
      () =>
        runDatabaseMigrations({
          createConnection: async () => connection,
          listMigrationFiles: async () => ['001_first.sql'],
          readMigrationFile: async filename => `-- ${filename}`,
          log: { info() {}, warn() {} },
        }),
      /Could not acquire schema migration lock/
    );

    assert.equal(connection.executedSql.length, 0);
    assert.equal(connection.releasedLocks, 0);
    assert.equal(connection.ended, true);
  });
});
