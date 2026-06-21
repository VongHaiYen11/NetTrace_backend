import { Request, Response, NextFunction } from 'express';
import { HeatmapService } from '../services/heatmap.service.js';
import { sendSuccess } from './shared.js';

export class HeatmapController {
  constructor(private readonly heatmapService: HeatmapService) {}

  getHeatmap = async (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const queryParams = res.locals.query;
      const metrics = res.locals.metrics;

      const data = await this.heatmapService.getHeatmap(queryParams, metrics);

      return sendSuccess(res, data, start);
    } catch (error) {
      next(error);
    }
  };
}
