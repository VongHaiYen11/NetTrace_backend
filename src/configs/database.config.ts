import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  postgres: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    database: process.env.PG_DATABASE || 'noc_metadata',
    maxPoolSize: parseInt(process.env.PG_MAX_POOL || '20', 10),
    ssl: process.env.PG_SSL === 'true',
    queryTimeoutMs: 5000, // SLA: 5 seconds
  },
  clickhouse: {
    host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DATABASE || 'default',
    requestTimeoutMs: 30000, // SLA: 30 seconds
  },
  performance: {
    federatedAnalyticsMaxRows: parseInt(process.env.FEDERATED_ANALYTICS_MAX_ROWS || '10000', 10),
    metadataCacheTtlMs: parseInt(process.env.METADATA_CACHE_TTL_MS || '30000', 10),
  },
};
