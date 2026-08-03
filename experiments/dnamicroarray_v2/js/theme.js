/* =============================================================================
 * theme.js — the three student-selectable themes, and colour resolution.
 *
 * Loaded BLOCKING in <head>, before every other script, so [data-theme] is on
 * <html> before first paint (no flash of the wrong bench).  That means it must
 * not touch Lab.config, Lab.env or document.body at load time — Lab.config is
 * resolved lazily inside sci().
 *
 * Two jobs:
 *   1. Own [data-theme] / [data-mode] on <html>, plus persistence.
 *   2. Resolve a token to a CONCRETE colour string, because GSAP cannot tween
 *      to a `var(--x)` string.  Tokens are authored in oklch, so a custom
 *      property read returns the literal text `oklch(…)`; we resolve it via a
 *      probe element and normalise through a canvas.
 *
 * Exposed as  Lab.theme
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var THEMES = [
    { id: 'notebook',   label: 'Notebook',   hint: 'Warm paper and ink' },
    { id: 'laboratory', label: 'Laboratory', hint: 'Bright bench, faded glassware' },
    { id: 'instrument', label: 'Night Bench', hint: 'Dark instrument console' }
  ];
  var VALID = { notebook: 1, laboratory: 1, instrument: 1, auto: 1 };
  // 'cleanroom' was renamed to 'laboratory'.  Anything already saved in
  // localStorage — or a ?theme=cleanroom link a teacher has bookmarked —
  // still resolves, so the rename is invisible to existing users.
  var ALIAS = { cleanroom: 'laboratory' };
  function canon(v) { return (v && ALIAS[v]) || v; }
  var KEY = 'lab.theme';

  var stored = null;      // 'auto' | theme id — what the student chose
  var memFallback = null; // used when localStorage is unavailable
  var listeners = [];
  var darkMq = null;

  /* ----- persistence (must tolerate file://) ------------------------------
     A blocked localStorage throws on PROPERTY ACCESS, so `typeof localStorage`
     is not a valid probe — everything goes inside try/catch. */
  function loadPref() {
    var m = /[?#&]theme=([a-z]+)/.exec(location.href);   // teacher / kiosk override
    if (m && VALID[canon(m[1])]) return canon(m[1]);
    try {
      var v = canon(localStorage.getItem(KEY));
      if (v && VALID[v]) return v;
    } catch (e) { /* blocked — fall through */ }
    return memFallback || 'auto';
  }
  function savePref(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { memFallback = v; }
  }

  function prefersDark() {
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches; }
    catch (e) { return false; }
  }
  function resolve(pref) {
    pref = canon(pref);
    if (pref === 'auto' || !pref) return prefersDark() ? 'instrument' : 'notebook';
    return VALID[pref] ? pref : 'notebook';
  }

  /* ----- colour resolution ------------------------------------------------ */
  var cache = Object.create(null);
  var probe = null, ctx = null;

  function host() {
    // Prefer <body>: it inherits every :root token AND would pick up any
    // body-level override.  Falls back to <html> during head execution.
    return document.body || document.documentElement;
  }

  function normalise(css) {
    // Canvas normalises any CSS colour (oklch, color(srgb …), rgb, named)
    // to '#rrggbb', or 'rgba(r, g, b, a)' when translucent.
    if (!ctx) {
      try { ctx = document.createElement('canvas').getContext('2d'); }
      catch (e) { return css; }
    }
    if (!ctx) return css;
    ctx.fillStyle = '#000';
    try { ctx.fillStyle = css; } catch (e) { return css; }
    return ctx.fillStyle;
  }

  /**
   * Resolve a design token to a concrete colour string GSAP can tween.
   * @param {string} tok  e.g. '--mat-led-ok'
   * @param {string} [fb] fallback if the token is missing
   */
  function color(tok, fb) {
    if (tok in cache) return cache[tok];
    var raw = '';
    try { raw = getComputedStyle(host()).getPropertyValue(tok).trim(); } catch (e) {}

    var out;
    if (/^#[0-9a-f]{3,8}$/i.test(raw)) {
      out = raw;                                   // fast path: literal hex
    } else {
      // Custom properties are not computed to colours, so oklch(…) arrives as
      // literal text.  Let the engine resolve it on a real element.
      if (!probe) {
        probe = document.createElement('span');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;pointer-events:none';
        (document.body || document.documentElement).appendChild(probe);
      }
      probe.style.color = '';
      probe.style.color = 'var(' + tok + (fb ? ',' + fb : '') + ')';
      var computed = '';
      try { computed = getComputedStyle(probe).color; } catch (e) {}
      out = normalise(computed || fb || '#ff00ff');
    }
    cache[tok] = out;
    return out;
  }

  /** Numeric token read (the --sci-*-delta values). */
  function num(tok, dflt) {
    var v = '';
    try { v = getComputedStyle(host()).getPropertyValue(tok).trim(); } catch (e) {}
    var n = parseFloat(v);
    return isNaN(n) ? (dflt || 0) : n;
  }

  /* ----- science colours: hue-locked by construction ----------------------
     config.js is the single source of truth for the science, so we never
     redefine these in CSS — we read the canonical hex and apply per-theme
     SATURATION/LIGHTNESS deltas only.  Hue is never an input, so it cannot
     drift no matter what a theme does. */
  function rgbToHsl(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return null;
    var r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    var h = 0, s = 0, l = (mx + mn) / 2;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r)      h = ((g - b) / d + (g < b ? 6 : 0));
      else if (mx === g) h = ((b - r) / d + 2);
      else               h = ((r - g) / d + 4);
      h *= 60;
    }
    return { h: h, s: s * 100, l: l * 100 };
  }
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    h = ((h % 360) + 360) % 360;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2, r = 0, g = 0, b = 0;
    if      (h < 60)  { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else              { r = c; b = x; }
    function hx(v) {
      var n = Math.round((v + m) * 255);
      n = n < 0 ? 0 : n > 255 ? 255 : n;
      return (n < 16 ? '0' : '') + n.toString(16);
    }
    return '#' + hx(r) + hx(g) + hx(b);
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  var sciCache = Object.create(null);

  /**
   * Theme-tuned science colour, hue preserved exactly.
   * @param {string} name  a SPOT_COLORS key ('red'|'green'|'yellow'|'black')
   *                       or a REAGENTS key ('EB'|'cDNA'|'HB'|'MIX')
   * @param {string} [variant] 'base'|'glow' for SPOT_COLORS; 'fill'|'dark' for reagents
   */
  function sci(name, variant) {
    var k = name + ':' + (variant || '');
    if (k in sciCache) return sciCache[k];
    var cfg = Lab.config;                       // resolved lazily — see header
    if (!cfg) return '#ff00ff';
    var src;
    if (cfg.SPOT_COLORS[name])   src = cfg.SPOT_COLORS[name][variant || 'base'];
    else if (cfg.REAGENTS[name]) src = cfg.REAGENTS[name][variant || 'fill'];
    if (!src) return '#ff00ff';

    var hsl = rgbToHsl(src);
    if (!hsl) return src;
    var out = hslToHex(
      hsl.h,                                              // never modified
      saturate(hsl.s, num('--sci-s-delta', 0)),
      clamp(hsl.l + num('--sci-l-delta', 0), 8, 94)
    );
    sciCache[k] = out;
    return out;
  }

  /* An ACHROMATIC source must stay achromatic.  The 'black' answer-key colour
     is #1a1a1a — hue 0, saturation 0 — so applying the minimum-saturation
     floor would drag it toward red and paint every Blank spot brown. */
  function saturate(s, delta) {
    if (s < 4) return s;
    return clamp(s + delta, 20, 100);
  }

  /** A darker same-hue rim, so a swatch keeps a ≥3:1 boundary (WCAG 1.4.11). */
  function sciRing(name, variant) {
    var cfg = Lab.config;
    if (!cfg) return '#ff00ff';
    var base = sci(name, variant);
    var hsl = rgbToHsl(base);
    if (!hsl) return base;
    return hslToHex(hsl.h, hsl.s, clamp(hsl.l + num('--sci-ring-l-delta', -35), 4, 90));
  }

  function invalidate() {
    cache = Object.create(null);
    sciCache = Object.create(null);
  }

  /* ----- apply ------------------------------------------------------------ */
  function apply(id) {
    document.documentElement.setAttribute('data-theme', id);
    invalidate();
  }

  function set(pref) {
    pref = canon(pref);
    if (!VALID[pref]) return;
    stored = pref;
    savePref(pref);
    apply(resolve(pref));
    notify();
  }

  /** Darkroom is a MODE layered on whichever theme is active. */
  function setMode(on) {
    if (on) document.documentElement.setAttribute('data-mode', 'darkroom');
    else    document.documentElement.removeAttribute('data-mode');
    invalidate();
    notify();
  }

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (e) { console.error('theme listener', e); }
    }
  }
  function onChange(fn) { listeners.push(fn); }

  /* ----- boot (runs in <head>) -------------------------------------------- */
  stored = loadPref();
  apply(resolve(stored));

  try {
    darkMq = window.matchMedia('(prefers-color-scheme: dark)');
    var followSystem = function () {
      if (stored === 'auto') { apply(resolve('auto')); notify(); }
    };
    if (darkMq.addEventListener) darkMq.addEventListener('change', followSystem);
    else if (darkMq.addListener) darkMq.addListener(followSystem);
  } catch (e) {}

  var reducedMotion = false;
  try {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  Lab.theme = {
    THEMES: THEMES,
    get: function () { return stored; },
    active: function () { return resolve(stored); },
    set: set,
    setMode: setMode,
    color: color,
    num: num,
    sci: sci,
    sciRing: sciRing,
    invalidate: invalidate,
    onChange: onChange,
    reducedMotion: reducedMotion
  };
})(window.Lab = window.Lab || {});
