/**
 * Pila de capas descartables.
 *
 * En Android el botón "atrás" del sistema tiene que cerrar lo último que se
 * abrió —un modal, el Copiloto, la guía visual— antes de navegar hacia atrás.
 * El navegador no sabe nada de esas capas, así que cada una se registra acá
 * mientras está abierta y se da de baja al cerrarse.
 *
 * Es deliberadamente un módulo suelto y no un contexto de React: lo consultan
 * el manejador nativo del botón atrás (fuera del árbol de componentes) y la
 * propia aplicación, y así no obliga a re-renderizar nada.
 */

type Dismiss = () => void;

interface Layer {
  id: number;
  dismiss: Dismiss;
}

let nextId = 1;
const layers: Layer[] = [];

/**
 * Registra una capa abierta. Devuelve la función para darla de baja, pensada
 * para usarse como cleanup de un `useEffect`.
 */
export function pushLayer(dismiss: Dismiss): () => void {
  const layer: Layer = { id: nextId++, dismiss };
  layers.push(layer);
  return () => {
    const index = layers.findIndex((l) => l.id === layer.id);
    if (index >= 0) layers.splice(index, 1);
  };
}

/**
 * Cierra la capa más reciente.
 * @returns `true` si había algo que cerrar.
 */
export function dismissTopLayer(): boolean {
  const layer = layers.pop();
  if (!layer) return false;
  layer.dismiss();
  return true;
}

export function hasOpenLayers(): boolean {
  return layers.length > 0;
}
