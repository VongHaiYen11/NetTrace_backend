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

  switch (input.chartType) {
    case 'line':
      return {
        metric,
        group_by: null,
        time_bucket: timeBucket,
        heatmap_mode: null,
        table_columns: null,
      };
    case 'bar':
      return {
        metric,
        group_by: groupBy,
        time_bucket: groupBy ? null : timeBucket,
        heatmap_mode: null,
        table_columns: null,
      };
    case 'pie':
      return {
        metric,
        group_by: groupBy,
        time_bucket: null,
        heatmap_mode: null,
        table_columns: null,
      };
    case 'table':
      return {
        metric: null,
        group_by: null,
        time_bucket: null,
        heatmap_mode: null,
        table_columns: tableColumns,
      };
    case 'heatmap':
      return {
        metric: null,
        group_by: null,
        time_bucket: null,
        heatmap_mode: heatmapMode,
        table_columns: null,
      };
  }
}
