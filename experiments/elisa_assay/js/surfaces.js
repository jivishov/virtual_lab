/* =============================================================================
 * surfaces.js  —  The two 12-well strip tubes.
 *
 * Injects both strips, exposes the small visual mutators the engine calls
 * (draw the liquid column, write the marker numbers, invert over the towels,
 * flash an overflow), and wires click + keyboard activation as an accessible
 * alternative to dragging the pipette.
 *
 * PAINTING RULE: every runtime colour is written as a CUSTOM PROPERTY on the
 * well group (--well-paint), consumed by a rule in style.css.  Never
 * setAttribute('fill') and never an inline style="fill:…" — the light-box
 * rules must be able to override these, and an inline fill would outrank them.
 *
 * Exposed as  Lab.surfaces
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var cfg = Lab.config;
  var A = Lab.assets;
  var hosts = {};          // strip id -> wrapper element
  var svgs = {};           // strip id -> <svg>

  function reduced() { return Lab.theme && Lab.theme.reducedMotion; }

  /* ----- build ----------------------------------------------------------- */
  function build(hostA, hostB) {
    hosts.A = hostA; hosts.B = hostB;
    hostA.innerHTML = A.stripTube(cfg.STRIPS[0]);
    hostB.innerHTML = A.stripTube(cfg.STRIPS[1]);
    svgs.A = hostA.querySelector('[data-strip="A"]');
    svgs.B = hostB.querySelector('[data-strip="B"]');
    wireActivation(hostA);
    wireActivation(hostB);
    refreshAll(false);
  }

  function wireActivation(host) {
    host.addEventListener('click', function (e) {
      var node = e.target.closest('[data-well]');
      if (node) Lab.engine.clickAct(node);
    });
    host.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var node = e.target.closest('[data-well]');
      if (node) { e.preventDefault(); Lab.engine.clickAct(node); }
    });
  }

  function wellEl(n) {
    var s = svgs[n <= cfg.WELLS_PER_STRIP ? 'A' : 'B'];
    return s && s.querySelector('[data-well="' + n + '"]');
  }
  function stripEl(id) { return hosts[id]; }
  function stripSvg(id) { return svgs[id]; }

  /* ----- the liquid column ------------------------------------------------
     Height comes from the volume, colour and opacity from what is dissolved
     in it.  Both are read from state rather than passed in, so a repaint
     after a theme switch is the same call as a repaint after a dispense.

     The separate LEVEL LINE is not decoration.  Most of the reagents in this
     protocol are water-clear — dilution buffer, antigen, wash buffer, TMB
     going in — and a clear liquid in a clear tube is read by its meniscus,
     not by its colour.  Without the line a student cannot see whether well 1
     holds 50 µL or the 100 µL step 3 asks for. */
  function paintFor(key) {
    if (cfg.SIGNAL[key]) {
      return (Lab.theme && Lab.theme.sci) ? Lab.theme.sci(key, 'base') : cfg.SIGNAL[key].base;
    }
    if (cfg.REAGENTS[key]) {
      return (Lab.theme && Lab.theme.sci) ? Lab.theme.sci(key, 'fill') : cfg.REAGENTS[key].fill;
    }
    return (Lab.theme && Lab.theme.sci) ? Lab.theme.sci('blank', 'base') : cfg.SIGNAL.blank.base;
  }

  // half-width of the moulded well at a given y — the meniscus has to match
  // the taper or the liquid looks like it is floating inside the cone
  function halfWidthAt(y) {
    var yTop = A.STRIP.top, yBot = A.STRIP.bottom - 13;
    var t = Math.max(0, Math.min(1, (y - yTop) / (yBot - yTop)));
    return A.STRIP.halfTop + (A.STRIP.halfBot - A.STRIP.halfTop) * t;
  }

  function drawWell(n, animate) {
    var g = wellEl(n);
    if (!g) return;
    var w = Lab.state.S.wells[n];
    var paint = Lab.state.wellPaint(n);
    var y = A.liquidTop(w.vol);
    var h = Math.max(0, A.STRIP.bottom - y);
    var liq = g.querySelector('.well-liquid');
    var men = g.querySelector('.well-meniscus');
    var lvl = g.querySelector('.well-level');
    var rx = w.vol > 0 ? halfWidthAt(y) - 1.5 : 0;

    g.style.setProperty('--well-paint', paintFor(paint.key));
    g.classList.toggle('has-liquid', w.vol > 0);

    if (Lab.env.gsap && animate && !reduced()) {
      gsap.to(liq, { duration: 0.34, ease: 'power2.out',
        attr: { y: y, height: h, 'fill-opacity': paint.alpha } });
      gsap.to(men, { duration: 0.34, ease: 'power2.out',
        attr: { cy: y, rx: rx, 'fill-opacity': w.vol > 0 ? Math.min(1, paint.alpha + 0.12) : 0 } });
      gsap.to(lvl, { duration: 0.34, ease: 'power2.out',
        attr: { x1: -rx, x2: rx, y1: y, y2: y }, opacity: w.vol > 0 ? 1 : 0 });
    } else {
      liq.setAttribute('y', y);
      liq.setAttribute('height', h);
      liq.setAttribute('fill-opacity', paint.alpha);
      men.setAttribute('cy', y);
      men.setAttribute('rx', rx);
      men.setAttribute('fill-opacity', w.vol > 0 ? Math.min(1, paint.alpha + 0.12) : 0);
      lvl.setAttribute('x1', -rx); lvl.setAttribute('x2', rx);
      lvl.setAttribute('y1', y);   lvl.setAttribute('y2', y);
      lvl.setAttribute('opacity', w.vol > 0 ? 1 : 0);
    }
  }

  function refreshAll(animate) {
    cfg.allWells().forEach(function (n) { drawWell(n, animate); });
    ['A', 'B'].forEach(function (id) {
      if (svgs[id]) svgs[id].classList.toggle('is-labeled', !!Lab.state.S.strips[id].labeled);
    });
  }

  /* ----- a dose landing in a well ---------------------------------------- */
  function dispenseInto(n) {
    drawWell(n, true);
    var g = wellEl(n);
    if (!g || !Lab.env.gsap || reduced()) return;
    var liq = g.querySelector('.well-liquid');
    gsap.fromTo(liq, { attr: { x: -24 } },
      { duration: 0.3, attr: { x: -24 }, ease: 'power1.out' });
    gsap.fromTo(g.querySelector('.well-meniscus'),
      { attr: { ry: 1 } }, { duration: 0.4, attr: { ry: 2.4 }, ease: 'elastic.out(1,0.5)' });
  }

  /* ----- mixing: "gently pipetting up and down 5 times" (step 5) ---------- */
  function mixPulse(n) {
    var g = wellEl(n);
    if (!g) return;
    g.classList.add('mixing');
    drawWell(n, false);
    if (!Lab.env.gsap || reduced()) return;
    var men = g.querySelector('.well-meniscus');
    gsap.fromTo(men, { attr: { ry: 2.4 } },
      { duration: 0.16, attr: { ry: 4.6 }, yoyo: true, repeat: 1, ease: 'sine.inOut' });
    gsap.fromTo(g.querySelector('.well-liquid'), { x: -1.5 },
      { duration: 0.14, x: 1.5, yoyo: true, repeat: 1, ease: 'sine.inOut',
        onComplete: function () { gsap.set(g.querySelector('.well-liquid'), { x: 0 }); } });
  }

  /* ----- step 1: write the numbers on the strips -------------------------- */
  function labelStrip(id, cb) {
    var svg = svgs[id];
    if (!svg) { if (cb) cb(); return; }
    Lab.state.S.strips[id].labeled = true;
    svg.classList.add('is-labeled');
    var nums = svg.querySelectorAll('.strip-num');
    if (!Lab.env.gsap || reduced()) { if (cb) cb(); return; }
    gsap.fromTo(nums, { opacity: 0, y: -4 },
      { opacity: 1, y: 0, duration: 0.22, stagger: 0.035, ease: 'power2.out',
        onComplete: function () { if (cb) cb(); } });
  }

  /* ----- steps 16/18/19: invert over the towels and tap -------------------
     The liquid leaves; whatever has adsorbed to the plastic stays.  That is
     the single most important idea in the whole protocol, so it gets a real
     animation rather than the wells silently emptying. */
  function invertStrip(id, cb) {
    var host = hosts[id];
    var svg = svgs[id];
    if (!host) { if (cb) cb(); return; }

    var finish = function () {
      Lab.state.emptyStrip(id);
      refreshAll(false);
      host.classList.remove('inverting');
      if (cb) cb();
    };

    if (!Lab.env.gsap || reduced()) { finish(); return; }

    host.classList.add('inverting');
    var wellsWithLiquid = Lab.state.wellsOfStrip(id).filter(function (n) {
      return Lab.state.S.wells[n].vol > 0;
    });

    gsap.timeline()
      .to(host, { duration: 0.34, rotate: 176, y: 26, transformOrigin: '50% 60%', ease: 'power2.inOut' })
      // the liquid falls out while the strip is upside down
      .call(function () {
        wellsWithLiquid.forEach(function (n) {
          var g = wellEl(n);
          if (g) gsap.to(g.querySelector('.well-liquid'), { duration: 0.24, attr: { 'fill-opacity': 0 } });
          if (g) gsap.to(g.querySelector('.well-meniscus'), { duration: 0.2, attr: { 'fill-opacity': 0 } });
        });
        if (Lab.stations && Lab.stations.dampenTowels) Lab.stations.dampenTowels(wellsWithLiquid.length > 0);
      })
      // four or five taps against the towel, exactly as the protocol says
      .to(host, { duration: 0.09, y: 36, repeat: 4, yoyo: true, ease: 'power2.in' })
      .to(host, { duration: 0.34, rotate: 0, y: 0, ease: 'power2.inOut' })
      .call(finish);
  }

  /* ----- overfilling a well during the wash ------------------------------- */
  function spill(n) {
    var g = wellEl(n);
    if (!g) return;
    var s = g.querySelector('.well-spill');
    if (!Lab.env.gsap || reduced()) { s.setAttribute('opacity', '0.8'); return; }
    gsap.fromTo(s, { opacity: 0 },
      { opacity: 0.85, duration: 0.18, yoyo: true, repeat: 3, ease: 'sine.inOut' });
  }

  /* ----- the colour change when stop solution lands ----------------------- */
  function flipToStopped(n) {
    var g = wellEl(n);
    drawWell(n, true);
    if (!g || !Lab.env.gsap || reduced()) return;
    gsap.fromTo(g, { scale: 1 }, { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1,
      transformOrigin: '50% 80%', ease: 'sine.inOut' });
  }

  Lab.surfaces = {
    build: build,
    drawWell: drawWell,
    refreshAll: refreshAll,
    dispenseInto: dispenseInto,
    mixPulse: mixPulse,
    labelStrip: labelStrip,
    invertStrip: invertStrip,
    spill: spill,
    flipToStopped: flipToStopped,
    wellEl: wellEl,
    stripEl: stripEl,
    stripSvg: stripSvg,
    paintFor: paintFor
  };
})(window.Lab = window.Lab || {});
