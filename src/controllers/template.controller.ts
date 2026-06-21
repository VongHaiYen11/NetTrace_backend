import { Request, Response, NextFunction } from 'express';
import { TemplateService } from '../services/template.service.js';

export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  createTemplate = async (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const { name, selected_cards, widgets } = res.locals.body;
      const template = await this.templateService.createTemplate(name, selected_cards, widgets);

      const executionTimeMs = Math.round(performance.now() - start);
      return res.status(201).json({
        success: true,
        data: template,
        meta: {
          execution_time_ms: executionTimeMs,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  listTemplates = async (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const { limit, offset } = res.locals.query;
      const templates = await this.templateService.listTemplates(limit, offset);

      const executionTimeMs = Math.round(performance.now() - start);
      return res.status(200).json({
        success: true,
        data: templates,
        meta: {
          execution_time_ms: executionTimeMs,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  retrieveDetailedTemplate = async (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const { id } = res.locals.params;

      const template = await this.templateService.getTemplateById(id);
      if (!template) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: `Template with ID ${id} not found`,
          },
        });
      }

      const executionTimeMs = Math.round(performance.now() - start);
      return res.status(200).json({
        success: true,
        data: template,
        meta: {
          execution_time_ms: executionTimeMs,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const { id } = res.locals.params;

      const { name, selected_cards, widgets } = res.locals.body;
      const template = await this.templateService.updateTemplate(
        id,
        name,
        selected_cards,
        widgets,
      );

      if (!template) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: `Template with ID ${id} not found`,
          },
        });
      }

      const executionTimeMs = Math.round(performance.now() - start);
      return res.status(200).json({
        success: true,
        data: template,
        meta: {
          execution_time_ms: executionTimeMs,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  deleteTemplate = async (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    try {
      const { id } = res.locals.params;

      const deleted = await this.templateService.deleteTemplate(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: `Template with ID ${id} not found`,
          },
        });
      }

      const executionTimeMs = Math.round(performance.now() - start);
      return res.status(200).json({
        success: true,
        data: {
          message: 'Template and associated widgets deleted successfully',
        },
        meta: {
          execution_time_ms: executionTimeMs,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
