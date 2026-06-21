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
    widgetsData: Omit<Preset, 'template_id'>[],
  ): Promise<Template> {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      // Create Template with initial widgets count of 0 (will be updated)
      const template = await this.templateRepo.createTemplate(
        name,
        selectedCards,
        widgetsData.length,
        client,
      );

      // Create Presets and Widgets
      for (const wData of widgetsData) {
        // Upsert Preset
        await this.presetRepo.upsertPreset(
          {
            device_id: wData.device_id,
            position: wData.position,
            chart_type: wData.chart_type,
            status: wData.status || null,
            severity: wData.severity || null,
            error_code: wData.error_code || null,
            vendor_id: wData.vendor_id || null,
            device_type: wData.device_type || null,
          },
          client,
        );

        // Create Widget
        await this.widgetRepo.createWidget(template.template_id, wData.device_id, client);
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
    widgetsData?: Omit<Preset, 'template_id'>[],
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
        // Delete all old widgets of this template
        await this.widgetRepo.deleteWidgetsByTemplateId(id, client);

        // Insert new presets and widgets
        for (const wData of widgetsData) {
          await this.presetRepo.upsertPreset(
            {
              device_id: wData.device_id,
              position: wData.position,
              chart_type: wData.chart_type,
              status: wData.status || null,
              severity: wData.severity || null,
              error_code: wData.error_code || null,
              vendor_id: wData.vendor_id || null,
              device_type: wData.device_type || null,
            },
            client,
          );

          await this.widgetRepo.createWidget(id, wData.device_id, client);
        }

        updates.number_of_widgets = widgetsData.length;
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
    return this.templateRepo.deleteTemplate(id);
  }
}
