import pg from 'pg';
import { requireConfig } from '../config/env.js';

let pool;
let adminPool;
function createPool(databaseUrl) {
  const config = requireConfig();
  const connection = new URL(databaseUrl);
  // node-postgres can replace the explicit CA options when sslmode is in the URL.
  // Keep TLS configuration in one place so hostname and CA verification stay on.
  connection.searchParams.delete('sslmode');
  connection.searchParams.delete('sslrootcert');
  return new pg.Pool({
    connectionString: connection.toString(),
    ssl: config.ssl && { ...config.ssl, servername: connection.hostname },
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    statement_timeout: 15000,
  });
}

export function getPool() {
  if (!pool) {
    const appDatabaseUrl = requireConfig().appDatabaseUrl;
    if (!appDatabaseUrl) throw new Error('APP_DATABASE_URL is required. Run npm run setup-app-role.');
    pool = createPool(appDatabaseUrl);
  }
  return pool;
}

export function getAdminPool() {
  if (!adminPool) {
    const migrationDatabaseUrl = requireConfig().migrationDatabaseUrl;
    if (!migrationDatabaseUrl) throw new Error('MIGRATION_DATABASE_URL is required in backend/.env.migrate.');
    adminPool = createPool(migrationDatabaseUrl);
  }
  return adminPool;
}

export function setPoolForTests(testPool) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('The database pool can only be replaced in the test environment.');
  }
  pool = testPool;
}

export async function transaction(work) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
