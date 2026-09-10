# Gestor de Precios y Stock

MVP de gestión de inventario para **almacenes, minimarkets, kioscos y negocios familiares**.
Pensado para que una persona sin conocimientos técnicos pueda cargar productos, cambiar precios y
controlar stock desde el celular en pocos toques.

- **Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons + React Router
- **Persistencia:** `localStorage` a través de una capa de adaptadores intercambiable (lista para Supabase / API REST)
- **Sin backend:** funciona 100% offline y es instalable como PWA

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
src/
├── charts/        Gráficos (HTML/CSS puro, sin librerías)
├── components/    Componentes reutilizables
│   ├── ui/        Design system: Button, Modal, Field, Card, EmptyState, Skeleton
│   ├── products/  Formulario, edición rápida de precio, detalle, import CSV
│   ├── stock/     Modal de movimientos de stock
│   └── dashboard/ Tarjetas de métricas
├── context/       Estado global y flujos compartidos (React Context)
├── data/          Valores por defecto y set de demostración
├── hooks/         useProducts, useCurrency, useDebounce, useApplyTheme
├── layouts/       AppLayout, Sidebar, TopBar, BottomNav, navegación
├── pages/         Una página por sección de la app
├── services/      Lógica de negocio pura (cálculos, CSV, respaldos)
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

No hay contraseñas ni secretos: todo vive en el dispositivo del usuario. No se usa
`dangerouslySetInnerHTML` en ningún componente, todas las entradas se validan antes de persistirse,
los archivos importados se validan antes de reemplazar datos y los datos de demostración son
explícitamente ficticios (proveedores con dominios `.demo` y teléfonos `+56 9 0000 000X`).

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

---

## 9. Fase 2 — funcionalidades futuras

Deliberadamente **fuera del MVP** para no comprometer la entrega. La arquitectura ya está preparada
para todas:

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
- Análisis del negocio con IA
- Predicción de demanda y sugerencias de reposición
- Aplicación nativa Android / iOS

---

Hecho por **Emiliano Santo Tomás** · [GitHub](https://github.com/emilianost95-gif)
