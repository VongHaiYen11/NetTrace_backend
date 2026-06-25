import { AlertTriangle, MoreHorizontal, RadioTower, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/Card';
import { StateBlock } from '../../../components/shared/StateBlock';
import type { SummaryResult } from '../../../services/generated/nettrace-api';
import { cn } from '../../../utils/cn';

interface KpiGridProps {
  data?: SummaryResult;
  isLoading: boolean;
  isError: boolean;
}

const cards = [
  {
    key: 'totalAlarms',
    label: 'Alarm count',
    icon: RadioTower,
    subtitle: (data: SummaryResult) =>
      `${data.activeAlarms.toLocaleString('vi-VN')} active · ${data.closedAlarms.toLocaleString(
        'vi-VN',
      )} closed`,
  },
  {
    key: 'affectedDevices',
    label: 'Affected devices',
    icon: TrendingUp,
    subtitle: (data: SummaryResult) =>
      `${data.affectedDevices.toLocaleString('vi-VN')} unique devices`,
  },
  {
    key: 'criticalAlarms',
    label: 'Current status',
    icon: AlertTriangle,
    subtitle: (data: SummaryResult) =>
      `${data.criticalAlarms.toLocaleString('vi-VN')} critical alarms`,
  },
] as const;

function getKpiStatusTone(ratio: number, inverse = false) {
  const score = inverse ? 1 - ratio : ratio;
  if (score >= 0.8) {
    return {
      border: 'border-primary/80',
      iconBg: 'bg-primary/18',
      tone: 'text-primary-light',
      valueClass: 'text-primary-light drop-shadow-glow-primary',
    };
  }
  if (score >= 0.5) {
    return {
      border: 'border-warning/75',
      iconBg: 'bg-warning/15',
      tone: 'text-warning',
      valueClass: 'text-warning drop-shadow-glow-warning',
    };
  }
  return {
    border: 'border-secondary/70',
    iconBg: 'bg-secondary/15',
    tone: 'text-secondary',
    valueClass: 'text-secondary drop-shadow-glow-secondary',
  };
}

export function KpiGrid({ data, isLoading, isError }: KpiGridProps) {
  if (isLoading) {
    return <StateBlock state="loading" title="Loading overview" />;
  }

  if (isError || !data) {
    return (
      <StateBlock
        state="error"
        title="No overview data"
        description="Backend returned no KPI data for the current filter."
      />
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-3" aria-label="KPI overview">
      {cards.map((card) => {
        const Icon = card.icon;
        const totalAlarms = Math.max(data.totalAlarms, 1);
        const alarmHealthTone = getKpiStatusTone(data.criticalAlarms / totalAlarms);
        const tone =
          card.key === 'totalAlarms'
            ? alarmHealthTone
            : card.key === 'criticalAlarms'
              ? alarmHealthTone
              : getKpiStatusTone(0);
        const value =
          card.key === 'criticalAlarms' && data.criticalAlarms > 0
            ? 'Warning'
            : data[card.key].toLocaleString('vi-VN');
        return (
          <Card key={card.key} className={tone.border}>
            <CardContent className="min-h-[136px] pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm text-muted">{card.label}</p>
                  <p className={cn('mt-3 text-3xl font-black tabular-nums', tone.valueClass)}>
                    {value}
                  </p>
                  <p className="mt-4 text-sm text-muted">
                    {card.subtitle(data)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <MoreHorizontal className="text-muted" size={20} />
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded', tone.iconBg)}>
                    <Icon className={tone.tone} size={20} />
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
