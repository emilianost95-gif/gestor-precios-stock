import { Capacitor } from '@capacitor/core';

/**
 * Detección de plataforma.
 *
 * Vive en su propio módulo (y no en `index.ts`) para que cualquier archivo lo
 * importe sin arrastrar los hooks de React ni los plugins nativos.
 */

/** `true` sólo cuando la app corre dentro del contenedor Android. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Nombre de la plataforma: 'android', 'ios' o 'web'. */
export function nativePlatform(): string {
  return Capacitor.getPlatform();
}
