import {
  TimeSeriesCountRepository,
  TimeSeriesCountParams,
} from '../repositories/time-series-count.repository.js';
import { ServiceMetrics } from './shared.js';

export class TimeSeriesCountService {
  constructor(private readonly timeSeriesCountRepo: TimeSeriesCountRepository) {}

  async getTimeSeriesCount(params: TimeSeriesCountParams, metrics: ServiceMetrics) {
    const { rows, durationMs } = await this.timeSeriesCountRepo.getTimeSeriesCount(params);
    metrics.clickhouse_query_time_ms += durationMs;
    metrics.records_returned += rows.length;
    return rows;
  }
}
