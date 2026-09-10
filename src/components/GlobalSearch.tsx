import { useEffect, useMemo, useRef, useState } from 'react';
import { Barcode, DollarSign, Package, Search, X } from 'lucide-react';
import { useProductViews } from '@/hooks/useProducts';
import { useProductActions } from '@/context/ProductActionsContext';
import { useCurrency } from '@/hooks/useCurrency';
import { matchesSearch } from '@/services/productService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatNumber } from '@/utils/format';

const MAX_RESULTS = 8;

export function GlobalSearch() {
  const products = useProductViews();
  const { viewProduct, editPrice, editStock } = useProductActions();
  const { money } = useCurrency();

  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debounced = useDebounce(term, 120);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!debounced.trim()) return [];
    return products.filter((p) => matchesSearch(p, debounced)).slice(0, MAX_RESULTS);
  }, [products, debounced]);

  useEffect(() => setActiveIndex(0), [debounced]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typingElsewhere =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (event.key === '/' && !typingElsewhere) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const close = () => {
    setOpen(false);
    setTerm('');
    inputRef.current?.blur();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const product = results[activeIndex];
      if (product) {
        viewProduct(product);
        close();
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <label htmlFor="global-search" className="sr-only">
        Buscar productos por nombre, código de barras o categoría
      </label>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        ref={inputRef}
        id="global-search"
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="global-search-results"
        aria-autocomplete="list"
        autoComplete="off"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar producto, código o categoría…"
        className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
      {term && (
        <button
          type="button"
          onClick={close}
          aria-label="Limpiar búsqueda"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-600 focus-ring dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}

      {open && debounced.trim() !== '' && (
        <div
          id="global-search-results"
          role="listbox"
          aria-label="Resultados de búsqueda"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-pop animate-slide-up dark:border-slate-800 dark:bg-slate-900"
        >
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No se encontraron productos para “{debounced}”.
            </p>
          ) : (
            results.map((product, index) => (
              <div
                key={product.id}
                role="option"
                aria-selected={index === activeIndex}
                className={`flex items-center gap-2 rounded-xl px-2 py-2 ${
                  index === activeIndex ? 'bg-slate-100 dark:bg-slate-800' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    viewProduct(product);
                    close();
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-ring"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${product.categoryColor}1f`, color: product.categoryColor }}
                  >
                    <Package className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {product.name}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="tabular-nums">{money(product.salePrice)}</span>
                      <span aria-hidden>·</span>
                      <span
                        className={
                          product.isOutOfStock
                            ? 'text-red-600 dark:text-red-400'
                            : product.isLowStock
                              ? 'text-amber-600 dark:text-amber-400'
                              : ''
                        }
                      >
                        Stock {formatNumber(product.stock)}
                      </span>
                      {product.barcode && (
                        <span className="hidden items-center gap-1 font-mono sm:inline-flex">
                          <Barcode className="h-3 w-3" aria-hidden />
                          {product.barcode}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Editar precio de ${product.name}`}
                  title="Editar precio"
                  onClick={() => {
                    editPrice(product);
                    close();
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-brand-50 hover:text-brand-600 focus-ring dark:hover:bg-brand-950/50 dark:hover:text-brand-400"
                >
                  <DollarSign className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Ajustar stock de ${product.name}`}
                  title="Ajustar stock"
                  onClick={() => {
                    editStock(product);
                    close();
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-brand-50 hover:text-brand-600 focus-ring dark:hover:bg-brand-950/50 dark:hover:text-brand-400"
                >
                  <Package className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
