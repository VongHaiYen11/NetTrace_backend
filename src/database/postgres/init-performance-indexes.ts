import pino from 'pino';
import { executePgQuery } from './connection.js';

const logger = pino({ name: 'init-performance-indexes' });

export async function initPerformanceIndexes(): Promise<void> {
  const query = `
    CREATE INDEX IF NOT EXISTS idx_device_device_type_lower ON device (LOWER(device_type));
    CREATE INDEX IF NOT EXISTS idx_vendor_name_lower ON vendor (LOWER(name));
    CREATE INDEX IF NOT EXISTS idx_station_name_lower ON station (LOWER(name));
    CREATE INDEX IF NOT EXISTS idx_station_province_lower ON station (LOWER(province));
    CREATE INDEX IF NOT EXISTS idx_error_code_lower ON error (LOWER(error_code));
    CREATE INDEX IF NOT EXISTS idx_device_id_lower ON device (LOWER(device_id));
  `;

  try {
    await executePgQuery(query);
    logger.info('PostgreSQL performance indexes initialized successfully.');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize PostgreSQL performance indexes.');
    throw error;
  }
}
