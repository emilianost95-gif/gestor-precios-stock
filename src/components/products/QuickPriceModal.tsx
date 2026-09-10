import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, History, TrendingDown, TrendingUp } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useStore } from '@/context/StoreContext';
import { useToast } from '@/context/ToastContext';
import { useCurrency } from '@/hooks/useCurrency';
import type { Product } from '@/types';
import { formatDateTime } from '@/utils/format';
import { validatePriceInput } from '@/utils/validation';

interface QuickPriceModalProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
}

const QUICK_ADJUSTMENTS = [-10, -5, 5, 10, 15];

export function QuickPriceModal({ open, onClose, product }: QuickPriceModalProps) {
  const { updateSalePrice, priceHistoryFor } = useStore();
  const toast = useToast();
  const { money, symbol } = useCurrency();

  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !product) return;
    setValue(String(product.salePrice));
    setError(undefined);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [open, product]);

  const history = useMemo(
    () => (product ? priceHistoryFor(product.id).slice(0, 5) : []),
    [product, priceHistoryFor],
  );

  const preview = useMemo(() => {
    if (!product) return null;
    const parsed = validatePriceInput(value);
    if (parsed.error) return null;
    const diff = parsed.value - product.salePrice;
    return { newPrice: parsed.value, diff };
  }, [value, product]);

  if (!product) return null;

  const applyPercent = (percent: number) => {
    const base = product.salePrice;
    const next = Math.round((base * (1 + percent / 100)) / 10) * 10;
    setValue(String(next));
    setError(undefined);
  };

  const handleSave = (event?: React.FormEvent) => {
    event?.preventDefault();
    const parsed = validatePriceInput(value);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    if (parsed.value === product.salePrice) {
      toast.info('Sin cambios', 'El precio ingresado es el mismo que el actual.');
      onClose();
      return;
    }
    const previous = product.salePrice;
    updateSalePrice(product.id, parsed.value);
    toast.success(
      'Precio actualizado correctamente',
      `${product.name}: ${money(previous)} → ${money(parsed.value)}`,
    );
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Editar precio"
      description={product.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="quick-price-form">
            Guardar precio
          </Button>
        </>
      }
    >
      <form id="quick-price-form" onSubmit={handleSave} className="space-y-4" noValidate>
        <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Precio actual
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            {money(product.salePrice)}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-price" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Nuevo precio
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-medium text-slate-400">
              {symbol}
            </span>
            <input
              ref={inputRef}
              id="new-price"
              inputMode="decimal"
              autoComplete="off"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(undefined);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'new-price-error' : undefined}
              className={`h-14 w-full rounded-xl border bg-white pl-10 pr-3 text-2xl font-semibold tabular-nums text-slate-900 focus-ring dark:bg-slate-900 dark:text-slate-50 ${
                error ? 'border-red-400 dark:border-red-600' : 'border-slate-300 dark:border-slate-700'
              }`}
            />
          </div>
          {error && (
            <p id="new-price-error" role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_ADJUSTMENTS.map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => applyPercent(percent)}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:text-brand-600 focus-ring dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-600 dark:hover:text-brand-400"
            >
              {percent > 0 ? `+${percent}%` : `${percent}%`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setValue(String(product.salePrice))}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-700 focus-ring dark:text-slate-400 dark:hover:text-slate-200"
          >
            Restablecer
          </button>
        </div>

        {preview && preview.diff !== 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
            <span className="text-sm tabular-nums text-slate-500 line-through dark:text-slate-400">
              {money(product.salePrice)}
            </span>
            <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
            <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {money(preview.newPrice)}
            </span>
            <span
              className={`ml-auto inline-flex items-center gap-1 text-xs font-semibold ${
                preview.diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {preview.diff > 0 ? (
                <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" aria-hidden />
              )}
              {preview.diff > 0 ? '+' : ''}
              {money(preview.diff)}
            </span>
          </div>
        )}

        {history.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <History className="h-3.5 w-3.5" aria-hidden />
              Historial de precios
            </p>
            <ul className="space-y-1.5">
              {history.map((change) => (
                <li
                  key={change.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60"
                >
                  <span className="tabular-nums text-slate-600 dark:text-slate-300">
                    {money(change.previousPrice)} → <strong>{money(change.newPrice)}</strong>
                  </span>
                  <span className="shrink-0 text-slate-400 dark:text-slate-500">
                    {formatDateTime(change.date)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Modal>
  );
}
