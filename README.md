# Gestor de Precios y Stock

MVP de gestión de inventario para **almacenes, minimarkets, kioscos y negocios familiares**.
Pensado para que una persona sin conocimientos técnicos pueda cargar productos, cambiar precios y
controlar stock desde el celular en pocos toques.

Incluye **Stock Copilot**, un asistente que lee el inventario real y responde sobre stock, precios y
márgenes, explicando siempre el motivo de cada recomendación y proponiendo acciones que sólo se
ejecutan con confirmación explícita.

- **Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons + React Router
- **Persistencia:** `localStorage` a través de una capa de adaptadores intercambiable (lista para Supabase / API REST)
- **Sin backend obligatorio:** funciona 100% offline y es instalable como PWA
- **IA opcional:** función serverless incluida; la API key vive sólo en el servidor

---

## 1. Instalación y uso

Requisitos: **Node.js 18 o superior**.

```bash
npm install
npm run dev
```

La aplicación queda disponible en `http://localhost:5173`.

Scripts disponibles:

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Verifica tipos con TypeScript y genera `dist/` |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run typecheck` | Sólo la verificación de tipos |
| `npm run build:pages` | Build con la ruta base de GitHub Pages |

### Primer arranque

La app arranca **vacía**, con las categorías base creadas (Bebidas, Almacén, Limpieza, Lácteos,
Snacks, Higiene, Otros). Desde el panel principal o desde **Configuración → Datos de demostración**
se pueden cargar 23 productos ficticios con historial de precios y movimientos, para mostrarle el
sistema a alguien en un minuto. Un aviso permanente recuerda que esos datos son inventados, y el
botón **“Limpiar datos de demostración”** deja todo listo para empezar en serio.

---

## 2. Arquitectura

```
api/                       Función serverless del Copilot (Vercel)
│   ├── copilot.ts         Adaptador Vercel
│   └── _lib/copilotCore.ts Núcleo agnóstico del hosting + prompt del sistema
netlify/functions/         Adaptador Netlify de la misma función
src/
├── charts/        Gráficos (HTML/CSS puro, sin librerías)
├── components/    Componentes reutilizables
│   ├── ui/        Design system: Button, Modal, Field, Card, EmptyState, Skeleton
│   ├── products/  Formulario, edición rápida de precio, detalle, import CSV
│   ├── stock/     Modal de movimientos de stock
│   ├── copilot/   Launcher, panel, burbujas, tabla y vista previa de acciones
│   └── dashboard/ Tarjetas de métricas e Insights del Copilot
├── context/       Estado global y flujos compartidos (React Context)
├── data/          Valores por defecto y set de demostración
├── hooks/         useProducts, useCurrency, useDebounce, useApplyTheme
├── layouts/       AppLayout, Sidebar, TopBar, BottomNav, navegación
├── pages/         Una página por sección de la app
├── services/      Lógica de negocio pura (cálculos, CSV, respaldos)
│   └── copilot/   Contexto de inventario, análisis, acciones y cliente de IA
├── storage/       Capa de persistencia intercambiable
├── types/         Modelo de dominio en TypeScript
└── utils/         Formato, validaciones, archivos, IDs
```

### Principio de diseño: la UI nunca toca el almacenamiento

```
Componentes  →  Context (StoreContext)  →  DataSource  →  StorageAdapter  →  localStorage
    UI            estado + acciones        contrato       implementación
```

- **`StorageAdapter`** (`src/storage/adapter.ts`): contrato de bajo nivel (`read`, `write`, `remove`).
  La implementación actual es `LocalStorageAdapter`, con *fallback* en memoria si el navegador
  bloquea el almacenamiento (modo privado, cuota llena).
- **`DataSource`** (`src/storage/dataSource.ts`): fachada por colección (`saveProducts`,
  `saveCategories`, …) y `loadSnapshot()` / `replaceAll()`. Todas las firmas son asíncronas **a
  propósito**, aunque hoy resuelvan al instante: cuando la persistencia pase a la red, no cambia
  ninguna llamada.
- **`src/storage/index.ts`** es el único punto de configuración:

  ```ts
  const adapter = new LocalStorageAdapter();
  export const dataSource = new LocalDataSource(adapter);
  ```

  Para migrar a la nube alcanza con escribir `SupabaseDataSource implements DataSource` y cambiar
  esas dos líneas. Ni los servicios ni los componentes se enteran.
- **`StoreContext`** mantiene el estado en memoria y persiste por colección con un `useEffect` por
  slice: sólo se reescribe lo que cambió.
- Los **servicios** (`productService`, `csvService`, `backupService`) son funciones puras: no
  conocen React ni el almacenamiento, y por eso son fáciles de testear y de reutilizar en un backend.

---

## 3. Módulos

### Panel principal (`/`)
Métricas del negocio (productos, valor del inventario, stock bajo, sin stock), lista de productos que
necesitan reposición con botón **Reponer** directo, gráfico de movimientos de los últimos 7 días,
distribución por categoría, mayor valor en inventario y actividad reciente.

### Productos (`/productos`)
CRUD completo: crear, editar, **duplicar**, eliminar (con confirmación). Buscador, filtros por
categoría y por estado de stock, y orden por nombre / precio / stock / valor / última modificación.
Tabla en escritorio y tarjetas táctiles en móvil, donde precio y stock son botones que abren
directamente su editor. Exportación e importación CSV desde la misma barra.

### Gestión de precios
Es el flujo más optimizado de la app. Desde cualquier lugar (buscador global, tabla, tarjeta,
detalle) se abre un modal que muestra el **precio actual**, un campo grande ya enfocado y
seleccionado, botones de ajuste rápido (−10%, −5%, +5%, +10%, +15%), una vista previa
`anterior → nuevo` con la diferencia, y el **historial de cambios con fecha y hora**. Al guardar, un
toast confirma: *“Precio actualizado correctamente — $2.500 → $2.700”*.

### Control de stock (`/stock`)
Tres modos en un mismo modal: **sumar**, **restar** y **fijar** un valor absoluto, con botones
`+/−`, atajos (+1, +5, +10, +20) y previsualización del stock resultante. Cada operación genera un
movimiento con producto, tipo (Entrada, Venta, Ajuste, Devolución), cantidad, stock anterior, stock
resultante, nota y fecha. La página tiene dos pestañas: **Alertas** (sin stock y stock bajo) y
**Movimientos** (con búsqueda y filtro por tipo).

### Categorías (`/categorias`)
Crear, editar y eliminar categorías con color propio. Muestra cantidad de productos y valor de
inventario por categoría. Al borrar una categoría, sus productos **no se eliminan**: quedan “Sin
categoría”.

### Proveedores (`/proveedores`)
Alta de proveedores con nombre, empresa, teléfono, email y notas. Teléfono y email son enlaces
directos (`tel:` / `mailto:`). Muestra cuántos productos tiene asociados cada uno.

### Historial (`/historial`)
Línea de tiempo agrupada por día (Hoy, Ayer, fecha), con filtros por precios, stock, productos y
datos. Registra frases legibles: *“Se modificó el precio de Bebida Cola 1.5 L”*, *“Se agregaron 10
unidades de Arroz Grado 1 · 1 kg”*.

### Búsqueda rápida
Buscador global siempre visible en la barra superior. Busca por **nombre, código de barras,
categoría y proveedor**, ignora tildes y mayúsculas, es instantáneo (debounce de 120 ms), se navega
con flechas + Enter y se enfoca con la tecla `/`. Cada resultado trae accesos directos a editar
precio y ajustar stock. El campo `barcode` y la búsqueda por código ya están modelados para conectar
un lector de cámara en la Fase 2 sin tocar el modelo de datos.

### Importar / exportar CSV
Exporta el catálogo completo (con BOM, para que Excel respete los acentos) e importa desde una
planilla existente. El parser acepta separador `,` o `;`, comillas, nombres de columna alternativos
(`codigo`, `precio`, `costo`, …) y **valida cada fila antes de importar**: muestra cuántas filas
están listas, cuáles tienen problemas y por qué. Si un producto ya existe (mismo nombre o código),
se actualiza en lugar de duplicarse. Hay una plantilla descargable.

### Respaldo y restauración
**Exportar respaldo** descarga un JSON con todo el sistema. **Restaurar respaldo** valida el archivo
antes de tocar nada: verifica estructura, tipos y campos obligatorios, descarta filas inválidas con
un aviso, muestra un resumen (productos, categorías, proveedores, movimientos, fecha de exportación)
y recién entonces pide confirmación explícita.

### Configuración (`/configuracion`)
Datos del negocio, moneda (CLP por defecto, con ARS, USD, EUR, MXN, PEN y COP disponibles), tema
claro / oscuro / sistema, stock mínimo por defecto, alertas de stock bajo, confirmación antes de
eliminar, importación/exportación, respaldos y datos de demostración.

---

## 3 bis. Stock Copilot

El Copilot se abre desde el botón flotante, desde el ítem del menú lateral o desde cualquier tarjeta
de **Insights**. Es un panel lateral en escritorio y una hoja a pantalla completa en el celular.

### Cómo obtiene los datos

Nunca lee `localStorage` por su cuenta. Toda la información pasa por una única función:

```ts
getInventoryContext(source, { maxProducts })  // src/services/copilot/inventoryContext.ts
```

Arma un objeto compacto con lo mínimo necesario para razonar: productos (nombre, categoría,
proveedor, stock, stock mínimo, precio de compra, precio de venta, margen, días sin movimiento,
último cambio de precio), categorías con su conteo y valor, totales del negocio, los últimos cambios
de precio y una lista explícita de **vacíos de datos**. No viajan descripciones, imágenes, códigos de
barras ni fechas de creación.

Dos detalles que importan:

- Cuando un dato **no existe**, el campo va en `null` (no en `0`). Así el Copilot puede decir "este
  producto no tiene precio de compra cargado" en lugar de inventar un margen.
- Si el catálogo supera los 150 productos, la lista se recorta **priorizando lo que necesita
  atención** (agotados, stock bajo, sin precio de compra) y se marca `productosRecortados: true`.

### Los dos motores

| | Motor local | Motor con IA |
| --- | --- | --- |
| Dónde corre | En el navegador | Función serverless → modelo de Anthropic |
| Requiere internet | No | Sí |
| Se activa | Siempre (por defecto) | Sólo si `VITE_COPILOT_API_URL` está configurada |
| Fortaleza | Determinista, instantáneo, privado | Entiende preguntas libres y ambiguas |

`src/services/copilot/localEngine.ts` cubre por reglas todas las consultas del día a día: stock bajo,
crítico, agotados, exceso, sin rotación, valor de inventario, márgenes, productos más caros y más
baratos, categorías, proveedores, prioridad de reposición y ajustes de precio por categoría. Todas
las cifras salen del inventario real.

Si el backend está configurado, `copilotClient.ts` lo llama primero. **Si falla, tarda demasiado o
devuelve algo que no cumple el contrato, cae al motor local y lo avisa en la burbuja**: la app nunca
queda sin respuesta.

### Análisis y explicaciones

`src/services/copilot/insights.ts` detecta y **explica el motivo** de cada hallazgo:

| Hallazgo | Regla |
| --- | --- |
| Sin stock | `stock <= 0` |
| Stock crítico | `stock <= mínimo × 0,5` |
| Stock bajo | `stock <= mínimo` |
| Exceso de stock | `stock >= mínimo × 6` |
| Sin rotación | Más de 30 días sin movimientos (o ninguno) |
| Sin precio de compra | `precioCompra <= 0` |
| Se vende bajo el costo | `precioVenta < precioCompra` |
| Margen bajo | Margen menor al 20% sobre el costo |
| Margen alto | Margen mayor al 60% sobre el costo |

Los umbrales están centralizados en `THRESHOLDS`, en un solo lugar. Ejemplo de salida real:

> *Queso Laminado 250 g: quedan 4 unidades y el stock mínimo configurado es 5.*

### Acciones: el modelo propone, la app ejecuta

Este es el punto de seguridad más importante del diseño.

```
Copilot          → propone { tipo: 'precio-masivo', modo: 'percent', valor: 10, alcance: Bebidas }
parseAction()    → valida el contrato y que los ids/categorías existan de verdad
buildActionPreview() → calcula los precios finales CON LOS DATOS LOCALES
Usuario          → ve la vista previa producto por producto
Confirmación     → diálogo explícito con el conteo de productos afectados
store            → applyBulkPriceUpdate() aplica y registra el historial
```

El modelo **nunca** entrega precios finales ni toca la base de datos: sólo dice *qué* hacer. Los
números los calcula la aplicación. Además:

- Cancelar en cualquier paso no modifica absolutamente nada.
- Límite de 500 productos por operación y de ±100% en ajustes porcentuales.
- Se avisa si algún producto quedaría por debajo de su precio de compra.
- No existen acciones destructivas: el Copilot no puede borrar productos, categorías ni proveedores.
- Cada cambio queda en el historial y en el registro de precios de cada producto.

### Insights del dashboard

La sección "Insights del Copilot" corre el mismo análisis sin que el usuario pregunte: stock crítico,
productos que se venden bajo el costo, productos por reponer (con el costo estimado de volver al
mínimo), márgenes bajos, mayor margen y productos para revisar. Muestra **como máximo cinco
tarjetas** y sólo las que tienen algo que decir; si el inventario está sano, aparece un estado
tranquilo en vez de relleno. Cada tarjeta abre el Copilot con la consulta correspondiente.

---

## 4. Decisiones técnicas

- **Formato de moneda**: `Intl.NumberFormat` con configuración por moneda. CLP no usa decimales.
  El parser de precios entiende `2.500`, `2500`, `$2.700` y `2.500,50` sin que el usuario piense en
  formatos.
- **Sin librería de gráficos**: los tres gráficos son HTML + CSS. Menos peso, cero dependencias que
  mantener y se ven bien en ambos temas.
- **`HashRouter`**: hace que la app funcione en GitHub Pages, Netlify o cualquier hosting estático
  sin configurar *rewrites*.
- **Historial desnormalizado**: los movimientos guardan `productName`, así el historial sigue siendo
  legible aunque el producto se elimine.
- **Límites de crecimiento**: la actividad, los movimientos y los cambios de precio se recortan
  (400 / 1000 / 600 registros) para no llenar `localStorage` con el uso diario.

## 5. Accesibilidad

Labels asociados a todos los campos, `aria-label` en botones de sólo ícono, `aria-invalid` y
`role="alert"` en errores, foco visible consistente, atrapado de foco y restauración al cerrar
modales, cierre con `Escape`, navegación completa por teclado, enlace “Saltar al contenido”,
`aria-sort` en las columnas ordenables, contraste AA en ambos temas y respeto por
`prefers-reduced-motion`.

## 6. PWA

`manifest.webmanifest` con íconos 192/512 y *maskable*, atajos a Productos y Stock, service worker
propio (`public/sw.js`) que cachea el *shell* de la app y responde offline, metadatos para iOS y
`theme-color` que sigue el tema activo. Desde el celular: *“Agregar a pantalla de inicio”* y queda
como una aplicación más.

## 7. Seguridad

No hay contraseñas ni secretos en el frontend: todo vive en el dispositivo del usuario. No se usa
`dangerouslySetInnerHTML` en ningún componente, todas las entradas se validan antes de persistirse,
los archivos importados se validan antes de reemplazar datos y los datos de demostración son
explícitamente ficticios (proveedores con dominios `.demo` y teléfonos `+56 9 0000 000X`).

Sobre la IA:

- La **API key nunca toca el navegador**. Vive sólo como variable de entorno del servidor, dentro de
  `api/_lib/copilotCore.ts`. El frontend únicamente conoce la URL pública del endpoint
  (`VITE_COPILOT_API_URL`), que no es un secreto.
- El endpoint valida largo de pregunta, tamaño del contexto y método HTTP, y permite restringir el
  origen con `COPILOT_ALLOWED_ORIGIN`.
- El modelo no tiene acceso directo a los datos: recibe un contexto recortado y devuelve texto y, como
  mucho, una propuesta de acción que la aplicación valida y ejecuta por su cuenta.

---

## 8. Despliegue

### Netlify (más simple)

1. Subí el repositorio a GitHub.
2. En Netlify: **Add new site → Import an existing project**.
3. Build command: `npm run build` · Publish directory: `dist`.

O sin repositorio: `npm run build` y arrastrá la carpeta `dist` a [app.netlify.com/drop](https://app.netlify.com/drop).

### GitHub Pages

```bash
npm run build:pages   # usa /gestor-precios-stock/ como ruta base
```

Ajustá el nombre en el script `build:pages` si tu repositorio se llama distinto y subí `dist/`.
El repositorio ya incluye un workflow que lo hace solo: `.github/workflows/deploy.yml`. Después del
primer push, activá **Settings → Pages → Source: GitHub Actions**.

> GitHub Pages sirve archivos estáticos: no puede ejecutar la función serverless. Ahí el Copilot
> funciona con el motor local, que cubre todas las consultas del día a día.

### Activar la IA (opcional)

GitHub Pages no ejecuta código de servidor, así que la función va en otro lado. Cualquiera de las dos
opciones sirve, y el frontend puede seguir viviendo en Pages:

**Opción A — Vercel (todo junto):**

1. Importá el repositorio en [vercel.com/new](https://vercel.com/new). Detecta Vite solo.
2. En **Settings → Environment Variables** agregá `ANTHROPIC_API_KEY` (y opcionalmente
   `ANTHROPIC_MODEL` y `COPILOT_ALLOWED_ORIGIN`).
3. Agregá también `VITE_COPILOT_API_URL = /api/copilot`.
4. Deploy. La función queda en `/api/copilot` gracias a `api/copilot.ts`.

**Opción B — Netlify:**

1. Importá el repositorio; `netlify.toml` ya define build, publish y la carpeta de funciones.
2. Cargá las mismas variables en **Site settings → Environment variables**.
3. `VITE_COPILOT_API_URL = /api/copilot` (el redirect apunta a la función).

**Opción C — frontend en GitHub Pages + backend en Vercel:** desplegá sólo la función en Vercel y en
el workflow de Pages agregá `VITE_COPILOT_API_URL` apuntando a
`https://tu-proyecto.vercel.app/api/copilot`. En ese caso configurá `COPILOT_ALLOWED_ORIGIN` con
`https://emilianost95-gif.github.io` para que nadie más use tu endpoint.

### Variables de entorno

| Variable | Dónde | Obligatoria | Para qué |
| --- | --- | --- | --- |
| `VITE_COPILOT_API_URL` | Frontend (build) | No | URL del endpoint. Vacía = motor local |
| `VITE_BASE` | Frontend (build) | No | Ruta base para GitHub Pages |
| `ANTHROPIC_API_KEY` | **Servidor** | Sí, para la IA | Clave del proveedor. **Secreta** |
| `ANTHROPIC_MODEL` | Servidor | No | Por defecto `claude-sonnet-5` |
| `COPILOT_ALLOWED_ORIGIN` | Servidor | No | Restringe quién puede llamar al endpoint |

`.env.example` tiene el detalle. Las variables `VITE_*` se compilan dentro del bundle: **nunca**
pongas una clave ahí.

---

## 9. Fase 2 — funcionalidades futuras

Deliberadamente **fuera del MVP** para no comprometer la entrega. La arquitectura ya está preparada
para todas.

### Cómo migrar a Supabase cuando llegue el momento

El trabajo está acotado a un archivo nuevo y dos líneas cambiadas, porque la UI nunca habla con el
almacenamiento:

1. Crear las tablas `products`, `categories`, `suppliers`, `stock_movements`, `price_changes`,
   `activity` y `settings`, con las mismas columnas que los tipos de `src/types/index.ts` más un
   `user_id` (o `business_id`) para separar negocios.
2. Activar Row Level Security con la política `user_id = auth.uid()`.
3. Escribir `src/storage/supabaseDataSource.ts` implementando la interfaz `DataSource` ya existente
   (`loadSnapshot`, `saveProducts`, `saveCategories`, … `replaceAll`, `clear`, `isEmpty`).
4. Cambiar dos líneas en `src/storage/index.ts`:

   ```ts
   const adapter = new LocalStorageAdapter();
   export const dataSource = new LocalDataSource(adapter);
   // pasa a:
   export const dataSource = new SupabaseDataSource(supabaseClient);
   ```

Ni los componentes, ni los servicios, ni el Copilot cambian: todos siguen leyendo el estado desde
`StoreContext`. Como paso intermedio conviene mantener `localStorage` como caché offline y sincronizar
con Supabase al reconectar; por eso las firmas del `DataSource` ya son asíncronas desde el día uno.

### Pendientes

- Login y múltiples usuarios
- Múltiples negocios / sucursales
- Supabase + PostgreSQL como `DataSource` alternativo
- Sincronización en la nube y resolución de conflictos
- Lector de código de barras con la cámara del teléfono
- Módulo de ventas y caja
- Clientes y cuentas corrientes
- Proveedores avanzados: órdenes de compra y recepción
- Reportes en PDF
- Impresión de etiquetas de precio
- Estadísticas avanzadas (rotación, estacionalidad)
- Predicción de demanda basada en el histórico de movimientos
- Aplicación nativa Android / iOS
- Del Copilot: memoria entre sesiones, alertas proactivas y más tipos de acción
  (crear productos, registrar movimientos, generar órdenes de compra)

---

Hecho por **Emiliano Santo Tomás** · [GitHub](https://github.com/emilianost95-gif)
