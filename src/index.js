import { env } from './config/env.js';
import { initMySQL } from './config/mysql.js';
import { initMongo } from './config/mongo.js';
import { createApp } from './api/app.js';

async function bootstrap() {
  await initMySQL();
  await initMongo();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[CODEMIND] Backend API listening on port ${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('[CODEMIND] Fatal startup failure:', err);
  process.exit(1);
});
