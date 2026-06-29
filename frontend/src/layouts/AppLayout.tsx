import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  BarChart2,
  Download,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Siren,
  Settings2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/cn';
import type { DashboardWidgetConfig } from '../features/dashboard/components/GeneralSettingsDrawer';

export interface AppOutletContext {
  sidebarOpen: boolean;
  dashboardWidgets: DashboardWidgetConfig[];
  setDashboardWidgets: React.Dispatch<React.SetStateAction<DashboardWidgetConfig[]>>;
  activeTemplate: { id: string; name: string } | null;
  setActiveTemplate: React.Dispatch<React.SetStateAction<{ id: string; name: string } | null>>;
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: BarChart2 },
  { to: '/alarms', label: 'Alarm Explorer', icon: Siren },
  { to: '/templates', label: 'Templates & Presets', icon:  LayoutDashboard},
  { to: '/export', label: 'Export Data', icon: Download },
];

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches,
  );
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidgetConfig[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const syncSidebar = (event: MediaQueryListEvent | MediaQueryList) => {
      if (!event.matches) {
        setSidebarOpen(false);
      }
    };

    syncSidebar(mediaQuery);
    mediaQuery.addEventListener('change', syncSidebar);
    return () => mediaQuery.removeEventListener('change', syncSidebar);
  }, []);

  return (
    <div className="min-h-screen text-light">
      <div className="flex">
        <aside
          className={cn(
            'sticky top-0 z-40 h-screen shrink-0 border-r border-white/10 bg-background-alt py-6 transition-[width] duration-200',
            sidebarOpen ? 'w-64 px-4' : 'w-20 px-3',
          )}
        >
          <div
            className={cn(
              'mb-8 flex items-center',
              sidebarOpen ? 'justify-between' : 'justify-center',
            )}
          >
            <div className={cn('flex items-center gap-3', !sidebarOpen && 'justify-center')}>
              <span className="flex h-10 w-10 items-center justify-center rounded border border-primary bg-primary/10 text-primary">
                <Activity size={20} />
              </span>
              <div className={cn(!sidebarOpen && 'hidden')}>
                <p className="text-base font-semibold leading-tight">NetTrace</p>
                <p className="text-xs font-semibold text-secondary">v1.0</p>
              </div>
            </div>
            <Button
              className={cn(!sidebarOpen && 'absolute left-1/2 top-[76px] -translate-x-1/2')}
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen((value) => !value)}
            >
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
              <span className="sr-only">
                {sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              </span>
            </Button>
          </div>

          <nav className={cn('space-y-1', !sidebarOpen && 'mt-16')} aria-label="Main navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={!sidebarOpen ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex h-11 items-center rounded text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-secondary',
                      sidebarOpen ? 'gap-3 px-3' : 'justify-center px-0',
                      isActive
                        ? 'border border-primary bg-primary/20 text-primary'
                        : 'text-muted hover:bg-white/5 hover:text-white',
                    )
                  }
                >
                  <Icon size={18} />
                  <span className={cn(!sidebarOpen && 'hidden')}>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          
        </aside>

        <main className="min-w-0 flex-1 transition-[width] duration-200">
          <Outlet
            context={{
              sidebarOpen,
              dashboardWidgets,
              setDashboardWidgets,
              activeTemplate,
              setActiveTemplate,
            } satisfies AppOutletContext}
          />
        </main>
      </div>
    </div>
  );
}
