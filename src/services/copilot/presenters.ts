import type { ProductView } from '@/types';
import { formatNumber } from '@/utils/format';
import type { CopilotFinding, CopilotTable, CopilotUiAction } from './types';

export type ColumnKey = 'precio' | 'compra' | 'stock' | 'minimo' | 'margen' | 'categoria' | 'valor';

const COLUMN_DEFS: Record<ColumnKey, { key: string; label: string; align?: 'left' | 'right' }> = {
  precio: { key: 'precio', label: 'Precio venta', align: 'right' },
  compra: { key: 'compra', label: 'Precio compra', align: 'right' },
  stock: { key: 'stock', label: 'Stock', align: 'right' },
  minimo: { key: 'minimo', label: 'Mínimo', align: 'right' },
  margen: { key: 'margen', label: 'Margen', align: 'right' },
  categoria: { key: 'categoria', label: 'Categoría' },
  valor: { key: 'valor', label: 'Valor inventario', align: 'right' },
};

/** Tabla de productos reutilizable por todas las herramientas. */
export function productTable(
  products: ProductView[],
  money: (value: number) => string,
  columns: ColumnKey[],
  caption?: string,
): CopilotTable {
  return {
    columns: [{ key: 'producto', label: 'Producto' }, ...columns.map((c) => COLUMN_DEFS[c])],
    rows: products.map((p) => {
      const row: Record<string, string | number> = { producto: p.name };
      for (const column of columns) {
        switch (column) {
          case 'precio':
            row.precio = money(p.salePrice);
            break;
          case 'compra':
            row.compra = p.purchasePrice > 0 ? money(p.purchasePrice) : 'sin dato';
            break;
          case 'stock':
            row.stock = formatNumber(p.stock);
            break;
          case 'minimo':
            row.minimo = formatNumber(p.minStock);
            break;
          case 'margen':
            row.margen =
              p.purchasePrice > 0 ? `${money(p.margin)} · ${p.marginPercent.toFixed(0)}%` : 'sin dato';
            break;
          case 'categoria':
            row.categoria = p.categoryName;
            break;
          case 'valor':
            row.valor = money(p.inventoryValue);
            break;
        }
      }
      return row;
    }),
    caption,
  };
}

export function findingBullets(findings: CopilotFinding[], limit = 8): string[] {
  return findings.slice(0, limit).map((f) => `${f.productName}: ${f.reason}`);
}

/* ------------------------------------------------------------------ */
/* Botones de acción sugeridos                                         */
/* ------------------------------------------------------------------ */

/** Acciones típicas sobre un producto concreto. */
export function productActions(product: ProductView): CopilotUiAction[] {
  return [
    { label: 'Ver producto', icon: 'ver', effect: { kind: 'abrir-producto', productId: product.id } },
    { label: 'Cambiar precio', icon: 'precio', effect: { kind: 'editar-precio', productId: product.id } },
    { label: 'Cambiar stock', icon: 'stock', effect: { kind: 'editar-stock', productId: product.id } },
  ];
}

/** Acciones para una lista: ver el listado filtrado o volver al resumen. */
export function listActions(
  filter: 'bajo' | 'sin-stock' | 'todos',
  extra: CopilotUiAction[] = [],
): CopilotUiAction[] {
  const to = filter === 'todos' ? '/productos' : `/productos?stock=${filter}`;
  return [
    { label: 'Mostrar solo estos', icon: 'filtro', effect: { kind: 'navegar', to } },
    ...extra,
    { label: 'Volver al resumen', icon: 'analizar', question: 'Resumen del inventario' },
  ];
}
