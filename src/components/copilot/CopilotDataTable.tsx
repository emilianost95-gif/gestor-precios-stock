import type { CopilotTable } from '@/services/copilot';

/** Tabla compacta para respuestas del Copilot. Scrollea sola en móvil. */
export function CopilotDataTable({ table }: { table: CopilotTable }) {
  if (table.rows.length === 0) return null;

  return (
    <figure className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="max-h-72 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`whitespace-nowrap px-3 py-2 font-medium ${
                    column.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {table.rows.map((row, index) => (
              <tr key={index} className="bg-white dark:bg-slate-900">
                {table.columns.map((column) => (
                  <td
                    key={column.key}
                    className={`whitespace-nowrap px-3 py-1.5 ${
                      column.align === 'right'
                        ? 'text-right tabular-nums text-slate-900 dark:text-slate-100'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.caption && (
        <figcaption className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
          {table.caption}
        </figcaption>
      )}
    </figure>
  );
}
