import { Request, Response, NextFunction } from 'express';
import { TopNAnalyticsService } from '../services/top-n-analytics.service.js';
import { sendSuccess } from './shared.js';

export class TopNAnalyticsController {
  constructor(private readonly topNService: TopNAnalyticsService) {}

  getTopNAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const queryParams = res.locals.query;
      const metrics = res.locals.metrics;

      const data = await this.topNService.getTopNAnalytics(queryParams, metrics);

      return sendSuccess(res, data, start);
    } catch (error) {
      next(error);
    }
  };
}
