import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  GraduationCap,
  MessageSquare,
  RotateCcw,
  SendHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { pushLayer } from '@/native/backStack';
import { useCopilot } from '@/context/CopilotContext';
import { useTour } from '@/context/TourContext';
import { CopilotMessageBubble } from './CopilotMessageBubble';
import { CopilotActionButtons } from './CopilotActionButtons';
import { LessonsPanel } from './LessonsPanel';

const QUICK_PROMPTS = [
  'Revisar stock',
  'Analizar precios',
  'Ver productos críticos',
  'Analizar márgenes',
  'Resumen del inventario',
];

export function CopilotPanel() {
  const {
    open,
    minimized,
    closeCopilot,
    setMinimized,
    view,
    setView,
    messages,
    thinking,
    ask,
    applyAction,
    dismissAction,
    runUiAction,
    resetConversation,
    aiEnabled,
    uiContext,
    suggestions,
  } = useCopilot();
  const { progress, running } = useTour();

  const [draft, setDraft] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const visible = open && !minimized;

  useEffect(() => {
    if (!visible) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      if (window.innerWidth >= 640) inputRef.current?.focus();
    }, 140);
    return () => {
      window.clearTimeout(timer);
      previouslyFocused.current?.focus?.();
    };
  }, [visible]);

  // El botón atrás de Android minimiza el Copiloto en vez de salir de la app.
  useEffect(() => {
    if (!visible) return;
    return pushLayer(() => setMinimized(true));
  }, [visible, setMinimized]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCopilot();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, closeCopilot]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking, view]);

  // Mientras corre una lección, el panel se aparta para dejar ver la aplicación.
  useEffect(() => {
    if (running) setMinimized(true);
  }, [running, setMinimized]);

  if (!visible) return null;

  const send = (question: string) => {
    setDraft('');
    setShowSuggestions(false);
    void ask(question);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || thinking) return;
    send(draft);
  };

  return createPortal(
    // El contenedor no bloquea la aplicación: en escritorio el panel convive con
    // la pantalla y el usuario puede seguir navegando mientras conversa.
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-end sm:items-stretch">
      <div
        className="pointer-events-auto absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in lg:hidden"
        onClick={() => setMinimized(true)}
        aria-hidden
      />

      <section
        role="dialog"
        aria-labelledby="copilot-title"
        className="pointer-events-auto relative flex h-[80dvh] w-full flex-col rounded-t-2xl border-slate-200 bg-slate-50 shadow-pop animate-slide-up dark:border-slate-800 dark:bg-slate-950 sm:h-full sm:max-w-md sm:animate-slide-in-right sm:rounded-none sm:border-l lg:max-w-lg"
      >
        {/* Manija para arrastrar en móvil */}
        <button
          type="button"
          onClick={() => setMinimized(true)}
          aria-label="Minimizar el Copiloto"
          className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-slate-300 transition hover:bg-slate-400 focus-ring dark:bg-slate-700 sm:hidden"
        />

        {/* Encabezado */}
        <header className="flex items-center gap-2.5 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="copilot-title" className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Stock Copilot
            </h2>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {uiContext.demoMode ? 'Modo demostración · ' : ''}
              {aiEnabled ? 'Conectado al servicio de IA' : 'Análisis local'} · {uiContext.screenLabel}
            </p>
          </div>

          <button
            type="button"
            onClick={resetConversation}
            aria-label="Reiniciar conversación"
            title="Reiniciar conversación"
            className="hidden rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-ring dark:hover:bg-slate-800 dark:hover:text-slate-200 sm:block"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            aria-label="Minimizar el Copiloto"
            title="Minimizar"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-ring dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <ChevronDown className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={closeCopilot}
            aria-label="Cerrar el Copiloto"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-ring dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        {/* Pestañas */}
        <div
          role="tablist"
          aria-label="Secciones del Copiloto"
          className="flex shrink-0 gap-1 border-b border-slate-200 bg-white px-3 pb-2 dark:border-slate-800 dark:bg-slate-900"
        >
          <button
            role="tab"
            type="button"
            aria-selected={view === 'chat'}
            onClick={() => setView('chat')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-ring ${
              view === 'chat'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            Conversación
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={view === 'lecciones'}
            onClick={() => setView('lecciones')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-ring ${
              view === 'lecciones'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5" aria-hidden />
            Enseñame
            <span className="rounded-full bg-brand-100 px-1.5 text-[10px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              {progress.done}/{progress.total}
            </span>
          </button>
        </div>

        {/* Contenido */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4"
          role={view === 'chat' ? 'log' : undefined}
          aria-live={view === 'chat' ? 'polite' : undefined}
          aria-label={view === 'chat' ? 'Conversación con el Copiloto' : 'Lecciones'}
        >
          {view === 'lecciones' ? (
            <LessonsPanel />
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <CopilotMessageBubble
                  key={message.id}
                  message={message}
                  onFollowUp={send}
                  onApplyAction={applyAction}
                  onDismissAction={dismissAction}
                  onRunAction={runUiAction}
                />
              ))}

              {thinking && (
                <div className="flex gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3.5 dark:border-slate-700 dark:bg-slate-900">
                    <span className="sr-only">Analizando el inventario…</span>
                    <span className="flex gap-1" aria-hidden>
                      {[0, 150, 300].map((delay) => (
                        <span
                          key={delay}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-500"
                          style={{ animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        {view === 'chat' && (
          <footer className="shrink-0 border-t border-slate-200 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 dark:border-slate-800 dark:bg-slate-900">
            {showSuggestions && (
              <div className="mb-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  En {uiContext.screenLabel} puedo ayudarte a…
                </p>
                <CopilotActionButtons
                  actions={suggestions}
                  variant="panel"
                  onRun={(action) => {
                    setShowSuggestions(false);
                    runUiAction(action);
                  }}
                />
              </div>
            )}

            <div className="mb-2.5 flex gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setShowSuggestions((v) => !v)}
                aria-expanded={showSuggestions}
                className="shrink-0 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 focus-ring dark:bg-slate-100 dark:text-slate-900"
              >
                🤖 ¿Qué puedo hacer?
              </button>
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={thinking}
                  onClick={() => send(prompt)}
                  className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 focus-ring dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <label htmlFor="copilot-input" className="sr-only">
                Escribí tu pregunta para el Copiloto
              </label>
              <textarea
                ref={inputRef}
                id="copilot-input"
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Preguntá sobre stock o precios…"
                className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-ring dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={!draft.trim() || thinking}
                aria-label="Enviar pregunta"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-40 focus-ring"
              >
                <SendHorizontal className="h-5 w-5" aria-hidden />
              </button>
            </form>
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              El Copiloto nunca modifica nada sin tu confirmación.
            </p>
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}
