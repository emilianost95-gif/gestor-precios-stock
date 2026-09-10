import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  ActivityKind,
  ActivityLog,
  Category,
  DatabaseSnapshot,
  MovementType,
  PriceChange,
  Product,
  Settings,
  StockMovement,
  Supplier,
} from '@/types';
import { dataSource } from '@/storage';
import { SCHEMA_VERSION } from '@/storage/adapter';
import { DEFAULT_SETTINGS, pickCategoryColor } from '@/data/defaults';
import { buildDemoSnapshot, buildEmptySnapshot } from '@/data/demoData';
import { createId, nowISO } from '@/utils/id';
import { normalizeText } from '@/utils/format';
import type { ParsedProductRow } from '@/services/csvService';

/** Datos que la UI envía para crear/editar un producto (sin ids ni fechas). */
export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
export type CategoryInput = Omit<Category, 'id' | 'createdAt' | 'updatedAt'>;
export type SupplierInput = Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>;

export interface ImportSummary {
  created: number;
  updated: number;
  categoriesCreated: number;
  suppliersCreated: number;
}

interface StoreState {
  products: Product[];
  categories: Category[];
  suppliers: Supplier[];
  movements: StockMovement[];
  priceChanges: PriceChange[];
  activity: ActivityLog[];
  settings: Settings;
  loading: boolean;
  isDemoData: boolean;
}

interface StoreActions {
  createProduct: (input: ProductInput) => Product;
  updateProduct: (id: string, input: ProductInput) => void;
  deleteProduct: (id: string) => void;
  duplicateProduct: (id: string) => Product | null;
  updateSalePrice: (id: string, newPrice: number) => void;
  registerMovement: (args: {
    productId: string;
    type: MovementType;
    quantity: number;
    /** Sólo para 'ajuste': valor absoluto al que se fija el stock. */
    absoluteStock?: number;
    note?: string;
  }) => void;
  createCategory: (input: Partial<CategoryInput> & { name: string }) => Category;
  updateCategory: (id: string, input: Partial<CategoryInput>) => void;
  deleteCategory: (id: string) => void;
  createSupplier: (input: SupplierInput) => Supplier;
  updateSupplier: (id: string, input: Partial<SupplierInput>) => void;
  deleteSupplier: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  loadDemoData: () => void;
  clearAllData: () => void;
  importProducts: (rows: ParsedProductRow[]) => ImportSummary;
  restoreSnapshot: (snapshot: DatabaseSnapshot) => void;
  getSnapshot: () => DatabaseSnapshot;
  priceHistoryFor: (productId: string) => PriceChange[];
  movementsFor: (productId: string) => StockMovement[];
}

type StoreContextValue = StoreState & StoreActions;

const StoreContext = createContext<StoreContextValue | null>(null);

const MAX_ACTIVITY = 400;
const MAX_MOVEMENTS = 1000;
const MAX_PRICE_CHANGES = 600;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [isDemoData, setIsDemoData] = useState(false);

  const hydrated = useRef(false);

  /* ------------------------------------------------------------------ */
  /* Carga inicial                                                       */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const empty = await dataSource.isEmpty();
      const snapshot = empty ? buildEmptySnapshot() : await dataSource.loadSnapshot();
      if (cancelled) return;

      setProducts(snapshot.products);
      setCategories(snapshot.categories);
      setSuppliers(snapshot.suppliers);
      setMovements(snapshot.movements);
      setPriceChanges(snapshot.priceChanges);
      setActivity(snapshot.activity);
      setSettings(snapshot.settings);
      setIsDemoData(snapshot.products.some((p) => p.id.startsWith('prd_')));

      if (empty) await dataSource.replaceAll(snapshot);

      hydrated.current = true;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* Persistencia automática (una escritura por colección modificada)     */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (hydrated.current) void dataSource.saveProducts(products);
  }, [products]);
  useEffect(() => {
    if (hydrated.current) void dataSource.saveCategories(categories);
  }, [categories]);
  useEffect(() => {
    if (hydrated.current) void dataSource.saveSuppliers(suppliers);
  }, [suppliers]);
  useEffect(() => {
    if (hydrated.current) void dataSource.saveMovements(movements);
  }, [movements]);
  useEffect(() => {
    if (hydrated.current) void dataSource.savePriceChanges(priceChanges);
  }, [priceChanges]);
  useEffect(() => {
    if (hydrated.current) void dataSource.saveActivity(activity);
  }, [activity]);
  useEffect(() => {
    if (hydrated.current) void dataSource.saveSettings(settings);
  }, [settings]);

  /* ------------------------------------------------------------------ */
  /* Helpers internos                                                    */
  /* ------------------------------------------------------------------ */
  const log = useCallback((kind: ActivityKind, message: string, entityId?: string) => {
    const date = nowISO();
    setActivity((prev) =>
      [
        { id: createId('act'), kind, message, entityId, date, createdAt: date, updatedAt: date },
        ...prev,
      ].slice(0, MAX_ACTIVITY),
    );
  }, []);

  const pushMovement = useCallback((movement: StockMovement) => {
    setMovements((prev) => [movement, ...prev].slice(0, MAX_MOVEMENTS));
  }, []);

  const pushPriceChange = useCallback((change: PriceChange) => {
    setPriceChanges((prev) => [change, ...prev].slice(0, MAX_PRICE_CHANGES));
  }, []);

  /* ------------------------------------------------------------------ */
  /* Productos                                                           */
  /* ------------------------------------------------------------------ */
  const createProduct = useCallback<StoreActions['createProduct']>(
    (input) => {
      const date = nowISO();
      const product: Product = { ...input, id: createId('p'), createdAt: date, updatedAt: date };
      setProducts((prev) => [product, ...prev]);
      log('producto.creado', `Se creó el producto ${product.name}`, product.id);

      if (product.stock > 0) {
        pushMovement({
          id: createId('mov'),
          productId: product.id,
          productName: product.name,
          type: 'entrada',
          quantity: product.stock,
          previousStock: 0,
          resultingStock: product.stock,
          note: 'Stock inicial',
          date,
          createdAt: date,
          updatedAt: date,
        });
      }
      return product;
    },
    [log, pushMovement],
  );

  const updateProduct = useCallback<StoreActions['updateProduct']>(
    (id, input) => {
      const date = nowISO();
      const previous = products.find((p) => p.id === id);
      if (!previous) return;

      setProducts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, ...input, id: p.id, createdAt: p.createdAt, updatedAt: date } : p,
        ),
      );

      if (previous.salePrice !== input.salePrice) {
        pushPriceChange({
          id: createId('prc'),
          productId: id,
          productName: input.name,
          previousPrice: previous.salePrice,
          newPrice: input.salePrice,
          date,
          createdAt: date,
          updatedAt: date,
        });
      }

      if (previous.stock !== input.stock) {
        pushMovement({
          id: createId('mov'),
          productId: id,
          productName: input.name,
          type: 'ajuste',
          quantity: Math.abs(input.stock - previous.stock),
          previousStock: previous.stock,
          resultingStock: input.stock,
          note: 'Ajuste desde la edición del producto',
          date,
          createdAt: date,
          updatedAt: date,
        });
      }

      log('producto.editado', `Se editó el producto ${input.name}`, id);
    },
    [products, log, pushMovement, pushPriceChange],
  );

  const deleteProduct = useCallback<StoreActions['deleteProduct']>(
    (id) => {
      const removed = products.find((p) => p.id === id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      log('producto.eliminado', `Se eliminó el producto ${removed?.name ?? ''}`.trim(), id);
    },
    [products, log],
  );

  const duplicateProduct = useCallback<StoreActions['duplicateProduct']>(
    (id) => {
      const original = products.find((p) => p.id === id);
      if (!original) return null;
      const date = nowISO();
      let name = `${original.name} (copia)`;
      let counter = 2;
      while (products.some((p) => normalizeText(p.name) === normalizeText(name))) {
        name = `${original.name} (copia ${counter})`;
        counter += 1;
      }
      const copy: Product = {
        ...original,
        id: createId('p'),
        name,
        barcode: '',
        stock: 0,
        createdAt: date,
        updatedAt: date,
      };
      setProducts((prev) => [copy, ...prev]);
      log('producto.duplicado', `Se duplicó el producto ${original.name}`, copy.id);
      return copy;
    },
    [products, log],
  );

  const updateSalePrice = useCallback<StoreActions['updateSalePrice']>(
    (id, newPrice) => {
      const product = products.find((p) => p.id === id);
      if (!product || product.salePrice === newPrice) return;
      const date = nowISO();

      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, salePrice: newPrice, updatedAt: date } : p)),
      );
      pushPriceChange({
        id: createId('prc'),
        productId: id,
        productName: product.name,
        previousPrice: product.salePrice,
        newPrice,
        date,
        createdAt: date,
        updatedAt: date,
      });
      log('precio.modificado', `Se modificó el precio de ${product.name}`, id);
    },
    [products, log, pushPriceChange],
  );

  /* ------------------------------------------------------------------ */
  /* Stock                                                               */
  /* ------------------------------------------------------------------ */
  const registerMovement = useCallback<StoreActions['registerMovement']>(
    ({ productId, type, quantity, absoluteStock, note }) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      const date = nowISO();
      const previousStock = product.stock;
      let resultingStock: number;
      if (type === 'ajuste') {
        resultingStock = Math.max(0, absoluteStock ?? previousStock);
      } else if (type === 'venta') {
        resultingStock = Math.max(0, previousStock - quantity);
      } else {
        resultingStock = previousStock + quantity;
      }

      if (resultingStock === previousStock && type === 'ajuste') return;

      const realQuantity = type === 'ajuste' ? Math.abs(resultingStock - previousStock) : quantity;

      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock: resultingStock, updatedAt: date } : p)),
      );

      pushMovement({
        id: createId('mov'),
        productId,
        productName: product.name,
        type,
        quantity: realQuantity,
        previousStock,
        resultingStock,
        note,
        date,
        createdAt: date,
        updatedAt: date,
      });

      const message =
        type === 'entrada'
          ? `Se agregaron ${realQuantity} unidades de ${product.name}`
          : type === 'venta'
            ? `Se vendieron ${realQuantity} unidades de ${product.name}`
            : type === 'devolucion'
              ? `Se registró una devolución de ${realQuantity} unidades de ${product.name}`
              : `Se ajustó el stock de ${product.name} a ${resultingStock}`;
      log('stock.movimiento', message, productId);
    },
    [products, log, pushMovement],
  );

  /* ------------------------------------------------------------------ */
  /* Categorías                                                          */
  /* ------------------------------------------------------------------ */
  const createCategory = useCallback<StoreActions['createCategory']>(
    (input) => {
      const date = nowISO();
      const category: Category = {
        id: createId('cat'),
        name: input.name.trim(),
        color: input.color ?? pickCategoryColor(categories.length),
        description: input.description,
        createdAt: date,
        updatedAt: date,
      };
      setCategories((prev) => [...prev, category]);
      log('categoria.creada', `Se creó la categoría ${category.name}`, category.id);
      return category;
    },
    [categories, log],
  );

  const updateCategory = useCallback<StoreActions['updateCategory']>(
    (id, input) => {
      const date = nowISO();
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...input, updatedAt: date } : c)));
      log('categoria.editada', `Se editó la categoría ${input.name ?? ''}`.trim(), id);
    },
    [log],
  );

  const deleteCategory = useCallback<StoreActions['deleteCategory']>(
    (id) => {
      const name = categories.find((c) => c.id === id)?.name ?? '';
      setCategories((prev) => prev.filter((c) => c.id !== id));
      // Los productos NO se borran: quedan "Sin categoría".
      const date = nowISO();
      setProducts((prev) =>
        prev.map((p) => (p.categoryId === id ? { ...p, categoryId: null, updatedAt: date } : p)),
      );
      log('categoria.eliminada', `Se eliminó la categoría ${name}`.trim(), id);
    },
    [categories, log],
  );

  /* ------------------------------------------------------------------ */
  /* Proveedores                                                         */
  /* ------------------------------------------------------------------ */
  const createSupplier = useCallback<StoreActions['createSupplier']>(
    (input) => {
      const date = nowISO();
      const supplier: Supplier = { ...input, id: createId('sup'), createdAt: date, updatedAt: date };
      setSuppliers((prev) => [...prev, supplier]);
      log('proveedor.creado', `Se creó el proveedor ${supplier.name}`, supplier.id);
      return supplier;
    },
    [log],
  );

  const updateSupplier = useCallback<StoreActions['updateSupplier']>(
    (id, input) => {
      const date = nowISO();
      setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...input, updatedAt: date } : s)));
      log('proveedor.editado', `Se editó el proveedor ${input.name ?? ''}`.trim(), id);
    },
    [log],
  );

  const deleteSupplier = useCallback<StoreActions['deleteSupplier']>(
    (id) => {
      const name = suppliers.find((s) => s.id === id)?.name ?? '';
      const date = nowISO();
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      setProducts((prev) =>
        prev.map((p) => (p.supplierId === id ? { ...p, supplierId: null, updatedAt: date } : p)),
      );
      log('proveedor.eliminado', `Se eliminó el proveedor ${name}`.trim(), id);
    },
    [suppliers, log],
  );

  /* ------------------------------------------------------------------ */
  /* Configuración y datos                                               */
  /* ------------------------------------------------------------------ */
  const updateSettings = useCallback<StoreActions['updateSettings']>((patch) => {
    setSettings((prev) => ({ ...prev, ...patch, updatedAt: nowISO() }));
  }, []);

  const applySnapshot = useCallback((snapshot: DatabaseSnapshot) => {
    setProducts(snapshot.products);
    setCategories(snapshot.categories);
    setSuppliers(snapshot.suppliers);
    setMovements(snapshot.movements);
    setPriceChanges(snapshot.priceChanges);
    setActivity(snapshot.activity);
    setSettings(snapshot.settings);
    void dataSource.replaceAll(snapshot);
  }, []);

  const loadDemoData = useCallback(() => {
    applySnapshot(buildDemoSnapshot());
    setIsDemoData(true);
    log('datos.demo', 'Se cargaron los datos de demostración');
  }, [applySnapshot, log]);

  const clearAllData = useCallback(() => {
    applySnapshot(buildEmptySnapshot());
    setIsDemoData(false);
    log('datos.limpiados', 'Se limpiaron todos los datos');
  }, [applySnapshot, log]);

  const restoreSnapshot = useCallback<StoreActions['restoreSnapshot']>(
    (snapshot) => {
      applySnapshot(snapshot);
      setIsDemoData(false);
      log('datos.restaurados', `Se restauró un respaldo con ${snapshot.products.length} productos`);
    },
    [applySnapshot, log],
  );

  const importProducts = useCallback<StoreActions['importProducts']>(
    (rows) => {
      const date = nowISO();
      const summary: ImportSummary = {
        created: 0,
        updated: 0,
        categoriesCreated: 0,
        suppliersCreated: 0,
      };

      const nextCategories = [...categories];
      const nextSuppliers = [...suppliers];
      const nextProducts = [...products];

      const findOrCreateCategory = (name: string): string | null => {
        if (!name.trim()) return null;
        const found = nextCategories.find((c) => normalizeText(c.name) === normalizeText(name));
        if (found) return found.id;
        const created: Category = {
          id: createId('cat'),
          name: name.trim(),
          color: pickCategoryColor(nextCategories.length),
          createdAt: date,
          updatedAt: date,
        };
        nextCategories.push(created);
        summary.categoriesCreated += 1;
        return created.id;
      };

      const findOrCreateSupplier = (name: string): string | null => {
        if (!name.trim()) return null;
        const found = nextSuppliers.find((s) => normalizeText(s.name) === normalizeText(name));
        if (found) return found.id;
        const created: Supplier = {
          id: createId('sup'),
          name: name.trim(),
          createdAt: date,
          updatedAt: date,
        };
        nextSuppliers.push(created);
        summary.suppliersCreated += 1;
        return created.id;
      };

      for (const row of rows) {
        const categoryId = findOrCreateCategory(row.categoryName);
        const supplierId = findOrCreateSupplier(row.supplierName);
        const index = nextProducts.findIndex(
          (p) =>
            normalizeText(p.name) === normalizeText(row.name) ||
            (!!row.barcode && !!p.barcode && normalizeText(p.barcode) === normalizeText(row.barcode)),
        );

        if (index >= 0) {
          nextProducts[index] = {
            ...nextProducts[index],
            name: row.name,
            barcode: row.barcode || nextProducts[index].barcode,
            categoryId: categoryId ?? nextProducts[index].categoryId,
            supplierId: supplierId ?? nextProducts[index].supplierId,
            purchasePrice: row.purchasePrice,
            salePrice: row.salePrice,
            stock: row.stock,
            minStock: row.minStock,
            unit: row.unit,
            description: row.description || nextProducts[index].description,
            updatedAt: date,
          };
          summary.updated += 1;
        } else {
          nextProducts.unshift({
            id: createId('p'),
            name: row.name,
            barcode: row.barcode || undefined,
            categoryId,
            supplierId,
            purchasePrice: row.purchasePrice,
            salePrice: row.salePrice,
            stock: row.stock,
            minStock: row.minStock,
            unit: row.unit,
            description: row.description || undefined,
            createdAt: date,
            updatedAt: date,
          });
          summary.created += 1;
        }
      }

      setCategories(nextCategories);
      setSuppliers(nextSuppliers);
      setProducts(nextProducts);
      log(
        'datos.importados',
        `Se importaron ${summary.created} productos nuevos y se actualizaron ${summary.updated}`,
      );
      return summary;
    },
    [products, categories, suppliers, log],
  );

  const getSnapshot = useCallback<StoreActions['getSnapshot']>(
    () => ({
      version: SCHEMA_VERSION,
      exportedAt: nowISO(),
      products,
      categories,
      suppliers,
      movements,
      priceChanges,
      activity,
      settings,
    }),
    [products, categories, suppliers, movements, priceChanges, activity, settings],
  );

  const priceHistoryFor = useCallback(
    (productId: string) => priceChanges.filter((c) => c.productId === productId),
    [priceChanges],
  );

  const movementsFor = useCallback(
    (productId: string) => movements.filter((m) => m.productId === productId),
    [movements],
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      products,
      categories,
      suppliers,
      movements,
      priceChanges,
      activity,
      settings,
      loading,
      isDemoData,
      createProduct,
      updateProduct,
      deleteProduct,
      duplicateProduct,
      updateSalePrice,
      registerMovement,
      createCategory,
      updateCategory,
      deleteCategory,
      createSupplier,
      updateSupplier,
      deleteSupplier,
      updateSettings,
      loadDemoData,
      clearAllData,
      importProducts,
      restoreSnapshot,
      getSnapshot,
      priceHistoryFor,
      movementsFor,
    }),
    [
      products,
      categories,
      suppliers,
      movements,
      priceChanges,
      activity,
      settings,
      loading,
      isDemoData,
      createProduct,
      updateProduct,
      deleteProduct,
      duplicateProduct,
      updateSalePrice,
      registerMovement,
      createCategory,
      updateCategory,
      deleteCategory,
      createSupplier,
      updateSupplier,
      deleteSupplier,
      updateSettings,
      loadDemoData,
      clearAllData,
      importProducts,
      restoreSnapshot,
      getSnapshot,
      priceHistoryFor,
      movementsFor,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore debe usarse dentro de <StoreProvider>.');
  return ctx;
}
