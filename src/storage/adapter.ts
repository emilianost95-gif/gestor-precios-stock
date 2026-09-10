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
  /** Borra únicamente las claves de esta aplicación en el espacio activo. */
  clearAll(keys: string[]): Promise<void>;
  /** true si el motor está disponible en este navegador. */
  isAvailable(): boolean;
  /** Cambia el espacio de trabajo activo (datos reales o demostración). */
  setWorkspace(workspace: Workspace): void;
  getWorkspace(): Workspace;
}

/**
 * Espacios de trabajo separados.
 *
 * `real` guarda en `gps:*` y `demo` en `gps:demo:*`. Son dos conjuntos de
 * claves distintos en el mismo `localStorage`: nada de lo que se haga dentro
 * del modo demostración puede tocar los datos reales del negocio, porque
 * físicamente se escriben en otro lado.
 */
export type Workspace = 'real' | 'demo';

/** Clave con el espacio activo. Vive fuera de ambos espacios, a propósito. */
export const WORKSPACE_KEY = 'gps:workspace';

/** Progreso del tutorial del Copiloto. También fuera de los espacios. */
export const LESSONS_KEY = 'gps:copilot-lessons';

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
