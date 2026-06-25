import { Router } from 'express';
import { PresetController } from '../controllers/preset.controller.js';
import { validateBodyGeneric, validateQueryGeneric } from '../middlewares/validator.middleware.js';
import { PresetRepository } from '../repositories/preset.repository.js';
import { PresetService } from '../services/preset.service.js';
import { createPresetSchema, listPresetsQuerySchema } from '../validators/preset.validator.js';

const presetRepo = new PresetRepository();
const presetService = new PresetService(presetRepo);
const presetController = new PresetController(presetService);
const router = Router();

/**
 * @swagger
 * /api/v1/presets:
 *   get:
 *     summary: List reusable presets
 *     tags: [Presets]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 1000 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: Presets retrieved successfully }
 *   post:
 *     summary: Create an unassigned reusable preset
 *     tags: [Presets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [preset_name, chart_type]
 *             properties:
 *               preset_name:
 *                 type: string
 *                 example: "Critical router alarms"
 *               position:
 *                 type: integer
 *                 default: 0
 *               chart_type:
 *                 type: string
 *                 example: "line"
 *               start_date:
 *                 type: string
 *                 nullable: true
 *               end_date:
 *                 type: string
 *                 nullable: true
 *               status:
 *                 type: string
 *                 nullable: true
 *               severity:
 *                 type: string
 *                 nullable: true
 *               error_code:
 *                 type: string
 *                 nullable: true
 *               vendor:
 *                 type: string
 *                 nullable: true
 *               device_type:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201: { description: Preset created successfully }
 */
router.get('/', validateQueryGeneric(listPresetsQuerySchema), presetController.listPresets);
router.post('/', validateBodyGeneric(createPresetSchema), presetController.createPreset);

export default router;
