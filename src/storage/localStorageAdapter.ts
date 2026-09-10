import type { StorageAdapter, Workspace } from './adapter';

/**
 * Adaptador basado en `localStorage`.
 * Tolera navegadores en modo privado o con almacenamiento bloqueado:
 * si falla, la app sigue funcionando en memoria durante la sesión.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'localStorage';
  private memoryFallback = new Map<string, string>();
  private available: boolean;
  private workspace: Workspace = 'real';

  constructor() {
    this.available = LocalStorageAdapter.probe();
  }

  setWorkspace(workspace: Workspace): void {
    this.workspace = workspace;
  }

  getWorkspace(): Workspace {
    return this.workspace;
  }

  /**
   * Traduce la clave lógica al espacio activo:
   *   real → gps:products
   *   demo → gps:demo:products
   */
  private resolve(key: string): string {
    if (this.workspace === 'real') return key;
    return key.startsWith('gps:') ? `gps:demo:${key.slice(4)}` : `demo:${key}`;
  }

  private static probe(): boolean {
    try {
      const testKey = '__gps_probe__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  private getRaw(logicalKey: string): string | null {
    const key = this.resolve(logicalKey);
    if (!this.available) return this.memoryFallback.get(key) ?? null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return this.memoryFallback.get(key) ?? null;
    }
  }

  private setRaw(logicalKey: string, value: string): void {
    const key = this.resolve(logicalKey);
    this.memoryFallback.set(key, value);
    if (!this.available) return;
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      // Cuota llena o almacenamiento bloqueado: seguimos en memoria.
      console.warn('[storage] no se pudo escribir en localStorage:', error);
      this.available = false;
    }
  }

  async read<T>(key: string): Promise<T | null> {
    const raw = this.getRaw(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      console.warn(`[storage] dato corrupto en "${key}", se descarta:`, error);
      return null;
    }
  }

  async write<T>(key: string, value: T): Promise<void> {
    this.setRaw(key, JSON.stringify(value));
  }

  async remove(logicalKey: string): Promise<void> {
    const key = this.resolve(logicalKey);
    this.memoryFallback.delete(key);
    if (!this.available) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* no-op */
    }
  }

  /** Lee una clave global, fuera de los espacios de trabajo. */
  readGlobal(key: string): string | null {
    if (!this.available) return this.memoryFallback.get(key) ?? null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return this.memoryFallback.get(key) ?? null;
    }
  }

  /** Escribe una clave global, fuera de los espacios de trabajo. */
  writeGlobal(key: string, value: string): void {
    this.memoryFallback.set(key, value);
    if (!this.available) return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* no-op */
    }
  }

  async clearAll(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => this.remove(k)));
  }
}
