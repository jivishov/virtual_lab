/* =============================================================================
 * assets.js  —  Rich, self-contained SVG artwork for every lab object.
 *
 * Each builder returns an SVG markup string.  They are pure (no DOM, no state)
 * so they are trivial to test and re-skin.
 *
 * THEMING CONTRACT — read before adding artwork here:
 *
 *   1. No colour literals.  Emit structure + a class; the colour lives in
 *      style.css against that class.  `var()` inside a presentation ATTRIBUTE
 *      works only in Chromium, so we do not rely on it.
 *
 *   2. Anything painted at RUNTIME carries a custom property on the element
 *      (--spot-paint, --well-paint, --pip-paint, --tube-paint) which a CSS
 *      rule consumes.  Never write an inline style="fill:…" on those: inline
 *      style outranks the darkroom rules in style.css, and the UV reveal
 *      would silently stop working.
 *
 *   3. Anything GSAP animates with attr:{fill} (the incubator LED and chamber
 *      glow) must have NO CSS fill rule at all, because a stylesheet rule
 *      beats a presentation attribute.  Those get their colour from
 *      Lab.theme at build time and on repaint.
 *
 * Exposed as  Lab.assets
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var cfg = Lab.config;

  /* ----------------------------------------------------------------------- */
  /*  Micropipette (the star of the show)                                    */
  /*  viewBox 0 0 96 320, pointing straight down, tip hotspot at (48, 316).  */
  /* ----------------------------------------------------------------------- */
  function pipette() {
    return '' +
    '<svg id="pipette-svg" class="pipette" viewBox="0 0 96 320" width="96" height="320" ' +
        'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Adjustable micropipette">' +
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
      /* elevation is a CSS drop-shadow on .pipette (tokenised per theme), so
         the old pip-shadow SVG filter is gone — it was also doubling up with
         the CSS shadow that .pipette already carried. */
      '<g>' +
        /* plunger (animated on aspirate / dispense) */
        '<g id="pip-plunger">' +
          '<rect x="40" y="2" width="16" height="30" rx="5" fill="url(#pip-plunger-g)" class="m-line" stroke-width="1"/>' +
          '<rect x="43" y="6" width="10" height="5" rx="2.5" class="m-plastic-hi" opacity=".7"/>' +
        '</g>' +
        '<rect x="44" y="30" width="8" height="20" class="m-steel-dk"/>' +
        /* ejector arm */
        '<g id="pip-ejector"><rect x="30" y="34" width="12" height="9" rx="3" class="m-steel-dk"/>' +
          '<rect x="35" y="42" width="4" height="26" class="m-steel"/></g>' +
        /* main body */
        '<path d="M34 48 Q30 60 33 96 L33 150 Q33 168 40 176 L56 176 Q63 168 63 150 L63 96 ' +
          'Q66 60 62 48 Q48 42 34 48 Z" fill="url(#pip-body)" class="m-line" stroke-width="1.2"/>' +
        /* coloured grip band — belongs to the theme accent */
        '<path d="M33 92 L63 92 L63 128 Q48 134 33 128 Z" fill="url(#pip-grip)" class="m-line" stroke-width="0.8"/>' +
        '<rect x="35" y="99" width="26" height="3" rx="1.5" class="m-plastic-hi" opacity=".35"/>' +
        '<rect x="35" y="106" width="26" height="3" rx="1.5" class="m-steel-dk" opacity=".35"/>' +
        '<rect x="35" y="113" width="26" height="3" rx="1.5" class="m-plastic-hi" opacity=".35"/>' +
        /* digital volume window */
        '<rect x="37" y="60" width="22" height="16" rx="2" class="m-lcd-bg m-line" stroke-width="1"/>' +
        '<text id="pip-vol-readout" class="svg-readout" x="48" y="72" text-anchor="middle" ' +
          'font-size="9" letter-spacing="0.5">0µL</text>' +
        /* finger hook */
        '<path d="M63 84 Q84 88 82 108 Q80 120 68 120 L66 112 Q74 110 74 102 Q74 94 63 96 Z" ' +
          'fill="url(#pip-body)" class="m-line" stroke-width="1"/>' +
        /* shaft down to the tip cone */
        '<path d="M40 176 L56 176 L53 214 Q48 220 43 214 Z" fill="url(#pip-shaft)" class="m-line" stroke-width="1"/>' +
        '<rect id="pip-nozzle" x="44" y="212" width="8" height="18" rx="2" class="m-steel m-line" stroke-width="0.8"/>' +
      '</g>' +

      /* disposable tip + liquid are injected here by pipette.js */
      '<g id="pip-tipmount" transform="translate(48,230)"></g>' +
    '</svg>';
  }

  // The disposable tip cone (semi-transparent polypropylene) + inner liquid.
  // Returned as inner markup for #pip-tipmount (origin at the tip's throat).
  // The liquid colour arrives as a CUSTOM PROPERTY so a theme switch repaints
  // it without the runtime writing an inline fill.
  function pipetteTip(hasLiquid, fill, fillPct) {
    var tip =
      '<polygon id="pip-tip" class="m-tip-poly" points="-9,0 9,0 2.4,74 -2.4,74" ' +
        'stroke-width="0.8"/>' +
      '<polygon class="m-tip-poly" points="-9,0 -3,0 -1,74 -2.4,74" stroke="none"/>';
    var liquid = '';
    if (hasLiquid) {
      // liquid sits at the bottom of the cone; height grows with fillPct.
      var topY = 70 - Math.max(0.08, fillPct) * 58; // 0..58 tall, bottom ~70
      var wTop = 2.4 + (70 - topY) / 74 * 6.6;        // cone widens upward
      liquid =
        '<polygon id="pip-liquid" style="--pip-paint:' + fill + '" points="' +
          (-wTop) + ',' + topY + ' ' + wTop + ',' + topY + ' 2.2,71 -2.2,71" ' +
          'fill-opacity="0.92"/>' +
        '<ellipse id="pip-liquid-top" style="--pip-paint:' + fill + '" cx="0" cy="' + topY +
          '" rx="' + wTop + '" ry="1.6" opacity="0.6"/>';
    }
    return tip + liquid;
  }

  /* ----------------------------------------------------------------------- */
  /*  Reagent tube (screw-cap microtube on a stand)                          */
  /* ----------------------------------------------------------------------- */
  // Liquid column geometry, shared with stations.js so the fill level and the
  // drain animation cannot drift apart.
  var TUBE = { top: 58, bottom: 150 };
  function tubeLiquidY(level) {
    var l = Math.max(0, Math.min(1, level));
    return TUBE.bottom - l * (TUBE.bottom - TUBE.top);
  }

  function reagentTube(id, reagent, levelPct) {
    var uid = 'tube-' + id;
    var liqTop = tubeLiquidY(levelPct);
    // Reagent colours are science, not decoration: hue is locked, only the
    // per-theme S/L tuning is applied.  Carried as custom properties so a
    // theme switch can repaint them.
    var paint = (Lab.theme && Lab.theme.sci) ? Lab.theme.sci(id, 'fill') : reagent.fill;
    var capPaint = (Lab.theme && Lab.theme.sci) ? Lab.theme.sci(id, 'dark') : reagent.dark;
    var vars = '--tube-paint:' + paint + ';--tube-cap:' + capPaint;

    return '' +
    '<svg class="station reagent-tube" data-station="tube" data-reagent="' + id + '" ' +
        'style="' + vars + '" viewBox="0 0 80 200" role="button" tabindex="0" ' +
        'aria-label="' + reagent.name + ' tube" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
        '<linearGradient id="' + uid + '-glass" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" class="g-glass-0"/>' +
          '<stop offset=".25" class="g-glass-1"/>' +
          '<stop offset=".5" class="g-glass-0"/>' +
          '<stop offset="1" class="g-glass-2"/>' +
        '</linearGradient>' +
        '<clipPath id="' + uid + '-clip"><path d="M22 58 L58 58 L54 150 Q40 168 26 150 Z"/></clipPath>' +
      '</defs>' +
      /* cap + hinge */
      '<rect class="tube-cap" x="20" y="30" width="40" height="20" rx="4"/>' +
      '<rect class="tube-cap" x="24" y="26" width="32" height="8" rx="4"/>' +
      '<rect class="m-steel-dk" x="20" y="46" width="40" height="6" rx="2" opacity=".4"/>' +
      /* body */
      '<path class="m-plastic" d="M22 52 L58 52 L54 150 Q40 170 26 150 Z"/>' +
      /* liquid */
      '<g clip-path="url(#' + uid + '-clip)">' +
        '<rect class="tube-liquid" x="20" y="' + liqTop + '" width="40" height="120"/>' +
        '<ellipse class="tube-liquid" cx="40" cy="' + liqTop + '" rx="18" ry="3" opacity=".65"/>' +
      '</g>' +
      /* glass sheen + outline */
      '<path d="M22 52 L58 52 L54 150 Q40 170 26 150 Z" fill="url(#' + uid + '-glass)" ' +
        'class="m-line" stroke-width="1.4"/>' +
      '<rect class="m-sheen" x="28" y="60" width="4" height="86" rx="2" opacity=".5"/>' +
      /* graduation ticks */
      '<g class="m-line" stroke-width="0.8" opacity=".6">' +
        '<line x1="50" y1="80" x2="56" y2="80"/><line x1="50" y1="104" x2="56" y2="104"/>' +
        '<line x1="50" y1="128" x2="56" y2="128"/></g>' +
      /* label */
      '<rect class="m-label" x="18" y="96" width="44" height="26" rx="3" stroke-width="1" opacity=".95"/>' +
      '<text class="tube-abbr" x="40" y="113" text-anchor="middle" font-size="13" ' +
        'font-weight="700">' + reagent.abbr + '</text>' +
      '<text class="station-caption" x="40" y="190" text-anchor="middle" font-size="12">' +
        reagent.abbr + '</text>' +
    '</svg>';
  }

  /* ----------------------------------------------------------------------- */
  /*  Tip box (rack of fresh tips)                                           */
  /* ----------------------------------------------------------------------- */
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

  /* ----------------------------------------------------------------------- */
  /*  Waste bin (tip disposal) — hazard red is a SAFETY semantic, hue-locked */
  /* ----------------------------------------------------------------------- */
  function wasteBin() {
    return '' +
    '<svg class="station waste-bin" data-station="waste" viewBox="0 0 90 120" role="button" tabindex="0" ' +
        'aria-label="Tip waste bin" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="waste-g" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" class="g-waste-0"/><stop offset=".5" class="g-waste-1"/>' +
        '<stop offset="1" class="g-waste-2"/></linearGradient></defs>' +
      '<ellipse class="m-hazard" cx="45" cy="30" rx="34" ry="8" opacity=".75"/>' +
      '<path d="M13 30 L20 104 Q45 116 70 104 L77 30 Z" fill="url(#waste-g)"/>' +
      '<ellipse cx="45" cy="30" rx="34" ry="8" fill="none" class="m-line" stroke-width="1.5"/>' +
      '<rect class="m-steel" x="8" y="22" width="74" height="9" rx="4"/>' +
      '<ellipse class="m-cavity" cx="45" cy="26" rx="30" ry="5"/>' +
      /* biohazard mark */
      '<g class="waste-mark" transform="translate(45,64)" opacity=".92">' +
        '<circle r="6" fill="none" stroke-width="2.4"/>' +
        '<circle cx="0" cy="-11" r="6" fill="none" stroke-width="2.4"/>' +
        '<circle cx="-9.5" cy="5.5" r="6" fill="none" stroke-width="2.4"/>' +
        '<circle cx="9.5" cy="5.5" r="6" fill="none" stroke-width="2.4"/>' +
        '<circle r="3" stroke="none"/></g>' +
      '<text class="station-caption" x="45" y="118" text-anchor="middle" font-size="12" font-weight="600">Waste</text>' +
    '</svg>';
  }

  /* ----------------------------------------------------------------------- */
  /*  Incubator / drying oven (drop the card in to dry)                      */
  /* ----------------------------------------------------------------------- */
  function incubator() {
    return '' +
    '<svg id="incubator-svg" class="station incubator" data-station="incubator" viewBox="0 0 190 170" ' +
        'role="button" tabindex="0" aria-label="Incubator / drying oven" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
        '<linearGradient id="inc-body" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" class="g-appliance-0"/><stop offset="1" class="g-appliance-1"/></linearGradient>' +
        '<linearGradient id="inc-door" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" class="g-door-0"/><stop offset="1" class="g-door-1"/></linearGradient>' +
      '</defs>' +
      '<rect x="6" y="10" width="178" height="140" rx="8" fill="url(#inc-body)" class="m-line" stroke-width="2"/>' +
      /* control strip */
      '<rect class="m-appliance m-line" x="150" y="18" width="28" height="124" rx="4"/>' +
      '<rect class="m-lcd-bg" x="154" y="24" width="20" height="14" rx="2"/>' +
      '<text id="inc-readout" class="svg-readout" x="164" y="35" text-anchor="middle" font-size="9">42°C</text>' +
      '<circle class="m-steel" cx="164" cy="52" r="5"/>' +
      /* #inc-led and #inc-chamber-glow are animated by GSAP with attr:{fill},
         so they must have NO CSS fill rule — stations.js paints them from
         tokens at build time and on repaint. */
      '<circle id="inc-led" cx="164" cy="70" r="4"/>' +
      '<circle class="m-hazard" cx="164" cy="86" r="4" opacity=".7"/>' +
      /* chamber (behind door) */
      '<rect class="m-cavity" x="18" y="22" width="122" height="116" rx="4"/>' +
      '<rect id="inc-chamber-glow" x="18" y="22" width="122" height="116" rx="4" fill="none"/>' +
      /* heating coils */
      '<path id="inc-coils" class="m-coil" d="M26 128 h106 M26 132 h106" stroke-width="2" opacity=".6"/>' +
      /* wire shelf */
      '<g class="m-line" stroke-width="1.5" opacity=".7"><line x1="26" y1="92" x2="132" y2="92"/>' +
        '<line x1="40" y1="86" x2="40" y2="98"/><line x1="79" y1="86" x2="79" y2="98"/><line x1="118" y1="86" x2="118" y2="98"/></g>' +
      /* glass door (hinged left, animated open) */
      '<g id="inc-door" style="transform-origin:20px 80px">' +
        '<rect x="20" y="22" width="120" height="116" rx="4" fill="url(#inc-door)" class="m-line" stroke-width="1.5"/>' +
        '<rect class="m-uv-glass" x="30" y="32" width="100" height="96" rx="3" fill-opacity="0.18"/>' +
        '<rect class="m-sheen" x="36" y="38" width="26" height="86" rx="3" opacity=".12"/>' +
        '<rect class="m-steel" x="122" y="70" width="6" height="24" rx="3"/>' +
      '</g>' +
      '<text class="station-caption" x="95" y="166" text-anchor="middle" font-size="13" font-weight="600">Incubator — drop the card to dry</text>' +
    '</svg>';
  }

  /* ----------------------------------------------------------------------- */
  /*  UV lamp wand — 365 nm violet is what the lamp physically looks like,   */
  /*  so it is hue-locked across every theme.                                */
  /* ----------------------------------------------------------------------- */
  function uvLamp() {
    return '' +
    '<svg id="uv-lamp-svg" class="uv-lamp" viewBox="0 0 60 150" width="60" height="150" ' +
        'role="img" aria-label="Hand-held UV lamp" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
        '<linearGradient id="uv-handle" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" class="g-steel-2"/><stop offset=".5" class="g-steel-0"/>' +
          '<stop offset="1" class="g-steel-2"/></linearGradient>' +
        '<radialGradient id="uv-bulb" cx=".5" cy=".4" r=".6">' +
          '<stop offset="0" class="g-uv-0"/><stop offset=".6" class="g-uv-1"/>' +
          '<stop offset="1" class="g-uv-2"/></radialGradient>' +
      '</defs>' +
      '<rect x="22" y="46" width="16" height="86" rx="7" fill="url(#uv-handle)" class="m-line" stroke-width="1"/>' +
      '<rect class="m-cavity" x="26" y="60" width="8" height="30" rx="3"/>' +
      /* CSS drives the power LED pulse, so it themes itself and survives a
         theme switch mid-reveal (a GSAP repeat:-1 tween would not). */
      '<circle id="uv-power-led" cx="30" cy="54" r="3"/>' +
      '<rect class="m-appliance m-line" x="10" y="20" width="40" height="30" rx="6" stroke-width="1.2"/>' +
      '<rect id="uv-tube" x="15" y="26" width="30" height="18" rx="4" fill="url(#uv-bulb)"/>' +
      '<rect class="m-sheen" x="15" y="26" width="30" height="6" rx="3" opacity=".35"/>' +
    '</svg>';
  }

  /* ----------------------------------------------------------------------- */
  /*  Microarray card  —  glass slide + etched grid of assay spots           */
  /* ----------------------------------------------------------------------- */
  var CARD = { padL: 66, padT: 66, pitch: 58, r: 21, w: 66 + 9 * 58 + 20, h: 66 + 4 * 58 + 18 };

  function microarrayCard() {
    var s = '' +
    '<svg id="card-svg" class="card-svg" viewBox="0 0 ' + CARD.w + ' ' + CARD.h + '" ' +
        'preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" ' +
        'role="group" aria-label="DNA microarray card">' +
      '<defs>' +
        '<linearGradient id="slide-glass" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" class="g-slide-0"/>' +
          '<stop offset=".5" class="g-slide-1"/>' +
          '<stop offset="1" class="g-slide-2"/></linearGradient>' +
        /* kept for the revealed-spot bloom; style.css picks it up through
           --fx-spot-glow so a theme can swap it for a plain drop-shadow */
        '<filter id="spot-glow" x="-60%" y="-60%" width="220%" height="220%">' +
          '<feGaussianBlur stdDeviation="4" result="b"/>' +
          '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '</defs>' +
      /* the glass slide — elevation comes from the CSS filter on .card-svg */
      '<g>' +
        '<rect class="m-bezel" x="4" y="4" width="' + (CARD.w - 8) + '" height="' + (CARD.h - 8) + '" rx="16"/>' +
        '<rect x="8" y="8" width="' + (CARD.w - 16) + '" height="' + (CARD.h - 16) + '" rx="13" ' +
          'fill="url(#slide-glass)" class="m-line" stroke-width="1.5"/>' +
      '</g>' +
      /* frost strip + barcode + id (looks like a real slide) */
      /* No frosted label strip: it spanned 150px, which laid a visible band
         across assay columns 1 and 2 — and on a real slide you would not
         print spots on the frosted end anyway.  The barcode and serial below
         already read as "this is a real slide". */
      '<g transform="translate(20,' + (CARD.h - 34) + ')" opacity=".8">' +
        barcode() +
        /* not .svg-readout — that is the green LCD ink, and this is printed
           on glass, not displayed on a screen */
        '<text class="card-id" x="0" y="22" font-size="11">LC-ARRAY-001</text>' +
      '</g>';

    // column headers
    var cols = cfg.COLUMNS;
    for (var c = 0; c < cols.length; c++) {
      var cx = CARD.padL + c * CARD.pitch;
      // The first spot's etch ring starts at y=43 (padT 66 − r 23), and spots
      // are painted after these labels, so a sub-label at y=46 was drawn over.
      s += '<text class="svg-label-strong" x="' + cx + '" y="25" text-anchor="middle" font-size="13">' +
           cols[c].col + '</text>';
      s += '<text class="svg-label" x="' + cx + '" y="39" text-anchor="middle" font-size="10">' +
           cols[c].label + '</text>';
    }
    // row headers (patients)
    for (var r = 0; r < cfg.ROW_KEYS.length; r++) {
      var row = cfg.ROW_KEYS[r];
      var p = cfg.patientByRow(row);
      var cy = CARD.padT + r * CARD.pitch;
      s += '<text class="svg-label-strong" x="30" y="' + (cy - 4) + '" text-anchor="middle" font-size="13">' +
           row + '</text>';
      s += '<text class="svg-label" x="30" y="' + (cy + 12) + '" text-anchor="middle" font-size="8">P' + p.n + '</text>';
    }
    // darkroom overlay (fades in under UV; spots are drawn on top of it)
    s += '<rect id="card-night" class="m-bezel" x="8" y="8" width="' + (CARD.w - 16) +
         '" height="' + (CARD.h - 16) + '" rx="13" opacity="0"/>';

    // spots
    for (var rr = 0; rr < cfg.ROW_KEYS.length; rr++) {
      for (var cc = 0; cc < cfg.COLS; cc++) {
        var id = cfg.ROW_KEYS[rr] + (cc + 1);
        var x = CARD.padL + cc * CARD.pitch;
        var y = CARD.padT + rr * CARD.pitch;
        s += spotGroup(id, cfg.ROW_KEYS[rr], cc + 1, x, y);
      }
    }
    s += '</svg>';
    return s;
  }

  function spotGroup(id, row, col, x, y) {
    var r = CARD.r;
    // No fill attributes here on purpose: .spot-fill reads --spot-paint, which
    // surfaces.js sets on the group.  See the theming contract at the top.
    return '<g class="spot" data-spot="' + id + '" data-row="' + row + '" data-col="' + col + '" ' +
        'transform="translate(' + x + ',' + y + ')" role="button" tabindex="0" aria-label="Spot ' + id + '">' +
      '<circle class="spot-etch" r="' + (r + 2) + '" stroke-width="1"/>' +
      '<circle class="spot-well" r="' + r + '"/>' +
      '<circle class="spot-fill" r="' + r + '" fill-opacity="0"/>' +
      '<circle class="spot-sheen" r="' + (r - 5) + '" cx="-5" cy="-5" opacity="0.18"/>' +
      '<circle class="spot-ring" r="' + (r + 2) + '" fill="none" stroke-width="0" opacity="0"/>' +
      '<text class="spot-id" y="4" text-anchor="middle" font-size="10">' + id + '</text>' +
      /* opt-in colour-vision assist: filled in on reveal, shown via body.cvd-assist */
      '<text class="spot-glyph" y="6" text-anchor="middle" font-size="17"></text>' +
    '</g>';
  }

  function barcode() {
    var widths = [2, 1, 3, 1, 2, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 2, 3, 1, 2];
    var x = 0, bars = '';
    for (var i = 0; i < widths.length; i++) {
      if (i % 2 === 0) bars += '<rect class="m-bezel" x="' + x + '" y="0" width="' + widths[i] + '" height="16"/>';
      x += widths[i];
    }
    return bars;
  }

  /* ----------------------------------------------------------------------- */
  /*  QuickStrip plate  —  foil-sealed sample wells                          */
  /* ----------------------------------------------------------------------- */
  var PLATE = { padL: 66, padT: 40, pitch: 58, half: 22, w: 66 + 9 * 58 + 20, h: 40 + 4 * 58 + 14 };

  function quickstripPlate() {
    var s = '' +
    '<svg id="plate-svg" class="plate-svg" viewBox="0 0 ' + PLATE.w + ' ' + PLATE.h + '" ' +
        'preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" ' +
        'role="group" aria-label="QuickStrip sample plate">' +
      '<defs>' +
        '<linearGradient id="plate-body" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" class="g-polymer-0"/><stop offset="1" class="g-polymer-1"/></linearGradient>' +
        '<linearGradient id="foil" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" class="g-foil-0"/><stop offset=".3" class="g-foil-1"/>' +
          '<stop offset=".5" class="g-foil-2"/><stop offset=".7" class="g-foil-3"/>' +
          '<stop offset="1" class="g-foil-4"/></linearGradient>' +
      '</defs>' +
      '<g>' +
        '<rect x="4" y="4" width="' + (PLATE.w - 8) + '" height="' + (PLATE.h - 8) + '" rx="14" ' +
          'fill="url(#plate-body)" class="m-line" stroke-width="1.5"/></g>' +
      '<rect class="m-steel" x="12" y="10" width="' + (PLATE.w - 24) + '" height="8" rx="4" opacity=".5"/>';

    // column numbers
    for (var c = 0; c < cfg.COLS; c++) {
      var cx = PLATE.padL + c * PLATE.pitch;
      s += '<text class="svg-label-strong" x="' + cx + '" y="30" text-anchor="middle" font-size="12">' + (c + 1) + '</text>';
    }
    // rows
    for (var r = 0; r < cfg.ROW_KEYS.length; r++) {
      var row = cfg.ROW_KEYS[r];
      var cy = PLATE.padT + r * PLATE.pitch;
      s += '<text class="svg-label-strong" x="30" y="' + (cy + 5) + '" text-anchor="middle" font-size="12">' + row + '</text>';
      for (var cc = 0; cc < cfg.COLS; cc++) {
        var id = row + (cc + 1);
        var x = PLATE.padL + cc * PLATE.pitch;
        s += wellGroup(id, row, cc + 1, x, cy);
      }
    }
    s += '</svg>';
    return s;
  }

  function wellGroup(id, row, col, x, y) {
    var h = PLATE.half;
    return '<g class="well" data-well="' + id + '" data-row="' + row + '" data-col="' + col + '" ' +
        'transform="translate(' + x + ',' + y + ')" role="button" tabindex="0" aria-label="Well ' + id + '">' +
      '<rect class="well-rim" x="' + (-h - 2) + '" y="' + (-h - 2) + '" width="' + (2 * h + 4) + '" height="' + (2 * h + 4) + '" rx="6"/>' +
      '<rect class="well-bore" x="' + (-h) + '" y="' + (-h) + '" width="' + (2 * h) + '" height="' + (2 * h) + '" rx="5"/>' +
      '<rect class="well-liquid" x="' + (-h + 3) + '" y="' + (-h + 3) + '" width="' + (2 * h - 6) + '" height="' + (2 * h - 6) + '" rx="4" fill-opacity="0"/>' +
      '<rect class="well-foil" x="' + (-h - 2) + '" y="' + (-h - 2) + '" width="' + (2 * h + 4) + '" height="' + (2 * h + 4) + '" rx="6" fill="url(#foil)" stroke-width="0.8"/>' +
      '<path class="well-foil-x" d="M' + (-h + 4) + ',' + (-h + 4) + ' L' + (h - 4) + ',' + (h - 4) + ' M' + (h - 4) + ',' + (-h + 4) + ' L' + (-h + 4) + ',' + (h - 4) + '" stroke-width="0.6" opacity="0"/>' +
      '<circle class="well-ring" r="' + (h + 3) + '" fill="none" stroke-width="0" opacity="0"/>' +
    '</g>';
  }

  Lab.assets = {
    pipette: pipette,
    pipetteTip: pipetteTip,
    reagentTube: reagentTube,
    tipBox: tipBox,
    wasteBin: wasteBin,
    incubator: incubator,
    uvLamp: uvLamp,
    microarrayCard: microarrayCard,
    quickstripPlate: quickstripPlate,
    CARD: CARD,
    PLATE: PLATE,
    TUBE: TUBE,
    tubeLiquidY: tubeLiquidY
  };
})(window.Lab = window.Lab || {});
