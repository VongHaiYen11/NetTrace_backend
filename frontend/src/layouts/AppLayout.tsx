import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  BarChart3,
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

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/alarms', label: 'Alarm explorer', icon: Siren },
  { to: '/templates', label: 'Templates & presets', icon: BarChart3 },
  { to: '/export', label: 'Export data', icon: Download },
];

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches,
  );

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
    <div className="min-h-screen text-[#f3edff]">
      <div className="flex">
        <aside
          className={cn(
            'sticky top-0 z-40 h-screen shrink-0 border-r border-white/10 bg-[#090911] py-6 transition-[width] duration-200',
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
              <span className="flex h-10 w-10 items-center justify-center rounded border border-[#ff2d85] bg-[#ff2d85]/10 text-[#ff2d85]">
                <Activity size={20} />
              </span>
              <div className={cn(!sidebarOpen && 'hidden')}>
                <p className="text-base font-semibold leading-tight">NetTrace</p>
                <p className="text-xs font-semibold text-[#00f5d4]">v1.0</p>
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
                      'flex h-11 items-center rounded text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[#00f5d4]',
                      sidebarOpen ? 'gap-3 px-3' : 'justify-center px-0',
                      isActive
                        ? 'border border-[#ff2d85] bg-[#ff2d85]/20 text-[#ff2d85]'
                        : 'text-[#a69db6] hover:bg-white/5 hover:text-white',
                    )
                  }
                >
                  <Icon size={18} />
                  <span className={cn(!sidebarOpen && 'hidden')}>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-8 border-t border-white/10 pt-5">
            <div
              className={cn(
                'flex items-start rounded border border-white/10 bg-white/[0.03] p-3',
                sidebarOpen ? 'gap-3' : 'justify-center',
              )}
              title={!sidebarOpen ? 'API source' : undefined}
            >
              <Settings2 className="mt-0.5 text-[#a69db6]" size={17} />
              <div className={cn(!sidebarOpen && 'hidden')}>
                <p className="text-sm font-medium">API source</p>
                <p className="mt-1 text-xs leading-5 text-[#a69db6]">Backend OpenAPI routes at /api/v1.</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 transition-[width] duration-200">
          <Outlet context={{ sidebarOpen }} />
        </main>
      </div>
    </div>
  );
}
