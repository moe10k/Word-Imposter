import { readdir, readFile } from 'fs/promises';
import path from 'path';
import mysql from 'mysql2/promise';
import type { Connection } from 'mysql2/promise';
import { createDbConnection } from './db.ts';

const DEFAULT_MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations');
const DEFAULT_MIGRATION_LOCK_NAME = 'word_imposter_schema_migrations';
const MIGRATION_LOCK_TIMEOUT_SECONDS = 30;

export interface MigrationConnectionLike {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  end(): Promise<void>;
  query(sql: string, values?: any): Promise<any>;
  execute(sql: string, values?: any): Promise<any>;
}

type MigrationFileProvider = () => Promise<string[]>;
type MigrationReader = (filename: string) => Promise<string>;
type ConnectionFactory = () => Promise<MigrationConnectionLike>;

type MigrationLockRow = mysql.RowDataPacket & {
  migration_lock: number | null;
};

type MigrationVersionRow = mysql.RowDataPacket & {
  version: string;
};

type RunDatabaseMigrationsOptions = {
  createConnection?: ConnectionFactory;
  listMigrationFiles?: MigrationFileProvider;
  readMigrationFile?: MigrationReader;
  lockName?: string;
  log?: Pick<typeof console, 'info' | 'warn'>;
};

function createDefaultConnection() {
  return createDbConnection({
    multipleStatements: true,
  }) as Promise<Connection>;
}

async function listMigrationFilesFromDisk() {
  const entries = await readdir(DEFAULT_MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.sql'))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function readMigrationFileFromDisk(filename: string) {
  return readFile(path.join(DEFAULT_MIGRATIONS_DIR, filename), 'utf8');
}

async function createMigrationTable(connection: MigrationConnectionLike) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version VARCHAR(255) NOT NULL,
       applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (version)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function acquireMigrationLock(connection: MigrationConnectionLike, lockName: string) {
  const [rows] = await connection.query(
    'SELECT GET_LOCK(?, ?) AS migration_lock',
    [lockName, MIGRATION_LOCK_TIMEOUT_SECONDS]
  );

  return (rows as MigrationLockRow[])[0]?.migration_lock === 1;
}

async function releaseMigrationLock(connection: MigrationConnectionLike, lockName: string) {
  try {
    await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
  } catch (error) {
    console.warn('Failed to release migration lock:', error);
  }
}

async function getAppliedMigrations(connection: MigrationConnectionLike) {
  const [rows] = await connection.query(
    'SELECT version FROM schema_migrations ORDER BY version ASC'
  );
  return new Set((rows as MigrationVersionRow[]).map(row => row.version));
}

export async function runDatabaseMigrations({
  createConnection = createDefaultConnection,
  listMigrationFiles = listMigrationFilesFromDisk,
  readMigrationFile = readMigrationFileFromDisk,
  lockName = DEFAULT_MIGRATION_LOCK_NAME,
  log = console,
}: RunDatabaseMigrationsOptions = {}) {
  const connection = await createConnection();
  let lockAcquired = false;

  try {
    lockAcquired = await acquireMigrationLock(connection, lockName);
    if (!lockAcquired) {
      throw new Error('Could not acquire schema migration lock.');
    }

    await createMigrationTable(connection);

    const appliedMigrations = await getAppliedMigrations(connection);
    const migrationFiles = await listMigrationFiles();

    for (const filename of migrationFiles) {
      if (appliedMigrations.has(filename)) {
        continue;
      }

      const sql = await readMigrationFile(filename);
      log.info(`Applying migration ${filename}`);

      await connection.beginTransaction();
      try {
        await connection.query(sql);
        await connection.execute(
          'INSERT INTO schema_migrations (version) VALUES (?)',
          [filename]
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw new Error(
          `Migration ${filename} failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  } finally {
    if (lockAcquired) {
      await releaseMigrationLock(connection, lockName);
    }
    await connection.end();
  }
}
