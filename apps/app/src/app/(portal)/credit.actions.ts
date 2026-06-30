'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession, createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getPaymentProvider } from '@/lib/payments/provider';

export type TopUpResult = { ok: true; amount: number; invoiceNo: string } | { ok: false; error: string };

const MIN_TOPUP = 5;
const MAX_TOPUP = 100_000;

// Phase 2 / inc-P2 — top up credit from the dashboard, MONEY (gác③). The payment is "charged" via the
// provider seam (mock now / Stripe later); ONLY on a confirmed charge do we credit via the service-role
// `topup` (the same fn a real Stripe webhook would call) and write the invoice. The client never
// credits itself — amount is validated + the gateway must approve first.
export async function topUpAction(amount: number, label: string): Promise<TopUpResult> {
  const session = await getServerSession();
  if (!session || session.role !== 'customer' || !session.entityId) return { ok: false, error: 'You must be signed in as a customer.' };
  if (!Number.isFinite(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP) {
    return { ok: false, error: `Top-up must be between $${MIN_TOPUP} and $${MAX_TOPUP.toLocaleString('en-US')}.` };
  }

  const supabase = await createClient();
  const { data: cust, error: cErr } = await supabase.from('customers').select('id, tenant_id').maybeSingle();
  if (cErr) return { ok: false, error: cErr.message };
  if (!cust) return { ok: false, error: 'No customer profile found.' };

  // 1) charge the card (mock/Stripe). No credit happens unless this approves.
  const provider = getPaymentProvider();
  const charge = await provider.charge({ amount, customerId: cust.id, description: label });
  if (!charge.ok) return { ok: false, error: charge.error };

  // 2) credit the ledger atomically (service-role-only fn) + 3) record the invoice.
  const svc = createServiceClient();
  const { error: topErr } = await svc.rpc('topup', {
    p_tenant: cust.tenant_id, p_customer: cust.id, p_amount: amount,
    p_actor: session.entityId, p_stripe: charge.ref,
  });
  if (topErr) return { ok: false, error: topErr.message };

  const invoiceNo = await nextInvoiceNumber(svc, cust.tenant_id);
  await svc.from('invoices').insert({
    tenant_id: cust.tenant_id, customer_id: cust.id, number: invoiceNo,
    amount, status: 'issued', provider: provider.name, provider_ref: charge.ref,
  });

  revalidatePath('/credit');
  revalidatePath('/dashboard');
  return { ok: true, amount, invoiceNo };
}

// HD-YYYY-NNN, sequential per tenant (best-effort from the latest invoice; the unique(tenant,number)
// constraint is the real guard against collisions).
async function nextInvoiceNumber(svc: ReturnType<typeof createServiceClient>, tenantId: string): Promise<string> {
  const { data } = await svc.from('invoices')
    .select('number').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const year = new Date().getFullYear();
  const last = data?.number?.split('-').pop();
  const next = (Number.isFinite(Number(last)) ? Number(last) : 0) + 1;
  return `HD-${year}-${String(next).padStart(3, '0')}`;
}
