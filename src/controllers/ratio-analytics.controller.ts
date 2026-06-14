import { Request, Response, NextFunction } from 'express';
import { RatioAnalyticsService } from '../services/ratio-analytics.service.js';
import { sendSuccess } from './shared.js';

export class RatioAnalyticsController {
  constructor(private readonly ratioService: RatioAnalyticsService) {}

  getRatioAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const queryParams = res.locals.query;
      const metrics = res.locals.metrics;

      const data = await this.ratioService.getRatioAnalytics(queryParams, metrics);

      return sendSuccess(res, data, start);
    } catch (error) {
      next(error);
    }
  };
}
