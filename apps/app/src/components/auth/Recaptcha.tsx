'use client';
import { useEffect, useRef } from 'react';

// Google reCAPTCHA v2 ("I'm not a robot" checkbox). Uses Google's public TEST key by default,
// which always passes and shows a "for testing only" banner — swap in a real key via
// NEXT_PUBLIC_RECAPTCHA_SITE_KEY for production. Phase-0 has no server, so the token is only
// checked for presence client-side; the real backend will verify it server-side.
const TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || TEST_SITE_KEY;
const SCRIPT_ID = 'recaptcha-v2-script';

type Grecaptcha = {
  render: (el: HTMLElement, opts: { sitekey: string; theme?: string; callback: (t: string) => void; 'expired-callback': () => void }) => number;
  reset: (id?: number) => void;
};
declare global {
  interface Window { grecaptcha?: Grecaptcha; onRecaptchaLoad?: () => void }
}

function loadScript(cb: () => void): void {
  if (window.grecaptcha?.render) { cb(); return; }
  const existing = document.getElementById(SCRIPT_ID);
  window.onRecaptchaLoad = cb;
  if (existing) return;
  const s = document.createElement('script');
  s.id = SCRIPT_ID;
  s.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit';
  s.async = true; s.defer = true;
  document.head.appendChild(s);
}

export function Recaptcha({ onVerify }: { onVerify: (token: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const render = () => {
      if (cancelled || !ref.current || widgetId.current !== null || !window.grecaptcha?.render) return;
      widgetId.current = window.grecaptcha.render(ref.current, {
        sitekey: SITE_KEY, theme: 'dark',
        callback: (t) => onVerify(t),
        'expired-callback': () => onVerify(null),
      });
    };
    loadScript(render);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className="min-h-[78px]" aria-label="reCAPTCHA verification" />;
}
