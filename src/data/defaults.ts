import type { Settings } from '@/types';

export const DEFAULT_SETTINGS: Settings = {
  businessName: 'Mi Almacén',
  businessPhone: '',
  businessAddress: '',
  businessEmail: '',
  currency: 'CLP',
  theme: 'system',
  defaultMinStock: 5,
  lowStockAlerts: true,
  confirmBeforeDelete: true,
  updatedAt: new Date(0).toISOString(),
};

/** Paleta para categorías nuevas — accesible en claro y oscuro. */
export const CATEGORY_COLORS = [
  '#2f82ff',
  '#16a34a',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
  '#ef4444',
  '#64748b',
  '#0d9488',
  '#d97706',
];

export function pickCategoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}
