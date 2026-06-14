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

      return sendSuccess(res, alarms, start, {
        limit: queryParams.limit,
        total,
      });
    } catch (error) {
      next(error);
    }
  };
}
