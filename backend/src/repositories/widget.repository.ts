import pg from 'pg';
import { pgPool } from '../database/postgres/connection.js';
import { Preset } from './preset.repository.js';

export interface Widget {
  widget_id: number;
  template_id: number;
  preset_id: number;
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
    client?: pg.PoolClient,
  ): Promise<Widget> {
    const executor = this.getQueryExecutor(client);
    const query = `
      INSERT INTO widget (template_id, preset_id)
      VALUES ($1, $2)
      RETURNING widget_id, template_id, preset_id, time_created, time_updated
    `;
    const res = await executor.query(query, [templateId, presetId]);
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
        w.time_created,
        w.time_updated,
        p.preset_name,
        p.position,
        p.chart_type,
        p.start_date,
        p.end_date,
        p.status,
        p.severity,
        p.error_code,
        p.vendor,
        p.device_type
      FROM widget w
      INNER JOIN preset p ON w.preset_id = p.preset_id
      WHERE w.template_id = $1
      ORDER BY p.position ASC, w.widget_id ASC
    `;
    const res = await executor.query(query, [templateId]);
    return res.rows.map((row) => ({
      widget_id: row.widget_id,
      template_id: row.template_id,
      preset_id: row.preset_id,
      time_created: row.time_created,
      time_updated: row.time_updated,
      preset: {
        preset_id: row.preset_id,
        preset_name: row.preset_name,
        position: row.position,
        chart_type: row.chart_type,
        start_date: row.start_date,
        end_date: row.end_date,
        status: row.status,
        severity: row.severity,
        error_code: row.error_code,
        vendor: row.vendor,
        device_type: row.device_type,
      },
    }));
  }
}
