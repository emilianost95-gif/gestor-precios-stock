import { AlertTriangle, ArrowRight, Check, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCurrency } from '@/hooks/useCurrency';
import type { ActionPreview } from '@/services/copilot';
import { formatNumber } from '@/utils/format';

interface ActionPreviewCardProps {
  preview: ActionPreview;
  state: 'pendiente' | 'aplicada' | 'cancelada';
  onApply: () => void;
  onDismiss: () => void;
}

const PREVIEW_ROWS = 6;

/**
 * Vista previa de una acción propuesta por el Copilot.
 * Nada se ejecuta hasta que el usuario toca "Aplicar cambios" y confirma.
 */
export function ActionPreviewCard({ preview, state, onApply, onDismiss }: ActionPreviewCardProps) {
  const { money } = useCurrency();
  const isPrice = preview.action.type === 'precio-masivo';
  const format = (value: number) => (isPrice ? money(value) : formatNumber(value));

  if (!preview.executable) {
    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
        {preview.description}
      </div>
    );
  }

  const visible = preview.items.slice(0, PREVIEW_ROWS);
  const rest = preview.items.length - visible.length;
  const totalDelta = preview.totalAfter - preview.totalBefore;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-brand-200 bg-brand-50/60 dark:border-brand-900/70 dark:bg-brand-950/30">
      <div className="flex items-start gap-2.5 px-3.5 py-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
          <ShieldCheck className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{preview.title}</p>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{preview.description}</p>
        </div>
      </div>

      <div className="border-y border-brand-200/70 bg-white/70 px-3.5 py-2.5 dark:border-brand-900/50 dark:bg-slate-900/60">
        <ul className="space-y-1.5">
          {visible.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">{item.name}</span>
              <span className="shrink-0 tabular-nums text-slate-400 line-through dark:text-slate-500">
                {format(item.before)}
              </span>
              <ArrowRight className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
              <span
                className={`shrink-0 font-semibold tabular-nums ${
                  item.delta > 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-700 dark:text-red-400'
                }`}
              >
                {format(item.after)}
              </span>
            </li>
          ))}
        </ul>
        {rest > 0 && (
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            y {rest} producto{rest === 1 ? '' : 's'} más con el mismo criterio.
          </p>
        )}
        {isPrice && preview.totalBefore > 0 && (
          <p className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Venta potencial de esos productos: {money(preview.totalBefore)} →{' '}
            <strong className="text-slate-700 dark:text-slate-200">{money(preview.totalAfter)}</strong> (
            {totalDelta >= 0 ? '+' : ''}
            {money(totalDelta)})
          </p>
        )}
      </div>

      {preview.warnings.length > 0 && (
        <ul className="space-y-1 px-3.5 py-2.5">
          {preview.warnings.map((warning, index) => (
            <li
              key={index}
              className="flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-300"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              {warning}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 px-3.5 py-3">
        {state === 'pendiente' ? (
          <>
            <Button size="sm" variant="secondary" onClick={onDismiss}>
              Cancelar
            </Button>
            <Button size="sm" onClick={onApply}>
              Aplicar cambios
            </Button>
          </>
        ) : state === 'aplicada' ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <Check className="h-4 w-4" aria-hidden />
            Cambios aplicados
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <X className="h-4 w-4" aria-hidden />
            Acción cancelada, no se modificó nada
          </p>
        )}
      </div>
    </div>
  );
}
