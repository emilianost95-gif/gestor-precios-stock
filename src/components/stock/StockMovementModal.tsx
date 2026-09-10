import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Minus, Plus, RotateCcw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useStore } from '@/context/StoreContext';
import { useToast } from '@/context/ToastContext';
import { MOVEMENT_TYPES, type MovementType, type Product } from '@/types';
import { formatDateTime, formatNumber } from '@/utils/format';
import { validateQuantityInput } from '@/utils/validation';

interface StockMovementModalProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
}

type Mode = 'sumar' | 'restar' | 'fijar';

const MODE_LABEL: Record<Mode, string> = {
  sumar: 'Agregar stock',
  restar: 'Descontar stock',
  fijar: 'Fijar stock',
};

const QUICK_STEPS = [1, 5, 10, 20];

export function StockMovementModal({ open, onClose, product }: StockMovementModalProps) {
  const { registerMovement, movementsFor } = useStore();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('sumar');
  const [quantity, setQuantity] = useState('1');
  const [type, setType] = useState<MovementType>('entrada');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !product) return;
    setMode('sumar');
    setType('entrada');
    setQuantity('1');
    setNote('');
    setError(undefined);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [open, product]);

  const history = useMemo(
    () => (product ? movementsFor(product.id).slice(0, 5) : []),
    [product, movementsFor],
  );

  const resulting = useMemo(() => {
    if (!product) return 0;
    const parsed = Number(quantity.replace(',', '.'));
    if (!Number.isFinite(parsed)) return product.stock;
    if (mode === 'sumar') return product.stock + parsed;
    if (mode === 'restar') return Math.max(0, product.stock - parsed);
    return Math.max(0, parsed);
  }, [product, quantity, mode]);

  if (!product) return null;

  const changeMode = (next: Mode) => {
    setMode(next);
    setError(undefined);
    if (next === 'sumar') setType('entrada');
    if (next === 'restar') setType('venta');
    if (next === 'fijar') {
      setType('ajuste');
      setQuantity(String(product.stock));
    } else if (mode === 'fijar') {
      setQuantity('1');
    }
  };

  const bump = (delta: number) => {
    const current = Number(quantity.replace(',', '.')) || 0;
    const next = Math.max(mode === 'fijar' ? 0 : 1, current + delta);
    setQuantity(String(next));
    setError(undefined);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (mode === 'fijar') {
      const parsed = Number(quantity.replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError('Ingresá un stock válido (0 o mayor).');
        return;
      }
      if (parsed === product.stock) {
        toast.info('Sin cambios', 'El stock ingresado es el mismo que el actual.');
        onClose();
        return;
      }
      registerMovement({
        productId: product.id,
        type: 'ajuste',
        quantity: Math.abs(parsed - product.stock),
        absoluteStock: parsed,
        note: note.trim() || undefined,
      });
      toast.success('Stock ajustado', `${product.name}: ${product.stock} → ${parsed}`);
      onClose();
      return;
    }

    const parsed = validateQuantityInput(quantity);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    if (mode === 'restar' && parsed.value > product.stock) {
      setError(`No podés descontar más de ${formatNumber(product.stock)} unidades.`);
      return;
    }

    registerMovement({
      productId: product.id,
      type,
      quantity: parsed.value,
      note: note.trim() || undefined,
    });

    const sign = mode === 'sumar' ? '+' : '-';
    toast.success(
      'Stock actualizado',
      `${product.name}: ${formatNumber(product.stock)} ${sign}${formatNumber(parsed.value)} → ${formatNumber(resulting)}`,
    );
    onClose();
  };

  const availableTypes = MOVEMENT_TYPES.filter((t) =>
    mode === 'sumar' ? t.sign === 1 : mode === 'restar' ? t.sign === -1 : t.value === 'ajuste',
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      tourId="editor-stock"
      title="Movimiento de stock"
      description={product.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="stock-form">
            Registrar movimiento
          </Button>
        </>
      }
    >
      <form id="stock-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Stock actual
            </p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {formatNumber(product.stock)}
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-400" aria-hidden />
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Queda
            </p>
            <p
              className={`mt-0.5 text-2xl font-semibold tabular-nums ${
                resulting <= 0
                  ? 'text-red-600 dark:text-red-400'
                  : resulting <= product.minStock
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {formatNumber(resulting)}
            </p>
          </div>
        </div>

        <div role="group" aria-label="Tipo de operación" className="grid grid-cols-3 gap-2">
          {(['sumar', 'restar', 'fijar'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => changeMode(m)}
              aria-pressed={mode === m}
              className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium transition focus-ring ${
                mode === m
                  ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/60 dark:text-brand-300'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {m === 'sumar' && <Plus className="h-4 w-4" aria-hidden />}
              {m === 'restar' && <Minus className="h-4 w-4" aria-hidden />}
              {m === 'fijar' && <RotateCcw className="h-4 w-4" aria-hidden />}
              {MODE_LABEL[m].split(' ')[0]}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="quantity" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {mode === 'fijar' ? 'Stock final' : 'Cantidad'}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => bump(-1)}
              aria-label="Restar uno"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-600 transition hover:bg-slate-50 focus-ring dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Minus className="h-5 w-5" aria-hidden />
            </button>
            <input
              ref={inputRef}
              id="quantity"
              inputMode="decimal"
              autoComplete="off"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                setError(undefined);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'quantity-error' : undefined}
              className={`h-14 min-w-0 flex-1 rounded-xl border bg-white px-3 text-center text-2xl font-semibold tabular-nums text-slate-900 focus-ring dark:bg-slate-900 dark:text-slate-50 ${
                error ? 'border-red-400 dark:border-red-600' : 'border-slate-300 dark:border-slate-700'
              }`}
            />
            <button
              type="button"
              onClick={() => bump(1)}
              aria-label="Sumar uno"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-600 transition hover:bg-slate-50 focus-ring dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Plus className="h-5 w-5" aria-hidden />
            </button>
          </div>
          {error && (
            <p id="quantity-error" role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-2">
            {QUICK_STEPS.map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => bump(step)}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:text-brand-600 focus-ring dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-600 dark:hover:text-brand-400"
              >
                +{step}
              </button>
            ))}
          </div>
        </div>

        {availableTypes.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de movimiento</span>
            <div className="flex flex-wrap gap-2">
              {availableTypes.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  aria-pressed={type === t.value}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus-ring ${
                    type === t.value
                      ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/60 dark:text-brand-300'
                      : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="note" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Nota (opcional)
          </label>
          <input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={120}
            placeholder="Ej: pedido del proveedor"
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        {history.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Últimos movimientos
            </p>
            <ul className="space-y-1.5">
              {history.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60"
                >
                  <span className="text-slate-600 dark:text-slate-300">
                    <strong className="capitalize">{m.type}</strong> · {formatNumber(m.previousStock)} →{' '}
                    {formatNumber(m.resultingStock)}
                  </span>
                  <span className="shrink-0 text-slate-400 dark:text-slate-500">{formatDateTime(m.date)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Modal>
  );
}
