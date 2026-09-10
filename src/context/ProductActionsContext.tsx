import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ProductFormModal } from '@/components/products/ProductFormModal';
import { QuickPriceModal } from '@/components/products/QuickPriceModal';
import { ProductDetailModal } from '@/components/products/ProductDetailModal';
import { StockMovementModal } from '@/components/stock/StockMovementModal';
import { useStore } from './StoreContext';
import { useToast } from './ToastContext';
import { useConfirm } from './ConfirmContext';
import type { Product } from '@/types';

/**
 * Centraliza los flujos de producto (crear, editar, precio, stock, eliminar)
 * para que cualquier pantalla los dispare con un solo click y sin duplicar
 * modales. Es lo que hace que la app se sienta rápida.
 */
interface ProductActionsValue {
  newProduct: () => void;
  editProduct: (product: Product) => void;
  editPrice: (product: Product) => void;
  editStock: (product: Product) => void;
  viewProduct: (product: Product) => void;
  duplicateProduct: (product: Product) => void;
  deleteProduct: (product: Product) => Promise<void>;
}

const ProductActionsContext = createContext<ProductActionsValue | null>(null);

export function ProductActionsProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const toast = useToast();
  const confirm = useConfirm();

  const [formOpen, setFormOpen] = useState(false);
  const [formProduct, setFormProduct] = useState<Product | null>(null);
  const [priceProduct, setPriceProduct] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  const newProduct = useCallback(() => {
    setFormProduct(null);
    setFormOpen(true);
  }, []);

  const editProduct = useCallback((product: Product) => {
    setDetailProduct(null);
    setFormProduct(product);
    setFormOpen(true);
  }, []);

  const editPrice = useCallback((product: Product) => {
    setDetailProduct(null);
    setPriceProduct(product);
  }, []);

  const editStock = useCallback((product: Product) => {
    setDetailProduct(null);
    setStockProduct(product);
  }, []);

  const viewProduct = useCallback((product: Product) => {
    setDetailProduct(product);
  }, []);

  const duplicateProduct = useCallback(
    (product: Product) => {
      const copy = store.duplicateProduct(product.id);
      setDetailProduct(null);
      if (copy) {
        toast.success('Producto duplicado', `Se creó "${copy.name}" con stock en 0.`);
      }
    },
    [store, toast],
  );

  const deleteProduct = useCallback(
    async (product: Product) => {
      const shouldAsk = store.settings.confirmBeforeDelete;
      const confirmed =
        !shouldAsk ||
        (await confirm({
          title: 'Eliminar producto',
          message: `¿Seguro que querés eliminar "${product.name}"? Esta acción no se puede deshacer, pero su historial de movimientos se conserva.`,
          confirmLabel: 'Sí, eliminar',
          danger: true,
        }));
      if (!confirmed) return;
      store.deleteProduct(product.id);
      setDetailProduct(null);
      toast.success('Producto eliminado', `"${product.name}" ya no está en el listado.`);
    },
    [store, confirm, toast],
  );

  const value = useMemo<ProductActionsValue>(
    () => ({
      newProduct,
      editProduct,
      editPrice,
      editStock,
      viewProduct,
      duplicateProduct,
      deleteProduct,
    }),
    [newProduct, editProduct, editPrice, editStock, viewProduct, duplicateProduct, deleteProduct],
  );

  // Los modales leen siempre la versión más fresca del producto desde el store.
  const fresh = (product: Product | null) =>
    product ? (store.products.find((p) => p.id === product.id) ?? product) : null;

  return (
    <ProductActionsContext.Provider value={value}>
      {children}

      <ProductFormModal open={formOpen} onClose={() => setFormOpen(false)} product={formProduct} />

      <QuickPriceModal
        open={priceProduct !== null}
        onClose={() => setPriceProduct(null)}
        product={fresh(priceProduct)}
      />

      <StockMovementModal
        open={stockProduct !== null}
        onClose={() => setStockProduct(null)}
        product={fresh(stockProduct)}
      />

      <ProductDetailModal
        open={detailProduct !== null}
        onClose={() => setDetailProduct(null)}
        product={fresh(detailProduct)}
        onEdit={editProduct}
        onEditPrice={editPrice}
        onEditStock={editStock}
        onDuplicate={duplicateProduct}
        onDelete={(p) => void deleteProduct(p)}
      />
    </ProductActionsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProductActions(): ProductActionsValue {
  const ctx = useContext(ProductActionsContext);
  if (!ctx) throw new Error('useProductActions debe usarse dentro de <ProductActionsProvider>.');
  return ctx;
}
