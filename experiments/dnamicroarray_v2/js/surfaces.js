/* =============================================================================
 * surfaces.js  —  The microarray card and QuickStrip plate.
 *
 * Injects both work surfaces, exposes small visual mutators the engine calls
 * (coat a spot, puncture / fill / mix a well, reveal fluorescence), and wires
 * click + keyboard activation as an accessible alternative to dragging.
 *
 * PAINTING RULE: every runtime colour is written as a CUSTOM PROPERTY on the
 * group (--spot-paint / --well-paint), consumed by a rule in style.css.  Never
 * setAttribute('fill') and never an inline style="fill:…" — the darkroom rules
 * must be able to override these, and an inline fill would outrank them, which
 * would silently break the UV reveal.
 *
 * Exposed as  Lab.surfaces
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var cfg = Lab.config;
  var cardWrap = null, plateWrap = null, cardSvg = null, plateSvg = null;

  // which reagent paints a spot at each stage of the protocol
  var KIND_REAGENT = { eb: 'EB', sample: 'MIX', hb: 'HB' };

  function paint(name, variant, fallback) {
    if (Lab.theme && Lab.theme.sci) return Lab.theme.sci(name, variant);
    return fallback;
  }

  function build(cardHost, plateHost) {
    cardHost.innerHTML = Lab.assets.microarrayCard();
    plateHost.innerHTML = Lab.assets.quickstripPlate();
    cardWrap = cardHost; plateWrap = plateHost;
    cardSvg = cardHost.querySelector('#card-svg');
    plateSvg = plateHost.querySelector('#plate-svg');
    wireActivation(cardHost, '[data-spot]');
    wireActivation(plateHost, '[data-well]');
  }

  // click + Enter/Space on any spot or well routes to the engine.
  function wireActivation(host, sel) {
    host.addEventListener('click', function (e) {
      var node = e.target.closest(sel);
      if (node) Lab.engine.clickAct(node);
    });
    host.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var node = e.target.closest(sel);
      if (node) { e.preventDefault(); Lab.engine.clickAct(node); }
    });
  }

  /* ----- spot visuals --------------------------------------------------- */
  function spot(id) { return cardSvg && cardSvg.querySelector('[data-spot="' + id + '"]'); }

  function coatSpot(id, kind, color) {
    var g = spot(id); if (!g) return;
    var fill = g.querySelector('.spot-fill');
    g.classList.add('coated', 'coat-' + kind);
    var reagent = KIND_REAGENT[kind];
    g.style.setProperty('--spot-paint', reagent ? paint(reagent, 'fill', color) : color);
    animateOpacity(fill, 0.85);
    pop(g);
  }

  // Under UV: show the true result colour with a soft fluorescent glow.
  function revealSpot(id) {
    var g = spot(id); if (!g) return;
    var st = Lab.state.S.spots[id];
    var name = cfg.SPOT_COLORS[st.color] ? st.color : 'black';
    var fill = g.querySelector('.spot-fill');
    g.classList.add('revealed');
    g.style.setProperty('--spot-paint', paint(name, 'glow', cfg.SPOT_COLORS[name].glow));
    animateOpacity(fill, 1);
    setGlyph(g, name);
    st.revealed = true;
  }

  // Opt-in colour-vision assist: the legend symbol drawn onto the spot itself.
  // Redundant encoding, so the default reading task is unchanged.
  function setGlyph(g, colorName) {
    var t = g.querySelector('.spot-glyph');
    if (!t) return;
    var L = cfg.LEGEND[colorName];
    t.textContent = L ? L.symbol : '';
  }

  /* ----- well visuals --------------------------------------------------- */
  function well(id) { return plateSvg && plateSvg.querySelector('[data-well="' + id + '"]'); }

  function punctureWell(id) {
    var g = well(id); if (!g) return;
    g.classList.add('punctured');
    var foil = g.querySelector('.well-foil');
    var x = g.querySelector('.well-foil-x');
    if (Lab.env.gsap) {
      gsap.to(foil, { duration: 0.3, opacity: 0.15, scale: 0.82, transformOrigin: '50% 50%' });
      gsap.to(x, { duration: 0.2, opacity: 0.7 });
    } else { foil.setAttribute('opacity', '0.15'); }
  }

  function fillWell(id, color, opacity) {
    var g = well(id); if (!g) return;
    var liq = g.querySelector('.well-liquid');
    g.style.setProperty('--well-paint', color);
    animateOpacity(liq, opacity);
  }

  function mixWell(id, progress) {
    var g = well(id); if (!g) return;
    var liq = g.querySelector('.well-liquid');
    // colour lerps cDNA green -> mixed orange as the swirl progresses.  BOTH
    // endpoints come from the theme-tuned science palette, otherwise the swirl
    // would finish on an untuned orange that no longer matches the MIX tube.
    var from = paint('cDNA', 'fill', cfg.REAGENTS.cDNA.fill);
    var to   = paint('MIX',  'fill', cfg.REAGENTS.MIX.fill);
    g.style.setProperty('--well-paint', lerpColor(from, to, progress));
    animateOpacity(liq, 0.55 + progress * 0.35);
    g.classList.add('mixing');
    if (Lab.env.gsap && !reduced()) {
      gsap.fromTo(liq, { rotation: -4 }, { rotation: 4, duration: 0.18, transformOrigin: '50% 50%', yoyo: true, repeat: 1 });
    }
  }

  /* ----- helpers -------------------------------------------------------- */
  function reduced() { return Lab.theme && Lab.theme.reducedMotion; }

  function animateOpacity(node, to) {
    // fill-opacity is animated as an ATTRIBUTE, which is a different property
    // from the fill the stylesheet owns — the two do not collide.
    if (Lab.env.gsap && !reduced()) gsap.to(node, { duration: 0.3, attr: { 'fill-opacity': to } });
    else node.setAttribute('fill-opacity', to);
  }
  function pop(g) {
    if (!Lab.env.gsap || reduced()) return;
    // exponential deceleration — real objects settle, they do not bounce
    gsap.fromTo(g, { scale: 0.92 }, { scale: 1, duration: 0.34, transformOrigin: '50% 50%', ease: 'expo.out' });
  }
  function lerpColor(a, b, t) {
    var ca = hex(a), cb = hex(b);
    if (!ca || !cb) return b;
    var r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
    var g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
    var bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }
  function hex(h) {
    if (typeof h !== 'string') return null;
    var m = /^#([0-9a-f]{6})$/i.exec(h.trim());
    if (m) {
      return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    }
    var rgb = /^rgba?\(([^)]+)\)/.exec(h.trim());
    if (rgb) {
      var p = rgb[1].split(/[\s,\/]+/);
      return [parseInt(p[0], 10), parseInt(p[1], 10), parseInt(p[2], 10)];
    }
    return null;
  }

  Lab.surfaces = {
    build: build,
    coatSpot: coatSpot,
    revealSpot: revealSpot,
    punctureWell: punctureWell,
    fillWell: fillWell,
    mixWell: mixWell,
    cardEl: function () { return cardWrap; },
    cardSvg: function () { return cardSvg; },
    plateSvg: function () { return plateSvg; }
  };
})(window.Lab = window.Lab || {});
