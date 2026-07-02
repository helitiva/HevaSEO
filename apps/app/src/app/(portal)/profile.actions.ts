'use server';

import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';

// Real profile + billing for the settings page (RLS-scoped read; safe-column write via a fn).
export type ProfileForm = { name: string; email: string; phone: string; company: string; industry: string; website: string };
export type BillingForm = { company: string; taxId: string; address: string };

const s = (v: unknown): string => (typeof v === 'string' ? v : '');

export async function getMyProfileAction(): Promise<{ profile: ProfileForm; billing: BillingForm } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers').select('name, email, phone, company, industry, website, billing').maybeSingle();
  if (error || !data) return null;
  const b = (data.billing && typeof data.billing === 'object' && !Array.isArray(data.billing) ? data.billing : {}) as Record<string, unknown>;
  return {
    profile: { name: s(data.name), email: s(data.email), phone: s(data.phone), company: s(data.company), industry: s(data.industry), website: s(data.website) },
    billing: { company: s(b.company) || s(data.company), taxId: s(b.taxId), address: s(b.address) },
  };
}

export type SaveResult = { ok: boolean; error?: string };

export async function updateProfileAction(p: ProfileForm): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_my_profile', {
    p_name: p.name, p_phone: p.phone, p_company: p.company, p_industry: p.industry, p_website: p.website,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function updateBillingAction(b: BillingForm): Promise<SaveResult> {
  const supabase = await createClient();
  const billing = { company: b.company, taxId: b.taxId, address: b.address } as unknown as Json;
  const { error } = await supabase.rpc('update_my_profile', { p_billing: billing });
  return error ? { ok: false, error: error.message } : { ok: true };
}
