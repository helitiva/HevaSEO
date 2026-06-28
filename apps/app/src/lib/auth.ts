'use client';
import { useCallback, useEffect, useState } from 'react';

// Phase-0 mock auth. NOT real security — passwords are stored in plaintext in localStorage and
// there is no server verification. It mirrors the future Supabase-Auth model (see
// docs/backend/PLAN.md): five roles, each account links to its domain entity id, and the role
// decides which portal you land in. The real backend will replace this wholesale.

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
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
}
export function currentSession(): Session | null { return readJson<Session | null>(SESSION_KEY, null); }

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

export function useSession(): Session | null { const [s] = useStoreSync<Session | null>(() => currentSession()); return s; }
export function useAccounts(): Account[] { const [a] = useStoreSync<Account[]>(() => listAccounts()); return a; }
export function useOutbox(): OutboxMail[] { const [o] = useStoreSync<OutboxMail[]>(() => readJson<OutboxMail[]>(OUTBOX_KEY, [])); return o; }
