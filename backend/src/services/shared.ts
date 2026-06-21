export interface ServiceMetrics {
  clickhouse_query_time_ms: number;
  postgres_query_time_ms: number;
  records_returned: number;
  include_total?: boolean;
  detail_level?: 'compact' | 'full';
  clickhouse_rows_returned?: number;
  metadata_ids_fetched?: number;
  export_batches?: number;
  federated_fanout_rows?: number;
  federated_fanout_limit?: number;
}
