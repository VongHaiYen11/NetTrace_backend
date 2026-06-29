import pg from 'pg';
import { pgPool } from '../database/postgres/connection.js';

export interface Preset {
  preset_id?: number;
  preset_name?: string | null;
  chart_type: string;
  metric: string | null;
  group_by: string | null;
  time_bucket: string | null;
  heatmap_mode: string | null;
  table_columns: string | null;
  table_page_size?: number | null;
  table_record_limit?: number | null;
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
      INSERT INTO preset (preset_name, chart_type, metric, group_by, time_bucket, heatmap_mode, table_columns, table_page_size, table_record_limit)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING preset_id, preset_name, chart_type, metric, group_by, time_bucket, heatmap_mode, table_columns, table_page_size, table_record_limit
    `;
    const res = await executor.query(query, [
      preset.preset_name,
      preset.chart_type,
      preset.metric,
      preset.group_by,
      preset.time_bucket,
      preset.heatmap_mode,
      preset.table_columns,
      preset.table_page_size,
      preset.table_record_limit,
    ]);
    return res.rows[0];
  }

  async updatePreset(id: number, preset: Omit<Preset, 'preset_id'>, client?: pg.PoolClient): Promise<Preset | null> {
    const executor = this.getQueryExecutor(client);
    const query = `
      UPDATE preset
      SET preset_name = $2, chart_type = $3, metric = $4, group_by = $5, time_bucket = $6, heatmap_mode = $7, table_columns = $8, table_page_size = $9, table_record_limit = $10
      WHERE preset_id = $1
      RETURNING preset_id, preset_name, chart_type, metric, group_by, time_bucket, heatmap_mode, table_columns, table_page_size, table_record_limit
    `;
    const res = await executor.query(query, [
      id,
      preset.preset_name,
      preset.chart_type,
      preset.metric,
      preset.group_by,
      preset.time_bucket,
      preset.heatmap_mode,
      preset.table_columns,
      preset.table_page_size,
      preset.table_record_limit,
    ]);
    return res.rows[0] || null;
  }

  async getPresetById(id: number, client?: pg.PoolClient): Promise<Preset | null> {
    const executor = this.getQueryExecutor(client);
    const query = `
      SELECT preset_id, preset_name, chart_type, metric, group_by, time_bucket, heatmap_mode, table_columns, table_page_size, table_record_limit
      FROM preset
      WHERE preset_id = $1
    `;
    const res = await executor.query(query, [id]);
    return res.rows[0] || null;
  }

  async listPresets(limit: number, offset: number): Promise<Preset[]> {
    const query = `
      SELECT
        p.preset_id, p.preset_name, p.chart_type,
        p.metric, p.group_by, p.time_bucket, p.heatmap_mode, p.table_columns, p.table_page_size, p.table_record_limit,
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

  async findUsedPresetsByIds(ids: number[], client?: pg.PoolClient): Promise<Preset[]> {
    if (ids.length === 0) return [];
    const executor = this.getQueryExecutor(client);
    const query = `
      SELECT DISTINCT
        p.preset_id,
        p.preset_name,
        p.chart_type,
        p.metric,
        p.group_by,
        p.time_bucket,
        p.heatmap_mode,
        p.table_columns,
        p.table_page_size,
        p.table_record_limit,
        t.template_id,
        t.name AS template_name
      FROM preset p
      INNER JOIN widget w ON w.preset_id = p.preset_id
      INNER JOIN template t ON t.template_id = w.template_id
      WHERE p.preset_id = ANY($1)
      ORDER BY p.preset_id
    `;
    const res = await executor.query(query, [ids]);
    return res.rows;
  }
}
