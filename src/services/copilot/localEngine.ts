import type { Category, PriceChange, ProductView, Settings, StockMovement, Supplier } from '@/types';
import { formatNumber, formatRelative, normalizeText } from '@/utils/format';
import { getCategoryBreakdown } from '@/services/productService';
import {
  THRESHOLDS,
  analyzeInventory,
  findingsOf,
  getRestockPriority,
  restockSuggestion,
} from './insights';
import type { CopilotFinding, CopilotReply, CopilotTable } from './types';

export interface EngineDeps {
  products: ProductView[];
  categories: Category[];
  suppliers: Supplier[];
  movements: StockMovement[];
  priceChanges: PriceChange[];
  settings: Settings;
  money: (value: number) => string;
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const has = (text: string, ...words: string[]): boolean => words.some((w) => text.includes(w));

/** Extrae el primer número de la pregunta ("menor a 5" → 5, "10%" → 10). */
function extractNumber(text: string): number | null {
  const match = text.match(/(-?\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function productTable(
  products: ProductView[],
  money: (v: number) => string,
  columns: Array<'precio' | 'compra' | 'stock' | 'minimo' | 'margen' | 'categoria' | 'valor'>,
  caption?: string,
): CopilotTable {
  const defs: Record<string, { key: string; label: string; align?: 'left' | 'right' }> = {
    precio: { key: 'precio', label: 'Precio venta', align: 'right' },
    compra: { key: 'compra', label: 'Precio compra', align: 'right' },
    stock: { key: 'stock', label: 'Stock', align: 'right' },
    minimo: { key: 'minimo', label: 'Mínimo', align: 'right' },
    margen: { key: 'margen', label: 'Margen', align: 'right' },
    categoria: { key: 'categoria', label: 'Categoría' },
    valor: { key: 'valor', label: 'Valor inventario', align: 'right' },
  };

  return {
    columns: [{ key: 'producto', label: 'Producto' }, ...columns.map((c) => defs[c])],
    rows: products.map((p) => {
      const row: Record<string, string | number> = { producto: p.name };
      for (const column of columns) {
        switch (column) {
          case 'precio':
            row.precio = money(p.salePrice);
            break;
          case 'compra':
            row.compra = p.purchasePrice > 0 ? money(p.purchasePrice) : 'sin dato';
            break;
          case 'stock':
            row.stock = formatNumber(p.stock);
            break;
          case 'minimo':
            row.minimo = formatNumber(p.minStock);
            break;
          case 'margen':
            row.margen =
              p.purchasePrice > 0
                ? `${money(p.margin)} · ${p.marginPercent.toFixed(0)}%`
                : 'sin dato';
            break;
          case 'categoria':
            row.categoria = p.categoryName;
            break;
          case 'valor':
            row.valor = money(p.inventoryValue);
            break;
        }
      }
      return row;
    }),
    caption,
  };
}

function findingBullets(findings: CopilotFinding[], limit = 8): string[] {
  return findings.slice(0, limit).map((f) => `${f.productName}: ${f.reason}`);
}

const DEFAULT_FOLLOW_UPS = [
  '¿Qué productos debería reponer primero?',
  '¿Cuáles son mis productos más rentables?',
  'Resumen del inventario',
];

/* ------------------------------------------------------------------ */
/* Motor                                                               */
/* ------------------------------------------------------------------ */

/**
 * Responde con análisis local, sin llamar a ningún modelo.
 *
 * Es el motor por defecto (la app funciona en GitHub Pages sin backend) y
 * también el respaldo cuando la API de IA no está disponible. Todas las cifras
 * salen del inventario real; si un dato no existe, lo dice.
 */
export function answerLocally(question: string, deps: EngineDeps): CopilotReply {
  const { products, categories, movements, priceChanges, money } = deps;
  const q = normalizeText(question);

  if (products.length === 0) {
    return {
      source: 'local',
      text: 'Todavía no hay productos cargados, así que no puedo analizar nada. Cargá tu primer producto o usá los datos de demostración desde Configuración y volvé a preguntarme.',
      followUps: ['Resumen del inventario'],
    };
  }

  const findings = analyzeInventory(products, { movements, moneyFormatter: money });

  /* ---------------- Acción: ajuste de precios ---------------- */
  const priceActionReply = tryPriceAction(q, deps);
  if (priceActionReply) return priceActionReply;

  /* ---------------- Resumen general ---------------- */
  if (has(q, 'resumen', 'como esta mi negocio', 'como va el negocio', 'panorama', 'estado general')) {
    return summaryReply(deps, findings);
  }

  /* ---------------- Conteos y valores ---------------- */
  if (has(q, 'cuantos productos', 'cantidad de productos', 'numero de productos', 'total de productos')) {
    const breakdown = getCategoryBreakdown(products, categories);
    return {
      source: 'local',
      text: `Tenés ${formatNumber(products.length)} productos cargados, repartidos en ${breakdown.length} categoría${breakdown.length === 1 ? '' : 's'} con movimiento.`,
      bullets: breakdown.slice(0, 6).map((c) => `${c.name}: ${c.productCount} productos`),
      followUps: DEFAULT_FOLLOW_UPS,
    };
  }

  if (
    has(q, 'valor total', 'valor del inventario', 'valor de mi inventario', 'cuanto dinero', 'invertido', 'capital')
  ) {
    const inventoryValue = products.reduce((s, p) => s + p.purchasePrice * p.stock, 0);
    const potential = products.reduce((s, p) => s + p.salePrice * p.stock, 0);
    const missing = products.filter((p) => p.purchasePrice <= 0).length;
    return {
      source: 'local',
      text: `Tenés aproximadamente ${money(inventoryValue)} invertidos en stock (precio de compra × unidades). Si vendieras todo al precio actual, entrarían ${money(potential)}, o sea ${money(potential - inventoryValue)} de ganancia bruta.`,
      bullets: missing
        ? [
            `Ojo: ${missing} producto(s) no tienen precio de compra cargado, así que no están sumando al valor invertido.`,
          ]
        : undefined,
      table: productTable(
        [...products].sort((a, b) => b.inventoryValue - a.inventoryValue).slice(0, 5),
        money,
        ['stock', 'compra', 'valor'],
        'Los 5 productos con más plata inmovilizada',
      ),
      followUps: ['¿Qué productos tienen exceso de stock?', ...DEFAULT_FOLLOW_UPS.slice(0, 2)],
    };
  }

  /* ---------------- Stock ---------------- */
  if (has(q, 'stock critico', 'criticos', 'urgente')) {
    const critical = findingsOf(findings, 'sin-stock', 'stock-critico');
    if (critical.length === 0) {
      return {
        source: 'local',
        text: 'No hay productos en stock crítico: ninguno está agotado ni por debajo de la mitad de su stock mínimo. Buena noticia.',
        followUps: DEFAULT_FOLLOW_UPS,
      };
    }
    const list = critical.map((f) => products.find((p) => p.id === f.productId)!).filter(Boolean);
    return {
      source: 'local',
      text: `Hay ${critical.length} producto${critical.length === 1 ? '' : 's'} en estado crítico. Te los ordeno por urgencia:`,
      bullets: findingBullets(critical),
      table: productTable(list.slice(0, 12), money, ['stock', 'minimo', 'categoria']),
      followUps: ['¿Qué productos debería reponer primero?', 'Revisar stock'],
    };
  }

  if (has(q, 'sin stock', 'agotado', 'agotados', 'se acabo', 'quedan en cero', 'stock 0')) {
    const out = products.filter((p) => p.isOutOfStock);
    if (out.length === 0) {
      return {
        source: 'local',
        text: 'No tenés ningún producto agotado en este momento.',
        followUps: DEFAULT_FOLLOW_UPS,
      };
    }
    return {
      source: 'local',
      text: `Tenés ${out.length} producto${out.length === 1 ? '' : 's'} agotado${out.length === 1 ? '' : 's'}. Cada uno es una venta que estás perdiendo hoy:`,
      table: productTable(out, money, ['minimo', 'precio', 'categoria']),
      followUps: ['¿Qué productos debería reponer primero?'],
    };
  }

  const stockLimit = has(q, 'menor a', 'menos de', 'debajo de', 'inferior a', 'menores a')
    ? extractNumber(q)
    : null;
  if (stockLimit !== null && has(q, 'stock', 'unidades') && !q.includes('%')) {
    const list = products
      .filter((p) => p.stock < stockLimit)
      .sort((a, b) => a.stock - b.stock);
    return {
      source: 'local',
      text:
        list.length === 0
          ? `No hay productos con stock menor a ${formatNumber(stockLimit)}.`
          : `Encontré ${list.length} producto${list.length === 1 ? '' : 's'} con stock menor a ${formatNumber(stockLimit)}:`,
      table: list.length > 0 ? productTable(list.slice(0, 25), money, ['stock', 'minimo', 'categoria']) : undefined,
      followUps: ['¿Qué productos debería reponer primero?'],
    };
  }

  if (has(q, 'bajo el minimo', 'debajo del minimo', 'debajo de stock minimo', 'stock minimo', 'poco stock', 'stock bajo', 'revisar stock')) {
    const low = products.filter((p) => p.isLowStock || p.isOutOfStock).sort((a, b) => a.stock - b.stock);
    if (low.length === 0) {
      return {
        source: 'local',
        text: 'Todos los productos están por encima de su stock mínimo. No hay nada urgente para reponer.',
        followUps: DEFAULT_FOLLOW_UPS,
      };
    }
    const relevant = findingsOf(findings, 'sin-stock', 'stock-critico', 'stock-bajo');
    return {
      source: 'local',
      text: `Hay ${low.length} producto${low.length === 1 ? '' : 's'} en o por debajo del stock mínimo:`,
      bullets: findingBullets(relevant, 6),
      table: productTable(low.slice(0, 25), money, ['stock', 'minimo', 'categoria']),
      followUps: ['¿Qué productos debería reponer primero?', '¿Cuánto cuesta reponerlos?'],
    };
  }

  if (has(q, 'reponer', 'reposicion', 'comprar primero', 'que pedir', 'pedido')) {
    const restock = getRestockPriority(products, 12);
    if (restock.length === 0) {
      return {
        source: 'local',
        text: 'No hay nada urgente para reponer: todo el inventario está por encima del mínimo.',
        followUps: DEFAULT_FOLLOW_UPS,
      };
    }
    const investment = restock.reduce((s, p) => s + restockSuggestion(p) * (p.purchasePrice || 0), 0);
    return {
      source: 'local',
      text: `Te ordeno la reposición por urgencia y, dentro de cada grupo, por lo que más ganancia deja. Volver al mínimo con estos ${restock.length} productos cuesta unos ${money(investment)} a precio de compra.`,
      bullets: restock
        .slice(0, 6)
        .map(
          (p) =>
            `${p.name}: quedan ${formatNumber(p.stock)} y el mínimo es ${formatNumber(p.minStock)}, faltan ${formatNumber(restockSuggestion(p))} unidades${p.purchasePrice > 0 ? ` (${money(restockSuggestion(p) * p.purchasePrice)})` : ''}.`,
        ),
      table: {
        columns: [
          { key: 'producto', label: 'Producto' },
          { key: 'stock', label: 'Stock', align: 'right' },
          { key: 'minimo', label: 'Mínimo', align: 'right' },
          { key: 'faltan', label: 'Faltan', align: 'right' },
          { key: 'costo', label: 'Costo estimado', align: 'right' },
        ],
        rows: restock.map((p) => ({
          producto: p.name,
          stock: formatNumber(p.stock),
          minimo: formatNumber(p.minStock),
          faltan: formatNumber(restockSuggestion(p)),
          costo: p.purchasePrice > 0 ? money(restockSuggestion(p) * p.purchasePrice) : 'sin dato',
        })),
      },
      followUps: ['¿Qué proveedores tengo?', 'Ver productos críticos'],
    };
  }

  if (has(q, 'exceso', 'sobra stock', 'demasiado stock', 'sobrestock')) {
    const excess = findingsOf(findings, 'exceso-stock');
    if (excess.length === 0) {
      return {
        source: 'local',
        text: `Ningún producto supera ${THRESHOLDS.excessFactor} veces su stock mínimo, así que no veo exceso de inventario.`,
        followUps: DEFAULT_FOLLOW_UPS,
      };
    }
    const list = excess.map((f) => products.find((p) => p.id === f.productId)!).filter(Boolean);
    return {
      source: 'local',
      text: `Hay ${excess.length} producto${excess.length === 1 ? '' : 's'} con mucho más stock del necesario. Es plata quieta:`,
      bullets: findingBullets(excess),
      table: productTable(list.slice(0, 12), money, ['stock', 'minimo', 'valor']),
      followUps: ['¿Qué productos debería revisar?'],
    };
  }

  if (has(q, 'sin movimiento', 'no se vende', 'no rota', 'rotacion', 'no se mueve', 'parado')) {
    const stale = findingsOf(findings, 'sin-movimiento');
    if (movements.length === 0) {
      return {
        source: 'local',
        text: 'Todavía no hay movimientos de stock registrados, así que no puedo analizar rotación. En cuanto cargues entradas y ventas voy a poder decirte qué no se mueve.',
        followUps: DEFAULT_FOLLOW_UPS,
      };
    }
    if (stale.length === 0) {
      return {
        source: 'local',
        text: `Todos los productos con stock tuvieron algún movimiento en los últimos ${THRESHOLDS.staleDays} días.`,
        followUps: DEFAULT_FOLLOW_UPS,
      };
    }
    const list = stale.map((f) => products.find((p) => p.id === f.productId)!).filter(Boolean);
    return {
      source: 'local',
      text: `Estos productos no registran movimientos hace más de ${THRESHOLDS.staleDays} días:`,
      bullets: findingBullets(stale),
      table: productTable(list.slice(0, 12), money, ['stock', 'valor', 'categoria']),
      followUps: ['¿Qué productos tienen exceso de stock?'],
    };
  }

  /* ---------------- Precios y márgenes ---------------- */
  if (has(q, 'bajo el costo', 'debajo del costo', 'perdiendo', 'perdida', 'menos que el costo')) {
    const below = findingsOf(findings, 'precio-bajo-costo');
    if (below.length === 0) {
      return {
        source: 'local',
        text: 'Ningún producto se está vendiendo por debajo de su precio de compra.',
        followUps: DEFAULT_FOLLOW_UPS,
      };
    }
    const list = below.map((f) => products.find((p) => p.id === f.productId)!).filter(Boolean);
    return {
      source: 'local',
      text: `Atención: ${below.length} producto${below.length === 1 ? '' : 's'} se vende${below.length === 1 ? '' : 'n'} por debajo del costo.`,
      bullets: findingBullets(below),
      table: productTable(list, money, ['compra', 'precio', 'margen']),
      followUps: ['¿Qué productos tienen margen menor al 20%?'],
    };
  }

  if (has(q, 'sin precio de compra', 'sin costo', 'sin margen configurado', 'falta precio de compra')) {
    const missing = products.filter((p) => p.purchasePrice <= 0);
    if (missing.length === 0) {
      return {
        source: 'local',
        text: 'Todos los productos tienen precio de compra cargado. Podés confiar en los márgenes.',
        followUps: DEFAULT_FOLLOW_UPS,
      };
    }
    return {
      source: 'local',
      text: `Hay ${missing.length} producto${missing.length === 1 ? '' : 's'} sin precio de compra. Sin ese dato no puedo calcular margen ni valor real de inventario:`,
      table: productTable(missing.slice(0, 25), money, ['precio', 'stock', 'categoria']),
      followUps: ['Analizar márgenes'],
    };
  }

  const marginLimit =
    has(q, 'menor a', 'menos de', 'debajo de', 'inferior a', 'menores a') && q.includes('margen')
      ? extractNumber(q)
      : null;
  if (marginLimit !== null) {
    const list = products
      .filter((p) => p.purchasePrice > 0 && p.marginPercent < marginLimit)
      .sort((a, b) => a.marginPercent - b.marginPercent);
    const missing = products.filter((p) => p.purchasePrice <= 0).length;
    return {
      source: 'local',
      text:
        list.length === 0
          ? `No hay productos con margen menor al ${marginLimit}%.`
          : `Encontré ${list.length} producto${list.length === 1 ? '' : 's'} con margen menor al ${marginLimit}% sobre el costo:`,
      bullets: missing ? [`${missing} producto(s) quedan fuera del análisis por no tener precio de compra.`] : undefined,
      table: list.length > 0 ? productTable(list.slice(0, 25), money, ['compra', 'precio', 'margen']) : undefined,
      followUps: ['¿Cuáles son mis productos más rentables?'],
    };
  }

  if (has(q, 'rentable', 'mayor margen', 'mejor margen', 'mejores margenes', 'mas ganancia', 'analizar margenes', 'analizar margen')) {
    const withPrice = products.filter((p) => p.purchasePrice > 0);
    if (withPrice.length === 0) {
      return {
        source: 'local',
        text: 'No puedo calcular márgenes porque ningún producto tiene precio de compra cargado. Cargalo en la ficha de cada producto y vuelvo a analizarlo.',
        followUps: ['¿Qué productos no tienen precio de compra?'],
      };
    }
    const top = [...withPrice].sort((a, b) => b.marginPercent - a.marginPercent).slice(0, 10);
    const avg = withPrice.reduce((s, p) => s + p.marginPercent, 0) / withPrice.length;
    return {
      source: 'local',
      text: `El margen promedio de tu inventario es ${avg.toFixed(0)}% sobre el costo. Estos son los productos que más dejan por unidad:`,
      bullets: top
        .slice(0, 4)
        .map((p) => `${p.name}: deja ${money(p.margin)} por unidad (${p.marginPercent.toFixed(0)}%).`),
      table: productTable(top, money, ['compra', 'precio', 'margen']),
      followUps: ['¿Qué productos tienen margen menor al 20%?', '¿Qué productos debería revisar?'],
    };
  }

  if (has(q, 'precio mas bajo', 'precios mas bajos', 'mas barato', 'mas baratos', 'menor precio')) {
    const list = [...products].sort((a, b) => a.salePrice - b.salePrice).slice(0, 10);
    return {
      source: 'local',
      text: 'Estos son tus productos más baratos, del menor al mayor precio de venta:',
      table: productTable(list, money, ['precio', 'compra', 'margen']),
      followUps: ['¿Cuáles tienen mayor precio?', 'Analizar márgenes'],
    };
  }

  if (has(q, 'precio mas alto', 'precios mas altos', 'mas caro', 'mas caros', 'mayor precio')) {
    const list = [...products].sort((a, b) => b.salePrice - a.salePrice).slice(0, 10);
    return {
      source: 'local',
      text: 'Estos son tus productos más caros:',
      table: productTable(list, money, ['precio', 'compra', 'margen']),
      followUps: ['¿Qué productos tienen precio de venta más bajo?'],
    };
  }

  if (has(q, 'cambios de precio', 'historial de precio', 'variacion de precio', 'aumentaron', 'ultimos precios')) {
    if (priceChanges.length === 0) {
      return {
        source: 'local',
        text: 'Todavía no registraste ningún cambio de precio, así que no hay historial para analizar.',
        followUps: DEFAULT_FOLLOW_UPS,
      };
    }
    return {
      source: 'local',
      text: `Registraste ${priceChanges.length} cambio${priceChanges.length === 1 ? '' : 's'} de precio. Los últimos:`,
      table: {
        columns: [
          { key: 'producto', label: 'Producto' },
          { key: 'anterior', label: 'Antes', align: 'right' },
          { key: 'nuevo', label: 'Ahora', align: 'right' },
          { key: 'variacion', label: 'Variación', align: 'right' },
          { key: 'cuando', label: 'Cuándo' },
        ],
        rows: priceChanges.slice(0, 10).map((c) => ({
          producto: c.productName,
          anterior: money(c.previousPrice),
          nuevo: money(c.newPrice),
          variacion:
            c.previousPrice > 0
              ? `${c.newPrice >= c.previousPrice ? '+' : ''}${(((c.newPrice - c.previousPrice) / c.previousPrice) * 100).toFixed(0)}%`
              : '—',
          cuando: formatRelative(c.date),
        })),
      },
      followUps: DEFAULT_FOLLOW_UPS,
    };
  }

  /* ---------------- Categorías y proveedores ---------------- */
  if (has(q, 'categoria', 'categorias', 'rubro')) {
    const breakdown = getCategoryBreakdown(products, categories);
    return {
      source: 'local',
      text: `Tenés ${breakdown.length} categoría${breakdown.length === 1 ? '' : 's'} con productos cargados. De mayor a menor:`,
      table: {
        columns: [
          { key: 'categoria', label: 'Categoría' },
          { key: 'productos', label: 'Productos', align: 'right' },
          { key: 'valor', label: 'Valor inventario', align: 'right' },
        ],
        rows: breakdown.map((c) => ({
          categoria: c.name,
          productos: c.productCount,
          valor: money(c.inventoryValue),
        })),
      },
      followUps: ['Aumentar un 10% los precios de Bebidas', 'Resumen del inventario'],
    };
  }

  if (has(q, 'proveedor', 'proveedores')) {
    if (deps.suppliers.length === 0) {
      return {
        source: 'local',
        text: 'Todavía no cargaste proveedores. Podés agregarlos desde la sección Proveedores y después asociarlos a cada producto.',
        followUps: DEFAULT_FOLLOW_UPS,
      };
    }
    const rows = deps.suppliers.map((s) => {
      const items = products.filter((p) => p.supplierId === s.id);
      const pending = items.filter((p) => p.isLowStock || p.isOutOfStock);
      return {
        proveedor: s.name,
        productos: items.length,
        reponer: pending.length,
        contacto: s.phone || s.email || 'sin datos',
      };
    });
    return {
      source: 'local',
      text: `Tenés ${deps.suppliers.length} proveedor${deps.suppliers.length === 1 ? '' : 'es'} cargado${deps.suppliers.length === 1 ? '' : 's'}:`,
      table: {
        columns: [
          { key: 'proveedor', label: 'Proveedor' },
          { key: 'productos', label: 'Productos', align: 'right' },
          { key: 'reponer', label: 'Por reponer', align: 'right' },
          { key: 'contacto', label: 'Contacto' },
        ],
        rows,
      },
      followUps: ['¿Qué productos debería reponer primero?'],
    };
  }

  /* ---------------- Qué revisar ---------------- */
  if (has(q, 'revisar', 'atencion', 'problema', 'que miro', 'recomend')) {
    const priority = [
      ...findingsOf(findings, 'sin-stock'),
      ...findingsOf(findings, 'precio-bajo-costo'),
      ...findingsOf(findings, 'stock-critico'),
      ...findingsOf(findings, 'margen-bajo'),
      ...findingsOf(findings, 'sin-movimiento'),
      ...findingsOf(findings, 'exceso-stock'),
    ];
    if (priority.length === 0) {
      return {
        source: 'local',
        text: 'No encontré nada que necesite tu atención ahora: el stock está sobre el mínimo, no hay productos vendiéndose bajo el costo y los márgenes están razonables.',
        followUps: DEFAULT_FOLLOW_UPS,
      };
    }
    return {
      source: 'local',
      text: `Encontré ${priority.length} cosa${priority.length === 1 ? '' : 's'} para revisar. Te las ordeno por importancia y te digo el motivo de cada una:`,
      bullets: findingBullets(priority, 10),
      followUps: ['¿Qué productos debería reponer primero?', 'Analizar precios'],
    };
  }

  if (has(q, 'analizar precios', 'analiza los precios', 'precios')) {
    return priceAnalysisReply(deps, findings);
  }

  /* ---------------- Sin coincidencia ---------------- */
  return {
    source: 'local',
    text: 'No entendí bien esa pregunta con el análisis local. Puedo ayudarte con stock, precios, márgenes, categorías, proveedores y reposición. Probá con alguna de estas:',
    followUps: [
      '¿Qué productos tienen poco stock?',
      '¿Cuál es el valor total de mi inventario?',
      '¿Cuáles son mis productos más rentables?',
      '¿Qué productos debería revisar?',
      'Aumentar un 10% los precios de Bebidas',
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Respuestas compuestas                                               */
/* ------------------------------------------------------------------ */

function summaryReply(deps: EngineDeps, findings: CopilotFinding[]): CopilotReply {
  const { products, categories, money, movements } = deps;
  const inventoryValue = products.reduce((s, p) => s + p.purchasePrice * p.stock, 0);
  const potential = products.reduce((s, p) => s + p.salePrice * p.stock, 0);
  const withPrice = products.filter((p) => p.purchasePrice > 0);
  const avgMargin = withPrice.length
    ? withPrice.reduce((s, p) => s + p.marginPercent, 0) / withPrice.length
    : 0;
  const out = products.filter((p) => p.isOutOfStock).length;
  const low = products.filter((p) => p.isLowStock).length;

  const bullets = [
    `${formatNumber(products.length)} productos en ${getCategoryBreakdown(products, categories).length} categorías.`,
    `${money(inventoryValue)} invertidos en stock · ${money(potential)} de venta potencial.`,
    withPrice.length
      ? `Margen promedio: ${avgMargin.toFixed(0)}% sobre el costo (${withPrice.length} de ${products.length} productos tienen precio de compra).`
      : 'Ningún producto tiene precio de compra, así que no hay margen para calcular.',
    `${out} agotado${out === 1 ? '' : 's'} y ${low} por debajo del mínimo.`,
    movements.length
      ? `${movements.length} movimientos de stock registrados.`
      : 'Sin movimientos de stock registrados todavía.',
  ];

  const urgent = [
    ...findingsOf(findings, 'sin-stock'),
    ...findingsOf(findings, 'precio-bajo-costo'),
    ...findingsOf(findings, 'stock-critico'),
  ].slice(0, 3);

  return {
    source: 'local',
    text: `Así está ${deps.settings.businessName || 'tu negocio'} hoy:`,
    bullets: [
      ...bullets,
      ...(urgent.length ? ['', 'Lo más urgente:', ...urgent.map((f) => `${f.productName}: ${f.reason}`)] : []),
    ],
    followUps: ['¿Qué productos debería reponer primero?', 'Analizar precios', '¿Qué productos debería revisar?'],
  };
}

function priceAnalysisReply(deps: EngineDeps, findings: CopilotFinding[]): CopilotReply {
  const { products, money } = deps;
  const withPrice = products.filter((p) => p.purchasePrice > 0);
  const missing = products.length - withPrice.length;

  if (withPrice.length === 0) {
    return {
      source: 'local',
      text: 'No puedo analizar precios todavía: ningún producto tiene precio de compra cargado, así que no hay margen que calcular. Cargalo desde la ficha del producto.',
      followUps: ['¿Qué productos no tienen precio de compra?'],
    };
  }

  const avg = withPrice.reduce((s, p) => s + p.marginPercent, 0) / withPrice.length;
  const belowCost = findingsOf(findings, 'precio-bajo-costo');
  const lowMargin = findingsOf(findings, 'margen-bajo');
  const highMargin = findingsOf(findings, 'margen-alto');

  const bullets: string[] = [
    `Margen promedio: ${avg.toFixed(0)}% sobre el costo.`,
    `${withPrice.length} de ${products.length} productos tienen precio de compra cargado.`,
  ];
  if (missing > 0) bullets.push(`${missing} producto(s) quedan fuera del análisis por falta de precio de compra.`);
  if (belowCost.length > 0) bullets.push(`${belowCost.length} se venden por debajo del costo: es lo primero a corregir.`);
  if (lowMargin.length > 0) bullets.push(`${lowMargin.length} tienen margen menor al ${THRESHOLDS.lowMarginPercent}%.`);
  if (highMargin.length > 0) bullets.push(`${highMargin.length} superan el ${THRESHOLDS.highMarginPercent}% de margen.`);

  const worst = [...withPrice].sort((a, b) => a.marginPercent - b.marginPercent).slice(0, 8);

  return {
    source: 'local',
    text: 'Este es el estado de tus precios:',
    bullets,
    table: productTable(worst, money, ['compra', 'precio', 'margen'], 'Los márgenes más flojos'),
    followUps: ['¿Cuáles son mis productos más rentables?', 'Aumentar un 10% los precios de Bebidas'],
  };
}

/* ------------------------------------------------------------------ */
/* Detección de acciones de precio en lenguaje natural                 */
/* ------------------------------------------------------------------ */

function tryPriceAction(q: string, deps: EngineDeps): CopilotReply | null {
  const wantsIncrease = has(q, 'aumentar', 'subir', 'incrementar', 'aumenta', 'sube');
  const wantsDecrease = has(q, 'bajar', 'reducir', 'descontar', 'baja', 'rebajar');
  if (!wantsIncrease && !wantsDecrease) return null;
  if (!has(q, 'precio', 'precios')) return null;

  const percentMatch = q.match(/(\d+(?:[.,]\d+)?)\s*(?:%|por ciento|porciento)/);
  if (!percentMatch) return null;
  const percent = Number(percentMatch[1].replace(',', '.'));
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return null;

  const signed = wantsDecrease ? -percent : percent;

  // ¿Menciona una categoría existente?
  const category = deps.categories.find((c) => q.includes(normalizeText(c.name)));
  const scope = category
    ? ({ kind: 'categoria', categoryId: category.id, categoryName: category.name } as const)
    : ({ kind: 'todos' } as const);

  const affected =
    scope.kind === 'categoria'
      ? deps.products.filter((p) => p.categoryId === scope.categoryId)
      : deps.products;

  if (affected.length === 0) {
    return {
      source: 'local',
      text: `No encontré productos${category ? ` en la categoría ${category.name}` : ''} para ajustar.`,
      followUps: ['¿Qué categorías tienen más productos?'],
    };
  }

  return {
    source: 'local',
    text: `Encontré ${affected.length} producto${affected.length === 1 ? '' : 's'}${category ? ` en la categoría ${category.name}` : ' en todo el inventario'}. Revisá la vista previa antes de aplicar: los precios se redondean a la decena y podés cancelar sin que se toque nada.`,
    action: { type: 'precio-masivo', mode: 'percent', value: signed, round: 10, scope },
  };
}
