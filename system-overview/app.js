/* app.js — dựng trang tổng quan từ window.HEVA + window.HEVA_METRICS */
(function () {
  const H = window.HEVA;
  const M = window.HEVA_METRICS || { routes: {}, docs: {} };
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const chkIcon = { done: 'ph-check', partial: 'ph-dots-three', planned: 'ph-circle' };

  /* ---------- KPI data (mix metrics + content) ---------- */
  const r = M.routes || {};
  // KPI đầu trang: dẫn bằng số mang tính SẢN PHẨM (dễ hiểu cho người mới).
  const KPIS = [
    { ic: 'ph-tag', tone: 'accent', v: M.services ?? 7, l: 'Dịch vụ SEO', sub: 'Khách có thể đặt' },
    { ic: 'ph-users-three', tone: 'primary', v: H.roles.length, l: 'Vai trò người dùng', sub: 'Khách · Staff · Manager · Admin' },
    { ic: 'ph-monitor', tone: 'good', v: r.total ?? '—', l: 'Màn hình', sub: `${r.portal ?? 0} khách · ${r.staff ?? 0} staff · ${r.admin ?? 0} admin` },
    { ic: 'ph-flow-arrow', tone: 'accent', v: (H.lifecycle && H.lifecycle.steps ? H.lifecycle.steps.length : 10), l: 'Trạng thái đơn', sub: 'Vòng đời Mới → Hoàn tất' },
    { ic: 'ph-flask', tone: 'warn', v: 'Mock', l: 'Nguồn dữ liệu', sub: 'Phase 0 · backend kế hoạch' },
    { ic: 'ph-git-branch', tone: 'primary', v: '0/4', l: 'Phase hiện tại', sub: 'Lộ trình Phase 0 → 4' },
  ];
  // Số liệu kỹ thuật (đẩy xuống mục Công nghệ — không làm rối người mới).
  const cov = M.coverage || {};
  const BUILD_STATS = [
    { v: M.components ?? '—', l: 'Components (.tsx)' },
    { v: M.dataTypes ?? '—', l: 'Type dữ liệu' },
    { v: r.total ?? '—', l: 'Routes' },
    { v: M.docs && M.docs.specs != null ? M.docs.specs : '—', l: 'Spec docs' },
    { v: cov.pct != null ? cov.pct + '%' : '—', l: `Coverage mô tả (${cov.documented ?? '—'}/${cov.codeRoutes ?? '—'} route)` },
  ];
  const toneColor = { primary: 'var(--primary)', accent: 'var(--accent)', good: 'var(--good)', warn: 'var(--warn)' };

  /* ---------- Donut (SVG) ---------- */
  function donut(data, size = 168) {
    const total = data.reduce((a, d) => a + d.value, 0);
    const R = size / 2 - 16, C = size / 2, circ = 2 * Math.PI * R;
    let off = 0;
    const rings = data.map((d) => {
      const frac = d.value / total;
      const seg = `<circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${d.color}" stroke-width="16"
        stroke-dasharray="${(frac * circ).toFixed(2)} ${circ.toFixed(2)}"
        stroke-dashoffset="${(-off * circ).toFixed(2)}" transform="rotate(-90 ${C} ${C})"
        stroke-linecap="butt"><title>${esc(d.label)}: ${d.value}</title></circle>`;
      off += frac; return seg;
    }).join('');
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Tình hình giao">
      <circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="var(--surface-2)" stroke-width="16"/>
      ${rings}
      <text x="${C}" y="${C - 4}" text-anchor="middle" fill="var(--text)" font-size="26" font-weight="800">${total}</text>
      <text x="${C}" y="${C + 16}" text-anchor="middle" fill="var(--text-faint)" font-size="10.5">hạng mục</text>
    </svg>`;
  }

  /* ---------- Build: KPI ---------- */
  const kg = $('#kpi-grid');
  KPIS.forEach((k) => {
    const c = toneColor[k.tone] || 'var(--primary)';
    const n = el('div', 'kpi');
    n.innerHTML = `<div class="ic" style="background:color-mix(in srgb,${c} 16%,transparent);color:${c}"><i class="ph ${k.ic}"></i></div>
      <div class="v">${k.v}</div><div class="l">${esc(k.l)}</div><div class="sub">${esc(k.sub)}</div>`;
    kg.appendChild(n);
  });

  /* ---------- Build: charts (donut + role bars) ---------- */
  $('#donut').innerHTML = donut(H.delivery);
  const dTotal = H.delivery.reduce((a, d) => a + d.value, 0);
  $('#donut-legend').innerHTML = H.delivery.map((d) =>
    `<div class="li"><span class="sw" style="background:${d.color}"></span><span>${esc(d.label)}</span><b>${d.value}</b><small>${Math.round(d.value / dTotal * 100)}%</small></div>
     <div style="font-size:11px;color:var(--text-faint);margin:-4px 0 4px 20px">${esc(d.note)}</div>`).join('');

  const maxCount = Math.max(...H.roles.map((x) => x.count));
  $('#role-bars').innerHTML = H.roles.map((x) =>
    `<div class="bar-row"><span class="name"><i class="ph ${x.icon}" style="color:${x.color}"></i>${esc(x.name.split(' ')[0])}</span>
     <span class="bar-track"><span class="bar-fill" style="width:${(x.count / maxCount * 100).toFixed(0)}%;background:${x.color}"></span></span>
     <span class="num">${x.count}</span></div>`).join('');

  /* ---------- Build: intro ("Đây là gì?") ---------- */
  if ($('#intro-cards') && H.intro) {
    $('#intro-cards').innerHTML = H.intro.cards.map((c) =>
      `<div class="intro-card"><div class="intro-ic"><i class="ph ${c.icon}"></i></div>
       <h4>${esc(c.title)}</h4><p>${esc(c.body)}</p></div>`).join('');
    $('#cast').innerHTML = H.intro.cast.map((c) =>
      `<div class="cast-item"><span class="cast-ic" style="background:${c.color}"><i class="ph ${c.icon}"></i></span>
       <div><b>${esc(c.role)}</b><span>${esc(c.line)}</span></div></div>`).join('');
  }

  /* ---------- Build: journey (xuyên vai trò) ---------- */
  if ($('#journey-flow') && H.journey) {
    $('#journey-note').textContent = H.journey.note;
    $('#journey-flow').innerHTML = H.journey.steps.map((s, i) =>
      `<div class="jstep"><div class="jstep-top"><span class="jnum" style="background:${s.color}">${i + 1}</span>
        ${i < H.journey.steps.length - 1 ? '<span class="jline"></span>' : ''}</div>
        <div class="jcard"><div class="jactor" style="color:${s.color}"><i class="ph ${s.icon}"></i> ${esc(s.actor)}</div>
        <b>${esc(s.title)}</b><p>${esc(s.desc)}</p></div></div>`).join('');
  }

  /* ---------- Build: glossary ---------- */
  if ($('#glossary-grid') && H.glossary) {
    $('#glossary-grid').innerHTML = H.glossary.map((g) =>
      `<div class="gloss"><b>${esc(g.term)}</b><span>${esc(g.def)}</span></div>`).join('');
  }

  /* ---------- Build: build stats (tech section) ---------- */
  if ($('#build-stats')) {
    $('#build-stats').innerHTML = BUILD_STATS.map((b) =>
      `<div class="bstat"><b>${b.v}</b><span>${esc(b.l)}</span></div>`).join('');
  }

  /* ---------- Build: business snapshot (mock) ---------- */
  const bg = $('#biz-grid');
  if (bg) {
    H.business.kpis.forEach((k) => {
      const c = toneColor[k.tone] || 'var(--primary)';
      const n = el('div', 'kpi');
      n.innerHTML = `<div class="ic" style="background:color-mix(in srgb,${c} 16%,transparent);color:${c}"><i class="ph ${k.ic}"></i></div>
        <div class="v">${k.v}</div><div class="l">${esc(k.l)}</div><div class="sub">${esc(k.sub)}</div>`;
      bg.appendChild(n);
    });
    $('#biz-note').textContent = H.business.note;
    const mixMax = Math.max(...H.business.serviceMix.map((m) => m.orders));
    $('#biz-mix').innerHTML = H.business.serviceMix.map((m) =>
      `<div class="bar-row"><span class="name">${esc(m.service)}</span>
       <span class="bar-track"><span class="bar-fill" style="width:${(m.orders / mixMax * 100).toFixed(0)}%;background:${m.color}"></span></span>
       <span class="num">${m.orders}</span></div>`).join('');
  }

  /* ---------- Build: architecture ---------- */
  $('#arch').innerHTML = H.architecture.blocks.map((b) =>
    `<div class="node ${b.tone}"><h4>${esc(b.title)}</h4><div class="tag">${esc(b.sub)}</div><p>${esc(b.desc)}</p></div>`).join('');
  $('#arch-note').innerHTML = `<i class="ph ph-info"></i><span>${esc(H.architecture.note)}</span>`;

  /* ---------- Build: tech ---------- */
  $('#tech-grid').innerHTML = H.tech.map((t) =>
    `<div class="tech-item"><span class="g">${esc(t.group)}</span><b>${esc(t.name)}</b><p>${esc(t.note)}</p></div>`).join('');

  /* ---------- Build: roles (cards click → slide-over) ---------- */
  const REG = []; // registry: index → { ...screen, roleName, roleColor }
  const feat = (f, ctx) => {
    const fid = REG.push({ ...f, roleName: ctx.name, roleColor: ctx.color }) - 1;
    return `<div class="feat" role="button" tabindex="0" data-fid="${fid}">
      <span class="chk ${f.status}"><i class="ph ${chkIcon[f.status]}"></i></span>
      <div class="feat-main"><div class="ft">${esc(f.name)} ${f.route ? `<span class="route">${esc(f.route)}</span>` : ''}</div>
      <div class="fd">${esc(f.desc)}</div></div>
      <i class="ph ph-caret-right feat-caret"></i></div>`;
  };

  const rolesWrap = $('#roles');
  H.roles.forEach((role) => {
    const ctx = { name: role.name, color: role.color };
    const sec = el('section'); sec.id = 'role-' + role.id;
    let body = `<div class="role-head">
        <div class="role-ic" style="background:${role.color}"><i class="ph ${role.icon}"></i></div>
        <div><h3>${esc(role.name)}</h3><div class="rt mono">${esc(role.route)} · ${role.count} màn hình</div></div>
      </div>
      <p class="role-summary">${esc(role.summary)}</p>`;

    if (role.groups) {
      body += role.groups.map((g) =>
        `<div class="subgroup-title">${esc(g.title)}</div><div class="feat-grid">${g.items.map((it) => feat(it, ctx)).join('')}</div>`).join('');
    } else {
      body += `<div class="feat-grid">${role.screens.map((s) => feat(s, ctx)).join('')}</div>`;
    }
    if (role.flows) {
      body += `<div class="flows"><div class="ft">Luồng nghiệp vụ chính</div><ol>${role.flows.map((f) => `<li>${esc(f)}</li>`).join('')}</ol></div>`;
    }
    sec.innerHTML = `<div class="card">${body}</div>`;
    rolesWrap.appendChild(sec);
  });

  /* ---------- Slide-over panel (chi tiết tính năng) ---------- */
  const statusText = { done: 'UI hoàn chỉnh (mock)', partial: 'Đang mở rộng', planned: 'Kế hoạch (chờ backend)' };
  const panel = el('aside', 'panel'); panel.id = 'panel'; panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `<div class="panel-inner">
      <button class="panel-close" id="panel-close" aria-label="Đóng"><i class="ph ph-x"></i></button>
      <div id="panel-body"></div>
    </div>`;
  const panelScrim = el('div', 'panel-scrim'); panelScrim.id = 'panel-scrim';
  document.body.appendChild(panelScrim);
  document.body.appendChild(panel);

  function openPanel(fid) {
    const f = REG[fid]; if (!f) return;
    const renderItem = (d, cls, icon) => {
      const sep = d.indexOf(' — ');
      const name = sep > -1 ? d.slice(0, sep) : d;
      const rest = sep > -1 ? d.slice(sep + 3) : '';
      return `<li class="${cls}"><i class="ph ${icon}"></i><span>${rest ? `<b>${esc(name)}</b><span class="ti-rest"> — ${esc(rest)}</span>` : esc(d)}</span></li>`;
    };
    const t1 = (f.tier1 && f.tier1.length) ? f.tier1 : [];
    const t2 = (f.tier2 && f.tier2.length) ? f.tier2 : [];
    const fallback = (!t1.length && !t2.length) ? (f.detail || [f.desc]) : [];
    $('#panel-body').innerHTML = `
      <div class="panel-role" style="color:${f.roleColor}"><span class="dot-sm" style="background:${f.roleColor}"></span>${esc(f.roleName)}</div>
      <h3 class="panel-title">${esc(f.name)}</h3>
      <div class="panel-meta">
        ${f.route ? `<span class="route">${esc(f.route)}</span>` : ''}
        <span class="panel-pill ${f.status}"><i class="ph ${chkIcon[f.status]}"></i> ${statusText[f.status]}</span>
      </div>
      <p class="panel-desc">${esc(f.desc)}</p>
      ${t1.length ? `<div class="panel-sub tier1-label"><i class="ph ph-star-four"></i>Tier 1 — Tính năng cốt lõi</div>
      <ul class="panel-list tier1-list">${t1.map((d) => renderItem(d, 'ti1', 'ph-check-circle')).join('')}</ul>` : ''}
      ${t2.length ? `<div class="panel-sub tier2-label"><i class="ph ph-plus-circle"></i>Tier 2 — Mở rộng & hỗ trợ</div>
      <ul class="panel-list tier2-list">${t2.map((d) => renderItem(d, 'ti2', 'ph-circle')).join('')}</ul>` : ''}
      ${fallback.length ? `<div class="panel-sub">Chi tiết tính năng</div><ul class="panel-list">${fallback.map((d) => `<li><i class="ph ph-check"></i><span>${esc(d)}</span></li>`).join('')}</ul>` : ''}`;
    panel.classList.add('open'); panelScrim.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    $('#panel-close').focus();
  }
  function closePanel() {
    panel.classList.remove('open'); panelScrim.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }
  rolesWrap.addEventListener('click', (e) => {
    const card = e.target.closest('.feat'); if (card) openPanel(+card.dataset.fid);
  });
  rolesWrap.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('feat')) {
      e.preventDefault(); openPanel(+e.target.dataset.fid);
    }
  });
  $('#panel-close').addEventListener('click', closePanel);
  panelScrim.addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

  /* ---------- Build: data model ---------- */
  $('#dm-note').textContent = H.dataModel.note;
  $('#dm-body').innerHTML = H.dataModel.entities.map((e) =>
    `<tr><td><b>${esc(e.name)}</b></td><td>${esc(e.file)}</td><td>${esc(e.fields)}</td><td>${esc(e.rel)}</td></tr>`).join('');

  /* ---------- Build: roadmap ---------- */
  $('#timeline').innerHTML = H.roadmap.map((p) =>
    `<div class="phase ${p.tone}"><div class="ph-head"><span class="ph-tag">${esc(p.phase)}</span><b>${esc(p.title)}</b>
     <span class="ph-state">${p.status === 'in-progress' ? '● đang làm' : '○ kế hoạch'}</span></div>
     <ul>${p.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('');

  $('#loop').innerHTML = `<h3><i class="ph ph-target"></i>${esc(H.minLoop.title)}</h3>
    <p class="hint">${esc(H.minLoop.note)}</p><ol>${H.minLoop.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`;

  /* ---------- Build: services catalog ---------- */
  if ($('#svc-grid')) {
    $('#svc-note').textContent = H.services.note;
    $('#svc-grid').innerHTML = H.services.items.map((s) =>
      `<div class="svc"><div class="svc-h"><span class="svc-ic" style="background:color-mix(in srgb,${s.color} 16%,transparent);color:${s.color}"><i class="ph ${s.icon}"></i></span>
        <div><b>${esc(s.name)}</b><div class="svc-meta">${esc(s.model)} · <span style="color:${s.color}">${esc(s.price)}</span></div></div></div>
        <p class="svc-desc">${esc(s.desc)}</p><div class="svc-tiers">${esc(s.tiers)}</div></div>`).join('');
  }

  /* ---------- Build: order lifecycle ---------- */
  if ($('#lifecycle-flow')) {
    $('#lifecycle-note').textContent = H.lifecycle.note;
    const tcol = { primary: 'var(--primary)', accent: 'var(--accent)', good: 'var(--good)', warn: 'var(--warn)', muted: 'var(--text-faint)' };
    $('#lifecycle-flow').innerHTML = H.lifecycle.steps.map((s, i) => {
      const c = tcol[s.t];
      const arrow = i < H.lifecycle.steps.length - 1 && s.k !== 'completed' ? '<i class="ph ph-caret-right life-arrow"></i>' : '';
      return `<span class="life-chip" style="border-color:color-mix(in srgb,${c} 45%,var(--line));color:${c}"><b>${i + 1}</b>${esc(s.l)}</span>${arrow}`;
    }).join('');
    if ($('#lifecycle-rules') && H.lifecycle.rules) {
      $('#lifecycle-rules').innerHTML = H.lifecycle.rules.map((r) =>
        `<div class="life-rule"><span class="life-rule-ic" style="background:color-mix(in srgb,${r.color} 16%,transparent);color:${r.color}"><i class="ph ${r.icon}"></i></span>
         <div><b style="color:${r.color}">${esc(r.title)}</b><p>${esc(r.desc)}</p></div></div>`).join('');
    }
  }

  /* ---------- Build: RBAC matrix ---------- */
  if ($('#rbac-body')) {
    $('#rbac-note').textContent = H.rbac.note;
    $('#rbac-head').innerHTML = '<th>Khu vực</th>' + H.rbac.cols.map((c) => `<th style="text-align:center">${esc(c)}</th>`).join('');
    const cell = (v) => {
      const map = {
        yes: `<span class="rb yes" title="${esc(H.rbac.legend.yes)}"><i class="ph ph-check-circle"></i></span>`,
        no: `<span class="rb no" title="${esc(H.rbac.legend.no)}"><i class="ph ph-minus"></i></span>`,
        own: `<span class="rb own" title="${esc(H.rbac.legend.own)}">của mình</span>`,
        self: `<span class="rb own" title="${esc(H.rbac.legend.self)}">lương mình</span>`,
      };
      return `<td style="text-align:center">${map[v] || ''}</td>`;
    };
    $('#rbac-body').innerHTML = H.rbac.rows.map((r) =>
      `<tr><td><b>${esc(r.area)}</b></td>${r.v.map(cell).join('')}</tr>`).join('');
  }

  /* ---------- Nav (scroll-spy) ---------- */
  const navLinks = [...document.querySelectorAll('.nav-link[data-target]')];
  const byId = (id) => navLinks.find((l) => l.dataset.target === id);
  const targets = navLinks.map((l) => document.getElementById(l.dataset.target)).filter(Boolean);

  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        navLinks.forEach((l) => l.classList.remove('active'));
        const active = byId(e.target.id); if (active) active.classList.add('active');
        const label = active ? active.dataset.label || active.textContent.trim() : '';
        $('#crumb-current').textContent = label;
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  targets.forEach((t) => spy.observe(t));

  navLinks.forEach((l) => l.addEventListener('click', () => {
    document.getElementById(l.dataset.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    closeSidebar();
  }));

  /* ---------- Search filter (lọc feature card + nav) ---------- */
  const searchInput = $('#search');
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    document.querySelectorAll('.feat').forEach((f) => {
      f.classList.toggle('hidden', q && !f.textContent.toLowerCase().includes(q));
    });
    document.querySelectorAll('#roles section').forEach((s) => {
      const anyVisible = [...s.querySelectorAll('.feat')].some((f) => !f.classList.contains('hidden'));
      s.classList.toggle('hidden', q && !anyVisible);
    });
  });

  /* ---------- Theme ---------- */
  const root = document.documentElement;
  const saved = localStorage.getItem('heva-theme');
  if (saved) root.setAttribute('data-theme', saved);
  $('#theme-btn').addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    if (next === 'dark') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', 'light');
    localStorage.setItem('heva-theme', next);
    syncThemeIcon();
  });
  function syncThemeIcon() {
    const light = root.getAttribute('data-theme') === 'light';
    $('#theme-btn i').className = 'ph ' + (light ? 'ph-moon' : 'ph-sun');
  }
  syncThemeIcon();

  /* ---------- Mobile sidebar ---------- */
  const sidebar = $('#sidebar');
  function closeSidebar() { sidebar.classList.remove('open'); $('#scrim')?.remove(); }
  $('#menu-toggle').addEventListener('click', () => {
    sidebar.classList.add('open');
    const scrim = el('div', 'scrim'); scrim.id = 'scrim'; scrim.addEventListener('click', closeSidebar);
    document.body.appendChild(scrim);
  });

  /* ---------- Footer meta ---------- */
  const when = M.generatedAt ? new Date(M.generatedAt).toLocaleString('vi-VN') : '—';
  $('#gen-meta').innerHTML = `Số liệu tự tính từ code lúc <code>${esc(when)}</code> · cập nhật: <code>node system-overview/generate.mjs</code>`;
})();
