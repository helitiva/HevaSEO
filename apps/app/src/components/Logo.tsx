export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/30">
        <svg viewBox="0 0 240 240" className="h-[88%] w-[88%]" fill="currentColor" aria-hidden="true">
          <path d="M33.4 171.9L32.5 175.4L33.6 178.9L36.2 181.4L67.8 198.6L71.3 199.4L74.8 198.4L77.3 195.8L105 145.2L134.2 145L135.6 145.8L162.7 195.8L165.2 198.4L168.7 199.4L172.2 198.6L203.8 181.4L206.4 178.9L207.5 175.4L206.6 171.9L178.7 120L206.6 68.1L207.5 64.6L206.4 61.1L203.8 58.6L172.2 41.4L168.7 40.6L165.2 41.6L162.7 44.2L135 94.8L105.8 95L104.4 94.2L77.3 44.2L74.8 41.6L71.3 40.6L67.8 41.4L36.2 58.6L33.6 61.1L32.5 64.6L33.4 68.1L61.3 120Z" />
        </svg>
      </span>
      <span className="text-base font-semibold tracking-tight">Heva<span className="text-primary">SEO</span></span>
    </span>
  );
}
