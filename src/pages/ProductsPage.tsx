import { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Copy,
  Download,
  DollarSign,
  Package,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
} from 'lucide-react';
import { Card, CategoryChip } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ImportCSVModal } from '@/components/products/ImportCSVModal';
import { useStore } from '@/context/StoreContext';
import { useProductActions } from '@/context/ProductActionsContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useDebounce } from '@/hooks/useDebounce';
import { useFilteredProducts } from '@/hooks/useProducts';
import { productsToCSV } from '@/services/csvService';
import { useToast } from '@/context/ToastContext';
import type { ProductFilters, SortField, StockFilter } from '@/types';
import { formatNumber, formatRelative } from '@/utils/format';
import { downloadTextFile, timestampedFilename } from '@/utils/file';

const STOCK_FILTERS: { value: StockFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'bajo', label: 'Stock bajo' },
  { value: 'sin-stock', label: 'Sin stock' },
  { value: 'con-stock', label: 'Con stock' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'name', label: 'Nombre' },
  { value: 'salePrice', label: 'Precio' },
  { value: 'stock', label: 'Stock' },
  { value: 'inventoryValue', label: 'Valor en inventario' },
  { value: 'updatedAt', label: 'Última modificación' },
];

export function ProductsPage() {
  const { loading, products, categories, suppliers } = useStore();
  const { newProduct, editProduct, editPrice, editStock, viewProduct, duplicateProduct, deleteProduct } =
    useProductActions();
  const { money } = useCurrency();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | 'todas'>('todas');
  const [stock, setStock] = useState<StockFilter>('todos');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 150);

  const filters = useMemo<ProductFilters>(
    () => ({ search: debouncedSearch, categoryId, stock, sortBy, sortDir }),
    [debouncedSearch, categoryId, stock, sortBy, sortDir],
  );

  const filtered = useFilteredProducts(filters);
  const activeFilters = (categoryId !== 'todas' ? 1 : 0) + (stock !== 'todos' ? 1 : 0);

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  const handleExport = () => {
    if (products.length === 0) {
      toast.warning('No hay productos', 'Creá al menos un producto antes de exportar.');
      return;
    }
    downloadTextFile(
      timestampedFilename('productos', 'csv'),
      productsToCSV(products, categories, suppliers),
      'text/csv',
      true,
    );
    toast.success('CSV exportado', `${products.length} productos descargados.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
            Productos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filtered.length} de {products.length} producto{products.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={handleExport} icon={<Download className="h-4 w-4" />}>
            Exportar CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setImportOpen(true)}
            icon={<Upload className="h-4 w-4" />}
          >
            Importar CSV
          </Button>
          <Button size="sm" onClick={newProduct} icon={<Plus className="h-4 w-4" />}>
            Nuevo
          </Button>
        </div>
      </div>

      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <label htmlFor="products-search" className="sr-only">
              Buscar en la lista de productos
            </label>
            <input
              id="products-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por nombre, código o categoría…"
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm focus-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              icon={<SlidersHorizontal className="h-4 w-4" />}
            >
              Filtros
              {activeFilters > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
                  {activeFilters}
                </span>
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={() => toggleSort(sortBy)}
              icon={<ArrowDownUp className="h-4 w-4" />}
              aria-label={`Orden ${sortDir === 'asc' ? 'ascendente' : 'descendente'}`}
            >
              {sortDir === 'asc' ? 'A → Z' : 'Z → A'}
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 dark:border-slate-800 sm:grid-cols-3">
            <div>
              <label
                htmlFor="filter-category"
                className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
              >
                Categoría
              </label>
              <select
                id="filter-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm focus-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="todas">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="filter-stock"
                className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
              >
                Stock
              </label>
              <select
                id="filter-stock"
                value={stock}
                onChange={(e) => setStock(e.target.value as StockFilter)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm focus-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {STOCK_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="filter-sort"
                className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
              >
                Ordenar por
              </label>
              <select
                id="filter-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm focus-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            {activeFilters > 0 && (
              <div className="sm:col-span-3">
                <button
                  type="button"
                  onClick={() => {
                    setCategoryId('todas');
                    setStock('todos');
                  }}
                  className="text-xs font-semibold text-brand-600 underline-offset-2 hover:underline focus-ring dark:text-brand-400"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <ListSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Package className="h-7 w-7" aria-hidden />}
            title={products.length === 0 ? 'Todavía no hay productos' : 'Sin resultados'}
            description={
              products.length === 0
                ? 'Creá tu primer producto para empezar a controlar precios y stock.'
                : 'Probá con otro término de búsqueda o limpiá los filtros aplicados.'
            }
            action={
              products.length === 0 ? (
                <Button onClick={newProduct} icon={<Plus className="h-4 w-4" />}>
                  Crear producto
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setCategoryId('todas');
                    setStock('todos');
                  }}
                >
                  Limpiar búsqueda y filtros
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Vista de tabla — tablet y desktop */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3 font-medium"
                      aria-sort={sortBy === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <SortButton field="name" current={sortBy} dir={sortDir} onSort={toggleSort}>
                        Producto
                      </SortButton>
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Categoría
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                      aria-sort={sortBy === 'salePrice' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <SortButton field="salePrice" current={sortBy} dir={sortDir} onSort={toggleSort}>
                        Precio venta
                      </SortButton>
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                      aria-sort={sortBy === 'stock' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <SortButton field="stock" current={sortBy} dir={sortDir} onSort={toggleSort}>
                        Stock
                      </SortButton>
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filtered.map((product) => (
                    <tr
                      key={product.id}
                      className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => viewProduct(product)}
                          className="block max-w-xs truncate text-left font-medium text-slate-900 hover:text-brand-600 focus-ring dark:text-slate-100 dark:hover:text-brand-400"
                        >
                          {product.name}
                        </button>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {product.barcode ? (
                            <span className="font-mono">{product.barcode}</span>
                          ) : (
                            'Sin código'
                          )}{' '}
                          · {formatRelative(product.updatedAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <CategoryChip name={product.categoryName} color={product.categoryColor} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => editPrice(product)}
                          className="rounded-lg px-2 py-1 font-semibold tabular-nums text-slate-900 transition hover:bg-brand-50 hover:text-brand-700 focus-ring dark:text-slate-100 dark:hover:bg-brand-950/50 dark:hover:text-brand-300"
                          title="Editar precio"
                        >
                          {money(product.salePrice)}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => editStock(product)}
                          title="Ajustar stock"
                          className={`rounded-lg px-2 py-1 font-semibold tabular-nums transition hover:bg-slate-100 focus-ring dark:hover:bg-slate-800 ${
                            product.isOutOfStock
                              ? 'text-red-600 dark:text-red-400'
                              : product.isLowStock
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {formatNumber(product.stock)}
                          <span className="ml-1 text-xs font-normal text-slate-400">
                            / {formatNumber(product.minStock)}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton label={`Editar precio de ${product.name}`} onClick={() => editPrice(product)}>
                            <DollarSign className="h-4 w-4" aria-hidden />
                          </IconButton>
                          <IconButton label={`Ajustar stock de ${product.name}`} onClick={() => editStock(product)}>
                            <Package className="h-4 w-4" aria-hidden />
                          </IconButton>
                          <IconButton label={`Editar ${product.name}`} onClick={() => editProduct(product)}>
                            <Pencil className="h-4 w-4" aria-hidden />
                          </IconButton>
                          <IconButton
                            label={`Duplicar ${product.name}`}
                            onClick={() => duplicateProduct(product)}
                          >
                            <Copy className="h-4 w-4" aria-hidden />
                          </IconButton>
                          <IconButton
                            label={`Eliminar ${product.name}`}
                            onClick={() => void deleteProduct(product)}
                            className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Vista de tarjetas — móvil */}
            <ul className="divide-y divide-slate-200 md:hidden dark:divide-slate-800">
              {filtered.map((product) => (
                <li key={product.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => viewProduct(product)}
                      className="min-w-0 flex-1 text-left focus-ring"
                    >
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">{product.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <CategoryChip name={product.categoryName} color={product.categoryColor} />
                        {product.isOutOfStock ? (
                          <span className="text-xs font-semibold text-red-600 dark:text-red-400">Sin stock</span>
                        ) : product.isLowStock ? (
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                            Stock bajo
                          </span>
                        ) : null}
                      </div>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <IconButton
                        label={`Editar ${product.name}`}
                        onClick={() => editProduct(product)}
                        variant="ghost"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </IconButton>
                      <IconButton
                        label={`Eliminar ${product.name}`}
                        onClick={() => void deleteProduct(product)}
                        variant="ghost"
                        className="text-red-500"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </IconButton>
                    </div>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => editPrice(product)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-left transition active:bg-slate-50 focus-ring dark:border-slate-800 dark:active:bg-slate-800"
                    >
                      <span className="block text-[11px] uppercase tracking-wide text-slate-400">Precio</span>
                      <span className="block text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {money(product.salePrice)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => editStock(product)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-left transition active:bg-slate-50 focus-ring dark:border-slate-800 dark:active:bg-slate-800"
                    >
                      <span className="block text-[11px] uppercase tracking-wide text-slate-400">Stock</span>
                      <span
                        className={`block text-base font-semibold tabular-nums ${
                          product.isOutOfStock
                            ? 'text-red-600 dark:text-red-400'
                            : product.isLowStock
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {formatNumber(product.stock)}
                        <span className="ml-1 text-xs font-normal text-slate-400">
                          / {formatNumber(product.minStock)}
                        </span>
                      </span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <ImportCSVModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

interface SortButtonProps {
  field: SortField;
  current: SortField;
  dir: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  children: React.ReactNode;
}

function SortButton({ field, current, dir, onSort, children }: SortButtonProps) {
  const active = current === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 rounded focus-ring ${active ? 'text-brand-600 dark:text-brand-400' : ''}`}
    >
      {children}
      {active && <span aria-hidden>{dir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );
}
