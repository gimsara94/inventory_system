import { createApp } from './app.js';
import { requireConfig } from './config/env.js';

const config = requireConfig();
if (!config.appDatabaseUrl) throw new Error('APP_DATABASE_URL is required. Run npm run setup-app-role.');
if (config.migrationDatabaseUrl || process.env.DATABASE_URL) {
  throw new Error('Remove privileged database credentials from the web server environment. Keep them only in .env.migrate.');
}
createApp().listen(config.port, () => {
  console.log(`Workshop Inventory API listening on port ${config.port}`);
});
