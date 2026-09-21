import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import userRoutes from './routes/users.js';
import { authenticate, adminOnly, requireCsrf } from './middleware/auth.js';
import { handleError, notFound } from './middleware/errors.js';
import { protectOrigin } from './middleware/origin.js';
import { requireConfig } from './config/env.js';

export function createApp() {
  const config = requireConfig();
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: {
    directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"],
      connectSrc: ["'self'"], imgSrc: ["'self'", 'data:'], objectSrc: ["'none'"],
      frameAncestors: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"] },
  } }));
  app.use(express.json({ limit: '64kb' }));
  app.use('/api', protectOrigin(config.publicOrigin));
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRoutes);
  app.use('/api', authenticate, requireCsrf, itemRoutes);
  app.use('/api', authenticate, requireCsrf, adminOnly, userRoutes);

  const frontend = resolve(process.cwd(), '../frontend/dist');
  if (existsSync(frontend)) {
    app.use(express.static(frontend, { index: false }));
    app.get('/{*path}', (req, res, next) => req.path.startsWith('/api/')
      ? next() : res.sendFile(resolve(frontend, 'index.html')));
  }
  app.use(notFound);
  app.use(handleError);
  return app;
}
