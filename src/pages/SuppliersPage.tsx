import { useMemo, useState } from 'react';
import { Mail, Pencil, Phone, Plus, Trash2, Truck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { useStore } from '@/context/StoreContext';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import { hasErrors, validateSupplier } from '@/utils/validation';
import type { Supplier } from '@/types';

interface FormState {
  name: string;
  company: string;
  phone: string;
  email: string;
  notes: string;
}

const EMPTY: FormState = { name: '', company: '', phone: '', email: '', notes: '' };

export function SuppliersPage() {
  const { suppliers, products, createSupplier, updateSupplier, deleteSupplier, settings } = useStore();
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [values, setValues] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const countBySupplier = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products) {
      if (!product.supplierId) continue;
      map.set(product.supplierId, (map.get(product.supplierId) ?? 0) + 1);
    }
    return map;
  }, [products]);

  const set = <K extends keyof FormState>(key: K, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const openNew = () => {
    setEditing(null);
    setValues(EMPTY);
    setErrors({});
    setOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setValues({
      name: supplier.name,
      company: supplier.company ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      notes: supplier.notes ?? '',
    });
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateSupplier(values);
    setErrors(validation);
    if (hasErrors(validation)) return;

    const payload = {
      name: values.name.trim(),
      company: values.company.trim() || undefined,
      phone: values.phone.trim() || undefined,
      email: values.email.trim() || undefined,
      notes: values.notes.trim() || undefined,
    };

    if (editing) {
      updateSupplier(editing.id, payload);
      toast.success('Proveedor actualizado', payload.name);
    } else {
      createSupplier(payload);
      toast.success('Proveedor creado', payload.name);
    }
    setOpen(false);
  };

  const handleDelete = async (supplier: Supplier) => {
    const count = countBySupplier.get(supplier.id) ?? 0;
    const confirmed =
      !settings.confirmBeforeDelete ||
      (await confirm({
        title: 'Eliminar proveedor',
        message:
          count > 0
            ? `"${supplier.name}" está asociado a ${count} producto${count === 1 ? '' : 's'}. Esos productos quedan sin proveedor (no se borran).`
            : `¿Eliminar el proveedor "${supplier.name}"?`,
        confirmLabel: 'Sí, eliminar',
        danger: true,
      }));
    if (!confirmed) return;
    deleteSupplier(supplier.id);
    toast.success('Proveedor eliminado', supplier.name);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
            Proveedores
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {suppliers.length} proveedor{suppliers.length === 1 ? '' : 'es'} registrado
            {suppliers.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button onClick={openNew} icon={<Plus className="h-4 w-4" />}>
          Nuevo
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Truck className="h-7 w-7" aria-hidden />}
            title="Todavía no hay proveedores"
            description="Guardá los datos de contacto de quienes te abastecen para tenerlos a mano cuando necesites reponer."
            action={
              <Button onClick={openNew} icon={<Plus className="h-4 w-4" />}>
                Agregar proveedor
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((supplier) => (
            <Card key={supplier.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <Truck className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">{supplier.name}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {supplier.company || `${countBySupplier.get(supplier.id) ?? 0} productos`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton label={`Editar ${supplier.name}`} onClick={() => openEdit(supplier)}>
                    <Pencil className="h-4 w-4" aria-hidden />
                  </IconButton>
                  <IconButton
                    label={`Eliminar ${supplier.name}`}
                    onClick={() => void handleDelete(supplier)}
                    className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </IconButton>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-xs">
                {supplier.phone && (
                  <a
                    href={`tel:${supplier.phone.replace(/\s/g, '')}`}
                    className="flex items-center gap-2 rounded text-slate-600 transition hover:text-brand-600 focus-ring dark:text-slate-300 dark:hover:text-brand-400"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden />
                    {supplier.phone}
                  </a>
                )}
                {supplier.email && (
                  <a
                    href={`mailto:${supplier.email}`}
                    className="flex items-center gap-2 truncate rounded text-slate-600 transition hover:text-brand-600 focus-ring dark:text-slate-300 dark:hover:text-brand-400"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{supplier.email}</span>
                  </a>
                )}
                {supplier.notes && (
                  <p className="border-t border-slate-200 pt-2 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    {supplier.notes}
                  </p>
                )}
              </div>

              <p className="mt-3 border-t border-slate-200 pt-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {countBySupplier.get(supplier.id) ?? 0} producto
                {(countBySupplier.get(supplier.id) ?? 0) === 1 ? '' : 's'} asociado
                {(countBySupplier.get(supplier.id) ?? 0) === 1 ? '' : 's'}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="supplier-form">
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </>
        }
      >
        <form id="supplier-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          <TextField
            label="Nombre"
            required
            autoComplete="off"
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            error={errors.name}
            placeholder="Ej: Distribuidora Norte"
          />
          <TextField
            label="Empresa"
            value={values.company}
            onChange={(e) => set('company', e.target.value)}
            placeholder="Opcional"
          />
          <TextField
            label="Teléfono"
            type="tel"
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
            error={errors.phone}
            placeholder="+56 9 1234 5678"
          />
          <TextField
            label="Email"
            type="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            error={errors.email}
            placeholder="ventas@proveedor.cl"
          />
          <TextAreaField
            label="Notas"
            value={values.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Días de reparto, condiciones de pago, pedido mínimo…"
          />
        </form>
      </Modal>
    </div>
  );
}
