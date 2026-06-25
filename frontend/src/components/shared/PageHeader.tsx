import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface PageHeaderProps {
  title: string;
  accent?: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, accent, description, action, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between',
        className,
      )}
    >
      <div className="max-w-4xl">
        <h1 className="capitalize text-4xl font-black leading-tight tracking-normal text-bright sm:text-5xl">
          {title}
          {accent ? (
            <>
              {' '}
              <span className="text-secondary drop-shadow-glow-secondary">
                {accent}
              </span>
            </>
          ) : null}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
