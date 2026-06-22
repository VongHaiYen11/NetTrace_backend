import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/Button';
import { nettraceApi, type CommonFilters } from '../../../services/generated/nettrace-api';

interface ExportActionsProps {
  filters: CommonFilters;
}

export function ExportActions({ filters }: ExportActionsProps) {
  async function downloadCsv() {
    try {
      const blob = await nettraceApi.exportAlarms({
        format: 'csv',
        columns: ['alarm_id', 'time_created', 'severity', 'status', 'device_id', 'error_code'],
        filters: {
          ...filters,
          sort_by: 'timestamp',
          sort_order: 'desc',
          limit: 1000,
        },
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'nettrace-alarms.csv';
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Export started');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not export alarms.';
      toast.error(message);
    }
  }

  return (
    <Button variant="secondary" onClick={downloadCsv}>
      <Download size={16} />
      Export CSV
    </Button>
  );
}
