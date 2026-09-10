import type { ProductView, StockMovement } from '@/types';
import { formatNumber } from '@/utils/format';
import { buildLastMovementMap } from './inventoryContext';
import type { CopilotFinding, FindingKind, Severity } from './types';

/* ------------------------------------------------------------------ */
/* Umbrales del análisis                                               */
/* ------------------------------------------------------------------ */

export const THRESHOLDS = {
  /** Por debajo de este % del mínimo, el stock es crítico y no sólo bajo. */
  criticalRatio: 0.5,
  /** Stock que supera el mínimo por este factor se considera exceso. */
  excessFactor: 6,
  /** Días sin movimiento para considerar un producto "sin rotación". */
  staleDays: 30,
  /** Margen por debajo de este % se considera bajo. */
  lowMarginPercent: 20,
  /** Margen por encima de este % se destaca como muy rentable. */
  highMarginPercent: 80,
} as const;

interface AnalyzeOptions {
  movements: StockMovement[];
  moneyFormatter: (value: number) => string;
}

/**
 * Detecta todo lo que merece atención y explica el motivo de cada hallazgo.
 * Es una función pura: mismo inventario, mismos resultados.
 */
export function analyzeInventory(
  products: ProductView[],
  { movements, moneyFormatter }: AnalyzeOptions,
): CopilotFinding[] {
  const lastMovement = buildLastMovementMap(movements);
  const findings: CopilotFinding[] = [];

  const push = (
    kind: FindingKind,
    severity: Severity,
    product: ProductView,
    reason: string,
    score: number,
  ) => {
    findings.push({ kind, severity, productId: product.id, productName: product.name, reason, score });
  };

  for (const product of products) {
    const stock = formatNumber(product.stock);
    const min = formatNumber(product.minStock);

    /* ---------------- Stock ---------------- */
    if (product.stock <= 0) {
      push(
        'sin-stock',
        'alta',
        product,
        `Está agotado: quedan 0 unidades y el mínimo configurado es ${min}.`,
        0,
      );
    } else if (product.minStock > 0 && product.stock <= product.minStock * THRESHOLDS.criticalRatio) {
      push(
        'stock-critico',
        'alta',
        product,
        `Quedan ${stock} unidades, menos de la mitad del mínimo configurado (${min}).`,
        product.stock - product.minStock,
      );
    } else if (product.stock <= product.minStock) {
      push(
        'stock-bajo',
        'media',
        product,
        `Quedan ${stock} unidades y el stock mínimo configurado es ${min}.`,
        product.stock - product.minStock,
      );
    } else if (product.minStock > 0 && product.stock >= product.minStock * THRESHOLDS.excessFactor) {
      push(
        'exceso-stock',
        'baja',
        product,
        `Tenés ${stock} unidades, ${Math.round(product.stock / product.minStock)} veces el mínimo (${min}). Hay ${moneyFormatter(product.inventoryValue)} inmovilizados acá.`,
        -product.inventoryValue,
      );
    }

    /* ---------------- Rotación ---------------- */
    const days = lastMovement.get(product.id);
    if (product.stock > 0 && movements.length > 0) {
      if (days === undefined) {
        push(
          'sin-movimiento',
          'baja',
          product,
          `Nunca registró un movimiento de stock y tiene ${stock} unidades en góndola.`,
          -product.inventoryValue,
        );
      } else if (days >= THRESHOLDS.staleDays) {
        push(
          'sin-movimiento',
          'baja',
          product,
          `Hace ${days} días que no registra movimientos y tiene ${stock} unidades.`,
          -days,
        );
      }
    }

    /* ---------------- Precios ---------------- */
    if (product.purchasePrice <= 0) {
      push(
        'sin-precio-compra',
        'media',
        product,
        'No tiene precio de compra cargado, así que no se puede calcular su margen ni su valor real de inventario.',
        0,
      );
    } else if (product.salePrice < product.purchasePrice) {
      push(
        'precio-bajo-costo',
        'alta',
        product,
        `Se vende a ${moneyFormatter(product.salePrice)} pero cuesta ${moneyFormatter(product.purchasePrice)}: estás perdiendo ${moneyFormatter(product.purchasePrice - product.salePrice)} por unidad.`,
        product.marginPercent,
      );
    } else if (product.marginPercent < THRESHOLDS.lowMarginPercent) {
      push(
        'margen-bajo',
        'media',
        product,
        `Deja ${moneyFormatter(product.margin)} por unidad (${product.marginPercent.toFixed(0)}% sobre el costo), por debajo del ${THRESHOLDS.lowMarginPercent}% de referencia.`,
        product.marginPercent,
      );
    } else if (product.marginPercent >= THRESHOLDS.highMarginPercent) {
      push(
        'margen-alto',
        'baja',
        product,
        `Deja ${moneyFormatter(product.margin)} por unidad (${product.marginPercent.toFixed(0)}% sobre el costo).`,
        -product.marginPercent,
      );
    }
  }

  return findings;
}

export function findingsOf(findings: CopilotFinding[], ...kinds: FindingKind[]): CopilotFinding[] {
  return findings.filter((f) => kinds.includes(f.kind)).sort((a, b) => a.score - b.score);
}

/**
 * Prioridad de reposición: combina urgencia de stock con el dinero que el
 * producto genera por unidad. Primero lo agotado, después lo crítico, y dentro
 * de cada grupo lo que más margen deja.
 */
export function getRestockPriority(products: ProductView[], limit = 10): ProductView[] {
  const urgency = (p: ProductView): number => {
    if (p.stock <= 0) return 0;
    if (p.minStock > 0 && p.stock <= p.minStock * THRESHOLDS.criticalRatio) return 1;
    if (p.stock <= p.minStock) return 2;
    return 3;
  };

  return products
    .filter((p) => urgency(p) < 3)
    .sort((a, b) => {
      const diff = urgency(a) - urgency(b);
      if (diff !== 0) return diff;
      return b.margin - a.margin;
    })
    .slice(0, limit);
}

/** Cuánto falta comprar de cada producto para volver al mínimo. */
export function restockSuggestion(product: ProductView): number {
  return Math.max(0, Math.ceil(product.minStock - product.stock));
}

/* ------------------------------------------------------------------ */
/* Tarjetas del dashboard                                              */
/* ------------------------------------------------------------------ */

export type InsightTone = 'critico' | 'atencion' | 'positivo' | 'neutral';

export interface InsightCard {
  id: string;
  icon: 'alert' | 'flame' | 'money' | 'trending-down' | 'package';
  tone: InsightTone;
  title: string;
  value: string;
  description: string;
  /** Pregunta que se le manda al Copilot al tocar la tarjeta. */
  prompt: string;
}

interface BuildInsightsArgs {
  products: ProductView[];
  findings: CopilotFinding[];
  moneyFormatter: (value: number) => string;
}

/**
 * Devuelve sólo las tarjetas que tienen algo que decir. Si el inventario está
 * sano, la sección muestra menos tarjetas en lugar de llenarse de ruido.
 */
export function buildInsightCards({
  products,
  findings,
  moneyFormatter,
}: BuildInsightsArgs): InsightCard[] {
  const cards: InsightCard[] = [];

  const outOfStock = findingsOf(findings, 'sin-stock');
  const critical = findingsOf(findings, 'stock-critico');
  const belowCost = findingsOf(findings, 'precio-bajo-costo');
  const lowMargin = findingsOf(findings, 'margen-bajo');
  const highMargin = findingsOf(findings, 'margen-alto');
  const noPurchasePrice = findingsOf(findings, 'sin-precio-compra');
  const stale = findingsOf(findings, 'sin-movimiento');
  const excess = findingsOf(findings, 'exceso-stock');

  if (outOfStock.length + critical.length > 0) {
    const total = outOfStock.length + critical.length;
    cards.push({
      id: 'stock-critico',
      icon: 'alert',
      tone: 'critico',
      title: 'Stock crítico',
      value: `${total} producto${total === 1 ? '' : 's'}`,
      description:
        outOfStock.length > 0
          ? `${outOfStock.length} agotado${outOfStock.length === 1 ? '' : 's'}${critical.length > 0 ? ` y ${critical.length} por debajo de la mitad del mínimo` : ''}.`
          : `${critical.length} por debajo de la mitad del mínimo configurado.`,
      prompt: '¿Qué productos están en stock crítico?',
    });
  }

  if (belowCost.length > 0) {
    cards.push({
      id: 'precio-bajo-costo',
      icon: 'trending-down',
      tone: 'critico',
      title: 'Se venden bajo el costo',
      value: `${belowCost.length} producto${belowCost.length === 1 ? '' : 's'}`,
      description: 'El precio de venta está por debajo del precio de compra: cada venta pierde plata.',
      prompt: '¿Qué productos se están vendiendo por debajo del costo?',
    });
  }

  const restock = getRestockPriority(products, 50);
  if (restock.length > 0) {
    const investment = restock.reduce(
      (sum, p) => sum + restockSuggestion(p) * (p.purchasePrice || 0),
      0,
    );
    cards.push({
      id: 'reponer',
      icon: 'package',
      tone: 'atencion',
      title: 'Productos por reponer',
      value: `${restock.length} producto${restock.length === 1 ? '' : 's'}`,
      description:
        investment > 0
          ? `Volver al mínimo cuesta unos ${moneyFormatter(investment)} a precio de compra.`
          : 'Cargá precios de compra para estimar cuánto cuesta reponerlos.',
      prompt: '¿Qué productos debería reponer primero?',
    });
  }

  if (lowMargin.length > 0 || noPurchasePrice.length > 0) {
    const value = lowMargin.length > 0 ? lowMargin.length : noPurchasePrice.length;
    cards.push({
      id: 'margen-bajo',
      icon: 'trending-down',
      tone: 'atencion',
      title: lowMargin.length > 0 ? 'Márgenes bajos' : 'Sin precio de compra',
      value: `${value} producto${value === 1 ? '' : 's'}`,
      description:
        lowMargin.length > 0
          ? `Dejan menos del ${THRESHOLDS.lowMarginPercent}% sobre el costo.`
          : 'Sin ese dato no se puede saber cuánto ganás con ellos.',
      prompt:
        lowMargin.length > 0
          ? '¿Qué productos tienen margen menor al 20%?'
          : '¿Qué productos no tienen precio de compra?',
    });
  }

  const withPurchasePrice = products.filter((p) => p.purchasePrice > 0);
  if (highMargin.length > 0 && withPurchasePrice.length > 0) {
    const best = [...withPurchasePrice].sort((a, b) => b.marginPercent - a.marginPercent)[0];
    const average =
      withPurchasePrice.reduce((sum, p) => sum + p.marginPercent, 0) / withPurchasePrice.length;
    cards.push({
      id: 'mayor-margen',
      icon: 'money',
      tone: 'positivo',
      title: 'Mayor margen',
      value: `${best.marginPercent.toFixed(0)}%`,
      description: `${best.name} deja ${moneyFormatter(best.margin)} por unidad. El margen promedio del inventario es ${average.toFixed(0)}%.`,
      prompt: '¿Cuáles son mis productos más rentables?',
    });
  }

  if (stale.length > 0 || excess.length > 0) {
    const total = stale.length + excess.length;
    cards.push({
      id: 'revisar',
      icon: 'flame',
      tone: 'neutral',
      title: 'Productos para revisar',
      value: `${total} producto${total === 1 ? '' : 's'}`,
      description:
        stale.length > 0
          ? `${stale.length} sin movimientos registrados en los últimos ${THRESHOLDS.staleDays} días${excess.length > 0 ? ` y ${excess.length} con exceso de stock` : ''}.`
          : `${excess.length} con mucho más stock del necesario.`,
      prompt: '¿Qué productos debería revisar?',
    });
  }

  return cards.slice(0, 5);
}
