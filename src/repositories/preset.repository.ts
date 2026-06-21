import pg from 'pg';
import { pgPool } from '../database/postgres/connection.js';

export interface Preset {
  device_id: string;
  position: number;
  chart_type: string;
  status: string | null;
  severity: string | null;
  error_code: string | null;
  vendor_id: string | null;
  device_type: string | null;
}

export class PresetRepository {
  private getQueryExecutor(client?: pg.PoolClient) {
    return client || pgPool;
  }

  async upsertPreset(preset: Preset, client?: pg.PoolClient): Promise<Preset> {
    const executor = this.getQueryExecutor(client);
    const query = `
      INSERT INTO Preset (device_id, position, chart_type, status, severity, error_code, vendor_id, device_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (device_id) 
      DO UPDATE SET 
        position = EXCLUDED.position,
        chart_type = EXCLUDED.chart_type,
        status = EXCLUDED.status,
        severity = EXCLUDED.severity,
        error_code = EXCLUDED.error_code,
        vendor_id = EXCLUDED.vendor_id,
        device_type = EXCLUDED.device_type
      RETURNING device_id, position, chart_type, status, severity, error_code, vendor_id, device_type
    `;
    const res = await executor.query(query, [
      preset.device_id,
      preset.position,
      preset.chart_type,
      preset.status,
      preset.severity,
      preset.error_code,
      preset.vendor_id,
      preset.device_type,
    ]);
    return res.rows[0];
  }

  async getPresetByDeviceId(deviceId: string, client?: pg.PoolClient): Promise<Preset | null> {
    const executor = this.getQueryExecutor(client);
    const query = `
      SELECT device_id, position, chart_type, status, severity, error_code, vendor_id, device_type
      FROM Preset
      WHERE device_id = $1
    `;
    const res = await executor.query(query, [deviceId]);
    return res.rows[0] || null;
  }

  async deletePresetsByDeviceIds(deviceIds: string[], client?: pg.PoolClient): Promise<number> {
    if (deviceIds.length === 0) return 0;
    const executor = this.getQueryExecutor(client);
    const query = `
      DELETE FROM Preset
      WHERE device_id = ANY($1)
    `;
    const res = await executor.query(query, [deviceIds]);
    return res.rowCount ?? 0;
  }
}
