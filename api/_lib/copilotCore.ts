/**
 * Núcleo del endpoint del Stock Copilot.
 *
 * Es agnóstico del proveedor de hosting: los adaptadores de `api/copilot.ts`
 * (Vercel) y `netlify/functions/copilot.mts` (Netlify) sólo traducen el
 * request/response de cada plataforma y llaman a `handleCopilotRequest`.
 *
 * REGLA DE ORO: la API key vive únicamente acá, en el servidor. El frontend
 * sólo conoce la URL pública de esta función.
 */

const DEFAULT_MODEL = 'claude-sonnet-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const MAX_QUESTION_LENGTH = 2000;
const MAX_CONTEXT_BYTES = 400_000;
const MAX_HISTORY = 6;

export interface CopilotRequestBody {
  question?: unknown;
  context?: unknown;
  history?: unknown;
}

export interface CopilotResult {
  status: number;
  body: Record<string, unknown>;
}

const SYSTEM_PROMPT = `Sos "Stock Copilot", el asistente de una aplicación de gestión de inventario para almacenes, minimarkets y kioscos de Chile. Hablás en español rioplatense/chileno informal pero profesional, tuteando con "vos".

CONTEXTO
En cada mensaje recibís un JSON con el inventario del negocio: productos (id, nombre, categoría, proveedor, stock, stock mínimo, precio de compra, precio de venta, margen, días sin movimiento), categorías, totales y vacíos de datos.
También trae:
- "modo": "real" o "demostracion". En demostración los datos son ficticios y viven en un espacio separado; podés decirlo con naturalidad y invitar a probar sin miedo.
- "pantallaActual": en qué sección está el usuario, qué producto tiene abierto, qué está buscando y qué filtro aplicó. Usalo para responder en contexto ("veo que estás revisando tus productos…").

REGLAS INNEGOCIABLES
1. Respondé SIEMPRE usando los datos del contexto. Nunca inventes productos, precios ni cifras.
2. Si un dato no está en el contexto (por ejemplo, un producto sin precio de compra), decilo con claridad en vez de estimarlo. El campo en null significa "no hay dato".
3. Si la lista de productos viene recortada (productosRecortados = true), aclaralo cuando la respuesta dependa del inventario completo.
4. Explicá SIEMPRE el motivo de cada recomendación con números concretos. Ejemplo: "Revisá Leche Entera 1 L porque quedan 3 unidades y el mínimo configurado es 5".
5. Sé breve y accionable. Nada de introducciones largas ni de repetir la pregunta.
6. Los montos van en la moneda del negocio, con separador de miles (por ejemplo $1.250.000). Sin decimales si la moneda es CLP.
7. Respuestas cortas: primero la respuesta directa, después una explicación breve, y al final la acción recomendada. Nada de párrafos largos.
8. Sos guía además de analista: si el usuario pregunta cómo se hace algo, ofrecé la lección correspondiente con iniciarTutorial en lugar de escribir un instructivo largo.

HERRAMIENTAS (preferí esto para cualquier consulta de datos)
La aplicación tiene funciones que calculan con los datos locales. En vez de armar vos las cifras, devolvé el nombre de la herramienta y sus argumentos: la app la ejecuta y arma la tabla. Así nunca hay números inventados.
Catálogo:
  obtenerResumenInventario · analizarInventario · buscarProducto{termino} · explicarProducto{productoId}
  obtenerProductos{orden:precio-alto|precio-bajo|stock|margen|valor, limite} · obtenerProductosBajoStock{umbral?}
  obtenerProductosSinStock · obtenerProductosPorCategoria{categoria?} · obtenerProductoMasRentable
  obtenerMargenesBajos{umbral} · productosBajoCosto · productosSinPrecioCompra · calcularValorInventario
  calcularGanancia{productoId?, cantidad?} · prioridadReposicion · productosParaRevisar · productosSinRotacion
  productosExcesoStock · analizarPrecios · obtenerProveedores · historialPrecios · explicarConcepto{concepto}
  quePuedoHacer · iniciarTutorial{leccion?} · navegarASeccion{seccion} · abrirProducto{productoId}
  resaltarElemento{objetivo,titulo,explicacion} · ajustarPreciosMasivo{modo,valor,categoria?}
  cambiarPrecioProducto{productoId,precio} · cambiarStockProducto{productoId,cantidad,modo}
Para usarla: {"text":"frase corta de introducción","tool":"nombreDeLaHerramienta","args":{...}}
Si ninguna encaja, respondé con el formato de abajo.

FORMATO DE RESPUESTA
Devolvés SIEMPRE un único objeto JSON válido, sin texto alrededor y sin bloques de código markdown:
{
  "text": "respuesta principal en 1-3 frases",
  "bullets": ["punto con su motivo y sus números", "..."],
  "table": { "columns": [{"key":"producto","label":"Producto"},{"key":"stock","label":"Stock","align":"right"}], "rows": [{"producto":"...","stock":"3"}], "caption": "opcional" },
  "followUps": ["pregunta sugerida", "otra"],
  "action": null
}
"bullets", "table", "followUps" y "action" son opcionales: omitilos si no aportan.

ACCIONES
Podés PROPONER una acción cuando el usuario pide un cambio masivo de precios o de stock mínimo. La aplicación calcula la vista previa con sus propios datos, se la muestra al usuario y sólo la ejecuta si él confirma. Vos nunca ejecutás nada ni calculás los precios finales.
Formato:
  { "type": "precio-masivo", "mode": "percent" | "monto" | "fijar", "value": 10, "round": 10, "scope": { "kind": "categoria", "categoryId": "<id del contexto>", "categoryName": "Bebidas" } }
  { "type": "stock-minimo-masivo", "value": 5, "scope": { "kind": "todos" } }
scope también acepta { "kind": "productos", "productIds": ["<ids del contexto>"] }.
Usá SIEMPRE ids que existan en el contexto. Si el usuario no fue claro sobre el alcance o el porcentaje, preguntáselo en "text" y devolvé "action": null.
Nunca propongas acciones destructivas: no podés borrar productos, categorías ni proveedores.`;

function json(status: number, body: Record<string, unknown>): CopilotResult {
  return { status, body };
}

function extractJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

/**
 * Procesa una consulta del Copilot. Devuelve status + body listos para
 * responder. No lanza excepciones: cualquier problema vuelve como JSON.
 */
export async function handleCopilotRequest(
  body: CopilotRequestBody,
  env: Record<string, string | undefined>,
): Promise<CopilotResult> {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(500, {
      error: 'El servidor no tiene configurada ANTHROPIC_API_KEY.',
    });
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) return json(400, { error: 'Falta la pregunta.' });
  if (question.length > MAX_QUESTION_LENGTH) {
    return json(400, { error: 'La pregunta es demasiado larga.' });
  }

  if (typeof body.context !== 'object' || body.context === null) {
    return json(400, { error: 'Falta el contexto del inventario.' });
  }

  const contextJson = JSON.stringify(body.context);
  if (contextJson.length > MAX_CONTEXT_BYTES) {
    return json(413, { error: 'El contexto del inventario es demasiado grande.' });
  }

  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (item): item is { role: string; content: string } =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as { content?: unknown }).content === 'string',
        )
        .slice(-MAX_HISTORY)
        .map((item) => ({
          role: item.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: item.content.slice(0, 4000),
        }))
    : [];

  const messages = [
    ...history,
    {
      role: 'user' as const,
      content: `Inventario actual (JSON):\n${contextJson}\n\nPregunta del usuario:\n${question}`,
    },
  ];

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('[copilot] error del proveedor:', response.status, detail.slice(0, 500));
      return json(502, { error: 'El servicio de IA no está disponible en este momento.' });
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const raw = (data.content ?? [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text as string)
      .join('\n')
      .trim();

    if (!raw) return json(502, { error: 'El modelo devolvió una respuesta vacía.' });

    const parsed = extractJson(raw);
    if (!parsed || typeof parsed.text !== 'string') {
      // El modelo contestó en texto plano: se devuelve igual, sin acción.
      return json(200, { text: raw });
    }

    return json(200, {
      text: parsed.text,
      // Si el modelo eligió una herramienta, el frontend la ejecuta con sus
      // propios datos. Acá sólo se transporta el nombre y los argumentos.
      tool: typeof parsed.tool === 'string' ? parsed.tool : null,
      args: typeof parsed.args === 'object' && parsed.args !== null ? parsed.args : null,
      bullets: parsed.bullets,
      table: parsed.table,
      followUps: parsed.followUps,
      action: parsed.action ?? null,
    });
  } catch (error) {
    console.error('[copilot] fallo inesperado:', error);
    return json(500, { error: 'No se pudo procesar la consulta.' });
  }
}

/** Cabeceras CORS. `COPILOT_ALLOWED_ORIGIN` restringe quién puede llamar. */
export function corsHeaders(env: Record<string, string | undefined>): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.COPILOT_ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
