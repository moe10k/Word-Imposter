import mysql from 'mysql2/promise';
import type { ConnectionOptions, PoolOptions } from 'mysql2/promise';

let pool: mysql.Pool | null = null;

const DEFAULT_DATABASE_PORT = 3306;
const DEFAULT_DATABASE_CONNECTION_LIMIT = 10;
const DATABASE_URL_ENV_NAMES = [
  'DATABASE_URL',
  'JAWSDB_URL',
  'CLEARDB_DATABASE_URL',
  'STACKHERO_MYSQL_DATABASE_URL',
] as const;

function getRequiredEnv(name: string, env = process.env) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set. Add it to your environment before starting the server.`);
  }
  return value;
}

function getOptionalEnv(name: string, env = process.env) {
  return env[name]?.trim();
}

function parseNumberEnv(name: string, fallback: number, env = process.env) {
  const rawValue = env[name]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a valid number.`);
  }

  return value;
}

function parseBooleanEnv(name: string, fallback: boolean, env = process.env) {
  const rawValue = env[name]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const normalizedValue = rawValue.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalizedValue)) {
    return false;
  }

  throw new Error(`${name} must be a valid boolean.`);
}

export function getDatabaseUrl(env = process.env) {
  for (const name of DATABASE_URL_ENV_NAMES) {
    const value = env[name]?.trim();
    if (value) {
      return {
        name,
        value,
      };
    }
  }

  return null;
}

export function getDatabaseSslConfig(env = process.env) {
  const hasCa = Boolean(getOptionalEnv('DB_SSL_CA_BASE64', env));
  const sslEnabled = hasCa || parseBooleanEnv('DB_SSL', false, env);
  if (!sslEnabled) {
    return undefined;
  }

  const rejectUnauthorized = parseBooleanEnv('DB_SSL_REJECT_UNAUTHORIZED', true, env);
  const caBase64 = getOptionalEnv('DB_SSL_CA_BASE64', env);
  if (!caBase64) {
    return { rejectUnauthorized };
  }

  let ca: string;
  try {
    ca = Buffer.from(caBase64, 'base64').toString('utf8');
  } catch {
    throw new Error('DB_SSL_CA_BASE64 must be valid base64.');
  }

  return {
    rejectUnauthorized,
    ca,
  };
}

export function getDatabaseConnectionConfig(env = process.env): ConnectionOptions {
  const urlSource = getDatabaseUrl(env);
  const ssl = getDatabaseSslConfig(env);

  if (urlSource) {
    let databaseUrl: URL;
    try {
      databaseUrl = new URL(urlSource.value);
    } catch {
      throw new Error(`${urlSource.name} must be a valid database connection URL.`);
    }

    if (!['mysql:', 'mysql2:'].includes(databaseUrl.protocol)) {
      throw new Error(`${urlSource.name} must use the mysql:// protocol.`);
    }

    const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ''));
    if (!databaseName) {
      throw new Error(`${urlSource.name} must include a database name.`);
    }

    return {
      host: databaseUrl.hostname,
      port: databaseUrl.port ? Number(databaseUrl.port) : DEFAULT_DATABASE_PORT,
      user: decodeURIComponent(databaseUrl.username),
      password: decodeURIComponent(databaseUrl.password),
      database: databaseName,
      timezone: 'Z',
      ssl,
    };
  }

  return {
    host: getRequiredEnv('DB_HOST', env),
    port: parseNumberEnv('DB_PORT', DEFAULT_DATABASE_PORT, env),
    user: getRequiredEnv('DB_USER', env),
    password: env.DB_PASSWORD ?? '',
    database: getRequiredEnv('DB_NAME', env),
    timezone: 'Z',
    ssl,
  };
}

export function getDatabaseConfig(env = process.env): PoolOptions {
  const connectionLimit = parseNumberEnv(
    'DB_CONNECTION_LIMIT',
    DEFAULT_DATABASE_CONNECTION_LIMIT,
    env
  );

  return {
    ...getDatabaseConnectionConfig(env),
    waitForConnections: true,
    connectionLimit,
    queueLimit: 0,
  };
}

export function createDbPool(options: Partial<PoolOptions> = {}) {
  return mysql.createPool({
    ...getDatabaseConfig(),
    ...options,
  });
}

export function createDbConnection(options: Partial<ConnectionOptions> = {}) {
  return mysql.createConnection({
    ...getDatabaseConnectionConfig(),
    ...options,
  });
}

export function getDbPool() {
  if (!pool) {
    pool = createDbPool();
  }
  return pool;
}

export async function closeDbPool() {
  if (!pool) {
    return;
  }

  const currentPool = pool;
  pool = null;
  await currentPool.end();
}
