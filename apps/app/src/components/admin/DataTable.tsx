import type { ReactNode } from 'react';

export interface Column<T> { key: string; header: string; align?: 'left' | 'right'; render: (row: T) => ReactNode; }

export function DataTable<T extends { id: string }>({ columns, rows, onRowHref }: { columns: Column<T>[]; rows: T[]; onRowHref?: (row: T) => string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {columns.map((c) => <th key={c.key} className={`p-3 ${c.align === 'right' ? 'text-right' : ''}`}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border/50 transition hover:bg-muted/40">
              {columns.map((c) => {
                const cell = <span>{c.render(row)}</span>;
                return (
                  <td key={c.key} className={`p-3 ${c.align === 'right' ? 'text-right' : ''}`}>
                    {onRowHref ? <a href={onRowHref(row)} className="block">{cell}</a> : cell}
                  </td>
                );
              })}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={columns.length} className="p-6 text-center text-muted-foreground">Nothing here yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
