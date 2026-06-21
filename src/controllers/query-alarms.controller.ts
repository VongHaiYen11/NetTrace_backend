import { Request, Response, NextFunction } from 'express';
import { QueryAlarmsService } from '../services/query-alarms.service.js';
import { sendSuccess } from './shared.js';

export class QueryAlarmsController {
  constructor(private readonly queryAlarmsService: QueryAlarmsService) {}

  queryAlarms = async (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const queryParams = res.locals.query;
      const metrics = res.locals.metrics;

      const { alarms, total } = await this.queryAlarmsService.queryAlarms(queryParams, metrics);
      const meta: Record<string, unknown> = {
        offset: queryParams.offset,
        limit: queryParams.limit,
      };
      if (queryParams.include_total !== false) {
        meta.total = total ?? 0;
      }

      return sendSuccess(res, alarms, start, meta);
    } catch (error) {
      next(error);
    }
  };
}
