import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './database.config.js';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NetTrace Alarms Analytics API',
      version: '1.0.0',
      description: 'High-performance analytics APIs for NetTrace, powered by ClickHouse and PostgreSQL',
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development Server',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/routes/*.js', './dist/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
