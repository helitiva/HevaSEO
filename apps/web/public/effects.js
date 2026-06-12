/* ============================================================
   HevaSEO — background effects (canvas, vanilla, ~0 deps)
   1) Hero  : soft animated blue aurora gradient (keeps text readable)
   2) Dash  : shimmering blue stripes on both edges, dark center (Sui-style transition)
   Auto-pauses when off-screen + respects prefers-reduced-motion.
   ============================================================ */
(function () {
  "use strict";
  var reduce = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setup(canvas) {
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, cssW = 0, cssH = 0;
    function resize() {
      var r = canvas.getBoundingClientRect();
      cssW = r.width; cssH = r.height;
      w = canvas.width = Math.max(1, Math.round(r.width * dpr));
      h = canvas.height = Math.max(1, Math.round(r.height * dpr));
    }
    resize();
    return {
      ctx: ctx,
      get w() { return w; },
      get h() { return h; },
      get cssW() { return cssW; },
      get cssH() { return cssH; },
      dpr: dpr,
      resize: resize
    };
  }

  /* Run rAF but pause when the canvas leaves the screen */
  function runLoop(canvas, frame, drawStatic) {
    var s = setup(canvas);
    var raf = 0, visible = true;

    function tick(t) {
      frame(s, t || 0);
      raf = requestAnimationFrame(tick);
    }
    function start() { if (!raf) raf = requestAnimationFrame(tick); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    window.addEventListener("resize", function () {
      s.resize();
      if (reduce) drawStatic(s);
    });

    if (reduce) { drawStatic(s); return; }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (ents) {
        visible = ents[0].isIntersecting;
        if (visible) start(); else stop();
      }, { threshold: 0 }).observe(canvas);
    } else {
      start();
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else if (visible) start();
    });
  }

  /* ---------- 1) HERO: aurora blobs xanh ---------- */
  function heroAurora(canvas) {
    // gradient "blobs" move along Lissajous paths
    var blobs = [
      { h: 214, s: 95, l: 58, a: 0.30, ax: 0.32, ay: 0.24, sx: 0.07, sy: 0.05, px: 0,   r: 0.58 },
      { h: 226, s: 92, l: 56, a: 0.26, ax: 0.28, ay: 0.22, sx: 0.05, sy: 0.08, px: 2.1, r: 0.52 },
      { h: 196, s: 96, l: 62, a: 0.22, ax: 0.26, ay: 0.18, sx: 0.09, sy: 0.06, px: 4.2, r: 0.46 },
      { h: 205, s: 92, l: 64, a: 0.18, ax: 0.22, ay: 0.16, sx: 0.06, sy: 0.10, px: 1.0, r: 0.42 }
    ];
    function render(s, time, anim) {
      var ctx = s.ctx, w = s.w, h = s.h, t = (time || 0) * 0.001;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      var base = Math.min(w, h);
      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        var ph = anim ? t : 0;
        var cx = (0.5 + Math.sin(ph * b.sx * 6.283 + b.px) * b.ax) * w;
        var cy = (0.45 + Math.cos(ph * b.sy * 6.283 + b.px) * b.ay) * h;
        var rad = base * b.r;
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, "hsla(" + b.h + " " + b.s + "% " + b.l + "% / " + b.a + ")");
        g.addColorStop(1, "hsla(" + b.h + " " + b.s + "% " + b.l + "% / 0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    }
    runLoop(canvas,
      function (s, t) { render(s, t, true); },
      function (s) { render(s, 0, false); });
  }

  /* ---------- 2) DASHBOARD: shimmering blue stripes ---------- */
  function dashStripes(canvas) {
    var BAR = 13; // px per stripe (matches css width)
    function render(s, time, anim) {
      var ctx = s.ctx, w = s.w, h = s.h;
      var bars = Math.max(8, Math.round(s.cssW / BAR));
      var bw = w / bars;
      var t = (time || 0) * 0.001;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < bars; i++) {
        var x = i / (bars - 1);                 // 0..1
        var d = Math.abs(x - 0.5);              // 0 center .. 0.5 edge
        // transparent center (shows dark bg), brightening toward both edges
        var edge = Math.min(1, Math.max(0, (d - 0.16) / 0.34));
        edge = Math.pow(edge, 1.35);
        if (edge <= 0.01) continue;
        var shimmer = anim
          ? (0.55 + 0.45 * Math.sin(i * 0.6 + t * 1.6))
          : 0.7;
        var flick = anim
          ? (0.6 + 0.4 * Math.sin(i * 1.9 - t * 1.1))
          : 0.7;
        var L = 14 + 42 * shimmer * flick;      // stripe brightness
        var hue = 210 + (i % 5) * 2;            // slightly varying blue
        ctx.fillStyle = "hsla(" + hue + " 96% " + L + "% / " + edge + ")";
        ctx.fillRect(Math.floor(i * bw), 0, Math.ceil(bw) + 1, h);
      }
    }
    runLoop(canvas,
      function (s, t) { render(s, t, true); },
      function (s) { render(s, 0, false); });
  }

  function init() {
    var hero = document.getElementById("hero-fx");
    if (hero) heroAurora(hero);
    var dash = document.getElementById("dash-fx");
    if (dash) dashStripes(dash);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
