import { Sparkles } from 'lucide-react';
import { useCopilot } from '@/context/CopilotContext';

/**
 * Botón flotante de acceso al Copilot.
 * En móvil se apoya por encima de la barra inferior para no taparla.
 */
export function CopilotLauncher() {
  const { open, openCopilot, unreadHighlights } = useCopilot();

  if (open) return null;

  return (
    <button
      type="button"
      onClick={() => openCopilot()}
      aria-label={
        unreadHighlights > 0
          ? `Abrir Stock Copilot · ${unreadHighlights} temas urgentes`
          : 'Abrir Stock Copilot'
      }
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 z-30 flex items-center gap-2 rounded-2xl bg-slate-900 py-3 pl-4 pr-4 text-sm font-semibold text-white shadow-pop transition hover:bg-slate-800 active:scale-95 focus-ring dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white lg:bottom-6 lg:right-6"
    >
      <Sparkles className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Stock Copilot</span>
      <span className="sm:hidden">Copilot</span>
      {unreadHighlights > 0 && (
        <span className="ml-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-slate-900">
          {unreadHighlights > 9 ? '9+' : unreadHighlights}
        </span>
      )}
    </button>
  );
}
