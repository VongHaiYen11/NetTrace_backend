export interface ServiceMetrics {
  clickhouse_query_time_ms: number;
  postgres_query_time_ms: number;
  records_returned: number;
}
