import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { validateTimeRange } from '../validators/shared.js';

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Zod schema validation
      const parsed = schema.parse(req.query);

      // 2. Custom time window validation (mandatory for all ClickHouse queries)
      const timeValidation = validateTimeRange(parsed.from_time, parsed.to_time);
      if (!timeValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: timeValidation.code || 'INVALID_TIME_RANGE',
            message: timeValidation.message || 'Invalid time range',
          },
        });
      }

      // 3. Attach parsed parameters and actual Date objects to res.locals for controllers to consume
      res.locals.query = {
        ...parsed,
        from_time: timeValidation.from,
        to_time: timeValidation.to,
      };

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        const field = issue.path.join('.');
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Field '${field}': ${issue.message}`,
          },
        });
      }
      next(error);
    }
  };
};

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Zod schema validation on req.body
      const parsed = schema.parse(req.body);

      // 2. Custom time window validation from nested filters
      const filters = parsed.filters || {};
      const timeValidation = validateTimeRange(filters.from_time, filters.to_time);
      if (!timeValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: timeValidation.code || 'INVALID_TIME_RANGE',
            message: timeValidation.message || 'Invalid time range',
          },
        });
      }

      // 3. Attach parsed parameters and actual Date objects to res.locals for controllers to consume
      res.locals.query = {
        ...parsed,
        filters: {
          ...filters,
          from_time: timeValidation.from,
          to_time: timeValidation.to,
        },
      };

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        const field = issue.path.join('.');
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Field '${field}': ${issue.message}`,
          },
        });
      }
      next(error);
    }
  };
};

export const validateBodyGeneric = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.body);
      res.locals.body = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        const field = issue.path.join('.');
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Field '${field}': ${issue.message}`,
          },
        });
      }
      next(error);
    }
  };
};

export const validateQueryGeneric = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.query);
      res.locals.query = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        const field = issue.path.join('.');
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Field '${field}': ${issue.message}`,
          },
        });
      }
      next(error);
    }
  };
};

export const validateParamsGeneric = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.params);
      res.locals.params = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        const field = issue.path.join('.');
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Field '${field}': ${issue.message}`,
          },
        });
      }
      next(error);
    }
  };
};
