import { QueryAlarmsService } from '../services/query-alarms.service.js';
import { QueryAlarmsRepository, AlarmRecord } from '../repositories/query-alarms.repository.js';
import { TopNAnalyticsService } from '../services/top-n-analytics.service.js';
import { TopNAnalyticsRepository } from '../repositories/top-n-analytics.repository.js';
import { RatioAnalyticsService } from '../services/ratio-analytics.service.js';
import { RatioAnalyticsRepository } from '../repositories/ratio-analytics.repository.js';
import { DeviceRepository, DeviceMetadata } from '../repositories/device.repository.js';
import { ErrorRepository, ErrorMetadata } from '../repositories/error.repository.js';
import { ServiceMetrics } from '../services/shared.js';

describe('Service Layer Federation Tests', () => {
  let mockDeviceRepo: jest.Mocked<DeviceRepository>;
  let mockErrorRepo: jest.Mocked<ErrorRepository>;

  beforeEach(() => {
    mockDeviceRepo = {
      getDevicesByIds: jest.fn(),
    } as unknown as jest.Mocked<DeviceRepository>;

    mockErrorRepo = {
      getErrorsByCodes: jest.fn(),
    } as unknown as jest.Mocked<ErrorRepository>;
  });

  describe('QueryAlarmsService (Detail Queries with Keyset Federation)', () => {
    it('should query alarms, extract distinct device/error IDs, fetch metadata in parallel, and stitch', async () => {
      const mockQueryRepo = {
        queryAlarms: jest.fn(),
      } as unknown as jest.Mocked<QueryAlarmsRepository>;

      const queryService = new QueryAlarmsService(mockQueryRepo, mockDeviceRepo, mockErrorRepo);

      const mockAlarms: AlarmRecord[] = [
        {
          alarm_id: 'a1',
          error_code: 'ERR001',
          device_id: 'DEV001',
          time_created: '2026-06-14 08:00:00',
          time_solved: null,
          status: 'active',
          severity: 'critical',
          raw_log: 'Interface down',
          description: 'Interface Gi0/1 down',
        },
      ];

      mockQueryRepo.queryAlarms.mockResolvedValue({
        alarms: mockAlarms,
        total: 1,
        durationMs: 50,
      });

      const mockDevices: DeviceMetadata[] = [
        {
          device_id: 'DEV001',
          name: 'Device Alpha',
          vendor_id: 'V1',
          vendor_name: 'Cisco Systems',
          vendor_country: 'USA',
          station_id: 'S1',
          station_name: 'Hanoi Central',
          station_province: 'Hanoi',
          device_type: 'router',
          ip_address: '192.168.1.1',
          longitude: 105.8,
          latitude: 21.0,
          additional_info: 'Rack A',
        },
      ];

      mockDeviceRepo.getDevicesByIds.mockResolvedValue({
        devices: mockDevices,
        durationMs: 5,
      });

      const mockErrors: ErrorMetadata[] = [
        {
          error_code: 'ERR001',
          name: 'Link failure',
          description: 'Link down description',
          domain: 'Network',
          default_severity: 'critical',
        },
      ];

      mockErrorRepo.getErrorsByCodes.mockResolvedValue({
        errors: mockErrors,
        durationMs: 5,
      });

      const metrics: ServiceMetrics = {
        clickhouse_query_time_ms: 0,
        postgres_query_time_ms: 0,
        records_returned: 0,
      };

      const params = {
        from_time: new Date(),
        to_time: new Date(),
        limit: 10,
        sort_by: 'timestamp' as const,
        sort_order: 'desc' as const,
      };

      const result = await queryService.queryAlarms(params, metrics);

      expect(result.alarms.length).toBe(1);
      expect(result.alarms[0].device_details).toEqual(mockDevices[0]);
      expect(result.alarms[0].error_details).toEqual(mockErrors[0]);
      expect(metrics.clickhouse_query_time_ms).toBe(50);
      expect(metrics.postgres_query_time_ms).toBeGreaterThanOrEqual(0);
      expect(metrics.records_returned).toBe(1);
    });
  });

  describe('TopNAnalyticsService', () => {
    it('should aggregate device top-n ranking and resolve station/device names', async () => {
      const mockTopNRepo = {
        getTopN: jest.fn(),
      } as unknown as jest.Mocked<TopNAnalyticsRepository>;

      const topNService = new TopNAnalyticsService(mockTopNRepo, mockDeviceRepo, mockErrorRepo);

      mockTopNRepo.getTopN.mockResolvedValue({
        rows: [{ entity_id: 'DEV001', alarm_count: 50 }],
        durationMs: 30,
      });

      mockDeviceRepo.getDevicesByIds.mockResolvedValue({
        devices: [
          {
            device_id: 'DEV001',
            name: 'Device Alpha',
            vendor_id: 'V1',
            vendor_name: 'Cisco Systems',
            vendor_country: 'USA',
            station_id: 'S1',
            station_name: 'Hanoi Station',
            station_province: 'Hanoi',
            device_type: 'router',
            ip_address: '192.168.1.1',
            longitude: 105.8,
            latitude: 21.0,
            additional_info: null,
          },
        ],
        durationMs: 5,
      });

      const metrics: ServiceMetrics = {
        clickhouse_query_time_ms: 0,
        postgres_query_time_ms: 0,
        records_returned: 0,
      };

      const result = await topNService.getTopNAnalytics(
        {
          from_time: new Date(),
          to_time: new Date(),
          by: 'device',
          n: 10,
        },
        metrics,
      );

      expect(result.length).toBe(1);
      const resItem = result[0] as Record<string, unknown>;
      expect(resItem.device_id).toBe('DEV001');
      expect(resItem.alarm_count).toBe(50);
      expect(resItem.label).toBe('Device Alpha (Hanoi Station)');
    });
  });

  describe('RatioAnalyticsService', () => {
    it('should compute ratios by severity directly', async () => {
      const mockRatioRepo = {
        getRatioBySeverity: jest.fn(),
        getRatioByDevice: jest.fn(),
      } as unknown as jest.Mocked<RatioAnalyticsRepository>;

      const ratioService = new RatioAnalyticsService(mockRatioRepo, mockDeviceRepo);

      mockRatioRepo.getRatioBySeverity.mockResolvedValue({
        rows: [
          { severity: 'critical', count: 60 },
          { severity: 'warning', count: 40 },
        ],
        durationMs: 20,
      });

      const metrics: ServiceMetrics = {
        clickhouse_query_time_ms: 0,
        postgres_query_time_ms: 0,
        records_returned: 0,
      };

      const result = await ratioService.getRatioAnalytics(
        {
          from_time: new Date(),
          to_time: new Date(),
          by: 'severity',
        },
        metrics,
      );

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ severity: 'critical', count: 60, percentage: 60 });
      expect(result[1]).toEqual({ severity: 'warning', count: 40, percentage: 40 });
    });

    it('should federate device type from Postgres and coalesce ratios', async () => {
      const mockRatioRepo = {
        getRatioBySeverity: jest.fn(),
        getRatioByDevice: jest.fn(),
      } as unknown as jest.Mocked<RatioAnalyticsRepository>;

      const ratioService = new RatioAnalyticsService(mockRatioRepo, mockDeviceRepo);

      mockRatioRepo.getRatioByDevice.mockResolvedValue({
        rows: [
          { device_id: 'DEV001', count: 60 },
          { device_id: 'DEV002', count: 40 },
        ],
        durationMs: 25,
      });

      mockDeviceRepo.getDevicesByIds.mockResolvedValue({
        devices: [
          {
            device_id: 'DEV001',
            name: 'Dev1',
            vendor_id: 'V1',
            vendor_name: 'Cisco',
            vendor_country: 'USA',
            station_id: 'ST1',
            station_name: 'Stat1',
            station_province: 'Hanoi',
            device_type: 'Switch',
            ip_address: '1.1.1.1',
            longitude: null,
            latitude: null,
            additional_info: null,
          },
          {
            device_id: 'DEV002',
            name: 'Dev2',
            vendor_id: 'V1',
            vendor_name: 'Cisco',
            vendor_country: 'USA',
            station_id: 'ST2',
            station_name: 'Stat2',
            station_province: 'HCM',
            device_type: 'Firewall',
            ip_address: '2.2.2.2',
            longitude: null,
            latitude: null,
            additional_info: null,
          },
        ],
        durationMs: 5,
      });

      const metrics: ServiceMetrics = {
        clickhouse_query_time_ms: 0,
        postgres_query_time_ms: 0,
        records_returned: 0,
      };

      const resultRegion = await ratioService.getRatioAnalytics(
        {
          from_time: new Date(),
          to_time: new Date(),
          by: 'region',
        },
        metrics,
      );

      expect(resultRegion.length).toBe(2);
      expect(resultRegion[0]).toEqual({ region_name: 'Hanoi', count: 60, percentage: 60 });
      expect(resultRegion[1]).toEqual({ region_name: 'HCM', count: 40, percentage: 40 });
    });
  });
});
