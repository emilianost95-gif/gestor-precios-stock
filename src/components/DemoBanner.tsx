import { Info, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/context/StoreContext';

/** Aviso permanente y visible de que los datos cargados son ficticios. */
export function DemoBanner() {
  const { isDemoData } = useStore();
  const [dismissed, setDismissed] = useState(false);

  if (!isDemoData || dismissed) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-900/60 dark:bg-brand-950/40">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
      <p className="flex-1 text-xs leading-relaxed text-brand-900 dark:text-brand-200">
        Estás viendo <strong>datos de demostración ficticios</strong>. Podés probar todo sin miedo. Cuando
        quieras empezar en serio, andá a{' '}
        <Link to="/configuracion" className="font-semibold underline underline-offset-2">
          Configuración
        </Link>{' '}
        y tocá “Limpiar datos de demostración”.
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Ocultar aviso"
        className="rounded-md p-1 text-brand-500 transition hover:text-brand-700 focus-ring dark:hover:text-brand-300"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
