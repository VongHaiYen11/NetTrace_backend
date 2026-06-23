import { Request, Response, NextFunction } from 'express';
import { MetadataOptionsService } from '../services/metadata-options.service.js';
import { sendSuccess } from './shared.js';

export class MetadataOptionsController {
  constructor(private readonly metadataOptionsService: MetadataOptionsService) {}

  getOptions = async (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const queryParams = res.locals.query;
      const metrics = res.locals.metrics;
      const options = await this.metadataOptionsService.getOptions(queryParams, metrics);
      return sendSuccess(res, options, start);
    } catch (error) {
      next(error);
    }
  };
}
