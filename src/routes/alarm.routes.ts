import { Router } from 'express';
import { validateQuery, validateBody } from '../middlewares/validator.middleware.js';
import { DeviceRepository } from '../repositories/device.repository.js';
import { ErrorRepository } from '../repositories/error.repository.js';

// 1. Detail Query
import { QueryAlarmsSchema } from '../validators/query-alarms.validator.js';
import { QueryAlarmsRepository } from '../repositories/query-alarms.repository.js';
import { QueryAlarmsService } from '../services/query-alarms.service.js';
import { QueryAlarmsController } from '../controllers/query-alarms.controller.js';

// 2. Summary
import { SummarySchema } from '../validators/summary.validator.js';
import { SummaryRepository } from '../repositories/summary.repository.js';
import { SummaryService } from '../services/summary.service.js';
import { SummaryController } from '../controllers/summary.controller.js';

// 3. Analytics Query
import { AnalyticsQuerySchema } from '../validators/analytics-query.validator.js';
import { AnalyticsQueryRepository } from '../repositories/analytics-query.repository.js';
import { AnalyticsQueryService } from '../services/analytics-query.service.js';
import { AnalyticsQueryController } from '../controllers/analytics-query.controller.js';

// 4. Heatmap
import { HeatmapSchema } from '../validators/heatmap.validator.js';
import { HeatmapRepository } from '../repositories/heatmap.repository.js';
import { HeatmapService } from '../services/heatmap.service.js';
import { HeatmapController } from '../controllers/heatmap.controller.js';

// 5. Export
import { ExportSchema } from '../validators/export.validator.js';
import { ExportService } from '../services/export.service.js';
import { ExportController } from '../controllers/export.controller.js';

const deviceRepo = new DeviceRepository();
const errorRepo = new ErrorRepository();

// 1. Detail Query
const queryAlarmsRepo = new QueryAlarmsRepository();
const queryAlarmsService = new QueryAlarmsService(queryAlarmsRepo, deviceRepo, errorRepo);
const queryAlarmsController = new QueryAlarmsController(queryAlarmsService);

// 2. Summary
const summaryRepo = new SummaryRepository();
const summaryService = new SummaryService(summaryRepo, deviceRepo);
const summaryController = new SummaryController(summaryService);

// 3. Analytics Query
const analyticsQueryRepo = new AnalyticsQueryRepository();
const analyticsQueryService = new AnalyticsQueryService(analyticsQueryRepo, deviceRepo);
const analyticsQueryController = new AnalyticsQueryController(analyticsQueryService);

// 4. Heatmap
const heatmapRepo = new HeatmapRepository();
const heatmapService = new HeatmapService(heatmapRepo, deviceRepo);
const heatmapController = new HeatmapController(heatmapService);

// 5. Export
const exportService = new ExportService(queryAlarmsRepo, deviceRepo, errorRepo);
const exportController = new ExportController(exportService);

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
 *         description: Comma-separated severities.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Comma-separated statuses.
 *       - in: query
 *         name: device_id
 *         schema:
 *           type: string
 *         description: Comma-separated device IDs.
 *       - in: query
 *         name: error_code
 *         schema:
 *           type: string
 *         description: Comma-separated error codes.
 *       - in: query
 *         name: device_type
 *         schema:
 *           type: string
 *         description: Comma-separated device types (Federated Postgres).
 *       - in: query
 *         name: vendor
 *         schema:
 *           type: string
 *         description: Comma-separated vendors (Federated Postgres).
 *       - in: query
 *         name: station
 *         schema:
 *           type: string
 *         description: Comma-separated stations (Federated Postgres).
 *       - in: query
 *         name: province
 *         schema:
 *           type: string
 *         description: Comma-separated provinces (Federated Postgres).
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
 * /api/v1/analytics/summary:
 *   get:
 *     summary: Retrieve operational summary KPIs
 *     description: Returns overall count aggregates for critical cards (total, active, closed, critical, affected devices).
 *     tags:
 *       - Analytics
 *     parameters:
 *       - in: query
 *         name: from_time
 *         schema:
 *           type: string
 *       - in: query
 *         name: to_time
 *         schema:
 *           type: string
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
 *         name: device_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: vendor
 *         schema:
 *           type: string
 *       - in: query
 *         name: station
 *         schema:
 *           type: string
 *       - in: query
 *         name: province
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
 *                   type: object
 *                   properties:
 *                     totalAlarms:
 *                       type: integer
 *                       example: 5400
 *                     activeAlarms:
 *                       type: integer
 *                       example: 120
 *                     closedAlarms:
 *                       type: integer
 *                       example: 5280
 *                     criticalAlarms:
 *                       type: integer
 *                       example: 45
 *                     affectedDevices:
 *                       type: integer
 *                       example: 12
 *                 meta:
 *                   type: object
 *                   properties:
 *                     execution_time_ms:
 *                       type: integer
 *                       example: 50
 */
router.get('/analytics/summary', validateQuery(SummarySchema), summaryController.getSummary);

/**
 * @swagger
 * /api/v1/analytics/query:
 *   post:
 *     summary: Dynamic Analytics Query
 *     description: Perform dynamic queries aggregating count, avg_duration, max_duration, and affected_devices.
 *     tags:
 *       - Analytics
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - metric
 *             properties:
 *               metric:
 *                 type: string
 *                 enum: [count, avg_duration, max_duration, affected_devices]
 *                 example: "count"
 *               group_by:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [severity, status, error_code, device, device_type, vendor, station, province]
 *                 example: ["severity"]
 *               time_bucket:
 *                 type: string
 *                 enum: [hour, day, week, month, year]
 *                 nullable: true
 *                 example: null
 *               filters:
 *                 type: object
 *                 properties:
 *                   from_time:
 *                     type: string
 *                   to_time:
 *                     type: string
 *                   severity:
 *                     type: array
 *                     items:
 *                       type: string
 *               limit:
 *                 type: integer
 *                 default: 20
 *     responses:
 *       200:
 *         description: Query executed successfully.
 */
router.post('/analytics/query', validateBody(AnalyticsQuerySchema), analyticsQueryController.executeQuery);

/**
 * @swagger
 * /api/v1/analytics/heatmap:
 *   post:
 *     summary: Heatmap Density Analysis
 *     description: Fetches heat distribution mapped by weekday (weekday index x hour) or calendar (day string x hour).
 *     tags:
 *       - Analytics
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mode
 *             properties:
 *               mode:
 *                 type: string
 *                 enum: [weekday, calendar]
 *                 example: "weekday"
 *               filters:
 *                 type: object
 *     responses:
 *       200:
 *         description: Heatmap data retrieved.
 */
router.post('/analytics/heatmap', validateBody(HeatmapSchema), heatmapController.getHeatmap);

/**
 * @swagger
 * /api/v1/export:
 *   post:
 *     summary: Export alarms list to Excel or CSV
 *     description: Streams a full/filtered copy of alarm telemetry formatted as comma-separated values or Excel spreadsheet.
 *     tags:
 *       - Export
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - format
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [csv, xlsx]
 *                 example: "csv"
 *               filters:
 *                 type: object
 *     responses:
 *       200:
 *         description: Stream download.
 */
router.post('/export', validateBody(ExportSchema), exportController.exportAlarms);

export default router;
