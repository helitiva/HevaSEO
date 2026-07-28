import 'server-only';

// Server-side reCAPTCHA v2 verification — the widget token was previously only checked for PRESENCE on
// the client, so a bot could skip the widget and POST straight to the auth backend. Every auth-adjacent
// server action now calls this before doing anything.
//
// Development: always passes (the widget runs Google's universal TEST keys there, and the signup path
// must stay walkable offline). Production: fails CLOSED — a missing secret or an unreachable Google
// rejects the request rather than waving it through.
export async function verifyRecaptcha(token: string | null | undefined): Promise<boolean> {
  if (process.env.NODE_ENV === 'development') return true;
  // TEST-ONLY escape hatch for the CI UI smoke, which drives the real login form against a production
  // build with a stubbed widget (no real Google keys there). NEVER set RECAPTCHA_BYPASS in production —
  // it disables the server-side check entirely.
  if (process.env.RECAPTCHA_BYPASS === '1') return true;
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret || !token) return false;
  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { success?: boolean };
    return body.success === true;
  } catch {
    return false;
  }
}
