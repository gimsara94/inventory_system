import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getAdminPool } from '../src/db/pool.js';
import { loadMigrationEnv } from '../src/config/env.js';

loadMigrationEnv();
const directory = resolve(process.cwd(), '../supabase/migrations');
let db;
try {
  db = await getAdminPool().connect();
  await db.query('CREATE SCHEMA IF NOT EXISTS inventory');
  await db.query('REVOKE ALL ON SCHEMA inventory FROM PUBLIC, anon, authenticated');
  await db.query(`CREATE TABLE IF NOT EXISTS inventory.schema_migrations (
    version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await db.query('ALTER TABLE inventory.schema_migrations ENABLE ROW LEVEL SECURITY');
  await db.query('REVOKE ALL ON inventory.schema_migrations FROM PUBLIC, anon, authenticated');
  for (const name of (await readdir(directory)).filter(file => /^\d+_.*\.sql$/.test(file)).sort()) {
    await db.query('BEGIN');
    try {
      const { rows } = await db.query('SELECT 1 FROM inventory.schema_migrations WHERE version=$1', [name]);
      if (rows.length) {
        console.log(`Already applied: ${name}`);
      } else {
        await db.query(await readFile(resolve(directory, name), 'utf8'));
        await db.query('INSERT INTO inventory.schema_migrations(version) VALUES($1)', [name]);
        console.log(`Applied: ${name}`);
      }
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }
} catch (error) {
  if (['ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH'].includes(error.code)) {
    console.error(`Could not reach the database (${error.code}). If MIGRATION_DATABASE_URL uses db.<project-ref>.supabase.co, use the Session pooler connection string from Supabase Dashboard → Connect. Direct connections require IPv6 unless the project has the IPv4 add-on.`);
  } else {
    console.error(`Migration failed: ${error.message}`);
  }
  process.exitCode = 1;
} finally {
  db?.release();
  await getAdminPool().end();
}
