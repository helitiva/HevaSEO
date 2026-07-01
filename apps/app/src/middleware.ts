import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Routes reachable without a session. Everything else is a portal surface whose Server Components
// read RLS-scoped data (which requires an authenticated JWT) — so an anonymous request must be sent
// to /login, not allowed to hit the data layer (where the read would error and crash the page).
// /api/public/* is the unauthenticated marketing surface (quick-checkout) — it must NOT be auth-gated.
// /r/* is the public affiliate click-tracking redirect (inc-E16) — a click has no session.
const PUBLIC_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password', '/api/public', '/r'];

// Role-shell gating: each portal shell belongs to one role. A signed-in user on the WRONG shell is
// sent to their own home. (RLS is the real data gate; this is UX + defense-in-depth. Customer portal
// routes like /dashboard aren't under a shell prefix → any authed user may hit them, RLS-scoped.)
type AppRole = 'admin' | 'manager' | 'staff' | 'customer' | 'affiliate';
const SHELL_ROLE: Record<string, AppRole> = {
  '/admin': 'admin', '/manager': 'manager', '/staff': 'staff', '/affiliate': 'affiliate',
};
const HOME: Record<AppRole, string> = {
  admin: '/admin', manager: '/manager', staff: '/staff', affiliate: '/affiliate', customer: '/dashboard',
};

function roleFromToken(accessToken?: string): AppRole | null {
  if (!accessToken) return null;
  try {
    const b64 = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const r = (JSON.parse(json) as { app_role?: string }).app_role;
    return r && r in HOME ? (r as AppRole) : null;
  } catch { return null; }
}

// Refreshes the Supabase Auth session on every request so Server Components always read a valid,
// non-expired token (tenant_id/app_role claims), AND gates protected routes: no session → /login.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() refreshes the token (cookie rewrite) and tells us if there's a session.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // not signed in → /login (carry the intended path so login can return there later)
  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  // signed in on a role-shell that isn't theirs → bounce to their own home
  if (user) {
    const shell = Object.keys(SHELL_ROLE).find((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (shell) {
      const { data: { session } } = await supabase.auth.getSession();
      const role = roleFromToken(session?.access_token);
      if (role && SHELL_ROLE[shell] !== role) {
        const home = request.nextUrl.clone();
        home.pathname = HOME[role];
        home.search = '';
        return NextResponse.redirect(home);
      }
    }
  }

  return response;
}

export const config = {
  // Run on everything except static assets and image optimization.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
