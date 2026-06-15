import { Request, Response, NextFunction } from 'express';
import { SummaryService } from '../services/summary.service.js';
import { sendSuccess } from './shared.js';

export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  getSummary = async (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const queryParams = res.locals.query;
      const metrics = res.locals.metrics;

      const summary = await this.summaryService.getSummary(queryParams, metrics);

      return sendSuccess(res, summary, start);
    } catch (error) {
      next(error);
    }
  };
}
