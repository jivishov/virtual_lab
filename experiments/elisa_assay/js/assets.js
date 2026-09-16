/* =============================================================================
 * assets.js  —  Rich, self-contained SVG artwork for every object on the
 * ELISA bench.  Each builder returns an SVG markup string and is pure (no DOM,
 * no state), so they are trivial to re-skin and to test.
 *
 * The micropipette, the tip box, the waste bin and the screw-cap reagent tube
 * are carried over from the DNA Microarray bench — same kit, same drawer — and
 * everything else is drawn from the Experiment #468 protocol figures.
 *
 * THEMING CONTRACT — read before adding artwork here:
 *
 *   1. No colour literals.  Emit structure + a class; the colour lives in
 *      style.css against that class.  `var()` inside a presentation ATTRIBUTE
 *      works only in Chromium, so we do not rely on it.
 *
 *   2. Anything painted at RUNTIME carries a custom property on the element
 *      (--well-paint, --pip-paint, --tube-paint, --cap-paint) which a CSS rule
 *      consumes.  Never write an inline style="fill:…" on those: an inline
 *      style outranks the light-box rules in style.css, and the Module 2 read
 *      would silently stop working.
 *
 *   3. Anything GSAP animates with attr:{fill} (the timer LED) must have NO
 *      CSS fill rule at all, because a stylesheet rule beats a presentation
 *      attribute.  Those are painted from Lab.theme at build time and on
 *      repaint — see stations.js.
 *
 * Exposed as  Lab.assets
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var cfg = Lab.config;

  /* =======================================================================
   *  The 12-well strip tube  —  the hero object of this experiment
   *
   *  Drawn in SIDE ELEVATION, not from above, and that is a deliberate
   *  choice: half of this protocol is about VOLUME (50 µL vs 100 µL, filling
   *  a well with wash buffer without overflowing it, inverting the strip to
   *  empty it).  None of that is visible from the top.  From the side the
   *  liquid column reads as a quantity, and the developed colour reads as a
   *  depth of colour — which is how a technician actually reads a strip.
   * ===================================================================== */
  var STRIP = {
    padL: 46,        // centre of well 1
    pitch: 56,
    railTop: 18, railBot: 34,
    top: 34,         // where the moulded well starts
    bottom: 127,     // inside of the rounded bottom
    halfTop: 22,
    halfBot: 11,
    numY: 13,
    capY: 147
  };
  STRIP.w = STRIP.padL * 2 + 11 * STRIP.pitch;
  STRIP.h = 156;

  /* The interior of one well as a path, used for both the moulding and the
     clip that the liquid column is drawn inside. */
  function wellPath(inset) {
    var i = inset || 0;
    var ht = STRIP.halfTop - i, hb = STRIP.halfBot - i;
    var t = STRIP.top + i, b = STRIP.bottom - i;
    return 'M' + (-ht) + ',' + t +
           ' L' + (-hb) + ',' + (b - 13) +
           ' Q' + (-hb) + ',' + b + ' 0,' + b +
           ' Q' + hb + ',' + b + ' ' + hb + ',' + (b - 13) +
           ' L' + ht + ',' + t + ' Z';
  }

  /* Volume → the height of the liquid column.
     A well is a truncated cone, so height is not linear in volume; the
     exponent below is the cheap stand-in for integrating the cone, and it is
     tuned so the three volumes that matter are visibly different: 50 µL sits
     low in the taper, 100 µL is obviously double, and a well filled with wash
     buffer comes up near the rim without touching it. */
  function liquidTop(vol) {
    var frac = Math.max(0, Math.min(1, vol / cfg.VOLUME.wellMax));
    var span = STRIP.bottom - STRIP.top - 2;
    return STRIP.bottom - span * Math.pow(frac, 0.62);
  }

  function stripTube(strip) {
    var uid = 'strip-' + strip.id;
    var s = '' +
    '<svg id="' + uid + '-svg" class="strip-svg" data-strip="' + strip.id + '" ' +
        'viewBox="0 0 ' + STRIP.w + ' ' + STRIP.h + '" preserveAspectRatio="xMidYMid meet" ' +
        'xmlns="http://www.w3.org/2000/svg" role="group" ' +
        'aria-label="12-well strip tube, wells ' + strip.label + '">' +
      '<defs>' +
        '<linearGradient id="' + uid + '-poly" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" class="g-plastic-1"/>' +
          '<stop offset=".45" class="g-plastic-0"/>' +
          '<stop offset="1" class="g-plastic-2"/>' +
        '</linearGradient>' +
        '<linearGradient id="' + uid + '-rail" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" class="g-plastic-1"/>' +
          '<stop offset="1" class="g-plastic-3"/>' +
        '</linearGradient>' +
        /* ONE clip for all twelve wells, and deliberately untranslated.
           A userSpaceOnUse clipPath resolves in the coordinate system of the
           element that references it, and that element already sits inside
           its well group's translate — so a clip path carrying its own
           translate(cx,0) would be offset twice and land beside the well
           instead of on it. */
        '<clipPath id="' + uid + '-clip"><path d="' + wellPath(1.5) + '"/></clipPath>';
    s += '</defs>';

    /* the moulded top rail the twelve wells hang from */
    s += '<rect class="m-line" x="' + (STRIP.padL - STRIP.halfTop - 8) + '" y="' + STRIP.railTop +
         '" width="' + (11 * STRIP.pitch + 2 * STRIP.halfTop + 16) + '" height="' +
         (STRIP.railBot - STRIP.railTop) + '" rx="3" fill="url(#' + uid + '-rail)" stroke-width="1"/>' +
         '<rect class="m-sheen" x="' + (STRIP.padL - STRIP.halfTop - 4) + '" y="' + (STRIP.railTop + 2) +
         '" width="' + (11 * STRIP.pitch + 2 * STRIP.halfTop + 8) + '" height="3" rx="1.5" opacity=".5"/>';

    /* the wells themselves */
    for (var n = strip.first; n <= strip.last; n++) {
      var x = STRIP.padL + (n - strip.first) * STRIP.pitch;
      s += wellGroup(uid, strip, n, x);
    }

    /* the number the student writes on the strip in step 1.  It is hidden
       until the marker has been across the strip, which is the whole reason
       step 1 exists: an unlabelled strip is an unreadable strip. */
    for (var k = strip.first; k <= strip.last; k++) {
      var nx = STRIP.padL + (k - strip.first) * STRIP.pitch;
      s += '<text class="strip-num" x="' + nx + '" y="' + STRIP.numY + '" text-anchor="middle" ' +
           'font-size="12">' + k + '</text>';
    }
    s += '</svg>';
    return s;
  }

  function wellGroup(uid, strip, n, x) {
    return '<g class="well" data-well="' + n + '" data-strip="' + strip.id + '" ' +
        'transform="translate(' + x + ',0)" role="button" tabindex="0" ' +
        'aria-label="Well ' + n + '">' +
      /* the moulding, drawn twice: a solid body, then the glassy face over
         the liquid so the column looks like it is inside the plastic */
      '<path class="well-body" d="' + wellPath(0) + '" fill="url(#' + uid + '-poly)" ' +
        'stroke-width="1.1"/>' +
      '<g clip-path="url(#' + uid + '-clip)">' +
        '<rect class="well-liquid" x="-24" y="' + STRIP.bottom + '" width="48" height="0" ' +
          'fill-opacity="0"/>' +
        '<ellipse class="well-meniscus" cx="0" cy="' + STRIP.bottom + '" rx="0" ry="2.4" ' +
          'fill-opacity="0"/>' +
        '<line class="well-level" x1="0" y1="' + STRIP.bottom + '" x2="0" y2="' +
          STRIP.bottom + '" opacity="0"/>' +
      '</g>' +
      '<path class="well-face" d="' + wellPath(0) + '" stroke-width="1.1"/>' +
      '<path class="well-sheen" d="M' + (-STRIP.halfTop + 5) + ',' + (STRIP.top + 4) +
        ' L' + (-STRIP.halfBot + 1) + ',' + (STRIP.bottom - 16) + ' l3,0 L' +
        (-STRIP.halfTop + 10) + ',' + (STRIP.top + 4) + ' Z" opacity=".55"/>' +
      /* guidance ring — the drawn affordance, matched to the reference bench */
      '<rect class="well-ring" x="' + (-STRIP.halfTop - 3) + '" y="' + (STRIP.top - 3) +
        '" width="' + (2 * STRIP.halfTop + 6) + '" height="' + (STRIP.bottom - STRIP.top + 8) +
        '" rx="7" fill="none" stroke-width="0" opacity="0"/>' +
      /* the overflow a careless wash produces — see engine.overfill */
      '<path class="well-spill" d="M' + (-STRIP.halfTop) + ',' + (STRIP.top + 1) +
        ' q' + STRIP.halfTop + ',-9 ' + (2 * STRIP.halfTop) + ',0 l0,4 q-' + STRIP.halfTop +
        ',7 -' + (2 * STRIP.halfTop) + ',0 Z" opacity="0"/>' +
    '</g>';
  }

  /* =======================================================================
   *  Micropipette  —  carried over from the microarray bench.
   *  viewBox 0 0 96 320, pointing straight down, tip hotspot at (48, 316).
   * ===================================================================== */
  function pipette() {
    return '' +
    '<svg id="pipette-svg" class="pipette" viewBox="0 0 96 320" width="96" height="320" ' +
        'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Adjustable-volume micropipette">' +
      '<defs>' +
        '<linearGradient id="pip-body" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" class="g-plastic-0"/><stop offset=".28" class="g-plastic-1"/>' +
          '<stop offset=".55" class="g-plastic-2"/><stop offset="1" class="g-plastic-3"/>' +
        '</linearGradient>' +
        '<linearGradient id="pip-grip" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" class="g-grip-0"/><stop offset=".5" class="g-grip-1"/>' +
          '<stop offset="1" class="g-grip-2"/>' +
        '</linearGradient>' +
        '<linearGradient id="pip-plunger-g" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" class="g-steel-2"/><stop offset=".5" class="g-steel-0"/>' +
          '<stop offset="1" class="g-steel-2"/>' +
        '</linearGradient>' +
        '<linearGradient id="pip-shaft" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" class="g-steel-0"/><stop offset=".5" class="g-steel-1"/>' +
          '<stop offset="1" class="g-steel-2"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<g>' +
        '<g id="pip-plunger">' +
          '<rect x="40" y="2" width="16" height="30" rx="5" fill="url(#pip-plunger-g)" class="m-line" stroke-width="1"/>' +
          '<rect x="43" y="6" width="10" height="5" rx="2.5" class="m-plastic-hi" opacity=".7"/>' +
        '</g>' +
        '<rect x="44" y="30" width="8" height="20" class="m-steel-dk"/>' +
        '<g id="pip-ejector"><rect x="30" y="34" width="12" height="9" rx="3" class="m-steel-dk"/>' +
          '<rect x="35" y="42" width="4" height="26" class="m-steel"/></g>' +
        '<path d="M34 48 Q30 60 33 96 L33 150 Q33 168 40 176 L56 176 Q63 168 63 150 L63 96 ' +
          'Q66 60 62 48 Q48 42 34 48 Z" fill="url(#pip-body)" class="m-line" stroke-width="1.2"/>' +
        '<path d="M33 92 L63 92 L63 128 Q48 134 33 128 Z" fill="url(#pip-grip)" class="m-line" stroke-width="0.8"/>' +
        '<rect x="35" y="99" width="26" height="3" rx="1.5" class="m-plastic-hi" opacity=".35"/>' +
        '<rect x="35" y="106" width="26" height="3" rx="1.5" class="m-steel-dk" opacity=".35"/>' +
        '<rect x="35" y="113" width="26" height="3" rx="1.5" class="m-plastic-hi" opacity=".35"/>' +
        '<rect x="37" y="60" width="22" height="16" rx="2" class="m-lcd-bg m-line" stroke-width="1"/>' +
        '<text id="pip-vol-readout" class="svg-readout" x="48" y="72" text-anchor="middle" ' +
          'font-size="9" letter-spacing="0.5">0µL</text>' +
        '<path d="M63 84 Q84 88 82 108 Q80 120 68 120 L66 112 Q74 110 74 102 Q74 94 63 96 Z" ' +
          'fill="url(#pip-body)" class="m-line" stroke-width="1"/>' +
        '<path d="M40 176 L56 176 L53 214 Q48 220 43 214 Z" fill="url(#pip-shaft)" class="m-line" stroke-width="1"/>' +
        '<rect id="pip-nozzle" x="44" y="212" width="8" height="18" rx="2" class="m-steel m-line" stroke-width="0.8"/>' +
      '</g>' +
      '<g id="pip-tipmount" transform="translate(48,230)"></g>' +
    '</svg>';
  }

  /* =======================================================================
   *  Transfer pipet  —  the soft plastic bulb pipet the protocol calls for
   *  at the wash steps ("Using a transfer pipet, ADD Wash Buffer…").  It is
   *  a different tool from the micropipette on purpose: you do not measure
   *  with it, you flood the well.
   * ===================================================================== */
  function transferPipet() {
    return '' +
    '<svg id="transfer-svg" class="transfer-pipet" viewBox="0 0 60 300" width="60" height="300" ' +
        'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plastic transfer pipet">' +
      '<defs>' +
        '<linearGradient id="tp-body" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" class="g-glass-2"/><stop offset=".35" class="g-glass-1"/>' +
          '<stop offset="1" class="g-glass-0"/>' +
        '</linearGradient>' +
        '<clipPath id="tp-clip">' +
          '<path d="M30 8 C46 8 52 24 52 40 C52 58 44 70 38 74 L34 268 L26 268 L22 74 ' +
            'C16 70 8 58 8 40 C8 24 14 8 30 8 Z"/>' +
        '</clipPath>' +
      '</defs>' +
      /* the liquid is drawn first and clipped to the body, so the bulb reads
         as translucent polythene with wash buffer inside it */
      '<g clip-path="url(#tp-clip)">' +
        '<rect id="tp-liquid" class="tp-liquid" x="0" y="10" width="60" height="0" fill-opacity="0"/>' +
      '</g>' +
      '<path d="M30 8 C46 8 52 24 52 40 C52 58 44 70 38 74 L34 268 L26 268 L22 74 ' +
        'C16 70 8 58 8 40 C8 24 14 8 30 8 Z" fill="url(#tp-body)" class="m-line" stroke-width="1.2"/>' +
      '<path class="m-sheen" d="M20 18 C15 24 14 34 15 44 L20 44 C19 34 20 25 24 20 Z" opacity=".6"/>' +
      /* graduation rings on the stem — a transfer pipet has a few, unlabelled */
      '<g class="m-line" stroke-width="0.8" opacity=".5">' +
        '<line x1="23" y1="120" x2="33" y2="120"/><line x1="23" y1="160" x2="33" y2="160"/>' +
        '<line x1="23" y1="200" x2="33" y2="200"/></g>' +
      '<path id="tp-tip" class="m-tip-poly" d="M26 268 L34 268 L32 292 L28 292 Z" stroke-width="0.8"/>' +
    '</svg>';
  }

  /* =======================================================================
   *  Fine-tipped marker  —  protocol step 1
   * ===================================================================== */
  function marker() {
    return '' +
    '<svg id="marker-svg" class="marker" viewBox="0 0 44 210" width="44" height="210" ' +
        'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fine-tipped marker">' +
      '<defs><linearGradient id="mk-body" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" class="g-grip-2"/><stop offset=".45" class="g-grip-1"/>' +
        '<stop offset="1" class="g-grip-2"/></linearGradient></defs>' +
      '<rect x="12" y="6" width="20" height="22" rx="4" class="m-steel-dk"/>' +
      '<rect x="9" y="24" width="26" height="126" rx="6" fill="url(#mk-body)" class="m-line" stroke-width="1"/>' +
      '<rect class="m-label" x="11" y="60" width="22" height="52" rx="2" opacity=".92" stroke-width="0.8"/>' +
      '<text class="marker-cap" x="22" y="92" text-anchor="middle" font-size="8" ' +
        'transform="rotate(-90 22 92)">FINE</text>' +
      '<path d="M13 150 L31 150 L27 176 L17 176 Z" class="m-plastic m-line" stroke-width="0.8"/>' +
      '<path id="mk-nib" class="mk-nib" d="M18 176 L26 176 L23 196 L21 196 Z"/>' +
    '</svg>';
  }

  /* =======================================================================
   *  Reagent tube  —  screw-cap microtube.  The CAP carries the protocol's
   *  own label colour ("Dil. Buf. - pink label", "1°AB - green label", …)
   *  so the rack reads the way the kit box does.
   * ===================================================================== */
  var TUBE = { top: 58, bottom: 150 };
  function tubeLiquidY(level) {
    var l = Math.max(0, Math.min(1, level));
    return TUBE.bottom - l * (TUBE.bottom - TUBE.top);
  }

  function reagentTube(id, reagent, levelPct) {
    var uid = 'tube-' + id;
    var liqTop = tubeLiquidY(levelPct);
    // Reagent colours are science, not decoration: hue is locked and only the
    // per-theme S/L tuning is applied.  Carried as custom properties so a
    // theme switch repaints them without any inline fill.
    var paint = (Lab.theme && Lab.theme.sci) ? Lab.theme.sci(id, 'fill') : reagent.fill;
    var capPaint = (Lab.theme && Lab.theme.sci) ? Lab.theme.sci(id, 'dark') : reagent.dark;
    var vars = '--tube-paint:' + paint + ';--tube-cap:' + capPaint;

    return '' +
    '<svg class="station reagent-tube" data-station="tube" data-reagent="' + id + '" ' +
        'style="' + vars + '" viewBox="0 0 80 180" role="button" tabindex="0" ' +
        'aria-label="' + esc(reagent.name) + '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
        '<linearGradient id="' + uid + '-glass" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" class="g-glass-0"/><stop offset=".25" class="g-glass-1"/>' +
          '<stop offset=".5" class="g-glass-0"/><stop offset="1" class="g-glass-2"/>' +
        '</linearGradient>' +
        '<clipPath id="' + uid + '-clip"><path d="M22 58 L58 58 L54 150 Q40 168 26 150 Z"/></clipPath>' +
      '</defs>' +
      '<rect class="tube-cap" x="20" y="30" width="40" height="20" rx="4"/>' +
      '<rect class="tube-cap" x="24" y="26" width="32" height="8" rx="4"/>' +
      '<rect class="m-steel-dk" x="20" y="46" width="40" height="6" rx="2" opacity=".4"/>' +
      '<path class="m-plastic" d="M22 52 L58 52 L54 150 Q40 170 26 150 Z"/>' +
      '<g clip-path="url(#' + uid + '-clip)">' +
        '<rect class="tube-liquid" x="20" y="' + liqTop + '" width="40" height="120"/>' +
        '<ellipse class="tube-liquid" cx="40" cy="' + liqTop + '" rx="18" ry="3" opacity=".65"/>' +
      '</g>' +
      '<path d="M22 52 L58 52 L54 150 Q40 170 26 150 Z" fill="url(#' + uid + '-glass)" ' +
        'class="m-line" stroke-width="1.4"/>' +
      '<rect class="m-sheen" x="28" y="60" width="4" height="86" rx="2" opacity=".5"/>' +
      '<g class="m-line" stroke-width="0.8" opacity=".6">' +
        '<line x1="50" y1="80" x2="56" y2="80"/><line x1="50" y1="104" x2="56" y2="104"/>' +
        '<line x1="50" y1="128" x2="56" y2="128"/></g>' +
      /* the coloured stripe IS the label colour the protocol names */
      '<rect class="m-label" x="14" y="88" width="52" height="34" rx="3" stroke-width="1" opacity=".96"/>' +
      '<rect class="tube-stripe" x="14" y="88" width="52" height="7" rx="2"/>' +
      '<text class="tube-abbr" x="40" y="113" text-anchor="middle" font-size="15" ' +
        'font-weight="700">' + esc(reagent.abbr) + '</text>' +
    '</svg>';
  }

  /* =======================================================================
   *  Sample tube  —  the control and patient samples, "white labels".
   *  Smaller than a reagent tube and deliberately colourless: at the bench
   *  these are the ones you have to read to tell apart.
   * ===================================================================== */
  function sampleTube(id, selected) {
    return '' +
    '<svg class="station sample-tube' + (selected ? ' is-picked' : '') + '" data-station="sample" ' +
        'data-sample="' + esc(id) + '" viewBox="0 0 70 156" role="button" tabindex="0" ' +
        'aria-label="Sample tube ' + esc(id) + '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="st-' + esc(id) + '-glass" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" class="g-glass-0"/><stop offset=".45" class="g-glass-1"/>' +
        '<stop offset="1" class="g-glass-2"/></linearGradient></defs>' +
      '<rect class="m-steel" x="18" y="22" width="34" height="16" rx="3"/>' +
      '<path class="m-plastic" d="M20 38 L50 38 L47 124 Q35 140 23 124 Z"/>' +
      '<path class="sample-liquid" d="M21.5 76 L48.5 76 L47 124 Q35 139 23 124 Z"/>' +
      '<path d="M20 38 L50 38 L47 124 Q35 140 23 124 Z" fill="url(#st-' + esc(id) + '-glass)" ' +
        'class="m-line" stroke-width="1.2"/>' +
      '<rect class="m-label" x="15" y="62" width="40" height="34" rx="2" stroke-width="1"/>' +
      /* hand-written label: two ink strokes, no text.  At bench scale a real
         label is a mark you recognise, not a word you read — the name is set
         as HTML underneath, where it can be legible. */
      '<path class="sample-ink" d="M20 74 h22" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path class="sample-ink" d="M20 85 h14" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>' +
      '<circle class="sample-pick" cx="35" cy="140" r="9" fill="none" stroke-width="1.5"/>' +
      '<path class="sample-tick" d="M30.5 140 l3 3.5 l6 -7" fill="none" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
  }

  /* =======================================================================
   *  Tip box, waste bin  —  carried over from the microarray bench
   * ===================================================================== */
  function tipBox() {
    var tips = '';
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 6; c++) {
        var x = 16 + c * 15, y = 30 + r * 9;
        tips += '<polygon class="m-tip-poly" points="' + x + ',' + y + ' ' + (x + 8) + ',' + y + ' ' +
                (x + 5) + ',' + (y + 16) + ' ' + (x + 3) + ',' + (y + 16) + '" ' +
                'fill-opacity=".8" stroke-width="0.5"/>';
      }
    }
    return '' +
    '<svg class="station tip-box" data-station="tipbox" viewBox="0 0 120 110" role="button" tabindex="0" ' +
        'aria-label="Fresh pipette tip box" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="tipbox-lid" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" class="g-tipbox-0"/><stop offset="1" class="g-tipbox-1"/></linearGradient></defs>' +
      '<rect class="m-plastic m-line" x="6" y="20" width="108" height="66" rx="6" stroke-width="1.5"/>' +
      '<rect x="10" y="24" width="100" height="20" rx="3" fill="url(#tipbox-lid)" opacity=".9"/>' +
      '<rect class="m-consumable m-line" x="10" y="46" width="100" height="38" rx="3" ' +
        'fill-opacity=".35" stroke-width="1"/>' +
      tips +
      '<rect class="m-consumable" x="6" y="14" width="108" height="10" rx="4"/>' +
      '<text class="station-caption" x="60" y="102" text-anchor="middle" font-size="13" font-weight="600">Fresh tips</text>' +
    '</svg>';
  }

  function wasteBin() {
    return '' +
    '<svg class="station waste-bin" data-station="waste" viewBox="0 0 90 122" role="button" tabindex="0" ' +
        'aria-label="Tip and liquid waste" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="waste-g" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" class="g-waste-0"/><stop offset=".5" class="g-waste-1"/>' +
        '<stop offset="1" class="g-waste-2"/></linearGradient></defs>' +
      '<ellipse class="m-hazard" cx="45" cy="30" rx="34" ry="8" opacity=".75"/>' +
      '<path d="M13 30 L20 104 Q45 116 70 104 L77 30 Z" fill="url(#waste-g)"/>' +
      '<ellipse cx="45" cy="30" rx="34" ry="8" fill="none" class="m-line" stroke-width="1.5"/>' +
      '<rect class="m-steel" x="8" y="22" width="74" height="9" rx="4"/>' +
      '<ellipse class="m-cavity" cx="45" cy="26" rx="30" ry="5"/>' +
      '<g class="waste-mark" transform="translate(45,64)" opacity=".92">' +
        '<circle r="6" fill="none" stroke-width="2.4"/>' +
        '<circle cx="0" cy="-11" r="6" fill="none" stroke-width="2.4"/>' +
        '<circle cx="-9.5" cy="5.5" r="6" fill="none" stroke-width="2.4"/>' +
        '<circle cx="9.5" cy="5.5" r="6" fill="none" stroke-width="2.4"/>' +
        '<circle r="3" stroke="none"/></g>' +
      '<text class="station-caption" x="45" y="120" text-anchor="middle" font-size="12" font-weight="600">Waste</text>' +
    '</svg>';
  }

  /* =======================================================================
   *  Wash bottle  —  where the transfer pipet draws from
   * ===================================================================== */
  function washBottle() {
    var paint = (Lab.theme && Lab.theme.sci) ? Lab.theme.sci('WASH', 'fill') : cfg.REAGENTS.WASH.fill;
    var cap = (Lab.theme && Lab.theme.sci) ? Lab.theme.sci('WASH', 'dark') : cfg.REAGENTS.WASH.dark;
    return '' +
    '<svg class="station wash-bottle" data-station="wash" data-reagent="WASH" ' +
        'style="--tube-paint:' + paint + ';--tube-cap:' + cap + '" viewBox="0 0 110 168" ' +
        'role="button" tabindex="0" aria-label="Wash buffer bottle" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
        '<linearGradient id="wb-glass" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" class="g-glass-2"/><stop offset=".3" class="g-glass-1"/>' +
          '<stop offset=".7" class="g-glass-0"/><stop offset="1" class="g-glass-2"/></linearGradient>' +
        '<clipPath id="wb-clip"><path d="M26 62 L84 62 L84 150 Q84 160 74 160 L36 160 Q26 160 26 150 Z"/></clipPath>' +
      '</defs>' +
      /* the angled draw tube of a squeeze wash bottle */
      '<path class="m-steel" d="M52 10 L52 30 L44 30 L44 10 Z"/>' +
      '<path class="m-steel" d="M44 10 Q44 4 50 4 L74 4 Q80 4 80 10 Q80 15 74 15 L56 15" ' +
        'fill="none" stroke-width="4" stroke-linecap="round"/>' +
      '<rect class="tube-cap" x="38" y="30" width="34" height="16" rx="3"/>' +
      '<path class="m-plastic" d="M42 46 L68 46 L84 62 L84 150 Q84 162 72 162 L38 162 Q26 162 26 150 L26 62 Z"/>' +
      '<g clip-path="url(#wb-clip)">' +
        '<rect class="tube-liquid" id="wash-level" x="24" y="86" width="64" height="80"/>' +
        '<ellipse class="tube-liquid" cx="55" cy="86" rx="30" ry="3" opacity=".6"/>' +
      '</g>' +
      '<path d="M42 46 L68 46 L84 62 L84 150 Q84 162 72 162 L38 162 Q26 162 26 150 L26 62 Z" ' +
        'fill="url(#wb-glass)" class="m-line" stroke-width="1.4"/>' +
      '<rect class="m-sheen" x="33" y="70" width="5" height="76" rx="2.5" opacity=".45"/>' +
      '<rect class="m-label" x="30" y="96" width="50" height="30" rx="2" stroke-width="1" opacity=".95"/>' +
      '<text class="tube-abbr" x="55" y="110" text-anchor="middle" font-size="11" font-weight="700">WASH</text>' +
      '<text class="tube-abbr" x="55" y="120" text-anchor="middle" font-size="7.5">BUFFER</text>' +
    '</svg>';
  }

  /* =======================================================================
   *  Paper towels  —  "INVERT the strips over the sink or a stack of paper
   *  towels … gently TAP the strips 4–5 times onto a fresh paper towel."
   *  Drag a strip onto this and it empties.
   * ===================================================================== */
  /* The pad is drawn in the SAME width units as the strip (STRIP.w), so when
     both are given the same CSS width a strip lands squarely on the towelling
     along its whole length — which is the actual bench movement: the strip is
     turned over onto the towels and tapped along its length, not dabbed on a
     coaster beside it.  It also makes the drag target the full width of the
     thing being dragged onto it. */
  function paperTowels() {
    var W = STRIP.w, H = 130;
    var sheetW = W - 44, sheets = '';
    for (var i = 0; i < 5; i++) {
      var y = 52 - i * 6, x = 22 + (i % 2 ? 4 : 0);
      sheets += '<rect class="m-towel" x="' + x + '" y="' + y + '" width="' + sheetW +
                '" height="62" rx="3" stroke-width="1"/>';
    }
    // the damp patch: twelve wells' worth, spread along the strip's own pitch
    var damp = '';
    for (var k = 0; k < 12; k++) {
      var cx = STRIP.padL + k * STRIP.pitch;
      var rx = 15 + (k % 3) * 3, ry = 6 + (k % 2) * 2;
      damp += '<ellipse class="towel-damp" cx="' + cx + '" cy="' + (52 + (k % 2 ? 4 : 0)) +
              '" rx="' + rx + '" ry="' + ry + '"/>';
    }
    return '' +
    '<svg id="towels-svg" class="station towels" data-station="towels" viewBox="0 0 ' + W + ' ' + H + '" ' +
        'role="button" tabindex="0" aria-label="Stack of paper towels" xmlns="http://www.w3.org/2000/svg">' +
      '<ellipse class="m-shadow" cx="' + (W / 2) + '" cy="118" rx="' + (W / 2 - 30) + '" ry="8" opacity=".18"/>' +
      sheets +
      '<g id="towel-damp" opacity="0">' + damp + '</g>' +
    '</svg>';
  }

  /* =======================================================================
   *  Bench timer  —  the protocol's incubations are at ROOM temperature, so
   *  this is a countdown timer and not an oven.  Getting that right matters:
   *  a student who remembers an incubator has learned the wrong protocol.
   * ===================================================================== */
  function benchTimer() {
    return '' +
    '<svg id="timer-svg" class="station bench-timer" data-station="timer" viewBox="0 0 150 144" ' +
        'role="button" tabindex="0" aria-label="Bench countdown timer" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="tm-body" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" class="g-appliance-0"/><stop offset="1" class="g-appliance-1"/></linearGradient></defs>' +
      /* fold-out stand, so it reads as a real bench timer standing up */
      '<path class="m-steel-dk" d="M28 118 L18 138 L30 138 L40 120 Z"/>' +
      '<path class="m-steel-dk" d="M122 118 L132 138 L120 138 L110 120 Z"/>' +
      '<rect x="14" y="10" width="122" height="112" rx="12" fill="url(#tm-body)" class="m-line" stroke-width="2"/>' +
      '<rect class="m-lcd-bg m-line" x="26" y="24" width="98" height="42" rx="4" stroke-width="1"/>' +
      '<text id="timer-readout" class="svg-readout" x="75" y="55" text-anchor="middle" ' +
        'font-size="27" letter-spacing="1">5:00</text>' +
      /* the ring that drains as the incubation runs */
      '<circle class="timer-track" cx="75" cy="88" r="17" fill="none" stroke-width="4"/>' +
      '<circle id="timer-arc" class="timer-arc" cx="75" cy="88" r="17" fill="none" stroke-width="4" ' +
        'stroke-linecap="round" transform="rotate(-90 75 88)" ' +
        'stroke-dasharray="106.8" stroke-dashoffset="0"/>' +
      /* #timer-led is animated by GSAP with attr:{fill} — see the contract at
         the top of this file: it must have NO CSS fill rule */
      '<circle id="timer-led" cx="36" cy="88" r="5"/>' +
      '<rect class="m-steel" x="102" y="80" width="18" height="16" rx="3"/>' +
      '<rect class="m-steel-dk" x="105" y="84" width="12" height="3" rx="1.5"/>' +
    '</svg>';
  }

  /* The disposable tip and the liquid inside it are NOT built here.  They are
     re-shaped on every aspiration and every dispense, so pipette.js owns them
     outright — a second builder in this file would only drift out of step. */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  Lab.assets = {
    STRIP: STRIP,
    TUBE: TUBE,
    stripTube: stripTube,
    liquidTop: liquidTop,
    pipette: pipette,
    transferPipet: transferPipet,
    marker: marker,
    reagentTube: reagentTube,
    tubeLiquidY: tubeLiquidY,
    sampleTube: sampleTube,
    tipBox: tipBox,
    wasteBin: wasteBin,
    washBottle: washBottle,
    paperTowels: paperTowels,
    benchTimer: benchTimer,
    esc: esc
  };
})(window.Lab = window.Lab || {});
