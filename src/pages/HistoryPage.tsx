import { useMemo, useState } from 'react';
import {
  Database,
  DollarSign,
  History,
  Layers,
  Package,
  Search,
  Trash2,
  Truck,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useStore } from '@/context/StoreContext';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime, normalizeText } from '@/utils/format';
import type { ActivityKind } from '@/types';

type Filter = 'todo' | 'precios' | 'stock' | 'productos' | 'datos';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'precios', label: 'Precios' },
  { value: 'stock', label: 'Stock' },
  { value: 'productos', label: 'Productos' },
  { value: 'datos', label: 'Datos' },
];

function matchesFilter(kind: ActivityKind, filter: Filter): boolean {
  switch (filter) {
    case 'precios':
      return kind === 'precio.modificado';
    case 'stock':
      return kind === 'stock.movimiento';
    case 'productos':
      return kind.startsWith('producto.');
    case 'datos':
      return kind.startsWith('datos.') || kind.startsWith('categoria.') || kind.startsWith('proveedor.');
    default:
      return true;
  }
}

function iconFor(kind: ActivityKind) {
  if (kind === 'precio.modificado') return DollarSign;
  if (kind === 'stock.movimiento') return Package;
  if (kind.startsWith('categoria.')) return Layers;
  if (kind.startsWith('proveedor.')) return Truck;
  if (kind === 'producto.eliminado') return Trash2;
  if (kind.startsWith('datos.')) return Database;
  return Package;
}

function toneFor(kind: ActivityKind): string {
  if (kind === 'precio.modificado')
    return 'bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400';
  if (kind === 'stock.movimiento')
    return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400';
  if (kind === 'producto.eliminado') return 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400';
  return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
}

/** Agrupa por día para que el historial se lea como una línea de tiempo. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Hoy';
  if (sameDay(date, yesterday)) return 'Ayer';
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export function HistoryPage() {
  const { activity } = useStore();
  const [filter, setFilter] = useState<Filter>('todo');
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 150);

  const grouped = useMemo(() => {
    const q = normalizeText(debounced);
    const filtered = activity.filter(
      (item) => matchesFilter(item.kind, filter) && (!q || normalizeText(item.message).includes(q)),
    );
    const groups = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const key = dayLabel(item.date);
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [activity, filter, debounced]);

  const total = grouped.reduce((sum, [, items]) => sum + items.length, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
          Historial de actividad
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {total} evento{total === 1 ? '' : 's'} registrado{total === 1 ? '' : 's'}
        </p>
      </div>

      <Card className="p-3 sm:p-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <label htmlFor="history-search" className="sr-only">
            Buscar en el historial
          </label>
          <input
            id="history-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en el historial…"
            className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm focus-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filtrar historial">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-ring ${
                filter === f.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {grouped.length === 0 ? (
        <Card>
          <EmptyState
            icon={<History className="h-7 w-7" aria-hidden />}
            title="Sin actividad"
            description={
              activity.length === 0
                ? 'Cada vez que cambies un precio, ajustes stock o crees un producto, va a quedar registrado acá.'
                : 'No hay eventos que coincidan con la búsqueda o el filtro aplicado.'
            }
          />
        </Card>
      ) : (
        <div data-tour="lista-historial" className="space-y-4">
          {grouped.map(([day, items]) => (
            <Card key={day} className="overflow-hidden">
              <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400 sm:px-5">
                {day}
              </h2>
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {items.map((item) => {
                  const Icon = iconFor(item.kind);
                  return (
                    <li key={item.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneFor(item.kind)}`}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <p className="flex-1 text-sm text-slate-700 dark:text-slate-300">{item.message}</p>
                      <time
                        dateTime={item.date}
                        className="shrink-0 text-xs text-slate-400 dark:text-slate-500"
                      >
                        {formatDateTime(item.date).split(' · ')[1]}
                      </time>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
