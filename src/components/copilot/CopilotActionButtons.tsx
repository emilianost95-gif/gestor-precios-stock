import {
  ArrowRight,
  DollarSign,
  Eye,
  GraduationCap,
  ListFilter,
  Package,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import type { CopilotUiAction } from '@/services/copilot';

const ICONS = {
  ver: Eye,
  precio: DollarSign,
  stock: Package,
  tutorial: GraduationCap,
  filtro: ListFilter,
  analizar: Sparkles,
  agregar: Plus,
  buscar: Search,
} as const;

interface CopilotActionButtonsProps {
  actions: CopilotUiAction[];
  onRun: (action: CopilotUiAction) => void;
  /** 'inline' dentro de una burbuja · 'panel' en la cabecera del Copiloto. */
  variant?: 'inline' | 'panel';
}

/** Botones que convierten una respuesta en algo que se puede hacer. */
export function CopilotActionButtons({ actions, onRun, variant = 'inline' }: CopilotActionButtonsProps) {
  if (actions.length === 0) return null;

  if (variant === 'panel') {
    return (
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = action.icon ? ICONS[action.icon] : ArrowRight;
          return (
            <button
              key={action.label}
              type="button"
              onClick={() => onRun(action)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/60 focus-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-800 dark:hover:bg-brand-950/40"
            >
              <Icon className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
              <span className="min-w-0 flex-1">{action.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {actions.map((action) => {
        const Icon = action.icon ? ICONS[action.icon] : ArrowRight;
        return (
          <button
            key={action.label}
            type="button"
            onClick={() => onRun(action)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 focus-ring dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-300 dark:hover:bg-brand-900/60"
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
