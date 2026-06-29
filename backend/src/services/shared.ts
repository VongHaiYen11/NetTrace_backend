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
  time_range_chunks?: number;
}

const MAX_CLICKHOUSE_WINDOW_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DateRangeChunk {
  from_time: Date;
  to_time: Date;
}

export function splitDateRangeIntoChunks(
  from_time: Date,
  to_time: Date,
  maxDays = MAX_CLICKHOUSE_WINDOW_DAYS,
): DateRangeChunk[] {
  const chunks: DateRangeChunk[] = [];
  let cursor = new Date(from_time);
  const finalTo = new Date(to_time);

  while (cursor.getTime() <= finalTo.getTime()) {
    const chunkEnd = new Date(cursor.getTime() + maxDays * MS_PER_DAY - 1);
    const boundedEnd = chunkEnd.getTime() < finalTo.getTime() ? chunkEnd : finalTo;

    chunks.push({
      from_time: new Date(cursor),
      to_time: new Date(boundedEnd),
    });

    cursor = new Date(boundedEnd.getTime() + 1);
  }

  return chunks;
}
