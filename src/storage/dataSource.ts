import type {
  ActivityLog,
  Category,
  DatabaseSnapshot,
  PriceChange,
  Product,
  Settings,
  StockMovement,
  Supplier,
} from '@/types';
import { DEFAULT_SETTINGS } from '@/data/defaults';
import {
  ALL_STORAGE_KEYS,
  SCHEMA_VERSION,
  STORAGE_KEYS,
  type StorageAdapter,
  type Workspace,
} from './adapter';

/**
 * Fachada de datos que usa toda la aplicación.
 *
 * Hoy hay una sola implementación (`LocalDataSource`), pero la interfaz está
 * pensada para que una futura `SupabaseDataSource` — o un cliente REST — entre
 * sin tocar ni servicios ni componentes.
 */
export interface DataSource {
  readonly name: string;
  loadSnapshot(): Promise<DatabaseSnapshot>;
  saveProducts(products: Product[]): Promise<void>;
  saveCategories(categories: Category[]): Promise<void>;
  saveSuppliers(suppliers: Supplier[]): Promise<void>;
  saveMovements(movements: StockMovement[]): Promise<void>;
  savePriceChanges(changes: PriceChange[]): Promise<void>;
  saveActivity(activity: ActivityLog[]): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  replaceAll(snapshot: DatabaseSnapshot): Promise<void>;
  clear(): Promise<void>;
  /** true si el primer arranque todavía no tiene datos guardados. */
  isEmpty(): Promise<boolean>;
  /** Cambia entre los datos reales y los de demostración. */
  setWorkspace(workspace: Workspace): void;
  getWorkspace(): Workspace;
}

export class LocalDataSource implements DataSource {
  readonly name: string;

  constructor(private adapter: StorageAdapter) {
    this.name = `local:${adapter.name}`;
  }

  async loadSnapshot(): Promise<DatabaseSnapshot> {
    const [products, categories, suppliers, movements, priceChanges, activity, settings] =
      await Promise.all([
        this.adapter.read<Product[]>(STORAGE_KEYS.products),
        this.adapter.read<Category[]>(STORAGE_KEYS.categories),
        this.adapter.read<Supplier[]>(STORAGE_KEYS.suppliers),
        this.adapter.read<StockMovement[]>(STORAGE_KEYS.movements),
        this.adapter.read<PriceChange[]>(STORAGE_KEYS.priceChanges),
        this.adapter.read<ActivityLog[]>(STORAGE_KEYS.activity),
        this.adapter.read<Settings>(STORAGE_KEYS.settings),
      ]);

    return {
      version: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      products: products ?? [],
      categories: categories ?? [],
      suppliers: suppliers ?? [],
      movements: movements ?? [],
      priceChanges: priceChanges ?? [],
      activity: activity ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) },
    };
  }

  saveProducts(products: Product[]): Promise<void> {
    return this.adapter.write(STORAGE_KEYS.products, products);
  }

  saveCategories(categories: Category[]): Promise<void> {
    return this.adapter.write(STORAGE_KEYS.categories, categories);
  }

  saveSuppliers(suppliers: Supplier[]): Promise<void> {
    return this.adapter.write(STORAGE_KEYS.suppliers, suppliers);
  }

  saveMovements(movements: StockMovement[]): Promise<void> {
    return this.adapter.write(STORAGE_KEYS.movements, movements);
  }

  savePriceChanges(changes: PriceChange[]): Promise<void> {
    return this.adapter.write(STORAGE_KEYS.priceChanges, changes);
  }

  saveActivity(activity: ActivityLog[]): Promise<void> {
    return this.adapter.write(STORAGE_KEYS.activity, activity);
  }

  saveSettings(settings: Settings): Promise<void> {
    return this.adapter.write(STORAGE_KEYS.settings, settings);
  }

  async replaceAll(snapshot: DatabaseSnapshot): Promise<void> {
    await Promise.all([
      this.saveProducts(snapshot.products),
      this.saveCategories(snapshot.categories),
      this.saveSuppliers(snapshot.suppliers),
      this.saveMovements(snapshot.movements),
      this.savePriceChanges(snapshot.priceChanges),
      this.saveActivity(snapshot.activity),
      this.saveSettings(snapshot.settings),
      this.adapter.write(STORAGE_KEYS.meta, { version: SCHEMA_VERSION, seeded: true }),
    ]);
  }

  async clear(): Promise<void> {
    await this.adapter.clearAll(ALL_STORAGE_KEYS);
  }

  async isEmpty(): Promise<boolean> {
    const meta = await this.adapter.read<{ seeded?: boolean }>(STORAGE_KEYS.meta);
    if (meta?.seeded) return false;
    const products = await this.adapter.read<Product[]>(STORAGE_KEYS.products);
    return !products || products.length === 0;
  }

  async markSeeded(): Promise<void> {
    await this.adapter.write(STORAGE_KEYS.meta, { version: SCHEMA_VERSION, seeded: true });
  }

  setWorkspace(workspace: Workspace): void {
    this.adapter.setWorkspace(workspace);
  }

  getWorkspace(): Workspace {
    return this.adapter.getWorkspace();
  }
}
