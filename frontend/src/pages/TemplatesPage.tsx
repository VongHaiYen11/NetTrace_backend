import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { LayoutTemplate } from 'lucide-react';
import { nettraceApi } from '../services/generated/nettrace-api';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StateBlock } from '../components/shared/StateBlock';

export function TemplatesPage() {
  const templates = useQuery({
    queryKey: ['templates'],
    queryFn: () => nettraceApi.listTemplates({ limit: 50, offset: 0 }),
  });

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-muted">
          <LayoutTemplate size={16} />
          Dashboard templates
        </div>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Saved layouts</h1>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">Templates</h2>
        </CardHeader>
        <CardContent>
          {templates.isLoading ? (
            <StateBlock state="loading" title="Loading templates" />
          ) : templates.isError ? (
            <StateBlock
              state="error"
              title="No template data"
              description="The template endpoint did not return a valid response."
            />
          ) : templates.data?.data.length === 0 ? (
            <StateBlock title="No templates yet" description="No dashboard templates have been created." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {templates.data?.data.map((template) => (
                <article key={template.template_id} className="rounded border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{template.name}</h3>
                      <p className="mt-1 text-sm text-muted">
                        Updated{' '}
                        {formatDistanceToNow(parseISO(template.time_updated), {
                          addSuffix: true,
                          locale: enUS,
                        })}
                      </p>
                    </div>
                    <Badge tone="blue">{template.number_of_widgets} widgets</Badge>
                  </div>
                  {template.selected_cards ? (
                    <p className="mt-3 line-clamp-2 text-sm text-muted">{template.selected_cards}</p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
