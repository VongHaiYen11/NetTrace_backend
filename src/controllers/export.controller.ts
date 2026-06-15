import { Request, Response, NextFunction } from 'express';
import { ExportService } from '../services/export.service.js';

export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  exportAlarms = async (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const queryParams = res.locals.query;
      const metrics = res.locals.metrics;

      await this.exportService.exportAlarms(queryParams, res, metrics);
    } catch (error) {
      next(error);
    }
  };
}
