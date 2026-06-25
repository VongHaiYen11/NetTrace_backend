import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './configs/swagger.config.js';
import alarmRoutes from './routes/alarm.routes.js';
import templateRoutes from './routes/template.routes.js';
import presetRoutes from './routes/preset.routes.js';
import { loggingMiddleware } from './middlewares/logging.middleware.js';
import { errorMiddleware } from './middlewares/error.middleware.js';

const app = express();

// 1. Pino logging middleware (instruments execution duration and metrics)
app.use(loggingMiddleware);

// 2. Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. API Swagger documentation UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 4. API Endpoints
app.use('/api/v1', alarmRoutes);
app.use('/api/v1/templates', templateRoutes);
app.use('/api/v1/presets', presetRoutes);

// 5. Catch-all for unhandled routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
    },
  });
});

// 6. Global error handler (handles validation and db timeout HTTP translations)
app.use(errorMiddleware);

export default app;
