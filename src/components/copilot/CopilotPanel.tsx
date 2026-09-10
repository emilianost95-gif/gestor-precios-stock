import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, SendHorizontal, Sparkles, X } from 'lucide-react';
import { useCopilot } from '@/context/CopilotContext';
import { CopilotMessageBubble } from './CopilotMessageBubble';

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
    closeCopilot,
    messages,
    thinking,
    ask,
    applyAction,
    dismissAction,
    resetConversation,
    aiEnabled,
  } = useCopilot();

  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => {
      window.clearTimeout(timer);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCopilot();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeCopilot]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  if (!open) return null;

  const send = (question: string) => {
    setDraft('');
    void ask(question);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || thinking) return;
    send(draft);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in lg:bg-slate-900/20"
        onClick={closeCopilot}
        aria-hidden
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="copilot-title"
        className="relative flex h-full w-full flex-col border-slate-200 bg-slate-50 shadow-pop animate-slide-in-right dark:border-slate-800 dark:bg-slate-950 sm:max-w-md sm:border-l lg:max-w-lg"
      >
        {/* Encabezado */}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="copilot-title" className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Stock Copilot
            </h2>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {aiEnabled
                ? 'Conectado al servicio de IA · lee tu inventario real'
                : 'Análisis local · trabaja con tu inventario real, sin salir del dispositivo'}
            </p>
          </div>
          <button
            type="button"
            onClick={resetConversation}
            aria-label="Reiniciar conversación"
            title="Reiniciar conversación"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-ring dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={closeCopilot}
            aria-label="Cerrar el Copilot"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-ring dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        {/* Conversación */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
          role="log"
          aria-live="polite"
          aria-label="Conversación con el Copilot"
        >
          {messages.map((message) => (
            <CopilotMessageBubble
              key={message.id}
              message={message}
              onFollowUp={send}
              onApplyAction={applyAction}
              onDismissAction={dismissAction}
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

        {/* Composer */}
        <footer className="border-t border-slate-200 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2.5 flex gap-1.5 overflow-x-auto pb-1">
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
              Escribí tu pregunta para el Copilot
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
            El Copilot nunca modifica nada sin tu confirmación.
          </p>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
