export interface BarListItem {
  label: string;
  value: number;
  color?: string;
  hint?: string;
}

interface BarListProps {
  items: BarListItem[];
  formatValue?: (value: number) => string;
  emptyMessage?: string;
}

/**
 * Gráfico de barras horizontales en HTML puro: legible, accesible y sin
 * librerías. Suficiente para el nivel de detalle que necesita un almacén.
 */
export function BarList({ items, formatValue = (v) => String(v), emptyMessage }: BarListProps) {
  const max = Math.max(...items.map((i) => i.value), 1);

  if (items.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        {emptyMessage ?? 'Todavía no hay datos para mostrar.'}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const percent = Math.max(2, Math.round((item.value / max) * 100));
        return (
          <li key={item.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm text-slate-700 dark:text-slate-300">{item.label}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatValue(item.value)}
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
              role="img"
              aria-label={`${item.label}: ${formatValue(item.value)}`}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${percent}%`, backgroundColor: item.color ?? '#2f82ff' }}
              />
            </div>
            {item.hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{item.hint}</p>}
          </li>
        );
      })}
    </ul>
  );
}
