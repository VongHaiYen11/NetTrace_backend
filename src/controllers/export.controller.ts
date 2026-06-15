import { Request, Response, NextFunction } from 'express';
import { ExportService } from '../services/export.service.js';

export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  exportAlarms = async (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const queryParams = res.locals.query;
      const metrics = res.locals.metrics;

      let normalizedParams;
      if (req.method === 'GET') {
        const {
          format,
          columns,
          from_time,
          to_time,
          severity,
          status,
          device_id,
          error_code,
          device_type,
          vendor,
          station,
          province,
          sort_by,
          sort_order,
          limit,
        } = queryParams;

        normalizedParams = {
          format,
          columns,
          filters: {
            from_time,
            to_time,
            severity,
            status,
            device_id,
            error_code,
            device_type,
            vendor,
            station,
            province,
            sort_by,
            sort_order,
            limit,
          },
        };
      } else {
        normalizedParams = queryParams;
      }

      await this.exportService.exportAlarms(normalizedParams, res, metrics);
    } catch (error) {
      next(error);
    }
  };
}
