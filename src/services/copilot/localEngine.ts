import { normalizeText } from '@/utils/format';
import { getScreenSuggestions } from './appContext';
import { findConcept } from './concepts';
import { runTool, type ToolArgs, type ToolContext, type ToolName } from './toolRegistry';
import type { CopilotReply } from './types';

export type EngineDeps = ToolContext;

/* ------------------------------------------------------------------ */
/* Utilidades de reconocimiento                                        */
/* ------------------------------------------------------------------ */

const has = (text: string, ...words: string[]): boolean => words.some((w) => text.includes(w));

/** Primer número de la frase ("menor a 5" → 5, "10%" → 10). */
function firstNumber(text: string): number | undefined {
  const match = text.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return undefined;
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : undefined;
}

const COMPARATIVE = ['menor a', 'menos de', 'debajo de', 'inferior a', 'menores a', 'bajo los', 'menos que'];

/** Nombre de producto mencionado en la pregunta, si coincide con el inventario. */
function mentionedProduct(q: string, ctx: ToolContext): string | undefined {
  let best: { id: string; length: number } | undefined;
  for (const product of ctx.products) {
    const name = normalizeText(product.name);
    // Se compara contra el nombre completo y contra las primeras dos palabras,
    // porque la gente escribe "coca cola" y no "Bebida Cola 1.5 L".
    const short = name.split(' ').slice(0, 2).join(' ');
    const matched = (name.length > 3 && q.includes(name)) || (short.length > 4 && q.includes(short));
    if (matched && (!best || name.length > best.length)) {
      best = { id: product.id, length: name.length };
    }
  }
  return best?.id;
}

export interface ResolvedIntent {
  tool: ToolName;
  args: ToolArgs;
}

/* ------------------------------------------------------------------ */
/* Router de intenciones                                               */
/* ------------------------------------------------------------------ */

/**
 * Traduce una pregunta en lenguaje natural a una herramienta del registro.
 *
 * Es deliberadamente simple: reglas sobre texto normalizado. La ventaja es que
 * es determinista, instantáneo y no necesita conexión; cuando hay backend de IA
 * configurado, el modelo elige la herramienta con más flexibilidad, pero el
 * catálogo y la ejecución son exactamente los mismos.
 */
export function resolveIntent(question: string, ctx: ToolContext): ResolvedIntent | null {
  const q = normalizeText(question);

  /* --- Guía y enseñanza --- */
  if (has(q, 'que puedo hacer', 'que mas puedo hacer', 'en que me ayudas', 'que sabes hacer', 'ayudame')) {
    return { tool: 'quePuedoHacer', args: {} };
  }
  if (has(q, 'ensename esta pantalla', 'explicame esta pantalla', 'que es esta pantalla')) {
    return { tool: 'quePuedoHacer', args: {} };
  }
  if (has(q, 'como cambio un precio', 'como cambio el precio', 'como edito el precio', 'como modifico un precio')) {
    return { tool: 'iniciarTutorial', args: { leccion: 'cambiar-precio' } };
  }
  if (has(q, 'como agrego', 'como creo un producto', 'como cargo un producto', 'como añado')) {
    return { tool: 'iniciarTutorial', args: { leccion: 'agregar-producto' } };
  }
  if (has(q, 'como actualizo el stock', 'como cambio el stock', 'como cargo stock', 'como registro una entrada')) {
    return { tool: 'iniciarTutorial', args: { leccion: 'actualizar-stock' } };
  }
  if (has(q, 'que significan estas alertas', 'explicar las alertas', 'que son las alertas', 'explicame las alertas')) {
    return { tool: 'iniciarTutorial', args: { leccion: 'entender-alertas' } };
  }
  if (has(q, 'como busco', 'como encuentro un producto')) {
    return { tool: 'iniciarTutorial', args: { leccion: 'buscar-producto' } };
  }
  if (
    has(q, 'ensename', 'enseñame', 'tutorial', 'como se usa', 'como funciona la aplicacion', 'guiame', 'mostrame como funciona', 'como uso la app')
  ) {
    return { tool: 'iniciarTutorial', args: {} };
  }

  /* --- Conceptos --- */
  if (has(q, 'que es ', 'que significa', 'para que sirve', 'explicame que')) {
    if (findConcept(q)) return { tool: 'explicarConcepto', args: { concepto: q } };
  }

  /* --- Acción de precios masiva --- */
  const wantsUp = has(q, 'aumentar', 'subir', 'incrementar', 'aumenta', 'sube', 'remarcar');
  const wantsDown = has(q, 'bajar', 'reducir', 'rebajar', 'baja');
  if ((wantsUp || wantsDown) && has(q, 'precio', 'precios')) {
    const percentMatch = q.match(/(\d+(?:[.,]\d+)?)\s*(?:%|por ciento|porciento)/);
    if (percentMatch) {
      const percent = Number(percentMatch[1].replace(',', '.'));
      const category = ctx.categories.find((c) => q.includes(normalizeText(c.name)));
      return {
        tool: 'ajustarPreciosMasivo',
        args: {
          modo: 'percent',
          valor: wantsDown ? -percent : percent,
          categoria: category?.name,
        },
      };
    }
  }

  /* --- Navegación --- */
  if (has(q, 'llevame a', 'abri la seccion', 'ir a la seccion', 'mostrame la seccion')) {
    const seccion = ['inicio', 'productos', 'stock', 'categorias', 'proveedores', 'historial', 'configuracion'].find(
      (s) => q.includes(s),
    );
    if (seccion) return { tool: 'navegarASeccion', args: { seccion } };
  }

  /* --- Resumen y análisis --- */
  if (has(q, 'analiza mi inventario', 'analizar mi inventario', 'analiza el inventario', 'analizar inventario', 'analiza mi negocio')) {
    return { tool: 'analizarInventario', args: {} };
  }
  if (has(q, 'resumen', 'como esta mi negocio', 'como va el negocio', 'panorama', 'estado general', 'cuantos productos', 'cantidad de productos', 'total de productos')) {
    return { tool: 'obtenerResumenInventario', args: {} };
  }

  /* --- Dinero --- */
  if (has(q, 'si vendo todo', 'ganaria si vendo', 'cuanto ganaria')) {
    return { tool: 'calcularGanancia', args: {} };
  }
  if (has(q, 'valor total', 'valor del inventario', 'valor de mi inventario', 'cuanto dinero', 'invertido', 'capital')) {
    return { tool: 'calcularValorInventario', args: {} };
  }

  /* --- Stock --- */
  if (has(q, 'sin stock', 'agotado', 'agotados', 'se acabo', 'en cero', 'stock 0')) {
    return { tool: 'obtenerProductosSinStock', args: {} };
  }
  if (has(q, 'tengo que comprar', 'debo comprar', 'reponer', 'reposicion', 'que pedir', 'hacer el pedido')) {
    return { tool: 'prioridadReposicion', args: {} };
  }
  if (has(q, 'exceso', 'sobra stock', 'demasiado stock', 'sobrestock')) {
    return { tool: 'productosExcesoStock', args: {} };
  }
  if (has(q, 'sin movimiento', 'no se vende', 'no rota', 'rotacion', 'no se mueve', 'parado')) {
    return { tool: 'productosSinRotacion', args: {} };
  }
  if (has(q, ...COMPARATIVE) && has(q, 'stock', 'unidades') && !q.includes('%') && !q.includes('margen')) {
    return { tool: 'obtenerProductosBajoStock', args: { umbral: firstNumber(q) } };
  }
  if (
    has(q, 'poco stock', 'stock bajo', 'stock critico', 'criticos', 'bajo el minimo', 'debajo del minimo', 'stock minimo', 'revisar stock', 'falta stock', 'quedan pocos')
  ) {
    return { tool: 'obtenerProductosBajoStock', args: {} };
  }

  /* --- Precios y márgenes --- */
  if (has(q, 'bajo el costo', 'debajo del costo', 'perdiendo', 'menos que el costo', 'perdida')) {
    return { tool: 'productosBajoCosto', args: {} };
  }
  if (has(q, 'sin precio de compra', 'sin costo', 'falta precio de compra', 'sin margen configurado')) {
    return { tool: 'productosSinPrecioCompra', args: {} };
  }
  if (has(q, ...COMPARATIVE) && has(q, 'margen', 'ganancia')) {
    return { tool: 'obtenerMargenesBajos', args: { umbral: firstNumber(q) } };
  }
  if (has(q, 'mas rentable', 'rentables', 'mayor margen', 'mejor margen', 'mejores margenes', 'mas ganancia', 'me deja mas', 'analizar margenes', 'analizar margen')) {
    return { tool: 'obtenerProductoMasRentable', args: {} };
  }
  if (has(q, 'mas caro', 'mas caros', 'mayor precio', 'precio mas alto', 'precios mas altos')) {
    return { tool: 'obtenerProductos', args: { orden: 'precio-alto' } };
  }
  if (has(q, 'mas barato', 'mas baratos', 'menor precio', 'precio mas bajo', 'precios mas bajos')) {
    return { tool: 'obtenerProductos', args: { orden: 'precio-bajo' } };
  }
  if (has(q, 'cambios de precio', 'historial de precio', 'variacion de precio', 'ultimos precios')) {
    return { tool: 'historialPrecios', args: {} };
  }
  if (has(q, 'analizar precios', 'analiza los precios', 'estado de los precios', 'revisar precios')) {
    return { tool: 'analizarPrecios', args: {} };
  }

  /* --- Catálogo --- */
  if (has(q, 'proveedor', 'proveedores')) {
    return { tool: 'obtenerProveedores', args: {} };
  }
  if (has(q, 'categoria', 'categorias', 'rubro')) {
    const category = ctx.categories.find((c) => q.includes(normalizeText(c.name)));
    return { tool: 'obtenerProductosPorCategoria', args: { categoria: category?.name } };
  }
  if (has(q, 'que deberia revisar', 'que reviso', 'que productos revisar', 'algo para revisar', 'que necesita atencion', 'recomend')) {
    return { tool: 'productosParaRevisar', args: {} };
  }

  /* --- Preguntas sobre un producto concreto --- */
  const productId = mentionedProduct(q, ctx);
  if (productId) {
    if (has(q, 'cuanto gano', 'cuanta ganancia', 'cuanto deja', 'margen de')) {
      return { tool: 'calcularGanancia', args: { productoId: productId } };
    }
    if (has(q, 'cambiar precio', 'cambiale el precio', 'poner a', 'dejar a')) {
      return { tool: 'cambiarPrecioProducto', args: { productoId: productId, precio: firstNumber(q) } };
    }
    if (has(q, 'cambiar stock', 'cargar stock', 'sumar', 'agregar unidades')) {
      return { tool: 'cambiarStockProducto', args: { productoId: productId, cantidad: firstNumber(q), modo: 'sumar' } };
    }
    if (has(q, 'abrir', 'mostrame', 'ver ')) {
      return { tool: 'abrirProducto', args: { productoId: productId } };
    }
    return { tool: 'explicarProducto', args: { productoId: productId } };
  }

  /* --- Búsqueda genérica --- */
  if (has(q, 'busca', 'buscar', 'encontra', 'tengo el producto')) {
    const term = question.replace(/^[^a-záéíóúñ0-9]*/i, '').split(/\s+/).slice(-3).join(' ');
    return { tool: 'buscarProducto', args: { termino: term } };
  }

  return null;
}

/**
 * Responde con análisis local, sin llamar a ningún modelo.
 * Es el motor por defecto y también el respaldo cuando la IA no está disponible.
 */
export function answerLocally(question: string, ctx: ToolContext): CopilotReply {
  const intent = resolveIntent(question, ctx);
  if (intent) return runTool(intent.tool, intent.args, ctx);

  return {
    source: 'local',
    tool: 'sin-coincidencia',
    text: 'No estoy seguro de haber entendido. Puedo ayudarte con stock, precios, márgenes, categorías, proveedores y reposición, y también enseñarte a usar la aplicación.',
    actions: getScreenSuggestions(ctx.ui),
    followUps: ['¿Qué puedo hacer?', 'Analizá mi inventario', 'Enseñame a usar la aplicación'],
  };
}
