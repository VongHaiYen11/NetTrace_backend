import pg from 'pg';
import { pgPool } from '../database/postgres/connection.js';
import { Preset } from './preset.repository.js';

export interface Widget {
  widget_id: number;
  template_id: number;
  preset_id: number;
  position: number;
  start_date: Date | string | null;
  end_date: Date | string | null;
  time_created: Date;
  time_updated: Date;
}

export interface WidgetWithPreset extends Widget {
  preset: Preset;
}

export class WidgetRepository {
  private getQueryExecutor(client?: pg.PoolClient) {
    return client || pgPool;
  }

  async createWidget(
    templateId: number,
    presetId: number,
    position: number,
    startDate: Date | string | null | undefined,
    endDate: Date | string | null | undefined,
    client?: pg.PoolClient,
  ): Promise<Widget> {
    const executor = this.getQueryExecutor(client);
    const query = `
      INSERT INTO widget (template_id, preset_id, position, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING widget_id, template_id, preset_id, position, start_date, end_date, time_created, time_updated
    `;
    const res = await executor.query(query, [
      templateId,
      presetId,
      position,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null,
    ]);
    return res.rows[0];
  }

  async deleteWidgetsByTemplateId(templateId: number, client?: pg.PoolClient): Promise<number> {
    const executor = this.getQueryExecutor(client);
    const query = `
      DELETE FROM widget
      WHERE template_id = $1
    `;
    const res = await executor.query(query, [templateId]);
    return res.rowCount ?? 0;
  }

  async getWidgetsWithPresetsByTemplateId(
    templateId: number,
    client?: pg.PoolClient,
  ): Promise<WidgetWithPreset[]> {
    const executor = this.getQueryExecutor(client);
    const query = `
      SELECT
        w.widget_id,
        w.template_id,
        w.preset_id,
        w.position,
        w.start_date,
        w.end_date,
        w.time_created,
        w.time_updated,
        p.preset_name,
        p.chart_type,
        p.metric,
        p.group_by,
        p.time_bucket,
        p.heatmap_mode,
        p.table_columns,
        p.table_page_size,
        p.table_record_limit
      FROM widget w
      INNER JOIN preset p ON w.preset_id = p.preset_id
      WHERE w.template_id = $1
      ORDER BY w.position ASC, w.widget_id ASC
    `;
    const res = await executor.query(query, [templateId]);
    return res.rows.map((row) => ({
      widget_id: row.widget_id,
      template_id: row.template_id,
      preset_id: row.preset_id,
      position: row.position,
      start_date: row.start_date,
      end_date: row.end_date,
      time_created: row.time_created,
      time_updated: row.time_updated,
      preset: {
        preset_id: row.preset_id,
        preset_name: row.preset_name,
        chart_type: row.chart_type,
        metric: row.metric,
        group_by: row.group_by,
        time_bucket: row.time_bucket,
        heatmap_mode: row.heatmap_mode,
        table_columns: row.table_columns,
        table_page_size: row.table_page_size,
        table_record_limit: row.table_record_limit,
      },
    }));
  }
}
