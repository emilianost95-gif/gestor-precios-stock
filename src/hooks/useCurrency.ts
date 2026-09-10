import { useCallback } from 'react';
import { useStore } from '@/context/StoreContext';
import { CURRENCIES } from '@/types';
import { formatMoney } from '@/utils/format';

/** Formateador de moneda ligado a la configuración del negocio. */
export function useCurrency() {
  const { settings } = useStore();
  const config = CURRENCIES[settings.currency] ?? CURRENCIES.CLP;

  const money = useCallback((value: number) => formatMoney(value, settings.currency), [settings.currency]);

  return { money, symbol: config.symbol, code: config.code, decimals: config.decimals };
}
