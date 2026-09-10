/**
 * Modelo de dominio de la aplicación.
 * Todos los tipos viven acá para que la capa de datos, los servicios y la UI
 * hablen exactamente el mismo idioma.
 */

/** Unidades de medida soportadas por el MVP. */
export type UnitOfMeasure = 'unidad' | 'kg' | 'g' | 'litro' | 'ml' | 'paquete' | 'caja' | 'docena';

export const UNITS: { value: UnitOfMeasure; label: string; short: string }[] = [
  { value: 'unidad', label: 'Unidad', short: 'un' },
  { value: 'kg', label: 'Kilogramo', short: 'kg' },
  { value: 'g', label: 'Gramo', short: 'g' },
  { value: 'litro', label: 'Litro', short: 'L' },
  { value: 'ml', label: 'Mililitro', short: 'ml' },
  { value: 'paquete', label: 'Paquete', short: 'paq' },
  { value: 'caja', label: 'Caja', short: 'caja' },
  { value: 'docena', label: 'Docena', short: 'doc' },
];

/** Entidad base: todo lo persistido tiene id y marcas de tiempo. */
export interface BaseEntity {
  id: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface Category extends BaseEntity {
  name: string;
  color: string; // hex, para chips y gráficos
  description?: string;
}

export interface Supplier extends BaseEntity {
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface Product extends BaseEntity {
  name: string;
  barcode?: string;
  categoryId: string | null;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  unit: UnitOfMeasure;
  supplierId: string | null;
  description?: string;
  imageUrl?: string;
}

/** Tipos de movimiento de inventario. */
export type MovementType = 'entrada' | 'venta' | 'ajuste' | 'devolucion';

export const MOVEMENT_TYPES: { value: MovementType; label: string; sign: 1 | -1 | 0 }[] = [
  { value: 'entrada', label: 'Entrada', sign: 1 },
  { value: 'venta', label: 'Venta', sign: -1 },
  { value: 'ajuste', label: 'Ajuste', sign: 0 },
  { value: 'devolucion', label: 'Devolución', sign: 1 },
];

export interface StockMovement extends BaseEntity {
  productId: string;
  productName: string; // desnormalizado: el historial sobrevive al borrado del producto
  type: MovementType;
  quantity: number; // siempre positivo; el tipo define el signo
  previousStock: number;
  resultingStock: number;
  note?: string;
  date: string; // ISO 8601
}

export interface PriceChange extends BaseEntity {
  productId: string;
  productName: string;
  previousPrice: number;
  newPrice: number;
  date: string; // ISO 8601
}

/** Registro legible de actividad para la sección Historial. */
export type ActivityKind =
  | 'producto.creado'
  | 'producto.editado'
  | 'producto.eliminado'
  | 'producto.duplicado'
  | 'precio.modificado'
  | 'stock.movimiento'
  | 'categoria.creada'
  | 'categoria.editada'
  | 'categoria.eliminada'
  | 'proveedor.creado'
  | 'proveedor.editado'
  | 'proveedor.eliminado'
  | 'datos.importados'
  | 'datos.restaurados'
  | 'datos.limpiados'
  | 'datos.demo';

export interface ActivityLog extends BaseEntity {
  kind: ActivityKind;
  message: string;
  entityId?: string;
  date: string; // ISO 8601
}

export type CurrencyCode = 'CLP' | 'ARS' | 'USD' | 'EUR' | 'MXN' | 'PEN' | 'COP';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  locale: string;
  decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  CLP: { code: 'CLP', symbol: '$', locale: 'es-CL', decimals: 0 },
  ARS: { code: 'ARS', symbol: '$', locale: 'es-AR', decimals: 2 },
  USD: { code: 'USD', symbol: 'US$', locale: 'en-US', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', locale: 'es-ES', decimals: 2 },
  MXN: { code: 'MXN', symbol: '$', locale: 'es-MX', decimals: 2 },
  PEN: { code: 'PEN', symbol: 'S/', locale: 'es-PE', decimals: 2 },
  COP: { code: 'COP', symbol: '$', locale: 'es-CO', decimals: 0 },
};

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Settings {
  businessName: string;
  businessPhone?: string;
  businessAddress?: string;
  businessEmail?: string;
  currency: CurrencyCode;
  theme: ThemeMode;
  defaultMinStock: number;
  lowStockAlerts: boolean;
  confirmBeforeDelete: boolean;
  updatedAt: string;
}

/** Snapshot completo — es lo que se exporta e importa como respaldo. */
export interface DatabaseSnapshot {
  version: number;
  exportedAt: string;
  products: Product[];
  categories: Category[];
  suppliers: Supplier[];
  movements: StockMovement[];
  priceChanges: PriceChange[];
  activity: ActivityLog[];
  settings: Settings;
}

/* ------------------------------------------------------------------ */
/* Tipos auxiliares de UI                                              */
/* ------------------------------------------------------------------ */

export type StockFilter = 'todos' | 'bajo' | 'sin-stock' | 'con-stock';
export type SortField = 'name' | 'salePrice' | 'stock' | 'updatedAt' | 'inventoryValue';
export type SortDirection = 'asc' | 'desc';

export interface ProductFilters {
  search: string;
  categoryId: string | 'todas';
  stock: StockFilter;
  sortBy: SortField;
  sortDir: SortDirection;
}

/** Producto con datos calculados/resueltos para mostrar en pantalla. */
export interface ProductView extends Product {
  categoryName: string;
  categoryColor: string;
  supplierName: string;
  inventoryValue: number;
  margin: number;
  marginPercent: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

export interface DashboardStats {
  totalProducts: number;
  inventoryValue: number;
  potentialSalesValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  categoriesCount: number;
  suppliersCount: number;
  movementsToday: number;
}
