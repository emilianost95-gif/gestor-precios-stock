import { useState, type ComponentType } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MoreHorizontal, Plus, X } from 'lucide-react';
import { NAV_ITEMS } from './navigation';
import { useProductActions } from '@/context/ProductActionsContext';
import { useDashboardData } from '@/hooks/useProducts';

export function BottomNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { newProduct } = useProductActions();
  const { stats } = useDashboardData();
  const location = useLocation();
  const alerts = stats.lowStockCount + stats.outOfStockCount;

  const primary = NAV_ITEMS.filter((i) => i.primary);
  const secondary = NAV_ITEMS.filter((i) => !i.primary);
  const secondaryActive = secondary.some((i) => location.pathname.startsWith(i.to));

  return (
    <>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-slate-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-pop animate-slide-up dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Más secciones</h2>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Cerrar menú"
                className="rounded-lg p-2 text-slate-400 focus-ring"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {secondary.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium transition focus-ring ${
                      isActive
                        ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/60 dark:text-brand-300'
                        : 'border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-200'
                    }`
                  }
                >
                  <item.icon className="h-5 w-5" aria-hidden />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-center">
          {primary.slice(0, 2).map((item) => (
            <NavItemButton key={item.to} to={item.to} label={item.shortLabel} Icon={item.icon} />
          ))}

          <div className="flex items-center justify-center">
            <button
              type="button"
              data-tour="nuevo-producto"
              onClick={newProduct}
              aria-label="Agregar producto nuevo"
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-pop transition active:scale-95 focus-ring"
            >
              <Plus className="h-6 w-6" aria-hidden />
            </button>
          </div>

          {primary.slice(2).map((item) => (
            <NavItemButton
              key={item.to}
              to={item.to}
              label={item.shortLabel}
              Icon={item.icon}
              badge={item.to === '/stock' ? alerts : 0}
            />
          ))}

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            className={`flex h-full flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition focus-ring ${
              secondaryActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
            Más
          </button>
        </div>
      </nav>
    </>
  );
}

interface NavItemButtonProps {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  badge?: number;
}

function NavItemButton({ to, label, Icon, badge = 0 }: NavItemButtonProps) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `relative flex h-full flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition focus-ring ${
          isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
        }`
      }
    >
      <span className="relative">
        <Icon className="h-5 w-5" />
        {badge > 0 && (
          <span className="absolute -right-2 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      {label}
    </NavLink>
  );
}
