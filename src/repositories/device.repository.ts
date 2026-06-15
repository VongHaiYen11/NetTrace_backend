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
      WHERE d.device_id = ANY($1)
    `;

    const { rows, durationMs } = await executePgQuery<DeviceMetadata>(query, [ids]);
    return { devices: rows, durationMs };
  }

  /**
   * Fetches distinct device IDs matching metadata filters.
   */
  async getDeviceIdsByFilters(filters: {
    device_type?: string[];
    vendor?: string[];
    station?: string[];
    province?: string[];
  }): Promise<{ deviceIds: string[]; durationMs: number }> {
    const conditions: string[] = [];
    const joins: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.device_type && filters.device_type.length > 0) {
      conditions.push(`d.device_type = ANY($${paramIndex++})`);
      params.push(filters.device_type);
    }
    if (filters.vendor && filters.vendor.length > 0) {
      joins.push('INNER JOIN vendor v ON d.vendor_id = v.vendor_id');
      conditions.push(`v.name = ANY($${paramIndex++})`);
      params.push(filters.vendor);
    }

    const needsStation =
      (filters.station && filters.station.length > 0) ||
      (filters.province && filters.province.length > 0);

    if (needsStation) {
      joins.push('INNER JOIN station s ON d.station_id = s.station_id');
      if (filters.station && filters.station.length > 0) {
        conditions.push(`s.name = ANY($${paramIndex++})`);
        params.push(filters.station);
      }
      if (filters.province && filters.province.length > 0) {
        conditions.push(`s.province = ANY($${paramIndex++})`);
        params.push(filters.province);
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
}
