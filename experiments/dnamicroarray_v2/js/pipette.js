/* =============================================================================
 * pipette.js  —  The draggable micropipette + all of its animations.
 *
 * Owns the pipette DOM element, its interact.js drag behaviour, the disposable
 * tip / liquid column visuals, and the plunger / aspirate / dispense / fly-to
 * animations (via GSAP).  Reports drag movement back to Lab.engine.
 *
 * Exposed as  Lab.pipette
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var svgNS = 'http://www.w3.org/2000/svg';
  var cfg = Lab.config;

  var layer = null;      // #pipette-layer
  var el = null;         // the pipette <svg>
  var tipmount = null;   // #pip-tipmount
  var liquidEl = null;   // #pip-liquid (created with the tip)
  var readout = null;    // volume text
  var plunger = null;
  var pos = { x: 0, y: 0 };
  var homePos = { x: 0, y: 0 };
  // No literal default here: it used to hard-code #4fc3f7, a silent duplicate
  // of config.REAGENTS.EB.fill.  Resolved lazily so config.js owns it.
  var currentFill = null;

  function reduced() { return Lab.theme && Lab.theme.reducedMotion; }

  function reagentPaint(reagent) {
    if (!reagent) return currentFill || defaultPaint();
    if (Lab.theme && Lab.theme.sci) return Lab.theme.sci(reagent, 'fill');
    return cfg.REAGENTS[reagent].fill;
  }
  function defaultPaint() {
    return (Lab.theme && Lab.theme.sci) ? Lab.theme.sci('EB', 'fill') : cfg.REAGENTS.EB.fill;
  }

  /* ----- geometry of the liquid inside the tip cone --------------------- */
  function liquidPoints(pct) {
    var topY = 71 - Math.max(0, Math.min(1, pct)) * 60;   // 71 (bottom) .. 11 (full)
    var half = 9 - 6.6 * (topY / 74);
    return (-half) + ',' + topY + ' ' + half + ',' + topY + ' 2.2,71 -2.2,71';
  }

  /* ----- mount ---------------------------------------------------------- */
  function mount(layerEl, home) {
    layer = layerEl;
    layer.insertAdjacentHTML('beforeend', Lab.assets.pipette());
    el = layer.querySelector('#pipette-svg');
    el.style.opacity = '0';                 // hidden until parked over the equipment
    el.style.transition = 'opacity .25s ease';
    tipmount = el.querySelector('#pip-tipmount');
    readout = el.querySelector('#pip-vol-readout');
    plunger = el.querySelector('#pip-plunger');

    homePos = home || { x: 0, y: 0 };
    setPos(homePos.x, homePos.y);
    Lab.engine.setPipetteEl(el);
    setupDrag();
    return el;
  }

  function setPos(x, y) {
    pos.x = x; pos.y = y;
    el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }

  /* ----- tip point (liquid-exit hotspot, in screen coords) -------------- */
  function tipPoint() {
    var ref = el.querySelector('#pip-tip') || el.querySelector('#pip-nozzle');
    var r = ref.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.bottom };
  }

  /* ----- tip + liquid visuals ------------------------------------------- */
  function setTip(has) {
    if (has) {
      // colour lives in style.css (.m-tip-poly / #pip-liquid); the liquid
      // colour arrives as a custom property so a theme switch repaints it
      tipmount.innerHTML =
        '<polygon id="pip-tip" class="m-tip-poly" points="-9,0 9,0 2.4,74 -2.4,74" ' +
          'fill-opacity="0.5" stroke-width="0.8"/>' +
        '<polygon id="pip-liquid" points="' + liquidPoints(0) + '" fill-opacity="0"/>';
      liquidEl = tipmount.querySelector('#pip-liquid');
      if (Lab.env.gsap && !reduced()) {
        gsap.from('#pip-tip', { duration: 0.28, scaleY: 0.2, transformOrigin: '50% 0%', ease: 'expo.out' });
      }
    } else {
      if (Lab.env.gsap && tipmount.firstChild) {
        gsap.to(tipmount.children, { duration: 0.2, y: 40, opacity: 0, onComplete: function () { tipmount.innerHTML = ''; } });
      } else { tipmount.innerHTML = ''; }
      liquidEl = null;
    }
    setReadout(0);
  }

  function setLiquid(reagent, volume) {
    var pct = reagent ? Math.max(0, Math.min(1, volume / cfg.VOLUME.max)) : 0;
    if (reagent) currentFill = reagentPaint(reagent);
    if (!currentFill) currentFill = defaultPaint();
    if (liquidEl) {
      liquidEl.setAttribute('points', liquidPoints(pct));
      liquidEl.style.setProperty('--pip-paint', currentFill);
      liquidEl.setAttribute('fill-opacity', reagent ? '0.92' : '0');
    }
    setReadout(reagent ? volume : 0);
  }

  function setReadout(v) { if (readout) readout.textContent = Math.round(v) + 'µL'; }

  /* ----- plunger animations --------------------------------------------- */
  function plungerPress(cb) {
    if (!Lab.env.gsap) { if (cb) cb(); return; }
    gsap.timeline({ onComplete: cb })
      .to(plunger, { duration: 0.16, y: 12, ease: 'power2.in' })
      .to(plunger, { duration: 0.22, y: 0, ease: 'power2.out' });
  }
  function plungerPulse() {
    if (!Lab.env.gsap) return;
    gsap.fromTo(plunger, { y: 0 }, { duration: 0.12, y: 5, yoyo: true, repeat: 1, ease: 'sine.inOut' });
  }

  /* ----- aspirate ------------------------------------------------------- */
  // Fly nothing; assume tip is already at the tube. Animate plunger + rising
  // liquid + the tube level dropping, then callback.
  function aspirate(stationEl, reagent, targetVol, cb) {
    currentFill = reagentPaint(reagent);
    var proxy = { v: 0 };
    var doRise = function () {
      if (!Lab.env.gsap) { setLiquid(reagent, targetVol); if (cb) cb(); return; }
      gsap.to(proxy, {
        v: targetVol, duration: 0.6, ease: 'power1.out',
        onUpdate: function () { setLiquid(reagent, proxy.v); },
        onComplete: function () { if (cb) cb(); }
      });
      // The tube level is owned by stations.updateTubeLevels(), which derives
      // it from how many doses have actually been used.  It must NOT be nudged
      // by a fixed offset here: that drained the visible column after ~13
      // aspirations when the run needs 36.
    };
    if (Lab.env.gsap) {
      gsap.timeline()
        .to(plunger, { duration: 0.18, y: 12, ease: 'power2.in' })
        .add(doRise)
        .to(plunger, { duration: 0.3, y: 0, ease: 'power2.out' }, '-=0.3');
    } else { doRise(); }
  }

  /* ----- dispense (droplet falls from the tip onto a target) ------------ */
  function dispense(targetEl, color) {
    plungerPress();
    var from = tipPoint();
    var to = centerOf(targetEl);
    spawnDroplet(from, to, color);
  }

  function spawnDroplet(from, to, color) {
    var host = layer.getBoundingClientRect();
    var drop = document.createElementNS(svgNS, 'svg');
    drop.setAttribute('class', 'droplet');
    drop.setAttribute('width', '16'); drop.setAttribute('height', '20');
    drop.innerHTML = '<path d="M8 1 C8 1 15 11 15 15 A7 7 0 1 1 1 15 C1 11 8 1 8 1 Z" fill="' +
                     (color || currentFill || defaultPaint()) + '" class="m-line" stroke-width="0.5"/>' +
                     '<ellipse class="m-sheen" cx="5.5" cy="12" rx="2" ry="3.2" opacity=".4"/>';
    drop.style.position = 'absolute';
    drop.style.left = (from.x - host.left - 8) + 'px';
    drop.style.top = (from.y - host.top - 4) + 'px';
    drop.style.pointerEvents = 'none';
    layer.appendChild(drop);
    if (!Lab.env.gsap) { layer.removeChild(drop); return; }
    gsap.timeline({ onComplete: function () { if (layer.contains(drop)) layer.removeChild(drop); } })
      .to(drop, { duration: 0.34, top: (to.y - host.top - 6) + 'px', left: (to.x - host.left - 8) + 'px', ease: 'power2.in' })
      .to(drop, { duration: 0.16, scaleX: 1.7, scaleY: 0.35, opacity: 0, transformOrigin: '50% 100%', ease: 'power1.out' });
  }

  /* ----- fly the whole pipette to a point (click-to-act path) ----------- */
  function flyTo(point, cb) {
    var t = tipPoint();
    var nx = pos.x + (point.x - t.x);
    var ny = pos.y + (point.y - t.y);
    if (!Lab.env.gsap) { setPos(nx, ny); if (cb) cb(); return; }
    gsap.to(pos, {
      x: nx, y: ny, duration: 0.45, ease: 'power2.inOut',
      onUpdate: function () { el.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)'; },
      onComplete: function () { if (cb) cb(); }
    });
  }

  function toHome() { flyTo(screenOf(homePos), null); }

  // Instantly place the pipette so its tip sits at a screen point (used to
  // rest it hovering over the equipment once the layout has settled).
  function parkAt(point) {
    var t = tipPoint();
    setPos(pos.x + (point.x - t.x), pos.y + (point.y - t.y));
  }

  /* ----- interact.js drag ----------------------------------------------- */
  function setupDrag() {
    if (!Lab.env.interact) { console.warn('interact.js missing — drag disabled'); return; }
    interact(el).draggable({
      inertia: false,
      autoScroll: false,
      listeners: {
        start: function () { el.classList.add('grabbing'); document.body.classList.add('pipette-active'); },
        move: function (event) {
          setPos(pos.x + event.dx, pos.y + event.dy);
          Lab.engine.hoverAt(tipPoint());
        },
        end: function () {
          el.classList.remove('grabbing');
          document.body.classList.remove('pipette-active');
          Lab.engine.releaseAt(tipPoint());
          Lab.engine.clearHighlight();
        }
      },
      modifiers: [
        // Constrain only the TIP (bottom-centre of the tall pipette) to the
        // bench, so the body can float above the top edge and the tip can
        // still reach the very first row of spots.
        interact.modifiers.restrictRect({ restriction: layer, elementRect: { top: 0.85, left: 0.4, bottom: 1, right: 0.6 } })
      ]
    });
  }

  /* ----- helpers -------------------------------------------------------- */
  function centerOf(node) {
    var r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function screenOf() { return tipPoint(); } // placeholder; home handled by layout

  Lab.pipette = {
    mount: mount,
    tipPoint: tipPoint,
    setTip: setTip,
    setLiquid: setLiquid,
    aspirate: aspirate,
    dispense: dispense,
    plungerPress: plungerPress,
    plungerPulse: plungerPulse,
    flyTo: flyTo,
    toHome: toHome,
    parkAt: parkAt,
    el: function () { return el; }
  };
})(window.Lab = window.Lab || {});
