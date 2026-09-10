import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNativeApp } from '@/native/platform';

/**
 * Resultado de guardar un archivo, para que quien lo pidió pueda avisar al
 * usuario dónde quedó. En el navegador siempre es una descarga; en Android el
 * archivo se escribe en Documentos y se ofrece compartirlo.
 */
export type SaveOutcome =
  | { kind: 'descarga' }
  | { kind: 'archivo'; carpeta: string; compartido: boolean };

/** Descarga un contenido de texto como archivo (camino web). */
function downloadInBrowser(filename: string, payload: string, mime: string): void {
  const blob = new Blob([payload], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Guarda un contenido de texto como archivo.
 *
 * En el navegador dispara la descarga de siempre. Dentro de la app de Android
 * la descarga por `<a download>` no funciona: el archivo se escribe en la
 * carpeta propia de la aplicación y se abre el menú de compartir, que es como
 * un usuario espera mandarse un respaldo por WhatsApp o guardarlo en Drive.
 *
 * Se usa `Directory.External` (la carpeta privada de la app en el
 * almacenamiento externo) y no la carpeta Documentos pública porque desde
 * Android 11 esa última ya no se puede escribir sin permisos especiales.
 */
export async function downloadTextFile(
  filename: string,
  content: string,
  mime = 'text/plain',
  withBOM = false,
): Promise<SaveOutcome> {
  // El BOM hace que Excel abra los CSV con acentos correctamente.
  const payload = withBOM ? `\uFEFF${content}` : content;

  if (!isNativeApp()) {
    downloadInBrowser(filename, payload, mime);
    return { kind: 'descarga' };
  }

  const written = await Filesystem.writeFile({
    path: filename,
    data: payload,
    directory: Directory.External,
    encoding: Encoding.UTF8,
    recursive: true,
  });

  // Compartir es opcional: si el usuario cancela, el archivo ya está guardado.
  let compartido = false;
  try {
    await Share.share({
      title: filename,
      text: `Archivo generado por Precios y Stock: ${filename}`,
      url: written.uri,
      dialogTitle: 'Guardar o compartir',
    });
    compartido = true;
  } catch {
    compartido = false;
  }

  return { kind: 'archivo', carpeta: 'archivos de la app', compartido };
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsText(file, 'UTF-8');
  });
}

export function timestampedFilename(prefix: string, extension: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${prefix}_${stamp}.${extension}`;
}

/**
 * Frase corta para el aviso posterior a guardar, en las palabras del usuario.
 * Evita repetir el mismo `if (nativo)` en cada pantalla que exporta algo.
 */
export function describeSaveOutcome(outcome: SaveOutcome): string {
  if (outcome.kind === 'descarga') return 'Se descargó a tu carpeta de descargas.';
  if (outcome.compartido) return 'Elegí dónde guardarlo o a quién enviarlo.';
  return `Quedó guardado en los ${outcome.carpeta}.`;
}
