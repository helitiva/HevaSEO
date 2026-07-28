// Security headers for every response. CSP notes:
//  · script-src needs 'unsafe-inline' for Next's inline bootstrap scripts (upgrading to per-request
//    nonces is a follow-up that requires middleware injection); Google reCAPTCHA + Turnstile + Stripe.js
//    are the only third-party scripts.
//  · connect-src derives the Supabase origin from the build-time env (Coolify injects it at build).
//  · img-src allows https: broadly — avatars/deliverables may live on the Supabase storage CDN domain.
const SUPABASE_ORIGIN = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin; } catch { return ''; }
})();
const SUPABASE_WS = SUPABASE_ORIGIN.replace(/^http/, 'ws');
// `next dev` needs eval (webpack runtime/source maps) and a ws: HMR socket; production must NOT get them.
const IS_DEV = process.env.NODE_ENV === 'development';

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${IS_DEV ? " 'unsafe-eval'" : ''} https://www.google.com https://www.gstatic.com https://challenges.cloudflare.com https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WS}${IS_DEV ? ' ws: wss:' : ''} https://www.google.com https://challenges.cloudflare.com https://api.stripe.com`.replace(/\s+/g, ' '),
  "frame-src https://www.google.com https://challenges.cloudflare.com https://js.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',   // self-host friendly: node server bundle for Docker
  transpilePackages: ['@heva/catalog'],   // shared TS source consumed directly
  experimental: {
    // Tree-shake barrel imports so only the used members ship to the client bundle.
    optimizePackageImports: ['react-simple-maps'],
  },
  async headers() {
    return [{ source: '/(.*)', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
