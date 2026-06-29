import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

// Initialize the root pino logger
export const appLogger = pino({
  name: 'alarm-api',
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  // In development, we can format output nicely, in production we want standard fast JSON
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: { colorize: true },
        }
      : undefined,
});

export function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = performance.now();

  // 1. Establish unique request_id
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  res.setHeader('x-request-id', requestId);
  res.locals.requestId = requestId;

  // 2. Initialize database metrics container
  res.locals.metrics = {
    clickhouse_query_time_ms: 0,
    postgres_query_time_ms: 0,
    records_returned: 0,
  };

  // 3. Set up listener to log request metadata upon completion
  res.on('finish', () => {
    const end = performance.now();
    const durationMs = Math.round(end - start);

    const metrics = res.locals.metrics;
    const logData = {
      request_id: requestId,
      method: req.method,
      endpoint: req.originalUrl,
      status: res.statusCode,
      clickhouse_query_time_ms: Math.round(metrics.clickhouse_query_time_ms),
      postgres_query_time_ms: Math.round(metrics.postgres_query_time_ms),
      execution_time_ms: durationMs,
      records_returned: metrics.records_returned,
      include_total: metrics.include_total,
      alarm_columns: metrics.alarm_columns,
      clickhouse_rows_returned: metrics.clickhouse_rows_returned,
      metadata_ids_fetched: metrics.metadata_ids_fetched,
      export_batches: metrics.export_batches,
      federated_fanout_rows: metrics.federated_fanout_rows,
      federated_fanout_limit: metrics.federated_fanout_limit,
    };

    // Log the request completion
    appLogger.info(logData, 'Request completed');

    // 4. SLA checks and warnings
    let slaThreshold = 5000; // Default: 5s for standard query endpoints
    let apiType = 'Query API';

    if (
      req.originalUrl.includes('/analytics/query') ||
      req.originalUrl.includes('/analytics/summary') ||
      req.originalUrl.includes('/analytics/heatmap')
    ) {
      slaThreshold = 2000;
      apiType = 'Analytics API';
    } else if (req.originalUrl.includes('/export')) {
      slaThreshold = 3000;
      apiType = 'Export API';
    }

    if (durationMs > slaThreshold) {
      appLogger.warn(
        {
          request_id: requestId,
          endpoint: req.originalUrl,
          durationMs,
          slaThreshold,
          apiType,
        },
        `SLA warning: ${apiType} exceeded threshold of ${slaThreshold}ms`,
      );
    }
  });

  next();
}
