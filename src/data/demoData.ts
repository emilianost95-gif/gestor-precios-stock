import type {
  ActivityLog,
  Category,
  DatabaseSnapshot,
  PriceChange,
  Product,
  StockMovement,
  Supplier,
  UnitOfMeasure,
} from '@/types';
import { SCHEMA_VERSION } from '@/storage/adapter';
import { createId } from '@/utils/id';
import { DEFAULT_SETTINGS } from './defaults';

/**
 * DATOS DE DEMOSTRACIÓN — 100% FICTICIOS.
 * Nombres genéricos inventados, precios de referencia y proveedores imaginarios.
 * Sirven sólo para mostrar cómo funciona el sistema; se borran desde
 * Configuración → "Limpiar datos de demostración".
 */

const daysAgo = (days: number, hour = 10): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, Math.floor(Math.random() * 59), 0, 0);
  return d.toISOString();
};

const CATEGORY_SEED: Array<Pick<Category, 'id' | 'name' | 'color' | 'description'>> = [
  { id: 'cat_bebidas', name: 'Bebidas', color: '#2f82ff', description: 'Gaseosas, aguas y jugos' },
  { id: 'cat_almacen', name: 'Almacén', color: '#f59e0b', description: 'Abarrotes y secos' },
  { id: 'cat_limpieza', name: 'Limpieza', color: '#06b6d4', description: 'Artículos de aseo del hogar' },
  { id: 'cat_lacteos', name: 'Lácteos', color: '#8b5cf6', description: 'Leche, quesos y yogures' },
  { id: 'cat_snacks', name: 'Snacks', color: '#ec4899', description: 'Galletas, papas fritas y dulces' },
  { id: 'cat_higiene', name: 'Higiene', color: '#16a34a', description: 'Cuidado personal' },
  { id: 'cat_otros', name: 'Otros', color: '#64748b', description: 'Sin clasificar' },
];

const SUPPLIER_SEED: Array<Pick<Supplier, 'id' | 'name' | 'company' | 'phone' | 'email' | 'notes'>> = [
  {
    id: 'sup_distribuidora_norte',
    name: 'Distribuidora Norte',
    company: 'Distribuidora Norte SpA (ficticia)',
    phone: '+56 9 0000 0001',
    email: 'ventas@distribuidoranorte.demo',
    notes: 'Proveedor de demostración. Reparte los martes y viernes.',
  },
  {
    id: 'sup_lacteos_del_valle',
    name: 'Lácteos del Valle',
    company: 'Lácteos del Valle Ltda. (ficticia)',
    phone: '+56 9 0000 0002',
    email: 'pedidos@lacteosdelvalle.demo',
    notes: 'Proveedor de demostración. Entrega en frío, pedido mínimo 10 unidades.',
  },
  {
    id: 'sup_mayorista_central',
    name: 'Mayorista Central',
    company: 'Mayorista Central S.A. (ficticia)',
    phone: '+56 9 0000 0003',
    email: 'contacto@mayoristacentral.demo',
    notes: 'Proveedor de demostración. Mejores precios por volumen.',
  },
  {
    id: 'sup_higiene_express',
    name: 'Higiene Express',
    company: 'Higiene Express Ltda. (ficticia)',
    phone: '+56 9 0000 0004',
    email: 'ventas@higieneexpress.demo',
    notes: 'Proveedor de demostración. Despacho semanal.',
  },
];

interface ProductSeed {
  id: string;
  name: string;
  barcode: string;
  categoryId: string;
  supplierId: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  unit: UnitOfMeasure;
  description?: string;
}

const PRODUCT_SEED: ProductSeed[] = [
  // Bebidas
  { id: 'prd_cola_15', name: 'Bebida Cola 1.5 L', barcode: '7800000000011', categoryId: 'cat_bebidas', supplierId: 'sup_distribuidora_norte', purchasePrice: 1450, salePrice: 2500, stock: 3, minStock: 6, unit: 'unidad', description: 'Producto ficticio de demostración.' },
  { id: 'prd_naranja_2l', name: 'Bebida Naranja 2 L', barcode: '7800000000028', categoryId: 'cat_bebidas', supplierId: 'sup_distribuidora_norte', purchasePrice: 1300, salePrice: 2290, stock: 14, minStock: 6, unit: 'unidad' },
  { id: 'prd_agua_mineral', name: 'Agua Mineral sin Gas 1.6 L', barcode: '7800000000035', categoryId: 'cat_bebidas', supplierId: 'sup_distribuidora_norte', purchasePrice: 620, salePrice: 1200, stock: 28, minStock: 10, unit: 'unidad' },
  { id: 'prd_jugo_durazno', name: 'Jugo de Durazno 1 L', barcode: '7800000000042', categoryId: 'cat_bebidas', supplierId: 'sup_mayorista_central', purchasePrice: 780, salePrice: 1490, stock: 0, minStock: 5, unit: 'unidad' },
  // Almacén
  { id: 'prd_arroz_1k', name: 'Arroz Grado 1 · 1 kg', barcode: '7800000000059', categoryId: 'cat_almacen', supplierId: 'sup_mayorista_central', purchasePrice: 990, salePrice: 1690, stock: 2, minStock: 5, unit: 'kg' },
  { id: 'prd_fideos', name: 'Fideos Espirales 400 g', barcode: '7800000000066', categoryId: 'cat_almacen', supplierId: 'sup_mayorista_central', purchasePrice: 620, salePrice: 1150, stock: 22, minStock: 8, unit: 'paquete' },
  { id: 'prd_aceite', name: 'Aceite Vegetal 900 ml', barcode: '7800000000073', categoryId: 'cat_almacen', supplierId: 'sup_mayorista_central', purchasePrice: 1850, salePrice: 2990, stock: 9, minStock: 4, unit: 'unidad' },
  { id: 'prd_azucar', name: 'Azúcar Granulada 1 kg', barcode: '7800000000080', categoryId: 'cat_almacen', supplierId: 'sup_mayorista_central', purchasePrice: 890, salePrice: 1490, stock: 16, minStock: 6, unit: 'kg' },
  { id: 'prd_harina', name: 'Harina sin Polvos 1 kg', barcode: '7800000000097', categoryId: 'cat_almacen', supplierId: 'sup_mayorista_central', purchasePrice: 780, salePrice: 1350, stock: 11, minStock: 5, unit: 'kg' },
  { id: 'prd_atun', name: 'Atún en Conserva 160 g', barcode: '7800000000103', categoryId: 'cat_almacen', supplierId: 'sup_distribuidora_norte', purchasePrice: 1120, salePrice: 1890, stock: 18, minStock: 6, unit: 'unidad' },
  // Lácteos
  { id: 'prd_leche', name: 'Leche Entera 1 L', barcode: '7800000000110', categoryId: 'cat_lacteos', supplierId: 'sup_lacteos_del_valle', purchasePrice: 850, salePrice: 1390, stock: 24, minStock: 12, unit: 'litro' },
  { id: 'prd_yogurt', name: 'Yogur Natural 155 g', barcode: '7800000000127', categoryId: 'cat_lacteos', supplierId: 'sup_lacteos_del_valle', purchasePrice: 320, salePrice: 590, stock: 30, minStock: 10, unit: 'unidad' },
  { id: 'prd_queso', name: 'Queso Laminado 250 g', barcode: '7800000000134', categoryId: 'cat_lacteos', supplierId: 'sup_lacteos_del_valle', purchasePrice: 2400, salePrice: 3990, stock: 4, minStock: 5, unit: 'paquete' },
  { id: 'prd_mantequilla', name: 'Mantequilla con Sal 250 g', barcode: '7800000000141', categoryId: 'cat_lacteos', supplierId: 'sup_lacteos_del_valle', purchasePrice: 1900, salePrice: 3190, stock: 7, minStock: 4, unit: 'unidad' },
  // Snacks
  { id: 'prd_papas', name: 'Papas Fritas Clásicas 120 g', barcode: '7800000000158', categoryId: 'cat_snacks', supplierId: 'sup_distribuidora_norte', purchasePrice: 990, salePrice: 1790, stock: 19, minStock: 8, unit: 'paquete' },
  { id: 'prd_galletas', name: 'Galletas de Vainilla 6 un', barcode: '7800000000165', categoryId: 'cat_snacks', supplierId: 'sup_distribuidora_norte', purchasePrice: 520, salePrice: 990, stock: 26, minStock: 10, unit: 'paquete' },
  { id: 'prd_chocolate', name: 'Chocolate con Leche 90 g', barcode: '7800000000172', categoryId: 'cat_snacks', supplierId: 'sup_distribuidora_norte', purchasePrice: 780, salePrice: 1490, stock: 1, minStock: 6, unit: 'unidad' },
  // Limpieza
  { id: 'prd_detergente', name: 'Detergente Líquido 1 L', barcode: '7800000000189', categoryId: 'cat_limpieza', supplierId: 'sup_higiene_express', purchasePrice: 1990, salePrice: 3290, stock: 8, minStock: 4, unit: 'unidad' },
  { id: 'prd_cloro', name: 'Cloro Multiuso 900 ml', barcode: '7800000000196', categoryId: 'cat_limpieza', supplierId: 'sup_higiene_express', purchasePrice: 820, salePrice: 1490, stock: 12, minStock: 5, unit: 'unidad' },
  { id: 'prd_esponja', name: 'Esponja Multiuso 3 un', barcode: '7800000000202', categoryId: 'cat_limpieza', supplierId: 'sup_higiene_express', purchasePrice: 590, salePrice: 1190, stock: 15, minStock: 6, unit: 'paquete' },
  // Higiene
  { id: 'prd_papel', name: 'Papel Higiénico 4 rollos', barcode: '7800000000219', categoryId: 'cat_higiene', supplierId: 'sup_higiene_express', purchasePrice: 1690, salePrice: 2790, stock: 10, minStock: 6, unit: 'paquete' },
  { id: 'prd_jabon', name: 'Jabón de Tocador 90 g', barcode: '7800000000226', categoryId: 'cat_higiene', supplierId: 'sup_higiene_express', purchasePrice: 480, salePrice: 890, stock: 21, minStock: 8, unit: 'unidad' },
  { id: 'prd_shampoo', name: 'Shampoo Familiar 400 ml', barcode: '7800000000233', categoryId: 'cat_higiene', supplierId: 'sup_higiene_express', purchasePrice: 2100, salePrice: 3490, stock: 2, minStock: 4, unit: 'unidad' },
];

/** Construye el set completo de demostración con historial coherente. */
export function buildDemoSnapshot(): DatabaseSnapshot {
  const createdBase = daysAgo(45, 9);

  const categories: Category[] = CATEGORY_SEED.map((c) => ({
    ...c,
    createdAt: createdBase,
    updatedAt: createdBase,
  }));

  const suppliers: Supplier[] = SUPPLIER_SEED.map((s) => ({
    ...s,
    createdAt: createdBase,
    updatedAt: createdBase,
  }));

  const products: Product[] = PRODUCT_SEED.map((p, index) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    categoryId: p.categoryId,
    supplierId: p.supplierId,
    purchasePrice: p.purchasePrice,
    salePrice: p.salePrice,
    stock: p.stock,
    minStock: p.minStock,
    unit: p.unit,
    description: p.description ?? 'Producto ficticio incluido en los datos de demostración.',
    imageUrl: undefined,
    createdAt: daysAgo(45 - Math.min(index, 30), 9),
    updatedAt: daysAgo(Math.max(1, 12 - (index % 12)), 16),
  }));

  const byId = new Map(products.map((p) => [p.id, p]));

  const movementSeed: Array<{
    productId: string;
    type: StockMovement['type'];
    quantity: number;
    previousStock: number;
    resultingStock: number;
    days: number;
    note?: string;
  }> = [
    { productId: 'prd_cola_15', type: 'entrada', quantity: 24, previousStock: 3, resultingStock: 27, days: 12, note: 'Pedido semanal' },
    { productId: 'prd_cola_15', type: 'venta', quantity: 18, previousStock: 27, resultingStock: 9, days: 5 },
    { productId: 'prd_cola_15', type: 'venta', quantity: 6, previousStock: 9, resultingStock: 3, days: 1 },
    { productId: 'prd_arroz_1k', type: 'entrada', quantity: 20, previousStock: 4, resultingStock: 24, days: 14 },
    { productId: 'prd_arroz_1k', type: 'venta', quantity: 22, previousStock: 24, resultingStock: 2, days: 2 },
    { productId: 'prd_leche', type: 'entrada', quantity: 36, previousStock: 6, resultingStock: 42, days: 6, note: 'Entrega Lácteos del Valle' },
    { productId: 'prd_leche', type: 'venta', quantity: 18, previousStock: 42, resultingStock: 24, days: 1 },
    { productId: 'prd_papas', type: 'venta', quantity: 5, previousStock: 24, resultingStock: 19, days: 0 },
    { productId: 'prd_jugo_durazno', type: 'venta', quantity: 4, previousStock: 4, resultingStock: 0, days: 3 },
    { productId: 'prd_chocolate', type: 'venta', quantity: 11, previousStock: 12, resultingStock: 1, days: 2 },
    { productId: 'prd_queso', type: 'devolucion', quantity: 2, previousStock: 2, resultingStock: 4, days: 4, note: 'Cliente devolvió el producto sin abrir' },
    { productId: 'prd_shampoo', type: 'ajuste', quantity: 2, previousStock: 5, resultingStock: 2, days: 7, note: 'Diferencia detectada en conteo físico' },
    { productId: 'prd_detergente', type: 'entrada', quantity: 6, previousStock: 2, resultingStock: 8, days: 8 },
    { productId: 'prd_yogurt', type: 'entrada', quantity: 30, previousStock: 0, resultingStock: 30, days: 3 },
    { productId: 'prd_galletas', type: 'venta', quantity: 9, previousStock: 35, resultingStock: 26, days: 0 },
  ];

  const movements: StockMovement[] = movementSeed.map((m) => {
    const date = daysAgo(m.days, 11 + (m.days % 6));
    return {
      id: createId('mov'),
      productId: m.productId,
      productName: byId.get(m.productId)?.name ?? 'Producto',
      type: m.type,
      quantity: m.quantity,
      previousStock: m.previousStock,
      resultingStock: m.resultingStock,
      note: m.note,
      date,
      createdAt: date,
      updatedAt: date,
    };
  });

  const priceSeed = [
    { productId: 'prd_cola_15', previousPrice: 2290, newPrice: 2500, days: 9 },
    { productId: 'prd_arroz_1k', previousPrice: 1590, newPrice: 1690, days: 15 },
    { productId: 'prd_leche', previousPrice: 1290, newPrice: 1390, days: 4 },
    { productId: 'prd_aceite', previousPrice: 3190, newPrice: 2990, days: 6 },
    { productId: 'prd_papas', previousPrice: 1690, newPrice: 1790, days: 2 },
  ];

  const priceChanges: PriceChange[] = priceSeed.map((p) => {
    const date = daysAgo(p.days, 15);
    return {
      id: createId('prc'),
      productId: p.productId,
      productName: byId.get(p.productId)?.name ?? 'Producto',
      previousPrice: p.previousPrice,
      newPrice: p.newPrice,
      date,
      createdAt: date,
      updatedAt: date,
    };
  });

  const activity: ActivityLog[] = [
    ...priceChanges.map<ActivityLog>((p) => ({
      id: createId('act'),
      kind: 'precio.modificado',
      message: `Se modificó el precio de ${p.productName}`,
      entityId: p.productId,
      date: p.date,
      createdAt: p.date,
      updatedAt: p.date,
    })),
    ...movements.map<ActivityLog>((m) => ({
      id: createId('act'),
      kind: 'stock.movimiento',
      message:
        m.type === 'entrada'
          ? `Se agregaron ${m.quantity} unidades de ${m.productName}`
          : m.type === 'venta'
            ? `Se vendieron ${m.quantity} unidades de ${m.productName}`
            : m.type === 'devolucion'
              ? `Se registró una devolución de ${m.quantity} unidades de ${m.productName}`
              : `Se ajustó el stock de ${m.productName} a ${m.resultingStock}`,
      entityId: m.productId,
      date: m.date,
      createdAt: m.date,
      updatedAt: m.date,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return {
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    products,
    categories,
    suppliers,
    movements: movements.sort((a, b) => b.date.localeCompare(a.date)),
    priceChanges: priceChanges.sort((a, b) => b.date.localeCompare(a.date)),
    activity,
    settings: { ...DEFAULT_SETTINGS, businessName: 'Almacén Don Emilio (demo)', updatedAt: new Date().toISOString() },
  };
}

/** Snapshot vacío, con las categorías base ya creadas. */
export function buildEmptySnapshot(): DatabaseSnapshot {
  const now = new Date().toISOString();
  return {
    version: SCHEMA_VERSION,
    exportedAt: now,
    products: [],
    categories: CATEGORY_SEED.map((c) => ({ ...c, createdAt: now, updatedAt: now })),
    suppliers: [],
    movements: [],
    priceChanges: [],
    activity: [],
    settings: { ...DEFAULT_SETTINGS, updatedAt: now },
  };
}
