import { Request, Response, NextFunction } from 'express';
import { TimeSeriesDurationService } from '../services/time-series-duration.service.js';
import { sendSuccess } from './shared.js';

export class TimeSeriesDurationController {
  constructor(private readonly timeSeriesDurationService: TimeSeriesDurationService) {}

  getTimeSeriesDuration = async (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const queryParams = res.locals.query;
      const metrics = res.locals.metrics;

      const data = await this.timeSeriesDurationService.getTimeSeriesDuration(queryParams, metrics);

      return sendSuccess(res, data, start);
    } catch (error) {
      next(error);
    }
  };
}
