import pg from 'pg';
import { config } from '../../configs/database.config.js';
import pino from 'pino';

const logger = pino({ name: 'postgres-db' });

const { Pool } = pg;

const poolConfig: pg.PoolConfig = {
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database,
  max: config.postgres.maxPoolSize,
  query_timeout: config.postgres.queryTimeoutMs, // 5000 ms query timeout
  connectionTimeoutMillis: 5000, // 5 seconds connection timeout
};

if (config.postgres.ssl) {
  poolConfig.ssl = {
    rejectUnauthorized: false, // In production, this should ideally be true with CA config
  };
}

export const pgPool = new Pool(poolConfig);

// Log pool errors
pgPool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

/**
 * Execute a query with timing instrumentation
 */
export async function executePgQuery<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<{ rows: T[]; durationMs: number }> {
  const start = performance.now();
  try {
    const res = await pgPool.query(text, params);
    const durationMs = Math.round(performance.now() - start);
    return { rows: res.rows, durationMs };
  } catch (error: unknown) {
    const durationMs = Math.round(performance.now() - start);
    // Log query details on error
    logger.error(
      {
        query: text,
        error: error instanceof Error ? error.message : String(error),
        durationMs,
      },
      'PostgreSQL query error',
    );
    throw error;
  }
}
