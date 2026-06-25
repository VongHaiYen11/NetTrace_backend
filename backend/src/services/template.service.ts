import pg from 'pg';
import { pgPool } from '../database/postgres/connection.js';
import { TemplateRepository, Template } from '../repositories/template.repository.js';
import { PresetRepository, Preset } from '../repositories/preset.repository.js';
import { WidgetRepository, WidgetWithPreset } from '../repositories/widget.repository.js';

export interface DetailedTemplate extends Template {
  widgets: WidgetWithPreset[];
}

export class TemplateService {
  constructor(
    private templateRepo: TemplateRepository,
    private presetRepo: PresetRepository,
    private widgetRepo: WidgetRepository,
  ) {}

  async createTemplate(
    name: string,
    selectedCards: string | null,
    widgetsData: Omit<Preset, 'preset_id'>[],
  ): Promise<Template> {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      // Create Template with initial widgets count
      const template = await this.templateRepo.createTemplate(
        name,
        selectedCards,
        widgetsData.length,
        client,
      );

      // Create Presets and Widgets
      for (const wData of widgetsData) {
        // Insert Preset
        const preset = await this.presetRepo.createPreset(
          {
            preset_name: wData.preset_name || null,
            position: wData.position,
            chart_type: wData.chart_type,
            start_date: wData.start_date || null,
            end_date: wData.end_date || null,
            status: wData.status || null,
            severity: wData.severity || null,
            error_code: wData.error_code || null,
            vendor: wData.vendor || null,
            device_type: wData.device_type || null,
          },
          client,
        );

        // Create Widget linking template and preset
        await this.widgetRepo.createWidget(template.template_id, preset.preset_id!, client);
      }

      await client.query('COMMIT');
      return template;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listTemplates(limit: number, offset: number): Promise<Template[]> {
    return this.templateRepo.listTemplates(limit, offset);
  }

  async getTemplateById(id: number): Promise<DetailedTemplate | null> {
    const template = await this.templateRepo.getTemplateById(id);
    if (!template) {
      return null;
    }

    const widgets = await this.widgetRepo.getWidgetsWithPresetsByTemplateId(id);
    return {
      ...template,
      widgets,
    };
  }

  async updateTemplate(
    id: number,
    name?: string,
    selectedCards?: string | null,
    widgetsData?: Omit<Preset, 'preset_id'>[],
  ): Promise<Template | null> {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      // Check if template exists first
      const existing = await this.templateRepo.getTemplateById(id, client);
      if (!existing) {
        await client.query('ROLLBACK');
        return null;
      }

      const updates: { name?: string; selected_cards?: string | null; number_of_widgets?: number } =
        {};
      if (name !== undefined) updates.name = name;
      if (selectedCards !== undefined) updates.selected_cards = selectedCards;

      if (widgetsData !== undefined) {
        // Query old widgets of this template to find their preset_ids
        const oldWidgets = await this.widgetRepo.getWidgetsWithPresetsByTemplateId(id, client);
        const oldPresetIds = oldWidgets.map((w) => w.preset_id);

        // Delete old presets (widget rows cascade-deleted via FK ON DELETE CASCADE)
        if (oldPresetIds.length > 0) {
          await this.presetRepo.deletePresetsByIds(oldPresetIds, client);
        }

        // Insert new presets and widgets. The persisted counter must reflect
        // the widget links actually recreated by this transaction.
        let persistedWidgetCount = 0;
        for (const wData of widgetsData) {
          const preset = await this.presetRepo.createPreset(
            {
              preset_name: wData.preset_name || null,
              position: wData.position,
              chart_type: wData.chart_type,
              start_date: wData.start_date || null,
              end_date: wData.end_date || null,
              status: wData.status || null,
              severity: wData.severity || null,
              error_code: wData.error_code || null,
              vendor: wData.vendor || null,
              device_type: wData.device_type || null,
            },
            client,
          );

          await this.widgetRepo.createWidget(id, preset.preset_id!, client);
          persistedWidgetCount += 1;
        }

        updates.number_of_widgets = persistedWidgetCount;
      }

      const updated = await this.templateRepo.updateTemplate(id, updates, client);
      await client.query('COMMIT');
      return updated;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteTemplate(id: number): Promise<boolean> {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const widgets = await this.widgetRepo.getWidgetsWithPresetsByTemplateId(id, client);
      const presetIds = widgets.map((w) => w.preset_id);
      if (presetIds.length > 0) {
        await this.presetRepo.deletePresetsByIds(presetIds, client);
      }
      const success = await this.templateRepo.deleteTemplate(id, client);
      await client.query('COMMIT');
      return success;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
