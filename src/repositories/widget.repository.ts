import pg from 'pg';
import { pgPool } from '../database/postgres/connection.js';
import { Preset } from './preset.repository.js';

export interface Widget {
  widget_id: number;
  template_id: number;
  device_id: string;
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
    deviceId: string,
    client?: pg.PoolClient,
  ): Promise<Widget> {
    const executor = this.getQueryExecutor(client);
    const query = `
      INSERT INTO Widget (template_id, device_id)
      VALUES ($1, $2)
      RETURNING widget_id, template_id, device_id, time_created, time_updated
    `;
    const res = await executor.query(query, [templateId, deviceId]);
    return res.rows[0];
  }

  async deleteWidgetsByTemplateId(templateId: number, client?: pg.PoolClient): Promise<number> {
    const executor = this.getQueryExecutor(client);
    const query = `
      DELETE FROM Widget
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
        w.device_id,
        w.time_created,
        w.time_updated,
        p.position,
        p.chart_type,
        p.status,
        p.severity,
        p.error_code,
        p.vendor_id,
        p.device_type
      FROM Widget w
      INNER JOIN Preset p ON w.device_id = p.device_id
      WHERE w.template_id = $1
      ORDER BY p.position ASC, w.widget_id ASC
    `;
    const res = await executor.query(query, [templateId]);
    return res.rows.map((row) => ({
      widget_id: row.widget_id,
      template_id: row.template_id,
      device_id: row.device_id,
      time_created: row.time_created,
      time_updated: row.time_updated,
      preset: {
        device_id: row.device_id,
        position: row.position,
        chart_type: row.chart_type,
        status: row.status,
        severity: row.severity,
        error_code: row.error_code,
        vendor_id: row.vendor_id,
        device_type: row.device_type,
      },
    }));
  }
}
