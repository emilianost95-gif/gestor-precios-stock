/**
 * Lecciones del Copiloto: guías cortas que se muestran SOBRE la aplicación
 * real, resaltando el elemento del que se está hablando.
 *
 * Cada paso apunta a un atributo `data-tour` que existe en la interfaz. Si el
 * elemento no está en pantalla, el paso se muestra igual como explicación
 * centrada, así una lección nunca se rompe.
 */

export type LessonId =
  | 'recorrido'
  | 'agregar-producto'
  | 'cambiar-precio'
  | 'actualizar-stock'
  | 'entender-alertas'
  | 'interpretar-ganancias'
  | 'analizar-inventario'
  | 'buscar-producto';

export interface TourStep {
  /** Valor de `data-tour` del elemento a resaltar. Sin target, paso centrado. */
  target?: string;
  title: string;
  body: string;
  /** Ruta a la que hay que ir antes de mostrar el paso. */
  route?: string;
  /** Efecto opcional al entrar al paso. */
  open?: 'primer-producto' | 'editor-precio' | 'editor-stock' | 'nuevo-producto';
  /** Texto del botón que avanza. Por defecto "Siguiente". */
  nextLabel?: string;
}

export interface Lesson {
  id: LessonId;
  title: string;
  summary: string;
  /** Emoji corto para la lista de lecciones. */
  emoji: string;
  /** Las que cuentan para el progreso "N de 6". */
  core: boolean;
  steps: TourStep[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'agregar-producto',
    title: 'Agregar un producto',
    summary: 'Cómo cargar algo nuevo en el inventario.',
    emoji: '➕',
    core: true,
    steps: [
      {
        route: '/productos',
        target: 'nuevo-producto',
        title: 'Todo empieza acá',
        body: 'Este botón abre el formulario para cargar un producto nuevo. En el celular es el botón azul grande de la barra de abajo.',
      },
      {
        title: 'Sólo dos datos son obligatorios',
        body: 'El nombre y el precio de venta. Todo lo demás (código de barras, categoría, proveedor, foto) lo podés completar después o nunca.',
      },
      {
        title: 'Cargá el precio de compra',
        body: 'No es obligatorio, pero es el dato que le permite al sistema calcular cuánto ganás con cada venta. Sin él, no hay margen.',
      },
      {
        title: 'Y el stock mínimo',
        body: 'Es tu alarma: cuando las unidades bajen hasta ese número, el producto va a aparecer en las alertas para que lo repongas antes de quedarte sin nada.',
        nextLabel: 'Entendido',
      },
    ],
  },
  {
    id: 'cambiar-precio',
    title: 'Cambiar un precio',
    summary: 'La operación más frecuente, en tres toques.',
    emoji: '💰',
    core: true,
    steps: [
      {
        route: '/productos',
        target: 'fila-producto',
        title: 'Cada fila es un producto',
        body: 'Mirá bien: el precio y el stock no son sólo texto, son botones que abren su editor.',
      },
      {
        target: 'precio-producto',
        title: 'Tocá el precio',
        body: 'Con un solo toque sobre el precio se abre el editor. No hace falta entrar a la ficha completa del producto.',
        open: 'editor-precio',
        nextLabel: 'Ver el editor',
      },
      {
        target: 'editor-precio',
        title: 'Escribí el precio nuevo',
        body: 'El campo ya viene seleccionado, así que escribís el número directo. También tenés botones de ajuste rápido (+5%, +10%) y podés ver el historial de cambios de ese producto.',
      },
      {
        title: 'Guardá y listo',
        body: 'Al guardar, el sistema te confirma el cambio mostrando el precio anterior y el nuevo, y lo registra en el historial por si después querés revisarlo.',
        nextLabel: 'Entendido',
      },
    ],
  },
  {
    id: 'actualizar-stock',
    title: 'Actualizar el stock',
    summary: 'Cargar mercadería, descontar ventas y corregir el conteo.',
    emoji: '📦',
    core: true,
    steps: [
      {
        route: '/productos',
        target: 'stock-producto',
        title: 'Tocá el stock',
        body: 'Igual que con el precio, el número de stock abre su propio editor.',
        open: 'editor-stock',
        nextLabel: 'Ver el editor',
      },
      {
        target: 'editor-stock',
        title: 'Tres formas de moverlo',
        body: 'Agregar (llegó mercadería), Descontar (se vendió) o Fijar (corregís el número porque contaste y no coincidía). Antes de confirmar te muestra cómo queda.',
      },
      {
        title: 'Todo movimiento queda registrado',
        body: 'Cada operación guarda el producto, el tipo, la cantidad, el stock anterior y el resultante. Así siempre podés reconstruir qué pasó.',
        nextLabel: 'Entendido',
      },
    ],
  },
  {
    id: 'entender-alertas',
    title: 'Entender las alertas',
    summary: 'Qué te está avisando el sistema y por qué.',
    emoji: '⚠️',
    core: true,
    steps: [
      {
        route: '/stock',
        target: 'alertas-stock',
        title: 'Acá está lo urgente',
        body: 'La aplicación compara el stock de cada producto con el mínimo que vos configuraste y arma esta lista sola.',
      },
      {
        title: 'Sin stock vs. stock bajo',
        body: 'Sin stock es un producto en cero: hoy no lo podés vender. Stock bajo todavía tiene unidades, pero llegó a tu número de alarma.',
      },
      {
        target: 'boton-reponer',
        title: 'Reponé sin salir de acá',
        body: 'Cada producto de la lista tiene el botón para cargar la mercadería que llega, sin tener que ir a buscarlo al listado.',
        nextLabel: 'Entendido',
      },
    ],
  },
  {
    id: 'interpretar-ganancias',
    title: 'Interpretar las ganancias',
    summary: 'Margen, valor de inventario y venta potencial.',
    emoji: '📊',
    core: true,
    steps: [
      {
        route: '/',
        target: 'valor-inventario',
        title: 'Cuánta plata tenés metida',
        body: 'El valor del inventario es lo que ya invertiste: el precio de compra de cada producto por las unidades que te quedan.',
      },
      {
        title: 'La venta potencial es lo que entraría',
        body: 'Si vendieras hoy todo lo que tenés, al precio actual. La diferencia entre las dos cifras es tu ganancia bruta.',
      },
      {
        title: 'Y el margen es por unidad',
        body: 'Lo que te queda de cada venta después de descontar lo que pagaste. Si un producto cuesta $1.000 y lo vendés a $1.500, ganás $500 por unidad.',
        nextLabel: 'Entendido',
      },
    ],
  },
  {
    id: 'analizar-inventario',
    title: 'Analizar el inventario',
    summary: 'Que el Copiloto te diga qué revisar.',
    emoji: '🤖',
    core: true,
    steps: [
      {
        route: '/',
        target: 'insights-copilot',
        title: 'Los insights se arman solos',
        body: 'Sin que preguntes nada, reviso el inventario y muestro acá lo que necesita atención: stock crítico, productos por reponer, márgenes bajos.',
      },
      {
        target: 'copilot-launcher',
        title: 'Y podés preguntarme lo que quieras',
        body: 'Desde este botón me abrís en cualquier momento. Preguntame en tus palabras: “qué tengo que comprar”, “cuál me deja más ganancia”, “cuánto tengo invertido”.',
      },
      {
        title: 'Siempre con datos reales',
        body: 'Todo lo que respondo sale de tu inventario. Si un dato no está cargado, te lo digo en lugar de inventarlo.',
        nextLabel: 'Entendido',
      },
    ],
  },
  {
    id: 'buscar-producto',
    title: 'Buscar un producto',
    summary: 'Encontrar cualquier cosa en segundos.',
    emoji: '🔎',
    core: false,
    steps: [
      {
        route: '/',
        target: 'buscador-global',
        title: 'El buscador está siempre arriba',
        body: 'Buscá por nombre, código de barras, categoría o proveedor. Ignora tildes y mayúsculas, así que “cocacola” encuentra “Coca Cola”.',
      },
      {
        title: 'Y cada resultado trae atajos',
        body: 'Al costado de cada producto encontrado tenés los botones para cambiar el precio o ajustar el stock, sin abrir nada más.',
        nextLabel: 'Entendido',
      },
    ],
  },
  {
    id: 'recorrido',
    title: 'Recorrido por la aplicación',
    summary: 'Un paseo rápido por todas las secciones.',
    emoji: '🛒',
    core: false,
    steps: [
      {
        route: '/',
        target: 'sidebar-nav',
        title: 'Estas son las secciones',
        body: 'Panel, Productos, Stock, Categorías, Proveedores, Historial y Configuración. En el celular están en la barra de abajo y en el botón “Más”.',
      },
      {
        target: 'stat-cards',
        title: 'El panel resume el negocio',
        body: 'Cuántos productos tenés, cuánta plata hay en inventario y qué necesita atención. Las tarjetas son botones: te llevan al detalle.',
      },
      {
        route: '/productos',
        target: 'fila-producto',
        title: 'Productos es el corazón',
        body: 'Acá cargás, editás y buscás. Precio y stock se editan con un toque desde la misma lista.',
      },
      {
        route: '/stock',
        target: 'alertas-stock',
        title: 'Stock te avisa qué falta',
        body: 'Productos agotados y por debajo del mínimo, con el botón para reponer al lado.',
      },
      {
        route: '/historial',
        target: 'lista-historial',
        title: 'El historial guarda todo',
        body: 'Cada cambio de precio y cada movimiento de stock queda anotado con fecha y hora.',
        nextLabel: 'Terminar el recorrido',
      },
    ],
  },
];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}

export const CORE_LESSONS = LESSONS.filter((l) => l.core);

export function lessonProgress(completed: string[]): { done: number; total: number } {
  const total = CORE_LESSONS.length;
  const done = CORE_LESSONS.filter((l) => completed.includes(l.id)).length;
  return { done, total };
}
