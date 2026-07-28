'use client';

import { useToast } from './Toast';

type Tx = { date: string; description: string; type: string; amount: number; status: string };
type Invoice = { no: string; date: string; amount: number; status: string };

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function downloadBlob(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Export the credit transaction history as a CSV file. */
export function ExportTransactionsButton({ rows }: { rows: Tx[] }) {
  const toast = useToast();
  const handle = () => {
    const header = ['Date', 'Description', 'Type', 'Amount (USD)', 'Status'];
    const lines = rows.map((t) => [t.date, t.description, t.type, t.amount, t.status].map(csvCell).join(','));
    downloadBlob('heva-credit-transactions.csv', [header.join(','), ...lines].join('\n'), 'text/csv;charset=utf-8');
    toast(`Exported ${rows.length} transactions`);
  };
  return <button onClick={handle} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"><i className="ph-bold ph-download-simple" aria-hidden /> Export CSV</button>;
}

/** Open a print-ready invoice (browser "Save as PDF" produces the PDF). */
export function InvoicePdfButton({ invoice }: { invoice: Invoice }) {
  const toast = useToast();
  const handle = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${invoice.no}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a;margin:48px;}
  h1{font-size:22px;margin:0 0 4px;} .muted{color:#64748b;font-size:13px;}
  .row{display:flex;justify-content:space-between;margin-top:32px;}
  table{width:100%;border-collapse:collapse;margin-top:32px;font-size:14px;}
  th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #e2e8f0;}
  td.r,th.r{text-align:right;} .total{font-size:18px;font-weight:700;}
</style></head><body>
  <h1>HevaSEO Inc.</h1>
  <p class="muted">Tax ID 0312345678 · billing@hevaseo.com</p>
  <div class="row">
    <div><div class="muted">Billed to</div><div>HevaShop Store · huy@hevashop.com</div></div>
    <div style="text-align:right"><div class="muted">Invoice</div><div><b>${invoice.no}</b></div><div class="muted">${invoice.date}</div></div>
  </div>
  <table>
    <thead><tr><th>Description</th><th class="r">Amount</th></tr></thead>
    <tbody><tr><td>Credit top-up</td><td class="r">$${invoice.amount}</td></tr></tbody>
    <tfoot><tr><td class="total">Total</td><td class="r total">$${invoice.amount}</td></tr></tfoot>
  </table>
  <p class="muted" style="margin-top:40px">Thank you for your business. Paid via card · Stripe.</p>
</body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    toast(`Invoice ${invoice.no} ready`);
    setTimeout(() => iframe.remove(), 1000);
  };
  return <button onClick={handle} className="pdf-btn inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><i className="ph-bold ph-file-pdf" aria-hidden /> PDF</button>;
}
