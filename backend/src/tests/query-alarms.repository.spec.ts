import { QueryAlarmsRepository } from '../repositories/query-alarms.repository.js';
import { executeClickhouseQuery } from '../database/clickhouse/connection.js';

jest.mock('../database/clickhouse/connection.js', () => ({
  executeClickhouseQuery: jest.fn(),
  clickhouseClient: {
    query: jest.fn(),
  },
}));

describe('QueryAlarmsRepository performance query shape', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (executeClickhouseQuery as jest.Mock).mockResolvedValue({
      rows: [],
      durationMs: 1,
    });
  });

  it('should skip count query when include_total is false', async () => {
    const repo = new QueryAlarmsRepository();

    await repo.queryAlarms({
      from_time: new Date('2026-06-01T00:00:00Z'),
      to_time: new Date('2026-06-02T00:00:00Z'),
      offset: 0,
      limit: 10,
      sort_by: 'timestamp',
      sort_order: 'desc',
      include_total: false,
    });

    expect(executeClickhouseQuery).toHaveBeenCalledTimes(1);
  });

  it('should select only requested direct columns plus required row fields', async () => {
    const repo = new QueryAlarmsRepository();

    await repo.queryAlarms({
      from_time: new Date('2026-06-01T00:00:00Z'),
      to_time: new Date('2026-06-02T00:00:00Z'),
      offset: 0,
      limit: 10,
      sort_by: 'timestamp',
      sort_order: 'desc',
      include_total: false,
      columns: ['time_created', 'status'],
    });

    const query = (executeClickhouseQuery as jest.Mock).mock.calls[0][0] as string;
    expect(query).toContain('alarm_id');
    expect(query).toContain('time_created');
    expect(query).toContain('status');
    expect(query).not.toContain('raw_log');
    expect(query).not.toContain('description');
  });

  it('should include required ID columns for requested metadata columns', async () => {
    const repo = new QueryAlarmsRepository();

    await repo.queryAlarms({
      from_time: new Date('2026-06-01T00:00:00Z'),
      to_time: new Date('2026-06-02T00:00:00Z'),
      offset: 0,
      limit: 10,
      sort_by: 'timestamp',
      sort_order: 'desc',
      include_total: false,
      columns: ['device_name', 'error_name'],
    });

    const query = (executeClickhouseQuery as jest.Mock).mock.calls[0][0] as string;
    expect(query).toContain('device_id');
    expect(query).toContain('error_code');
  });

  it('should use normalized filter columns instead of lower(column)', async () => {
    const repo = new QueryAlarmsRepository();

    await repo.queryAlarms({
      from_time: new Date('2026-06-01T00:00:00Z'),
      to_time: new Date('2026-06-02T00:00:00Z'),
      offset: 0,
      limit: 10,
      severity: ['Critical'],
      status: ['Active'],
      device_id: ['DEV01'],
      error_code: ['ERR01'],
      sort_by: 'timestamp',
      sort_order: 'desc',
      include_total: false,
    });

    const query = (executeClickhouseQuery as jest.Mock).mock.calls[0][0] as string;
    expect(query).toContain('severity_normalized IN');
    expect(query).toContain('status_normalized IN');
    expect(query).toContain('device_id_normalized IN');
    expect(query).toContain('error_code_normalized IN');
    expect(query).not.toContain('lower(severity)');
    expect(query).not.toContain('lower(status)');
    expect(query).not.toContain('lower(device_id)');
    expect(query).not.toContain('lower(error_code)');
  });

  it('should apply whitelisted backend search to the ClickHouse query', async () => {
    const repo = new QueryAlarmsRepository();

    await repo.queryAlarms({
      from_time: new Date('2026-06-01T00:00:00Z'),
      to_time: new Date('2026-06-02T00:00:00Z'),
      offset: 0,
      limit: 10,
      sort_by: 'timestamp',
      sort_order: 'desc',
      include_total: false,
      search: 'link down',
      search_field: 'description',
    });

    const query = (executeClickhouseQuery as jest.Mock).mock.calls[0][0] as string;
    const queryParams = (executeClickhouseQuery as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(query).toContain('positionCaseInsensitive(description, {search: String}) > 0');
    expect(queryParams.search).toBe('link down');
  });
});
