import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from './StoreContext';
import { useToast } from './ToastContext';
import { useConfirm } from './ConfirmContext';
import { useProductActions } from './ProductActionsContext';
import { useTour } from './TourContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useProductViews } from '@/hooks/useProducts';
import {
  analyzeInventory,
  askCopilot,
  buildActionPreview,
  buildInsightCards,
  getScreenSuggestions,
  isAiBackendConfigured,
  screenFromPath,
  type ActionPreview,
  type CopilotEffect,
  type CopilotFinding,
  type CopilotMessage,
  type CopilotUiAction,
  type CopilotUiContext,
  type InsightCard,
  type ToolContext,
} from '@/services/copilot';
import { createId, nowISO } from '@/utils/id';

export type CopilotView = 'chat' | 'lecciones';

interface CopilotContextValue {
  open: boolean;
  minimized: boolean;
  openCopilot: (question?: string) => void;
  closeCopilot: () => void;
  setMinimized: (value: boolean) => void;
  view: CopilotView;
  setView: (view: CopilotView) => void;

  messages: CopilotMessage[];
  thinking: boolean;
  ask: (question: string) => Promise<void>;
  applyAction: (messageId: string) => Promise<void>;
  dismissAction: (messageId: string) => void;
  runEffect: (effect: CopilotEffect) => void;
  runUiAction: (action: CopilotUiAction) => void;
  resetConversation: () => void;

  /** Lo que el Copiloto ve de la pantalla actual. */
  uiContext: CopilotUiContext;
  registerUiContext: (partial: Partial<CopilotUiContext>) => void;
  suggestions: CopilotUiAction[];

  findings: CopilotFinding[];
  insightCards: InsightCard[];
  aiEnabled: boolean;
  unreadHighlights: number;

  /** Aviso discreto sobre el botón flotante. */
  nudge: { title: string; body: string; question: string } | null;
  dismissNudge: () => void;
}

const CopilotContext = createContext<CopilotContextValue | null>(null);

export function CopilotProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const products = useProductViews();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();
  const { money } = useCurrency();
  const productActions = useProductActions();
  const tour = useTour();

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [view, setView] = useState<CopilotView>('chat');
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [registered, setRegistered] = useState<Partial<CopilotUiContext>>({});
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const pending = useRef(false);
  const welcomed = useRef(false);

  /* ------------------------------------------------------------------ */
  /* Contexto de pantalla                                                */
  /* ------------------------------------------------------------------ */
  const { screen, label } = screenFromPath(location.pathname);

  const uiContext = useMemo<CopilotUiContext>(
    () => ({
      screen,
      screenLabel: label,
      demoMode: store.demoMode,
      selectedProductId: productActions.activeProductId ?? undefined,
      ...registered,
    }),
    [screen, label, store.demoMode, productActions.activeProductId, registered],
  );

  const registerUiContext = useCallback((partial: Partial<CopilotUiContext>) => {
    setRegistered((prev) => ({ ...prev, ...partial }));
  }, []);

  // Al cambiar de pantalla se olvidan los filtros de la anterior.
  useEffect(() => {
    setRegistered({});
  }, [screen]);

  const suggestions = useMemo(() => getScreenSuggestions(uiContext), [uiContext]);

  const ctx = useMemo<ToolContext>(
    () => ({
      products,
      categories: store.categories,
      suppliers: store.suppliers,
      movements: store.movements,
      priceChanges: store.priceChanges,
      settings: store.settings,
      money,
      demoMode: store.demoMode,
      ui: uiContext,
    }),
    [
      products,
      store.categories,
      store.suppliers,
      store.movements,
      store.priceChanges,
      store.settings,
      store.demoMode,
      money,
      uiContext,
    ],
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

  /* ------------------------------------------------------------------ */
  /* Efectos de interfaz                                                 */
  /* ------------------------------------------------------------------ */
  const runEffect = useCallback(
    (effect: CopilotEffect) => {
      const findProduct = (id: string) => store.products.find((p) => p.id === id);

      switch (effect.kind) {
        case 'navegar':
          navigate(effect.to);
          setMinimized(true);
          break;
        case 'abrir-producto': {
          const product = findProduct(effect.productId);
          if (product) {
            productActions.viewProduct(product);
            setMinimized(true);
          }
          break;
        }
        case 'editar-precio': {
          const product = findProduct(effect.productId);
          if (product) {
            productActions.editPrice(product);
            setMinimized(true);
          }
          break;
        }
        case 'editar-stock': {
          const product = findProduct(effect.productId);
          if (product) {
            productActions.editStock(product);
            setMinimized(true);
          }
          break;
        }
        case 'nuevo-producto':
          productActions.newProduct();
          setMinimized(true);
          break;
        case 'tutorial':
          if (effect.lessonId === 'indice') {
            setView('lecciones');
            setMinimized(false);
            break;
          }
          if (tour.startLesson(effect.lessonId)) setMinimized(true);
          break;
        case 'resaltar':
          tour.spotlight({ target: effect.target, title: effect.title, body: effect.body });
          setMinimized(true);
          break;
      }
    },
    [navigate, productActions, store.products, tour],
  );

  /* ------------------------------------------------------------------ */
  /* Conversación                                                        */
  /* ------------------------------------------------------------------ */
  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || pending.current) return;
      pending.current = true;
      setView('chat');

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
        const reply = await askCopilot({ question: text, deps: ctx, history });
        const preview = reply.action ? buildActionPreview(reply.action, ctx.products, money) : undefined;

        setMessages((prev) => [
          ...prev,
          {
            id: createId('msg'),
            role: 'copilot',
            createdAt: nowISO(),
            content: reply.text,
            bullets: reply.bullets,
            table: reply.table,
            actions: reply.actions,
            followUps: reply.followUps,
            source: reply.source,
            notice: reply.notice,
            preview,
            actionState: preview?.executable ? 'pendiente' : undefined,
          },
        ]);

        if (reply.effect) {
          window.setTimeout(() => runEffect(reply.effect as CopilotEffect), 400);
        }
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: createId('msg'),
            role: 'copilot',
            createdAt: nowISO(),
            content: 'Se me cruzaron los cables analizando eso. Probá de nuevo o preguntame de otra manera.',
            notice: error instanceof Error ? error.message : undefined,
          },
        ]);
      } finally {
        setThinking(false);
        pending.current = false;
      }
    },
    [ctx, messages, money, runEffect],
  );

  const runUiAction = useCallback(
    (action: CopilotUiAction) => {
      if (action.effect) runEffect(action.effect);
      else if (action.question) void ask(action.question);
    },
    [runEffect, ask],
  );

  /* ------------------------------------------------------------------ */
  /* Bienvenida                                                          */
  /* ------------------------------------------------------------------ */
  const welcomeMessage = useCallback((): CopilotMessage => {
    const demo = store.demoMode;
    return {
      id: 'welcome',
      role: 'copilot',
      createdAt: nowISO(),
      content: demo
        ? '👋 Hola, soy tu Copiloto.\nEstás en el modo demostración, así que podés tocar todo sin miedo: los datos son ficticios y viven aparte de los de tu negocio.\nPreguntame lo que quieras o dejame mostrarte cómo funciona la aplicación.'
        : '👋 Hola, soy tu Copiloto.\nLeo tu inventario real y te ayudo con stock, precios y márgenes. También puedo enseñarte a usar cada parte de la aplicación.',
      actions: [
        { label: '🛒 Enseñame la aplicación', icon: 'tutorial', effect: { kind: 'tutorial', lessonId: 'recorrido' } },
        { label: '📦 Explicame el stock', icon: 'stock', question: '¿Qué productos tienen poco stock?' },
        { label: '💰 ¿Cómo cambio un precio?', icon: 'precio', question: '¿Cómo cambio un precio?' },
        { label: '📊 Analizá mi inventario', icon: 'analizar', question: 'Analizá mi inventario' },
        { label: '❓ Tengo una pregunta', icon: 'buscar', question: '¿Qué puedo hacer?' },
      ],
    };
  }, [store.demoMode]);

  useEffect(() => {
    if (store.loading) return;
    if (messages.length === 0) {
      setMessages([welcomeMessage()]);
      welcomed.current = true;
    }
  }, [store.loading, messages.length, welcomeMessage]);

  // Al entrar o salir del modo demo, el saludo se vuelve a redactar.
  useEffect(() => {
    setMessages((prev) => (prev.length <= 1 ? [welcomeMessage()] : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.demoMode]);

  const openCopilot = useCallback(
    (question?: string) => {
      setOpen(true);
      setMinimized(false);
      if (question) void ask(question);
    },
    [ask],
  );

  const closeCopilot = useCallback(() => {
    setOpen(false);
    setMinimized(false);
  }, []);

  const resetConversation = useCallback(() => {
    setMessages([welcomeMessage()]);
    setView('chat');
  }, [welcomeMessage]);

  /* ------------------------------------------------------------------ */
  /* Acciones sobre datos                                                */
  /* ------------------------------------------------------------------ */
  const setActionState = useCallback((messageId: string, state: 'aplicada' | 'cancelada') => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, actionState: state } : m)));
  }, []);

  const applyAction = useCallback(
    async (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      const preview: ActionPreview | undefined = message?.preview;
      if (!preview || !preview.executable || message?.actionState !== 'pendiente') return;

      const scopeNote = store.demoMode
        ? ' Estás en el modo demostración: sólo se modifican los datos ficticios.'
        : '';

      const confirmed = await confirm({
        title: preview.title,
        message: `${preview.description} Esta operación modifica ${preview.count} producto${preview.count === 1 ? '' : 's'} y queda registrada en el historial.${scopeNote} ¿Confirmás?`,
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
      } else if (preview.action.type === 'stock-minimo-masivo') {
        applied = store.applyBulkMinStock(
          preview.items.map((item) => ({ id: item.id, minStock: item.after })),
          preview.title,
        );
      } else {
        const item = preview.items[0];
        if (item) {
          store.registerMovement({
            productId: preview.action.productId,
            type: item.delta > 0 ? 'entrada' : 'ajuste',
            quantity: Math.abs(item.delta),
            absoluteStock: item.after,
            note: 'Ajuste sugerido por el Copiloto',
          });
          applied = 1;
        }
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
          content: `Listo: actualicé ${applied} producto${applied === 1 ? '' : 's'}.${
            store.demoMode ? ' Recordá que estamos en la demo, tus datos reales no se tocaron.' : ''
          }`,
          source: 'local',
          actions: [{ label: 'Ver historial', icon: 'ver', effect: { kind: 'navegar', to: '/historial' } }],
          followUps: ['Resumen del inventario'],
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

  /* ------------------------------------------------------------------ */
  /* Aviso discreto (una sola vez, sin abrir nada)                       */
  /* ------------------------------------------------------------------ */
  const nudge = useMemo(() => {
    if (nudgeDismissed || open || store.loading) return null;
    const urgent = findings.filter((f) => f.severity === 'alta');
    if (urgent.length < 2) return null;
    return {
      title: 'Encontré algo que podrías revisar',
      body: `Hay ${urgent.length} productos que necesitan atención.`,
      question: '¿Qué productos debería revisar?',
    };
  }, [nudgeDismissed, open, store.loading, findings]);

  const dismissNudge = useCallback(() => setNudgeDismissed(true), []);

  const value = useMemo<CopilotContextValue>(
    () => ({
      open,
      minimized,
      openCopilot,
      closeCopilot,
      setMinimized,
      view,
      setView,
      messages,
      thinking,
      ask,
      applyAction,
      dismissAction,
      runEffect,
      runUiAction,
      resetConversation,
      uiContext,
      registerUiContext,
      suggestions,
      findings,
      insightCards,
      aiEnabled: isAiBackendConfigured(),
      unreadHighlights,
      nudge,
      dismissNudge,
    }),
    [
      open,
      minimized,
      openCopilot,
      closeCopilot,
      view,
      messages,
      thinking,
      ask,
      applyAction,
      dismissAction,
      runEffect,
      runUiAction,
      resetConversation,
      uiContext,
      registerUiContext,
      suggestions,
      findings,
      insightCards,
      unreadHighlights,
      nudge,
      dismissNudge,
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

/**
 * Las páginas usan este hook para contarle al Copiloto qué están mostrando.
 * Así el asistente sabe si estás filtrando, buscando o mirando un producto.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useRegisterCopilotContext(partial: Partial<CopilotUiContext>): void {
  const { registerUiContext } = useCopilot();
  const key = JSON.stringify(partial);
  useEffect(() => {
    registerUiContext(JSON.parse(key) as Partial<CopilotUiContext>);
  }, [key, registerUiContext]);
}
