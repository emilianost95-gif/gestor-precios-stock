import { useMemo } from 'react';
import { useStore } from '@/context/StoreContext';
import type { ProductFilters, ProductView } from '@/types';
import {
  computeStats,
  filterAndSortProducts,
  getCategoryBreakdown,
  getLowStockProducts,
  getMovementSeries,
  getOutOfStockProducts,
  getTopByInventoryValue,
  toProductViews,
} from '@/services/productService';

/** Productos enriquecidos con categoría, proveedor, margen y estado de stock. */
export function useProductViews(): ProductView[] {
  const { products, categories, suppliers } = useStore();
  return useMemo(
    () => toProductViews(products, categories, suppliers),
    [products, categories, suppliers],
  );
}

export function useFilteredProducts(filters: ProductFilters): ProductView[] {
  const views = useProductViews();
  return useMemo(() => filterAndSortProducts(views, filters), [views, filters]);
}

export function useDashboardData() {
  const { categories, suppliers, movements, activity } = useStore();
  const views = useProductViews();

  return useMemo(
    () => ({
      products: views,
      stats: computeStats(views, categories, suppliers, movements),
      lowStock: getLowStockProducts(views),
      outOfStock: getOutOfStockProducts(views),
      categoryBreakdown: getCategoryBreakdown(views, categories),
      topByValue: getTopByInventoryValue(views, 5),
      movementSeries: getMovementSeries(movements, 7),
      recentMovements: movements.slice(0, 6),
      recentActivity: activity.slice(0, 6),
    }),
    [views, categories, suppliers, movements, activity],
  );
}
