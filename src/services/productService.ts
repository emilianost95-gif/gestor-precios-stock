import type {
  Category,
  DashboardStats,
  Product,
  ProductFilters,
  ProductView,
  StockMovement,
  Supplier,
} from '@/types';
import { isSameDay, normalizeText } from '@/utils/format';

/** Enriquece un producto con datos derivados para la UI (sin tocar la persistencia). */
export function toProductView(
  product: Product,
  categories: Category[],
  suppliers: Supplier[],
): ProductView {
  const category = categories.find((c) => c.id === product.categoryId);
  const supplier = suppliers.find((s) => s.id === product.supplierId);
  const margin = product.salePrice - product.purchasePrice;
  return {
    ...product,
    categoryName: category?.name ?? 'Sin categoría',
    categoryColor: category?.color ?? '#64748b',
    supplierName: supplier?.name ?? 'Sin proveedor',
    inventoryValue: product.purchasePrice * product.stock,
    margin,
    marginPercent: product.purchasePrice > 0 ? (margin / product.purchasePrice) * 100 : 0,
    isLowStock: product.stock > 0 && product.stock <= product.minStock,
    isOutOfStock: product.stock <= 0,
  };
}

export function toProductViews(
  products: Product[],
  categories: Category[],
  suppliers: Supplier[],
): ProductView[] {
  return products.map((p) => toProductView(p, categories, suppliers));
}

/** Búsqueda global: nombre, código de barras y categoría. */
export function matchesSearch(product: ProductView, term: string): boolean {
  const q = normalizeText(term);
  if (!q) return true;
  return (
    normalizeText(product.name).includes(q) ||
    normalizeText(product.barcode ?? '').includes(q) ||
    normalizeText(product.categoryName).includes(q) ||
    normalizeText(product.supplierName).includes(q)
  );
}

export function filterAndSortProducts(
  products: ProductView[],
  filters: ProductFilters,
): ProductView[] {
  const result = products.filter((p) => {
    if (!matchesSearch(p, filters.search)) return false;
    if (filters.categoryId !== 'todas' && p.categoryId !== filters.categoryId) return false;
    switch (filters.stock) {
      case 'bajo':
        return p.isLowStock;
      case 'sin-stock':
        return p.isOutOfStock;
      case 'con-stock':
        return p.stock > 0;
      default:
        return true;
    }
  });

  const dir = filters.sortDir === 'asc' ? 1 : -1;
  result.sort((a, b) => {
    switch (filters.sortBy) {
      case 'salePrice':
        return (a.salePrice - b.salePrice) * dir;
      case 'stock':
        return (a.stock - b.stock) * dir;
      case 'inventoryValue':
        return (a.inventoryValue - b.inventoryValue) * dir;
      case 'updatedAt':
        return a.updatedAt.localeCompare(b.updatedAt) * dir;
      case 'name':
      default:
        return a.name.localeCompare(b.name, 'es') * dir;
    }
  });

  return result;
}

export function getLowStockProducts(products: ProductView[]): ProductView[] {
  return products
    .filter((p) => p.isLowStock)
    .sort((a, b) => a.stock - a.minStock - (b.stock - b.minStock));
}

export function getOutOfStockProducts(products: ProductView[]): ProductView[] {
  return products.filter((p) => p.isOutOfStock).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function computeStats(
  products: ProductView[],
  categories: Category[],
  suppliers: Supplier[],
  movements: StockMovement[],
): DashboardStats {
  const inventoryValue = products.reduce((sum, p) => sum + p.purchasePrice * p.stock, 0);
  const potentialSalesValue = products.reduce((sum, p) => sum + p.salePrice * p.stock, 0);
  return {
    totalProducts: products.length,
    inventoryValue,
    potentialSalesValue,
    lowStockCount: products.filter((p) => p.isLowStock).length,
    outOfStockCount: products.filter((p) => p.isOutOfStock).length,
    categoriesCount: categories.length,
    suppliersCount: suppliers.length,
    movementsToday: movements.filter((m) => isSameDay(m.date)).length,
  };
}

export interface CategoryBreakdown {
  categoryId: string;
  name: string;
  color: string;
  productCount: number;
  inventoryValue: number;
}

export function getCategoryBreakdown(
  products: ProductView[],
  categories: Category[],
): CategoryBreakdown[] {
  const rows = categories.map<CategoryBreakdown>((c) => {
    const items = products.filter((p) => p.categoryId === c.id);
    return {
      categoryId: c.id,
      name: c.name,
      color: c.color,
      productCount: items.length,
      inventoryValue: items.reduce((sum, p) => sum + p.inventoryValue, 0),
    };
  });

  const orphans = products.filter((p) => !p.categoryId || !categories.some((c) => c.id === p.categoryId));
  if (orphans.length > 0) {
    rows.push({
      categoryId: 'none',
      name: 'Sin categoría',
      color: '#94a3b8',
      productCount: orphans.length,
      inventoryValue: orphans.reduce((sum, p) => sum + p.inventoryValue, 0),
    });
  }

  return rows.filter((r) => r.productCount > 0).sort((a, b) => b.productCount - a.productCount);
}

export function getTopByInventoryValue(products: ProductView[], limit = 5): ProductView[] {
  return [...products].sort((a, b) => b.inventoryValue - a.inventoryValue).slice(0, limit);
}

export interface MovementDayPoint {
  label: string;
  date: string;
  entradas: number;
  salidas: number;
}

/** Serie de los últimos N días para el gráfico de movimientos. */
export function getMovementSeries(movements: StockMovement[], days = 7): MovementDayPoint[] {
  const points: MovementDayPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const dayMovements = movements.filter((m) => isSameDay(m.date, day));
    points.push({
      date: day.toISOString(),
      label: new Intl.DateTimeFormat('es-CL', { weekday: 'short' }).format(day).replace('.', ''),
      entradas: dayMovements
        .filter((m) => m.type === 'entrada' || m.type === 'devolucion')
        .reduce((sum, m) => sum + m.quantity, 0),
      salidas: dayMovements
        .filter((m) => m.type === 'venta')
        .reduce((sum, m) => sum + m.quantity, 0),
    });
  }
  return points;
}
