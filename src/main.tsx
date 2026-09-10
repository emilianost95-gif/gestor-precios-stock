import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// La tipografía viaja dentro del paquete: la app instalada tiene que verse
// igual sin conexión, sin depender de Google Fonts. Sólo el subconjunto
// latino, que es el que necesita el español.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './index.css';
import { isNativeApp } from './native/platform';

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el elemento #root en index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Registro del service worker (PWA). Sólo en producción y sólo en la web:
// dentro de la app de Android los archivos ya están en el dispositivo, y un
// caché intermedio sólo lograría que después de actualizar la app se siguiera
// viendo la versión anterior.
const SW_ENABLED =
  import.meta.env.PROD && import.meta.env.VITE_DISABLE_SW !== 'true' && !isNativeApp();

if ('serviceWorker' in navigator && SW_ENABLED) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).catch((error) => {
      console.warn('[pwa] no se pudo registrar el service worker:', error);
    });
  });
}
