import { Check, GraduationCap, PartyPopper, Play } from 'lucide-react';
import { useTour } from '@/context/TourContext';
import { useCopilot } from '@/context/CopilotContext';
import { useStore } from '@/context/StoreContext';

/**
 * Modo tutor: lecciones cortas que se ejecutan sobre la aplicación real.
 * El progreso se guarda fuera de los espacios de trabajo, así que sobrevive a
 * entrar y salir del modo demostración.
 */
export function LessonsPanel() {
  const { lessons, completed, progress, allCoreDone, startLesson } = useTour();
  const { setMinimized, runEffect, ask } = useCopilot();
  const { demoMode, exitDemoMode } = useStore();

  const start = (id: string) => {
    if (startLesson(id)) setMinimized(true);
  };

  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <GraduationCap className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Aprendé a usar la aplicación
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {progress.done} de {progress.total} lecciones completadas
            </p>
          </div>
        </div>
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="progressbar"
          aria-valuenow={progress.done}
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-label="Progreso del tutorial"
        >
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {allCoreDone && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            <PartyPopper className="h-4 w-4" aria-hidden />
            Ya viste lo principal
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-emerald-800 dark:text-emerald-300/90">
            Con esta aplicación podés controlar tus productos, actualizar precios, revisar el stock y
            pedirme ayuda para entender tu inventario.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {demoMode && (
              <button
                type="button"
                onClick={exitDemoMode}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 focus-ring"
              >
                Crear mi negocio
              </button>
            )}
            <button
              type="button"
              onClick={() => void ask('Analizá mi inventario')}
              className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 focus-ring dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
            >
              Seguir explorando
            </button>
            <button
              type="button"
              onClick={() => runEffect({ kind: 'navegar', to: '/' })}
              className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 focus-ring dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {lessons.map((lesson) => {
          const done = completed.includes(lesson.id);
          return (
            <li key={lesson.id}>
              <button
                type="button"
                onClick={() => start(lesson.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-300 hover:shadow-card focus-ring dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-800"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${
                    done
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  {done ? <Check className="h-4 w-4" aria-hidden /> : lesson.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {lesson.title}
                    </span>
                    {!lesson.core && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        extra
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {lesson.summary}
                  </span>
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-600 dark:text-brand-400">
                  <Play className="h-4 w-4" aria-hidden />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
