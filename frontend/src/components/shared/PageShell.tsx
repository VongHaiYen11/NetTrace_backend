import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div
      className={cn(
        'mx-auto flex min-h-screen w-full flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8',
        className,
      )}
    >
      {children}
    </div>
  );
}
