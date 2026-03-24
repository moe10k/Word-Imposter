## Run Locally

**Prerequisites:** Node.js 24+ and MySQL 8+

1. Install dependencies:
   `npm install`
2. Create a MySQL database for the app, for example:
   `CREATE DATABASE word_imposter CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
3. Copy `.env.example` to `.env` and fill in:
   - `APP_URL`
   - Either `DATABASE_URL` or the split fallback vars: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
   - `SESSION_SECRET` with a long random value
   - `OPENAI_API_KEY` if you want AI-generated words; if it is omitted the game falls back to bundled words
4. Apply the schema:
   `npm run db:setup`
5. Start the app:
   `npm run dev`
6. `npm run dev` opens the local game URL in 4 browser tabs on first startup. In development you can click the `Dev Player 1-4` buttons to sign each tab in instantly.

## Database Files

- Full schema: `db/schema.sql`
- Initial migration: `db/migrations/001_auth_tables.sql`
- Local/release migration entrypoint: `scripts/migrate.ts`

## Heroku Deployment

This app is currently designed for a single Heroku web dyno because live room state is kept in memory. Do not scale `web` above `1` unless you first move game room state and socket coordination into shared infrastructure.

1. Create the app and use the Node.js buildpack:
   `heroku create your-app-name`
2. Provision MySQL. JawsDB is one option:
   `heroku addons:create jawsdb:kitefin`
3. Set required config vars:
   - `APP_URL=https://your-app-name.herokuapp.com`
   - `SESSION_SECRET=<long random secret>`
   - `OPENAI_API_KEY=<optional>`
   - If your database add-on does not expose `DATABASE_URL` or `JAWSDB_URL`, set the split `DB_*` vars instead.
   - If your provider requires TLS, set `DB_SSL=true` and optionally `DB_SSL_REJECT_UNAUTHORIZED=false` and `DB_SSL_CA_BASE64`.
4. Deploy with Git:
   `git push heroku main`
5. Keep the app on one web dyno:
   `heroku ps:scale web=1`
6. Verify the release phase and app health:
   - `heroku releases`
   - `heroku logs --tail`
   - `curl https://your-app-name.herokuapp.com/healthz`

The Heroku `Procfile` runs database migrations in the release phase before the new web dyno is promoted. If the migration step fails, the release is blocked and the previous version stays active.
