import 'dotenv/config';
import { readFile } from 'fs/promises';
import path from 'path';
import mysql from 'mysql2/promise';
import { getDatabaseConfig } from '../server/db.ts';

async function main() {
  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
  const schemaSql = await readFile(schemaPath, 'utf8');
  const connection = await mysql.createConnection({
    ...getDatabaseConfig(),
    multipleStatements: true,
  });

  try {
    await connection.query(schemaSql);
    console.log('Database schema applied successfully.');
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error('Failed to apply database schema:', error);
  process.exitCode = 1;
});
