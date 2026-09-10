import type { Category, Product, Supplier, UnitOfMeasure } from '@/types';
import { UNITS } from '@/types';
import { normalizeText, parseMoneyInput } from '@/utils/format';

/* ------------------------------------------------------------------ */
/* Exportación                                                         */
/* ------------------------------------------------------------------ */

export const CSV_HEADERS = [
  'nombre',
  'codigo_barras',
  'categoria',
  'precio_compra',
  'precio_venta',
  'stock',
  'stock_minimo',
  'unidad',
  'proveedor',
  'descripcion',
] as const;

function escapeCell(value: string | number | undefined): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",;\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function productsToCSV(
  products: Product[],
  categories: Category[],
  suppliers: Supplier[],
): string {
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '';
  const supName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? '';

  const lines = [CSV_HEADERS.join(',')];
  for (const p of products) {
    lines.push(
      [
        escapeCell(p.name),
        escapeCell(p.barcode),
        escapeCell(catName(p.categoryId)),
        escapeCell(p.purchasePrice),
        escapeCell(p.salePrice),
        escapeCell(p.stock),
        escapeCell(p.minStock),
        escapeCell(p.unit),
        escapeCell(supName(p.supplierId)),
        escapeCell(p.description),
      ].join(','),
    );
  }
  return lines.join('\n');
}

/** Plantilla vacía para que el usuario sepa qué columnas debe llenar. */
export function csvTemplate(): string {
  return [
    CSV_HEADERS.join(','),
    'Bebida Cola 1.5 L,7800000000011,Bebidas,1450,2500,12,6,unidad,Distribuidora Norte,Ejemplo de fila',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* Importación                                                         */
/* ------------------------------------------------------------------ */

export interface ParsedProductRow {
  line: number;
  name: string;
  barcode: string;
  categoryName: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  unit: UnitOfMeasure;
  supplierName: string;
  description: string;
}

export interface CSVImportResult {
  rows: ParsedProductRow[];
  errors: { line: number; message: string }[];
  totalLines: number;
}

/** Parser de CSV que soporta comillas, comas dentro de comillas y `;` como separador. */
function splitCSVLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.map((c) => c.trim());
}

function detectDelimiter(headerLine: string): string {
  const semis = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semis > commas ? ';' : ',';
}

function resolveUnit(raw: string): UnitOfMeasure {
  const value = normalizeText(raw);
  const found = UNITS.find(
    (u) => normalizeText(u.value) === value || normalizeText(u.label) === value || normalizeText(u.short) === value,
  );
  return found?.value ?? 'unidad';
}

export function parseProductsCSV(content: string): CSVImportResult {
  const errors: CSVImportResult['errors'] = [];
  const rows: ParsedProductRow[] = [];

  const clean = content.replace(/^\uFEFF/, '').trim();
  if (!clean) {
    return { rows, errors: [{ line: 0, message: 'El archivo está vacío.' }], totalLines: 0 };
  }

  const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== '');
  const delimiter = detectDelimiter(lines[0]);
  const header = splitCSVLine(lines[0], delimiter).map((h) => normalizeText(h).replace(/\s+/g, '_'));

  const idx = (names: string[]): number => header.findIndex((h) => names.includes(h));
  const iName = idx(['nombre', 'producto', 'name']);
  const iBarcode = idx(['codigo_barras', 'codigo', 'barcode', 'ean']);
  const iCategory = idx(['categoria', 'category', 'rubro']);
  const iPurchase = idx(['precio_compra', 'costo', 'purchase_price']);
  const iSale = idx(['precio_venta', 'precio', 'sale_price']);
  const iStock = idx(['stock', 'cantidad', 'existencia']);
  const iMinStock = idx(['stock_minimo', 'minimo', 'min_stock']);
  const iUnit = idx(['unidad', 'unidad_medida', 'unit']);
  const iSupplier = idx(['proveedor', 'supplier']);
  const iDescription = idx(['descripcion', 'detalle', 'description']);

  if (iName === -1) {
    return {
      rows,
      errors: [
        {
          line: 1,
          message:
            'No se encontró la columna "nombre". Descargá la plantilla CSV desde Configuración para ver el formato esperado.',
        },
      ],
      totalLines: lines.length - 1,
    };
  }
  if (iSale === -1) {
    return {
      rows,
      errors: [{ line: 1, message: 'No se encontró la columna "precio_venta".' }],
      totalLines: lines.length - 1,
    };
  }

  const seenNames = new Set<string>();

  for (let i = 1; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const cells = splitCSVLine(lines[i], delimiter);
    const get = (index: number): string => (index >= 0 ? (cells[index] ?? '') : '');

    const name = get(iName).trim();
    if (!name) {
      errors.push({ line: lineNumber, message: 'Falta el nombre del producto.' });
      continue;
    }
    if (seenNames.has(normalizeText(name))) {
      errors.push({ line: lineNumber, message: `"${name}" está repetido dentro del archivo.` });
      continue;
    }

    const salePrice = parseMoneyInput(get(iSale));
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      errors.push({ line: lineNumber, message: `Precio de venta inválido en "${name}".` });
      continue;
    }

    const purchaseRaw = get(iPurchase);
    const purchasePrice = purchaseRaw ? parseMoneyInput(purchaseRaw) : 0;
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      errors.push({ line: lineNumber, message: `Precio de compra inválido en "${name}".` });
      continue;
    }

    const stockRaw = get(iStock);
    const stock = stockRaw ? Number(stockRaw.replace(',', '.')) : 0;
    if (!Number.isFinite(stock) || stock < 0) {
      errors.push({ line: lineNumber, message: `Stock inválido en "${name}".` });
      continue;
    }

    const minRaw = get(iMinStock);
    const minStock = minRaw ? Number(minRaw.replace(',', '.')) : 0;
    if (!Number.isFinite(minStock) || minStock < 0) {
      errors.push({ line: lineNumber, message: `Stock mínimo inválido en "${name}".` });
      continue;
    }

    seenNames.add(normalizeText(name));
    rows.push({
      line: lineNumber,
      name,
      barcode: get(iBarcode).trim(),
      categoryName: get(iCategory).trim(),
      purchasePrice,
      salePrice,
      stock,
      minStock,
      unit: resolveUnit(get(iUnit)),
      supplierName: get(iSupplier).trim(),
      description: get(iDescription).trim(),
    });
  }

  return { rows, errors, totalLines: lines.length - 1 };
}
