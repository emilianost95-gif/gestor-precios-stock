import { ChevronUp, Sparkles, X } from 'lucide-react';
import { useCopilot } from '@/context/CopilotContext';
import { useTour } from '@/context/TourContext';

/**
 * Acceso al Copiloto.
 *
 * Tres estados: cerrado (botón flotante), minimizado (barra compacta para
 * volver sin perder la conversación) y abierto (lo maneja el panel).
 * En móvil se apoya por encima de la barra inferior para no taparla.
 */
export function CopilotLauncher() {
  const { open, minimized, openCopilot, setMinimized, unreadHighlights, nudge, dismissNudge, ask } =
    useCopilot();
  const { running } = useTour();

  // Durante una lección la guía manda: el botón no compite por la atención.
  if (running) return null;

  const position =
    'fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 z-30 lg:bottom-6 lg:right-6';

  if (open && minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        aria-label="Volver al Copiloto"
        className={`${position} flex items-center gap-2 rounded-2xl border border-slate-200 bg-white py-2.5 pl-3 pr-3.5 text-sm font-semibold text-slate-700 shadow-pop transition hover:bg-slate-50 active:scale-95 focus-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
        </span>
        Copiloto
        <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden />
      </button>
    );
  }

  if (open) return null;

  return (
    <>
      {nudge && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+140px)] right-4 z-30 w-[min(300px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-pop animate-slide-up dark:border-slate-700 dark:bg-slate-900 lg:bottom-24 lg:right-6">
          <div className="flex items-start gap-2">
            <span className="text-base" aria-hidden>
              💡
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{nudge.title}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{nudge.body}</p>
              <button
                type="button"
                onClick={() => {
                  dismissNudge();
                  openCopilot();
                  void ask(nudge.question);
                }}
                className="mt-2 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 focus-ring"
              >
                Revisar ahora
              </button>
            </div>
            <button
              type="button"
              onClick={dismissNudge}
              aria-label="Ocultar el aviso"
              className="rounded-md p-1 text-slate-400 transition hover:text-slate-600 focus-ring dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        data-tour="copilot-launcher"
        onClick={() => openCopilot()}
        aria-label={
          unreadHighlights > 0
            ? `Abrir Stock Copilot · ${unreadHighlights} temas urgentes`
            : 'Abrir Stock Copilot'
        }
        className={`${position} flex items-center gap-2 rounded-2xl bg-slate-900 py-3 pl-4 pr-4 text-sm font-semibold text-white shadow-pop transition hover:bg-slate-800 active:scale-95 focus-ring dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white`}
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Stock Copilot</span>
        <span className="sm:hidden">Copiloto</span>
        {unreadHighlights > 0 && (
          <span className="ml-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-slate-900">
            {unreadHighlights > 9 ? '9+' : unreadHighlights}
          </span>
        )}
      </button>
    </>
  );
}
