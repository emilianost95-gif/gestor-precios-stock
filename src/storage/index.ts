import { LocalStorageAdapter } from './localStorageAdapter';
import { LocalDataSource } from './dataSource';
import { LESSONS_KEY, WORKSPACE_KEY, type Workspace } from './adapter';

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

/* ------------------------------------------------------------------ */
/* Preferencias globales, fuera de los espacios de trabajo             */
/* ------------------------------------------------------------------ */

/** Espacio activo la última vez que se usó la app. */
export function readSavedWorkspace(): Workspace {
  return adapter.readGlobal(WORKSPACE_KEY) === 'demo' ? 'demo' : 'real';
}

export function saveWorkspace(workspace: Workspace): void {
  adapter.writeGlobal(WORKSPACE_KEY, workspace);
}

/** Lecciones del tutorial ya completadas. Se comparten entre espacios. */
export function readCompletedLessons(): string[] {
  const raw = adapter.readGlobal(LESSONS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveCompletedLessons(ids: string[]): void {
  adapter.writeGlobal(LESSONS_KEY, JSON.stringify(ids));
}
