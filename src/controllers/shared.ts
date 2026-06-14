import { Response } from 'express';

export function sendSuccess(
  res: Response,
  data: unknown,
  start: number,
  additionalMeta?: Record<string, unknown>,
) {
  const executionTimeMs = Math.round(performance.now() - start);
  return res.status(200).json({
    success: true,
    data,
    meta: {
      ...additionalMeta,
      execution_time_ms: executionTimeMs,
    },
  });
}
