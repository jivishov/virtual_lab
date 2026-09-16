/* =============================================================================
 * pipette.js  —  The draggable micropipette and all of its animations.
 *
 * Owns the pipette DOM element, its interact.js drag behaviour, the disposable
 * tip / liquid column visuals, and the plunger / aspirate / dispense / fly-to
 * animations.  Reports drag movement back to Lab.engine as the tool 'pipette'.
 *
 * The transfer pipet and the marker are the other two hand tools; they live in
 * stations.js and share this module's drag helper so all three behave the same
 * way under the hand.
 *
 * Exposed as  Lab.pipette
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var svgNS = 'http://www.w3.org/2000/svg';
  var cfg = Lab.config;

  var layer = null;      // #tool-layer
  var el = null;         // the pipette <svg>
  var tipmount = null;
  var liquidEl = null;
  var readout = null;
  var plunger = null;
  var ejector = null, handDriven = false, handButton = '', handDepth = -1;
  var homePos = { x: 0, y: 0 };
  var currentFill = null;

  function reduced() { return Lab.theme && Lab.theme.reducedMotion; }

  function reagentPaint(reagent) {
    if (!reagent) return currentFill || defaultPaint();
    if (Lab.theme && Lab.theme.sci) return Lab.theme.sci(reagent, 'fill');
    return (cfg.REAGENTS[reagent] || cfg.REAGENTS.DIL).fill;
  }
  function defaultPaint() {
    return (Lab.theme && Lab.theme.sci) ? Lab.theme.sci('DIL', 'fill') : cfg.REAGENTS.DIL.fill;
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
    el.style.opacity = '0';
    el.style.transition = 'opacity .25s ease';
    tipmount = el.querySelector('#pip-tipmount');
    readout = el.querySelector('#pip-vol-readout');
    plunger = el.querySelector('#pip-plunger');
    ejector = el.querySelector('#pip-ejector');

    Lab.engine.registerTool('pipette', el);
    Lab.tools.drag(el, 'pipette', tipPoint);
    homePos = home || { x: 0, y: 0 };
    setPos(homePos.x, homePos.y);
    return el;
  }

  /* tools.js is the single owner of a tool's position: it keeps it on the
     element (posOf/place) and every drag move advances it by the pointer
     delta.  The pipette must NOT keep a second copy of that — while it did,
     mounting and parking moved the sprite without telling the drag helper, so
     the first drag read a stale {0,0} and the pipette jumped to the corner of
     the bench instead of following the hand.  (It appeared to fix itself after
     a click-to-act, because tools.flyTo happens to assign its own object back
     onto the element, which accidentally re-united the two.) */
  function posRef() { return Lab.tools.posOf(el); }
  function setPos(x, y) { Lab.tools.place(el, x, y); }

  /* ----- tip point (liquid-exit hotspot, in screen coords) -------------- */
  function tipPoint() {
    var ref = el.querySelector('#pip-tip') || el.querySelector('#pip-nozzle');
    var r = ref.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.bottom };
  }

  /* ----- tip + liquid visuals ------------------------------------------- */
  function setTip(has) {
    if (has) {
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
        gsap.to(tipmount.children, { duration: 0.2, y: 40, opacity: 0,
          onComplete: function () { tipmount.innerHTML = ''; } });
      } else { tipmount.innerHTML = ''; }
      liquidEl = null;
    }
    setReadout(0);
  }

  function setLiquid(reagent, volume) {
    var pct = reagent ? Math.max(0, Math.min(1, volume / cfg.VOLUME.tipMax)) : 0;
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
  function handButtons(reading) {
    if (!el || !plunger || !ejector) return;
    var active = !!reading;
    var kind = reading ? reading.kind : '';
    var depth = reading ? Math.max(0, Math.min(1, reading.depth)) : 0;
    if (handDriven === active && handButton === kind && Math.abs(handDepth - depth) < 0.02) return;
    if (active !== handDriven && Lab.env.gsap) gsap.killTweensOf([plunger, ejector]);
    handDriven = active; handButton = kind; handDepth = depth;
    el.classList.toggle('pipette--hand-buttons', active);
    el.setAttribute('data-hand-button', kind);
    plunger.classList.toggle('is-button-selected', active && kind === 'press');
    ejector.classList.toggle('is-button-selected', active && kind === 'eject');
    var py = kind === 'press' ? depth * 12 : 0, ey = kind === 'eject' ? depth * 6 : 0;
    if (Lab.env.gsap) { gsap.set(plunger, { y: py }); gsap.set(ejector, { y: ey }); }
    else { plunger.setAttribute('transform', 'translate(0 ' + py + ')'); ejector.setAttribute('transform', 'translate(0 ' + ey + ')'); }
  }

  function plungerPress(cb) {
    if (handDriven || !Lab.env.gsap) { if (cb) cb(); return; }
    gsap.timeline({ onComplete: cb })
      .to(plunger, { duration: 0.16, y: 12, ease: 'power2.in' })
      .to(plunger, { duration: 0.22, y: 0, ease: 'power2.out' });
  }
  function plungerPulse() {
    if (handDriven || !Lab.env.gsap) return;
    gsap.fromTo(plunger, { y: 0 }, { duration: 0.12, y: 5, yoyo: true, repeat: 1, ease: 'sine.inOut' });
  }

  /* ----- aspirate ------------------------------------------------------- */
  function aspirate(reagent, targetVol, cb) {
    currentFill = reagentPaint(reagent);
    var proxy = { v: Lab.state.S.pipette.volume || 0 };
    var doRise = function () {
      if (!Lab.env.gsap) { setLiquid(reagent, targetVol); if (cb) cb(); return; }
      gsap.to(proxy, {
        v: targetVol, duration: 0.55, ease: 'power1.out',
        onUpdate: function () { setLiquid(reagent, proxy.v); },
        onComplete: function () { if (cb) cb(); }
      });
    };
    if (Lab.env.gsap && !handDriven) {
      gsap.timeline()
        .to(plunger, { duration: 0.18, y: 12, ease: 'power2.in' })
        .add(doRise)
        .to(plunger, { duration: 0.3, y: 0, ease: 'power2.out' }, '-=0.3');
    } else { doRise(); }
  }

  /* ----- dispense (a droplet falls from the tip into a well) ------------ */
  function dispense(targetEl, color) {
    plungerPress();
    Lab.tools.droplet(tipPoint(), targetEl, color || currentFill || defaultPaint());
  }

  /* ----- fly the whole pipette to a point (click-to-act path) ----------- */
  function flyTo(point, cb) { Lab.tools.flyTo(el, posRef(), tipPoint, point, cb); }
  function parkAt(point) { Lab.tools.parkAt(el, tipPoint, point); }

  Lab.pipette = {
    mount: mount,
    tipPoint: tipPoint,
    setTip: setTip,
    setLiquid: setLiquid,
    aspirate: aspirate,
    dispense: dispense,
    plungerPress: plungerPress,
    plungerPulse: plungerPulse,
    handButtons: handButtons,
    flyTo: flyTo,
    parkAt: parkAt,
    el: function () { return el; },
    pos: function () { return posRef(); }
  };
})(window.Lab = window.Lab || {});
