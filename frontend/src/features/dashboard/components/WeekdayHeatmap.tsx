import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { StateBlock } from '../../../components/shared/StateBlock';
import type { WeekdayHeatmapCell } from '../../../services/generated/nettrace-api';

interface WeekdayHeatmapProps {
  data?: WeekdayHeatmapCell[];
  isLoading: boolean;
  isError: boolean;
}

const dayKeys = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const timeRows = [0, 6, 12, 18];

function readHeatmapValue(params: unknown) {
  const firstParam = Array.isArray(params) ? params[0] : params;
  if (!firstParam || typeof firstParam !== 'object' || !('value' in firstParam)) {
    return [0, 0, 0] as const;
  }

  const rawValue = (firstParam as { value?: unknown }).value;
  if (!Array.isArray(rawValue)) {
    return [0, 0, 0] as const;
  }

  const [x, y, value] = rawValue.map((item) => Number(item));
  return [x || 0, y || 0, value || 0] as const;
}

export function WeekdayHeatmap({ data, isLoading, isError }: WeekdayHeatmapProps) {
  const cells = data ?? [];
  const max = cells.reduce((current, cell) => Math.max(current, cell.value), 0);
  const byKey = new Map(cells.map((cell) => [`${cell.y}-${cell.x}`, cell.value]));
  const heatmapData = timeRows.flatMap((hour, yIndex) =>
    dayKeys.map((day, xIndex) => [xIndex, yIndex, byKey.get(`${day}-${hour}`) ?? 0]),
  );

  const option: EChartsOption = {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: {
      position: 'top',
      backgroundColor: '#0c0b14',
      borderColor: 'rgba(255, 45, 133, 0.45)',
      borderWidth: 1,
      textStyle: {
        color: '#f3edff',
      },
      formatter: (params: unknown) => {
        const [x, y, value] = readHeatmapValue(params);
        const day = dayLabels[x] ?? '';
        const hour = timeRows[y] ?? 0;
        return `<strong style="color:#00f5d4">${day} ${String(hour).padStart(
          2,
          '0',
        )}:00</strong><br/>${value.toLocaleString('vi-VN')} alarms`;
      },
    },
    grid: {
      left: 48,
      right: 16,
      top: 12,
      bottom: 24,
      containLabel: false,
    },
    xAxis: {
      type: 'category',
      data: dayLabels,
      splitArea: {
        show: true,
        areaStyle: {
          color: ['transparent'],
        },
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#a69db6',
        fontSize: 11,
      },
    },
    yAxis: {
      type: 'category',
      data: timeRows.map((hour) => `${String(hour).padStart(2, '0')}:00`),
      splitArea: {
        show: true,
        areaStyle: {
          color: ['transparent'],
        },
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#a69db6',
        fontSize: 11,
      },
    },
    visualMap: {
      show: false,
      min: 0,
      max,
      inRange: {
        color: ['#211326', '#3b1835', '#7f1d52', '#c72570', '#ff2d85'],
      },
    },
    series: [
      {
        type: 'heatmap',
        data: heatmapData,
        label: { show: false },
        emphasis: {
          itemStyle: {
            borderColor: '#00f5d4',
            borderWidth: 1,
            shadowBlur: 12,
            shadowColor: 'rgba(0, 245, 212, 0.35)',
          },
        },
        itemStyle: {
          borderColor: '#151421',
          borderWidth: 3,
          borderRadius: 2,
        },
      },
    ],
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-bold">Heatmap</h2>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <StateBlock state="loading" title="Loading heatmap" />
        ) : isError || cells.length === 0 ? (
          <StateBlock title="No heatmap data" description="No daily density cells returned." />
        ) : (
          <ReactECharts
            option={option}
            notMerge
            lazyUpdate
            style={{ height: 260, width: '100%' }}
            opts={{ renderer: 'canvas' }}
          />
        )}
      </CardContent>
    </Card>
  );
}
