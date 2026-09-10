import { FlaskConical, LogOut, RotateCcw, Sparkles } from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { useCopilot } from '@/context/CopilotContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useToast } from '@/context/ToastContext';

/**
 * Barra permanente del modo demostración.
 *
 * Deja siempre a la vista que los datos son ficticios y que están guardados
 * en un espacio separado del negocio real.
 */
export function DemoModeBar() {
  const { demoMode, exitDemoMode, resetDemoData } = useStore();
  const { openCopilot } = useCopilot();
  const confirm = useConfirm();
  const toast = useToast();

  if (!demoMode) return null;

  const handleExit = async () => {
    const ok = await confirm({
      title: 'Salir del modo demostración',
      message:
        'Volvés a los datos reales de tu negocio. La demo queda guardada aparte, así que podés entrar de nuevo cuando quieras y la vas a encontrar tal cual la dejaste.',
      confirmLabel: 'Salir de la demo',
    });
    if (!ok) return;
    exitDemoMode();
    toast.success('Volviste a tus datos', 'Nada de lo que hiciste en la demo se guardó acá.');
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Reiniciar la demostración',
      message: 'Se vuelve al catálogo ficticio original. Sólo afecta a la demo.',
      confirmLabel: 'Reiniciar demo',
      danger: true,
    });
    if (!ok) return;
    resetDemoData();
    toast.success('Demo reiniciada', 'El catálogo ficticio volvió a su estado inicial.');
  };

  return (
    <div
      data-tour="demo-bar"
      className="flex flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-900/60 dark:bg-brand-950/40 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
          <FlaskConical className="h-4 w-4" aria-hidden />
        </span>
        <p className="min-w-0 text-xs leading-relaxed text-brand-900 dark:text-brand-200">
          <strong>Modo demostración.</strong> Todos los productos son ficticios y se guardan en un
          espacio separado: nada de lo que hagas acá toca los datos reales de tu negocio.
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openCopilot()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 focus-ring"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Guía del Copiloto
        </button>
        <button
          type="button"
          onClick={() => void handleReset()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 px-2.5 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-100 focus-ring dark:border-brand-800 dark:text-brand-200 dark:hover:bg-brand-900/50"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Reiniciar
        </button>
        <button
          type="button"
          onClick={() => void handleExit()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 px-2.5 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-100 focus-ring dark:border-brand-800 dark:text-brand-200 dark:hover:bg-brand-900/50"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          Salir
        </button>
      </div>
    </div>
  );
}
