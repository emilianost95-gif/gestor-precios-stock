import type { StorageAdapter } from './adapter';

/**
 * Adaptador basado en `localStorage`.
 * Tolera navegadores en modo privado o con almacenamiento bloqueado:
 * si falla, la app sigue funcionando en memoria durante la sesión.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'localStorage';
  private memoryFallback = new Map<string, string>();
  private available: boolean;

  constructor() {
    this.available = LocalStorageAdapter.probe();
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

  private getRaw(key: string): string | null {
    if (!this.available) return this.memoryFallback.get(key) ?? null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return this.memoryFallback.get(key) ?? null;
    }
  }

  private setRaw(key: string, value: string): void {
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

  async remove(key: string): Promise<void> {
    this.memoryFallback.delete(key);
    if (!this.available) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* no-op */
    }
  }

  async clearAll(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => this.remove(k)));
  }
}
