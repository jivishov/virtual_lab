/* =============================================================================
 * stations.js  —  Fixed instruments: tip box, reagent tubes, waste bin,
 * incubator (drying oven) and the hand-held UV lamp.
 *
 * Handles their layout, click/keyboard activation, the incubation cycle
 * animation, dragging the card into the oven, and the UV "darkroom" reveal
 * where a draggable beam uncovers the fluorescent spots.
 *
 * Exposed as  Lab.stations
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var cfg = Lab.config;
  var overlay = null;         // #pipette-layer (for the UV lamp + beam)
  var incubatorSvg = null;
  var uvLamp = null, uvBeam = null;
  var uvArmed = false;

  function build(opts) {
    overlay = opts.overlay;

    // instrument tray (tip box, three reagent tubes, waste bin)
    opts.tray.innerHTML =
      '<div class="tray-item">' + Lab.assets.tipBox() + '</div>' +
      '<div class="tray-item">' + Lab.assets.reagentTube('EB', cfg.REAGENTS.EB, LEVEL_FULL) + '</div>' +
      '<div class="tray-item">' + Lab.assets.reagentTube('cDNA', cfg.REAGENTS.cDNA, LEVEL_FULL) + '</div>' +
      '<div class="tray-item">' + Lab.assets.reagentTube('HB', cfg.REAGENTS.HB, LEVEL_FULL) + '</div>' +
      '<div class="tray-item">' + Lab.assets.wasteBin() + '</div>';

    // incubator
    opts.incubator.innerHTML = Lab.assets.incubator();
    incubatorSvg = opts.incubator.querySelector('#incubator-svg');

    // UV lamp + beam live in the drag overlay so the lamp can sweep the card
    overlay.insertAdjacentHTML('beforeend',
      '<div id="uv-beam" class="uv-beam"></div>' +
      '<div id="uv-lamp-holder" class="uv-lamp-holder" hidden>' + Lab.assets.uvLamp() + '</div>');
    uvBeam = overlay.querySelector('#uv-beam');
    uvLamp = overlay.querySelector('#uv-lamp-holder');

    wireActivation(opts.tray);
    wireActivation(opts.incubator);
    setupUvDrag();
    setupCardDrag(opts.card);
    paintInstruments();
    updateTubeLevels(false);

    // Subscribed once, and never from inside a rebuild: state.js has no off(),
    // so a second build() would stack duplicate listeners forever.
    if (!levelsWired) {
      levelsWired = true;
      Lab.state.on('pipette', function () { updateTubeLevels(true); });
      Lab.state.on('phase', function () { updateTubeLevels(true); });
    }
  }
  var levelsWired = false;

  function tok(name, fb) { return (Lab.theme && Lab.theme.color) ? Lab.theme.color(name, fb) : fb; }

  /* ----- reagent tube levels -------------------------------------------
     Each tube must hold enough for the whole run and still read as having
     something left at the end — a technician never plans to finish exactly
     dry.  The level is DERIVED from state rather than nudged per aspiration:
     the old code moved the liquid a fixed 6px each time, which drained the
     visible column after ~13 aspirations even though 36 doses are required,
     so the tube looked empty with half the card still to do. */
  var LEVEL_FULL = 0.90;   // as delivered
  var LEVEL_END  = 0.20;   // still clearly wet after the last dose

  // Doses of a reagent that have left the tube, derived entirely from state.
  function dosesUsed(reagentId) {
    var S = Lab.state.S, n = 0;
    cfg.allIds().forEach(function (id) {
      if (reagentId === 'EB') { if (S.spots[id].eb) n++; }
      else if (reagentId === 'HB') { if (S.spots[id].hb) n++; }
      else if (reagentId === 'cDNA') { if (S.wells[id].cdna) n++; }
    });
    // a dose sitting in the tip has already left the tube
    if (S.pipette.reagent === reagentId && S.pipette.volume > 0) n++;
    return n;
  }

  var lastDoseKey = '';

  function updateTubeLevels(animate) {
    var need = cfg.allIds().length;                 // one dose per spot/well
    // Cheap memo: this is called from a state subscriber that can fire on
    // every pointermove during the swirl-to-mix gesture, and re-issuing three
    // GSAP tweens per frame would be wasted work.  A forced (non-animated)
    // call from repaint always goes through.
    var key = dosesUsed('EB') + ':' + dosesUsed('cDNA') + ':' + dosesUsed('HB');
    if (animate && key === lastDoseKey) return;
    lastDoseKey = key;
    ['EB', 'cDNA', 'HB'].forEach(function (id) {
      var svg = document.querySelector('.reagent-tube[data-reagent="' + id + '"]');
      if (!svg) return;
      var frac = need ? Math.min(1, dosesUsed(id) / need) : 0;
      var y = Lab.assets.tubeLiquidY(LEVEL_FULL - (LEVEL_FULL - LEVEL_END) * frac);
      var rect = svg.querySelector('rect.tube-liquid');
      var ell = svg.querySelector('ellipse.tube-liquid');
      if (animate && Lab.env.gsap && !(Lab.theme && Lab.theme.reducedMotion)) {
        if (rect) gsap.to(rect, { duration: 0.5, attr: { y: y }, ease: 'power1.out' });
        if (ell) gsap.to(ell, { duration: 0.5, attr: { cy: y }, ease: 'power1.out' });
      } else {
        if (rect) rect.setAttribute('y', y);
        if (ell) ell.setAttribute('cy', y);
      }
    });
  }

  /* #inc-led and #inc-chamber-glow are animated by GSAP with attr:{fill}, so
     they deliberately have NO CSS fill rule (a stylesheet rule would beat the
     presentation attribute and the animation would never show).  That means
     their resting colour has to be painted from tokens here, and re-painted
     whenever the theme changes. */
  function paintInstruments() {
    if (!incubatorSvg) return;
    var led = incubatorSvg.querySelector('#inc-led');
    var glow = incubatorSvg.querySelector('#inc-chamber-glow');
    if (led) led.setAttribute('fill', tok('--mat-led-off', '#455a64'));
    if (glow) glow.setAttribute('fill', tok('--mat-heat-off', 'transparent'));
  }

  function wireActivation(host) {
    host.addEventListener('click', function (e) {
      var node = e.target.closest('[data-station]');
      if (node) Lab.engine.clickAct(node);
    });
    host.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var node = e.target.closest('[data-station]');
      if (node) { e.preventDefault(); Lab.engine.clickAct(node); }
    });
  }

  /* ----- incubation cycle ---------------------------------------------- */
  function incubate(done) {
    var doorEl = incubatorSvg.querySelector('#inc-door');
    var glow = incubatorSvg.querySelector('#inc-chamber-glow');
    var coils = incubatorSvg.querySelector('#inc-coils');
    var led = incubatorSvg.querySelector('#inc-led');
    var readout = incubatorSvg.querySelector('#inc-readout');
    var card = Lab.surfaces.cardEl();
    if (card) card.classList.add('drying');

    if (!Lab.env.gsap) {
      if (card) card.classList.remove('drying');
      if (done) done();
      return;
    }
    var t = { c: 0 };
    var tl = gsap.timeline({ onComplete: function () { if (card) card.classList.remove('drying'); if (done) done(); } });
    tl.set(led, { attr: { fill: tok('--mat-led-warn', '#ffca28') } });
    tl.to(doorEl, { duration: 0.5, rotationY: -105, transformOrigin: '0% 50%', ease: 'power2.inOut' });
    tl.to(glow, { duration: 0.4, attr: { fill: tok('--mat-heat-on', 'rgba(255,112,67,0.35)') } }, '<');
    tl.fromTo(coils, { opacity: 0.4 }, { opacity: 1, duration: 0.5, yoyo: true, repeat: 3 }, '<');
    tl.to(t, {
      c: 40, duration: 1.6,
      onUpdate: function () { readout.textContent = Math.round(25 + t.c) + '°C'; }
    }, '<');
    tl.to(glow, { duration: 0.4, attr: { fill: tok('--mat-heat-off', 'rgba(255,112,67,0)') } });
    tl.set(led, { attr: { fill: tok('--mat-led-ok', '#66bb6a') } });
    tl.to(doorEl, { duration: 0.5, rotationY: 0, transformOrigin: '0% 50%', ease: 'power2.inOut' });
  }

  /* ----- drag the card into the incubator ------------------------------ */
  function setupCardDrag(cardHost) {
    if (!Lab.env.interact || !cardHost) return;
    var start = { x: 0, y: 0 };
    var cardI = interact(cardHost).draggable({
      enabled: false,
      listeners: {
        start: function () {
          cardHost.classList.add('lifting');
          document.body.classList.add('dragging');   // suppress text selection
        },
        move: function (ev) {
          start.x += ev.dx; start.y += ev.dy;
          cardHost.style.transform = 'translate(' + start.x + 'px,' + start.y + 'px) scale(0.96)';
        },
        end: function () {
          cardHost.classList.remove('lifting');
          document.body.classList.remove('dragging');
          var over = overlaps(cardHost, incubatorSvg);
          if (Lab.env.gsap) {
            gsap.to(cardHost, { duration: 0.4, x: 0, y: 0, clearProps: 'transform', ease: 'power2.out',
              onComplete: function () { cardHost.style.transform = ''; } });
          } else { cardHost.style.transform = ''; }
          start.x = 0; start.y = 0;
          if (over && isDryPhase() && !Lab.state.S.busy) {
            // route through the engine so phase logic stays centralised
            Lab.engine.clickAct(incubatorSvg);
          }
        }
      }
    });
    // only allow lifting the card while it is waiting to be dried
    Lab.state.on('phase', function () { cardI.draggable({ enabled: isDryPhase() }); });
  }

  function isDryPhase() {
    var p = Lab.state.S.phase;
    return p === 'dry-eb' || p === 'dry-samples' || p === 'dry-hb';
  }

  function overlaps(a, b) {
    if (!a || !b) return false;
    var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return !(ra.right < rb.left || ra.left > rb.right || ra.bottom < rb.top || ra.top > rb.bottom);
  }

  /* ----- UV darkroom + draggable beam ----------------------------------
     This is the moment the whole lesson builds to, so it gets a real beat
     rather than an instant class flip.  A composited veil fades the room
     down, the token swap happens hidden behind it, then the eyes "adjust".
     Choreographing it this way also means we never have to transition the
     tokens themselves, which is unreliable across engines. */
  function armLamp() {
    uvArmed = true;
    uvLamp.hidden = false;
    // park the lamp just above the card
    var card = Lab.surfaces.cardSvg();
    var host = overlay.getBoundingClientRect();
    if (card) {
      var r = card.getBoundingClientRect();
      uvLamp.style.transform = 'translate(' + (r.left - host.left + r.width / 2 - 30) + 'px,' +
        (r.top - host.top - 40) + 'px)';
    }
    // the power-LED pulse is a CSS animation (#uv-power-led): it re-resolves
    // var() on a theme change for free, where a GSAP repeat:-1 tween would
    // keep stamping the old literal forever.
  }

  function lightsOut() {
    document.documentElement.setAttribute('data-mode', 'darkroom');
    document.body.classList.add('darkroom');      // legacy alias for one release
    if (Lab.theme) Lab.theme.invalidate();
    if (Lab.repaint) Lab.repaint();
  }

  function enterDarkroom() {
    var veil = document.getElementById('blackout');
    var dur = (Lab.theme && Lab.theme.num('--dur-lightsout', 0.9)) || 0.9;

    if (!veil || !Lab.env.gsap) { lightsOut(); armLamp(); return; }

    gsap.timeline()
      .set(veil, { opacity: 0 })
      .to(veil, { opacity: 1, duration: dur, ease: 'power2.in' })
      .call(lightsOut)                                   // swapped unseen
      .to(veil, { opacity: 0, duration: dur * 1.5, ease: 'power2.out' })
      .call(armLamp);
  }

  function bulbPoint() {
    var tube = uvLamp.querySelector('#uv-tube');
    var r = tube.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.bottom + 6 };
  }

  function sweepBeam() {
    var p = bulbPoint();
    var host = overlay.getBoundingClientRect();
    uvBeam.style.opacity = '1';
    uvBeam.style.transform = 'translate(' + (p.x - host.left) + 'px,' + (p.y - host.top) + 'px)';
    // reveal spots inside the beam
    var radius = 92, remaining = 0;
    cfg.allIds().forEach(function (id) {
      var s = Lab.state.S.spots[id];
      if (s.revealed) return;
      var g = document.querySelector('[data-spot="' + id + '"]');
      if (!g) return;
      var r = g.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var d = Math.hypot(cx - p.x, cy - p.y);
      if (d < radius) Lab.surfaces.revealSpot(id);
      else remaining++;
    });
    if (remaining === 0) finishUv();
  }

  function floodReveal() {
    cfg.allIds().forEach(function (id) { if (!Lab.state.S.spots[id].revealed) Lab.surfaces.revealSpot(id); });
    finishUv();
  }

  function finishUv() {
    if (!uvArmed) return;
    uvArmed = false;
    // The lamp has done its job.  Its beam is a screen-blended glow, so left
    // switched on it sits over the card and washes out the very spots the
    // student now has to read — put the wand down.
    retireLamp();
    Lab.engine.onUvRevealed();
  }

  function retireLamp() {
    var park = function () {
      if (uvBeam) uvBeam.style.opacity = '0';
      if (uvLamp) { uvLamp.hidden = true; uvLamp.style.opacity = ''; }
    };
    if (Lab.env.gsap && !(Lab.theme && Lab.theme.reducedMotion)) {
      if (uvBeam) gsap.to(uvBeam, { opacity: 0, duration: 0.45, ease: 'power2.out' });
      if (uvLamp) gsap.to(uvLamp, { opacity: 0, duration: 0.45, ease: 'power2.out', onComplete: park });
      else park();
    } else {
      park();
    }
  }

  function setupUvDrag() {
    if (!Lab.env.interact) return;
    var pos = { x: 0, y: 0 };
    interact(uvLamp).draggable({
      listeners: {
        start: function () {
          var m = readTranslate(uvLamp); pos.x = m.x; pos.y = m.y;
          document.body.classList.add('dragging');   // suppress text selection
        },
        move: function (ev) {
          pos.x += ev.dx; pos.y += ev.dy;
          uvLamp.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';
          if (uvArmed) sweepBeam();
        },
        end: function () { document.body.classList.remove('dragging'); }
      }
    });
    // click the lamp to flood the whole card (accessibility / shortcut)
    uvLamp.addEventListener('click', function () { if (uvArmed) floodReveal(); });
  }

  function readTranslate(node) {
    var m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(node.style.transform || '');
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
  }

  Lab.stations = {
    build: build,
    incubate: incubate,
    enterDarkroom: enterDarkroom,
    floodReveal: floodReveal,
    paintInstruments: paintInstruments,
    updateTubeLevels: updateTubeLevels
  };
})(window.Lab = window.Lab || {});
