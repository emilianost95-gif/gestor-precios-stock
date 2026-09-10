import type { Category, ProductView } from '@/types';
import { normalizeText } from '@/utils/format';
import type { ActionPreview, ActionPreviewItem, ActionScope, CopilotAction } from './types';

/** Máximo de productos que una sola acción puede tocar. */
export const MAX_AFFECTED_PRODUCTS = 500;
/** Variación máxima permitida en un ajuste porcentual. */
export const MAX_PERCENT = 100;

function roundTo(value: number, step: number): number {
  if (step <= 0) return Math.round(value);
  return Math.round(value / step) * step;
}

export function resolveScope(scope: ActionScope, products: ProductView[]): ProductView[] {
  switch (scope.kind) {
    case 'categoria':
      return products.filter((p) => p.categoryId === scope.categoryId);
    case 'productos': {
      const ids = new Set(scope.productIds);
      return products.filter((p) => ids.has(p.id));
    }
    case 'todos':
    default:
      return products;
  }
}

export function describeScope(scope: ActionScope, count: number): string {
  const plural = count === 1 ? 'producto' : 'productos';
  switch (scope.kind) {
    case 'categoria':
      return `${count} ${plural} de la categoría ${scope.categoryName}`;
    case 'productos':
      return `${count} ${plural} seleccionado${count === 1 ? '' : 's'}`;
    case 'todos':
    default:
      return `los ${count} ${plural} del inventario`;
  }
}

/**
 * Construye la vista previa de una acción **con los datos reales de la app**.
 *
 * Nunca se confía en los números que devuelve el modelo: la IA sólo puede
 * proponer qué hacer (subir 10% en Bebidas); los precios resultantes los
 * calcula esta función a partir del inventario local.
 */
export function buildActionPreview(
  action: CopilotAction,
  products: ProductView[],
  moneyFormatter: (value: number) => string,
): ActionPreview {
  // Ajuste de stock de un producto puntual: vista previa propia.
  if (action.type === 'stock-producto') {
    const product = products.find((p) => p.id === action.productId);
    if (!product) {
      return {
        action,
        title: 'Producto no encontrado',
        description: 'El producto de la acción ya no está en el inventario.',
        items: [],
        count: 0,
        totalBefore: 0,
        totalAfter: 0,
        warnings: [],
        executable: false,
      };
    }
    const after =
      action.mode === 'fijar'
        ? Math.max(0, Math.round(action.value))
        : action.mode === 'sumar'
          ? product.stock + Math.round(action.value)
          : Math.max(0, product.stock - Math.round(action.value));

    const stockWarnings: string[] = [];
    if (after <= 0) stockWarnings.push('El producto quedaría sin stock.');
    else if (after <= product.minStock) {
      stockWarnings.push(`Quedaría en o por debajo de su stock mínimo (${product.minStock}).`);
    }

    return {
      action,
      title:
        action.mode === 'fijar'
          ? `Fijar el stock de ${product.name} en ${after}`
          : action.mode === 'sumar'
            ? `Agregar ${Math.round(action.value)} unidades a ${product.name}`
            : `Descontar ${Math.round(action.value)} unidades de ${product.name}`,
      description: `El stock pasaría de ${product.stock} a ${after} y queda registrado como movimiento.`,
      items:
        after === product.stock
          ? []
          : [{ id: product.id, name: product.name, before: product.stock, after, delta: after - product.stock }],
      count: after === product.stock ? 0 : 1,
      totalBefore: 0,
      totalAfter: 0,
      warnings: stockWarnings,
      executable: after !== product.stock,
    };
  }

  const affected = resolveScope(action.scope, products);
  const warnings: string[] = [];

  if (affected.length === 0) {
    return {
      action,
      title: 'No hay productos para modificar',
      description: 'El filtro de la acción no coincide con ningún producto del inventario.',
      items: [],
      count: 0,
      totalBefore: 0,
      totalAfter: 0,
      warnings: [],
      executable: false,
    };
  }

  if (affected.length > MAX_AFFECTED_PRODUCTS) {
    warnings.push(
      `La acción afecta ${affected.length} productos y el límite por operación es ${MAX_AFFECTED_PRODUCTS}.`,
    );
  }

  if (action.type === 'stock-minimo-masivo') {
    const items: ActionPreviewItem[] = affected
      .map((product) => ({
        id: product.id,
        name: product.name,
        before: product.minStock,
        after: Math.max(0, Math.round(action.value)),
        delta: Math.max(0, Math.round(action.value)) - product.minStock,
      }))
      .filter((item) => item.delta !== 0);

    return {
      action,
      title: `Cambiar el stock mínimo a ${Math.max(0, Math.round(action.value))}`,
      description: `Se va a actualizar el stock mínimo de ${describeScope(action.scope, items.length)}.`,
      items,
      count: items.length,
      totalBefore: 0,
      totalAfter: 0,
      warnings,
      executable: items.length > 0 && affected.length <= MAX_AFFECTED_PRODUCTS,
    };
  }

  // precio-masivo
  const compute = (current: number): number => {
    switch (action.mode) {
      case 'percent':
        return roundTo(current * (1 + action.value / 100), action.round);
      case 'monto':
        return roundTo(current + action.value, action.round);
      case 'fijar':
      default:
        return roundTo(action.value, action.round);
    }
  };

  const items: ActionPreviewItem[] = affected
    .map((product) => {
      const after = Math.max(0, compute(product.salePrice));
      return {
        id: product.id,
        name: product.name,
        before: product.salePrice,
        after,
        delta: after - product.salePrice,
      };
    })
    .filter((item) => item.delta !== 0);

  const belowCost = items.filter((item) => {
    const product = affected.find((p) => p.id === item.id);
    return product && product.purchasePrice > 0 && item.after < product.purchasePrice;
  });
  if (belowCost.length > 0) {
    warnings.push(
      `${belowCost.length} producto(s) quedarían por debajo de su precio de compra: ${belowCost
        .slice(0, 3)
        .map((i) => i.name)
        .join(', ')}${belowCost.length > 3 ? '…' : ''}.`,
    );
  }

  const totalBefore = affected.reduce((sum, p) => sum + p.salePrice * p.stock, 0);
  const totalAfter = affected.reduce((sum, p) => {
    const item = items.find((i) => i.id === p.id);
    return sum + (item ? item.after : p.salePrice) * p.stock;
  }, 0);

  const title =
    action.mode === 'percent'
      ? `${action.value >= 0 ? 'Aumentar' : 'Bajar'} los precios un ${Math.abs(action.value)}%`
      : action.mode === 'monto'
        ? `${action.value >= 0 ? 'Sumar' : 'Restar'} ${moneyFormatter(Math.abs(action.value))} al precio`
        : `Fijar todos los precios en ${moneyFormatter(action.value)}`;

  return {
    action,
    title,
    description: `Se va a modificar el precio de venta de ${describeScope(action.scope, items.length)}.`,
    items,
    count: items.length,
    totalBefore,
    totalAfter,
    warnings,
    executable: items.length > 0 && affected.length <= MAX_AFFECTED_PRODUCTS,
  };
}

/* ------------------------------------------------------------------ */
/* Validación de acciones que llegan desde el modelo                   */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Sanea una acción propuesta por el modelo. Devuelve `null` si no cumple el
 * contrato: nunca se ejecuta algo que no haya pasado por acá.
 */
export function parseAction(
  raw: unknown,
  products: ProductView[],
  categories: Category[],
): CopilotAction | null {
  if (!isRecord(raw)) return null;

  if (raw.type === 'stock-producto') {
    const productId = typeof raw.productId === 'string' ? raw.productId : '';
    if (!products.some((p) => p.id === productId)) return null;
    const mode = raw.mode;
    if (mode !== 'fijar' && mode !== 'sumar' && mode !== 'restar') return null;
    const value = Number(raw.value);
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return null;
    return { type: 'stock-producto', productId, mode, value: Math.round(value) };
  }

  const scope = parseScope(raw.scope, products, categories);
  if (!scope) return null;

  if (raw.type === 'stock-minimo-masivo') {
    const value = Number(raw.value);
    if (!Number.isFinite(value) || value < 0 || value > 100_000) return null;
    return { type: 'stock-minimo-masivo', value: Math.round(value), scope };
  }

  if (raw.type === 'precio-masivo') {
    const mode = raw.mode;
    if (mode !== 'percent' && mode !== 'monto' && mode !== 'fijar') return null;
    const value = Number(raw.value);
    if (!Number.isFinite(value)) return null;
    if (mode === 'percent' && Math.abs(value) > MAX_PERCENT) return null;
    if (mode !== 'percent' && Math.abs(value) > 99_999_999) return null;
    if (mode === 'fijar' && value < 0) return null;
    const round = Number(raw.round);
    return {
      type: 'precio-masivo',
      mode,
      value,
      round: Number.isFinite(round) && round >= 0 && round <= 1000 ? round : 10,
      scope,
    };
  }

  return null;
}

function parseScope(
  raw: unknown,
  products: ProductView[],
  categories: Category[],
): ActionScope | null {
  if (!isRecord(raw)) return null;

  if (raw.kind === 'todos') return { kind: 'todos' };

  if (raw.kind === 'categoria') {
    const byId = categories.find((c) => c.id === raw.categoryId);
    const byName =
      typeof raw.categoryName === 'string'
        ? categories.find((c) => normalizeText(c.name) === normalizeText(raw.categoryName as string))
        : undefined;
    const category = byId ?? byName;
    if (!category) return null;
    return { kind: 'categoria', categoryId: category.id, categoryName: category.name };
  }

  if (raw.kind === 'productos' && Array.isArray(raw.productIds)) {
    const valid = raw.productIds
      .filter((id): id is string => typeof id === 'string')
      .filter((id) => products.some((p) => p.id === id));
    if (valid.length === 0) return null;
    return { kind: 'productos', productIds: valid };
  }

  return null;
}
