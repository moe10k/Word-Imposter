import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDatabaseConfig,
  getDatabaseConnectionConfig,
  getDatabaseSslConfig,
  getDatabaseUrl,
} from '../server/db.ts';

describe('database config', () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.JAWSDB_URL;
    delete process.env.JAWSDB_MARIA_URL;
    delete process.env.CLEARDB_DATABASE_URL;
    delete process.env.STACKHERO_MYSQL_DATABASE_URL;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_NAME;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_CONNECTION_LIMIT;
    delete process.env.DB_SSL;
    delete process.env.DB_SSL_REJECT_UNAUTHORIZED;
    delete process.env.DB_SSL_CA_BASE64;
  });

  it('uses DATABASE_URL before provider-specific URL env vars', () => {
    process.env.DATABASE_URL = 'mysql://database-user:database-pass@primary-db:3307/primary_name';
    process.env.JAWSDB_URL = 'mysql://fallback-user:fallback-pass@secondary-db:3308/fallback_name';

    const databaseUrl = getDatabaseUrl();
    const config = getDatabaseConnectionConfig();

    assert.equal(databaseUrl?.name, 'DATABASE_URL');
    assert.equal(config.host, 'primary-db');
    assert.equal(config.port, 3307);
    assert.equal(config.user, 'database-user');
    assert.equal(config.password, 'database-pass');
    assert.equal(config.database, 'primary_name');
  });

  it('supports JAWSDB_MARIA_URL when that is the configured provider env var', () => {
    process.env.JAWSDB_MARIA_URL = 'mysql://maria-user:maria-pass@maria-db:3306/maria_name';

    const databaseUrl = getDatabaseUrl();
    const config = getDatabaseConnectionConfig();

    assert.equal(databaseUrl?.name, 'JAWSDB_MARIA_URL');
    assert.equal(config.host, 'maria-db');
    assert.equal(config.user, 'maria-user');
    assert.equal(config.database, 'maria_name');
  });

  it('falls back to split DB vars when no URL is configured', () => {
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_PORT = '3306';
    process.env.DB_NAME = 'word_imposter';
    process.env.DB_USER = 'root';
    process.env.DB_PASSWORD = '';
    process.env.DB_CONNECTION_LIMIT = '12';

    const config = getDatabaseConfig();

    assert.equal(config.host, '127.0.0.1');
    assert.equal(config.port, 3306);
    assert.equal(config.user, 'root');
    assert.equal(config.password, '');
    assert.equal(config.database, 'word_imposter');
    assert.equal(config.connectionLimit, 12);
  });

  it('builds SSL config from env vars', () => {
    process.env.DB_SSL = 'true';
    process.env.DB_SSL_REJECT_UNAUTHORIZED = 'false';
    process.env.DB_SSL_CA_BASE64 = Buffer.from('test-ca').toString('base64');

    const ssl = getDatabaseSslConfig();

    assert.deepEqual(ssl, {
      rejectUnauthorized: false,
      ca: 'test-ca',
    });
  });

  it('enables SSL when only a CA is configured', () => {
    process.env.DB_SSL_CA_BASE64 = Buffer.from('ca-only').toString('base64');

    const ssl = getDatabaseSslConfig();

    assert.deepEqual(ssl, {
      rejectUnauthorized: true,
      ca: 'ca-only',
    });
  });
});
