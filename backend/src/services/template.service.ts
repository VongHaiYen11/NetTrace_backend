import pg from 'pg';
import { pgPool } from '../database/postgres/connection.js';
import { TemplateRepository, Template } from '../repositories/template.repository.js';
import { PresetRepository, Preset } from '../repositories/preset.repository.js';
import { WidgetRepository, WidgetWithPreset } from '../repositories/widget.repository.js';
import { normalizePresetFieldsByChartType } from '../utils/preset-fields.js';

export interface DetailedTemplate extends Template {
  widgets: WidgetWithPreset[];
}

type TemplateWidgetInput = Partial<Omit<Preset, 'preset_id'>> & {
  preset_id?: number;
  position: number;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
};

export class TemplateService {
  constructor(
    private templateRepo: TemplateRepository,
    private presetRepo: PresetRepository,
    private widgetRepo: WidgetRepository,
  ) {}

  async createTemplate(
    name: string,
    selectedCards: string | null,
    widgetsData: TemplateWidgetInput[],
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

      // Create new presets only when needed, then link widgets by position.
      for (const wData of widgetsData) {
        const presetId = await this.resolvePresetId(wData, client);
        await this.widgetRepo.createWidget(
          template.template_id,
          presetId,
          wData.position,
          wData.start_date,
          wData.end_date,
          client,
        );
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
    widgetsData?: TemplateWidgetInput[],
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
        await this.widgetRepo.deleteWidgetsByTemplateId(id, client);

        // Insert new presets and widgets. The persisted counter must reflect
        // the widget links actually recreated by this transaction.
        let persistedWidgetCount = 0;
        for (const wData of widgetsData) {
          const presetId = await this.resolvePresetId(wData, client);
          await this.widgetRepo.createWidget(
            id,
            presetId,
            wData.position,
            wData.start_date,
            wData.end_date,
            client,
          );
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

  private async resolvePresetId(wData: TemplateWidgetInput, client: pg.PoolClient): Promise<number> {
    if (wData.preset_id) {
      const existing = await this.presetRepo.getPresetById(wData.preset_id, client);
      if (!existing?.preset_id) {
        throw new Error(`Preset ${wData.preset_id} not found`);
      }
      return existing.preset_id;
    }

    const preset = await this.presetRepo.createPreset(
      normalizePresetFieldsByChartType({
        preset_name: wData.preset_name || null,
        chart_type: wData.chart_type || 'line',
        metric: wData.metric || null,
        group_by: wData.group_by || null,
        time_bucket: wData.time_bucket || null,
        heatmap_mode: wData.heatmap_mode || null,
        table_columns: wData.table_columns || null,
      }),
      client,
    );

    if (!preset.preset_id) {
      throw new Error('Failed to create preset for template widget');
    }
    return preset.preset_id;
  }
}
