import { createClient } from '@clickhouse/client';
import { config } from '../../configs/database.config.js';
import pino from 'pino';

const logger = pino({ name: 'clickhouse-db' });

// Create the Singleton client instance
export const clickhouseClient = createClient({
  url: config.clickhouse.host,
  username: config.clickhouse.username,
  password: config.clickhouse.password,
  database: config.clickhouse.database,
  clickhouse_settings: {
    max_execution_time: 30, // SLA: 30 seconds server-side timeout
  },
});

/**
 * Execute ClickHouse query and measure its duration
 */
export async function executeClickhouseQuery<T = unknown>(
  query: string,
  queryParams?: Record<string, unknown>,
): Promise<{ rows: T[]; durationMs: number }> {
  const start = performance.now();
  try {
    const resultSet = await clickhouseClient.query({
      query,
      format: 'JSONEachRow',
      query_params: queryParams,
    });

    const rows = await resultSet.json<T>();
    const durationMs = Math.round(performance.now() - start);

    return { rows, durationMs };
  } catch (error: unknown) {
    const durationMs = Math.round(performance.now() - start);
    logger.error(
      {
        query,
        params: queryParams,
        error: error instanceof Error ? error.message : String(error),
        durationMs,
      },
      'ClickHouse query error',
    );
    throw error;
  }
}
