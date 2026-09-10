/**
 * Contrato de persistencia de bajo nivel.
 *
 * Toda la app habla con `StorageAdapter` y nunca con `localStorage` directo.
 * Para migrar a IndexedDB, Supabase o una API REST alcanza con escribir otro
 * adaptador que cumpla esta interfaz y cambiarlo en `src/storage/index.ts`.
 * Es asíncrono a propósito: la versión local resuelve al instante, pero la
 * firma ya está lista para la red.
 */
export interface StorageAdapter {
  readonly name: string;
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  /** Borra únicamente las claves de esta aplicación. */
  clearAll(keys: string[]): Promise<void>;
  /** true si el motor está disponible en este navegador. */
  isAvailable(): boolean;
}

/** Claves usadas en el almacenamiento. Prefijadas para no chocar con otras apps. */
export const STORAGE_KEYS = {
  products: 'gps:products',
  categories: 'gps:categories',
  suppliers: 'gps:suppliers',
  movements: 'gps:movements',
  priceChanges: 'gps:price-changes',
  activity: 'gps:activity',
  settings: 'gps:settings',
  meta: 'gps:meta',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export const ALL_STORAGE_KEYS: string[] = Object.values(STORAGE_KEYS);

/** Versión del esquema persistido; sirve para migraciones futuras. */
export const SCHEMA_VERSION = 1;
