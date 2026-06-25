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

  updatePreset = async (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const presetId = parseInt(req.params.id, 10);
      if (isNaN(presetId)) return res.status(400).json({ success: false, error: { message: 'Invalid preset ID' } });

      const preset = await this.presetService.updatePreset(presetId, res.locals.body);
      if (!preset) return res.status(404).json({ success: false, error: { message: 'Preset not found' } });

      return res.status(200).json({
        success: true,
        data: preset,
        meta: { execution_time_ms: Math.round(performance.now() - start) },
      });
    } catch (error) {
      next(error);
    }
  };

  deletePresets = async (_req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const { ids } = res.locals.body;
      const count = await this.presetService.deletePresets(ids);
      return res.status(200).json({
        success: true,
        data: { deletedCount: count },
        meta: { execution_time_ms: Math.round(performance.now() - start) },
      });
    } catch (error) {
      next(error);
    }
  };
}
