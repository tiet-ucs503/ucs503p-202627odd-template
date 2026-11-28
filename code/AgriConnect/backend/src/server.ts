import { createServer } from 'node:http';
import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { getEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { initSocketIO } from './config/socket.js';
import { runListingMaintenanceJobs } from './jobs/listing-jobs.js';
import { syncMandiPricesToTrends } from './services/mandi-prices.service.js';
import { seedReferencePriceTrendsIfEmpty } from './services/price-trend.service.js';

const env = getEnv();
const server = createServer(app);
initSocketIO(server);
let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown started');

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'HTTP server failed to close cleanly');
    }

    disconnectDatabase()
      .then(() => {
      clearTimeout(forceExit);
      process.exitCode = error ? 1 : 0;
      })
      .catch((disconnectError: unknown) => {
        logger.error({ err: disconnectError }, 'Database disconnect failed');
        process.exitCode = 1;
      });
  });
}

process.once('SIGINT', () => {
  shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  shutdown('SIGTERM');
});

try {
  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'AgriConnect API listening');
  });

  try {
    await connectDatabase();
    await seedReferencePriceTrendsIfEmpty();
    const expiryTimer = setInterval(() => {
      void runListingMaintenanceJobs().catch((error: unknown) => {
        logger.error({ err: error }, 'Listing maintenance job failed');
      });
    }, 60 * 60 * 1000);
    expiryTimer.unref();

    const mandiSyncTimer = setInterval(() => {
      void syncMandiPricesToTrends().catch((error: unknown) => {
        logger.warn({ err: error }, 'Scheduled mandi price sync failed');
      });
    }, 24 * 60 * 60 * 1000);
    mandiSyncTimer.unref();
  } catch (dbError) {
    logger.error(
      { err: dbError },
      `Database connection failed at startup. Supabase project may be paused. Server is listening on port ${String(env.PORT)}`,
    );
  }
} catch (error) {
  logger.fatal({ err: error }, 'Server startup failed');
  await disconnectDatabase();
  process.exitCode = 1;
}
