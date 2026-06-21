import pino from 'pino';
import { clickhouseClient } from './connection.js';

const logger = pino({ name: 'init-clickhouse-performance' });

export async function initClickHousePerformanceColumns(): Promise<void> {
  const statements = [
    'ALTER TABLE alarm ADD COLUMN IF NOT EXISTS severity_normalized String MATERIALIZED lower(severity)',
    'ALTER TABLE alarm ADD COLUMN IF NOT EXISTS status_normalized String MATERIALIZED lower(status)',
    'ALTER TABLE alarm ADD COLUMN IF NOT EXISTS device_id_normalized String MATERIALIZED lower(device_id)',
    'ALTER TABLE alarm ADD COLUMN IF NOT EXISTS error_code_normalized String MATERIALIZED lower(error_code)',
    'ALTER TABLE alarm ADD INDEX IF NOT EXISTS idx_severity_normalized severity_normalized TYPE set(100) GRANULARITY 4',
    'ALTER TABLE alarm ADD INDEX IF NOT EXISTS idx_status_normalized status_normalized TYPE set(100) GRANULARITY 4',
    'ALTER TABLE alarm ADD INDEX IF NOT EXISTS idx_device_id_normalized device_id_normalized TYPE bloom_filter(0.01) GRANULARITY 4',
    'ALTER TABLE alarm ADD INDEX IF NOT EXISTS idx_error_code_normalized error_code_normalized TYPE bloom_filter(0.01) GRANULARITY 4',
  ];

  try {
    for (const statement of statements) {
      await clickhouseClient.command({ query: statement });
    }
    logger.info('ClickHouse performance columns and indexes initialized successfully.');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize ClickHouse performance columns.');
    throw error;
  }
}
