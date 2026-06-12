import { TopUp } from '@/components/TopUp';
import { CREDIT_BALANCE, TRANSACTIONS, INVOICES } from '@/data/mock';

export const metadata = { title: 'Credit & Invoices' };

const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n)}`;

export default function CreditPage() {
  const toppedUp = TRANSACTIONS.filter((t) => t.type === 'topup').reduce((s, t) => s + t.amount, 0);
  const used = TRANSACTIONS.filter((t) => t.type === 'order').reduce((s, t) => s + Math.abs(t.amount), 0);
  const topupCount = TRANSACTIONS.filter((t) => t.type === 'topup').length;
  const orderCount = TRANSACTIONS.filter((t) => t.type === 'order').length;

  return (
    <>
      <div>
        <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">Credit &amp; Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">Top up credits by bank transfer, and view your transaction history and invoices.</p>
      </div>

      {/* balance */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 sm:col-span-1">
          <div className="flex items-center justify-between"><p className="text-xs font-medium text-muted-foreground">Credit balance</p><span className="pill" style={{ background: '#f59e0b1f', color: '#d97706' }}>VIP</span></div>
          <p className="display mt-1 text-3xl font-semibold tracking-tight">${CREDIT_BALANCE}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">≈ 12 days of work</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Topped up this month</p>
          <p className="display mt-1 text-2xl font-semibold tracking-tight">${toppedUp}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{topupCount} top-up{topupCount === 1 ? '' : 's'}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Used this month</p>
          <p className="display mt-1 text-2xl font-semibold tracking-tight">${used}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{orderCount} service order{orderCount === 1 ? '' : 's'}</p>
        </div>
      </section>

      {/* top-up via QR */}
      <section id="topup" className="mt-5 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <TopUp />
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">How to top up credits</h3>
            <ol className="mt-3 space-y-3 text-sm">
              <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">1</span><span className="text-muted-foreground">Choose the amount to top up.</span></li>
              <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">2</span><span className="text-muted-foreground">Open your banking app → scan the QR code.</span></li>
              <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">3</span><span className="text-muted-foreground">Confirm the transfer, keeping the reference unchanged.</span></li>
              <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-600">✓</span><span className="text-muted-foreground">Credits are added automatically within 1–5 minutes.</span></li>
            </ol>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Billing information</h3>
            <p className="mt-2 text-sm text-muted-foreground">HevaSEO Inc. · Tax ID 0312345678</p>
            <a href="/settings" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Update VAT details <i className="ph-bold ph-arrow-up-right" /></a>
          </div>
        </div>
      </section>

      {/* transactions */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between"><h2 className="display text-lg font-semibold tracking-tight">Credit transaction history</h2><button className="text-xs font-semibold text-primary hover:underline">Export CSV</button></div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <th className="py-2.5 pr-3">Date</th><th className="px-3 py-2.5">Description</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5 text-right">Amount</th><th className="py-2.5 pl-3 text-right">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {TRANSACTIONS.map((t, i) => (
                <tr key={i} className="transition hover:bg-accent/40">
                  <td className="py-3 pr-3 whitespace-nowrap text-muted-foreground">{t.date}</td>
                  <td className="px-3 py-3">{t.description}</td>
                  <td className="px-3 py-3">{t.type === 'topup'
                    ? <span className="pill pill-ok">Top up</span>
                    : <span className="pill" style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>Deduct</span>}</td>
                  <td className={`px-3 py-3 text-right font-semibold${t.amount >= 0 ? ' text-emerald-600' : ''}`}>{t.amount >= 0 ? '+' : ''}{money(t.amount)}</td>
                  <td className="py-3 pl-3 text-right">{t.status === 'success'
                    ? <span className="pill pill-ok">Success</span>
                    : <span className="pill pill-good">Processing</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* invoices */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between"><h2 className="display text-lg font-semibold tracking-tight">Invoices</h2><span className="text-xs text-muted-foreground">VAT issued per your company details</span></div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead><tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <th className="py-2.5 pr-3">Invoice no.</th><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5">Status</th><th className="py-2.5 pl-3 text-right">Download</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {INVOICES.map((inv) => (
                <tr key={inv.no} className="transition hover:bg-accent/40">
                  <td className="py-3 pr-3 font-mono font-semibold text-primary">{inv.no}</td>
                  <td className="px-3 py-3 text-muted-foreground">{inv.date}</td>
                  <td className="px-3 py-3 text-right font-semibold">${inv.amount}</td>
                  <td className="px-3 py-3">{inv.status === 'issued'
                    ? <span className="pill pill-ok">Issued</span>
                    : <span className="pill pill-good">Processing</span>}</td>
                  <td className="py-3 pl-3 text-right">{inv.status === 'issued'
                    ? <button className="pdf-btn inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><i className="ph-bold ph-file-pdf" /> PDF</button>
                    : <span className="text-xs text-muted-foreground">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-muted-foreground">HevaSEO Workspace · Credit &amp; Invoices · sample data</p>
    </>
  );
}
