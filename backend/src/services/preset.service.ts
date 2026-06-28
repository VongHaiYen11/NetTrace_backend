import { Preset, PresetRepository } from '../repositories/preset.repository.js';
import { normalizePresetFieldsByChartType } from '../utils/preset-fields.js';

export class PresetService {
  constructor(private readonly presetRepo: PresetRepository) {}

  listPresets(limit: number, offset: number) {
    return this.presetRepo.listPresets(limit, offset);
  }

  createPreset(preset: Omit<Preset, 'preset_id'>) {
    return this.presetRepo.createPreset(normalizePresetFieldsByChartType(preset));
  }

  updatePreset(id: number, preset: Omit<Preset, 'preset_id'>) {
    return this.presetRepo.updatePreset(id, normalizePresetFieldsByChartType(preset));
  }

  async deletePresets(ids: number[]) {
    const usedPresets = await this.presetRepo.findUsedPresetsByIds(ids);
    if (usedPresets.length > 0) {
      const error = new Error('Preset is currently used by a template and cannot be deleted.') as Error & {
        statusCode?: number;
      };
      error.statusCode = 409;
      throw error;
    }

    return this.presetRepo.deletePresetsByIds(ids);
  }
}
