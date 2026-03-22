import 'dotenv/config';
import { runDatabaseMigrations } from '../server/migrations.ts';

async function main() {
  await runDatabaseMigrations();
  console.log('Database migrations are up to date.');
}

main().catch(error => {
  console.error('Failed to apply database migrations:', error);
  process.exitCode = 1;
});
