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
 *         - device_id
 *         - position
 *         - chart_type
 *       properties:
 *         device_id:
 *           type: string
 *           example: "DEV001"
 *         position:
 *           type: integer
 *           example: 1
 *         chart_type:
 *           type: string
 *           example: "line"
 *         status:
 *           type: string
 *           nullable: true
 *           example: "active"
 *         severity:
 *           type: string
 *           nullable: true
 *           example: "critical"
 *         error_code:
 *           type: string
 *           nullable: true
 *           example: "ERR001"
 *         vendor_id:
 *           type: string
 *           nullable: true
 *           example: "VEND01"
 *         device_type:
 *           type: string
 *           nullable: true
 *           example: "router"
 *     TemplateWidget:
 *       type: object
 *       properties:
 *         widget_id:
 *           type: integer
 *           example: 1
 *         device_id:
 *           type: string
 *           example: "DEV001"
 *         time_created:
 *           type: string
 *           format: date-time
 *         time_updated:
 *           type: string
 *           format: date-time
 *         preset:
 *           type: object
 *           properties:
 *             device_id:
 *               type: string
 *               example: "DEV001"
 *             position:
 *               type: integer
 *               example: 1
 *             chart_type:
 *               type: string
 *               example: "line"
 *             status:
 *               type: string
 *               nullable: true
 *             severity:
 *               type: string
 *               nullable: true
 *             error_code:
 *               type: string
 *               nullable: true
 *             vendor_id:
 *               type: string
 *               nullable: true
 *             device_type:
 *               type: string
 *               nullable: true
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
 *     description: Creates a new dashboard layout template along with widgets and configurations in an atomic transaction.
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
 *     description: Fetches a template by ID along with its associated widgets and configuration presets.
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
 *     description: Updates a template name, selected cards, and synchronizes its widgets (creation/update/deletion) inside a transaction.
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
 *     description: Deletes a template and its associated widgets.
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
 *       404:
 *         description: Template not found.
 */
router.delete('/:id', validateParamsGeneric(getTemplateParamsSchema), templateController.deleteTemplate);

export default router;
