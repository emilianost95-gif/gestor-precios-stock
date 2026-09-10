import { useMemo, useState } from 'react';
import { Layers, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { useStore } from '@/context/StoreContext';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useProductViews } from '@/hooks/useProducts';
import { getCategoryBreakdown } from '@/services/productService';
import { CATEGORY_COLORS } from '@/data/defaults';
import { validateCategoryName } from '@/utils/validation';
import type { Category } from '@/types';

export function CategoriesPage() {
  const { categories, createCategory, updateCategory, deleteCategory, settings } = useStore();
  const products = useProductViews();
  const toast = useToast();
  const confirm = useConfirm();
  const { money } = useCurrency();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [error, setError] = useState<string | undefined>();

  const breakdown = useMemo(() => getCategoryBreakdown(products, categories), [products, categories]);
  const statsFor = (id: string) => breakdown.find((b) => b.categoryId === id);

  const openNew = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setColor(CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]);
    setError(undefined);
    setOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setName(category.name);
    setDescription(category.description ?? '');
    setColor(category.color);
    setError(undefined);
    setOpen(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const others = categories.filter((c) => c.id !== editing?.id).map((c) => c.name);
    const validation = validateCategoryName(name, others);
    if (validation) {
      setError(validation);
      return;
    }
    if (editing) {
      updateCategory(editing.id, { name: name.trim(), description: description.trim(), color });
      toast.success('Categoría actualizada', name.trim());
    } else {
      createCategory({ name: name.trim(), description: description.trim(), color });
      toast.success('Categoría creada', name.trim());
    }
    setOpen(false);
  };

  const handleDelete = async (category: Category) => {
    const count = statsFor(category.id)?.productCount ?? 0;
    const confirmed =
      !settings.confirmBeforeDelete ||
      (await confirm({
        title: 'Eliminar categoría',
        message:
          count > 0
            ? `"${category.name}" tiene ${count} producto${count === 1 ? '' : 's'}. Si la eliminás, esos productos quedan “Sin categoría” (no se borran).`
            : `¿Eliminar la categoría "${category.name}"?`,
        confirmLabel: 'Sí, eliminar',
        danger: true,
      }));
    if (!confirmed) return;
    deleteCategory(category.id);
    toast.success('Categoría eliminada', category.name);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
            Categorías
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {categories.length} categoría{categories.length === 1 ? '' : 's'} para organizar tus productos
          </p>
        </div>
        <Button onClick={openNew} icon={<Plus className="h-4 w-4" />}>
          Nueva
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Tags className="h-7 w-7" aria-hidden />}
            title="Todavía no hay categorías"
            description="Las categorías te permiten filtrar productos rápido: Bebidas, Almacén, Limpieza, y las que necesites."
            action={
              <Button onClick={openNew} icon={<Plus className="h-4 w-4" />}>
                Crear categoría
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const stats = statsFor(category.id);
            return (
              <Card key={category.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${category.color}1f`, color: category.color }}
                    >
                      <Layers className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {category.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {stats?.productCount ?? 0} producto{(stats?.productCount ?? 0) === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton label={`Editar ${category.name}`} onClick={() => openEdit(category)}>
                      <Pencil className="h-4 w-4" aria-hidden />
                    </IconButton>
                    <IconButton
                      label={`Eliminar ${category.name}`}
                      onClick={() => void handleDelete(category)}
                      className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </IconButton>
                  </div>
                </div>
                {category.description && (
                  <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">{category.description}</p>
                )}
                <p className="mt-2.5 border-t border-slate-200 pt-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  Valor en inventario:{' '}
                  <strong className="tabular-nums text-slate-700 dark:text-slate-200">
                    {money(stats?.inventoryValue ?? 0)}
                  </strong>
                </p>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title={editing ? 'Editar categoría' : 'Nueva categoría'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="category-form">
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          <TextField
            label="Nombre"
            required
            autoComplete="off"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(undefined);
            }}
            error={error}
            placeholder="Ej: Bebidas"
          />
          <TextAreaField
            label="Descripción"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opcional"
          />
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Color</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Elegir color ${c}`}
                  aria-pressed={color === c}
                  className={`h-8 w-8 rounded-full transition focus-ring ${
                    color === c ? 'ring-2 ring-slate-900 ring-offset-2 dark:ring-white dark:ring-offset-slate-900' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </fieldset>
        </form>
      </Modal>
    </div>
  );
}
