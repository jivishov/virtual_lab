/* =============================================================================
 * main.js  —  Bootstrap.  Detects libraries, builds the bench, wires controls.
 *
 * Load order (see index.html): vendor libs → config → state → assets →
 * ui → surfaces → stations → pipette → engine → analysis → main.
 * ========================================================================== */
(function (Lab) {
  'use strict';

  function boot() {
    // feature detection — everything degrades gracefully without the libs
    Lab.env = { gsap: typeof window.gsap !== 'undefined', interact: typeof window.interact !== 'undefined' };
    if (Lab.env.gsap) { try { gsap.config({ nullTargetWarn: false }); } catch (e) {} }

    Lab.state.reset();

    var $ = function (id) { return document.getElementById(id); };

    // build the two work surfaces
    Lab.surfaces.build($('card-host'), $('plate-host'));

    // build the instruments
    Lab.stations.build({
      overlay: $('pipette-layer'),
      tray: $('instrument-tray'),
      incubator: $('incubator-host'),
      card: $('card-host')
    });

    // mount the pipette, then rest it hovering over the equipment once laid out
    var layer = $('pipette-layer');
    var r = layer.getBoundingClientRect();
    Lab.pipette.mount(layer, { x: Math.max(20, r.width - 130), y: 16 });

    // The bench starts hidden so the case file owns the first screen.
    var bench = document.querySelector('.bench');

    function revealBench() {
      if (!bench || !bench.hidden) return;
      bench.hidden = false;                 // must precede any measuring
      // lets the Laboratory theme retire its ambient glassware: once the bench
      // is in use there is no empty margin for it to occupy (see tokens.css)
      document.body.classList.add('run-started');
      var reduced = Lab.theme && Lab.theme.reducedMotion;
      if (Lab.env.gsap && !reduced) {
        gsap.from(bench, { opacity: 0, y: 12, duration: 0.45, ease: 'expo.out' });
      }
    }

    // Rest the pipette hovering over the tip box. Done when the experiment
    // starts (layout is fully settled by then) and on resize — avoids parking
    // against a transient width during first paint.
    function parkOverEquipment(tries) {
      // While the bench is hidden every rect is 0, so the retry below would
      // spin at 60ms forever on any resize. Bail instead.
      if (!bench || bench.hidden) return;
      var box = document.querySelector('[data-station="tipbox"]');
      if (!box) return;
      var b = box.getBoundingClientRect();
      if (b.width < 10) {                   // layout not ready yet
        var n = tries || 0;
        // capped: never retry indefinitely (setTimeout survives hidden tabs)
        if (n < 25) setTimeout(function () { parkOverEquipment(n + 1); }, 60);
        return;
      }
      Lab.pipette.parkAt({ x: b.left + b.width / 2, y: b.top - 4 });
      var pel = Lab.pipette.el(); if (pel) pel.style.opacity = '1';
    }
    var reparkTimer;
    window.addEventListener('resize', function () {
      clearTimeout(reparkTimer);
      reparkTimer = setTimeout(function () { parkOverEquipment(0); }, 200);
    });

    // UI + analysis
    Lab.ui.init({
      instruction: $('instruction'),
      checklist: $('checklist'),
      phase: $('hud-phase'),
      tip: $('hud-tip'),
      reagent: $('hud-reagent'),
      volFill: $('vol-fill'),
      volText: $('vol-text'),
      progFill: $('prog-fill'),
      progText: $('prog-text'),
      toast: $('toast')
    });
    Lab.analysis.init({
      section: $('analysis'),
      legend: $('legend'),
      table: $('results-table'),
      feedback: $('feedback'),
      checkBtn: $('check-btn'),
      eraseBtn: $('erase-btn'),
      cvdToggle: $('cvd-toggle')
    });

    // start / intro modal
    var modal = $('intro-modal');
    $('start-btn').addEventListener('click', function () {
      modal.classList.add('closing');
      setTimeout(function () { modal.hidden = true; }, 350);
      revealBench();
      Lab.engine.start();
      parkOverEquipment(0);
    });

    // teacher / preview shortcut
    var demo = $('demo-btn');
    if (demo) demo.addEventListener('click', function () {
      if (modal && !modal.hidden) { modal.hidden = true; }
      revealBench();
      if (Lab.state.S.phase === 'intro') Lab.engine.start();
      parkOverEquipment(0);
      Lab.engine.demoSkip();
    });

    Lab.engine.refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.Lab = window.Lab || {});
