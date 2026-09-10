import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, GraduationCap, X } from 'lucide-react';
import { pushLayer } from '@/native/backStack';
import { useTour } from '@/context/TourContext';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

/** Sigue al elemento resaltado y devuelve su posición en pantalla. */
function useTargetRect(target: string | undefined): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }

    let frame = 0;
    let attempts = 0;

    const findVisible = (): HTMLElement | null => {
      // Puede haber varios elementos con el mismo ancla (por ejemplo, el botón
      // de "nuevo producto" en escritorio y en móvil): se toma el visible.
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`),
      );
      return candidates.find((el) => el.getBoundingClientRect().width > 0) ?? null;
    };

    const measure = () => {
      const element = findVisible();
      if (!element) {
        // El elemento puede aparecer un instante después (navegación, modal).
        if (attempts < 40) {
          attempts += 1;
          frame = window.requestAnimationFrame(measure);
        } else {
          setRect(null);
        }
        return;
      }
      const box = element.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) {
        setRect(null);
        return;
      }
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
    };

    measure();
    const timer = window.setTimeout(() => {
      findVisible()?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      window.setTimeout(measure, 320);
    }, 120);

    const onChange = () => measure();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [target]);

  return rect;
}

/**
 * Capa de guía visual: oscurece la pantalla salvo el elemento del que se está
 * hablando y muestra la explicación al lado.
 *
 * No bloquea los clics: el usuario puede tocar lo que se le resalta y hacer la
 * acción de verdad mientras el Copiloto lo acompaña.
 */
export function TourOverlay() {
  const {
    lesson,
    step,
    stepIndex,
    stepCount,
    next,
    prev,
    stop,
    singleSpotlight,
    clearSpotlight,
  } = useTour();

  const activeTarget = step?.target ?? singleSpotlight?.target;
  const rect = useTargetRect(activeTarget);

  // El botón atrás de Android corta la guía sin salir de la aplicación.
  useEffect(() => {
    if (!lesson && !singleSpotlight) return;
    return pushLayer(lesson ? stop : clearSpotlight);
  }, [lesson, singleSpotlight, stop, clearSpotlight]);

  useEffect(() => {
    if (!lesson && !singleSpotlight) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (lesson) stop();
        else clearSpotlight();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [lesson, singleSpotlight, stop, clearSpotlight]);

  // Un resaltado suelto se apaga solo a los pocos segundos.
  useEffect(() => {
    if (!singleSpotlight) return;
    const timer = window.setTimeout(clearSpotlight, 9000);
    return () => window.clearTimeout(timer);
  }, [singleSpotlight, clearSpotlight]);

  if (!lesson && !singleSpotlight) return null;

  const title = step?.title ?? singleSpotlight?.title ?? '';
  const body = step?.body ?? singleSpotlight?.body ?? '';
  const isLesson = Boolean(lesson);

  // El recorte se limita a lo que se ve: si el elemento es más alto que la
  // pantalla, se resalta la parte visible en vez de dibujar un marco enorme.
  const spotlight = rect
    ? (() => {
        const top = Math.max(8, rect.top - PADDING);
        const left = Math.max(8, rect.left - PADDING);
        const bottom = Math.min(window.innerHeight - 8, rect.top + rect.height + PADDING);
        const right = Math.min(window.innerWidth - 8, rect.left + rect.width + PADDING);
        return { top, left, width: Math.max(24, right - left), height: Math.max(24, bottom - top) };
      })()
    : null;

  // En escritorio la tarjeta va pegada al elemento; en móvil, siempre abajo.
  const cardStyle: React.CSSProperties | undefined = spotlight
    ? (() => {
        const below = spotlight.top + spotlight.height + 12;
        const fitsBelow = below + 190 < window.innerHeight;
        return {
          top: fitsBelow ? below : Math.max(12, spotlight.top - 200),
          left: Math.min(Math.max(12, spotlight.left), Math.max(12, window.innerWidth - 372)),
        };
      })()
    : undefined;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {/* Oscurecido con recorte sobre el elemento */}
      {spotlight ? (
        <div
          className="absolute rounded-xl ring-2 ring-brand-400 transition-all duration-300"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.62)',
          }}
          aria-hidden
        />
      ) : (
        <div className="absolute inset-0 bg-slate-950/60" aria-hidden />
      )}

      {/* Explicación */}
      <div
        role="dialog"
        aria-live="polite"
        aria-label={title}
        className={`pointer-events-auto fixed z-[61] w-[min(360px,calc(100vw-24px))] rounded-2xl border border-slate-200 bg-white p-4 shadow-pop animate-slide-up dark:border-slate-700 dark:bg-slate-900 ${
          spotlight
            ? 'left-3 right-3 bottom-[calc(env(safe-area-inset-bottom)+92px)] w-auto sm:bottom-auto sm:left-auto sm:right-auto sm:w-[360px]'
            : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
        }`}
        style={spotlight ? { ...cardStyle } : undefined}
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
            <GraduationCap className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            {isLesson && (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                {lesson?.title} · paso {stepIndex + 1} de {stepCount}
              </p>
            )}
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
            {body && (
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
            )}
            {!rect && activeTarget && (
              <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                (Este elemento no está visible en esta pantalla, pero la explicación vale igual.)
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={isLesson ? stop : clearSpotlight}
            aria-label="Cerrar la guía"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-ring dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {isLesson && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex flex-1 gap-1" aria-hidden>
              {Array.from({ length: stepCount }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full ${
                    i <= stepIndex ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={prev}
                aria-label="Paso anterior"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50 focus-ring dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white transition hover:bg-brand-700 focus-ring"
            >
              {step?.nextLabel ?? (stepIndex === stepCount - 1 ? 'Terminar' : 'Siguiente')}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
