// Admin "impersonate" — view a portal as a given user (Phase 0 mock).
// A cookie carries the impersonated id; the portal reads it and renders that user's view, with a
// banner + Exit in the shell. Two flavours: staff (heva_as) and customer (heva_as_customer).
// Client-only helpers.
export const IMPERSONATE_COOKIE = 'heva_as';
export const IMPERSONATE_CUSTOMER_COOKIE = 'heva_as_customer';
const MAX_AGE = 60 * 60 * 8; // 8h

export function setImpersonation(id: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${IMPERSONATE_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${MAX_AGE}; samesite=lax`;
}
export function clearImpersonation(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${IMPERSONATE_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
export function readImpersonation(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)heva_as=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// Set the cookie and open the staff portal as that staffer in a new tab. The whole portal
// (dashboard, tasks, calendar, deliverables, performance, finance, docs, settings) renders that
// person's data while the cookie is set.
export function impersonate(id: string): void {
  setImpersonation(id);
  if (typeof window !== 'undefined') window.open('/staff', '_blank', 'noopener,noreferrer');
}

// ---- Customer impersonation (the client-facing portal) ----
export function setCustomerImpersonation(id: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${IMPERSONATE_CUSTOMER_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${MAX_AGE}; samesite=lax`;
}
export function clearCustomerImpersonation(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${IMPERSONATE_CUSTOMER_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
export function readCustomerImpersonation(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)heva_as_customer=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
// Set the cookie and open the customer portal as that customer in a new tab (lands on the dashboard).
export function impersonateCustomer(id: string): void {
  setCustomerImpersonation(id);
  if (typeof window !== 'undefined') window.open('/dashboard', '_blank', 'noopener,noreferrer');
}
