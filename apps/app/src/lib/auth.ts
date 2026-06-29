'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from './supabase/client';

// Lane A inc-2: the SESSION + login/signup path is now real Supabase Auth (see signInWithPassword /
// signUpCustomer / useSession / signOut below). The ADMIN-PROVISIONING half (createAccount,
// listAccounts, registerUser, outbox, password-reset) is still the Phase-0 localStorage mock — it
// belongs to Lane E and is swapped there. Keep the Session/AuthRole shapes stable so the ~9
// consumers don't churn during the cutover.

export type AuthRole = 'customer' | 'staff' | 'manager' | 'admin' | 'affiliate';

export interface Account {
  id: string;
  role: AuthRole;
  name: string;
  email: string;            // the login id
  password: string;         // plaintext mock — replaced by Supabase Auth later
  entityId?: string;        // links to CUSTOMERS / STAFF / MANAGERS / affiliate id
  createdAt: string;
  mustReset?: boolean;      // admin-issued temp password the user should change
  status?: 'active' | 'suspended';
  createdByAdmin?: boolean; // distinguishes admin-provisioned accounts from self-signup
}

export interface Session {
  accountId: string;
  role: AuthRole;
  name: string;
  email: string;
  entityId?: string;
}

export interface OutboxMail {
  id: string;
  to: string;
  subject: string;
  body: string;
  kind: 'credentials' | 'reset' | 'welcome';
  at: string;
}

const ACCOUNTS_KEY = 'heva:auth:accounts:v1';
const SESSION_KEY = 'heva:auth:session:v1';
const OUTBOX_KEY = 'heva:auth:outbox:v1';
const EVT = 'heva:auth-changed';

const DEMO_PW = 'demo1234';
// Demo logins wired to the existing mock personas — so every portal is reachable out of the box.
const SEED_ACCOUNTS: Account[] = [
  { id: 'acc-admin', role: 'admin', name: 'Admin', email: 'admin@hevaseo.com', password: DEMO_PW, createdAt: '2025-01-01', status: 'active' },
  { id: 'acc-c1', role: 'customer', name: 'Jane Doe', email: 'jane@acme.com', password: DEMO_PW, entityId: 'c1', createdAt: '2025-01-01', status: 'active' },
  { id: 'acc-s1', role: 'staff', name: 'Mai T.', email: 'mai@hevaseo.com', password: DEMO_PW, entityId: 's1', createdAt: '2025-01-01', status: 'active', createdByAdmin: true },
  { id: 'acc-mgr1', role: 'manager', name: 'Sofia Marin', email: 'sofia@hevaseo.com', password: DEMO_PW, entityId: 'mgr1', createdAt: '2025-01-01', status: 'active', createdByAdmin: true },
  { id: 'acc-aff', role: 'affiliate', name: 'Jane Rivera', email: 'jane@janeseo.com', password: DEMO_PW, entityId: 'af-jane', createdAt: '2025-01-01', status: 'active' },
];

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
}

// Created accounts override seeds with the same id/email; seeds otherwise remain.
export function listAccounts(): Account[] {
  const created = readJson<Account[]>(ACCOUNTS_KEY, []);
  const createdEmails = new Set(created.map((a) => a.email.toLowerCase()));
  const seeds = SEED_ACCOUNTS.filter((s) => !createdEmails.has(s.email.toLowerCase()));
  return [...created, ...seeds];
}
function writeCreated(list: Account[]): void { writeJson(ACCOUNTS_KEY, list); }

export function accountByEmail(email: string): Account | undefined {
  const e = email.trim().toLowerCase();
  return listAccounts().find((a) => a.email.toLowerCase() === e);
}

export const HOME_PATH: Record<AuthRole, string> = {
  customer: '/dashboard', staff: '/staff', manager: '/manager', admin: '/admin', affiliate: '/affiliate',
};
export function homePathForRole(role: AuthRole): string { return HOME_PATH[role]; }

export function newAccountId(): string { return `acc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`; }
export function genTempPassword(): string {
  const chunk = () => Math.random().toString(36).slice(2, 6);
  return `Heva-${chunk()}-${chunk()}`;
}

function pushOutbox(mail: Omit<OutboxMail, 'id' | 'at'>): void {
  const list = readJson<OutboxMail[]>(OUTBOX_KEY, []);
  writeJson(OUTBOX_KEY, [{ ...mail, id: `mail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, at: new Date().toISOString() }, ...list].slice(0, 80));
}

// ── Admin: provision an account (staff / manager / admin / affiliate) ───────────
export interface CreateAccountInput { role: AuthRole; name: string; email: string; entityId?: string; password?: string }
export function createAccount(input: CreateAccountInput): { account: Account; tempPassword: string } {
  const tempPassword = input.password ?? genTempPassword();
  const account: Account = {
    id: newAccountId(), role: input.role, name: input.name.trim(), email: input.email.trim(),
    password: tempPassword, entityId: input.entityId, createdAt: new Date().toISOString(),
    mustReset: !input.password, status: 'active', createdByAdmin: true,
  };
  const created = readJson<Account[]>(ACCOUNTS_KEY, []).filter((a) => a.email.toLowerCase() !== account.email.toLowerCase());
  writeCreated([account, ...created]);
  pushOutbox({
    to: account.email, kind: 'credentials', subject: 'Your HevaSEO account is ready',
    body: `Hi ${account.name},\n\nAn account has been created for you on HevaSEO.\n\nLogin: ${account.email}\nTemporary password: ${tempPassword}\nSign in at: /login\n\nPlease change your password after your first sign-in.`,
  });
  return { account, tempPassword };
}

// Self-signup with a chosen password (any role). Creates the account, mails a welcome note, and
// signs the user in. Used by the customer and affiliate register pages.
export function registerUser(input: { role: AuthRole; name: string; email: string; password: string; entityId?: string }): { ok: true; account: Account } | { ok: false; error: string } {
  if (accountByEmail(input.email)) return { ok: false, error: 'An account with this email already exists.' };
  const account: Account = {
    id: newAccountId(), role: input.role, name: input.name.trim(), email: input.email.trim(),
    password: input.password, entityId: input.entityId, createdAt: new Date().toISOString(), status: 'active',
  };
  const created = readJson<Account[]>(ACCOUNTS_KEY, []);
  writeCreated([account, ...created]);
  pushOutbox({ to: account.email, kind: 'welcome', subject: 'Welcome to HevaSEO', body: `Hi ${account.name},\n\nYour HevaSEO account is ready. Sign in any time at /login.` });
  setSession(account);
  return { ok: true, account };
}

// Self-signup (customer/dashboard user).
export function registerCustomer(input: { name: string; email: string; password: string }): { ok: true; account: Account } | { ok: false; error: string } {
  return registerUser({ role: 'customer', ...input });
}

export function updateAccount(id: string, patch: Partial<Account>): void {
  const created = readJson<Account[]>(ACCOUNTS_KEY, []);
  const seed = SEED_ACCOUNTS.find((s) => s.id === id);
  const existing = created.find((a) => a.id === id) ?? seed;
  if (!existing) return;
  const next = { ...existing, ...patch };
  writeCreated([next, ...created.filter((a) => a.id !== id)]);
}
export function removeAccount(id: string): void {
  writeCreated(readJson<Account[]>(ACCOUNTS_KEY, []).filter((a) => a.id !== id));
}

// ── Sign in / out / session ─────────────────────────────────────────────────
export function signIn(email: string, password: string): { ok: true; account: Account } | { ok: false; error: string } {
  const acc = accountByEmail(email);
  if (!acc) return { ok: false, error: 'No account found with that email.' };
  if (acc.status === 'suspended') return { ok: false, error: 'This account is suspended. Contact support.' };
  if (acc.password !== password) return { ok: false, error: 'Incorrect password.' };
  setSession(acc);
  return { ok: true, account: acc };
}
export function setSession(acc: Account): void {
  writeJson(SESSION_KEY, { accountId: acc.id, role: acc.role, name: acc.name, email: acc.email, entityId: acc.entityId } satisfies Session);
}
export function signOut(): void {
  void createClient().auth.signOut();           // real: clears the Supabase session cookie
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }  // also clear stale mock
  window.dispatchEvent(new Event(EVT));
}
/** @deprecated reads the legacy mock session; the real session comes from useSession()/getServerSession(). */
export function currentSession(): Session | null { return readJson<Session | null>(SESSION_KEY, null); }

// ── Real Supabase Auth: login / signup / JWT-claim decode ───────────────────────
// The portal role is the `app_role` claim the access-token hook injects (authoritative, server-side).
const APP_ROLES: readonly AuthRole[] = ['customer', 'staff', 'manager', 'admin', 'affiliate'];
function isAuthRole(v: unknown): v is AuthRole {
  return typeof v === 'string' && (APP_ROLES as readonly string[]).includes(v);
}
function decodeClaims(accessToken?: string | null): Record<string, unknown> | null {
  if (!accessToken) return null;
  try {
    const b64 = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch { return null; }
}
function roleFromJwt(accessToken?: string | null): AuthRole | null {
  const r = decodeClaims(accessToken)?.['app_role'];
  return isAuthRole(r) ? r : null;
}
function claimString(accessToken: string | null | undefined, key: string): string | undefined {
  const v = decodeClaims(accessToken)?.[key];
  return typeof v === 'string' ? v : undefined;
}

/** Map a Supabase session → our Session shape. Returns null if unauthenticated OR authenticated but
 *  unprovisioned (no profile → no app_role claim → no portal to land in). */
function sessionFromSupabase(s: { access_token: string; user: { id: string; email?: string; user_metadata?: Record<string, unknown> } } | null): Session | null {
  if (!s?.user) return null;
  const role = roleFromJwt(s.access_token);
  if (!role) return null;
  const name = typeof s.user.user_metadata?.['name'] === 'string' ? (s.user.user_metadata['name'] as string) : (s.user.email ?? '');
  return { accountId: s.user.id, role, name, email: s.user.email ?? '', entityId: claimString(s.access_token, 'profile_id') };
}

export async function signInWithPassword(email: string, password: string): Promise<{ ok: true; role: AuthRole } | { ok: false; error: string }> {
  const { data, error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, error: error.message || 'Sign in failed.' };
  const role = roleFromJwt(data.session?.access_token);
  if (!role) return { ok: false, error: 'Your account is not provisioned yet. Contact support.' };
  return { ok: true, role };
}

/** Self-signup (customer). role/tenant are forced server-side by the handle_new_user trigger — the
 *  metadata here carries only the display name (never a role, which would be ignored anyway). */
export async function signUpCustomer(input: { name: string; email: string; password: string }): Promise<{ ok: true; signedIn: boolean } | { ok: false; error: string }> {
  const { data, error } = await createClient().auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: { name: input.name.trim() } },
  });
  if (error) return { ok: false, error: error.message || 'Sign up failed.' };
  return { ok: true, signedIn: Boolean(data.session) };  // signedIn=false → email confirmation required
}

// ── Password reset (mock) ──────────────────────────────────────────────────────
export function requestPasswordReset(email: string): { ok: boolean } {
  const acc = accountByEmail(email);
  // Always report ok (don't leak which emails exist); only actually mail if it resolves.
  if (acc) pushOutbox({ to: acc.email, kind: 'reset', subject: 'Reset your HevaSEO password', body: `Hi ${acc.name},\n\nReset your password here: /reset-password?email=${encodeURIComponent(acc.email)}\n\nIf you didn't request this, ignore this email.` });
  return { ok: true };
}
export function resetPassword(email: string, newPassword: string): { ok: boolean; error?: string } {
  const acc = accountByEmail(email);
  if (!acc) return { ok: false, error: 'No account found with that email.' };
  updateAccount(acc.id, { password: newPassword, mustReset: false });
  return { ok: true };
}

// ── React hooks ────────────────────────────────────────────────────────────────
function useStoreSync<T>(read: () => T, deps: unknown[] = []): [T, () => void] {
  const [val, setVal] = useState<T>(read);
  const refresh = useCallback(() => setVal(read()), deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    refresh();
    window.addEventListener(EVT, refresh); window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(EVT, refresh); window.removeEventListener('storage', refresh); };
  }, [refresh]);
  return [val, refresh];
}

/** Live session from Supabase Auth (cookie-backed). Updates on sign-in/out across tabs. */
export function useSession(): Session | null {
  const [session, setSessionState] = useState<Session | null>(null);
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setSessionState(sessionFromSupabase(data.session)); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSessionState(sessionFromSupabase(s)));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);
  return session;
}
export function useAccounts(): Account[] { const [a] = useStoreSync<Account[]>(() => listAccounts()); return a; }
export function useOutbox(): OutboxMail[] { const [o] = useStoreSync<OutboxMail[]>(() => readJson<OutboxMail[]>(OUTBOX_KEY, [])); return o; }
