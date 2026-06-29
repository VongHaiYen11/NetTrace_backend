import { Preset } from '../repositories/preset.repository.js';

type PresetInput = Omit<Preset, 'preset_id'>;

export function normalizePresetFieldsByChartType(preset: PresetInput): PresetInput {
  const chartType = preset.chart_type || 'line';
  const metric = preset.metric || null;
  const groupBy = preset.group_by && preset.group_by !== 'none' ? preset.group_by : null;
  const timeBucket = preset.time_bucket || null;
  const heatmapMode = preset.heatmap_mode || null;
  const tableColumns = preset.table_columns || null;
  const tablePageSize = preset.table_page_size ?? null;
  const tableRecordLimit = preset.table_record_limit ?? null;

  if (chartType === 'line') {
    return {
      ...preset,
      chart_type: chartType,
      metric,
      group_by: null,
      time_bucket: timeBucket,
      heatmap_mode: null,
      table_columns: null,
      table_page_size: null,
      table_record_limit: null,
    };
  }

  if (chartType === 'bar') {
    return {
      ...preset,
      chart_type: chartType,
      metric,
      group_by: groupBy,
      time_bucket: groupBy ? null : timeBucket,
      heatmap_mode: null,
      table_columns: null,
      table_page_size: null,
      table_record_limit: null,
    };
  }

  if (chartType === 'pie') {
    return {
      ...preset,
      chart_type: chartType,
      metric,
      group_by: groupBy,
      time_bucket: null,
      heatmap_mode: null,
      table_columns: null,
      table_page_size: null,
      table_record_limit: null,
    };
  }

  if (chartType === 'table') {
    return {
      ...preset,
      chart_type: chartType,
      metric: null,
      group_by: null,
      time_bucket: null,
      heatmap_mode: null,
      table_columns: tableColumns,
      table_page_size: tablePageSize,
      table_record_limit: tableRecordLimit,
    };
  }

  if (chartType === 'heatmap') {
    return {
      ...preset,
      chart_type: chartType,
      metric: null,
      group_by: null,
      time_bucket: null,
      heatmap_mode: heatmapMode,
      table_columns: null,
      table_page_size: null,
      table_record_limit: null,
    };
  }

  return preset;
}
