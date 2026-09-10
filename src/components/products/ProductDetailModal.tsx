import { useMemo } from 'react';
import { Barcode, Copy, Layers, Package, Pencil, Trash2, Truck } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge, CategoryChip } from '@/components/ui/Card';
import { useStore } from '@/context/StoreContext';
import { useCurrency } from '@/hooks/useCurrency';
import { toProductView } from '@/services/productService';
import { UNITS, type Product } from '@/types';
import { formatDateTime, formatNumber, formatPercent } from '@/utils/format';

interface ProductDetailModalProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  onEdit: (product: Product) => void;
  onEditPrice: (product: Product) => void;
  onEditStock: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export function ProductDetailModal({
  open,
  onClose,
  product,
  onEdit,
  onEditPrice,
  onEditStock,
  onDuplicate,
  onDelete,
}: ProductDetailModalProps) {
  const { categories, suppliers, priceHistoryFor, movementsFor } = useStore();
  const { money } = useCurrency();

  const view = useMemo(
    () => (product ? toProductView(product, categories, suppliers) : null),
    [product, categories, suppliers],
  );
  const prices = useMemo(
    () => (product ? priceHistoryFor(product.id).slice(0, 6) : []),
    [product, priceHistoryFor],
  );
  const movements = useMemo(
    () => (product ? movementsFor(product.id).slice(0, 6) : []),
    [product, movementsFor],
  );

  if (!product || !view) return null;

  const unitLabel = UNITS.find((u) => u.value === product.unit)?.label ?? product.unit;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={product.name}
      description={view.categoryName}
      footer={
        <>
          <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => onDelete(product)}>
            Eliminar
          </Button>
          <Button variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => onDuplicate(product)}>
            Duplicar
          </Button>
          <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => onEdit(product)}>
            Editar
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onEditPrice(product)}
            className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50/50 focus-ring dark:border-slate-800 dark:hover:border-brand-700 dark:hover:bg-brand-950/30"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Precio de venta
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {money(product.salePrice)}
            </p>
            <p className="mt-1 text-xs font-medium text-brand-600 dark:text-brand-400">Tocá para cambiarlo</p>
          </button>

          <button
            type="button"
            onClick={() => onEditStock(product)}
            className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50/50 focus-ring dark:border-slate-800 dark:hover:border-brand-700 dark:hover:bg-brand-950/30"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Stock actual
            </p>
            <p className="mt-1 flex items-baseline gap-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {formatNumber(product.stock)}
              {view.isOutOfStock ? (
                <Badge tone="danger">Sin stock</Badge>
              ) : view.isLowStock ? (
                <Badge tone="warning">Stock bajo</Badge>
              ) : null}
            </p>
            <p className="mt-1 text-xs font-medium text-brand-600 dark:text-brand-400">
              Mínimo: {formatNumber(product.minStock)} · Tocá para ajustar
            </p>
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Precio de compra</dt>
            <dd className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
              {money(product.purchasePrice)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Ganancia por unidad</dt>
            <dd
              className={`font-medium tabular-nums ${view.margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
            >
              {money(view.margin)} · {formatPercent(view.marginPercent)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Valor en inventario</dt>
            <dd className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
              {money(view.inventoryValue)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Unidad de medida</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">{unitLabel}</dd>
          </div>
          <div className="col-span-2 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Layers className="h-3.5 w-3.5" aria-hidden />
              <CategoryChip name={view.categoryName} color={view.categoryColor} />
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Truck className="h-3.5 w-3.5" aria-hidden />
              {view.supplierName}
            </span>
            {product.barcode && (
              <span className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                <Barcode className="h-3.5 w-3.5" aria-hidden />
                {product.barcode}
              </span>
            )}
          </div>
          {product.description && (
            <div className="col-span-2">
              <dt className="text-xs text-slate-500 dark:text-slate-400">Descripción</dt>
              <dd className="text-slate-700 dark:text-slate-300">{product.description}</dd>
            </div>
          )}
          <div className="col-span-2 text-xs text-slate-400 dark:text-slate-500">
            Creado el {formatDateTime(product.createdAt)} · Última modificación{' '}
            {formatDateTime(product.updatedAt)}
          </div>
        </dl>

        {prices.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Historial de precios
            </h3>
            <ul className="space-y-1.5">
              {prices.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60"
                >
                  <span className="tabular-nums text-slate-600 dark:text-slate-300">
                    {money(c.previousPrice)} → <strong>{money(c.newPrice)}</strong>
                  </span>
                  <span className="shrink-0 text-slate-400 dark:text-slate-500">{formatDateTime(c.date)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {movements.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Package className="h-3.5 w-3.5" aria-hidden />
              Movimientos de stock
            </h3>
            <ul className="space-y-1.5">
              {movements.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60"
                >
                  <span className="capitalize text-slate-600 dark:text-slate-300">
                    {m.type} · {formatNumber(m.previousStock)} → <strong>{formatNumber(m.resultingStock)}</strong>
                  </span>
                  <span className="shrink-0 text-slate-400 dark:text-slate-500">{formatDateTime(m.date)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}
