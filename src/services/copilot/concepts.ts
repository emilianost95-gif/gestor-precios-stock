import type { ProductView } from '@/types';
import { normalizeText } from '@/utils/format';

/**
 * Glosario en palabras de almacén, sin jerga.
 * Cuando existe un producto real que sirva de ejemplo, la explicación lo usa
 * en lugar de números inventados.
 */
export interface Concept {
  id: string;
  /** Palabras que activan la explicación. */
  keywords: string[];
  title: string;
  body: string;
  /** Ejemplo armado con un producto real del inventario. */
  example?: (product: ProductView, money: (v: number) => string) => string[];
  /** Elige el producto que mejor ilustra el concepto. */
  pickExample?: (products: ProductView[]) => ProductView | undefined;
}

export const CONCEPTS: Concept[] = [
  {
    id: 'margen',
    keywords: ['margen', 'ganancia', 'cuanto gano', 'rentabilidad', 'utilidad'],
    title: '¿Qué es el margen?',
    body: 'El margen es cuánta plata te queda de cada venta después de descontar lo que pagaste por el producto.',
    pickExample: (products) =>
      products.filter((p) => p.purchasePrice > 0 && p.margin > 0).sort((a, b) => b.margin - a.margin)[0],
    example: (p, money) => [
      `${p.name}`,
      `Lo comprás a ${money(p.purchasePrice)}`,
      `Lo vendés a ${money(p.salePrice)}`,
      `Te quedan ${money(p.margin)} por unidad, o sea un ${p.marginPercent.toFixed(0)}% sobre lo que pagaste.`,
    ],
  },
  {
    id: 'markup',
    keywords: ['markup', 'marcacion', 'recargo', 'cuanto recargo'],
    title: '¿Qué es el markup?',
    body: 'Es el porcentaje que le sumás al precio de compra para llegar al precio de venta. Es la otra forma de mirar el margen: el margen mira la ganancia, el markup mira el recargo.',
    pickExample: (products) => products.find((p) => p.purchasePrice > 0 && p.salePrice > p.purchasePrice),
    example: (p, money) => [
      `${p.name}: de ${money(p.purchasePrice)} a ${money(p.salePrice)}`,
      `Le estás aplicando un recargo del ${p.marginPercent.toFixed(0)}%.`,
    ],
  },
  {
    id: 'stock-minimo',
    keywords: ['stock minimo', 'minimo', 'punto de reposicion', 'para que sirve el minimo'],
    title: '¿Qué es el stock mínimo?',
    body: 'Es el número que vos elegís como señal de alarma. Cuando el stock de un producto baja hasta ahí, la aplicación te avisa que es momento de reponer, antes de quedarte sin nada para vender.',
    pickExample: (products) => products.find((p) => p.isLowStock) ?? products.find((p) => p.minStock > 0),
    example: (p) => [
      `${p.name} tiene ${p.stock} unidades y su mínimo está en ${p.minStock}.`,
      p.isLowStock || p.isOutOfStock
        ? 'Por eso aparece en las alertas.'
        : 'Todavía está por encima, así que no aparece en las alertas.',
    ],
  },
  {
    id: 'valor-inventario',
    keywords: ['valor del inventario', 'valor de inventario', 'cuanto vale mi stock', 'capital inmovilizado'],
    title: '¿Qué es el valor del inventario?',
    body: 'Es la plata que tenés metida en mercadería: se calcula multiplicando lo que te costó cada producto por las unidades que te quedan. No es lo que vas a ganar, es lo que ya invertiste.',
  },
  {
    id: 'venta-potencial',
    keywords: ['venta potencial', 'cuanto ganaria si vendo todo', 'si vendo todo'],
    title: '¿Qué es la venta potencial?',
    body: 'Es cuánta plata entraría si vendieras hoy todo lo que tenés en góndola al precio actual. La diferencia con el valor del inventario es tu ganancia bruta.',
  },
  {
    id: 'rotacion',
    keywords: ['rotacion', 'no se vende', 'sin movimiento', 'producto parado'],
    title: '¿Qué es la rotación?',
    body: 'Es qué tan seguido se mueve un producto. Si hace semanas que no registra ni una entrada ni una venta, tenés plata quieta en un producto que no está trabajando.',
  },
  {
    id: 'movimientos',
    keywords: ['tipos de movimiento', 'entrada', 'ajuste', 'devolucion', 'que es un movimiento'],
    title: 'Los tipos de movimiento',
    body: 'Entrada: llegó mercadería del proveedor. Venta: salió por caja. Ajuste: corregís el número porque el conteo físico no coincidía. Devolución: un cliente trajo algo de vuelta y vuelve al stock.',
  },
];

export function findConcept(question: string): Concept | undefined {
  const q = normalizeText(question);
  return CONCEPTS.find((concept) => concept.keywords.some((k) => q.includes(k)));
}
