import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { nettraceApi } from '../../../services/generated/nettrace-api';
import type { DashboardFilters } from '../types';

export function useDashboardData(filters: DashboardFilters) {
  const queryFilters = useMemo(() => filters, [filters]);

  const summary = useQuery({
    queryKey: ['summary', queryFilters],
    queryFn: () => nettraceApi.getSummary(queryFilters),
  });

  const trend = useQuery({
    queryKey: ['analytics', 'trend', queryFilters],
    queryFn: () =>
      nettraceApi.analyticsQuery({
        metric: 'count',
        group_by: [],
        time_bucket: 'day',
        filters: queryFilters,
        limit: 90,
      }),
  });

  const severity = useQuery({
    queryKey: ['analytics', 'severity', queryFilters],
    queryFn: () =>
      nettraceApi.analyticsQuery({
        metric: 'count',
        group_by: ['severity'],
        time_bucket: null,
        filters: queryFilters,
        limit: 10,
      }),
  });

  const heatmap = useQuery({
    queryKey: ['heatmap', 'weekday', queryFilters],
    queryFn: () =>
      nettraceApi.heatmap({
        mode: 'weekday',
        filters: queryFilters,
      }),
  });

  const alarms = useQuery({
    queryKey: ['alarms', queryFilters],
    queryFn: () =>
      nettraceApi.queryAlarms({
        ...queryFilters,
        offset: 0,
        limit: 25,
        sort_by: queryFilters.sort_by ?? 'timestamp',
        sort_order: queryFilters.sort_order ?? 'desc',
        detail_level: 'compact',
      }),
  });

  return {
    summary,
    trend,
    severity,
    heatmap,
    alarms,
  };
}
