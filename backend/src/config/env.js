import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const localEnv = resolve(process.cwd(), '.env');
if (existsSync(localEnv)) process.loadEnvFile(localEnv);

export function loadMigrationEnv() {
  const migrationEnv = resolve(process.cwd(), '.env.migrate');
  if (existsSync(migrationEnv)) process.loadEnvFile(migrationEnv);
}

export function requireConfig() {
  const appDatabaseUrl = process.env.APP_DATABASE_URL;
  const migrationDatabaseUrl = process.env.MIGRATION_DATABASE_URL;
  const jwtSecret = process.env.JWT_SECRET;
  if (!appDatabaseUrl && !migrationDatabaseUrl) throw new Error('A database URL is required. Configure backend/.env.migrate or run npm run setup-app-role.');
  if (appDatabaseUrl?.includes('[YOUR-PASSWORD]') || migrationDatabaseUrl?.includes('[YOUR-PASSWORD]')) {
    throw new Error('A database URL still contains [YOUR-PASSWORD]. Replace it in the private environment file.');
  }
  if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32 || jwtSecret.startsWith('replace-with-')) {
    throw new Error('JWT_SECRET must contain at least 32 bytes of random text, not the example value.');
  }
  const origin = new URL(process.env.INVENTORY_ORIGIN || process.env.PUBLIC_ORIGIN || 'http://localhost:5173');
  if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('INVENTORY_ORIGIN must be an HTTP or HTTPS origin.');
  if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:') {
    throw new Error('INVENTORY_ORIGIN must use HTTPS in production.');
  }
  const caPath = process.env.DATABASE_CA_CERT || fileURLToPath(new URL('../../certs/supabase-root-2021.crt', import.meta.url));
  return {
    appDatabaseUrl,
    migrationDatabaseUrl,
    jwtSecret,
    port: Number(process.env.PORT || 3001),
    publicOrigin: origin.origin,
    currency: process.env.INVENTORY_CURRENCY || 'LKR',
    timeZone: process.env.INVENTORY_TIMEZONE || 'Asia/Colombo',
    ssl: process.env.DATABASE_SSLMODE === 'disable' ? false : {
      ca: readFileSync(caPath, 'utf8'),
      rejectUnauthorized: true,
      servername: new URL(appDatabaseUrl || migrationDatabaseUrl).hostname,
    },
  };
}
