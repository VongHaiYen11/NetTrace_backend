import { Request, Response, NextFunction } from 'express';
import { TimeSeriesCountService } from '../services/time-series-count.service.js';
import { sendSuccess } from './shared.js';

export class TimeSeriesCountController {
  constructor(private readonly timeSeriesCountService: TimeSeriesCountService) {}

  getTimeSeriesCount = async (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const queryParams = res.locals.query;
      const metrics = res.locals.metrics;

      const data = await this.timeSeriesCountService.getTimeSeriesCount(queryParams, metrics);

      return sendSuccess(res, data, start);
    } catch (error) {
      next(error);
    }
  };
}
