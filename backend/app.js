import express from 'express';
import { createApp } from './src/app.js';
import { requireConfig } from './src/config/env.js';

// Vercel detects a root Express entry point and invokes the exported app.
const config = requireConfig();
if (!config.appDatabaseUrl) throw new Error('APP_DATABASE_URL is required. Run npm run setup-app-role.');
if (config.migrationDatabaseUrl || process.env.DATABASE_URL) {
  throw new Error('Remove privileged database credentials from the web server environment. Keep them only in .env.migrate.');
}

const app = express();
app.use(createApp());

export default app;
