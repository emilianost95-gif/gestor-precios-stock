import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  DollarSign,
  Layers,
  Package,
  PackageX,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/dashboard/StatCard';
import { BarList } from '@/charts/BarList';
import { MovementsChart } from '@/charts/MovementsChart';
import { useDashboardData } from '@/hooks/useProducts';
import { useCurrency } from '@/hooks/useCurrency';
import { useStore } from '@/context/StoreContext';
import { useProductActions } from '@/context/ProductActionsContext';
import { formatNumber, formatRelative } from '@/utils/format';

export function DashboardPage() {
  const { loading, settings, loadDemoData } = useStore();
  const { newProduct, editStock, editPrice } = useProductActions();
  const { money } = useCurrency();
  const {
    stats,
    lowStock,
    outOfStock,
    categoryBreakdown,
    topByValue,
    movementSeries,
    recentActivity,
  } = useDashboardData();

  if (loading) return <PageSkeleton />;

  if (stats.totalProducts === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Package className="h-7 w-7" aria-hidden />}
          title="Todavía no cargaste productos"
          description="Empezá creando tu primer producto o cargá los datos de demostración para ver cómo funciona el sistema."
          action={
            <Button onClick={newProduct} icon={<Package className="h-4 w-4" />}>
              Crear primer producto
            </Button>
          }
          secondaryAction={
            <Button variant="secondary" onClick={loadDemoData} icon={<Sparkles className="h-4 w-4" />}>
              Cargar datos de demostración
            </Button>
          }
        />
      </Card>
    );
  }

  const alerts = [...outOfStock, ...lowStock].slice(0, 6);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
          {settings.businessName || 'Mi negocio'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Resumen de hoy · {stats.movementsToday} movimiento{stats.movementsToday === 1 ? '' : 's'} registrado
          {stats.movementsToday === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Productos"
          value={formatNumber(stats.totalProducts)}
          icon={<Package className="h-4 w-4" aria-hidden />}
          to="/productos"
        />
        <StatCard
          label="Valor del inventario"
          value={money(stats.inventoryValue)}
          hint={`Venta potencial: ${money(stats.potentialSalesValue)}`}
          icon={<DollarSign className="h-4 w-4" aria-hidden />}
          tone="success"
        />
        <StatCard
          label="Stock bajo"
          value={formatNumber(stats.lowStockCount)}
          icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
          tone="warning"
          to="/stock"
        />
        <StatCard
          label="Sin stock"
          value={formatNumber(stats.outOfStockCount)}
          icon={<PackageX className="h-4 w-4" aria-hidden />}
          tone="danger"
          to="/stock"
        />
      </div>

      {alerts.length > 0 && (
        <Card>
          <CardHeader
            title="Productos que necesitan reposición"
            subtitle={`${stats.outOfStockCount} sin stock · ${stats.lowStockCount} por debajo del mínimo`}
            icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
            action={
              <Link
                to="/stock"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition hover:bg-brand-50 focus-ring dark:text-brand-400 dark:hover:bg-brand-950/50"
              >
                Ver todos
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            }
          />
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {alerts.map((product) => (
              <li key={product.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    product.isOutOfStock
                      ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
                      : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                  }`}
                >
                  {product.isOutOfStock ? (
                    <PackageX className="h-4 w-4" aria-hidden />
                  ) : (
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {product.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Stock: {formatNumber(product.stock)} · Mínimo: {formatNumber(product.minStock)}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => editStock(product)}>
                  Reponer
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader
            title="Movimientos de stock"
            subtitle="Últimos 7 días"
            icon={<TrendingUp className="h-4 w-4" aria-hidden />}
          />
          <div className="flex flex-1 items-center p-4 sm:p-5">
            <div className="w-full">
              <MovementsChart data={movementSeries} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Productos por categoría"
            subtitle={`${stats.categoriesCount} categorías`}
            icon={<Layers className="h-4 w-4" aria-hidden />}
          />
          <div className="p-4 sm:p-5">
            <BarList
              items={categoryBreakdown.map((c) => ({
                label: c.name,
                value: c.productCount,
                color: c.color,
                hint: `${money(c.inventoryValue)} en inventario`,
              }))}
              formatValue={(v) => `${v}`}
              emptyMessage="Todavía no asignaste categorías a tus productos."
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Mayor valor en inventario"
            subtitle="Precio de compra × stock"
            icon={<Boxes className="h-4 w-4" aria-hidden />}
          />
          <div className="p-4 sm:p-5">
            <BarList
              items={topByValue.map((p) => ({
                label: p.name,
                value: p.inventoryValue,
                color: p.categoryColor,
                hint: `${formatNumber(p.stock)} en stock · ${money(p.purchasePrice)} c/u`,
              }))}
              formatValue={money}
              emptyMessage="Cargá precios de compra para ver este gráfico."
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Actividad reciente"
            subtitle="Lo último que pasó en el negocio"
            icon={<Sparkles className="h-4 w-4" aria-hidden />}
            action={
              <Link
                to="/historial"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition hover:bg-brand-50 focus-ring dark:text-brand-400 dark:hover:bg-brand-950/50"
              >
                Ver historial
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            }
          />
          {recentActivity.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Todavía no hay actividad registrada.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {recentActivity.map((item) => (
                <li key={item.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                  <p className="flex-1 text-sm text-slate-700 dark:text-slate-300">{item.message}</p>
                  <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                    {formatRelative(item.date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Acciones rápidas</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={newProduct} icon={<Package className="h-4 w-4" />}>
            Nuevo producto
          </Button>
          {topByValue[0] && (
            <Button
              variant="secondary"
              onClick={() => editPrice(topByValue[0])}
              icon={<DollarSign className="h-4 w-4" />}
            >
              Cambiar precio de {topByValue[0].name.slice(0, 22)}
            </Button>
          )}
          <Link to="/stock">
            <Button variant="secondary" icon={<AlertTriangle className="h-4 w-4" />}>
              Revisar alertas de stock
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
