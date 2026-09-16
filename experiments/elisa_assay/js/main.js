/* =============================================================================
 * main.js  —  Bootstrap.  Detects libraries, renders the briefing, builds the
 * bench, and owns the one decision this app is organised around: which module
 * the student is doing.
 *
 * Load order (see index.html): vendor libs → config → progress → state →
 * assets → figures → tools → ui → surfaces → stations → pipette → engine →
 * analysis → repaint → handcontrol → main.
 * ========================================================================== */
(function (Lab) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function boot() {
    Lab.env = {
      gsap: typeof window.gsap !== 'undefined',
      interact: typeof window.interact !== 'undefined'
    };
    if (Lab.env.gsap) { try { gsap.config({ nullTargetWarn: false }); } catch (e) {} }

    Lab.state.reset();

    // the pair of samples this group was handed last time, if any
    if (Lab.progress) {
      var saved = Lab.progress.patients();
      if (saved) Lab.state.setPatients(saved);
    }

    renderBriefing();

    // work surfaces
    Lab.surfaces.build($('strip-slot-A'), $('strip-slot-B'));

    // the tool layer has to exist before any tool registers a drag
    var layer = $('tool-layer');
    Lab.tools.setLayer(layer);

    // fixed stations and the two secondary hand tools
    Lab.stations.build({
      overlay: layer,
      tray: $('instrument-tray'),
      rack: $('sample-rack'),
      towels: $('towels-host'),
      timer: $('timer-host')
    });

    // the micropipette
    var r = layer.getBoundingClientRect();
    Lab.pipette.mount(layer, { x: Math.max(20, r.width - 140), y: 12 });

    // the strips and the towels can be slid up or down the bench
    Lab.reposition.build();

    Lab.ui.init({
      instruction: $('instruction'),
      checklist: $('checklist'),
      phase: $('hud-phase'),
      tool: $('hud-tool'),
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
      provenance: $('provenance'),
      tableA: $('table-a'),
      tableB: $('table-b'),
      tableC: $('table-c'),
      checkA: $('check-a'),
      checkB: $('check-b'),
      checkC: $('check-c'),
      feedbackA: $('feedback-a'),
      feedbackB: $('feedback-b'),
      feedbackC: $('feedback-c'),
      collectBtn: $('collect-btn'),
      chainWrap: $('chain-wrap'),
      chainPool: $('chain-pool'),
      chainList: $('chain-list'),
      clearChain: $('clear-chain')
    });

    // The camera is an extra way to work the bench, never the only one, so a
    // browser that cannot run it simply has no button — nothing else changes.
    if (Lab.hand) Lab.hand.init($('handtoggle'));

    wireModuleEntry();
    Lab.engine.refresh();
  }

  /* ----- the briefing ----------------------------------------------------
     Built from figures.js and config.js rather than written into the HTML, so
     the diagram, the ladder sketch and the cohort can never drift away from
     the simulation they are explaining. */
  function renderBriefing() {
    var wf = $('fig-workflow'), key = $('fig-key'), ab = $('fig-antibody'), ld = $('fig-ladder');
    if (wf) wf.innerHTML = Lab.figures.workflow(3);
    if (key) key.innerHTML = Lab.figures.workflowKey();
    if (ab) ab.innerHTML = Lab.figures.antibody();
    if (ld) ld.innerHTML = Lab.figures.dilutionSketch();
  }

  /* ----- entering a module ----------------------------------------------
     The two modules are genuinely separate.  Module 1 is the bench; Module 2
     is the read.  Opening Module 2 without having run Module 1 hands you a
     prepared plate, because reading a plate is a skill in its own right and
     gating it behind ninety pipetting actions would teach nobody anything. */
  function wireModuleEntry() {
    var brief = $('briefing');
    var bench = $('bench');

    function showBench() {
      brief.classList.add('closing');
      /* The briefing is a page tall and it is still IN THE FLOW while it
         folds away, so the bench underneath it is measured hundreds of pixels
         below the window until it goes.  Parking the tools before that put
         them against a layout that was about to vanish, and they only ever
         came right on the next resize.  So the tools are placed on the far
         side of the fold instead; the pipette is transparent until it is
         parked, so there is nothing to be seen jumping. */
      setTimeout(function () {
        brief.hidden = true;
        /* No requestAnimationFrame around this: parkTools measures with
           getBoundingClientRect, which flushes layout itself, and a tab that
           is not being painted never runs a frame callback at all — which
           left the tools sitting at the corner of the bench for anybody who
           opened the page in a background tab and came back to it. */
        parkTools(0);
      }, 320);
      /* And again once the web fonts have landed.  Every card is captioned in
         a self-hosted face, so the columns shift when it swaps in — and a
         pipette parked against the old measurement ends up lying across the
         card above it.  fonts.ready is the honest signal; the timeout covers
         the browsers that do not have it, and parkTools declines to move a
         tool that is already in somebody's hand. */
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { parkTools(0); });
      }
      setTimeout(function () { parkTools(0); }, 700);
      bench.hidden = false;
      document.body.classList.add('run-started');
      if (Lab.env.gsap && !(Lab.theme && Lab.theme.reducedMotion)) {
        gsap.from(bench, { opacity: 0, y: 12, duration: 0.45, ease: 'expo.out' });
      }
    }

    $('start-m1').addEventListener('click', function () {
      if (Lab.state.S.patients.length !== 2) {
        Lab.ui.flash('Choose the two patient samples your instructor handed you first.');
        return;
      }
      showBench();
      Lab.analysis.close();
      Lab.engine.startModule1();
    });

    $('start-m2').addEventListener('click', function () {
      if (Lab.state.S.patients.length !== 2) {
        Lab.ui.flash('Choose which two patients this plate was run for.');
        return;
      }
      showBench();
      // a plate this student has not run themselves is prepared for them
      var ranIt = Lab.state.S.done.stop;
      Lab.engine.enterAnalysis(!ranIt);
    });

    // the module tabs in the masthead, once a run is under way
    var tabs = $('moduletabs');
    if (tabs) tabs.addEventListener('click', function (e) {
      var b = e.target.closest('[data-module]');
      if (!b) return;
      var m = parseInt(b.getAttribute('data-module'), 10);
      if (m === 2) {
        if (brief.hidden === false) showBench();
        Lab.engine.enterAnalysis(!Lab.state.S.done.stop);
      } else {
        if (brief.hidden === false) showBench();
        Lab.analysis.close();
        var S = Lab.state.S;
        if (S.done.stop || S.prepared) {
          Lab.engine.restartModule1();
          Lab.ui.flash('Fresh strips on the bench — Module 1 starts again from step 1.');
        } else {
          Lab.state.setModule(1);
          if (S.phase === 'analysis' || S.phase === 'intro') Lab.engine.startModule1();
          Lab.engine.refresh();
        }
        parkTools(0);
      }
    });

    // Rest the tools over the bench once the layout has settled.  While the
    // bench is hidden every rect is 0, so this bails rather than spinning.
    function parkTools(tries) {
      if (!bench || bench.hidden) return;
      // never yank a tool out of a hand that is holding it — mouse or camera
      if (Lab.tools.active()) return;
      var box = document.querySelector('[data-station="tipbox"]');
      if (!box) return;
      var b = box.getBoundingClientRect();
      if (b.width < 10) {
        var n = tries || 0;
        if (n < 25) setTimeout(function () { parkTools(n + 1); }, 60);
        return;
      }
      /* The micropipette and the marker rest BESIDE THE BENCH TIMER, in the
         clear strip of the timer's card between its left edge and the clock
         face.  Three things recommend that spot over the floor of the
         equipment column they used to rest on.  It is empty at every window
         size — the clock is 104 px wide in a card three times that.  It is
         level with the middle of the screen rather than its bottom edge, and
         a real arm reaches the bottom of the picture as awkwardly as the top:
         past a certain reach the camera loses the wrist and with it the thumb
         that every gesture is committed with.  And it is on the side of the
         card that faces the strips, so the first move of every step is short.

         Anchoring to the timer also retires the separate rule hand control
         used to need.  Switching the camera on slides the equipment column
         down the bench; the timer goes down with it, and the tools follow. */
      dropShelf(document.body.classList.contains('hand-on'));   // measure after
      if (Lab.reposition) Lab.reposition.reclamp();

      var timerCard = document.querySelector('.shelf-block--timer');
      var clock = Lab.stations.timerSvg();
      b = box.getBoundingClientRect();

      if (timerCard && clock && clock.getBoundingClientRect().width > 10) {
        var tc = timerCard.getBoundingClientRect();
        var ck = clock.getBoundingClientRect();
        var restY = tc.bottom - 4;             // both tools stand on the card's floor
        var gap = ck.left - tc.left;           // the clear strip beside the clock

        /* The card is 143 px tall and the pipette 180, so the pipette cannot
           be stood inside it whatever is done with its tip: what is bounded
           is the strip of bench the card sits in, from the masthead down to
           the top of the reagent tray.  That band moves with the tray, which
           is what keeps this right when the camera slides the column down. */
        var ber = document.getElementById('bench').getBoundingClientRect();
        var tray = document.querySelector('.shelf-block--tray');
        var floor = (tray ? tray.getBoundingClientRect().top : ber.bottom) - 4;
        var band = { top: ber.top + 2, bottom: floor };

        band.left = tc.left + 8; band.right = ck.left - 8;
        parkWithin(Lab.stations.markerEl(), Lab.stations.markerNib,
          { x: tc.left + gap * 0.34, y: restY }, band);

        var mkr = Lab.stations.markerEl().getBoundingClientRect();
        var pel0 = Lab.pipette.el();
        var pw = pel0 ? pel0.getBoundingClientRect().width : 54;
        band.left = mkr.right + 8;
        // too narrow a card to seat both beside the clock: take its other side
        if (band.right - band.left < pw + 4) {
          band.left = ck.right + 8; band.right = tc.right - 8;
        }
        parkWithin(pel0, Lab.pipette.tipPoint, { x: (band.left + band.right) / 2, y: restY }, band);
      } else {
        Lab.pipette.parkAt({ x: b.left + b.width / 2, y: b.top - 6 });
      }
      var pel = Lab.pipette.el(); if (pel) pel.style.opacity = '1';

      // the transfer pipet lives at the wash bottle it draws from
      var wash = document.querySelector('.wash-bottle');
      if (wash) {
        var wr = wash.getBoundingClientRect();
        Lab.tools.parkAt(Lab.stations.transferEl(), Lab.stations.transferTip,
          { x: wr.left + wr.width / 2, y: wr.top - 6 });
      }
    }

    /* Put a tool's working point on a spot, then nudge it back if its BODY
       landed outside the band it is meant to rest in.  The sprites hang off
       their working points by quite different amounts — the marker's nib is
       almost at its foot, the pipette's tip two thirds of the way down a body
       twice as wide — so the correction has to be measured after the fact
       rather than predicted from the point.  A sprite taller than the band
       keeps its top inside it and overhangs the bottom, because the masthead
       above is solid and the bench below is not. */
    function parkWithin(el, tipFn, point, band) {
      if (!el) return;
      Lab.tools.parkAt(el, tipFn, point);
      var r = el.getBoundingClientRect(), dx = 0, dy = 0;
      if (r.left < band.left) dx = band.left - r.left;
      else if (r.right > band.right) dx = band.right - r.right;
      if (r.bottom > band.bottom) dy = band.bottom - r.bottom;
      if (r.top + dy < band.top) dy = band.top - r.top;
      if (dx || dy) Lab.tools.parkAt(el, tipFn, { x: point.x + dx, y: point.y + dy });
    }

    /* Spend the height left under each column on sliding that column DOWN, so
       that under hand control the bench sits in the middle of the screen
       rather than up under the masthead.  Measured with the slide removed
       first, because the thing being measured is what the slide consumes;
       26px is left at the foot so nothing touches the edge.

       The floor is the bottom of the WINDOW, less whatever the page keeps
       under the bench — not the bottom of the bench itself.  The bench is
       only as tall as its tallest column, so measuring against it hands the
       short columns nothing and leaves a band of clear screen going unused
       underneath; on a 15" laptop that band was 92px, which is most of a
       strip.  Every column is measured before any of them moves, because a
       column that has already slid has stretched the bench under the rest. */
    var MAX_DROP = 280;
    var FOOT = 16;                       // never park anything on the edge
    var COLUMNS = ['.surfaces', '.shelf'];
    var DROP_VAR = { '.surfaces': '--surfaces-drop', '.shelf': '--shelf-drop' };

    function dropShelf(on) {
      var benchEl = document.getElementById('bench');
      if (!benchEl) return;
      var cols = [];
      COLUMNS.forEach(function (sel) {
        var el = document.querySelector(sel);
        if (!el) return;
        el.style.removeProperty(DROP_VAR[sel]);
        cols.push({ el: el, name: DROP_VAR[sel] });
      });
      if (!on) return;

      /* What the page keeps under the bench is the LAB's bottom padding, and
         it has to be read off the lab: <body> carries min-height:100vh, so
         its own bottom is the bottom of the window whatever is in it, and
         measuring against that hands every column a spare of zero. */
      var view = document.documentElement.clientHeight || 0;
      var lab = document.querySelector('.lab') || benchEl;
      var below = Math.max(0, lab.getBoundingClientRect().bottom -
                              benchEl.getBoundingClientRect().bottom);
      var floor = view - below - FOOT;
      cols.forEach(function (c) { c.spare = floor - c.el.getBoundingClientRect().bottom; });
      cols.forEach(function (c) {
        c.el.style.setProperty(c.name,
          Math.round(Math.max(0, Math.min(MAX_DROP, c.spare))) + 'px');
      });
    }

    var reparkTimer;
    window.addEventListener('resize', function () {
      clearTimeout(reparkTimer);
      reparkTimer = setTimeout(function () { parkTools(0); }, 200);
    });

    /* Switching the camera on and off moves the equipment column, so the
       resting places move with it.  handcontrol.js asks for this rather than
       firing a synthetic resize, because a resize is a lie about what
       happened and this is not. */
    Lab.bench = { parkTools: parkTools };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.Lab = window.Lab || {});
