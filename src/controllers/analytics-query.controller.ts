import { Request, Response, NextFunction } from 'express';
import { AnalyticsQueryService } from '../services/analytics-query.service.js';
import { sendSuccess } from './shared.js';

export class AnalyticsQueryController {
  constructor(private readonly analyticsQueryService: AnalyticsQueryService) {}

  executeQuery = async (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const queryParams = res.locals.query;
      const metrics = res.locals.metrics;

      const data = await this.analyticsQueryService.executeQuery(queryParams, metrics);

      return sendSuccess(res, data, start);
    } catch (error) {
      next(error);
    }
  };
}
