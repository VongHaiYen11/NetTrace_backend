import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { StateBlock } from '../../../components/shared/StateBlock';
import type { Alarm } from '../../../services/generated/nettrace-api';

interface AlarmTableProps {
  data?: Alarm[];
  isLoading: boolean;
  isError: boolean;
}

function severityTone(severity: string) {
  const normalized = severity.toLowerCase();
  if (normalized === 'critical') return 'red';
  if (normalized === 'major' || normalized === 'warning') return 'amber';
  if (normalized === 'minor' || normalized === 'info') return 'blue';
  return 'neutral';
}

const columns: ColumnDef<Alarm>[] = [
  {
    header: 'TIME',
    accessorKey: 'time_created',
    cell: ({ row }) => {
      try {
        return (
          <span className="font-mono text-[#a69db6]">
            {format(parseISO(row.original.time_created), 'HH:mm:ss')}
          </span>
        );
      } catch {
        return row.original.time_created;
      }
    },
  },
  {
    header: 'TYPE',
    accessorKey: 'error_code',
    cell: ({ row }) =>
      row.original.error_details?.name ?? row.original.description ?? row.original.error_code,
  },
  {
    header: 'STATUS',
    accessorKey: 'status',
    cell: ({ row }) => (
      <Badge tone={row.original.status.toLowerCase() === 'active' ? 'amber' : 'green'}>
        {row.original.status.toLowerCase() === 'active' ? 'Active' : 'Closed'}
      </Badge>
    ),
  },
];

export function AlarmTable({ data, isLoading, isError }: AlarmTableProps) {
  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Card>
      <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Alarm list</h2>
            <span className="font-mono text-lg leading-none text-[#a69db6]">•••</span>
          </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <StateBlock state="loading" title="Loading alarms" />
        ) : isError || !data ? (
          <StateBlock
            state="error"
            title="No alarm data"
            description="The alarm detail endpoint did not return a valid response."
          />
        ) : data.length === 0 ? (
          <StateBlock title="No alarms" description="No alarms match the current filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="border-b border-white/10 px-3 py-3 font-mono text-xs font-semibold uppercase tracking-normal text-[#a69db6]"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.03]">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="border-b border-white/10 px-3 py-3 text-[#cfc7dc]">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
