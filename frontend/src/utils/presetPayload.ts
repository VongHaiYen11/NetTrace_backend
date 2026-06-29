import type { ExportColumn } from '../services/generated/nettrace-api';
import { encodeTableColumns } from './columns';

type PresetChartType = 'line' | 'bar' | 'pie' | 'table' | 'heatmap';

interface PresetFieldInput {
  chartType: PresetChartType;
  metric?: string | null;
  groupBy?: string | null;
  timeBucket?: string | null;
  heatmapMode?: string | null;
  tableColumns?: ExportColumn[] | string[] | string | null;
  tablePageSize?: number | null;
  tableRecordLimit?: number | null;
}

function normalizeTableColumns(value: PresetFieldInput['tableColumns']) {
  if (!value) return null;
  if (typeof value === 'string') return value || null;
  return encodeTableColumns(value);
}

export function normalizePresetFieldsByChartType(input: PresetFieldInput) {
  const metric = input.metric || null;
  const groupBy = input.groupBy && input.groupBy !== 'none' ? input.groupBy : null;
  const timeBucket = input.timeBucket || null;
  const heatmapMode = input.heatmapMode || null;
  const tableColumns = normalizeTableColumns(input.tableColumns);
  const tablePageSize = input.tablePageSize ?? null;
  const tableRecordLimit = input.tableRecordLimit ?? null;

  switch (input.chartType) {
    case 'line':
      return {
        metric,
        group_by: null,
        time_bucket: timeBucket,
        heatmap_mode: null,
        table_columns: null,
        table_page_size: null,
        table_record_limit: null,
      };
    case 'bar':
      return {
        metric,
        group_by: groupBy,
        time_bucket: groupBy ? null : timeBucket,
        heatmap_mode: null,
        table_columns: null,
        table_page_size: null,
        table_record_limit: null,
      };
    case 'pie':
      return {
        metric,
        group_by: groupBy,
        time_bucket: null,
        heatmap_mode: null,
        table_columns: null,
        table_page_size: null,
        table_record_limit: null,
      };
    case 'table':
      return {
        metric: null,
        group_by: null,
        time_bucket: null,
        heatmap_mode: null,
        table_columns: tableColumns,
        table_page_size: tablePageSize,
        table_record_limit: tableRecordLimit,
      };
    case 'heatmap':
      return {
        metric: null,
        group_by: null,
        time_bucket: null,
        heatmap_mode: heatmapMode,
        table_columns: null,
        table_page_size: null,
        table_record_limit: null,
      };
  }
}
