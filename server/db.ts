import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set. Add it to your environment before starting the server.`);
  }
  return value;
}

export function getDatabaseConfig(): mysql.PoolOptions {
  const port = Number(process.env.DB_PORT ?? 3306);
  const connectionLimit = Number(process.env.DB_CONNECTION_LIMIT ?? 10);

  return {
    host: getRequiredEnv('DB_HOST'),
    port: Number.isFinite(port) ? port : 3306,
    user: getRequiredEnv('DB_USER'),
    password: getRequiredEnv('DB_PASSWORD'),
    database: getRequiredEnv('DB_NAME'),
    waitForConnections: true,
    connectionLimit: Number.isFinite(connectionLimit) ? connectionLimit : 10,
    queueLimit: 0,
    timezone: 'Z',
  };
}

export function createDbPool(options: Partial<mysql.PoolOptions> = {}) {
  return mysql.createPool({
    ...getDatabaseConfig(),
    ...options,
  });
}

export function getDbPool() {
  if (!pool) {
    pool = createDbPool();
  }
  return pool;
}
