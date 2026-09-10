import type { DatabaseSnapshot, Product, Settings } from '@/types';
import { SCHEMA_VERSION } from '@/storage/adapter';
import { DEFAULT_SETTINGS } from '@/data/defaults';

export interface BackupValidationResult {
  ok: boolean;
  snapshot?: DatabaseSnapshot;
  errors: string[];
  warnings: string[];
  summary?: {
    products: number;
    categories: number;
    suppliers: number;
    movements: number;
    exportedAt: string;
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Valida un archivo de respaldo ANTES de reemplazar los datos actuales.
 * Nunca confía en el archivo: revisa estructura, tipos y campos obligatorios.
 */
export function validateBackup(rawJson: string): BackupValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, errors: ['El archivo no es un JSON válido.'], warnings };
  }

  if (!isObject(parsed)) {
    return { ok: false, errors: ['El archivo no tiene el formato esperado.'], warnings };
  }

  if (!Array.isArray(parsed.products)) {
    errors.push('El respaldo no contiene la lista de productos.');
  }
  if (typeof parsed.version === 'number' && parsed.version > SCHEMA_VERSION) {
    warnings.push(
      `El respaldo fue creado con una versión más nueva (v${parsed.version}). Puede que algunos campos se ignoren.`,
    );
  }

  if (errors.length > 0) return { ok: false, errors, warnings };

  const rawProducts = asArray<Record<string, unknown>>(parsed.products);
  const products: Product[] = [];
  rawProducts.forEach((p, index) => {
    if (!isObject(p) || typeof p.name !== 'string' || !p.name.trim()) {
      warnings.push(`Producto #${index + 1} descartado: no tiene nombre.`);
      return;
    }
    const salePrice = Number(p.salePrice);
    const purchasePrice = Number(p.purchasePrice);
    const stock = Number(p.stock);
    const minStock = Number(p.minStock);
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      warnings.push(`Producto "${p.name}" descartado: precio de venta inválido.`);
      return;
    }
    const now = new Date().toISOString();
    products.push({
      id: typeof p.id === 'string' && p.id ? p.id : `prd_${index}_${Date.now().toString(36)}`,
      name: p.name.trim(),
      barcode: typeof p.barcode === 'string' ? p.barcode : undefined,
      categoryId: typeof p.categoryId === 'string' ? p.categoryId : null,
      supplierId: typeof p.supplierId === 'string' ? p.supplierId : null,
      purchasePrice: Number.isFinite(purchasePrice) && purchasePrice >= 0 ? purchasePrice : 0,
      salePrice,
      stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
      minStock: Number.isFinite(minStock) && minStock >= 0 ? minStock : 0,
      unit: (typeof p.unit === 'string' ? p.unit : 'unidad') as Product['unit'],
      description: typeof p.description === 'string' ? p.description : undefined,
      imageUrl: typeof p.imageUrl === 'string' ? p.imageUrl : undefined,
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : now,
      updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : now,
    });
  });

  if (products.length === 0) {
    errors.push('El respaldo no tiene ningún producto válido.');
    return { ok: false, errors, warnings };
  }

  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...(isObject(parsed.settings) ? (parsed.settings as Partial<Settings>) : {}),
    updatedAt: new Date().toISOString(),
  };

  const snapshot: DatabaseSnapshot = {
    version: SCHEMA_VERSION,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    products,
    categories: asArray(parsed.categories),
    suppliers: asArray(parsed.suppliers),
    movements: asArray(parsed.movements),
    priceChanges: asArray(parsed.priceChanges),
    activity: asArray(parsed.activity),
    settings,
  };

  return {
    ok: true,
    snapshot,
    errors,
    warnings,
    summary: {
      products: snapshot.products.length,
      categories: snapshot.categories.length,
      suppliers: snapshot.suppliers.length,
      movements: snapshot.movements.length,
      exportedAt: snapshot.exportedAt,
    },
  };
}

export function snapshotToJSON(snapshot: DatabaseSnapshot): string {
  return JSON.stringify({ ...snapshot, exportedAt: new Date().toISOString() }, null, 2);
}
