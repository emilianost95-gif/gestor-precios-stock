import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el elemento #root en index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Registro del service worker (PWA). Sólo en producción.
const SW_ENABLED = import.meta.env.PROD && import.meta.env.VITE_DISABLE_SW !== 'true';

if ('serviceWorker' in navigator && SW_ENABLED) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).catch((error) => {
      console.warn('[pwa] no se pudo registrar el service worker:', error);
    });
  });
}
