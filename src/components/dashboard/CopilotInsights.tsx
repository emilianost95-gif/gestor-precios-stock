import { AlertTriangle, ArrowRight, CheckCircle2, Coins, Flame, Package, Sparkles, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useCopilot } from '@/context/CopilotContext';
import type { InsightCard, InsightTone } from '@/services/copilot';

const ICONS = {
  alert: AlertTriangle,
  flame: Flame,
  money: Coins,
  'trending-down': TrendingDown,
  package: Package,
} as const;

const TONES: Record<InsightTone, { badge: string; ring: string }> = {
  critico: {
    badge: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
    ring: 'hover:border-red-300 dark:hover:border-red-800',
  },
  atencion: {
    badge: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    ring: 'hover:border-amber-300 dark:hover:border-amber-800',
  },
  positivo: {
    badge: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    ring: 'hover:border-emerald-300 dark:hover:border-emerald-800',
  },
  neutral: {
    badge: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    ring: 'hover:border-slate-300 dark:hover:border-slate-700',
  },
};

/**
 * "Insights del Copilot": lo que el análisis local encontró sin que el usuario
 * pregunte. Cada tarjeta abre el Copilot con la consulta correspondiente.
 * Si no hay nada que señalar, muestra un estado tranquilo en vez de relleno.
 */
export function CopilotInsights() {
  const { insightCards, openCopilot } = useCopilot();

  return (
    <section data-tour="insights-copilot" aria-labelledby="insights-title">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2
          id="insights-title"
          className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
          </span>
          Insights del Copilot
        </h2>
        <button
          type="button"
          onClick={() => openCopilot('Resumen del inventario')}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition hover:bg-brand-50 focus-ring dark:text-brand-400 dark:hover:bg-brand-950/50"
        >
          Ver resumen completo
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {insightCards.length === 0 ? (
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              No encontré nada urgente
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              El stock está por encima del mínimo y los márgenes se ven razonables. Igual podés
              preguntarme lo que quieras.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {insightCards.map((card) => (
            <InsightTile key={card.id} card={card} onOpen={() => openCopilot(card.prompt)} />
          ))}
        </div>
      )}
    </section>
  );
}

function InsightTile({ card, onOpen }: { card: InsightCard; onOpen: () => void }) {
  const Icon = ICONS[card.icon];
  const tone = TONES[card.tone];

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-card transition hover:shadow-pop focus-ring dark:border-slate-800 dark:bg-slate-900 ${tone.ring}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone.badge}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <ArrowRight
          className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500 dark:text-slate-600"
          aria-hidden
        />
      </div>
      <p className="mt-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">{card.title}</p>
      <p className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        {card.value}
      </p>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {card.description}
      </p>
    </button>
  );
}
