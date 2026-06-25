import pg from 'pg';
import { pgPool } from '../database/postgres/connection.js';

export interface Preset {
  preset_id?: number;
  preset_name?: string | null;
  position: number;
  chart_type: string;
  start_date: Date | string | null;
  end_date: Date | string | null;
  status: string | null;
  severity: string | null;
  error_code: string | null;
  vendor: string | null;
  device_type: string | null;
  template_id?: number | null;
  template_name?: string | null;
}

export class PresetRepository {
  private getQueryExecutor(client?: pg.PoolClient) {
    return client || pgPool;
  }

  async createPreset(preset: Omit<Preset, 'preset_id'>, client?: pg.PoolClient): Promise<Preset> {
    const executor = this.getQueryExecutor(client);
    const query = `
      INSERT INTO preset (preset_name, position, chart_type, start_date, end_date, status, severity, error_code, vendor, device_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING preset_id, preset_name, position, chart_type, start_date, end_date, status, severity, error_code, vendor, device_type
    `;
    const res = await executor.query(query, [
      preset.preset_name,
      preset.position,
      preset.chart_type,
      preset.start_date ? new Date(preset.start_date) : null,
      preset.end_date ? new Date(preset.end_date) : null,
      preset.status,
      preset.severity,
      preset.error_code,
      preset.vendor,
      preset.device_type,
    ]);
    return res.rows[0];
  }

  async updatePreset(id: number, preset: Omit<Preset, 'preset_id'>, client?: pg.PoolClient): Promise<Preset | null> {
    const executor = this.getQueryExecutor(client);
    const query = `
      UPDATE preset
      SET preset_name = $2, position = $3, chart_type = $4, start_date = $5, end_date = $6, status = $7, severity = $8, error_code = $9, vendor = $10, device_type = $11
      WHERE preset_id = $1
      RETURNING preset_id, preset_name, position, chart_type, start_date, end_date, status, severity, error_code, vendor, device_type
    `;
    const res = await executor.query(query, [
      id,
      preset.preset_name,
      preset.position,
      preset.chart_type,
      preset.start_date ? new Date(preset.start_date) : null,
      preset.end_date ? new Date(preset.end_date) : null,
      preset.status,
      preset.severity,
      preset.error_code,
      preset.vendor,
      preset.device_type,
    ]);
    return res.rows[0] || null;
  }

  async getPresetById(id: number, client?: pg.PoolClient): Promise<Preset | null> {
    const executor = this.getQueryExecutor(client);
    const query = `
      SELECT preset_id, preset_name, position, chart_type, start_date, end_date, status, severity, error_code, vendor, device_type
      FROM preset
      WHERE preset_id = $1
    `;
    const res = await executor.query(query, [id]);
    return res.rows[0] || null;
  }

  async listPresets(limit: number, offset: number): Promise<Preset[]> {
    const query = `
      SELECT
        p.preset_id, p.preset_name, p.position, p.chart_type, p.start_date, p.end_date,
        p.status, p.severity, p.error_code, p.vendor, p.device_type,
        (
          SELECT t.template_id
          FROM widget w
          INNER JOIN template t ON t.template_id = w.template_id
          WHERE w.preset_id = p.preset_id
          ORDER BY t.template_id
          LIMIT 1
        ) AS template_id,
        (
          SELECT t.name
          FROM widget w
          INNER JOIN template t ON t.template_id = w.template_id
          WHERE w.preset_id = p.preset_id
          ORDER BY t.template_id
          LIMIT 1
        ) AS template_name
      FROM preset p
      ORDER BY p.preset_id DESC
      LIMIT $1 OFFSET $2
    `;
    const res = await pgPool.query(query, [limit, offset]);
    return res.rows;
  }

  async deletePresetsByIds(ids: number[], client?: pg.PoolClient): Promise<number> {
    if (ids.length === 0) return 0;
    const executor = this.getQueryExecutor(client);
    const query = `
      DELETE FROM preset
      WHERE preset_id = ANY($1)
    `;
    const res = await executor.query(query, [ids]);
    return res.rowCount ?? 0;
  }
}
