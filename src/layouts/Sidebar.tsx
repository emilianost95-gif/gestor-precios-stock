import { NavLink } from 'react-router-dom';
import { AlertTriangle, Store } from 'lucide-react';
import { NAV_ITEMS } from './navigation';
import { useStore } from '@/context/StoreContext';
import { useDashboardData } from '@/hooks/useProducts';

export function Sidebar() {
  const { settings } = useStore();
  const { stats } = useDashboardData();
  const alerts = stats.lowStockCount + stats.outOfStockCount;

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Store className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
            {settings.businessName || 'Mi negocio'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Precios y stock</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Navegación principal">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus-ring ${
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`
            }
          >
            <item.icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {item.to === '/stock' && alerts > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {alerts}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {alerts > 0 && (
        <div className="m-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/40">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            Atención al stock
          </p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400/90">
            {stats.lowStockCount} con stock bajo y {stats.outOfStockCount} sin stock.
          </p>
        </div>
      )}

      <p className="px-5 pb-4 text-[11px] text-slate-400 dark:text-slate-600">
        Datos guardados en este dispositivo · v1.0
      </p>
    </aside>
  );
}
