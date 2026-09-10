import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuración de la aplicación nativa.
 *
 * La app web NO cambia: Capacitor empaqueta el mismo `dist/` que se publica en
 * la web dentro de un contenedor Android. Por eso todo lo que ya funcionaba
 * —el Copiloto, el modo demostración, el almacenamiento local— sigue igual.
 *
 * Importante: el contenido se sirve desde `https://localhost`, no desde
 * `file://`. Eso hace que `localStorage` sea persistente y que el origen sea
 * seguro (requisito de varias APIs del navegador).
 */
const config: CapacitorConfig = {
  appId: 'com.emilianost.preciosystock',
  appName: 'Precios y Stock',
  webDir: 'dist',

  android: {
    // Fondo mientras carga la vista web: evita el flash blanco en modo oscuro.
    backgroundColor: '#0f172a',
    // El teclado no debe empujar toda la pantalla hacia arriba.
    adjustMarginsForEdgeToEdge: 'force',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    Keyboard: {
      // La vista web se achica: los modales y el Copiloto siguen usables.
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
