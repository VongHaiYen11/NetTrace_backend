import { NextFunction, Request, Response } from 'express';
import { PresetService } from '../services/preset.service.js';

export class PresetController {
  constructor(private readonly presetService: PresetService) {}

  listPresets = async (_req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const { limit, offset } = res.locals.query;
      const presets = await this.presetService.listPresets(limit, offset);
      return res.status(200).json({
        success: true,
        data: presets,
        meta: { execution_time_ms: Math.round(performance.now() - start) },
      });
    } catch (error) {
      next(error);
    }
  };

  createPreset = async (_req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const preset = await this.presetService.createPreset(res.locals.body);
      return res.status(201).json({
        success: true,
        data: preset,
        meta: { execution_time_ms: Math.round(performance.now() - start) },
      });
    } catch (error) {
      next(error);
    }
  };
}
