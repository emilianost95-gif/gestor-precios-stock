import type { MovementDayPoint } from '@/services/productService';

interface MovementsChartProps {
  data: MovementDayPoint[];
}

/** Barras agrupadas entradas/salidas de los últimos 7 días. */
export function MovementsChart({ data }: MovementsChartProps) {
  const max = Math.max(...data.flatMap((d) => [d.entradas, d.salidas]), 1);
  const hasData = data.some((d) => d.entradas > 0 || d.salidas > 0);

  if (!hasData) {
    return (
      <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No hubo movimientos de stock en los últimos 7 días.
      </p>
    );
  }

  return (
    <div>
      <div className="flex h-40 items-end gap-2" role="img" aria-label="Movimientos de stock de los últimos 7 días">
        {data.map((point) => (
          <div key={point.date} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-32 w-full items-end justify-center gap-1">
              <div
                title={`Entradas: ${point.entradas}`}
                className="w-2.5 rounded-t bg-emerald-500 transition-all sm:w-3.5"
                style={{ height: `${Math.max(point.entradas ? 6 : 0, (point.entradas / max) * 100)}%` }}
              />
              <div
                title={`Salidas: ${point.salidas}`}
                className="w-2.5 rounded-t bg-brand-500 transition-all sm:w-3.5"
                style={{ height: `${Math.max(point.salidas ? 6 : 0, (point.salidas / max) * 100)}%` }}
              />
            </div>
            <span className="text-[11px] capitalize text-slate-500 dark:text-slate-400">{point.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          Entradas y devoluciones
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden />
          Ventas
        </span>
      </div>
    </div>
  );
}
