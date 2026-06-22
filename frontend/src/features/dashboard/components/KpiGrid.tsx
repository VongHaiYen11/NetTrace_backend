import { AlertTriangle, MoreHorizontal, RadioTower, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/Card';
import { StateBlock } from '../../../components/shared/StateBlock';
import type { SummaryResult } from '../../../services/generated/nettrace-api';

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
    border: 'border-[#ff2d85]/70',
    iconBg: 'bg-[#ff2d85]/20',
    tone: 'text-[#ff2d85]',
    subtitle: (data: SummaryResult) =>
      `${data.activeAlarms.toLocaleString('vi-VN')} active · ${data.closedAlarms.toLocaleString(
        'vi-VN',
      )} closed`,
  },
  {
    key: 'affectedDevices',
    label: 'Affected devices',
    icon: TrendingUp,
    border: 'border-[#00f5d4]/70',
    iconBg: 'bg-[#00f5d4]/15',
    tone: 'text-[#00f5d4]',
    subtitle: (data: SummaryResult) =>
      `${data.affectedDevices.toLocaleString('vi-VN')} unique devices`,
  },
  {
    key: 'criticalAlarms',
    label: 'Current status',
    icon: AlertTriangle,
    border: 'border-[#f8e231]/70',
    iconBg: 'bg-[#f8e231]/15',
    tone: 'text-[#f8e231]',
    subtitle: (data: SummaryResult) =>
      `${data.criticalAlarms.toLocaleString('vi-VN')} critical alarms`,
  },
] as const;

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
        const value =
          card.key === 'criticalAlarms' && data.criticalAlarms > 0
            ? 'Warning'
            : data[card.key].toLocaleString('vi-VN');
        return (
          <Card key={card.key} className={card.border}>
            <CardContent className="min-h-[136px] pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm text-[#a69db6]">{card.label}</p>
                  <p className={card.key === 'criticalAlarms' ? 'mt-3 text-3xl font-black tabular-nums text-[#f8e231] drop-shadow-[0_0_10px_rgba(248,226,49,0.45)]' : 'mt-3 text-3xl font-black tabular-nums text-[#f3edff]'}>
                    {value}
                  </p>
                  <p className="mt-4 text-sm text-[#a69db6]">
                    {card.subtitle(data)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <MoreHorizontal className="text-[#a69db6]" size={20} />
                  <span className={`flex h-10 w-10 items-center justify-center rounded ${card.iconBg}`}>
                    <Icon className={card.tone} size={20} />
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
