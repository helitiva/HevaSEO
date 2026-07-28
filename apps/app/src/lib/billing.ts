// Shared billing/VAT model — used by the settings billing form, the top-up gate/prefill, and the profile
// server actions. Kept out of the 'use server' profile.actions file so the sync helper can be exported.

// Full billing/VAT detail (stored in the free-form customers.billing jsonb). `address` (legacy single
// line) is migrated into line1 on read so older rows keep working.
export type BillingForm = {
  name: string; email: string; phone: string;
  company: string; taxId: string;
  line1: string; line2: string; city: string; state: string; postalCode: string; country: string;
};

// A billing profile is "complete" enough to invoice + charge once we have who + where.
export function billingComplete(b: BillingForm): boolean {
  return Boolean(b.name.trim() && b.line1.trim() && b.city.trim() && b.country.trim());
}
