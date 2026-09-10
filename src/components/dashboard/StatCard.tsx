import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  hint?: string;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
  to?: string;
  tourId?: string;
}

const TONES = {
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
} as const;

export function StatCard({ label, value, icon, hint, tone = 'neutral', to, tourId }: StatCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONES[tone]}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-slate-50">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </>
  );

  const className =
    'block rounded-2xl border border-slate-200 bg-white p-4 shadow-card transition dark:border-slate-800 dark:bg-slate-900';

  if (to) {
    return (
      <Link
        to={to}
        data-tour={tourId}
        className={`${className} hover:border-brand-300 hover:shadow-pop focus-ring dark:hover:border-brand-800`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div data-tour={tourId} className={className}>
      {content}
    </div>
  );
}
