import { Router } from 'express';
import { validateQuery, validateQueryGeneric, validateBody } from '../middlewares/validator.middleware.js';
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
import { MetadataOptionsSchema } from '../validators/metadata-options.validator.js';
import { MetadataOptionsService } from '../services/metadata-options.service.js';
import { MetadataOptionsController } from '../controllers/metadata-options.controller.js';

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
const metadataOptionsService = new MetadataOptionsService(deviceRepo);
const metadataOptionsController = new MetadataOptionsController(metadataOptionsService);

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
 * /api/v1/metadata/options:
 *   get:
 *     summary: List metadata filter options
 *     description: Returns searchable device type, vendor, station, and province options from PostgreSQL metadata.
 *     tags:
 *       - Metadata
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 100
 *         description: Optional case-insensitive search text.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *         description: Optional maximum options returned per category. If omitted, all matching options are returned.
 *     responses:
 *       200:
 *         description: Metadata options.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     deviceTypes:
 *                       type: array
 *                       items:
 *                         type: string
 *                     vendors:
 *                       type: array
 *                       items:
 *                         type: string
 *                     stations:
 *                       type: array
 *                       items:
 *                         type: string
 *                     provinces:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.get(
  '/metadata/options',
  validateQueryGeneric(MetadataOptionsSchema),
  metadataOptionsController.getOptions,
);

/**
 * @swagger
 * /api/v1/alarms:
 *   get:
 *     summary: Query alarms
 *     description: Retrieve list of alarms with filtering, offset-based pagination, sorting, and PostgreSQL data federation.
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
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *           example: 0
 *         description: Pagination offset.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *           example: 100
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
 *         name: device_name
 *         schema:
 *           type: string
 *         description: Comma-separated device names resolved through PostgreSQL metadata.
 *       - in: query
 *         name: station_id
 *         schema:
 *           type: string
 *         description: Comma-separated station IDs resolved through PostgreSQL device metadata.
 *       - in: query
 *         name: error_code
 *         schema:
 *           type: string
 *         description: Comma-separated error codes.
 *       - in: query
 *         name: columns
 *         schema:
 *           type: string
 *           example: time_created,error_name,status,severity,device_name,description
 *         description: Comma-separated response columns. Metadata display columns automatically include the required IDs for enrichment.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 200
 *         description: Case-insensitive search text applied to one selected search_field across the full backend result set, not only the current page.
 *       - in: query
 *         name: search_field
 *         schema:
 *           type: string
 *           enum: [alarm_id, device_id, device_name, device_type, error_code, error_name, severity, status, description, raw_log]
 *           default: alarm_id
 *         description: Single field to search. device_name and error_name are resolved through PostgreSQL metadata before querying ClickHouse.
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
 *                     offset:
 *                       type: integer
 *                       example: 0
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
 *                 minimum: 1
 *                 default: 20
 *                 example: 20
 *     responses:
 *       200:
 *         description: Query executed successfully.
 */
router.post(
  '/analytics/query',
  validateBody(AnalyticsQuerySchema),
  analyticsQueryController.executeQuery,
);

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
 *     summary: Export alarms list
 *     description: Streams a full/filtered copy of alarm telemetry formatted as CSV, Excel, or JSON.
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
 *                 enum: [csv, xlsx, json]
 *                 example: "csv"
 *               columns:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["alarm_id", "severity"]
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
 *                   status:
 *                     type: array
 *                     items:
 *                       type: string
 *                   device_id:
 *                     type: array
 *                     items:
 *                       type: string
 *                   error_code:
 *                     type: array
 *                     items:
 *                       type: string
 *                   device_type:
 *                     type: array
 *                     items:
 *                       type: string
 *                   vendor:
 *                     type: array
 *                     items:
 *                       type: string
 *                   station:
 *                     type: array
 *                     items:
 *                       type: string
 *                   province:
 *                     type: array
 *                     items:
 *                       type: string
 *                   sort_by:
 *                     type: string
 *                     enum: [timestamp, severity, status]
 *                   sort_order:
 *                     type: string
 *                     enum: [asc, desc]
 *                   limit:
 *                     type: integer
 *                     minimum: 1
 *                     example: 100
 *     responses:
 *       200:
 *         description: Stream download in the requested format.
 */
router.post('/export', validateBody(ExportSchema), exportController.exportAlarms);

export default router;
