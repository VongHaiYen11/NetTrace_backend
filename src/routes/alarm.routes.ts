import { Router } from 'express';
import { validateQuery } from '../middlewares/validator.middleware.js';
import { DeviceRepository } from '../repositories/device.repository.js';
import { ErrorRepository } from '../repositories/error.repository.js';

// 1. Detail Query
import { QueryAlarmsSchema } from '../validators/query-alarms.validator.js';
import { QueryAlarmsRepository } from '../repositories/query-alarms.repository.js';
import { QueryAlarmsService } from '../services/query-alarms.service.js';
import { QueryAlarmsController } from '../controllers/query-alarms.controller.js';

// 2. TS Count
import { TimeSeriesCountSchema } from '../validators/time-series-count.validator.js';
import { TimeSeriesCountRepository } from '../repositories/time-series-count.repository.js';
import { TimeSeriesCountService } from '../services/time-series-count.service.js';
import { TimeSeriesCountController } from '../controllers/time-series-count.controller.js';

// 3. TS Duration
import { TimeSeriesDurationSchema } from '../validators/time-series-duration.validator.js';
import { TimeSeriesDurationRepository } from '../repositories/time-series-duration.repository.js';
import { TimeSeriesDurationService } from '../services/time-series-duration.service.js';
import { TimeSeriesDurationController } from '../controllers/time-series-duration.controller.js';

// 4. Top-N
import { TopNSchema } from '../validators/top-n-analytics.validator.js';
import { TopNAnalyticsRepository } from '../repositories/top-n-analytics.repository.js';
import { TopNAnalyticsService } from '../services/top-n-analytics.service.js';
import { TopNAnalyticsController } from '../controllers/top-n-analytics.controller.js';

// 5. Ratio
import { RatioSchema } from '../validators/ratio-analytics.validator.js';
import { RatioAnalyticsRepository } from '../repositories/ratio-analytics.repository.js';
import { RatioAnalyticsService } from '../services/ratio-analytics.service.js';
import { RatioAnalyticsController } from '../controllers/ratio-analytics.controller.js';

const deviceRepo = new DeviceRepository();
const errorRepo = new ErrorRepository();

// 1. Detail Query
const queryAlarmsRepo = new QueryAlarmsRepository();
const queryAlarmsService = new QueryAlarmsService(queryAlarmsRepo, deviceRepo, errorRepo);
const queryAlarmsController = new QueryAlarmsController(queryAlarmsService);

// 2. TS Count
const tsCountRepo = new TimeSeriesCountRepository();
const tsCountService = new TimeSeriesCountService(tsCountRepo);
const tsCountController = new TimeSeriesCountController(tsCountService);

// 3. TS Duration
const tsDurationRepo = new TimeSeriesDurationRepository();
const tsDurationService = new TimeSeriesDurationService(tsDurationRepo);
const tsDurationController = new TimeSeriesDurationController(tsDurationService);

// 4. Top-N
const topNRepo = new TopNAnalyticsRepository();
const topNService = new TopNAnalyticsService(topNRepo, deviceRepo, errorRepo);
const topNController = new TopNAnalyticsController(topNService);

// 5. Ratio
const ratioRepo = new RatioAnalyticsRepository();
const ratioService = new RatioAnalyticsService(ratioRepo, deviceRepo);
const ratioController = new RatioAnalyticsController(ratioService);

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     DeviceDetails:
 *       type: object
 *       properties:
 *         device_id:
 *           type: string
 *           example: "DEV001"
 *         name:
 *           type: string
 *           example: "Core Switch 01"
 *         vendor_id:
 *           type: string
 *           example: "VEND01"
 *         vendor_name:
 *           type: string
 *           example: "Cisco Systems"
 *         vendor_country:
 *           type: string
 *           example: "USA"
 *         station_id:
 *           type: string
 *           example: "STAT01"
 *         station_name:
 *           type: string
 *           example: "Hanoi Central Station"
 *         station_province:
 *           type: string
 *           example: "Hanoi"
 *         device_type:
 *           type: string
 *           example: "Switch"
 *         ip_address:
 *           type: string
 *           example: "192.168.1.1"
 *         longitude:
 *           type: number
 *           example: 105.8544
 *         latitude:
 *           type: number
 *           example: 21.0285
 *         additional_info:
 *           type: string
 *           nullable: true
 *           example: "Core switch on rack A4"
 *     ErrorDetails:
 *       type: object
 *       properties:
 *         error_code:
 *           type: string
 *           example: "ERR_LINK_DOWN"
 *         name:
 *           type: string
 *           example: "Link Down"
 *         description:
 *           type: string
 *           example: "Physical link connected to the port has gone down."
 *         domain:
 *           type: string
 *           example: "Network"
 *         default_severity:
 *           type: string
 *           example: "critical"
 *     Alarm:
 *       type: object
 *       properties:
 *         alarm_id:
 *           type: string
 *           example: "c4a7d6e8-0b2a-4a7b-8b2b-0c9a1b2c3d4e"
 *         error_code:
 *           type: string
 *           example: "ERR_LINK_DOWN"
 *         error_details:
 *           $ref: '#/components/schemas/ErrorDetails'
 *         device_id:
 *           type: string
 *           example: "DEV001"
 *         device_details:
 *           $ref: '#/components/schemas/DeviceDetails'
 *         time_created:
 *           type: string
 *           format: date-time
 *           example: "2026-06-14T08:00:00Z"
 *         time_solved:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *         status:
 *           type: string
 *           example: "active"
 *         severity:
 *           type: string
 *           example: "critical"
 *         raw_log:
 *           type: string
 *           example: "Link down detected on interface GigabitEthernet0/1"
 *         description:
 *           type: string
 *           example: "Interface GigabitEthernet0/1 state changed to down"
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: object
 *           properties:
 *             code:
 *               type: string
 *               example: "INVALID_TIME_RANGE"
 *             message:
 *               type: string
 *               example: "from_time must be earlier than to_time"
 */

/**
 * @swagger
 * /api/v1/alarms:
 *   get:
 *     summary: Query alarms
 *     description: Retrieve list of alarms with filtering, keyset pagination (no OFFSET), sorting, and PostgreSQL data federation.
 *     tags:
 *       - Alarms
 *     parameters:
 *       - in: query
 *         name: from_time
 *         schema:
 *           type: string
 *         description: Start time (ISO-8601). Defaults to 7 days before to_time.
 *       - in: query
 *         name: to_time
 *         schema:
 *           type: string
 *         description: End time (ISO-8601). Defaults to now.
 *       - in: query
 *         name: cursor_time
 *         schema:
 *           type: string
 *         description: Timestamp of the last record from the previous page for keyset pagination.
 *       - in: query
 *         name: cursor_id
 *         schema:
 *           type: string
 *         description: ID of the last record from the previous page for keyset pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           maximum: 1000
 *           default: 100
 *         description: Page limit. Maximum 1000.
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: device_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: error_code
 *         schema:
 *           type: string
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [timestamp, severity, status]
 *           default: timestamp
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Successful response.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Alarm'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                       example: 100
 *                     total:
 *                       type: integer
 *                       example: 1234
 *                     execution_time_ms:
 *                       type: integer
 *                       example: 120
 *       400:
 *         description: Validation or parameter constraints failed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       504:
 *         description: Database query timed out (SLA exceeded).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/alarms', validateQuery(QueryAlarmsSchema), queryAlarmsController.queryAlarms);

/**
 * @swagger
 * /api/v1/analytics/time-series/count:
 *   get:
 *     summary: Time Series count aggregation
 *     description: Retrieve alarm counts and active counts aggregated over specific time series intervals (hour, day).
 *     tags:
 *       - Analytics
 *     parameters:
 *       - in: query
 *         name: from_time
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: to_time
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [hour, day]
 *           default: hour
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: device_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       bucket:
 *                         type: string
 *                         example: "2026-06-14T08:00:00.000Z"
 *                       total_alarms:
 *                         type: integer
 *                         example: 250
 *                       active_alarms:
 *                         type: integer
 *                         example: 80
 *                 meta:
 *                   type: object
 *                   properties:
 *                     execution_time_ms:
 *                       type: integer
 *                       example: 45
 */
router.get(
  '/analytics/time-series/count',
  validateQuery(TimeSeriesCountSchema),
  tsCountController.getTimeSeriesCount,
);

/**
 * @swagger
 * /api/v1/analytics/time-series/duration:
 *   get:
 *     summary: Average resolution duration time series
 *     description: Retrieve average operational resolution duration of alarms in seconds over intervals (day, month, year).
 *     tags:
 *       - Analytics
 *     parameters:
 *       - in: query
 *         name: from_time
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: to_time
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [day, month, year]
 *           default: day
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: device_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       bucket:
 *                         type: string
 *                         example: "2026-06-14T00:00:00.000Z"
 *                       avg_duration_seconds:
 *                         type: number
 *                         example: 1240.45
 *                 meta:
 *                   type: object
 *                   properties:
 *                     execution_time_ms:
 *                       type: integer
 *                       example: 60
 */
router.get(
  '/analytics/time-series/duration',
  validateQuery(TimeSeriesDurationSchema),
  tsDurationController.getTimeSeriesDuration,
);

/**
 * @swagger
 * /api/v1/analytics/top-n:
 *   get:
 *     summary: Repeat Alarms Top-N Ranking
 *     description: Retrieve top-N ranking entities. Stitch station details for devices, or descriptions for error codes.
 *     tags:
 *       - Analytics
 *     parameters:
 *       - in: query
 *         name: from_time
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: to_time
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: by
 *         schema:
 *           type: string
 *           enum: [device, error_code]
 *           default: device
 *       - in: query
 *         name: n
 *         schema:
 *           type: integer
 *           maximum: 1000
 *           default: 10
 *     responses:
 *       200:
 *         description: Successful response.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       device_id:
 *                         type: string
 *                         example: "DEV001"
 *                       alarm_count:
 *                         type: integer
 *                         example: 850
 *                       label:
 *                         type: string
 *                         example: "Core Switch (Hanoi Station)"
 *                       device_details:
 *                         $ref: '#/components/schemas/DeviceDetails'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     execution_time_ms:
 *                       type: integer
 *                       example: 80
 */
router.get('/analytics/top-n', validateQuery(TopNSchema), topNController.getTopNAnalytics);

/**
 * @swagger
 * /api/v1/analytics/ratio:
 *   get:
 *     summary: Composition Ratio (Pie Chart)
 *     description: Retrieve ratio breakdown. Supports severity (native), device type, station, site (station_id), and region (station province).
 *     tags:
 *       - Analytics
 *     parameters:
 *       - in: query
 *         name: from_time
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: to_time
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: by
 *         schema:
 *           type: string
 *           enum: [severity, type, station, site, region]
 *           default: severity
 *     responses:
 *       200:
 *         description: Successful response.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       device_type:
 *                         type: string
 *                         example: "Switch"
 *                       count:
 *                         type: integer
 *                         example: 450
 *                       percentage:
 *                         type: number
 *                         example: 42.5
 *                 meta:
 *                   type: object
 *                   properties:
 *                     execution_time_ms:
 *                       type: integer
 *                       example: 90
 */
router.get('/analytics/ratio', validateQuery(RatioSchema), ratioController.getRatioAnalytics);

export default router;
