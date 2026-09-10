import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { useToast } from '@/context/ToastContext';
import { dismissTopLayer } from './backStack';
import { isNativeApp } from './platform';

/** Milisegundos que dura la ventana del doble "atrás" para salir. */
const EXIT_WINDOW_MS = 2200;

/**
 * Conecta la aplicación web con el comportamiento que un usuario de Android
 * espera de una app instalada:
 *
 * 1. El botón atrás cierra primero la capa abierta (modal, Copiloto, guía),
 *    después navega hacia atrás, y sólo sale de la app si ya estás en el
 *    inicio y tocás dos veces.
 * 2. La barra de estado acompaña al tema claro/oscuro de la aplicación.
 * 3. La pantalla de carga se oculta cuando React ya pintó, no antes.
 * 4. Se marca `<html data-native="android">` para los ajustes de estilo.
 *
 * En el navegador este hook no hace absolutamente nada.
 */
export function useNativeShell(): void {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // Se guardan en refs para que el listener nativo, que se registra una sola
  // vez, siempre lea el valor actual sin tener que volver a suscribirse.
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const exitArmedAt = useRef(0);

  /* --------------------------------------------------------------- */
  /* Botón atrás de Android                                           */
  /* --------------------------------------------------------------- */
  useEffect(() => {
    if (!isNativeApp()) return;

    const handle = CapApp.addListener('backButton', ({ canGoBack }) => {
      // 1. ¿Hay algo abierto encima? Se cierra eso y nada más.
      if (dismissTopLayer()) return;

      // 2. ¿Estamos en una pantalla interna? Se vuelve.
      if (pathRef.current !== '/' && canGoBack) {
        navigate(-1);
        return;
      }
      if (pathRef.current !== '/') {
        navigate('/');
        return;
      }

      // 3. Estamos en el inicio: se pide confirmación tocando dos veces.
      const now = Date.now();
      if (now - exitArmedAt.current < EXIT_WINDOW_MS) {
        void CapApp.exitApp();
        return;
      }
      exitArmedAt.current = now;
      toast.info('Tocá atrás otra vez para salir', 'Tus datos quedan guardados en el teléfono.');
    });

    return () => {
      void handle.then((listener) => listener.remove());
    };
  }, [navigate, toast]);

  /* --------------------------------------------------------------- */
  /* Barra de estado según el tema                                    */
  /* --------------------------------------------------------------- */
  useEffect(() => {
    if (!isNativeApp()) return;

    const apply = () => {
      const dark = document.documentElement.classList.contains('dark');
      void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
      void StatusBar.setBackgroundColor({ color: dark ? '#0f172a' : '#ffffff' }).catch(
        () => undefined,
      );
    };

    apply();
    // El tema puede cambiar por configuración o por el sistema operativo.
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  /* --------------------------------------------------------------- */
  /* Arranque: ocultar splash y marcar la plataforma                  */
  /* --------------------------------------------------------------- */
  useEffect(() => {
    if (!isNativeApp()) return;

    document.documentElement.dataset.native = 'android';
    // Se oculta recién ahora: así el usuario nunca ve una pantalla en blanco.
    const timer = window.setTimeout(() => {
      void SplashScreen.hide().catch(() => undefined);
    }, 120);

    // Al abrir el teclado se marca el documento para poder ajustar estilos.
    const show = Keyboard.addListener('keyboardWillShow', () => {
      document.documentElement.dataset.keyboard = 'open';
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => {
      delete document.documentElement.dataset.keyboard;
    });

    return () => {
      window.clearTimeout(timer);
      void show.then((l) => l.remove());
      void hide.then((l) => l.remove());
    };
  }, []);
}
