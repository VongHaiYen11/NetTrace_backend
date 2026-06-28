import { Router } from 'express';
import { PresetController } from '../controllers/preset.controller.js';
import { validateBodyGeneric, validateQueryGeneric } from '../middlewares/validator.middleware.js';
import { PresetRepository } from '../repositories/preset.repository.js';
import { PresetService } from '../services/preset.service.js';
import { createPresetSchema, listPresetsQuerySchema, updatePresetSchema, deletePresetsSchema } from '../validators/preset.validator.js';

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
 *               chart_type:
 *                 type: string
 *                 example: "line"
 *               metric:
 *                 type: string
 *                 nullable: true
 *               group_by:
 *                 type: string
 *                 nullable: true
 *               time_bucket:
 *                 type: string
 *                 nullable: true
 *               heatmap_mode:
 *                 type: string
 *                 nullable: true
 *               table_columns:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201: { description: Preset created successfully }
 *   put:
 *     summary: Update an existing preset
 *     tags: [Presets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
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
 *               chart_type:
 *                 type: string
 *               metric:
 *                 type: string
 *                 nullable: true
 *               group_by:
 *                 type: string
 *                 nullable: true
 *               time_bucket:
 *                 type: string
 *                 nullable: true
 *               heatmap_mode:
 *                 type: string
 *                 nullable: true
 *               table_columns:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200: { description: Preset updated successfully }
 *       404: { description: Preset not found }
 *   delete:
 *     summary: Bulk delete presets
 *     tags: [Presets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200: { description: Presets deleted successfully }
 */
router.get('/', validateQueryGeneric(listPresetsQuerySchema), presetController.listPresets);
router.post('/', validateBodyGeneric(createPresetSchema), presetController.createPreset);
router.put('/:id', validateBodyGeneric(updatePresetSchema), presetController.updatePreset);
router.delete('/', validateBodyGeneric(deletePresetsSchema), presetController.deletePresets);

export default router;
