// HevaSEO — interactions
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Graceful fallback for external (Simple Icons) logos ---------- */
  document.querySelectorAll('img[src*="simpleicons.org"]').forEach(function (img) {
    img.addEventListener('error', function () { img.style.visibility = 'hidden'; });
  });

  /* Theme toggle + mobile menu now live in the shared Header component (so they work on every page). */

  /* ---------- Scroll reveal (staggered by position in the grid) ---------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  function reveal(el) { el.classList.add('is-visible'); }
  // Cards revealed together under the same parent stagger by 90ms instead of all at once.
  function revealWithDelay(el, delay) {
    if (delay > 0) {
      el.style.transitionDelay = delay + 'ms';
      // reset delay to 0 after reveal so it doesn't affect hover transitions
      setTimeout(function () { el.style.transitionDelay = ''; }, delay + 800);
    }
    el.classList.add('is-visible');
  }
  function inViewport(el) {
    const r = el.getBoundingClientRect();
    return r.top < (window.innerHeight || document.documentElement.clientHeight) && r.bottom > 0;
  }

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(reveal);
  } else {
    const io = new IntersectionObserver(function (entries) {
      const perParent = new Map();
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        const parent = entry.target.parentElement;
        const n = perParent.get(parent) || 0;
        perParent.set(parent, n + 1);
        revealWithDelay(entry.target, Math.min(n, 7) * 90);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    // Reveal anything already on screen immediately (robust if IO never fires),
    // observe the rest so they animate in on scroll.
    revealEls.forEach(function (el) {
      if (inViewport(el)) reveal(el);
      else io.observe(el);
    });

    // Safety net: if IO hasn't revealed an element a moment after it should be
    // visible, reveal it so content can never get stuck hidden.
    setTimeout(function () {
      revealEls.forEach(function (el) {
        if (!el.classList.contains('is-visible') && inViewport(el)) reveal(el);
      });
    }, 1200);
  }

  /* ---------- Pricing tabs ---------- */
  const tabs = document.querySelectorAll('.pricing-tab');
  const panels = document.querySelectorAll('[data-panel]');
  function activateTab(key) {
    tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === key); });
    panels.forEach(function (p) { p.classList.toggle('hidden', p.dataset.panel !== key); });
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { activateTab(t.dataset.tab); });
  });
  if (tabs.length) activateTab('entity');

  /* ---------- Animated counters ---------- */
  const counters = document.querySelectorAll('.counter');
  function animateCounter(el) {
    const target = parseInt(el.dataset.to, 10) || 0;
    if (reduceMotion) { el.textContent = target.toLocaleString('en-US'); return; }
    const duration = 1400;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString('en-US');
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window && counters.length) {
    const co = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { animateCounter(entry.target); co.unobserve(entry.target); }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { co.observe(el); });
  } else {
    counters.forEach(function (el) { el.textContent = (parseInt(el.dataset.to, 10) || 0).toLocaleString('en-US'); });
  }

  /* ---------- data-count counters (Backlink / Indexer / live indicator) ---------- */
  const dataCounters = document.querySelectorAll('[data-count]');
  function formatNum(n, decimals) {
    return decimals > 0
      ? n.toFixed(decimals)
      : Math.round(n).toLocaleString('en-US');
  }
  function animateDataCounter(el) {
    const target = parseFloat(el.dataset.count) || 0;
    const suffix = el.dataset.suffix || '';
    const decimals = el.dataset.decimals ? parseInt(el.dataset.decimals, 10) : 0;
    if (reduceMotion) { el.textContent = formatNum(target, decimals) + suffix; return; }
    const duration = 1600;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatNum(target * eased, decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window && dataCounters.length) {
    const dco = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { animateDataCounter(entry.target); dco.unobserve(entry.target); }
      });
    }, { threshold: 0.4 });
    dataCounters.forEach(function (el) { dco.observe(el); });
  }

  /* ---------- Embedded dashboard: lock to desktop ratio, scale to fit ---------- */
  const DASH_BASE_W = 1440;
  const DASH_BASE_H = 900;
  const dashVp = document.querySelector('.dashboard-embed-viewport');
  function scaleDashboard() {
    if (!dashVp) return;
    const iframe = dashVp.querySelector('iframe');
    if (!iframe) return;
    const w = dashVp.clientWidth;
    if (!w) return;                          // wait until it has a real width
    const s = w / DASH_BASE_W;
    iframe.style.transform = 'scale(' + s + ')';
    dashVp.style.height = (DASH_BASE_H * s) + 'px';
  }
  if (dashVp) {
    if ('ResizeObserver' in window) {
      new ResizeObserver(scaleDashboard).observe(dashVp);
    } else {
      window.addEventListener('resize', scaleDashboard);
    }
    scaleDashboard();
    window.addEventListener('load', scaleDashboard);
    const dashIframe = dashVp.querySelector('iframe');
    if (dashIframe) dashIframe.addEventListener('load', scaleDashboard);
  }

  /* ---------- Lead form: validation + states + submit ---------- */
  // TODO: paste a real endpoint (Formspree / API) here to receive leads over HTTP.
  // Leaving "" empty falls back to opening a prefilled email to hello@hevaseo.com.
  const LEAD_ENDPOINT = '';
  const LEAD_EMAIL = 'hello@hevaseo.com';

  const leadForm = document.getElementById('lead-form');
  if (leadForm) {
    const input = document.getElementById('cta-email');
    const pkgField = document.getElementById('lead-package');
    const statusEl = document.getElementById('lead-status');
    const submitBtn = document.getElementById('lead-submit');
    const spinner = submitBtn ? submitBtn.querySelector('.lead-spinner') : null;
    const labelEl = submitBtn ? submitBtn.querySelector('.lead-submit-label') : null;
    const defaultStatus = statusEl ? statusEl.textContent : '';

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    function isValidContact(v) {
      v = v.trim();
      if (emailRe.test(v)) return true;
      const phone = v.replace(/[\s.\-()]/g, '');
      return /^\+?\d{7,15}$/.test(phone);
    }
    function setStatus(msg, kind) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.classList.remove('font-semibold', 'text-white', 'text-red-100', 'text-emerald-100', 'text-brand-50/70');
      if (kind === 'error') statusEl.classList.add('text-red-100', 'font-semibold');
      else if (kind === 'success') statusEl.classList.add('text-white', 'font-semibold');
      else statusEl.classList.add('text-brand-50/70');
    }
    function setLoading(on) {
      if (!submitBtn) return;
      submitBtn.disabled = on;
      if (spinner) spinner.classList.toggle('hidden', !on);
      if (labelEl) labelEl.textContent = on ? 'Sending…' : 'Get a consultation';
    }

    leadForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const contact = (input && input.value || '').trim();
      const pkg = (pkgField && pkgField.value || '').trim();
      const honeypot = leadForm.querySelector('input[name="company"]');

      // bot trap: a filled hidden field => skip but still report "success"
      if (honeypot && honeypot.value) { setStatus('Thank you! We\u2019ll be in touch soon.', 'success'); leadForm.reset(); return; }

      if (!isValidContact(contact)) {
        setStatus('Please enter a valid email or phone number.', 'error');
        if (input) input.focus();
        return;
      }

      // No endpoint → open a prefilled email (still captures the lead)
      if (!LEAD_ENDPOINT) {
        const subject = 'HevaSEO consultation request' + (pkg ? ' \u2014 ' + pkg : '');
        const body = 'Contact: ' + contact + '\nService of interest: ' + (pkg || '(none selected)') + '\nSent from: hevaseo.com';
        window.location.href = 'mailto:' + LEAD_EMAIL +
          '?subject=' + encodeURIComponent(subject) +
          '&body=' + encodeURIComponent(body);
        setStatus('Opening your email to send the request\u2026 Or call +1 (415) 555-0142 for help right away.', 'success');
        leadForm.reset();
        if (pkgField) pkgField.value = '';
        return;
      }

      // Endpoint present → submit via fetch
      setLoading(true);
      setStatus('Sending your request\u2026', null);
      fetch(LEAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ contact: contact, package: pkg, source: 'landing-page' })
      })
        .then(function (res) { if (!res.ok) throw new Error('bad status'); return res; })
        .then(function () {
          setStatus('Request received! We\u2019ll reply within 24 business hours.', 'success');
          leadForm.reset();
          if (pkgField) pkgField.value = '';
        })
        .catch(function () {
          setStatus('Couldn\u2019t send. Please call +1 (415) 555-0142 or email ' + LEAD_EMAIL + '.', 'error');
        })
        .finally(function () { setLoading(false); });
    });

    // reset the status when the user types again
    if (input) input.addEventListener('input', function () {
      if (statusEl && statusEl.classList.contains('text-red-100')) setStatus(defaultStatus, null);
    });

    /* ---------- "Choose plan" → pre-fill the plan name into the contact form ---------- */
    document.querySelectorAll('[data-panel] a[href="#lienhe"]').forEach(function (a) {
      a.addEventListener('click', function () {
        const card = a.closest('[class*="rounded-xl"]') || a.parentElement;
        const h3 = card ? card.querySelector('h3') : null;
        const activeTab = document.querySelector('.pricing-tab.active');
        const svc = activeTab ? activeTab.textContent.trim() : '';
        const pkgName = h3 ? h3.textContent.trim() : '';
        const full = [svc, pkgName].filter(Boolean).join(' · ');
        if (pkgField) pkgField.value = full;
        if (input) input.placeholder = full ? ('Ask about: ' + pkgName) : 'Your email or phone number';
        setStatus(full ? ('You\u2019re interested in the "' + full + '" plan. Leave your contact details!') : defaultStatus, null);
      });
    });
  }

  /* ---------- Spotlight hover + 3D tilt (mouse devices only) ---------- */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    // glow follows the cursor inside the card
    const spotCards = document.querySelectorAll(
      '.service-card, .heva-bento-card, .addon-grid article, #uudai article, #banggia [data-panel] > div, #khachhang figure'
    );
    spotCards.forEach(function (card) {
      card.classList.add('spotlight');
      card.addEventListener('pointermove', function (e) {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });

    // service card tilts slightly in 3D toward the cursor
    if (!reduceMotion) {
      document.querySelectorAll('.service-card').forEach(function (card) {
        card.addEventListener('pointermove', function (e) {
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          card.style.transform =
            'perspective(900px) rotateX(' + (-py * 3.5).toFixed(2) + 'deg)' +
            ' rotateY(' + (px * 4.5).toFixed(2) + 'deg) translateY(-4px)';
        });
        card.addEventListener('pointerleave', function () { card.style.transform = ''; });
      });
    }
  }

  /* ---------- Hero wheel slider: slides rotate like a wheel ---------- */
  (function () {
    const wheel = document.getElementById('hero-wheel');
    if (!wheel) return;
    const slides = wheel.querySelectorAll('[data-wheel-slide]');
    const dots = document.querySelectorAll('.wheel-dot');
    const wrapper = wheel.closest('.hero-mock-scale');
    if (slides.length < 2) return;

    let cur = 0;
    let timer = null;
    const INTERVAL = 5200;

    function show(next) {
      next = (next + slides.length) % slides.length;
      if (next === cur) return;
      const leaving = slides[cur];
      slides.forEach(function (s, i) {
        if (i === next) { s.classList.remove('whl-wait', 'whl-out'); s.classList.add('whl-in'); }
        else if (s === leaving) { s.classList.remove('whl-in'); s.classList.add('whl-out'); }
        else { s.classList.remove('whl-in', 'whl-out'); s.classList.add('whl-wait'); }
      });
      // after rotating out, return the old slide to the waiting position (right) for the next cycle
      setTimeout(function () {
        if (!leaving.classList.contains('whl-in')) {
          leaving.classList.remove('whl-out');
          leaving.classList.add('whl-wait');
        }
      }, 950);
      dots.forEach(function (d, i) { d.classList.toggle('active', i === next); });
      if (wrapper) wrapper.classList.toggle('not-dash', next !== 0);
      cur = next;
    }

    function startAuto() {
      if (reduceMotion || timer) return;
      timer = setInterval(function () {
        if (document.hidden) return;
        show(cur + 1);
      }, INTERVAL);
    }
    function stopAuto() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    dots.forEach(function (d, i) {
      d.addEventListener('click', function () {
        show(i);
        stopAuto();
        startAuto(); // reset the cadence after the user selects
      });
    });

    // pause on hover so the user can read the content
    wheel.addEventListener('mouseenter', stopAuto);
    wheel.addEventListener('mouseleave', startAuto);

    startAuto();
  })();

  /* ---------- Service cards: simulate a running system ---------- */
  if (!reduceMotion) {
    // Backlink: each tick, one platform row lights up and the counter +1
    const bpRows = document.querySelectorAll('.backlink-platform');
    if (bpRows.length) {
      let bpIdx = 0;
      setInterval(function () {
        if (document.hidden) return;
        bpRows.forEach(function (r) { r.classList.remove('bp-hit'); });
        const row = bpRows[bpIdx % bpRows.length];
        bpIdx++;
        row.classList.add('bp-hit');
        const meta = row.querySelector('.bp-meta[data-count]');
        if (meta) {
          const suffix = meta.dataset.suffix || '';
          const base = parseFloat(meta.dataset.count) || 0;
          const cur = parseInt(String(meta.textContent).replace(/[^\d]/g, ''), 10);
          // nudge at most +29 above the base value so it stays realistic over long sessions
          if (!isNaN(cur) && cur < base + 29) {
            meta.textContent = (cur + 1).toLocaleString('en-US') + suffix;
          }
          meta.classList.remove('bp-tick');
          void meta.offsetWidth; // restart animation
          meta.classList.add('bp-tick');
        }
        setTimeout(function () { row.classList.remove('bp-hit'); }, 1600);
      }, 2600);
    }

    // Indexer: a live queue — old rows leave, new rows enter and get indexed
    const ixQueue = document.querySelector('.indexer-queue');
    if (ixQueue) {
      const pool = [
        'forum-profile-12.html', 'blog-cmt-x21.html', 'press-vne-04.html',
        'citation-gmaps.html', 'web20-blogspot.html', 'social-pin-8.html',
        'guest-post-7.html', 'wiki-ref-02.html'
      ];
      let poolIdx = 0;
      function makeRow(name) {
        const row = document.createElement('div');
        row.className = 'indexer-row ix-entering';
        row.innerHTML =
          '<i class="ph-bold ph-arrow-clockwise text-amber-500 ix-retry-icon"></i> ' + name +
          '<span class="indexer-status sending">Submitting\u2026</span>';
        // after 1.6s switch to Indexed with a green flash
        setTimeout(function () {
          if (!row.isConnected) return;
          const icon = row.querySelector('i');
          const status = row.querySelector('.indexer-status');
          if (icon) icon.className = 'ph-fill ph-check-circle text-primary';
          if (status) { status.className = 'indexer-status ok'; status.textContent = 'Indexed'; }
          row.classList.add('ix-flash');
        }, 1600);
        return row;
      }
      setInterval(function () {
        if (document.hidden || !ixQueue.querySelector('.indexer-row')) return;
        // only run once the card is visible (entrance animation done)
        const card = ixQueue.closest('.service-card');
        if (card && !card.classList.contains('is-visible')) return;
        const rows = ixQueue.querySelectorAll('.indexer-row:not(.ix-leaving)');
        if (rows.length >= 4) {
          const oldest = rows[0];
          oldest.classList.add('ix-leaving');
          setTimeout(function () { oldest.remove(); }, 360);
        }
        ixQueue.appendChild(makeRow(pool[poolIdx % pool.length]));
        poolIdx++;
      }, 3200);
    }
  }

  /* ---------- Promo section: hidden by default, opens on click ---------- */
  (function () {
    const promo = document.getElementById('uudai');
    if (!promo) return;
    const toggleBtn = document.getElementById('promo-toggle');
    const labelEl = toggleBtn ? toggleBtn.querySelector('.promo-toggle-label') : null;
    const caretEl = toggleBtn ? toggleBtn.querySelector('.promo-toggle-caret') : null;

    function openPromo(scroll) {
      promo.classList.remove('hidden');
      promo.querySelectorAll('[data-reveal]').forEach(function (el) { el.classList.add('is-visible'); });
      if (labelEl) labelEl.textContent = 'Hide offers';
      if (caretEl) caretEl.classList.add('rotate-180');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
      if (scroll) requestAnimationFrame(function () {
        promo.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      });
    }
    function closePromo(scrollToTop) {
      promo.classList.add('hidden');
      if (labelEl) labelEl.textContent = 'View all offers';
      if (caretEl) caretEl.classList.remove('rotate-180');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      if (scrollToTop) toggleBtn.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (promo.classList.contains('hidden')) openPromo(true);
        else closePromo(true);
      });
    }

    // Other links pointing to #uudai (nav, mobile menu) also open the section
    document.querySelectorAll('a[href="#uudai"]').forEach(function (a) {
      if (a === toggleBtn) return;
      a.addEventListener('click', function () { openPromo(true); });
    });

    // Open it if accessed directly via the #uudai hash
    if (window.location.hash === '#uudai') openPromo(false);
  })();

  /* ---------- Promo countdown (until the end of the current month) ---------- */
  (function () {
    const dEls = document.querySelectorAll('.js-cd-d');
    const hEls = document.querySelectorAll('.js-cd-h');
    const mEls = document.querySelectorAll('.js-cd-m');
    const sEls = document.querySelectorAll('.js-cd-s');
    if (!dEls.length && !hEls.length) return;

    function pad(n) { return String(n).padStart(2, '0'); }
    function setAll(list, val) { list.forEach(function (el) { el.textContent = val; }); }

    // End point: 23:59:59 on the last day of the current month.
    function endOfMonth() {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 0);
    }
    let target = endOfMonth();

    function update() {
      let diff = target.getTime() - Date.now();
      if (diff <= 0) { target = endOfMonth(); diff = Math.max(0, target.getTime() - Date.now()); }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setAll(dEls, pad(days));
      setAll(hEls, pad(hours));
      setAll(mEls, pad(mins));
      setAll(sEls, pad(secs));
    }
    update();
    setInterval(update, 1000);
  })();

  /* ---------- FAQ: keep one open at a time ---------- */
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (item.open) {
        faqItems.forEach(function (other) { if (other !== item) other.open = false; });
      }
    });
  });
})();
