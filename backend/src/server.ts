import app from './app.js';
import { config } from './configs/database.config.js';
import { pgPool } from './database/postgres/connection.js';
import { clickhouseClient } from './database/clickhouse/connection.js';
import { appLogger } from './middlewares/logging.middleware.js';

const server = app.listen(config.port, () => {
  appLogger.info(
    { port: config.port, env: config.nodeEnv },
    'Alarms Analytics API Server is running',
  );
  appLogger.info(`Swagger documentation available at http://localhost:${config.port}/api-docs`);
});

// Graceful Shutdown
async function handleShutdown(signal: string) {
  appLogger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Close express server
  server.close(() => {
    appLogger.info('Express server closed.');
  });

  try {
    // Close ClickHouse client
    await clickhouseClient.close();
    appLogger.info('ClickHouse client connection closed.');

    // Close PostgreSQL pool
    await pgPool.end();
    appLogger.info('PostgreSQL pool connection closed.');

    appLogger.info('Graceful shutdown completed successfully.');
    process.exit(0);
  } catch (error) {
    appLogger.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
