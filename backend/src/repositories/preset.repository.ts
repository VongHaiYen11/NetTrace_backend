import pg from 'pg';
import { pgPool } from '../database/postgres/connection.js';

export interface Preset {
  preset_id?: number;
  position: number;
  chart_type: string;
  start_date: Date | string | null;
  end_date: Date | string | null;
  status: string | null;
  severity: string | null;
  error_code: string | null;
  vendor: string | null;
  device_type: string | null;
}

export class PresetRepository {
  private getQueryExecutor(client?: pg.PoolClient) {
    return client || pgPool;
  }

  async createPreset(preset: Omit<Preset, 'preset_id'>, client?: pg.PoolClient): Promise<Preset> {
    const executor = this.getQueryExecutor(client);
    const query = `
      INSERT INTO preset (position, chart_type, start_date, end_date, status, severity, error_code, vendor, device_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING preset_id, position, chart_type, start_date, end_date, status, severity, error_code, vendor, device_type
    `;
    const res = await executor.query(query, [
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

  async getPresetById(id: number, client?: pg.PoolClient): Promise<Preset | null> {
    const executor = this.getQueryExecutor(client);
    const query = `
      SELECT preset_id, position, chart_type, start_date, end_date, status, severity, error_code, vendor, device_type
      FROM preset
      WHERE preset_id = $1
    `;
    const res = await executor.query(query, [id]);
    return res.rows[0] || null;
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
