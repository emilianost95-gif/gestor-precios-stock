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
import { findConcept } from './concepts';
import { describeScreen, getScreenSuggestions } from './appContext';
import { findingBullets, listActions, productActions, productTable } from './presenters';
import type { CopilotFinding, CopilotReply, CopilotUiAction, CopilotUiContext } from './types';

/* ------------------------------------------------------------------ */
/* Contrato                                                            */
/* ------------------------------------------------------------------ */

export interface ToolContext {
  products: ProductView[];
  categories: Category[];
  suppliers: Supplier[];
  movements: StockMovement[];
  priceChanges: PriceChange[];
  settings: Settings;
  money: (value: number) => string;
  demoMode: boolean;
  ui: CopilotUiContext;
}

export type ToolResult = Omit<CopilotReply, 'source' | 'tool'>;

export type ToolArgs = Record<string, unknown>;

export interface CopilotTool {
  /** Qué hace, en una línea. Se usa también en el prompt del modelo. */
  description: string;
  /** Parámetros aceptados, para documentar el contrato. */
  params?: string;
  run: (args: ToolArgs, ctx: ToolContext) => ToolResult;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const num = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

function findings(ctx: ToolContext): CopilotFinding[] {
  return analyzeInventory(ctx.products, { movements: ctx.movements, moneyFormatter: ctx.money });
}

function productsOf(list: CopilotFinding[], ctx: ToolContext): ProductView[] {
  return list
    .map((f) => ctx.products.find((p) => p.id === f.productId))
    .filter((p): p is ProductView => Boolean(p));
}

function resolveProduct(args: ToolArgs, ctx: ToolContext): ProductView | undefined {
  const id = str(args.productoId) ?? str(args.productId);
  if (id) {
    const byId = ctx.products.find((p) => p.id === id);
    if (byId) return byId;
  }
  const name = str(args.producto) ?? str(args.nombre) ?? str(args.termino);
  if (!name) return undefined;
  const q = normalizeText(name);
  return (
    ctx.products.find((p) => normalizeText(p.name) === q) ??
    ctx.products.find((p) => normalizeText(p.name).includes(q)) ??
    ctx.products.find((p) => normalizeText(p.barcode ?? '') === q)
  );
}

const NO_DATA = (what: string): ToolResult => ({
  text: `No tengo suficiente información para calcular ${what}.`,
  followUps: ['Resumen del inventario'],
});

/** Ficha resumida de un producto. Compartida por varias herramientas. */
function describeProduct(product: ProductView, ctx: ToolContext): ToolResult {
  const bullets: string[] = [
    `Stock: ${formatNumber(product.stock)} ${product.stock === 1 ? 'unidad' : 'unidades'} · mínimo ${formatNumber(product.minStock)}.`,
    `Precio de venta: ${ctx.money(product.salePrice)}.`,
    product.purchasePrice > 0
      ? `Lo comprás a ${ctx.money(product.purchasePrice)}, así que te deja ${ctx.money(product.margin)} por unidad (${product.marginPercent.toFixed(0)}%).`
      : 'No tiene precio de compra cargado, así que no puedo calcular cuánto te deja.',
    `Categoría: ${product.categoryName} · Proveedor: ${product.supplierName}.`,
  ];

  const estado = product.isOutOfStock
    ? 'Está agotado: hoy no lo podés vender.'
    : product.isLowStock
      ? 'Está por debajo del mínimo, te conviene reponerlo.'
      : 'El stock está en orden.';

  return {
    text: `${product.name}. ${estado}`,
    bullets,
    actions: productActions(product),
    followUps: ['¿Qué es margen?', '¿Qué productos debería reponer primero?'],
  };
}

const EMPTY_INVENTORY: ToolResult = {
  text: 'Todavía no hay productos cargados, así que no puedo analizar nada.',
  actions: [
    { label: 'Agregar mi primer producto', icon: 'agregar', effect: { kind: 'nuevo-producto' } },
    { label: 'Enseñame la aplicación', icon: 'tutorial', effect: { kind: 'tutorial', lessonId: 'agregar-producto' } },
  ],
};

/* ------------------------------------------------------------------ */
/* Herramientas                                                        */
/* ------------------------------------------------------------------ */

export const TOOLS = {
  /* ---------- Lectura de datos ---------- */

  obtenerResumenInventario: {
    description: 'Resumen general del negocio: productos, valor, márgenes y urgencias.',
    run: (_args, ctx) => {
      if (ctx.products.length === 0) return EMPTY_INVENTORY;
      const { products, money } = ctx;
      const inventoryValue = products.reduce((s, p) => s + p.purchasePrice * p.stock, 0);
      const potential = products.reduce((s, p) => s + p.salePrice * p.stock, 0);
      const withPrice = products.filter((p) => p.purchasePrice > 0);
      const avgMargin = withPrice.length
        ? withPrice.reduce((s, p) => s + p.marginPercent, 0) / withPrice.length
        : 0;
      const out = products.filter((p) => p.isOutOfStock).length;
      const low = products.filter((p) => p.isLowStock).length;
      const urgent = [
        ...findingsOf(findings(ctx), 'sin-stock'),
        ...findingsOf(findings(ctx), 'precio-bajo-costo'),
        ...findingsOf(findings(ctx), 'stock-critico'),
      ].slice(0, 3);

      return {
        text: `Así está ${ctx.settings.businessName || 'tu negocio'} hoy:`,
        bullets: [
          `${formatNumber(products.length)} productos en ${getCategoryBreakdown(products, ctx.categories).length} categorías.`,
          `${money(inventoryValue)} invertidos en stock · ${money(potential)} de venta potencial.`,
          withPrice.length
            ? `Margen promedio: ${avgMargin.toFixed(0)}% sobre el costo.`
            : 'Ningún producto tiene precio de compra, así que no hay margen para calcular.',
          `${out} agotado${out === 1 ? '' : 's'} y ${low} por debajo del mínimo.`,
          ...(urgent.length ? ['', 'Lo más urgente:', ...urgent.map((f) => `${f.productName}: ${f.reason}`)] : []),
        ],
        actions: [
          { label: 'Qué reponer primero', icon: 'stock', question: '¿Qué productos debería reponer primero?' },
          { label: 'Analizar precios', icon: 'precio', question: 'Analizar precios' },
        ],
        followUps: ['¿Qué productos debería revisar?', '¿Cuáles son mis productos más rentables?'],
      };
    },
  },

  analizarInventario: {
    description: 'Análisis completo con lo bueno, lo urgente y una recomendación concreta.',
    run: (_args, ctx) => {
      if (ctx.products.length === 0) return EMPTY_INVENTORY;
      const all = findings(ctx);
      const out = findingsOf(all, 'sin-stock');
      const critical = findingsOf(all, 'stock-critico');
      const low = findingsOf(all, 'stock-bajo');
      const belowCost = findingsOf(all, 'precio-bajo-costo');
      const lowMargin = findingsOf(all, 'margen-bajo');
      const healthy = ctx.products.filter((p) => !p.isLowStock && !p.isOutOfStock).length;

      const bullets: string[] = [];
      for (const f of [...out, ...belowCost, ...critical].slice(0, 3)) {
        bullets.push(`🔴 ${f.productName} — ${f.reason}`);
      }
      for (const f of [...low, ...lowMargin].slice(0, 3)) {
        bullets.push(`🟡 ${f.productName} — ${f.reason}`);
      }
      if (healthy > 0) {
        bullets.push(`🟢 ${healthy} producto${healthy === 1 ? '' : 's'} con stock suficiente.`);
      }

      const problems = out.length + critical.length + belowCost.length + low.length + lowMargin.length;
      const recommendation =
        out.length > 0
          ? `Mi recomendación: empezá por los ${out.length} producto${out.length === 1 ? '' : 's'} que están en cero, porque hoy no los podés vender.`
          : critical.length + low.length > 0
            ? 'Mi recomendación: revisá primero los productos que quedaron por debajo del stock mínimo.'
            : belowCost.length > 0
              ? 'Mi recomendación: corregí los precios que quedaron por debajo del costo, cada venta ahí te resta plata.'
              : 'No veo nada urgente. El inventario está sano.';

      return {
        text:
          problems === 0
            ? 'Miré todo el inventario y no encontré problemas.'
            : `Encontré ${problems} cosa${problems === 1 ? '' : 's'} que deberías revisar.`,
        bullets,
        actions: [
          ...(out.length + critical.length + low.length > 0
            ? [
                {
                  label: 'Ver los que faltan',
                  icon: 'filtro' as const,
                  effect: { kind: 'navegar' as const, to: '/stock' },
                },
              ]
            : []),
          { label: 'Qué reponer primero', icon: 'stock', question: '¿Qué productos debería reponer primero?' },
        ],
        followUps: [recommendation, 'Analizar precios'],
      };
    },
  },

  buscarProducto: {
    description: 'Busca un producto por nombre o código y muestra su ficha resumida.',
    params: 'termino',
    run: (args, ctx) => {
      const term = str(args.termino) ?? str(args.producto) ?? str(args.nombre);
      if (!term) return NO_DATA('esa búsqueda: no me dijiste qué producto buscar');
      const q = normalizeText(term);
      const matches = ctx.products.filter(
        (p) => normalizeText(p.name).includes(q) || normalizeText(p.barcode ?? '').includes(q),
      );

      if (matches.length === 0) {
        return {
          text: `No encontré ningún producto que coincida con “${term}”.`,
          actions: [{ label: 'Ver todos los productos', icon: 'ver', effect: { kind: 'navegar', to: '/productos' } }],
        };
      }
      if (matches.length === 1) return describeProduct(matches[0], ctx);

      return {
        text: `Encontré ${matches.length} productos que coinciden con “${term}”:`,
        table: productTable(matches.slice(0, 15), ctx.money, ['precio', 'stock', 'categoria']),
        actions: [
          {
            label: 'Mostrar en la lista',
            icon: 'filtro',
            effect: { kind: 'navegar', to: `/productos?q=${encodeURIComponent(term)}` },
          },
        ],
      };
    },
  },

  explicarProducto: {
    description: 'Explica la situación de un producto: stock, precio, margen y qué conviene hacer.',
    params: 'productoId | producto',
    run: (args, ctx) => {
      const product = resolveProduct(args, ctx);
      if (!product) return NO_DATA('ese producto: no lo encontré en el inventario');
      return describeProduct(product, ctx);
    },
  },

  obtenerProductos: {
    description: 'Lista productos ordenados por precio, stock, margen o valor de inventario.',
    params: 'orden (precio-alto|precio-bajo|stock|margen|valor), limite',
    run: (args, ctx) => {
      if (ctx.products.length === 0) return EMPTY_INVENTORY;
      const orden = str(args.orden) ?? 'nombre';
      const limite = Math.min(Math.max(num(args.limite) ?? 10, 1), 30);
      const list = [...ctx.products];

      switch (orden) {
        case 'precio-alto':
          list.sort((a, b) => b.salePrice - a.salePrice);
          break;
        case 'precio-bajo':
          list.sort((a, b) => a.salePrice - b.salePrice);
          break;
        case 'stock':
          list.sort((a, b) => a.stock - b.stock);
          break;
        case 'margen':
          list.sort((a, b) => b.marginPercent - a.marginPercent);
          break;
        case 'valor':
          list.sort((a, b) => b.inventoryValue - a.inventoryValue);
          break;
        default:
          list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
      }

      const titles: Record<string, string> = {
        'precio-alto': 'Tus productos más caros:',
        'precio-bajo': 'Tus productos más baratos:',
        stock: 'Tus productos con menos stock:',
        margen: 'Tus productos que más dejan por unidad:',
        valor: 'Los productos con más plata inmovilizada:',
        nombre: 'Tus productos:',
      };

      const columns =
        orden === 'stock'
          ? (['stock', 'minimo', 'categoria'] as const)
          : orden === 'valor'
            ? (['stock', 'compra', 'valor'] as const)
            : (['precio', 'compra', 'margen'] as const);

      return {
        text: titles[orden] ?? titles.nombre,
        table: productTable(list.slice(0, limite), ctx.money, [...columns]),
        actions: [{ label: 'Ver todos', icon: 'ver', effect: { kind: 'navegar', to: '/productos' } }],
      };
    },
  },

  obtenerProductosBajoStock: {
    description: 'Productos en o por debajo del stock mínimo, o de un umbral que se le pase.',
    params: 'umbral (opcional)',
    run: (args, ctx) => {
      if (ctx.products.length === 0) return EMPTY_INVENTORY;
      const umbral = num(args.umbral);

      if (umbral !== undefined) {
        const list = ctx.products.filter((p) => p.stock < umbral).sort((a, b) => a.stock - b.stock);
        return {
          text:
            list.length === 0
              ? `No hay productos con stock menor a ${formatNumber(umbral)}.`
              : `Encontré ${list.length} producto${list.length === 1 ? '' : 's'} con stock menor a ${formatNumber(umbral)}:`,
          table: list.length ? productTable(list.slice(0, 25), ctx.money, ['stock', 'minimo', 'categoria']) : undefined,
          actions: list.length ? listActions('bajo') : undefined,
        };
      }

      const low = ctx.products.filter((p) => p.isLowStock || p.isOutOfStock).sort((a, b) => a.stock - b.stock);
      if (low.length === 0) {
        return {
          text: 'Todos los productos están por encima de su stock mínimo. No hay nada urgente para reponer.',
          followUps: ['Resumen del inventario'],
        };
      }
      const relevant = findingsOf(findings(ctx), 'sin-stock', 'stock-critico', 'stock-bajo');
      return {
        text: `Encontré ${low.length} producto${low.length === 1 ? '' : 's'} con poco stock.`,
        bullets: findingBullets(relevant, 6),
        table: productTable(low.slice(0, 25), ctx.money, ['stock', 'minimo', 'categoria']),
        actions: listActions('bajo', [
          { label: 'Qué reponer primero', icon: 'analizar', question: '¿Qué productos debería reponer primero?' },
        ]),
      };
    },
  },

  obtenerProductosSinStock: {
    description: 'Productos agotados.',
    run: (_args, ctx) => {
      const out = ctx.products.filter((p) => p.isOutOfStock);
      if (out.length === 0) {
        return { text: 'No tenés ningún producto agotado en este momento.', followUps: ['Resumen del inventario'] };
      }
      return {
        text: `Tenés ${out.length} producto${out.length === 1 ? '' : 's'} agotado${out.length === 1 ? '' : 's'}. Cada uno es una venta que estás perdiendo hoy.`,
        table: productTable(out, ctx.money, ['minimo', 'precio', 'categoria']),
        actions: listActions('sin-stock'),
      };
    },
  },

  obtenerProductosPorCategoria: {
    description: 'Productos de una categoría, o el reparto de productos entre categorías.',
    params: 'categoria (opcional)',
    run: (args, ctx) => {
      const name = str(args.categoria);
      if (name) {
        const category = ctx.categories.find((c) => normalizeText(c.name) === normalizeText(name));
        if (!category) {
          return {
            text: `No encontré la categoría “${name}”. Las que tenés son: ${ctx.categories.map((c) => c.name).join(', ')}.`,
          };
        }
        const list = ctx.products.filter((p) => p.categoryId === category.id);
        return {
          text: `${category.name} tiene ${list.length} producto${list.length === 1 ? '' : 's'}.`,
          table: list.length ? productTable(list, ctx.money, ['precio', 'stock', 'margen']) : undefined,
          actions: [
            {
              label: `Ver ${category.name}`,
              icon: 'filtro',
              effect: { kind: 'navegar', to: `/productos?categoria=${category.id}` },
            },
            {
              label: `Subir 10% en ${category.name}`,
              icon: 'precio',
              question: `Aumentar un 10% los precios de ${category.name}`,
            },
          ],
        };
      }

      const breakdown = getCategoryBreakdown(ctx.products, ctx.categories);
      if (breakdown.length === 0) return NO_DATA('el reparto por categorías: todavía no hay productos con categoría');
      return {
        text: `Tenés ${breakdown.length} categoría${breakdown.length === 1 ? '' : 's'} con productos. De mayor a menor:`,
        table: {
          columns: [
            { key: 'categoria', label: 'Categoría' },
            { key: 'productos', label: 'Productos', align: 'right' },
            { key: 'valor', label: 'Valor inventario', align: 'right' },
          ],
          rows: breakdown.map((c) => ({
            categoria: c.name,
            productos: c.productCount,
            valor: ctx.money(c.inventoryValue),
          })),
        },
        actions: [{ label: 'Ver categorías', icon: 'ver', effect: { kind: 'navegar', to: '/categorias' } }],
      };
    },
  },

  obtenerProductoMasRentable: {
    description: 'Los productos que más ganancia dejan por unidad.',
    run: (_args, ctx) => {
      const withPrice = ctx.products.filter((p) => p.purchasePrice > 0);
      if (withPrice.length === 0) {
        return {
          text: 'No puedo calcular márgenes: ningún producto tiene precio de compra cargado.',
          actions: [{ label: '¿Cuáles son?', icon: 'ver', question: '¿Qué productos no tienen precio de compra?' }],
        };
      }
      const top = [...withPrice].sort((a, b) => b.marginPercent - a.marginPercent).slice(0, 10);
      const avg = withPrice.reduce((s, p) => s + p.marginPercent, 0) / withPrice.length;
      return {
        text: `El que más te deja es ${top[0].name}: ${ctx.money(top[0].margin)} por unidad (${top[0].marginPercent.toFixed(0)}%). El margen promedio del inventario es ${avg.toFixed(0)}%.`,
        table: productTable(top, ctx.money, ['compra', 'precio', 'margen']),
        actions: productActions(top[0]),
        followUps: ['¿Qué productos tienen margen menor al 20%?', '¿Qué es margen?'],
      };
    },
  },

  obtenerMargenesBajos: {
    description: 'Productos con margen por debajo de un porcentaje.',
    params: 'umbral (por defecto 20)',
    run: (args, ctx) => {
      const umbral = num(args.umbral) ?? THRESHOLDS.lowMarginPercent;
      const withPrice = ctx.products.filter((p) => p.purchasePrice > 0);
      const missing = ctx.products.length - withPrice.length;
      const list = withPrice.filter((p) => p.marginPercent < umbral).sort((a, b) => a.marginPercent - b.marginPercent);
      return {
        text:
          list.length === 0
            ? `No hay productos con margen menor al ${umbral}%.`
            : `Encontré ${list.length} producto${list.length === 1 ? '' : 's'} con margen menor al ${umbral}% sobre el costo:`,
        bullets: missing ? [`${missing} producto(s) quedan fuera por no tener precio de compra.`] : undefined,
        table: list.length ? productTable(list.slice(0, 25), ctx.money, ['compra', 'precio', 'margen']) : undefined,
        followUps: ['¿Cuáles son mis productos más rentables?'],
      };
    },
  },

  productosBajoCosto: {
    description: 'Productos cuyo precio de venta quedó por debajo del precio de compra.',
    run: (_args, ctx) => {
      const below = findingsOf(findings(ctx), 'precio-bajo-costo');
      if (below.length === 0) {
        return { text: 'Ningún producto se está vendiendo por debajo de su precio de compra.' };
      }
      return {
        text: `Atención: ${below.length} producto${below.length === 1 ? '' : 's'} se vende${below.length === 1 ? '' : 'n'} por debajo del costo.`,
        bullets: findingBullets(below),
        table: productTable(productsOf(below, ctx), ctx.money, ['compra', 'precio', 'margen']),
        actions: productsOf(below, ctx)[0] ? productActions(productsOf(below, ctx)[0]) : undefined,
      };
    },
  },

  productosSinPrecioCompra: {
    description: 'Productos sin precio de compra, donde no se puede calcular margen.',
    run: (_args, ctx) => {
      const missing = ctx.products.filter((p) => p.purchasePrice <= 0);
      if (missing.length === 0) {
        return { text: 'Todos los productos tienen precio de compra cargado. Podés confiar en los márgenes.' };
      }
      return {
        text: `Hay ${missing.length} producto${missing.length === 1 ? '' : 's'} sin precio de compra. Sin ese dato no puedo calcular margen ni valor real de inventario.`,
        table: productTable(missing.slice(0, 25), ctx.money, ['precio', 'stock', 'categoria']),
        actions: missing[0] ? [productActions(missing[0])[1]] : undefined,
      };
    },
  },

  calcularValorInventario: {
    description: 'Cuánta plata hay invertida en stock y cuánto entraría si se vendiera todo.',
    run: (_args, ctx) => {
      if (ctx.products.length === 0) return EMPTY_INVENTORY;
      const inventoryValue = ctx.products.reduce((s, p) => s + p.purchasePrice * p.stock, 0);
      const potential = ctx.products.reduce((s, p) => s + p.salePrice * p.stock, 0);
      const missing = ctx.products.filter((p) => p.purchasePrice <= 0).length;
      if (inventoryValue === 0) return NO_DATA('el valor del inventario: falta cargar precios de compra');
      return {
        text: `Tenés aproximadamente ${ctx.money(inventoryValue)} invertidos en stock. Si vendieras todo al precio actual entrarían ${ctx.money(potential)}, o sea ${ctx.money(potential - inventoryValue)} de ganancia bruta.`,
        bullets: missing
          ? [`Ojo: ${missing} producto(s) sin precio de compra no están sumando al valor invertido.`]
          : undefined,
        table: productTable(
          [...ctx.products].sort((a, b) => b.inventoryValue - a.inventoryValue).slice(0, 5),
          ctx.money,
          ['stock', 'compra', 'valor'],
          'Los 5 productos con más plata inmovilizada',
        ),
        followUps: ['¿Qué es el valor del inventario?', '¿Qué productos tienen exceso de stock?'],
      };
    },
  },

  calcularGanancia: {
    description: 'Ganancia de un producto por unidad y por todo su stock.',
    params: 'productoId | producto, cantidad (opcional)',
    run: (args, ctx) => {
      const product = resolveProduct(args, ctx);
      if (!product) {
        const potential = ctx.products.reduce((s, p) => s + p.salePrice * p.stock, 0);
        const cost = ctx.products.reduce((s, p) => s + p.purchasePrice * p.stock, 0);
        if (cost === 0) return NO_DATA('la ganancia: falta cargar precios de compra');
        return {
          text: `Si vendieras todo el stock al precio actual, ganarías ${ctx.money(potential - cost)} (entrarían ${ctx.money(potential)} y ya invertiste ${ctx.money(cost)}).`,
          followUps: ['¿Cuáles son mis productos más rentables?'],
        };
      }
      if (product.purchasePrice <= 0) {
        return NO_DATA(`la ganancia de ${product.name}: no tiene precio de compra cargado`);
      }
      const cantidad = num(args.cantidad) ?? product.stock;
      return {
        text: `${product.name} te deja ${ctx.money(product.margin)} por unidad.`,
        bullets: [
          `Compra: ${ctx.money(product.purchasePrice)}`,
          `Venta: ${ctx.money(product.salePrice)}`,
          `Ganancia: ${ctx.money(product.margin)} por unidad (${product.marginPercent.toFixed(0)}%)`,
          cantidad > 0
            ? `Por las ${formatNumber(cantidad)} unidades que tenés: ${ctx.money(product.margin * cantidad)}.`
            : 'No te queda stock de este producto.',
        ],
        actions: productActions(product),
      };
    },
  },

  prioridadReposicion: {
    description: 'Qué reponer primero y cuánto costaría volver al mínimo.',
    run: (_args, ctx) => {
      const restock = getRestockPriority(ctx.products, 12);
      if (restock.length === 0) {
        return { text: 'No hay nada urgente para reponer: todo el inventario está por encima del mínimo.' };
      }
      const investment = restock.reduce((s, p) => s + restockSuggestion(p) * (p.purchasePrice || 0), 0);
      return {
        text: `Te los ordeno por urgencia y, dentro de cada grupo, por lo que más ganancia deja.${investment > 0 ? ` Volver al mínimo cuesta unos ${ctx.money(investment)}.` : ''}`,
        bullets: restock
          .slice(0, 5)
          .map(
            (p) =>
              `${p.name}: quedan ${formatNumber(p.stock)}, el mínimo es ${formatNumber(p.minStock)}, faltan ${formatNumber(restockSuggestion(p))}.`,
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
            costo: p.purchasePrice > 0 ? ctx.money(restockSuggestion(p) * p.purchasePrice) : 'sin dato',
          })),
        },
        actions: [
          { label: 'Ver alertas', icon: 'filtro', effect: { kind: 'navegar', to: '/stock' } },
          {
            label: `Reponer ${restock[0].name.slice(0, 18)}`,
            icon: 'stock',
            effect: { kind: 'editar-stock', productId: restock[0].id },
          },
        ],
      };
    },
  },

  productosParaRevisar: {
    description: 'Todo lo que merece atención, ordenado por importancia y con el motivo.',
    run: (_args, ctx) => {
      const all = findings(ctx);
      const priority = [
        ...findingsOf(all, 'sin-stock'),
        ...findingsOf(all, 'precio-bajo-costo'),
        ...findingsOf(all, 'stock-critico'),
        ...findingsOf(all, 'margen-bajo'),
        ...findingsOf(all, 'sin-movimiento'),
        ...findingsOf(all, 'exceso-stock'),
      ];
      if (priority.length === 0) {
        return {
          text: 'No encontré nada que necesite tu atención ahora: el stock está sobre el mínimo, no hay productos vendiéndose bajo el costo y los márgenes están razonables.',
        };
      }
      const first = ctx.products.find((p) => p.id === priority[0].productId);
      return {
        text: `Encontré ${priority.length} cosa${priority.length === 1 ? '' : 's'} para revisar, ordenadas por importancia:`,
        bullets: findingBullets(priority, 10),
        actions: first ? productActions(first) : undefined,
        followUps: ['¿Qué productos debería reponer primero?', 'Analizar precios'],
      };
    },
  },

  productosSinRotacion: {
    description: 'Productos que hace tiempo no registran movimientos.',
    run: (_args, ctx) => {
      if (ctx.movements.length === 0) {
        return NO_DATA('la rotación: todavía no hay movimientos de stock registrados');
      }
      const stale = findingsOf(findings(ctx), 'sin-movimiento');
      if (stale.length === 0) {
        return { text: `Todos los productos con stock tuvieron movimiento en los últimos ${THRESHOLDS.staleDays} días.` };
      }
      return {
        text: `Estos productos no registran movimientos hace más de ${THRESHOLDS.staleDays} días:`,
        bullets: findingBullets(stale),
        table: productTable(productsOf(stale, ctx).slice(0, 12), ctx.money, ['stock', 'valor', 'categoria']),
        followUps: ['¿Qué es la rotación?'],
      };
    },
  },

  productosExcesoStock: {
    description: 'Productos con mucho más stock del necesario.',
    run: (_args, ctx) => {
      const excess = findingsOf(findings(ctx), 'exceso-stock');
      if (excess.length === 0) {
        return { text: `Ningún producto supera ${THRESHOLDS.excessFactor} veces su stock mínimo, así que no veo exceso.` };
      }
      return {
        text: `Hay ${excess.length} producto${excess.length === 1 ? '' : 's'} con mucho más stock del necesario. Es plata quieta:`,
        bullets: findingBullets(excess),
        table: productTable(productsOf(excess, ctx).slice(0, 12), ctx.money, ['stock', 'minimo', 'valor']),
      };
    },
  },

  analizarPrecios: {
    description: 'Estado general de los precios y los márgenes.',
    run: (_args, ctx) => {
      const withPrice = ctx.products.filter((p) => p.purchasePrice > 0);
      if (withPrice.length === 0) {
        return NO_DATA('los precios: ningún producto tiene precio de compra cargado');
      }
      const all = findings(ctx);
      const avg = withPrice.reduce((s, p) => s + p.marginPercent, 0) / withPrice.length;
      const belowCost = findingsOf(all, 'precio-bajo-costo');
      const lowMargin = findingsOf(all, 'margen-bajo');
      const missing = ctx.products.length - withPrice.length;

      const bullets = [`Margen promedio: ${avg.toFixed(0)}% sobre el costo.`];
      if (missing > 0) bullets.push(`${missing} producto(s) sin precio de compra quedan fuera del análisis.`);
      if (belowCost.length > 0) bullets.push(`${belowCost.length} se venden por debajo del costo: es lo primero a corregir.`);
      if (lowMargin.length > 0) bullets.push(`${lowMargin.length} tienen margen menor al ${THRESHOLDS.lowMarginPercent}%.`);

      return {
        text: 'Este es el estado de tus precios:',
        bullets,
        table: productTable(
          [...withPrice].sort((a, b) => a.marginPercent - b.marginPercent).slice(0, 8),
          ctx.money,
          ['compra', 'precio', 'margen'],
          'Los márgenes más flojos',
        ),
        followUps: ['¿Cuáles son mis productos más rentables?', '¿Qué es margen?'],
      };
    },
  },

  obtenerProveedores: {
    description: 'Proveedores cargados y cuántos productos tiene cada uno.',
    run: (_args, ctx) => {
      if (ctx.suppliers.length === 0) {
        return {
          text: 'Todavía no cargaste proveedores. Podés agregarlos desde la sección Proveedores y después asociarlos a cada producto.',
          actions: [{ label: 'Ir a Proveedores', icon: 'ver', effect: { kind: 'navegar', to: '/proveedores' } }],
        };
      }
      return {
        text: `Tenés ${ctx.suppliers.length} proveedor${ctx.suppliers.length === 1 ? '' : 'es'} cargado${ctx.suppliers.length === 1 ? '' : 's'}:`,
        table: {
          columns: [
            { key: 'proveedor', label: 'Proveedor' },
            { key: 'productos', label: 'Productos', align: 'right' },
            { key: 'reponer', label: 'Por reponer', align: 'right' },
          ],
          rows: ctx.suppliers.map((s) => {
            const items = ctx.products.filter((p) => p.supplierId === s.id);
            return {
              proveedor: s.name,
              productos: items.length,
              reponer: items.filter((p) => p.isLowStock || p.isOutOfStock).length,
            };
          }),
        },
        actions: [{ label: 'Ir a Proveedores', icon: 'ver', effect: { kind: 'navegar', to: '/proveedores' } }],
      };
    },
  },

  historialPrecios: {
    description: 'Últimos cambios de precio registrados.',
    run: (_args, ctx) => {
      if (ctx.priceChanges.length === 0) {
        return NO_DATA('el historial de precios: todavía no registraste ningún cambio');
      }
      return {
        text: `Registraste ${ctx.priceChanges.length} cambio${ctx.priceChanges.length === 1 ? '' : 's'} de precio. Los últimos:`,
        table: {
          columns: [
            { key: 'producto', label: 'Producto' },
            { key: 'anterior', label: 'Antes', align: 'right' },
            { key: 'nuevo', label: 'Ahora', align: 'right' },
            { key: 'variacion', label: 'Variación', align: 'right' },
            { key: 'cuando', label: 'Cuándo' },
          ],
          rows: ctx.priceChanges.slice(0, 10).map((c) => ({
            producto: c.productName,
            anterior: ctx.money(c.previousPrice),
            nuevo: ctx.money(c.newPrice),
            variacion:
              c.previousPrice > 0
                ? `${c.newPrice >= c.previousPrice ? '+' : ''}${(((c.newPrice - c.previousPrice) / c.previousPrice) * 100).toFixed(0)}%`
                : '—',
            cuando: formatRelative(c.date),
          })),
        },
        actions: [{ label: 'Ver historial', icon: 'ver', effect: { kind: 'navegar', to: '/historial' } }],
      };
    },
  },

  /* ---------- Enseñanza ---------- */

  explicarConcepto: {
    description: 'Explica un concepto del negocio en palabras simples, con un ejemplo real.',
    params: 'concepto',
    run: (args, ctx) => {
      const term = str(args.concepto) ?? str(args.termino) ?? '';
      const concept = findConcept(term);
      if (!concept) {
        return {
          text: 'Puedo explicarte margen, markup, stock mínimo, valor del inventario, venta potencial, rotación y los tipos de movimiento. ¿Cuál te interesa?',
          followUps: ['¿Qué es margen?', '¿Qué es el stock mínimo?', '¿Qué es el valor del inventario?'],
        };
      }

      const example = concept.pickExample?.(ctx.products);
      return {
        text: `${concept.body}`,
        bullets: example && concept.example ? concept.example(example, ctx.money) : undefined,
        followUps: ['Analizá mi inventario', 'Enseñame a usar la aplicación'],
      };
    },
  },

  quePuedoHacer: {
    description: 'Sugiere qué hacer según la pantalla en la que está el usuario.',
    run: (_args, ctx) => {
      const low = ctx.products.filter((p) => p.isLowStock).length;
      const out = ctx.products.filter((p) => p.isOutOfStock).length;
      return {
        text: `${describeScreen(ctx.ui, { lowStockCount: low, outOfStockCount: out, productCount: ctx.products.length })} Puedo ayudarte con esto:`,
        actions: getScreenSuggestions(ctx.ui),
      };
    },
  },

  iniciarTutorial: {
    description: 'Arranca una lección guiada dentro de la aplicación.',
    params: 'leccion (opcional)',
    run: (args, _ctx) => {
      const lessonId = str(args.leccion) ?? str(args.lessonId);
      return {
        text: lessonId
          ? 'Dale, te la muestro paso a paso. Voy a ir resaltando cada parte de la pantalla.'
          : 'Tengo seis lecciones cortas. Elegí por dónde empezar y te voy mostrando sobre la aplicación real.',
        effect: lessonId ? { kind: 'tutorial', lessonId } : undefined,
        actions: lessonId
          ? undefined
          : [
              { label: 'Agregar un producto', icon: 'tutorial', effect: { kind: 'tutorial', lessonId: 'agregar-producto' } },
              { label: 'Cambiar un precio', icon: 'tutorial', effect: { kind: 'tutorial', lessonId: 'cambiar-precio' } },
              { label: 'Actualizar stock', icon: 'tutorial', effect: { kind: 'tutorial', lessonId: 'actualizar-stock' } },
              { label: 'Ver todas las lecciones', icon: 'tutorial', effect: { kind: 'tutorial', lessonId: 'indice' } },
            ],
      };
    },
  },

  navegarASeccion: {
    description: 'Lleva al usuario a una sección de la aplicación.',
    params: 'seccion (inicio|productos|stock|categorias|proveedores|historial|configuracion)',
    run: (args, _ctx) => {
      const routes: Record<string, string> = {
        inicio: '/',
        panel: '/',
        productos: '/productos',
        stock: '/stock',
        alertas: '/stock',
        categorias: '/categorias',
        proveedores: '/proveedores',
        historial: '/historial',
        configuracion: '/configuracion',
      };
      const seccion = normalizeText(str(args.seccion) ?? '');
      const to = routes[seccion];
      if (!to) return { text: 'No reconozco esa sección de la aplicación.' };
      return { text: `Te llevo a ${seccion}.`, effect: { kind: 'navegar', to } };
    },
  },

  abrirProducto: {
    description: 'Abre la ficha de un producto.',
    params: 'productoId | producto',
    run: (args, ctx) => {
      const product = resolveProduct(args, ctx);
      if (!product) return { text: 'No encontré ese producto en el inventario.' };
      return {
        text: `Te abro la ficha de ${product.name}.`,
        effect: { kind: 'abrir-producto', productId: product.id },
      };
    },
  },

  resaltarElemento: {
    description: 'Resalta un elemento de la pantalla para mostrar dónde está.',
    params: 'objetivo, titulo, explicacion',
    run: (args, _ctx) => {
      const target = str(args.objetivo) ?? str(args.target);
      if (!target) return { text: 'No sé qué elemento resaltar.' };
      return {
        text: 'Mirá acá.',
        effect: {
          kind: 'resaltar',
          target,
          title: str(args.titulo) ?? 'Acá está',
          body: str(args.explicacion) ?? '',
        },
      };
    },
  },

  /* ---------- Escritura (siempre con vista previa y confirmación) ---------- */

  ajustarPreciosMasivo: {
    description: 'Propone cambiar el precio de varios productos. Requiere confirmación del usuario.',
    params: 'modo (percent|monto|fijar), valor, categoria (opcional)',
    run: (args, ctx) => {
      const mode = (str(args.modo) ?? 'percent') as 'percent' | 'monto' | 'fijar';
      const value = num(args.valor);
      if (value === undefined) return { text: 'Decime en cuánto querés ajustar los precios.' };

      const categoryName = str(args.categoria);
      const category = categoryName
        ? ctx.categories.find((c) => normalizeText(c.name) === normalizeText(categoryName))
        : undefined;
      if (categoryName && !category) {
        return { text: `No encontré la categoría “${categoryName}”.` };
      }

      const scope = category
        ? ({ kind: 'categoria', categoryId: category.id, categoryName: category.name } as const)
        : ({ kind: 'todos' } as const);
      const affected = category
        ? ctx.products.filter((p) => p.categoryId === category.id)
        : ctx.products;

      if (affected.length === 0) {
        return { text: `No encontré productos${category ? ` en ${category.name}` : ''} para ajustar.` };
      }

      return {
        text: `Encontré ${affected.length} producto${affected.length === 1 ? '' : 's'}${category ? ` en ${category.name}` : ' en todo el inventario'}. Revisá la vista previa antes de aplicar: podés cancelar sin que se toque nada.`,
        action: { type: 'precio-masivo', mode, value, round: 10, scope },
      };
    },
  },

  cambiarPrecioProducto: {
    description: 'Propone un precio nuevo para un producto. Requiere confirmación del usuario.',
    params: 'productoId | producto, precio',
    run: (args, ctx) => {
      const product = resolveProduct(args, ctx);
      if (!product) return { text: 'No encontré ese producto en el inventario.' };
      const precio = num(args.precio) ?? num(args.valor);
      if (precio === undefined || precio < 0) {
        return {
          text: `${product.name} está hoy a ${ctx.money(product.salePrice)}. Decime a cuánto lo querés dejar y te muestro la vista previa.`,
          actions: [
            { label: 'Abrir el editor de precio', icon: 'precio', effect: { kind: 'editar-precio', productId: product.id } },
          ],
        };
      }
      return {
        text: `${product.name} pasaría de ${ctx.money(product.salePrice)} a ${ctx.money(precio)}.`,
        action: {
          type: 'precio-masivo',
          mode: 'fijar',
          value: precio,
          round: 0,
          scope: { kind: 'productos', productIds: [product.id] },
        },
      };
    },
  },

  cambiarStockProducto: {
    description: 'Propone ajustar el stock de un producto. Requiere confirmación del usuario.',
    params: 'productoId | producto, cantidad, modo (fijar|sumar|restar)',
    run: (args, ctx) => {
      const product = resolveProduct(args, ctx);
      if (!product) return { text: 'No encontré ese producto en el inventario.' };
      const cantidad = num(args.cantidad) ?? num(args.valor);
      const mode = (str(args.modo) ?? 'fijar') as 'fijar' | 'sumar' | 'restar';
      if (cantidad === undefined || cantidad < 0) {
        return {
          text: `${product.name} tiene ${formatNumber(product.stock)} unidades. Decime cuántas querés cargar y te muestro la vista previa.`,
          actions: [
            { label: 'Abrir el editor de stock', icon: 'stock', effect: { kind: 'editar-stock', productId: product.id } },
          ],
        };
      }
      return {
        text: `Vamos a ajustar el stock de ${product.name}.`,
        action: { type: 'stock-producto', productId: product.id, mode, value: cantidad },
      };
    },
  },
} satisfies Record<string, CopilotTool>;

export type ToolName = Extract<keyof typeof TOOLS, string>;

export function isToolName(name: string): name is ToolName {
  return Object.prototype.hasOwnProperty.call(TOOLS, name);
}

/** Ejecuta una herramienta y devuelve la respuesta lista para mostrar. */
export function runTool(name: ToolName, args: ToolArgs, ctx: ToolContext): CopilotReply {
  const result = TOOLS[name].run(args, ctx);
  return { ...result, source: 'local', tool: name };
}

/** Catálogo para el prompt del modelo y para documentación. */
export function describeTools(): Array<{ name: string; description: string; params?: string }> {
  return (Object.entries(TOOLS) as Array<[string, CopilotTool]>).map(([name, tool]) => ({
    name,
    description: tool.description,
    params: tool.params,
  }));
}

export type { CopilotUiAction };
