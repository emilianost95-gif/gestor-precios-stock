import type { Product } from '@/types';
import { normalizeText, parseMoneyInput } from './format';

export type ValidationErrors<T> = Partial<Record<keyof T, string>>;

export interface ProductFormValues {
  name: string;
  barcode: string;
  categoryId: string;
  purchasePrice: string;
  salePrice: string;
  stock: string;
  minStock: string;
  unit: string;
  supplierId: string;
  description: string;
  imageUrl: string;
}

interface ValidateProductOptions {
  /** Productos existentes, para detectar duplicados de nombre/código. */
  existing: Product[];
  /** Id del producto que se está editando (se excluye de la comparación). */
  currentId?: string;
}

export function validateProductForm(
  values: ProductFormValues,
  { existing, currentId }: ValidateProductOptions,
): ValidationErrors<ProductFormValues> {
  const errors: ValidationErrors<ProductFormValues> = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = 'El nombre es obligatorio.';
  } else if (name.length < 2) {
    errors.name = 'El nombre debe tener al menos 2 caracteres.';
  } else if (name.length > 80) {
    errors.name = 'El nombre no puede superar los 80 caracteres.';
  } else {
    const duplicated = existing.some(
      (p) => p.id !== currentId && normalizeText(p.name) === normalizeText(name),
    );
    if (duplicated) errors.name = 'Ya existe un producto con ese nombre.';
  }

  const barcode = values.barcode.trim();
  if (barcode) {
    if (!/^[0-9A-Za-z-]{3,20}$/.test(barcode)) {
      errors.barcode = 'El código debe tener entre 3 y 20 caracteres (números, letras o guiones).';
    } else {
      const duplicated = existing.some(
        (p) => p.id !== currentId && p.barcode && normalizeText(p.barcode) === normalizeText(barcode),
      );
      if (duplicated) errors.barcode = 'Ese código de barras ya está en uso.';
    }
  }

  const salePrice = parseMoneyInput(values.salePrice);
  if (values.salePrice.trim() === '') {
    errors.salePrice = 'El precio de venta es obligatorio.';
  } else if (!Number.isFinite(salePrice) || salePrice < 0) {
    errors.salePrice = 'Ingresá un precio de venta válido (mayor o igual a 0).';
  } else if (salePrice > 99_999_999) {
    errors.salePrice = 'El precio es demasiado alto.';
  }

  if (values.purchasePrice.trim() !== '') {
    const purchase = parseMoneyInput(values.purchasePrice);
    if (!Number.isFinite(purchase) || purchase < 0) {
      errors.purchasePrice = 'Ingresá un precio de compra válido.';
    } else if (purchase > 99_999_999) {
      errors.purchasePrice = 'El precio de compra es demasiado alto.';
    }
  }

  const stock = Number(values.stock.replace(',', '.'));
  if (values.stock.trim() === '') {
    errors.stock = 'El stock es obligatorio.';
  } else if (!Number.isFinite(stock) || stock < 0) {
    errors.stock = 'El stock debe ser un número mayor o igual a 0.';
  } else if (stock > 1_000_000) {
    errors.stock = 'El stock es demasiado alto.';
  }

  const minStock = Number(values.minStock.replace(',', '.'));
  if (values.minStock.trim() === '') {
    errors.minStock = 'El stock mínimo es obligatorio.';
  } else if (!Number.isFinite(minStock) || minStock < 0) {
    errors.minStock = 'El stock mínimo debe ser un número mayor o igual a 0.';
  } else if (minStock > 1_000_000) {
    errors.minStock = 'El stock mínimo es demasiado alto.';
  }

  if (values.imageUrl.trim() && !/^https?:\/\/.+/i.test(values.imageUrl.trim())) {
    errors.imageUrl = 'La URL de la imagen debe empezar con http:// o https://';
  }

  if (values.description.length > 500) {
    errors.description = 'La descripción no puede superar los 500 caracteres.';
  }

  return errors;
}

export function validatePriceInput(raw: string): { value: number; error?: string } {
  if (!raw.trim()) return { value: NaN, error: 'Ingresá un precio.' };
  const value = parseMoneyInput(raw);
  if (!Number.isFinite(value)) return { value: NaN, error: 'El precio no es válido.' };
  if (value < 0) return { value: NaN, error: 'El precio no puede ser negativo.' };
  if (value > 99_999_999) return { value: NaN, error: 'El precio es demasiado alto.' };
  return { value };
}

export function validateQuantityInput(raw: string): { value: number; error?: string } {
  if (!raw.trim()) return { value: NaN, error: 'Ingresá una cantidad.' };
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value)) return { value: NaN, error: 'La cantidad no es válida.' };
  if (value <= 0) return { value: NaN, error: 'La cantidad debe ser mayor a 0.' };
  if (value > 1_000_000) return { value: NaN, error: 'La cantidad es demasiado alta.' };
  return { value };
}

export function validateCategoryName(
  name: string,
  existingNames: string[],
): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return 'El nombre de la categoría es obligatorio.';
  if (trimmed.length > 40) return 'El nombre no puede superar los 40 caracteres.';
  if (existingNames.some((n) => normalizeText(n) === normalizeText(trimmed))) {
    return 'Ya existe una categoría con ese nombre.';
  }
  return undefined;
}

export function validateSupplier(values: {
  name: string;
  email: string;
  phone: string;
}): ValidationErrors<{ name: string; email: string; phone: string }> {
  const errors: ValidationErrors<{ name: string; email: string; phone: string }> = {};
  if (!values.name.trim()) errors.name = 'El nombre del proveedor es obligatorio.';
  else if (values.name.trim().length > 60) errors.name = 'El nombre es demasiado largo.';

  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'El email no tiene un formato válido.';
  }
  if (values.phone.trim() && !/^[+\d\s()-]{6,20}$/.test(values.phone.trim())) {
    errors.phone = 'El teléfono no tiene un formato válido.';
  }
  return errors;
}

export function hasErrors(errors: Record<string, unknown>): boolean {
  return Object.values(errors).some(Boolean);
}
