import { Request, Response, NextFunction } from 'express';
import pino from 'pino';

const logger = pino({ name: 'error-handler' });

export function errorMiddleware(
  err: Error & { code?: string; statusCode?: number },
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const reqId = req.headers['x-request-id'] || res.locals.requestId || 'unknown';
  // Log the full error stack internally
  logger.error(
    {
      request_id: reqId,
      endpoint: req.originalUrl,
      error: err.message || err,
      stack: err.stack,
    },
    'Express request unhandled exception',
  );

  const errorMessage = err.message || '';
  const isPostgresTimeout =
    errorMessage.includes('query timeout') ||
    errorMessage.includes('connection timeout') ||
    err.code === '57014'; // PG query cancelled code

  const isClickHouseTimeout =
    errorMessage.toLowerCase().includes('timeout') &&
    (errorMessage.toLowerCase().includes('clickhouse') ||
      errorMessage.toLowerCase().includes('fetch'));

  if (isPostgresTimeout) {
    return res.status(504).json({
      success: false,
      error: {
        code: 'DATABASE_TIMEOUT',
        message: 'PostgreSQL query timed out (5s SLA)',
      },
    });
  }

  if (isClickHouseTimeout) {
    return res.status(504).json({
      success: false,
      error: {
        code: 'DATABASE_TIMEOUT',
        message: 'ClickHouse query timed out (30s SLA)',
      },
    });
  }

  if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code || 'REQUEST_ERROR',
        message: err.message,
      },
    });
  }

  // Handle general database connection/query errors
  if (
    err.code &&
    (err.code.startsWith('08') || err.code.startsWith('28') || err.code.startsWith('3D'))
  ) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database connection or operations failed',
      },
    });
  }

  // Fallback to internal server error
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal server error occurred',
    },
  });
}
