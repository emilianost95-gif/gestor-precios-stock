import { Moon, Plus, Store, Sun } from 'lucide-react';
import { GlobalSearch } from '@/components/GlobalSearch';
import { Button } from '@/components/ui/Button';
import { useStore } from '@/context/StoreContext';
import { useProductActions } from '@/context/ProductActionsContext';

export function TopBar() {
  const { settings, updateSettings } = useStore();
  const { newProduct } = useProductActions();

  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 lg:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Store className="h-5 w-5" aria-hidden />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <GlobalSearch />
        </div>

        <button
          type="button"
          onClick={() => updateSettings({ theme: isDark ? 'light' : 'dark' })}
          aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={isDark ? 'Modo claro' : 'Modo oscuro'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-600 transition hover:bg-slate-50 focus-ring dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {isDark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
        </button>

        <Button
          onClick={newProduct}
          icon={<Plus className="h-4 w-4" />}
          className="hidden shrink-0 lg:inline-flex"
        >
          Nuevo producto
        </Button>
      </div>
    </header>
  );
}
