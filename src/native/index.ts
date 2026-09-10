/**
 * Capa nativa de la aplicación.
 *
 * Todo lo de acá es "progresivo": en el navegador `isNativeApp()` devuelve
 * `false` y no se toca ninguna API nativa, así que la misma base de código
 * sigue funcionando en la web exactamente igual que antes.
 */
export { isNativeApp, nativePlatform } from './platform';
export { pushLayer, dismissTopLayer, hasOpenLayers } from './backStack';
export { useNativeShell } from './useNativeShell';
