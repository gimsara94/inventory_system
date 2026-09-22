import express from 'express';
import { createApp } from './src/app.js';
import { requireConfig } from './src/config/env.js';

// Vercel detects a root Express entry point and invokes the exported app.
function startupErrorCode(error) {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('A database URL is required') || message.startsWith('APP_DATABASE_URL is required')) {
    return 'APP_DATABASE_URL_MISSING';
  }
  if (message.startsWith('A database URL still contains')) return 'DATABASE_URL_PLACEHOLDER';
  if (message.startsWith('JWT_SECRET')) return 'JWT_SECRET_INVALID';
  if (message.startsWith('INVENTORY_ORIGIN')) return 'INVENTORY_ORIGIN_INVALID';
  if (message.startsWith('Remove privileged database credentials')) return 'PRIVILEGED_DATABASE_URL_PRESENT';
  if (error?.code === 'ENOENT') return 'DATABASE_CA_CERT_MISSING';
  if (error?.code === 'ERR_INVALID_URL') return 'INVALID_CONFIG_URL';
  return 'STARTUP_ERROR';
}

const app = express();
app.disable('x-powered-by');
try {
  const config = requireConfig();
  if (!config.appDatabaseUrl) throw new Error('APP_DATABASE_URL is required. Run npm run setup-app-role.');
  if (config.migrationDatabaseUrl || process.env.DATABASE_URL) {
    throw new Error('Remove privileged database credentials from the web server environment. Keep them only in .env.migrate.');
  }
  app.use(createApp());
} catch (error) {
  const code = startupErrorCode(error);
  console.error(`Inventory API startup failed: ${code}`);
  app.use((_req, res) => res.set('Cache-Control', 'no-store').status(503).json({ status: 'error', code }));
}

export default app;
