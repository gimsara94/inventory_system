import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadMigrationEnv, requireConfig } from '../src/config/env.js';
import { getAdminPool, getPool } from '../src/db/pool.js';

loadMigrationEnv();
const config = requireConfig();
const adminUrl = new URL(config.migrationDatabaseUrl);
const ref = adminUrl.username.startsWith('postgres.')
  ? adminUrl.username.slice('postgres.'.length)
  : /^db\.([a-z0-9]+)\.supabase\.co$/.exec(adminUrl.hostname)?.[1];
if (!ref || !/^[a-z0-9]{10,40}$/.test(ref)) throw new Error('Could not determine the Supabase project reference from MIGRATION_DATABASE_URL.');

const secret = randomBytes(48).toString('base64url');
const admin = getAdminPool();
try {
  const { rows: roles } = await admin.query("SELECT 1 FROM pg_roles WHERE rolname='inventory_app'");
  if (!roles.length) throw new Error('Run npm run migrate first to create inventory_app.');
  const { rows } = await admin.query("SELECT format('ALTER ROLE inventory_app WITH LOGIN PASSWORD %L', $1::text) AS sql", [secret]);
  await admin.query(rows[0].sql);

  const appUrl = new URL(config.migrationDatabaseUrl);
  appUrl.username = `inventory_app.${ref}`;
  appUrl.password = secret;
  const file = resolve(process.cwd(), '.env');
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const index = lines.findIndex(line => line.split('=', 1)[0].trim() === 'APP_DATABASE_URL');
  const entry = `APP_DATABASE_URL=${appUrl.toString()}`;
  if (index >= 0) lines[index] = entry;
  else lines.push(entry);
  writeFileSync(file, lines.join('\n'), { mode: 0o600 });
  chmodSync(file, 0o600);
  process.env.APP_DATABASE_URL = appUrl.toString();
  console.log('Configured a limited inventory_app database role in backend/.env.');
} finally {
  await admin.end();
}

// Verify the new credential before reporting success.
try {
  const { rows } = await getPool().query('SELECT current_user AS role');
  if (rows[0].role !== 'inventory_app') throw new Error('The application database credential did not select inventory_app.');
  console.log('Verified application database login.');
} finally {
  await getPool().end();
}
