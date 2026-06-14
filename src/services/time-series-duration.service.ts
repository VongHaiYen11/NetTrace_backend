import {
  TimeSeriesDurationRepository,
  TimeSeriesDurationParams,
} from '../repositories/time-series-duration.repository.js';
import { ServiceMetrics } from './shared.js';

export class TimeSeriesDurationService {
  constructor(private readonly timeSeriesDurationRepo: TimeSeriesDurationRepository) {}

  async getTimeSeriesDuration(params: TimeSeriesDurationParams, metrics: ServiceMetrics) {
    const { rows, durationMs } = await this.timeSeriesDurationRepo.getTimeSeriesDuration(params);
    metrics.clickhouse_query_time_ms += durationMs;
    metrics.records_returned += rows.length;
    return rows;
  }
}
