import type { CopilotUiAction, CopilotUiContext, ScreenId } from './types';

/** Traduce una ruta del router al identificador de pantalla. */
export function screenFromPath(pathname: string): { screen: ScreenId; label: string } {
  if (pathname.startsWith('/productos')) return { screen: 'productos', label: 'Productos' };
  if (pathname.startsWith('/stock')) return { screen: 'stock', label: 'Stock y alertas' };
  if (pathname.startsWith('/categorias')) return { screen: 'categorias', label: 'Categorías' };
  if (pathname.startsWith('/proveedores')) return { screen: 'proveedores', label: 'Proveedores' };
  if (pathname.startsWith('/historial')) return { screen: 'historial', label: 'Historial' };
  if (pathname.startsWith('/configuracion')) return { screen: 'configuracion', label: 'Configuración' };
  if (pathname === '/' || pathname === '') return { screen: 'inicio', label: 'Panel principal' };
  return { screen: 'otra', label: 'la aplicación' };
}

/**
 * Acciones sugeridas según dónde está parado el usuario.
 * Es lo que alimenta las fichas rápidas del panel y el botón "¿Qué puedo hacer?".
 */
export function getScreenSuggestions(ui: CopilotUiContext): CopilotUiAction[] {
  switch (ui.screen) {
    case 'productos':
      return [
        { label: 'Buscar un producto', icon: 'buscar', question: '¿Cómo busco un producto?' },
        { label: 'Agregar producto', icon: 'agregar', question: '¿Cómo agrego un producto?' },
        { label: 'Cambiar un precio', icon: 'precio', question: '¿Cómo cambio un precio?' },
        { label: 'Revisar el stock', icon: 'stock', question: '¿Qué productos tienen poco stock?' },
      ];
    case 'stock':
      return [
        { label: 'Explicar las alertas', icon: 'analizar', question: '¿Qué significan estas alertas?' },
        { label: 'Ver productos críticos', icon: 'stock', question: '¿Qué productos están en stock crítico?' },
        { label: 'Qué reponer primero', icon: 'analizar', question: '¿Qué productos debería reponer primero?' },
        { label: 'Cómo registro una entrada', icon: 'tutorial', question: '¿Cómo actualizo el stock?' },
      ];
    case 'categorias':
      return [
        { label: 'Categorías con más productos', icon: 'analizar', question: '¿Qué categorías tienen más productos?' },
        { label: 'Subir precios de una categoría', icon: 'precio', question: 'Aumentar un 10% los precios de Bebidas' },
        { label: 'Para qué sirven', icon: 'analizar', question: '¿Para qué sirven las categorías?' },
      ];
    case 'proveedores':
      return [
        { label: 'Ver mis proveedores', icon: 'ver', question: '¿Qué proveedores tengo?' },
        { label: 'A quién pedirle', icon: 'analizar', question: '¿Qué productos debería reponer primero?' },
      ];
    case 'historial':
      return [
        { label: 'Últimos cambios de precio', icon: 'precio', question: '¿Qué cambios de precio hice?' },
        { label: 'Resumen del inventario', icon: 'analizar', question: 'Resumen del inventario' },
      ];
    case 'configuracion':
      return [
        { label: 'Resumen del inventario', icon: 'analizar', question: 'Resumen del inventario' },
        { label: 'Enseñame la aplicación', icon: 'tutorial', question: 'Enseñame a usar la aplicación' },
      ];
    case 'inicio':
    default:
      return [
        { label: 'Analizar mi inventario', icon: 'analizar', question: 'Analizá mi inventario' },
        { label: 'Ver poco stock', icon: 'stock', question: '¿Qué productos tienen poco stock?' },
        { label: 'Mayor ganancia', icon: 'precio', question: '¿Cuáles son mis productos más rentables?' },
        { label: 'Enseñame esta pantalla', icon: 'tutorial', question: 'Enseñame esta pantalla' },
      ];
  }
}

/** Frase de apertura que reconoce dónde está el usuario. */
export function describeScreen(
  ui: CopilotUiContext,
  data: { lowStockCount: number; outOfStockCount: number; productCount: number },
): string {
  switch (ui.screen) {
    case 'productos': {
      if (ui.search) return `Estás buscando “${ui.search}” dentro de tus ${data.productCount} productos.`;
      if (ui.stockFilter && ui.stockFilter !== 'todos') {
        return 'Estás mirando el listado de productos con un filtro de stock aplicado.';
      }
      return `Veo que estás revisando tus productos. Tenés ${data.productCount} cargados.`;
    }
    case 'stock': {
      const total = data.lowStockCount + data.outOfStockCount;
      return total > 0
        ? `Hay ${total} producto${total === 1 ? '' : 's'} que necesita${total === 1 ? '' : 'n'} atención en esta pantalla.`
        : 'Estás en Stock y alertas. Ahora mismo no hay nada urgente.';
    }
    case 'categorias':
      return 'Estás en Categorías. Sirven para agrupar productos y filtrarlos rápido.';
    case 'proveedores':
      return 'Estás en Proveedores. Acá guardás a quién le comprás cada producto.';
    case 'historial':
      return 'Estás en el Historial: cada cambio de precio y cada movimiento de stock queda registrado acá.';
    case 'configuracion':
      return 'Estás en Configuración: datos del negocio, moneda, respaldos y modo demostración.';
    case 'inicio':
    default:
      return 'Estás en el panel principal, el resumen de cómo viene el negocio.';
  }
}
