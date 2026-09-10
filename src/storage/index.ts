import { LocalStorageAdapter } from './localStorageAdapter';
import { LocalDataSource } from './dataSource';

export * from './adapter';
export * from './dataSource';
export { LocalStorageAdapter } from './localStorageAdapter';

/**
 * Punto único de configuración de la persistencia.
 *
 * FASE 2 — para migrar a la nube, reemplazar estas dos líneas por:
 *   export const dataSource = new SupabaseDataSource(supabaseClient);
 * El resto de la aplicación no cambia.
 */
const adapter = new LocalStorageAdapter();
export const dataSource = new LocalDataSource(adapter);
export const storageAdapter = adapter;
