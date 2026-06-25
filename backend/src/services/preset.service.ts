import { Preset, PresetRepository } from '../repositories/preset.repository.js';

export class PresetService {
  constructor(private readonly presetRepo: PresetRepository) {}

  listPresets(limit: number, offset: number) {
    return this.presetRepo.listPresets(limit, offset);
  }

  createPreset(preset: Omit<Preset, 'preset_id'>) {
    return this.presetRepo.createPreset(preset);
  }

  updatePreset(id: number, preset: Omit<Preset, 'preset_id'>) {
    return this.presetRepo.updatePreset(id, preset);
  }

  deletePresets(ids: number[]) {
    return this.presetRepo.deletePresetsByIds(ids);
  }
}
