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
  /** 'demostracion' avisa al modelo que los datos son ficticios y aislados. */
  modo: 'real' | 'demostracion';
  /** Dónde está parado el usuario ahora mismo. */
  pantallaActual?: {
    seccion: string;
    productoAbierto: { id: string; nombre: string } | null;
    busqueda: string | null;
    filtroStock: string | null;
  };
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
    }
  | {
      /** Ajuste de stock de un producto puntual. */
      type: 'stock-producto';
      productId: string;
      mode: 'fijar' | 'sumar' | 'restar';
      value: number;
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

/* ------------------------------------------------------------------ */
/* Efectos de interfaz que el Copiloto puede disparar                   */
/* ------------------------------------------------------------------ */

/**
 * Un efecto NO modifica datos: mueve la interfaz. Sirve para que el Copiloto
 * pueda enseñar y acompañar (abrir una ficha, navegar, resaltar, arrancar una
 * lección) sin tocar el inventario.
 */
export type CopilotEffect =
  | { kind: 'navegar'; to: string }
  | { kind: 'abrir-producto'; productId: string }
  | { kind: 'editar-precio'; productId: string }
  | { kind: 'editar-stock'; productId: string }
  | { kind: 'nuevo-producto' }
  | { kind: 'tutorial'; lessonId: string }
  | { kind: 'resaltar'; target: string; title: string; body: string };

/** Botón que acompaña una respuesta. O pregunta algo, o dispara un efecto. */
export interface CopilotUiAction {
  label: string;
  icon?: 'ver' | 'precio' | 'stock' | 'tutorial' | 'filtro' | 'analizar' | 'agregar' | 'buscar';
  question?: string;
  effect?: CopilotEffect;
}

export interface CopilotReply {
  text: string;
  bullets?: string[];
  table?: CopilotTable;
  /** Operación sobre datos: pasa por vista previa y confirmación. */
  action?: CopilotAction;
  /** Botones de acción que acompañan la respuesta. */
  actions?: CopilotUiAction[];
  /** Efecto de interfaz que se dispara junto con la respuesta. */
  effect?: CopilotEffect;
  followUps?: string[];
  /** De dónde salió la respuesta: análisis local o modelo de IA. */
  source: 'local' | 'ia';
  /** Aviso mostrado en la burbuja (por ejemplo, caída del backend). */
  notice?: string;
  /** Nombre de la herramienta que resolvió la consulta (para depurar y auditar). */
  tool?: string;
}

/* ------------------------------------------------------------------ */
/* Contexto de la pantalla actual                                      */
/* ------------------------------------------------------------------ */

export type ScreenId =
  | 'inicio'
  | 'productos'
  | 'stock'
  | 'categorias'
  | 'proveedores'
  | 'historial'
  | 'configuracion'
  | 'otra';

/** Lo que el Copiloto "ve" de la aplicación en este momento. */
export interface CopilotUiContext {
  screen: ScreenId;
  screenLabel: string;
  demoMode: boolean;
  /** Producto abierto en la ficha de detalle, si hay uno. */
  selectedProductId?: string;
  /** Texto escrito en el buscador de la pantalla actual. */
  search?: string;
  /** Filtros activos en Productos. */
  categoryFilterId?: string;
  stockFilter?: string;
  /** Pestaña activa en Stock. */
  tab?: string;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'copilot';
  createdAt: string;
  content: string;
  bullets?: string[];
  table?: CopilotTable;
  preview?: ActionPreview;
  actions?: CopilotUiAction[];
  followUps?: string[];
  source?: 'local' | 'ia';
  notice?: string;
  /** Estado de la acción propuesta en este mensaje. */
  actionState?: 'pendiente' | 'aplicada' | 'cancelada';
}
