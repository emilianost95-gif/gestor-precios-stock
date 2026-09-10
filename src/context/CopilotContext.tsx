import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useStore } from './StoreContext';
import { useToast } from './ToastContext';
import { useConfirm } from './ConfirmContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useProductViews } from '@/hooks/useProducts';
import {
  analyzeInventory,
  askCopilot,
  buildActionPreview,
  buildInsightCards,
  isAiBackendConfigured,
  type ActionPreview,
  type CopilotFinding,
  type CopilotMessage,
  type EngineDeps,
  type InsightCard,
} from '@/services/copilot';
import { createId, nowISO } from '@/utils/id';

interface CopilotContextValue {
  open: boolean;
  openCopilot: (question?: string) => void;
  closeCopilot: () => void;
  messages: CopilotMessage[];
  thinking: boolean;
  ask: (question: string) => Promise<void>;
  applyAction: (messageId: string) => Promise<void>;
  dismissAction: (messageId: string) => void;
  resetConversation: () => void;
  /** Hallazgos del análisis local, usados también por el dashboard. */
  findings: CopilotFinding[];
  insightCards: InsightCard[];
  aiEnabled: boolean;
  unreadHighlights: number;
}

const CopilotContext = createContext<CopilotContextValue | null>(null);

const WELCOME: CopilotMessage = {
  id: 'welcome',
  role: 'copilot',
  createdAt: new Date(0).toISOString(),
  content:
    'Hola. Soy tu Stock Copilot: leo tu inventario real y te ayudo con stock, precios y márgenes. Preguntame lo que quieras o tocá una de las sugerencias.',
  followUps: [
    '¿Qué productos tienen poco stock?',
    '¿Cuál es el valor total de mi inventario?',
    '¿Cuáles son mis productos más rentables?',
  ],
};

export function CopilotProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const products = useProductViews();
  const toast = useToast();
  const confirm = useConfirm();
  const { money } = useCurrency();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([WELCOME]);
  const [thinking, setThinking] = useState(false);
  const pending = useRef(false);

  const deps = useMemo<EngineDeps>(
    () => ({
      products,
      categories: store.categories,
      suppliers: store.suppliers,
      movements: store.movements,
      priceChanges: store.priceChanges,
      settings: store.settings,
      money,
    }),
    [products, store.categories, store.suppliers, store.movements, store.priceChanges, store.settings, money],
  );

  const findings = useMemo(
    () => analyzeInventory(products, { movements: store.movements, moneyFormatter: money }),
    [products, store.movements, money],
  );

  const insightCards = useMemo(
    () => buildInsightCards({ products, findings, moneyFormatter: money }),
    [products, findings, money],
  );

  const unreadHighlights = useMemo(
    () => findings.filter((f) => f.severity === 'alta').length,
    [findings],
  );

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || pending.current) return;
      pending.current = true;

      const userMessage: CopilotMessage = {
        id: createId('msg'),
        role: 'user',
        createdAt: nowISO(),
        content: text,
      };
      setMessages((prev) => [...prev, userMessage]);
      setThinking(true);

      const history = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const reply = await askCopilot({ question: text, deps, history });
        const preview = reply.action
          ? buildActionPreview(reply.action, deps.products, money)
          : undefined;

        setMessages((prev) => [
          ...prev,
          {
            id: createId('msg'),
            role: 'copilot',
            createdAt: nowISO(),
            content: reply.text,
            bullets: reply.bullets,
            table: reply.table,
            followUps: reply.followUps,
            source: reply.source,
            notice: reply.notice,
            preview,
            actionState: preview?.executable ? 'pendiente' : undefined,
          },
        ]);
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: createId('msg'),
            role: 'copilot',
            createdAt: nowISO(),
            content:
              'Se me cruzaron los cables analizando eso. Probá de nuevo o preguntame de otra manera.',
            notice: error instanceof Error ? error.message : undefined,
          },
        ]);
      } finally {
        setThinking(false);
        pending.current = false;
      }
    },
    [deps, messages, money],
  );

  const openCopilot = useCallback(
    (question?: string) => {
      setOpen(true);
      if (question) void ask(question);
    },
    [ask],
  );

  const closeCopilot = useCallback(() => setOpen(false), []);

  const setActionState = useCallback((messageId: string, state: 'aplicada' | 'cancelada') => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, actionState: state } : m)));
  }, []);

  /**
   * Ejecuta una acción propuesta. Siempre pide confirmación explícita y la
   * ejecución pasa por las funciones del store, nunca por el modelo.
   */
  const applyAction = useCallback(
    async (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      const preview: ActionPreview | undefined = message?.preview;
      if (!preview || !preview.executable || message?.actionState !== 'pendiente') return;

      const confirmed = await confirm({
        title: preview.title,
        message: `${preview.description} Esta operación modifica ${preview.count} producto${preview.count === 1 ? '' : 's'} y queda registrada en el historial. ¿Confirmás?`,
        confirmLabel: `Sí, aplicar a ${preview.count}`,
        danger: true,
      });
      if (!confirmed) return;

      let applied = 0;
      if (preview.action.type === 'precio-masivo') {
        applied = store.applyBulkPriceUpdate(
          preview.items.map((item) => ({ id: item.id, newPrice: item.after })),
          preview.title,
        );
      } else {
        applied = store.applyBulkMinStock(
          preview.items.map((item) => ({ id: item.id, minStock: item.after })),
          preview.title,
        );
      }

      if (applied === 0) {
        toast.warning('No se aplicó ningún cambio', 'Los productos ya tenían esos valores.');
        setActionState(messageId, 'cancelada');
        return;
      }

      setActionState(messageId, 'aplicada');
      toast.success(
        'Cambios aplicados',
        `${applied} producto${applied === 1 ? '' : 's'} actualizado${applied === 1 ? '' : 's'}.`,
      );
      setMessages((prev) => [
        ...prev,
        {
          id: createId('msg'),
          role: 'copilot',
          createdAt: nowISO(),
          content: `Listo: actualicé ${applied} producto${applied === 1 ? '' : 's'}. Podés ver el detalle en Historial, y cada producto guarda su cambio de precio anterior por si querés volver atrás.`,
          source: 'local',
          followUps: ['Resumen del inventario', '¿Cuáles son mis productos más rentables?'],
        },
      ]);
    },
    [messages, confirm, store, toast, setActionState],
  );

  const dismissAction = useCallback(
    (messageId: string) => {
      setActionState(messageId, 'cancelada');
      toast.info('Acción cancelada', 'No se modificó ningún producto.');
    },
    [setActionState, toast],
  );

  const resetConversation = useCallback(() => setMessages([WELCOME]), []);

  const value = useMemo<CopilotContextValue>(
    () => ({
      open,
      openCopilot,
      closeCopilot,
      messages,
      thinking,
      ask,
      applyAction,
      dismissAction,
      resetConversation,
      findings,
      insightCards,
      aiEnabled: isAiBackendConfigured(),
      unreadHighlights,
    }),
    [
      open,
      openCopilot,
      closeCopilot,
      messages,
      thinking,
      ask,
      applyAction,
      dismissAction,
      resetConversation,
      findings,
      insightCards,
      unreadHighlights,
    ],
  );

  return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCopilot(): CopilotContextValue {
  const ctx = useContext(CopilotContext);
  if (!ctx) throw new Error('useCopilot debe usarse dentro de <CopilotProvider>.');
  return ctx;
}
