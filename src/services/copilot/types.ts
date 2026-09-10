import type { CurrencyCode } from '@/types';

/* ------------------------------------------------------------------ */
/* Contexto de inventario                                              */
/* ------------------------------------------------------------------ */

/**
 * Versión recortada de un producto: sólo lo que el Copilot necesita para
 * razonar. No se envían descripciones, imágenes ni fechas de creación.
 */
export interface ContextProduct {
  id: string;
  nombre: string;
  categoria: string;
  proveedor: string | null;
  stock: number;
  stockMinimo: number;
  precioCompra: number | null;
  precioVenta: number;
  margen: number | null;
  margenPorcentaje: number | null;
  unidad: string;
  /** Días desde el último movimiento registrado. `null` si nunca tuvo. */
  diasSinMovimiento: number | null;
  ultimoCambioPrecio: { anterior: number; nuevo: number; fecha: string } | null;
}

export interface ContextCategory {
  id: string;
  nombre: string;
  productos: number;
  valorInventario: number;
}

export interface InventoryContext {
  negocio: { nombre: string; moneda: CurrencyCode };
  generadoEl: string;
  totales: {
    productos: number;
    categorias: number;
    proveedores: number;
    valorInventario: number;
    ventaPotencial: number;
    stockBajo: number;
    sinStock: number;
    sinPrecioCompra: number;
    movimientosRegistrados: number;
  };
  categorias: ContextCategory[];
  productos: ContextProduct[];
  /** true si la lista de productos se recortó por tamaño. */
  productosRecortados: boolean;
  cambiosPrecioRecientes: Array<{ producto: string; anterior: number; nuevo: number; fecha: string }>;
  /** Datos que NO existen, para que el Copilot no los invente. */
  vaciosDeDatos: string[];
}

/* ------------------------------------------------------------------ */
/* Hallazgos (análisis local)                                          */
/* ------------------------------------------------------------------ */

export type FindingKind =
  | 'sin-stock'
  | 'stock-critico'
  | 'stock-bajo'
  | 'exceso-stock'
  | 'sin-movimiento'
  | 'sin-precio-compra'
  | 'precio-bajo-costo'
  | 'margen-bajo'
  | 'margen-alto';

export type Severity = 'alta' | 'media' | 'baja';

export interface CopilotFinding {
  kind: FindingKind;
  severity: Severity;
  productId: string;
  productName: string;
  /** Explicación en palabras del negocio: por qué aparece este producto. */
  reason: string;
  /** Valor numérico que ordena la lista (menor = más urgente, según kind). */
  score: number;
}

/* ------------------------------------------------------------------ */
/* Acciones propuestas                                                 */
/* ------------------------------------------------------------------ */

export type ActionScope =
  | { kind: 'categoria'; categoryId: string; categoryName: string }
  | { kind: 'productos'; productIds: string[] }
  | { kind: 'todos' };

export type CopilotAction =
  | {
      type: 'precio-masivo';
      /** percent: ±% · monto: suma/resta fija · fijar: mismo precio para todos */
      mode: 'percent' | 'monto' | 'fijar';
      value: number;
      scope: ActionScope;
      /** Redondeo del resultado (10 = a la decena). 0 = sin redondeo. */
      round: number;
    }
  | {
      type: 'stock-minimo-masivo';
      value: number;
      scope: ActionScope;
    };

export interface ActionPreviewItem {
  id: string;
  name: string;
  before: number;
  after: number;
  delta: number;
}

export interface ActionPreview {
  action: CopilotAction;
  title: string;
  description: string;
  items: ActionPreviewItem[];
  count: number;
  /** Sólo para precio-masivo: impacto sobre la venta potencial del inventario. */
  totalBefore: number;
  totalAfter: number;
  warnings: string[];
  /** Si es false, la acción no se puede ejecutar (sin productos afectados, etc.). */
  executable: boolean;
}

/* ------------------------------------------------------------------ */
/* Respuestas                                                          */
/* ------------------------------------------------------------------ */

export interface CopilotTable {
  columns: Array<{ key: string; label: string; align?: 'left' | 'right' }>;
  rows: Array<Record<string, string | number>>;
  caption?: string;
}

export interface CopilotReply {
  text: string;
  bullets?: string[];
  table?: CopilotTable;
  action?: CopilotAction;
  followUps?: string[];
  /** De dónde salió la respuesta: análisis local o modelo de IA. */
  source: 'local' | 'ia';
  /** Aviso mostrado en la burbuja (por ejemplo, caída del backend). */
  notice?: string;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'copilot';
  createdAt: string;
  content: string;
  bullets?: string[];
  table?: CopilotTable;
  preview?: ActionPreview;
  followUps?: string[];
  source?: 'local' | 'ia';
  notice?: string;
  /** Estado de la acción propuesta en este mensaje. */
  actionState?: 'pendiente' | 'aplicada' | 'cancelada';
}
