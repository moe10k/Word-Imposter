## Run Locally

**Prerequisites:** Node.js 22+ and MySQL 8+

1. Install dependencies:
   `npm install`
2. Create a MySQL database for the app, for example:
   `CREATE DATABASE word_imposter CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
3. Copy `.env.example` to `.env` and fill in:
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
   - `SESSION_SECRET` with a long random value
   - `OPENAI_API_KEY` if you want AI-generated words; if it is omitted the game falls back to bundled words
4. Apply the schema:
   `npm run db:setup`
5. Start the app:
   `npm run dev`
6. Open [http://localhost:3000](http://localhost:3000), create an account, log in, then create or join a room.

## Database Files

- Full schema: `db/schema.sql`
- Initial migration: `db/migrations/001_auth_tables.sql`
- Local setup script: `scripts/setup-db.ts`
