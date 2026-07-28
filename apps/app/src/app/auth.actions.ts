'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { verifyRecaptcha } from '@/lib/captcha';

// Auth server actions. The browser used to call GoTrue directly, which meant the reCAPTCHA token was
// only ever checked for presence client-side — nothing stopped a scripted POST. These actions verify
// the captcha server-side FIRST (fail-closed in production, see lib/captcha), then perform the auth
// call with the server client so the session cookies are set by the same request.

type AuthRole = 'customer' | 'staff' | 'manager' | 'admin' | 'affiliate';
const ROLES: readonly AuthRole[] = ['customer', 'staff', 'manager', 'admin', 'affiliate'];

// lib/auth.ts is a client module, so its JWT helpers can't be imported here — decode the claim inline.
function roleFromJwt(accessToken?: string): AuthRole | null {
  if (!accessToken) return null;
  try {
    const b64 = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as { app_role?: string };
    return ROLES.includes(claims.app_role as AuthRole) ? (claims.app_role as AuthRole) : null;
  } catch {
    return null;
  }
}

const CAPTCHA_ERROR = 'reCAPTCHA verification failed. Please try again.';

/** Password sign-in, captcha-gated. Returns the role so the client can route to the right portal. */
export async function signInAction(input: { email: string; password: string; captchaToken: string | null }):
  Promise<{ ok: true; role: AuthRole } | { ok: false; error: string }> {
  if (!(await verifyRecaptcha(input.captchaToken))) return { ok: false, error: CAPTCHA_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: input.email.trim(), password: input.password });
  if (error) return { ok: false, error: error.message || 'Sign in failed.' };
  const role = roleFromJwt(data.session?.access_token);
  if (!role) return { ok: false, error: 'Your account is not provisioned yet. Contact support.' };
  return { ok: true, role };
}

/** Customer self-signup, captcha-gated. signedIn=false → email confirmation required first. */
export async function signUpAction(input: { name: string; email: string; password: string; captchaToken: string | null }):
  Promise<{ ok: true; signedIn: boolean } | { ok: false; error: string }> {
  if (!(await verifyRecaptcha(input.captchaToken))) return { ok: false, error: CAPTCHA_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: { name: input.name.trim() } },
  });
  if (error) return { ok: false, error: error.message || 'Sign up failed.' };
  return { ok: true, signedIn: Boolean(data.session) };
}

/** Send the real GoTrue recovery email (replaces the localStorage outbox mock, which mailed nobody and
 *  left a forgotten password unrecoverable). Always reports ok so the form never leaks which emails
 *  exist; the link lands on /reset-password, which exchanges it for a session and updates the password. */
export async function requestPasswordResetAction(input: { email: string; captchaToken: string | null }):
  Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await verifyRecaptcha(input.captchaToken))) return { ok: false, error: CAPTCHA_ERROR };
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN
    ?? `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host') ?? 'localhost:3000'}`;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(input.email.trim(), { redirectTo: `${origin}/reset-password` });
  return { ok: true };  // deliberately identical for unknown emails
}
