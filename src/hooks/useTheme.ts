import { useEffect } from 'react';
import type { ThemeMode } from '@/types';

/**
 * Aplica el tema al <html>. 'system' sigue la preferencia del sistema
 * operativo y reacciona en vivo si el usuario la cambia.
 */
export function useApplyTheme(mode: ThemeMode): void {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const isDark = mode === 'dark' || (mode === 'system' && media.matches);
      root.classList.toggle('dark', isDark);
      root.style.colorScheme = isDark ? 'dark' : 'light';
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', isDark ? '#0f172a' : '#ffffff');
    };

    apply();
    if (mode === 'system') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
    return undefined;
  }, [mode]);
}
