import { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Monitor,
  Moon,
  Palette,
  Sparkles,
  Store,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SelectField, TextField, ToggleField } from '@/components/ui/Field';
import { ImportCSVModal } from '@/components/products/ImportCSVModal';
import { useStore } from '@/context/StoreContext';
import { useCopilot } from '@/context/CopilotContext';
import { COPILOT_API_URL } from '@/services/copilot';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import { snapshotToJSON, validateBackup, type BackupValidationResult } from '@/services/backupService';
import { csvTemplate, productsToCSV } from '@/services/csvService';
import { downloadTextFile, readFileAsText, timestampedFilename } from '@/utils/file';
import { CURRENCIES, type CurrencyCode, type ThemeMode } from '@/types';
import { formatDateTime } from '@/utils/format';

const THEMES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

export function SettingsPage() {
  const {
    settings,
    updateSettings,
    products,
    categories,
    suppliers,
    movements,
    getSnapshot,
    restoreSnapshot,
    loadDemoData,
    clearAllData,
    isDemoData,
  } = useStore();
  const toast = useToast();
  const confirm = useConfirm();
  const { aiEnabled, openCopilot } = useCopilot();

  const [importOpen, setImportOpen] = useState(false);
  const [restoreResult, setRestoreResult] = useState<BackupValidationResult | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = () => {
    downloadTextFile(
      timestampedFilename('respaldo_gestor', 'json'),
      snapshotToJSON(getSnapshot()),
      'application/json',
    );
    toast.success('Respaldo descargado', `${products.length} productos incluidos.`);
  };

  const handleExportCSV = () => {
    if (products.length === 0) {
      toast.warning('No hay productos para exportar');
      return;
    }
    downloadTextFile(
      timestampedFilename('productos', 'csv'),
      productsToCSV(products, categories, suppliers),
      'text/csv',
      true,
    );
    toast.success('CSV exportado', `${products.length} productos descargados.`);
  };

  const handleBackupFile = async (file: File) => {
    try {
      const content = await readFileAsText(file);
      const result = validateBackup(content);
      setRestoreResult(result);
      setRestoreOpen(true);
    } catch {
      toast.error('No se pudo leer el archivo');
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = '';
    }
  };

  const handleRestore = async () => {
    if (!restoreResult?.ok || !restoreResult.snapshot) return;
    const confirmed = await confirm({
      title: 'Restaurar respaldo',
      message: `Se van a reemplazar TODOS los datos actuales (${products.length} productos) por los del respaldo (${restoreResult.snapshot.products.length} productos). Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, restaurar',
      danger: true,
    });
    if (!confirmed) return;
    restoreSnapshot(restoreResult.snapshot);
    setRestoreOpen(false);
    setRestoreResult(null);
    toast.success('Respaldo restaurado', 'Los datos se reemplazaron correctamente.');
  };

  const handleLoadDemo = async () => {
    const confirmed =
      products.length === 0 ||
      (await confirm({
        title: 'Cargar datos de demostración',
        message:
          'Se van a reemplazar los datos actuales por 23 productos ficticios de ejemplo. Si tenés información real cargada, descargá un respaldo antes.',
        confirmLabel: 'Cargar demo',
        danger: true,
      }));
    if (!confirmed) return;
    loadDemoData();
    toast.success('Datos de demostración cargados', 'Todo lo que ves es ficticio.');
  };

  const handleClear = async () => {
    const confirmed = await confirm({
      title: isDemoData ? 'Limpiar datos de demostración' : 'Borrar todos los datos',
      message:
        'Se eliminan todos los productos, movimientos e historial de este dispositivo. Las categorías base se mantienen. Esta acción no se puede deshacer.',
      confirmLabel: 'Sí, limpiar',
      danger: true,
    });
    if (!confirmed) return;
    clearAllData();
    toast.success('Datos limpiados', 'Ya podés empezar a cargar tus productos reales.');
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
          Configuración
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Datos del negocio, apariencia y respaldos
        </p>
      </div>

      <Card>
        <CardHeader
          title="Datos del negocio"
          subtitle="Aparecen en el encabezado de la aplicación"
          icon={<Store className="h-4 w-4" aria-hidden />}
        />
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <TextField
            label="Nombre del negocio"
            value={settings.businessName}
            onChange={(e) => updateSettings({ businessName: e.target.value })}
            placeholder="Ej: Almacén Doña Rosa"
          />
          <TextField
            label="Teléfono"
            type="tel"
            value={settings.businessPhone ?? ''}
            onChange={(e) => updateSettings({ businessPhone: e.target.value })}
            placeholder="Opcional"
          />
          <TextField
            label="Dirección"
            value={settings.businessAddress ?? ''}
            onChange={(e) => updateSettings({ businessAddress: e.target.value })}
            placeholder="Opcional"
          />
          <TextField
            label="Email"
            type="email"
            value={settings.businessEmail ?? ''}
            onChange={(e) => updateSettings({ businessEmail: e.target.value })}
            placeholder="Opcional"
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Apariencia y moneda"
          icon={<Palette className="h-4 w-4" aria-hidden />}
        />
        <div className="space-y-4 p-4 sm:p-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Tema</legend>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => updateSettings({ theme: t.value })}
                  aria-pressed={settings.theme === t.value}
                  className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition focus-ring ${
                    settings.theme === t.value
                      ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/60 dark:text-brand-300'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <t.icon className="h-4 w-4" aria-hidden />
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>

          <SelectField
            label="Moneda"
            value={settings.currency}
            onChange={(e) => updateSettings({ currency: e.target.value as CurrencyCode })}
            hint="Cambia cómo se muestran todos los precios de la aplicación."
          >
            {Object.values(CURRENCIES).map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.symbol}
              </option>
            ))}
          </SelectField>
        </div>
      </Card>

      <Card>
        <CardHeader title="Preferencias de stock" icon={<AlertTriangle className="h-4 w-4" aria-hidden />} />
        <div className="space-y-4 p-4 sm:p-5">
          <TextField
            label="Stock mínimo por defecto"
            inputMode="numeric"
            value={String(settings.defaultMinStock)}
            onChange={(e) => {
              const value = Number(e.target.value.replace(/[^\d]/g, ''));
              updateSettings({ defaultMinStock: Number.isFinite(value) ? value : 0 });
            }}
            hint="Se usa como valor inicial al crear un producto nuevo."
          />
          <ToggleField
            label="Mostrar alertas de stock bajo"
            description="Resalta en el panel los productos por debajo del mínimo."
            checked={settings.lowStockAlerts}
            onChange={(checked) => updateSettings({ lowStockAlerts: checked })}
          />
          <ToggleField
            label="Confirmar antes de eliminar"
            description="Pide confirmación al borrar productos, categorías o proveedores."
            checked={settings.confirmBeforeDelete}
            onChange={(checked) => updateSettings({ confirmBeforeDelete: checked })}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Stock Copilot"
          subtitle="El asistente que analiza tu inventario"
          icon={<Sparkles className="h-4 w-4" aria-hidden />}
        />
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${aiEnabled ? 'bg-emerald-500' : 'bg-amber-500'}`}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {aiEnabled ? 'Conectado al servicio de IA' : 'Funcionando con análisis local'}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {aiEnabled ? (
                  <>
                    Las preguntas se procesan en tu backend (<code className="font-mono">{COPILOT_API_URL}</code>
                    ). La clave de la API vive únicamente en el servidor: nunca viaja al navegador.
                  </>
                ) : (
                  <>
                    El Copilot responde con el motor de análisis que corre en este dispositivo: no
                    necesita internet ni servidor, y tus datos no salen de acá. Para sumar respuestas
                    en lenguaje natural más flexibles, desplegá la función serverless incluida en el
                    proyecto y configurá <code className="font-mono">VITE_COPILOT_API_URL</code>.
                  </>
                )}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => openCopilot('Resumen del inventario')}
            icon={<Sparkles className="h-4 w-4" />}
          >
            Abrir el Copilot
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Importar y exportar"
          subtitle="Mové tu catálogo desde y hacia una planilla"
          icon={<FileSpreadsheet className="h-4 w-4" aria-hidden />}
        />
        <div className="flex flex-wrap gap-2 p-4 sm:p-5">
          <Button variant="secondary" onClick={handleExportCSV} icon={<Download className="h-4 w-4" />}>
            Exportar productos a CSV
          </Button>
          <Button variant="secondary" onClick={() => setImportOpen(true)} icon={<Upload className="h-4 w-4" />}>
            Importar productos desde CSV
          </Button>
          <Button
            variant="ghost"
            onClick={() => downloadTextFile('plantilla_productos.csv', csvTemplate(), 'text/csv', true)}
            icon={<FileSpreadsheet className="h-4 w-4" />}
          >
            Descargar plantilla
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Respaldo y restauración"
          subtitle={`${products.length} productos · ${categories.length} categorías · ${suppliers.length} proveedores · ${movements.length} movimientos`}
          icon={<Database className="h-4 w-4" aria-hidden />}
        />
        <div className="space-y-3 p-4 sm:p-5">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Los datos se guardan en este dispositivo. Descargá un respaldo cada cierto tiempo y guardalo en tu
            correo o en la nube: es tu seguro ante un cambio de celular o el borrado del navegador.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleExportBackup} icon={<Download className="h-4 w-4" />}>
              Exportar respaldo (JSON)
            </Button>
            <input
              ref={backupInputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              id="backup-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleBackupFile(file);
              }}
            />
            <Button
              variant="secondary"
              onClick={() => backupInputRef.current?.click()}
              icon={<Upload className="h-4 w-4" />}
            >
              Restaurar respaldo
            </Button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Última modificación de la configuración: {formatDateTime(settings.updatedAt)}
          </p>
        </div>
      </Card>

      <Card className="border-amber-200 dark:border-amber-900/60">
        <CardHeader
          title="Datos de demostración"
          subtitle="Productos ficticios para probar el sistema"
          icon={<Sparkles className="h-4 w-4" aria-hidden />}
        />
        <div className="flex flex-wrap gap-2 p-4 sm:p-5">
          <Button variant="secondary" onClick={() => void handleLoadDemo()} icon={<Sparkles className="h-4 w-4" />}>
            Cargar datos de demostración
          </Button>
          <Button variant="danger" onClick={() => void handleClear()} icon={<Trash2 className="h-4 w-4" />}>
            {isDemoData ? 'Limpiar datos de demostración' : 'Borrar todos los datos'}
          </Button>
        </div>
      </Card>

      <ImportCSVModal open={importOpen} onClose={() => setImportOpen(false)} />

      <Modal
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        size="sm"
        title="Revisar respaldo"
        description="Validamos el archivo antes de reemplazar nada."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRestoreOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void handleRestore()} disabled={!restoreResult?.ok}>
              Restaurar y reemplazar
            </Button>
          </>
        }
      >
        {restoreResult?.ok && restoreResult.summary ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              Archivo válido.
            </p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Productos</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">
                  {restoreResult.summary.products}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Categorías</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">
                  {restoreResult.summary.categories}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Proveedores</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">
                  {restoreResult.summary.suppliers}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Movimientos</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">
                  {restoreResult.summary.movements}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-500 dark:text-slate-400">Exportado el</dt>
                <dd className="text-slate-700 dark:text-slate-300">
                  {formatDateTime(restoreResult.summary.exportedAt)}
                </dd>
              </div>
            </dl>
            {restoreResult.warnings.length > 0 && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                <p className="font-medium">Avisos</p>
                <ul className="mt-1 space-y-0.5">
                  {restoreResult.warnings.slice(0, 8).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              El archivo no se puede restaurar
            </p>
            <ul className="mt-1.5 space-y-0.5 text-xs">
              {restoreResult?.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
}
