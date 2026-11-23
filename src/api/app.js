import express from 'express';
import cors from 'cors';
import { env } from '../config/env.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import healthRoutes from './routes/health.js';
import projectRoutes from './routes/projects.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((s) => s.trim()),
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', apiRateLimiter);

  app.use('/api/health', healthRoutes);
  app.use('/api/projects', projectRoutes);

  app.use(errorHandler);
  return app;
}
