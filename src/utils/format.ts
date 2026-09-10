import { CURRENCIES, type CurrencyCode } from '@/types';

/** Formatea un monto según la moneda configurada. CLP no usa decimales. */
export function formatMoney(value: number, currency: CurrencyCode = 'CLP'): string {
  const cfg = CURRENCIES[currency] ?? CURRENCIES.CLP;
  const safe = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat(cfg.locale, {
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals,
  }).format(safe);
  return `${cfg.symbol}${formatted}`;
}

/** Formatea un número simple (stock, cantidades). */
export function formatNumber(value: number, locale = 'es-CL'): string {
  const safe = Number.isFinite(value) ? value : 0;
  const decimals = Number.isInteger(safe) ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(1).replace('.0', '')}%`;
}

const DATE_FMT = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const TIME_FMT = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return DATE_FMT.format(d);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${DATE_FMT.format(d)} · ${TIME_FMT.format(d)}`;
}

/** "hace 5 minutos", "ayer", etc. */
export function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  return formatDate(iso);
}

export function isSameDay(iso: string, reference = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === reference.getFullYear() &&
    d.getMonth() === reference.getMonth() &&
    d.getDate() === reference.getDate()
  );
}

/** Quita tildes y pasa a minúsculas: permite buscar "cocacola" y encontrar "Coca Cola". */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Convierte un texto de precio escrito por el usuario ("2.700", "$2700") a número. */
export function parseMoneyInput(raw: string): number {
  if (typeof raw === 'number') return raw;
  const cleaned = String(raw)
    .replace(/[^\d,.-]/g, '')
    .trim();
  if (!cleaned) return NaN;
  // Si tiene coma decimal al final (formato es-AR: 1.234,56)
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let normalized = cleaned;
  if (hasComma && hasDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  } else if (hasDot) {
    // "2.500" en CLP es dos mil quinientos, no 2,5.
    const parts = cleaned.split('.');
    const lastPart = parts[parts.length - 1];
    if (parts.length > 2 || lastPart.length === 3) {
      normalized = cleaned.replace(/\./g, '');
    }
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : NaN;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
