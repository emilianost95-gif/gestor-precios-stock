import { useEffect, useMemo, useState } from 'react';
import { Package, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { useStore, type ProductInput } from '@/context/StoreContext';
import { useToast } from '@/context/ToastContext';
import { useCurrency } from '@/hooks/useCurrency';
import { UNITS, type Product, type UnitOfMeasure } from '@/types';
import { formatMoney, parseMoneyInput } from '@/utils/format';
import { hasErrors, validateProductForm, type ProductFormValues } from '@/utils/validation';

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
}

function emptyValues(defaultMinStock: number): ProductFormValues {
  return {
    name: '',
    barcode: '',
    categoryId: '',
    purchasePrice: '',
    salePrice: '',
    stock: '0',
    minStock: String(defaultMinStock),
    unit: 'unidad',
    supplierId: '',
    description: '',
    imageUrl: '',
  };
}

function toFormValues(product: Product): ProductFormValues {
  return {
    name: product.name,
    barcode: product.barcode ?? '',
    categoryId: product.categoryId ?? '',
    purchasePrice: String(product.purchasePrice ?? ''),
    salePrice: String(product.salePrice ?? ''),
    stock: String(product.stock ?? 0),
    minStock: String(product.minStock ?? 0),
    unit: product.unit,
    supplierId: product.supplierId ?? '',
    description: product.description ?? '',
    imageUrl: product.imageUrl ?? '',
  };
}

export function ProductFormModal({ open, onClose, product }: ProductFormModalProps) {
  const { products, categories, suppliers, settings, createProduct, updateProduct, createCategory } =
    useStore();
  const toast = useToast();
  const { money, symbol } = useCurrency();

  const isEditing = Boolean(product);
  const [values, setValues] = useState<ProductFormValues>(() => emptyValues(settings.defaultMinStock));
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(product ? toFormValues(product) : emptyValues(settings.defaultMinStock));
    setErrors({});
    setNewCategory('');
    setShowNewCategory(false);
  }, [open, product, settings.defaultMinStock]);

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const margin = useMemo(() => {
    const purchase = parseMoneyInput(values.purchasePrice) || 0;
    const sale = parseMoneyInput(values.salePrice) || 0;
    if (!sale || !purchase) return null;
    const diff = sale - purchase;
    const percent = purchase > 0 ? (diff / purchase) * 100 : 0;
    return { diff, percent };
  }, [values.purchasePrice, values.salePrice]);

  const handleAddCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    const exists = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      set('categoryId', exists.id);
    } else {
      const created = createCategory({ name });
      set('categoryId', created.id);
      toast.success('Categoría creada', `"${created.name}" ya está disponible.`);
    }
    setNewCategory('');
    setShowNewCategory(false);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateProductForm(values, { existing: products, currentId: product?.id });
    setErrors(validation);
    if (hasErrors(validation)) {
      toast.error('Revisá los datos', 'Hay campos con errores en el formulario.');
      return;
    }

    setSaving(true);
    const input: ProductInput = {
      name: values.name.trim(),
      barcode: values.barcode.trim() || undefined,
      categoryId: values.categoryId || null,
      supplierId: values.supplierId || null,
      purchasePrice: parseMoneyInput(values.purchasePrice) || 0,
      salePrice: parseMoneyInput(values.salePrice) || 0,
      stock: Number(values.stock.replace(',', '.')) || 0,
      minStock: Number(values.minStock.replace(',', '.')) || 0,
      unit: values.unit as UnitOfMeasure,
      description: values.description.trim() || undefined,
      imageUrl: values.imageUrl.trim() || undefined,
    };

    if (product) {
      updateProduct(product.id, input);
      toast.success('Producto actualizado', `${input.name} se guardó correctamente.`);
    } else {
      createProduct(input);
      toast.success('Producto creado', `${input.name} · ${money(input.salePrice)}`);
    }
    setSaving(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      tourId="form-producto"
      title={isEditing ? 'Editar producto' : 'Nuevo producto'}
      description={
        isEditing
          ? 'Modificá los datos y guardá los cambios.'
          : 'Completá los datos básicos. Sólo el nombre y el precio de venta son obligatorios.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="product-form" loading={saving} icon={<Package className="h-4 w-4" />}>
            {isEditing ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              label="Nombre del producto"
              required
              autoComplete="off"
              placeholder="Ej: Bebida Cola 1.5 L"
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              error={errors.name}
            />
          </div>

          <TextField
            label="Código de barras"
            placeholder="Opcional · 7800000000011"
            inputMode="numeric"
            autoComplete="off"
            value={values.barcode}
            onChange={(e) => set('barcode', e.target.value)}
            error={errors.barcode}
            hint="Más adelante vas a poder escanearlo con la cámara."
          />

          <div className="flex flex-col gap-1.5">
            <SelectField
              label="Categoría"
              value={values.categoryId}
              onChange={(e) => set('categoryId', e.target.value)}
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            {showNewCategory ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCategory();
                    }
                  }}
                  placeholder="Nombre de la categoría"
                  aria-label="Nombre de la nueva categoría"
                  className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-sm focus-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <Button size="sm" onClick={handleAddCategory}>
                  Agregar
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewCategory(true)}
                className="inline-flex w-fit items-center gap-1 rounded-md text-xs font-medium text-brand-600 transition hover:text-brand-700 focus-ring dark:text-brand-400"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Crear categoría nueva
              </button>
            )}
          </div>

          <TextField
            label="Precio de compra"
            prefix={symbol}
            inputMode="decimal"
            placeholder="0"
            value={values.purchasePrice}
            onChange={(e) => set('purchasePrice', e.target.value)}
            error={errors.purchasePrice}
          />

          <TextField
            label="Precio de venta"
            required
            prefix={symbol}
            inputMode="decimal"
            placeholder="0"
            value={values.salePrice}
            onChange={(e) => set('salePrice', e.target.value)}
            error={errors.salePrice}
          />

          {margin && (
            <div className="sm:col-span-2 -mt-1">
              <p
                className={`text-xs font-medium ${margin.diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
              >
                Ganancia por unidad: {formatMoney(margin.diff, settings.currency)} (
                {margin.percent.toFixed(0)}%)
              </p>
            </div>
          )}

          <TextField
            label="Stock actual"
            required
            inputMode="decimal"
            value={values.stock}
            onChange={(e) => set('stock', e.target.value)}
            error={errors.stock}
          />

          <TextField
            label="Stock mínimo"
            required
            inputMode="decimal"
            value={values.minStock}
            onChange={(e) => set('minStock', e.target.value)}
            error={errors.minStock}
            hint="Debajo de este número aparece la alerta de stock bajo."
          />

          <SelectField
            label="Unidad de medida"
            value={values.unit}
            onChange={(e) => set('unit', e.target.value)}
          >
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Proveedor"
            value={values.supplierId}
            onChange={(e) => set('supplierId', e.target.value)}
          >
            <option value="">Sin proveedor</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>

          <div className="sm:col-span-2">
            <TextField
              label="Imagen (URL)"
              placeholder="Opcional · https://…"
              value={values.imageUrl}
              onChange={(e) => set('imageUrl', e.target.value)}
              error={errors.imageUrl}
            />
          </div>

          <div className="sm:col-span-2">
            <TextAreaField
              label="Descripción"
              placeholder="Opcional · notas internas del producto"
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              error={errors.description}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
