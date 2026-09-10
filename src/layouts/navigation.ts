import {
  ClipboardList,
  History,
  LayoutDashboard,
  Package,
  Settings,
  Tags,
  Truck,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface NavItem {
  to: string;
  label: string;
  shortLabel: string;
  icon: ComponentType<{ className?: string }>;
  /** Se muestra en la barra inferior del móvil. */
  primary: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Inicio', shortLabel: 'Inicio', icon: LayoutDashboard, primary: true },
  { to: '/productos', label: 'Productos', shortLabel: 'Productos', icon: Package, primary: true },
  { to: '/stock', label: 'Stock y alertas', shortLabel: 'Stock', icon: ClipboardList, primary: true },
  { to: '/categorias', label: 'Categorías', shortLabel: 'Categorías', icon: Tags, primary: false },
  { to: '/proveedores', label: 'Proveedores', shortLabel: 'Proveedores', icon: Truck, primary: false },
  { to: '/historial', label: 'Historial', shortLabel: 'Historial', icon: History, primary: false },
  { to: '/configuracion', label: 'Configuración', shortLabel: 'Ajustes', icon: Settings, primary: false },
];
