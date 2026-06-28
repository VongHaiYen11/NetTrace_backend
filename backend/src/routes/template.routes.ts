import { Router } from 'express';
import {
  validateBodyGeneric,
  validateParamsGeneric,
  validateQueryGeneric,
} from '../middlewares/validator.middleware.js';
import { TemplateRepository } from '../repositories/template.repository.js';
import { PresetRepository } from '../repositories/preset.repository.js';
import { WidgetRepository } from '../repositories/widget.repository.js';
import { TemplateService } from '../services/template.service.js';
import { TemplateController } from '../controllers/template.controller.js';
import {
  createTemplateSchema,
  updateTemplateSchema,
  getTemplatesQuerySchema,
  getTemplateParamsSchema,
} from '../validators/template.validator.js';

const templateRepo = new TemplateRepository();
const presetRepo = new PresetRepository();
const widgetRepo = new WidgetRepository();
const templateService = new TemplateService(templateRepo, presetRepo, widgetRepo);
const templateController = new TemplateController(templateService);

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     WidgetInput:
 *       type: object
 *       required:
 *         - position
 *       properties:
 *         preset_id:
 *           type: integer
 *           nullable: true
 *           description: Existing reusable preset ID. If provided, no new preset is created.
 *           example: 42
 *         preset_name:
 *           type: string
 *           nullable: true
 *           example: "Critical router alarms"
 *         position:
 *           type: integer
 *           example: 1
 *         chart_type:
 *           type: string
 *           example: "line"
 *         start_date:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2026-06-01T00:00:00Z"
 *         end_date:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2026-06-30T00:00:00Z"
 *         metric:
 *           type: string
 *           nullable: true
 *           example: "count"
 *         group_by:
 *           type: string
 *           nullable: true
 *           example: "severity"
 *         time_bucket:
 *           type: string
 *           nullable: true
 *           example: "day"
 *         heatmap_mode:
 *           type: string
 *           nullable: true
 *           example: "weekday"
 *         table_columns:
 *           type: string
 *           nullable: true
 *           example: "alarm_id,severity,status"
 *     PresetResponse:
 *       type: object
 *       properties:
 *         preset_id:
 *           type: integer
 *           example: 42
 *         preset_name:
 *           type: string
 *           nullable: true
 *           example: "Critical router alarms"
 *         chart_type:
 *           type: string
 *           example: "line"
 *         metric:
 *           type: string
 *           nullable: true
 *         group_by:
 *           type: string
 *           nullable: true
 *         time_bucket:
 *           type: string
 *           nullable: true
 *         heatmap_mode:
 *           type: string
 *           nullable: true
 *         table_columns:
 *           type: string
 *           nullable: true
 *     TemplateWidget:
 *       type: object
 *       properties:
 *         widget_id:
 *           type: integer
 *           example: 1
 *         preset_id:
 *           type: integer
 *           example: 42
 *         position:
 *           type: integer
 *           example: 1
 *         start_date:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         end_date:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         time_created:
 *           type: string
 *           format: date-time
 *         time_updated:
 *           type: string
 *           format: date-time
 *         preset:
 *           $ref: '#/components/schemas/PresetResponse'
 *     TemplateResponse:
 *       type: object
 *       properties:
 *         template_id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: "My Dashboard Template"
 *         selected_cards:
 *           type: string
 *           nullable: true
 *           example: "[\"totalAlarms\"]"
 *         number_of_widgets:
 *           type: integer
 *           example: 1
 *         time_created:
 *           type: string
 *           format: date-time
 *         time_updated:
 *           type: string
 *           format: date-time
 *     DetailedTemplateResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/TemplateResponse'
 *         - type: object
 *           properties:
 *             widgets:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TemplateWidget'
 */

/**
 * @swagger
 * /api/v1/templates:
 *   post:
 *     summary: Create new Dashboard Template
 *     description: Creates a new dashboard layout template and links widget slots to presets in an atomic PostgreSQL transaction. Existing presets referenced by preset_id are reused.
 *     tags:
 *       - Templates
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "My Dashboard Template"
 *               selected_cards:
 *                 type: string
 *                 example: "[\"totalAlarms\"]"
 *               widgets:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/WidgetInput'
 *     responses:
 *       201:
 *         description: Template created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/TemplateResponse'
 *       400:
 *         description: Validation error.
 */
router.post('/', validateBodyGeneric(createTemplateSchema), templateController.createTemplate);

/**
 * @swagger
 * /api/v1/templates:
 *   get:
 *     summary: List dashboard templates
 *     description: Retrieves a paginated list of all created templates.
 *     tags:
 *       - Templates
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 20
 *         description: Number of templates to return.
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of templates to skip.
 *     responses:
 *       200:
 *         description: Successfully retrieved templates.
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
 *                     $ref: '#/components/schemas/TemplateResponse'
 */
router.get('/', validateQueryGeneric(getTemplatesQuerySchema), templateController.listTemplates);

/**
 * @swagger
 * /api/v1/templates/{id}:
 *   get:
 *     summary: Retrieve detailed dashboard template
 *     description: Fetches a template by ID along with its associated widgets and preset configurations.
 *     tags:
 *       - Templates
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Template ID.
 *     responses:
 *       200:
 *         description: Successfully retrieved template details.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/DetailedTemplateResponse'
 *       404:
 *         description: Template not found.
 */
router.get(
  '/:id',
  validateParamsGeneric(getTemplateParamsSchema),
  templateController.retrieveDetailedTemplate,
);

/**
 * @swagger
 * /api/v1/templates/{id}:
 *   put:
 *     summary: Update dashboard template
 *     description: Updates a template name, selected cards, and synchronizes widget links inside a PostgreSQL transaction. Existing presets referenced by preset_id are reused.
 *     tags:
 *       - Templates
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Template ID.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Template"
 *               selected_cards:
 *                 type: string
 *                 example: "[\"totalAlarms\"]"
 *               widgets:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/WidgetInput'
 *     responses:
 *       200:
 *         description: Template updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/TemplateResponse'
 *       404:
 *         description: Template not found.
 */
router.put(
  '/:id',
  validateParamsGeneric(getTemplateParamsSchema),
  validateBodyGeneric(updateTemplateSchema),
  templateController.updateTemplate,
);

/**
 * @swagger
 * /api/v1/templates/{id}:
 *   delete:
 *     summary: Delete dashboard template
 *     description: Deletes a template. Associated widget links are cascade-deleted by the FK constraint; preset rows remain reusable.
 *     tags:
 *       - Templates
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Template ID.
 *     responses:
 *       200:
 *         description: Template deleted successfully.
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
 *                     message:
 *                       type: string
 *                       example: "Template and associated widgets deleted successfully"
 *       404:
 *         description: Template not found.
 */
router.delete('/:id', validateParamsGeneric(getTemplateParamsSchema), templateController.deleteTemplate);

export default router;
