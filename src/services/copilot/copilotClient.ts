import { getInventoryContext } from './inventoryContext';
import { answerLocally, type EngineDeps } from './localEngine';
import { parseAction } from './actions';
import type { CopilotReply, CopilotTable } from './types';

/**
 * URL del endpoint serverless que habla con el modelo de IA.
 *
 * Se configura como variable de entorno de build (`VITE_COPILOT_API_URL`).
 * Es una URL pública, NO un secreto: la API key del proveedor vive únicamente
 * en el servidor. Si la variable está vacía —como en el despliegue actual de
 * GitHub Pages— el Copilot funciona con el motor de análisis local.
 */
export const COPILOT_API_URL: string = import.meta.env.VITE_COPILOT_API_URL ?? '';

export function isAiBackendConfigured(): boolean {
  return COPILOT_API_URL.trim().length > 0;
}

const REQUEST_TIMEOUT_MS = 25_000;

export interface AskOptions {
  question: string;
  deps: EngineDeps;
  /** Últimos turnos de la conversación, para dar continuidad. */
  history: Array<{ role: 'user' | 'copilot'; content: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTable(raw: unknown): CopilotTable | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.columns) || !Array.isArray(raw.rows)) return undefined;
  const columns = raw.columns
    .filter(isRecord)
    .filter((c) => typeof c.key === 'string' && typeof c.label === 'string')
    .map((c) => ({
      key: c.key as string,
      label: c.label as string,
      align: c.align === 'right' ? ('right' as const) : ('left' as const),
    }));
  if (columns.length === 0) return undefined;

  const rows = raw.rows.filter(isRecord).slice(0, 60).map((row) => {
    const clean: Record<string, string | number> = {};
    for (const column of columns) {
      const value = row[column.key];
      clean[column.key] = typeof value === 'number' ? value : String(value ?? '');
    }
    return clean;
  });

  return { columns, rows, caption: typeof raw.caption === 'string' ? raw.caption : undefined };
}

/**
 * Pregunta al Copilot.
 *
 * Con backend configurado usa el modelo de IA; si no responde, si tarda
 * demasiado o si devuelve algo que no cumple el contrato, cae al análisis
 * local y lo avisa en la burbuja. La app nunca queda sin respuesta.
 */
export async function askCopilot({ question, deps, history }: AskOptions): Promise<CopilotReply> {
  if (!isAiBackendConfigured()) {
    return answerLocally(question, deps);
  }

  const context = getInventoryContext({
    products: deps.products,
    categories: deps.categories,
    suppliers: deps.suppliers,
    movements: deps.movements,
    priceChanges: deps.priceChanges,
    settings: deps.settings,
  });

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(COPILOT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context, history: history.slice(-6) }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`El servicio respondió ${response.status}`);

    const data: unknown = await response.json();
    if (!isRecord(data) || typeof data.text !== 'string' || !data.text.trim()) {
      throw new Error('Respuesta con formato inesperado');
    }

    // La acción propuesta por el modelo se valida contra el inventario real.
    // Si no pasa la validación, se ignora: la respuesta queda como texto.
    const action = data.action
      ? parseAction(data.action, deps.products, deps.categories)
      : null;

    return {
      source: 'ia',
      text: data.text,
      bullets: Array.isArray(data.bullets)
        ? data.bullets.filter((b): b is string => typeof b === 'string').slice(0, 12)
        : undefined,
      table: parseTable(data.table),
      action: action ?? undefined,
      followUps: Array.isArray(data.followUps)
        ? data.followUps.filter((f): f is string => typeof f === 'string').slice(0, 4)
        : undefined,
    };
  } catch (error) {
    const reason =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'El servicio de IA tardó demasiado en responder'
        : error instanceof Error
          ? error.message
          : 'No se pudo contactar al servicio de IA';
    const fallback = answerLocally(question, deps);
    return { ...fallback, notice: `${reason}. Te respondo con el análisis local.` };
  } finally {
    window.clearTimeout(timer);
  }
}
