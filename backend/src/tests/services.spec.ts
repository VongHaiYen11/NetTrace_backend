import { QueryAlarmsService } from '../services/query-alarms.service.js';
import { QueryAlarmsRepository } from '../repositories/query-alarms.repository.js';
import { SummaryService } from '../services/summary.service.js';
import { SummaryRepository } from '../repositories/summary.repository.js';
import { AnalyticsQueryService } from '../services/analytics-query.service.js';
import { AnalyticsQueryRepository } from '../repositories/analytics-query.repository.js';
import { HeatmapService } from '../services/heatmap.service.js';
import { HeatmapRepository } from '../repositories/heatmap.repository.js';
import { ExportService } from '../services/export.service.js';
import { MetadataOptionsService } from '../services/metadata-options.service.js';
import { DeviceRepository } from '../repositories/device.repository.js';
import { ErrorRepository } from '../repositories/error.repository.js';
import { ServiceMetrics } from '../services/shared.js';
import { Readable, PassThrough } from 'stream';

describe('Service Layer Tests', () => {
  let mockDeviceRepo: jest.Mocked<DeviceRepository>;
  let mockErrorRepo: jest.Mocked<ErrorRepository>;
  let metrics: ServiceMetrics;

  beforeEach(() => {
    mockDeviceRepo = {
      getDevicesByIds: jest.fn(),
      getDeviceIdsByFilters: jest.fn(),
      getDeviceIdsBySearch: jest.fn(),
      getAllDevices: jest.fn(),
      getFilterOptions: jest.fn(),
    } as unknown as jest.Mocked<DeviceRepository>;

    mockErrorRepo = {
      getErrorsByCodes: jest.fn(),
      getErrorCodesBySearch: jest.fn(),
      getAllErrors: jest.fn(),
    } as unknown as jest.Mocked<ErrorRepository>;

    metrics = {
      clickhouse_query_time_ms: 0,
      postgres_query_time_ms: 0,
      records_returned: 0,
    };
  });

  describe('QueryAlarmsService', () => {
    it('should query clickhouse, resolve postgres filters, and enrich details', async () => {
      const mockQueryRepo = {
        queryAlarms: jest.fn(),
      } as unknown as jest.Mocked<QueryAlarmsRepository>;

      const queryService = new QueryAlarmsService(mockQueryRepo, mockDeviceRepo, mockErrorRepo);

      mockQueryRepo.queryAlarms.mockResolvedValue({
        alarms: [
          {
            alarm_id: 'a1',
            error_code: 'ERR01',
            device_id: 'DEV01',
            time_created: '2026-06-15 00:00:00',
            time_solved: null,
            status: 'active',
            severity: 'critical',
            raw_log: 'link down',
            description: 'port gi0/1 is down',
          },
        ],
        total: 1,
        durationMs: 40,
      });

      mockDeviceRepo.getDevicesByIds.mockResolvedValue({
        devices: [
          {
            device_id: 'DEV01',
            name: 'Switch A',
            vendor_id: 'V1',
            vendor_name: 'Cisco',
            vendor_country: 'USA',
            station_id: 'ST1',
            station_name: 'Hanoi Central',
            station_province: 'Hanoi',
            device_type: 'Switch',
            ip_address: '10.0.0.1',
            longitude: null,
            latitude: null,
            additional_info: null,
          },
        ],
        durationMs: 5,
      });

      mockErrorRepo.getErrorsByCodes.mockResolvedValue({
        errors: [
          {
            error_code: 'ERR01',
            name: 'Link Down',
            description: 'Link connection failure',
            domain: 'Network',
            default_severity: 'critical',
          },
        ],
        durationMs: 5,
      });

      const params = {
        from_time: new Date(),
        to_time: new Date(),
        offset: 0,
        limit: 10,
        sort_by: 'timestamp' as const,
        sort_order: 'desc' as const,
      };

      const result = await queryService.queryAlarms(params, metrics);

      expect(result.alarms.length).toBe(1);
      expect(result.alarms[0].device_details?.name).toBe('Switch A');
      expect(result.alarms[0].error_details?.name).toBe('Link Down');
      expect(metrics.clickhouse_query_time_ms).toBe(40);
    });

    it('should resolve metadata filters through Postgres getDeviceIdsByFilters', async () => {
      const mockQueryRepo = {
        queryAlarms: jest.fn(),
      } as unknown as jest.Mocked<QueryAlarmsRepository>;

      const queryService = new QueryAlarmsService(mockQueryRepo, mockDeviceRepo, mockErrorRepo);

      mockDeviceRepo.getDeviceIdsByFilters.mockResolvedValue({
        deviceIds: ['DEV01'],
        durationMs: 10,
      });

      mockQueryRepo.queryAlarms.mockResolvedValue({
        alarms: [],
        total: 0,
        durationMs: 5,
      });

      const params = {
        from_time: new Date(),
        to_time: new Date(),
        offset: 0,
        limit: 10,
        device_type: ['Switch'],
        sort_by: 'timestamp' as const,
        sort_order: 'desc' as const,
      };

      await queryService.queryAlarms(params, metrics);

      expect(mockDeviceRepo.getDeviceIdsByFilters).toHaveBeenCalledWith({
        device_type: ['Switch'],
        vendor: undefined,
        station: undefined,
        province: undefined,
      });
      expect(mockQueryRepo.queryAlarms).toHaveBeenCalledWith(
        expect.objectContaining({
          device_id: ['DEV01'],
        }),
      );
    });

    it('should resolve device metadata search through Postgres before querying ClickHouse', async () => {
      const mockQueryRepo = {
        queryAlarms: jest.fn(),
      } as unknown as jest.Mocked<QueryAlarmsRepository>;

      const queryService = new QueryAlarmsService(mockQueryRepo, mockDeviceRepo, mockErrorRepo);

      mockDeviceRepo.getDeviceIdsBySearch.mockResolvedValue({
        deviceIds: ['DEV01'],
        durationMs: 7,
      });

      mockQueryRepo.queryAlarms.mockResolvedValue({
        alarms: [],
        total: 0,
        durationMs: 5,
      });

      await queryService.queryAlarms(
        {
          from_time: new Date(),
          to_time: new Date(),
          offset: 0,
          limit: 10,
          search: 'Switch',
          search_field: 'device_type',
          sort_by: 'timestamp',
          sort_order: 'desc',
        },
        metrics,
      );

      expect(mockDeviceRepo.getDeviceIdsBySearch).toHaveBeenCalledWith({
        field: 'device_type',
        search: 'Switch',
      });
      expect(mockQueryRepo.queryAlarms).toHaveBeenCalledWith(
        expect.objectContaining({
          device_id: ['DEV01'],
          search: undefined,
          search_field: undefined,
        }),
      );
    });
  });

  describe('SummaryService', () => {
    it('should aggregate metrics', async () => {
      const mockSummaryRepo = {
        getSummary: jest.fn(),
      } as unknown as jest.Mocked<SummaryRepository>;

      const summaryService = new SummaryService(mockSummaryRepo, mockDeviceRepo);

      mockSummaryRepo.getSummary.mockResolvedValue({
        summary: {
          totalAlarms: 100,
          activeAlarms: 10,
          closedAlarms: 90,
          criticalAlarms: 5,
          affectedDevices: 3,
        },
        durationMs: 15,
      });

      const result = await summaryService.getSummary(
        {
          from_time: new Date(),
          to_time: new Date(),
        },
        metrics,
      );

      expect(result.totalAlarms).toBe(100);
      expect(result.activeAlarms).toBe(10);
      expect(metrics.clickhouse_query_time_ms).toBe(15);
    });
  });

  describe('AnalyticsQueryService', () => {
    it('should handle ClickHouse native grouping directly', async () => {
      const mockQueryRepo = {
        executeQuery: jest.fn(),
      } as unknown as jest.Mocked<AnalyticsQueryRepository>;

      const analyticsService = new AnalyticsQueryService(mockQueryRepo, mockDeviceRepo);

      mockQueryRepo.executeQuery.mockResolvedValue({
        rows: [
          { severity: 'critical', value: 12 },
          { severity: 'warning', value: 8 },
        ],
        durationMs: 25,
      });

      const result = await analyticsService.executeQuery(
        {
          metric: 'count',
          group_by: ['severity'],
          filters: {
            from_time: new Date(),
            to_time: new Date(),
          },
          limit: 10,
        },
        metrics,
      );

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ severity: 'critical', value: 12 });
      expect(metrics.clickhouse_query_time_ms).toBe(25);
    });

    it('should federate Postgres grouping dynamically', async () => {
      const mockQueryRepo = {
        executeQuery: jest.fn(),
      } as unknown as jest.Mocked<AnalyticsQueryRepository>;

      const analyticsService = new AnalyticsQueryService(mockQueryRepo, mockDeviceRepo);

      mockQueryRepo.executeQuery.mockResolvedValue({
        rows: [
          { device_id: 'DEV01', value: 20 },
          { device_id: 'DEV02', value: 10 },
        ],
        durationMs: 20,
      });

      mockDeviceRepo.getDevicesByIds.mockResolvedValue({
        devices: [
          {
            device_id: 'DEV01',
            name: 'Device A',
            device_type: 'Switch',
            vendor_id: 'V1',
            vendor_name: 'Cisco',
            vendor_country: 'USA',
            station_id: 'S1',
            station_name: 'St1',
            station_province: 'Hanoi',
            ip_address: null,
            longitude: null,
            latitude: null,
            additional_info: null,
          },
          {
            device_id: 'DEV02',
            name: 'Device B',
            device_type: 'Router',
            vendor_id: 'V1',
            vendor_name: 'Cisco',
            vendor_country: 'USA',
            station_id: 'S2',
            station_name: 'St2',
            station_province: 'Hanoi',
            ip_address: null,
            longitude: null,
            latitude: null,
            additional_info: null,
          },
        ],
        durationMs: 5,
      });

      const result = await analyticsService.executeQuery(
        {
          metric: 'count',
          group_by: ['device_type'],
          filters: {
            from_time: new Date(),
            to_time: new Date(),
          },
          limit: 10,
        },
        metrics,
      );

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ device_type: 'Switch', value: 20 });
      expect(result[1]).toEqual({ device_type: 'Router', value: 10 });
    });

    it('should reject federated analytics when fanout reaches the configured cap', async () => {
      const mockQueryRepo = {
        executeQuery: jest.fn(),
      } as unknown as jest.Mocked<AnalyticsQueryRepository>;

      const analyticsService = new AnalyticsQueryService(mockQueryRepo, mockDeviceRepo);

      mockQueryRepo.executeQuery.mockResolvedValue({
        rows: Array.from({ length: 10000 }, (_, idx) => ({
          device_id: `DEV${idx}`,
          value: 1,
        })),
        durationMs: 20,
      });

      await expect(
        analyticsService.executeQuery(
          {
            metric: 'count',
            group_by: ['device_type'],
            filters: {
              from_time: new Date(),
              to_time: new Date(),
            },
            limit: 10,
          },
          metrics,
        ),
      ).rejects.toMatchObject({
        code: 'FEDERATED_FANOUT_LIMIT_EXCEEDED',
        statusCode: 400,
      });
      expect(mockDeviceRepo.getDevicesByIds).not.toHaveBeenCalled();
    });
  });

  describe('HeatmapService', () => {
    it('should map weekday indices to string names', async () => {
      const mockHeatmapRepo = {
        getHeatmap: jest.fn(),
      } as unknown as jest.Mocked<HeatmapRepository>;

      const heatmapService = new HeatmapService(mockHeatmapRepo, mockDeviceRepo);

      mockHeatmapRepo.getHeatmap.mockResolvedValue({
        rows: [
          { day_of_week: 1, hour: 13, count: 42 },
          { day_of_week: 2, hour: 14, count: 18 },
        ],
        durationMs: 15,
      });

      const result = await heatmapService.getHeatmap(
        {
          from_time: new Date(),
          to_time: new Date(),
          mode: 'weekday',
        },
        metrics,
      );

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ x: 13, y: 'Monday', value: 42 });
      expect(result[1]).toEqual({ x: 14, y: 'Tuesday', value: 18 });
    });

    it('should map calendar mode to day-by-day counts (GitHub style)', async () => {
      const mockHeatmapRepo = {
        getHeatmap: jest.fn(),
      } as unknown as jest.Mocked<HeatmapRepository>;

      const heatmapService = new HeatmapService(mockHeatmapRepo, mockDeviceRepo);

      mockHeatmapRepo.getHeatmap.mockResolvedValue({
        rows: [
          { day: '2026-06-15', count: 100 },
          { day: '2026-06-16', count: 200 },
        ],
        durationMs: 10,
      });

      const result = await heatmapService.getHeatmap(
        {
          from_time: new Date(),
          to_time: new Date(),
          mode: 'calendar',
        },
        metrics,
      );

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ day: '2026-06-15', value: 100 });
      expect(result[1]).toEqual({ day: '2026-06-16', value: 200 });
    });
  });

  describe('ExportService', () => {
    it('should export alarms as CSV with selected columns', async () => {
      const mockQueryRepo = {
        queryAlarmsStream: jest.fn(),
      } as unknown as jest.Mocked<QueryAlarmsRepository>;

      const exportService = new ExportService(mockQueryRepo, mockDeviceRepo, mockErrorRepo);

      const mockStream = new Readable({
        read() {
          this.push(
            JSON.stringify({
              alarm_id: 'a1',
              device_id: 'DEV01',
              error_code: 'ERR01',
              time_created: '2026-06-15 00:00:00',
              time_solved: null,
              status: 'active',
              severity: 'critical',
              raw_log: 'link down',
              description: 'port gi0/1 is down',
            }) + '\n',
          );
          this.push(null);
        },
      });

      mockQueryRepo.queryAlarmsStream.mockResolvedValue(mockStream);

      const chunks: string[] = [];
      const mockRes = new PassThrough() as any;
      mockRes.setHeader = jest.fn();

      mockRes.on('data', (chunk: any) => {
        chunks.push(chunk.toString());
      });

      await exportService.exportAlarms(
        {
          format: 'csv',
          columns: ['alarm_id', 'severity', 'status'],
          filters: {
            from_time: new Date(),
            to_time: new Date(),
            sort_by: 'timestamp',
            sort_order: 'desc',
          },
        },
        mockRes,
        metrics,
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');

      const fullCsv = chunks.join('');
      expect(fullCsv).toContain('Alarm ID,Severity,Status');
      expect(fullCsv).toContain('a1,critical,active');
      expect(mockDeviceRepo.getDevicesByIds).not.toHaveBeenCalled();
      expect(mockErrorRepo.getErrorsByCodes).not.toHaveBeenCalled();
      expect(mockDeviceRepo.getAllDevices).not.toHaveBeenCalled();
      expect(mockErrorRepo.getAllErrors).not.toHaveBeenCalled();
    });

    it('should batch metadata lookup only for selected metadata columns', async () => {
      const mockQueryRepo = {
        queryAlarmsStream: jest.fn(),
      } as unknown as jest.Mocked<QueryAlarmsRepository>;

      const exportService = new ExportService(mockQueryRepo, mockDeviceRepo, mockErrorRepo);

      const mockStream = new Readable({
        read() {
          this.push(
            JSON.stringify({
              alarm_id: 'a1',
              device_id: 'DEV01',
              error_code: 'ERR01',
              status: 'active',
            }) + '\n',
          );
          this.push(
            JSON.stringify({
              alarm_id: 'a2',
              device_id: 'DEV01',
              error_code: 'ERR02',
              status: 'closed',
            }) + '\n',
          );
          this.push(null);
        },
      });

      mockQueryRepo.queryAlarmsStream.mockResolvedValue(mockStream);
      mockDeviceRepo.getDevicesByIds.mockResolvedValue({
        devices: [
          {
            device_id: 'DEV01',
            name: 'Switch A',
            vendor_id: null,
            vendor_name: null,
            vendor_country: null,
            station_id: null,
            station_name: null,
            station_province: null,
            device_type: 'Switch',
            ip_address: null,
            longitude: null,
            latitude: null,
            additional_info: null,
          },
        ],
        durationMs: 3,
      });

      const chunks: string[] = [];
      const mockRes = new PassThrough() as any;
      mockRes.setHeader = jest.fn();
      mockRes.on('data', (chunk: any) => {
        chunks.push(chunk.toString());
      });

      await exportService.exportAlarms(
        {
          format: 'csv',
          columns: ['alarm_id', 'device_name'],
          filters: {
            from_time: new Date(),
            to_time: new Date(),
          },
        },
        mockRes,
        metrics,
      );

      const fullCsv = chunks.join('');
      expect(fullCsv).toContain('a1,Switch A');
      expect(fullCsv).toContain('a2,Switch A');
      expect(mockDeviceRepo.getDevicesByIds).toHaveBeenCalledWith(['DEV01']);
      expect(mockErrorRepo.getErrorsByCodes).not.toHaveBeenCalled();
      expect(metrics.metadata_ids_fetched).toBe(1);
    });

    it('should export alarms as JSON with selected columns', async () => {
      const mockQueryRepo = {
        queryAlarmsStream: jest.fn(),
      } as unknown as jest.Mocked<QueryAlarmsRepository>;

      const exportService = new ExportService(mockQueryRepo, mockDeviceRepo, mockErrorRepo);

      const mockStream = new Readable({
        read() {
          this.push(
            JSON.stringify({
              alarm_id: 'a1',
              status: 'active',
              severity: 'critical',
            }) + '\n',
          );
          this.push(null);
        },
      });

      mockQueryRepo.queryAlarmsStream.mockResolvedValue(mockStream);

      const chunks: string[] = [];
      const mockRes = new PassThrough() as any;
      mockRes.setHeader = jest.fn();
      mockRes.on('data', (chunk: any) => {
        chunks.push(chunk.toString());
      });

      await exportService.exportAlarms(
        {
          format: 'json',
          columns: ['alarm_id', 'severity', 'status'],
          filters: {
            from_time: new Date(),
            to_time: new Date(),
          },
        },
        mockRes,
        metrics,
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json; charset=utf-8',
      );
      expect(JSON.parse(chunks.join(''))).toEqual([
        {
          alarm_id: 'a1',
          severity: 'critical',
          status: 'active',
        },
      ]);
    });

  });

  describe('MetadataOptionsService', () => {
    it('should return searchable metadata options and update metrics', async () => {
      mockDeviceRepo.getFilterOptions.mockResolvedValue({
        options: {
          deviceTypes: ['Router'],
          vendors: ['Cisco'],
          stations: ['Hanoi Central'],
          provinces: ['Hanoi'],
        },
        durationMs: 5,
      });

      const service = new MetadataOptionsService(mockDeviceRepo);
      const result = await service.getOptions({ search: 'co', limit: 10 }, metrics);

      expect(mockDeviceRepo.getFilterOptions).toHaveBeenCalledWith({ search: 'co', limit: 10 });
      expect(result).toEqual({
        deviceTypes: ['Router'],
        vendors: ['Cisco'],
        stations: ['Hanoi Central'],
        provinces: ['Hanoi'],
      });
      expect(metrics.postgres_query_time_ms).toBe(5);
      expect(metrics.records_returned).toBe(4);
    });
  });
});
