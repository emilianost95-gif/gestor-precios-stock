import type {
  Category,
  PriceChange,
  ProductView,
  Settings,
  StockMovement,
  Supplier,
} from '@/types';
import { getCategoryBreakdown } from '@/services/productService';
import type { ContextProduct, CopilotUiContext, InventoryContext } from './types';

/** Tope de productos enviados al modelo. Suficiente para un almacén real. */
const MAX_CONTEXT_PRODUCTS = 150;

export interface InventorySource {
  products: ProductView[];
  categories: Category[];
  suppliers: Supplier[];
  movements: StockMovement[];
  priceChanges: PriceChange[];
  settings: Settings;
}

const DAY_MS = 86_400_000;

/** Días desde el último movimiento de cada producto. */
export function buildLastMovementMap(movements: StockMovement[]): Map<string, number> {
  const map = new Map<string, number>();
  const now = Date.now();
  for (const movement of movements) {
    const time = new Date(movement.date).getTime();
    if (Number.isNaN(time)) continue;
    const days = Math.max(0, Math.floor((now - time) / DAY_MS));
    const current = map.get(movement.productId);
    if (current === undefined || days < current) map.set(movement.productId, days);
  }
  return map;
}

/** Último cambio de precio por producto. */
export function buildLastPriceChangeMap(changes: PriceChange[]): Map<string, PriceChange> {
  const map = new Map<string, PriceChange>();
  for (const change of changes) {
    const current = map.get(change.productId);
    if (!current || change.date > current.date) map.set(change.productId, change);
  }
  return map;
}

/**
 * Arma el contexto que se le entrega al Copilot.
 *
 * Reglas:
 *  - sólo campos relevantes para razonar sobre stock y precios;
 *  - `precioCompra` y `margen` son `null` cuando el dato no existe, para que
 *    el modelo pueda decir "no tengo ese dato" en lugar de inventarlo;
 *  - la lista se recorta priorizando lo que necesita atención.
 */
export function getInventoryContext(
  source: InventorySource,
  options: { maxProducts?: number; ui?: CopilotUiContext } = {},
): InventoryContext {
  const { products, categories, suppliers, movements, priceChanges, settings } = source;
  const maxProducts = options.maxProducts ?? MAX_CONTEXT_PRODUCTS;

  const lastMovement = buildLastMovementMap(movements);
  const lastPriceChange = buildLastPriceChangeMap(priceChanges);

  const toContextProduct = (product: ProductView): ContextProduct => {
    const hasPurchasePrice = product.purchasePrice > 0;
    const change = lastPriceChange.get(product.id);
    return {
      id: product.id,
      nombre: product.name,
      categoria: product.categoryName,
      proveedor: product.supplierId ? product.supplierName : null,
      stock: product.stock,
      stockMinimo: product.minStock,
      precioCompra: hasPurchasePrice ? product.purchasePrice : null,
      precioVenta: product.salePrice,
      margen: hasPurchasePrice ? product.margin : null,
      margenPorcentaje: hasPurchasePrice ? Number(product.marginPercent.toFixed(1)) : null,
      unidad: product.unit,
      diasSinMovimiento: lastMovement.get(product.id) ?? null,
      ultimoCambioPrecio: change
        ? { anterior: change.previousPrice, nuevo: change.newPrice, fecha: change.date }
        : null,
    };
  };

  // Prioridad para el recorte: primero lo que necesita atención.
  const priority = (product: ProductView): number => {
    if (product.isOutOfStock) return 0;
    if (product.isLowStock) return 1;
    if (product.purchasePrice <= 0) return 2;
    if (product.salePrice < product.purchasePrice) return 0;
    return 3;
  };

  const ordered = [...products].sort((a, b) => {
    const diff = priority(a) - priority(b);
    if (diff !== 0) return diff;
    return b.inventoryValue - a.inventoryValue;
  });

  const selected = ordered.slice(0, maxProducts);
  const withoutPurchasePrice = products.filter((p) => p.purchasePrice <= 0).length;

  const vaciosDeDatos: string[] = [];
  if (withoutPurchasePrice > 0) {
    vaciosDeDatos.push(
      `${withoutPurchasePrice} producto(s) no tienen precio de compra cargado: de esos no se puede calcular margen.`,
    );
  }
  if (movements.length === 0) {
    vaciosDeDatos.push('No hay movimientos de stock registrados: no se puede analizar rotación.');
  }
  if (priceChanges.length === 0) {
    vaciosDeDatos.push('No hay historial de cambios de precio todavía.');
  }
  if (suppliers.length === 0) {
    vaciosDeDatos.push('No hay proveedores cargados.');
  }

  const openProduct = options.ui?.selectedProductId
    ? products.find((p) => p.id === options.ui?.selectedProductId)
    : undefined;

  return {
    negocio: { nombre: settings.businessName || 'Mi negocio', moneda: settings.currency },
    generadoEl: new Date().toISOString(),
    modo: options.ui?.demoMode ? 'demostracion' : 'real',
    pantallaActual: options.ui
      ? {
          seccion: options.ui.screenLabel,
          productoAbierto: openProduct ? { id: openProduct.id, nombre: openProduct.name } : null,
          busqueda: options.ui.search || null,
          filtroStock: options.ui.stockFilter && options.ui.stockFilter !== 'todos' ? options.ui.stockFilter : null,
        }
      : undefined,
    totales: {
      productos: products.length,
      categorias: categories.length,
      proveedores: suppliers.length,
      valorInventario: products.reduce((sum, p) => sum + p.purchasePrice * p.stock, 0),
      ventaPotencial: products.reduce((sum, p) => sum + p.salePrice * p.stock, 0),
      stockBajo: products.filter((p) => p.isLowStock).length,
      sinStock: products.filter((p) => p.isOutOfStock).length,
      sinPrecioCompra: withoutPurchasePrice,
      movimientosRegistrados: movements.length,
    },
    categorias: getCategoryBreakdown(products, categories).map((c) => ({
      id: c.categoryId,
      nombre: c.name,
      productos: c.productCount,
      valorInventario: c.inventoryValue,
    })),
    productos: selected.map(toContextProduct),
    productosRecortados: products.length > selected.length,
    cambiosPrecioRecientes: priceChanges.slice(0, 15).map((c) => ({
      producto: c.productName,
      anterior: c.previousPrice,
      nuevo: c.newPrice,
      fecha: c.date,
    })),
    vaciosDeDatos,
  };
}
