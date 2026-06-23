import { DeviceRepository } from '../repositories/device.repository.js';
import { ServiceMetrics } from './shared.js';

export class MetadataOptionsService {
  constructor(private readonly deviceRepo: DeviceRepository) {}

  async getOptions(params: { search?: string; limit?: number }, metrics: ServiceMetrics) {
    const { options, durationMs } = await this.deviceRepo.getFilterOptions(params);
    metrics.postgres_query_time_ms += durationMs;
    metrics.records_returned +=
      options.deviceTypes.length +
      options.vendors.length +
      options.stations.length +
      options.provinces.length;
    return options;
  }
}
