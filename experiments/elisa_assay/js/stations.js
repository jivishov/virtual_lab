/* =============================================================================
 * stations.js  —  Everything on the bench that stays put, plus the two hand
 * tools that are not the micropipette.
 *
 *   fixed      tip box · reagent rack · sample rack · wash bottle · waste ·
 *              paper towels · bench timer
 *   in hand    transfer pipet · fine-tipped marker
 *
 * Also owns the incubation countdown, the reagent levels (derived from state,
 * never nudged per dispense), and dragging a strip over to the towels.
 *
 * Exposed as  Lab.stations
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var cfg = Lab.config;
  var A = Lab.assets;

  var overlay = null;
  var timerSvg = null, towelsSvg = null;
  var transferEl = null, markerEl = null;
  var hostRefs = {};

  function tok(name, fb) { return (Lab.theme && Lab.theme.color) ? Lab.theme.color(name, fb) : fb; }
  function reduced() { return Lab.theme && Lab.theme.reducedMotion; }

  /* ----- build ----------------------------------------------------------- */
  function build(opts) {
    overlay = opts.overlay;
    hostRefs = opts;

    opts.tray.innerHTML =
      item(A.tipBox(), 'Fresh tips') +
      ['DIL', 'AG', 'AB1', 'AB2', 'TMB', 'STOP'].map(function (id) {
        return item(A.reagentTube(id, cfg.REAGENTS[id], LEVEL_FULL), cfg.REAGENTS[id].name);
      }).join('') +
      item(A.washBottle(), 'Wash buffer') +
      item(A.wasteBin(), 'Waste');

    renderRack();

    opts.towels.innerHTML = A.paperTowels();
    towelsSvg = opts.towels.querySelector('#towels-svg');

    opts.timer.innerHTML = A.benchTimer();
    timerSvg = opts.timer.querySelector('#timer-svg');

    mountTools();

    wireActivation(opts.tray);
    wireActivation(opts.rack);
    wireActivation(opts.towels);
    wireActivation(opts.timer);

    setupStripDrag('A');
    setupStripDrag('B');

    paintInstruments();
    updateLevels(false);

    if (!levelsWired) {
      levelsWired = true;
      Lab.state.on('pipette', function () { updateLevels(true); });
      Lab.state.on('phase', function () { updateLevels(true); });
      Lab.state.on('patients', renderRack);
    }
  }
  var levelsWired = false;

  /* A piece of apparatus plus its name.  The name is HTML rather than SVG
     text because at bench scale a 45 px-wide tube cannot carry a legible
     label, and scaling SVG text up inside a small shape just smears it. */
  function item(svg, caption) {
    return '<div class="tray-item">' + svg +
      '<span class="tray-label">' + A.esc(caption) + '</span></div>';
  }

  /* ----- the sample rack -------------------------------------------------
     The two controls are always there; the nine patients are the cohort, and
     the two this group was handed are marked.  Protocol step 10: "RETRIEVE
     the Control and Patient Samples provided by your instructor." */
  function renderRack() {
    var host = hostRefs.rack;
    if (!host) return;
    var S = Lab.state.S;
    var html =
      '<div class="rack-row rack-row--ctrl">' +
        item(A.sampleTube('POS', false), '+ CTRL') +
        item(A.sampleTube('NEG', false), '– CTRL') +
      '</div>' +
      '<div class="rack-row rack-row--patients">' +
      cfg.PATIENTS.map(function (p) {
        var slot = S.patients.indexOf(p.id);
        return item(A.sampleTube(p.id, slot !== -1),
          p.name + (slot !== -1 ? ' · PT ' + (slot + 1) : ''));
      }).join('') +
      '</div>';
    host.innerHTML = html;
  }

  /* ----- the two hand tools ---------------------------------------------- */
  function mountTools() {
    overlay.insertAdjacentHTML('beforeend',
      '<div id="transfer-holder" class="tool-holder tool-stowed">' + A.transferPipet() + '</div>' +
      '<div id="marker-holder" class="tool-holder tool-stowed">' + A.marker() + '</div>');

    transferEl = overlay.querySelector('#transfer-holder');
    markerEl = overlay.querySelector('#marker-holder');

    Lab.engine.registerTool('transfer', transferEl);
    Lab.engine.registerTool('marker', markerEl);
    Lab.tools.drag(transferEl, 'transfer', transferTip);
    Lab.tools.drag(markerEl, 'marker', markerNib);
  }

  function transferTip() {
    var t = transferEl.querySelector('#tp-tip');
    var r = t.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.bottom };
  }
  function markerNib() {
    var t = markerEl.querySelector('#mk-nib');
    var r = t.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.bottom };
  }

  /** How full the transfer pipet looks. */
  function setTransferLoad(pct) {
    var liq = transferEl && transferEl.querySelector('#tp-liquid');
    if (!liq) return;
    var paint = (Lab.theme && Lab.theme.sci) ? Lab.theme.sci('WASH', 'fill') : cfg.REAGENTS.WASH.fill;
    transferEl.style.setProperty('--tp-paint', paint);
    var h = 260 * Math.max(0, Math.min(1, pct));
    if (Lab.env.gsap && !reduced()) {
      gsap.to(liq, { duration: 0.35, ease: 'power2.out',
        attr: { y: 300 - h - 8, height: h, 'fill-opacity': pct > 0 ? 0.85 : 0 } });
    } else {
      liq.setAttribute('y', 300 - h - 8);
      liq.setAttribute('height', h);
      liq.setAttribute('fill-opacity', pct > 0 ? 0.85 : 0);
    }
  }

  /** A dab of the nib — the marker's equivalent of a plunger press.  The
      other two tools visibly answer a thumb whether or not the bench accepts
      the action; without this the marker was the one tool that could be
      pressed and give nothing back at all, which reads as a dead camera. */
  function dabMarker() {
    if (!markerEl || !Lab.env.gsap || reduced()) return;
    gsap.fromTo(markerEl, { y: 0 }, { y: 5, duration: 0.09, yoyo: true, repeat: 1,
      ease: 'sine.inOut', clearProps: 'y' });
  }

  /** Squeeze the bulb — the transfer pipet's equivalent of a plunger press. */
  function squeeze() {
    if (!Lab.env.gsap || reduced()) return;
    gsap.fromTo(transferEl, { scaleX: 1 },
      { scaleX: 0.9, duration: 0.14, yoyo: true, repeat: 1, transformOrigin: '50% 12%',
        ease: 'sine.inOut' });
  }

  /* ----- reagent levels --------------------------------------------------
     Derived from state, never nudged by a fixed offset per aspiration: a
     tube has to still read as having something left after the last dose,
     because a technician never plans to finish exactly dry. */
  var LEVEL_FULL = 0.90;
  var LEVEL_END = 0.22;

  var NEEDED = {
    DIL: 11, AG: 2,
    AB1: 24, AB2: 24, TMB: 24, STOP: 24
  };

  function dosesUsed(id) {
    var S = Lab.state.S, n = 0;
    if (id === 'DIL') {
      for (var i = 2; i <= 12; i++) if (S.wells[i].vol > 0 || S.wells[i].bound > 0) n++;
    } else if (id === 'AG') {
      n = S.wells[1].vol > 0 || S.wells[1].bound > 0 ? 2 : 0;
    } else {
      cfg.allWells().forEach(function (w) { if (S.wells[w].received[id]) n++; });
    }
    if (S.pipette.reagent === id && S.pipette.volume > 0) n += S.pipette.volume / cfg.VOLUME.dose;
    return n;
  }

  var lastLevelKey = '';

  function updateLevels(animate) {
    var ids = Object.keys(NEEDED);
    var key = ids.map(dosesUsed).join(':');
    if (animate && key === lastLevelKey) return;
    lastLevelKey = key;
    ids.forEach(function (id) {
      var svg = document.querySelector('.reagent-tube[data-reagent="' + id + '"]');
      if (!svg) return;
      var frac = Math.min(1, dosesUsed(id) / NEEDED[id]);
      var y = A.tubeLiquidY(LEVEL_FULL - (LEVEL_FULL - LEVEL_END) * frac);
      var rect = svg.querySelector('rect.tube-liquid');
      var ell = svg.querySelector('ellipse.tube-liquid');
      if (animate && Lab.env.gsap && !reduced()) {
        if (rect) gsap.to(rect, { duration: 0.5, attr: { y: y }, ease: 'power1.out' });
        if (ell) gsap.to(ell, { duration: 0.5, attr: { cy: y }, ease: 'power1.out' });
      } else {
        if (rect) rect.setAttribute('y', y);
        if (ell) ell.setAttribute('cy', y);
      }
    });
  }

  /* #timer-led is animated by GSAP with attr:{fill}, so it deliberately has
     NO CSS fill rule — a stylesheet rule would beat the presentation
     attribute and the animation would never show.  Its resting colour has to
     be painted from tokens here, and re-painted whenever the theme changes. */
  function paintInstruments() {
    if (!timerSvg) return;
    var led = timerSvg.querySelector('#timer-led');
    if (led) led.setAttribute('fill', tok('--mat-led-off', '#7a8b96'));
  }

  function wireActivation(host) {
    if (!host) return;
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

  /* ----- the incubation countdown ----------------------------------------
     Real time is 5 minutes at room temperature.  The clock face counts real
     minutes because that is the number a student has to carry to the printed
     protocol; only the wall-clock rate is compressed. */
  function runTimer(seconds, cb) {
    var readout = timerSvg.querySelector('#timer-readout');
    var arc = timerSvg.querySelector('#timer-arc');
    var led = timerSvg.querySelector('#timer-led');
    var CIRC = 2 * Math.PI * 17;
    var wall = seconds / cfg.TIMING.speed;

    timerSvg.classList.add('running');
    var t = { s: seconds };
    var show = function () {
      var m = Math.floor(t.s / 60), ss = Math.floor(t.s % 60);
      readout.textContent = m + ':' + (ss < 10 ? '0' : '') + ss;
      arc.setAttribute('stroke-dashoffset', String(CIRC * (1 - t.s / seconds)));
    };
    show();

    var finish = function () {
      t.s = 0; show();
      timerSvg.classList.remove('running');
      if (led && Lab.env.gsap) gsap.set(led, { attr: { fill: tok('--mat-led-ok', '#4caf50') } });
      if (Lab.env.gsap && !reduced()) {
        gsap.fromTo(timerSvg, { scale: 1 }, { scale: 1.04, duration: 0.16, yoyo: true,
          repeat: 3, transformOrigin: '50% 60%', ease: 'sine.inOut' });
      }
      if (cb) cb();
    };

    if (!Lab.env.gsap) { finish(); return; }
    if (led) gsap.to(led, { duration: 0.4, attr: { fill: tok('--mat-led-warn', '#ffb300') },
      repeat: Math.max(1, Math.round(wall / 0.8)), yoyo: true });
    gsap.to(t, { s: 0, duration: wall, ease: 'none', onUpdate: show, onComplete: finish });
  }

  function dampenTowels(on) {
    var damp = towelsSvg && towelsSvg.querySelector('#towel-damp');
    if (!damp) return;
    if (Lab.env.gsap && !reduced()) gsap.to(damp, { opacity: on ? 0.85 : 0, duration: 0.3 });
    else damp.setAttribute('opacity', on ? '0.85' : '0');
  }

  /* ----- drag a strip over to the paper towels ---------------------------
     Only liftable when the protocol actually says to invert it, which keeps
     the affordance honest: the strips sit still for every other step. */
  function setupStripDrag(id) {
    var host = Lab.surfaces.stripEl(id);
    if (!Lab.env.interact || !host) return;
    var d = { x: 0, y: 0 };
    var inst = interact(host).draggable({
      enabled: false,
      listeners: {
        start: function () {
          host.classList.add('lifting');
          document.body.classList.add('dragging');
        },
        move: function (ev) {
          d.x += ev.dx; d.y += ev.dy;
          host.style.transform = 'translate(' + d.x + 'px,' + d.y + 'px) scale(0.97)';
        },
        end: function () {
          host.classList.remove('lifting');
          document.body.classList.remove('dragging');
          var over = overlaps(host, towelsSvg);
          if (Lab.env.gsap) {
            gsap.to(host, { duration: 0.38, x: 0, y: 0, scale: 1, clearProps: 'transform',
              ease: 'power2.out', onComplete: function () { host.style.transform = ''; } });
          } else { host.style.transform = ''; }
          d.x = 0; d.y = 0;
          if (over && !Lab.state.S.busy) Lab.engine.clickAct(towelsSvg);
        }
      }
    });
    Lab.state.on('phase', function () {
      inst.draggable({ enabled: Lab.engine.stripsAreLiftable() });
    });
  }

  function overlaps(a, b) {
    if (!a || !b) return false;
    var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return !(ra.right < rb.left || ra.left > rb.right || ra.bottom < rb.top || ra.top > rb.bottom);
  }

  /* ----- which tools are on the bench at this step ----------------------- */
  function syncToolVisibility() {
    var phase = Lab.state.S.phase;
    var wash = /^wash/.test(phase);
    Lab.tools.show('marker', phase === 'label');
    Lab.tools.show('transfer', wash);
    var pip = Lab.pipette.el();
    if (pip) pip.classList.toggle('tool-stowed', phase === 'label' || wash ||
      phase === 'intro' || /^incubate|^develop|^analysis|^done/.test(phase));
  }

  Lab.stations = {
    build: build,
    renderRack: renderRack,
    runTimer: runTimer,
    dampenTowels: dampenTowels,
    paintInstruments: paintInstruments,
    updateLevels: updateLevels,
    setTransferLoad: setTransferLoad,
    squeeze: squeeze,
    dabMarker: dabMarker,
    syncToolVisibility: syncToolVisibility,
    transferEl: function () { return transferEl; },
    markerEl: function () { return markerEl; },
    transferTip: transferTip,
    markerNib: markerNib,
    timerSvg: function () { return timerSvg; },
    towelsSvg: function () { return towelsSvg; }
  };
})(window.Lab = window.Lab || {});
