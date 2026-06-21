import { executePgQuery, pgPool } from '../database/postgres/connection.js';
import { executeClickhouseQuery, clickhouseClient } from '../database/clickhouse/connection.js';
import pino from 'pino';

const logger = pino({
  name: 'db-check',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

async function checkPostgres() {
  logger.info('Checking PostgreSQL connection...');
  try {
    // 1. Connection check
    const { rows: versionCheck } = await executePgQuery<{ version: string }>('SELECT version()');
    logger.info(`PostgreSQL Connected: ${versionCheck[0].version}`);

    // 2. Table checks
    const targetTables = ['vendor', 'station', 'device', 'error'];
    const { rows: existingTables } = await executePgQuery<{ table_name: string }>(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' 
       AND table_name = ANY($1)`,
      [targetTables],
    );

    const foundTableNames = existingTables.map((t) => t.table_name);
    logger.info(`Found PostgreSQL tables: ${foundTableNames.join(', ')}`);

    for (const table of targetTables) {
      if (foundTableNames.includes(table)) {
        const { rows: countRes } = await executePgQuery<{ count: string }>(
          `SELECT COUNT(*) as count FROM "${table}"`,
        );
        logger.info(`Table "${table}": ${countRes[0].count} rows`);
      } else {
        logger.warn(`Table "${table}" is MISSING in PostgreSQL database!`);
      }
    }
  } catch (error: unknown) {
    logger.error(
      { err: error instanceof Error ? error.message : String(error) },
      'PostgreSQL connection failed',
    );
    throw error;
  }
}

async function checkClickhouse() {
  logger.info('Checking ClickHouse connection...');
  try {
    // 1. Ping ClickHouse
    const { rows: versionCheck } = await executeClickhouseQuery<{ version: string }>(
      'SELECT version() as version',
    );
    logger.info(`ClickHouse Connected. Version: ${versionCheck[0].version}`);

    // 2. Check if table 'alarm' exists
    const { rows: tableCheck } = await executeClickhouseQuery<{ name: string }>(
      "SHOW TABLES LIKE 'alarm'",
    );

    if (tableCheck.length > 0) {
      const { rows: countRes } = await executeClickhouseQuery<{ count: string }>(
        'SELECT count() as count FROM alarm',
      );
      logger.info(`Table "alarm": ${countRes[0].count} rows`);

      const { rows: columns } = await executeClickhouseQuery<{ name: string; type: string }>(
        'DESCRIBE TABLE alarm',
      );
      logger.info('ClickHouse table "alarm" columns:');
      columns.forEach((col) => {
        logger.info(`  - ${col.name}: ${col.type}`);
      });
    } else {
      logger.warn('Table "alarm" is MISSING in ClickHouse database!');
    }
  } catch (error: unknown) {
    logger.error(
      { err: error instanceof Error ? error.message : String(error) },
      'ClickHouse connection failed',
    );
    throw error;
  }
}

async function main() {
  logger.info('================ Database Connectivity Check ================');
  let success = true;
  try {
    await checkPostgres();
  } catch {
    success = false;
  }

  logger.info('------------------------------------------------------------');

  try {
    await checkClickhouse();
  } catch {
    success = false;
  }

  logger.info('============================================================');

  // Close connections
  await pgPool.end();
  await clickhouseClient.close();

  if (success) {
    logger.info('Database check completed successfully! Connections OK.');
    process.exit(0);
  } else {
    logger.error('Database check failed. Please verify your connection details in .env.');
    process.exit(1);
  }
}

main();
