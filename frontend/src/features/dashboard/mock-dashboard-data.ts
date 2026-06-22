import type {
  Alarm,
  AnalyticsRow,
  SummaryResult,
  WeekdayHeatmapCell,
} from '../../services/generated/nettrace-api';

export const mockSummary: SummaryResult = {
  totalAlarms: 14293,
  activeAlarms: 3,
  closedAlarms: 14290,
  criticalAlarms: 3,
  affectedDevices: 892.4,
};

export const mockYearlyTrend: AnalyticsRow[] = [
  { time_bucket: 'T1', value: 58 },
  { time_bucket: 'T2', value: 116 },
  { time_bucket: 'T3', value: 66 },
  { time_bucket: 'T4', value: 54 },
  { time_bucket: 'T5', value: 79 },
  { time_bucket: 'T6', value: 137 },
  { time_bucket: 'T7', value: 71 },
  { time_bucket: 'T8', value: 52 },
  { time_bucket: 'T9', value: 93 },
  { time_bucket: 'T10', value: 148 },
  { time_bucket: 'T11', value: 144 },
  { time_bucket: 'T12', value: 138 },
];

export const mockWeeklyTrend: AnalyticsRow[] = [
  { label: 'T2', value: 32 },
  { label: 'T3', value: 52 },
  { label: 'T4', value: 24 },
  { label: 'T5', value: 68 },
  { label: 'T6', value: 40 },
  { label: 'T7', value: 76 },
  { label: 'CN', value: 56 },
];

export const mockSeverityDistribution: AnalyticsRow[] = [
  { severity: 'Critical', value: 72 },
  { severity: 'Major', value: 24 },
  { severity: 'Minor', value: 4 },
];

const heatmapMatrix: Record<string, number[]> = {
  Monday: [18, 42, 66, 28],
  Tuesday: [26, 52, 78, 36],
  Wednesday: [20, 38, 54, 18],
  Thursday: [44, 86, 102, 62],
  Friday: [30, 68, 72, 26],
  Saturday: [16, 24, 34, 12],
  Sunday: [14, 22, 30, 10],
};

export const mockHeatmap: WeekdayHeatmapCell[] = Object.entries(heatmapMatrix).flatMap(
  ([day, values]) =>
    [0, 6, 12, 18].map((hour, index) => ({
      x: hour,
      y: day,
      value: values[index],
    })),
);

export const mockAlarms: Alarm[] = [
  {
    alarm_id: 'mock-001',
    error_code: 'ERR_FIREWALL_BREACH',
    error_details: {
      error_code: 'ERR_FIREWALL_BREACH',
      name: 'Firewall attack detected',
      description: 'Firewall bypass attempt detected.',
      domain: 'Security',
      default_severity: 'critical',
    },
    device_id: 'FW-HN-01',
    time_created: '2026-06-22T10:42:05.000Z',
    time_solved: null,
    status: 'active',
    severity: 'critical',
    description: 'Firewall attack detected',
  },
  {
    alarm_id: 'mock-002',
    error_code: 'INFO_DATA_SYNC',
    error_details: {
      error_code: 'INFO_DATA_SYNC',
      name: 'Data sync complete',
      description: 'Data sync completed.',
      domain: 'System',
      default_severity: 'info',
    },
    device_id: 'SYNC-HN-02',
    time_created: '2026-06-22T10:38:12.000Z',
    time_solved: '2026-06-22T10:38:20.000Z',
    status: 'closed',
    severity: 'info',
    description: 'Data sync complete',
  },
  {
    alarm_id: 'mock-003',
    error_code: 'INFO_SYSTEM_UPDATE',
    error_details: {
      error_code: 'INFO_SYSTEM_UPDATE',
      name: 'System update deployed',
      description: 'System update deployed successfully.',
      domain: 'System',
      default_severity: 'info',
    },
    device_id: 'CORE-HN-01',
    time_created: '2026-06-22T10:15:00.000Z',
    time_solved: '2026-06-22T10:16:00.000Z',
    status: 'closed',
    severity: 'info',
    description: 'System update deployed',
  },
];
