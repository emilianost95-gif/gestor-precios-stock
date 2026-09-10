import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useStore } from '@/context/StoreContext';
import { useToast } from '@/context/ToastContext';
import { csvTemplate, parseProductsCSV, type CSVImportResult } from '@/services/csvService';
import { downloadTextFile, readFileAsText } from '@/utils/file';

interface ImportCSVModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportCSVModal({ open, onClose }: ImportCSVModalProps) {
  const { importProducts } = useStore();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [result, setResult] = useState<CSVImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);

  const reset = () => {
    setResult(null);
    setFileName('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setReading(true);
    try {
      const content = await readFileAsText(file);
      setFileName(file.name);
      setResult(parseProductsCSV(content));
    } catch {
      toast.error('No se pudo leer el archivo', 'Probá con otro archivo CSV.');
    } finally {
      setReading(false);
    }
  };

  const handleImport = () => {
    if (!result || result.rows.length === 0) return;
    const summary = importProducts(result.rows);
    toast.success(
      'Importación completada',
      `${summary.created} productos nuevos · ${summary.updated} actualizados${
        summary.categoriesCreated ? ` · ${summary.categoriesCreated} categorías creadas` : ''
      }`,
    );
    handleClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="md"
      title="Importar productos desde CSV"
      description="Cargá tu catálogo existente en segundos. Validamos el archivo antes de importar nada."
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={!result || result.rows.length === 0}
            icon={<Upload className="h-4 w-4" />}
          >
            Importar {result?.rows.length ? `${result.rows.length} productos` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center dark:border-slate-700">
          <FileSpreadsheet className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {fileName ? (
              <>
                Archivo cargado: <strong>{fileName}</strong>
              </>
            ) : (
              'Seleccioná un archivo .csv con tus productos'
            )}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            id="csv-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
            <Button
              variant="secondary"
              loading={reading}
              onClick={() => inputRef.current?.click()}
              icon={<Upload className="h-4 w-4" />}
            >
              Elegir archivo
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                void downloadTextFile('plantilla_productos.csv', csvTemplate(), 'text/csv', true);
              }}
              icon={<Download className="h-4 w-4" />}
            >
              Descargar plantilla
            </Button>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          <p className="font-semibold">Columnas reconocidas</p>
          <p className="mt-1 leading-relaxed">
            nombre (obligatoria), precio_venta (obligatoria), codigo_barras, categoria, precio_compra, stock,
            stock_minimo, unidad, proveedor, descripcion. Acepta separador coma o punto y coma. Si un producto
            ya existe (mismo nombre o código), se actualiza en lugar de duplicarse.
          </p>
        </div>

        {result && (
          <div className="space-y-2">
            {result.rows.length > 0 && (
              <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                {result.rows.length} de {result.totalLines} filas listas para importar.
              </p>
            )}
            {result.errors.length > 0 && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">
                <p className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                  {result.errors.length} fila{result.errors.length === 1 ? '' : 's'} con problemas (se omiten)
                </p>
                <ul className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto text-xs">
                  {result.errors.slice(0, 20).map((err, i) => (
                    <li key={i}>
                      Línea {err.line}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.rows.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Producto</th>
                      <th className="px-3 py-2 font-medium">Precio</th>
                      <th className="px-3 py-2 font-medium">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {result.rows.slice(0, 50).map((row) => (
                      <tr key={row.line}>
                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{row.name}</td>
                        <td className="px-3 py-1.5 tabular-nums text-slate-700 dark:text-slate-300">
                          {row.salePrice}
                        </td>
                        <td className="px-3 py-1.5 tabular-nums text-slate-700 dark:text-slate-300">
                          {row.stock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
