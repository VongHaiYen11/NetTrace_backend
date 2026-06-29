import { executePgQuery } from '../database/postgres/connection.js';

export interface DeviceMetadata {
  device_id: string;
  name: string;
  vendor_id: string | null;
  vendor_name: string | null;
  vendor_country: string | null;
  station_id: string | null;
  station_name: string | null;
  station_province: string | null;
  device_type: string | null;
  ip_address: string | null;
  longitude: number | null;
  latitude: number | null;
  additional_info: string | null;
}

export interface DeviceFilterOptions {
  deviceTypes: string[];
  vendors: string[];
  stations: string[];
  provinces: string[];
}

export class DeviceRepository {
  /**
   * Fetches metadata for a list of device IDs from PostgreSQL,
   * joining vendor and station details.
   */
  async getDevicesByIds(ids: string[]): Promise<{ devices: DeviceMetadata[]; durationMs: number }> {
    if (ids.length === 0) {
      return { devices: [], durationMs: 0 };
    }

    const query = `
      SELECT 
        d.device_id,
        d.name,
        d.vendor_id,
        v.name as vendor_name,
        v.country as vendor_country,
        d.station_id,
        s.name as station_name,
        s.province as station_province,
        d.device_type,
        d.ip_address,
        d.longitude,
        d.latitude,
        d.additional_info
      FROM device d
      LEFT JOIN vendor v ON d.vendor_id = v.vendor_id
      LEFT JOIN station s ON d.station_id = s.station_id
      WHERE LOWER(d.device_id) = ANY($1)
    `;

    const { rows, durationMs } = await executePgQuery<DeviceMetadata>(query, [
      ids.map((id) => id.toLowerCase()),
    ]);
    return { devices: rows, durationMs };
  }

  /**
   * Fetches distinct device IDs matching metadata filters.
   */
  async getDeviceIdsByFilters(filters: {
    device_name?: string[];
    device_type?: string[];
    vendor?: string[];
    station?: string[];
    station_id?: string[];
    province?: string[];
  }): Promise<{ deviceIds: string[]; durationMs: number }> {
    const conditions: string[] = [];
    const joins: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.device_name && filters.device_name.length > 0) {
      conditions.push(`LOWER(d.name) = ANY($${paramIndex++})`);
      params.push(filters.device_name.map((s) => s.toLowerCase()));
    }
    if (filters.device_type && filters.device_type.length > 0) {
      conditions.push(`LOWER(d.device_type) = ANY($${paramIndex++})`);
      params.push(filters.device_type.map((s) => s.toLowerCase()));
    }
    if (filters.vendor && filters.vendor.length > 0) {
      joins.push('INNER JOIN vendor v ON d.vendor_id = v.vendor_id');
      conditions.push(`LOWER(v.name) = ANY($${paramIndex++})`);
      params.push(filters.vendor.map((s) => s.toLowerCase()));
    }
    if (filters.station_id && filters.station_id.length > 0) {
      conditions.push(`LOWER(d.station_id) = ANY($${paramIndex++})`);
      params.push(filters.station_id.map((s) => s.toLowerCase()));
    }

    const needsStation =
      (filters.station && filters.station.length > 0) ||
      (filters.province && filters.province.length > 0);

    if (needsStation) {
      joins.push('INNER JOIN station s ON d.station_id = s.station_id');
      if (filters.station && filters.station.length > 0) {
        conditions.push(`LOWER(s.name) = ANY($${paramIndex++})`);
        params.push(filters.station.map((s) => s.toLowerCase()));
      }
      if (filters.province && filters.province.length > 0) {
        conditions.push(`LOWER(s.province) = ANY($${paramIndex++})`);
        params.push(filters.province.map((s) => s.toLowerCase()));
      }
    }

    if (conditions.length === 0) {
      return { deviceIds: [], durationMs: 0 };
    }

    const query = `
      SELECT DISTINCT d.device_id
      FROM device d
      ${joins.join('\n      ')}
      WHERE ${conditions.join(' AND ')}
    `;

    const { rows, durationMs } = await executePgQuery<{ device_id: string }>(query, params);
    return {
      deviceIds: rows.map((r) => r.device_id),
      durationMs,
    };
  }

  async getDeviceIdsBySearch(params: {
    field: 'device_name' | 'device_type';
    search: string;
  }): Promise<{ deviceIds: string[]; durationMs: number }> {
    const columnMap = {
      device_name: 'd.name',
      device_type: 'd.device_type',
    } satisfies Record<'device_name' | 'device_type', string>;
    const column = columnMap[params.field];
    const query = `
      SELECT DISTINCT d.device_id
      FROM device d
      WHERE ${column} IS NOT NULL AND LOWER(${column}) LIKE $1
    `;

    const { rows, durationMs } = await executePgQuery<{ device_id: string }>(query, [
      `%${params.search.toLowerCase()}%`,
    ]);
    return {
      deviceIds: rows.map((r) => r.device_id),
      durationMs,
    };
  }

  /**
   * Fetches all devices with their vendor and station details.
   */
  async getAllDevices(): Promise<{ devices: DeviceMetadata[]; durationMs: number }> {
    const query = `
      SELECT 
        d.device_id,
        d.name,
        d.vendor_id,
        v.name as vendor_name,
        v.country as vendor_country,
        d.station_id,
        s.name as station_name,
        s.province as station_province,
        d.device_type,
        d.ip_address,
        d.longitude,
        d.latitude,
        d.additional_info
      FROM device d
      LEFT JOIN vendor v ON d.vendor_id = v.vendor_id
      LEFT JOIN station s ON d.station_id = s.station_id
    `;
    const { rows, durationMs } = await executePgQuery<DeviceMetadata>(query);
    return { devices: rows, durationMs };
  }

  async getFilterOptions(params: {
    search?: string;
    limit?: number;
  }): Promise<{ options: DeviceFilterOptions; durationMs: number }> {
    const limit = params.limit ?? null;
    const search = params.search ? `%${params.search.toLowerCase()}%` : null;
    const query = `
      WITH options AS (
        SELECT DISTINCT 'device_type' AS category, d.device_type AS value
        FROM device d
        WHERE d.device_type IS NOT NULL AND d.device_type <> ''
        UNION ALL
        SELECT DISTINCT 'vendor' AS category, v.name AS value
        FROM vendor v
        WHERE v.name IS NOT NULL AND v.name <> ''
        UNION ALL
        SELECT DISTINCT 'station' AS category, s.name AS value
        FROM station s
        WHERE s.name IS NOT NULL AND s.name <> ''
        UNION ALL
        SELECT DISTINCT 'province' AS category, s.province AS value
        FROM station s
        WHERE s.province IS NOT NULL AND s.province <> ''
      ),
      ranked AS (
        SELECT
          category,
          value,
          ROW_NUMBER() OVER (PARTITION BY category ORDER BY value) AS rank
        FROM options
        WHERE ($1::text IS NULL OR LOWER(value) LIKE $1)
      )
      SELECT category, value
      FROM ranked
      WHERE ($2::int IS NULL OR rank <= $2)
      ORDER BY category, value
    `;

    const { rows, durationMs } = await executePgQuery<{ category: string; value: string }>(query, [
      search,
      limit,
    ]);

    return {
      options: {
        deviceTypes: rows
          .filter((row) => row.category === 'device_type')
          .map((row) => row.value),
        vendors: rows.filter((row) => row.category === 'vendor').map((row) => row.value),
        stations: rows.filter((row) => row.category === 'station').map((row) => row.value),
        provinces: rows.filter((row) => row.category === 'province').map((row) => row.value),
      },
      durationMs,
    };
  }
}
