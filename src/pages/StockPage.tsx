import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, PackageX, Search } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useStore } from '@/context/StoreContext';
import { useProductActions } from '@/context/ProductActionsContext';
import { useDashboardData } from '@/hooks/useProducts';
import { useDebounce } from '@/hooks/useDebounce';
import { MOVEMENT_TYPES, type MovementType } from '@/types';
import { formatDateTime, formatNumber, normalizeText } from '@/utils/format';

type Tab = 'alertas' | 'movimientos';

const TYPE_TONE: Record<MovementType, string> = {
  entrada: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  venta: 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
  ajuste: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  devolucion: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
};

export function StockPage() {
  const { loading, movements } = useStore();
  const { editStock } = useProductActions();
  const { lowStock, outOfStock, stats } = useDashboardData();

  const [tab, setTab] = useState<Tab>('alertas');
  const [typeFilter, setTypeFilter] = useState<MovementType | 'todos'>('todos');
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 150);

  const filteredMovements = useMemo(() => {
    const q = normalizeText(debounced);
    return movements.filter((m) => {
      if (typeFilter !== 'todos' && m.type !== typeFilter) return false;
      if (q && !normalizeText(m.productName).includes(q)) return false;
      return true;
    });
  }, [movements, typeFilter, debounced]);

  if (loading) return <Card><ListSkeleton rows={6} /></Card>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
          Stock y alertas
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {stats.outOfStockCount} sin stock · {stats.lowStockCount} por debajo del mínimo ·{' '}
          {movements.length} movimientos registrados
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Secciones de stock"
        className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900"
      >
        {(
          [
            { id: 'alertas', label: 'Alertas' },
            { id: 'movimientos', label: 'Movimientos' },
          ] as { id: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition focus-ring ${
              tab === t.id
                ? 'bg-brand-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'alertas' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Sin stock"
              subtitle="Productos agotados que hay que reponer ya"
              icon={<PackageX className="h-4 w-4" aria-hidden />}
            />
            {outOfStock.length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Ningún producto está agotado.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {outOfStock.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                      <PackageX className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{p.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Mínimo sugerido: {formatNumber(p.minStock)} · {p.categoryName}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => editStock(p)}>
                      Reponer
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Stock bajo"
              subtitle="Están por debajo del mínimo que definiste"
              icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
            />
            {lowStock.length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Todo el stock está por encima del mínimo.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {lowStock.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{p.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Stock: <strong className="text-amber-600 dark:text-amber-400">{formatNumber(p.stock)}</strong>{' '}
                        · Mínimo: {formatNumber(p.minStock)}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => editStock(p)}>
                      Reponer
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-800 sm:flex-row sm:items-center sm:p-4">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <label htmlFor="movements-search" className="sr-only">
                Buscar movimientos por producto
              </label>
              <input
                id="movements-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por producto…"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm focus-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="movements-type" className="sr-only">
                Filtrar por tipo de movimiento
              </label>
              <select
                id="movements-type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as MovementType | 'todos')}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:w-44"
              >
                <option value="todos">Todos los tipos</option>
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredMovements.length === 0 ? (
            <EmptyState
              icon={<ArrowRight className="h-7 w-7" aria-hidden />}
              title="Sin movimientos"
              description={
                movements.length === 0
                  ? 'Cuando cargues o descuentes stock, cada movimiento va a quedar registrado acá.'
                  : 'No hay movimientos que coincidan con el filtro aplicado.'
              }
            />
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredMovements.slice(0, 200).map((m) => {
                const label = MOVEMENT_TYPES.find((t) => t.value === m.type)?.label ?? m.type;
                const delta = m.resultingStock - m.previousStock;
                return (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_TONE[m.type]}`}
                    >
                      {label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {m.productName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatNumber(m.previousStock)} → {formatNumber(m.resultingStock)}
                        {m.note ? ` · ${m.note}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-sm font-semibold tabular-nums ${
                          delta > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : delta < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-slate-500'
                        }`}
                      >
                        {delta > 0 ? '+' : ''}
                        {formatNumber(delta)}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(m.date)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
