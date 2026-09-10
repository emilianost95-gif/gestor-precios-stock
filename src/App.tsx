import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { StoreProvider, useStore } from '@/context/StoreContext';
import { ToastProvider } from '@/context/ToastContext';
import { ConfirmProvider } from '@/context/ConfirmContext';
import { ProductActionsProvider } from '@/context/ProductActionsContext';
import { CopilotProvider } from '@/context/CopilotContext';
import { AppLayout } from '@/layouts/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { StockPage } from '@/pages/StockPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { SuppliersPage } from '@/pages/SuppliersPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { useApplyTheme } from '@/hooks/useTheme';

/** Aplica el tema guardado. Vive dentro del StoreProvider a propósito. */
function ThemeGate({ children }: { children: React.ReactNode }) {
  const { settings } = useStore();
  useApplyTheme(settings.theme);
  return <>{children}</>;
}

export default function App() {
  return (
    <StoreProvider>
      <ThemeGate>
        <ToastProvider>
          <ConfirmProvider>
            <HashRouter>
              <ProductActionsProvider>
                <CopilotProvider>
                  <Routes>
                    <Route element={<AppLayout />}>
                      <Route index element={<DashboardPage />} />
                      <Route path="productos" element={<ProductsPage />} />
                      <Route path="stock" element={<StockPage />} />
                      <Route path="categorias" element={<CategoriesPage />} />
                      <Route path="proveedores" element={<SuppliersPage />} />
                      <Route path="historial" element={<HistoryPage />} />
                      <Route path="configuracion" element={<SettingsPage />} />
                      <Route path="404" element={<NotFoundPage />} />
                      <Route path="*" element={<Navigate to="/404" replace />} />
                    </Route>
                  </Routes>
                </CopilotProvider>
              </ProductActionsProvider>
            </HashRouter>
          </ConfirmProvider>
        </ToastProvider>
      </ThemeGate>
    </StoreProvider>
  );
}
