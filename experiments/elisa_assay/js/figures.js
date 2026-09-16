/* =============================================================================
 * figures.js  —  The teaching diagrams from the printed protocol, redrawn as
 * SVG: the optimised ELISA workflow and its key (protocol Figure 2), the
 * structure of an antibody (protocol Figure 1), and a sketch of the standard
 * curve.  The briefing renders them in its own order, so the numbering on the
 * page is the page's, not the protocol's.
 *
 * These are FIGURES, not apparatus.  A figure's colours are part of its
 * meaning — the reader is expected to carry "antigen is green, primary is
 * orange, HRP is teal" from the diagram to the bench — so unlike the rest of
 * the artwork these hues are fixed.  They are still emitted as classes, so
 * style.css can tune lightness for a dark bench without ever moving the hue.
 *
 * Exposed as  Lab.figures
 * ========================================================================== */
(function (Lab) {
  'use strict';

  /* =======================================================================
   *  The six stages of the assay  (protocol Figure 2B)
   *
   *  Every panel draws the same stack, cut off at a different height, which
   *  is exactly the argument the figure is making: each step ADDS one layer,
   *  and each layer only sticks if the one below it is there.
   *
   *  Local coordinates: the well surface is y = 0 and the stack grows upward
   *  into negative y, so "add a layer" is always "draw at a more negative y".
   * ===================================================================== */

  /* ---- where the layers touch -------------------------------------------
   *  The drawing's one real claim is that these pieces FIT each other: the
   *  antigen carries a pocket the primary antibody drops into, the secondary
   *  antibody is hollowed underneath to sit on the primary's crown, and the
   *  substrate has a foot cut to the enzyme's cleft.  So each joint is
   *  written down once — a level and a curve — and both halves are taken
   *  from it.  Change a number and the two sides of that joint move
   *  together; there is no second copy to forget.
   */
  var AG_HALF = 16, AG_RIM = -26;      // the antigen block, and its shoulders
  var POCKET  = 13, POCKET_D = 11;     // the epitope cut into its top

  var AB1_RX  = 12, AB1_RY = 15;       // the primary antibody
  var AB1_CY  = AG_RIM + POCKET_D - AB1_RY;    // its underside IS the pocket floor

  var BODY    = 18;                    // secondary antibody and enzyme, one body
  var CUP     = 13, CUP_D = 10;        // the hollow underneath the secondary
  var AB2_RIM = AB1_CY - AB1_RY + CUP_D;       // where that hollow opens out
  var AB2_TOP = -55;                   // antibody gives way to the enzyme it carries

  var HRP_RIM = -69;                   // the enzyme's shoulders
  var CLEFT   = 13, CLEFT_D = 7;       // the active site cut into them
  var SUB     = 16, SUB_TOP = -84;     // the substrate block

  /** Half an ellipse, from (x0,y) to (x1,y).  A positive `bulge` sags back
      towards the well — a hollow in an upward-facing edge, or the foot of
      the piece that fills it; a negative one rises away.  The arc's sweep
      flag also has to flip when an edge is traced right-to-left, which is
      the whole reason this is a function rather than six literal paths. */
  function curve(x0, x1, y, bulge) {
    return 'A' + (Math.abs(x1 - x0) / 2) + ' ' + Math.abs(bulge) + ' 0 0 ' +
           (((x1 > x0) === (bulge > 0)) ? 0 : 1) + ' ' + x1 + ',' + y;
  }

  var SURFACE = '<rect class="fig-surface" x="-28" y="0" width="56" height="5.5" rx="1"/>';

  // The antigen: a block with the epitope cut into its top.
  var AG_PATH =
    'M' + -AG_HALF + ',0 L' + -AG_HALF + ',' + AG_RIM + ' L' + -POCKET + ',' + AG_RIM + ' ' +
    curve(-POCKET, POCKET, AG_RIM, POCKET_D) +
    ' L' + AG_HALF + ',' + AG_RIM + ' L' + AG_HALF + ',0 Z';

  var ANTIGEN = '<path class="fig-antigen" d="' + AG_PATH + '"/>';

  // Loose in solution, before it has adsorbed: the same block, tilted and lifted.
  var ANTIGEN_FREE =
    '<g transform="translate(0,-40) rotate(-14)">' +
      '<path class="fig-antigen" d="' + AG_PATH + '"/>' +
    '</g>';

  // Primary antibody: the body the pocket was cut for.  Its lowest point is
  // the floor of the pocket, and its crown is what the secondary sits on.
  var PRIMARY = '<ellipse class="fig-ab1" cx="0" cy="' + AB1_CY +
                '" rx="' + AB1_RX + '" ry="' + AB1_RY + '"/>';

  // Secondary antibody (magenta), hollowed underneath to take that crown.
  var SECONDARY =
    '<path class="fig-ab2" d="M' + -BODY + ',' + AB2_TOP + ' L' + BODY + ',' + AB2_TOP +
    ' L' + BODY + ',' + AB2_RIM + ' L' + CUP + ',' + AB2_RIM + ' ' +
    curve(CUP, -CUP, AB2_RIM, -CUP_D) +
    ' L' + -BODY + ',' + AB2_RIM + ' Z"/>';

  // The HRP enzyme (teal) it carries.  Same body, continued upward, and the
  // cleft in its shoulders is the active site the substrate has to reach.
  var HRP =
    '<path class="fig-hrp" d="M' + -BODY + ',' + AB2_TOP +
    ' L' + -BODY + ',' + (HRP_RIM + 3) + ' Q' + -BODY + ',' + HRP_RIM + ' ' + (-BODY + 3) + ',' + HRP_RIM +
    ' L' + -CLEFT + ',' + HRP_RIM + ' ' + curve(-CLEFT, CLEFT, HRP_RIM, CLEFT_D) +
    ' L' + (BODY - 3) + ',' + HRP_RIM + ' Q' + BODY + ',' + HRP_RIM + ' ' + BODY + ',' + (HRP_RIM + 3) +
    ' L' + BODY + ',' + AB2_TOP + ' Z"/>';

  // TMB substrate: a block whose foot is that same cleft, so it seats in it.
  var SUBSTRATE =
    '<path class="fig-substrate" d="M' + -SUB + ',' + SUB_TOP + ' L' + -SUB + ',' + HRP_RIM +
    ' L' + -CLEFT + ',' + HRP_RIM + ' ' + curve(-CLEFT, CLEFT, HRP_RIM, CLEFT_D) +
    ' L' + SUB + ',' + HRP_RIM + ' L' + SUB + ',' + SUB_TOP + ' Z"/>';

  // Coloured product: what the enzyme turns the substrate into.
  var PRODUCT =
    '<g class="fig-product">' +
      '<circle cx="-13" cy="-93" r="4"/><circle cx="1" cy="-100" r="4"/><circle cx="14" cy="-92" r="4"/>' +
    '</g>';

  var STAGES = [
    { cap: 'Add sample',    parts: [SURFACE, ANTIGEN_FREE] },
    { cap: 'Antigen binds', parts: [SURFACE, ANTIGEN] },
    { cap: 'Bind primary',  parts: [SURFACE, ANTIGEN, PRIMARY] },
    { cap: 'Bind secondary',parts: [SURFACE, ANTIGEN, PRIMARY, SECONDARY, HRP] },
    { cap: 'Add substrate', parts: [SURFACE, ANTIGEN, PRIMARY, SECONDARY, HRP, SUBSTRATE] },
    { cap: 'Read',          parts: [SURFACE, ANTIGEN, PRIMARY, SECONDARY, HRP, SUBSTRATE, PRODUCT] }
  ];

  /** The six-panel workflow.  `cols` lets the caller reflow it 3×2 or 6×1. */
  function workflow(cols) {
    var n = STAGES.length;
    var perRow = cols || 3;
    var rows = Math.ceil(n / perRow);
    var cw = 132, ch = 148;
    var w = perRow * cw, h = rows * ch;

    var s = '<svg class="fig fig-workflow" viewBox="0 0 ' + w + ' ' + h + '" ' +
      'xmlns="http://www.w3.org/2000/svg" role="img" ' +
      'aria-label="The six stages of an ELISA: add sample, antigen binds, bind primary antibody, ' +
      'bind secondary antibody, add substrate, read the colour.">';

    for (var i = 0; i < n; i++) {
      var col = i % perRow, row = Math.floor(i / perRow);
      var ox = col * cw + cw / 2;
      var oy = row * ch + ch - 34;      // baseline of the stack inside the cell
      s += '<g transform="translate(' + ox + ',' + oy + ')">' + STAGES[i].parts.join('') + '</g>';
      s += '<rect class="fig-caplate" x="' + (col * cw + 8) + '" y="' + (row * ch + ch - 26) +
           '" width="' + (cw - 16) + '" height="19" rx="2"/>';
      s += '<text class="fig-cap" x="' + ox + '" y="' + (row * ch + ch - 12) +
           '" text-anchor="middle" font-size="10.5">' + STAGES[i].cap.toUpperCase() + '</text>';
    }
    s += '</svg>';
    return s;
  }

  /** The key: one of each layer, stacked, with its name alongside.  This is
      panel A of Figure 2 in the printed protocol.

      The label ladder is NOT the stack's own y positions.  Two of the layers
      (the secondary antibody and the enzyme it carries) are only a few units
      apart, and at label size their names would sit on top of each other — so
      the leader lines fan out to an evenly spaced column instead. */
  function workflowKey() {
    var rows = [
      { at: -96, y: 46,  label: 'Product',            cls: 'k-product' },
      { at: -77, y: 64,  label: 'TMB substrate',      cls: 'k-substrate' },
      { at: -62, y: 81,  label: 'HRP enzyme',         cls: 'k-hrp' },
      { at: -45, y: 98,  label: 'Secondary antibody', cls: 'k-ab2' },
      { at: -30, y: 115, label: 'Primary antibody',   cls: 'k-ab1' },
      { at: -10, y: 134, label: 'Antigen',            cls: 'k-antigen' }
    ];
    var baseX = 42, baseY = 148;
    var s = '<svg class="fig fig-key" viewBox="0 0 264 164" xmlns="http://www.w3.org/2000/svg" ' +
      'role="img" aria-label="Key to the ELISA diagram: antigen, primary antibody, secondary ' +
      'antibody, HRP enzyme, TMB substrate, coloured product.">' +
      '<g transform="translate(' + baseX + ',' + baseY + ')">' +
        SURFACE + ANTIGEN + PRIMARY + SECONDARY + HRP + SUBSTRATE + PRODUCT +
      '</g>';
    rows.forEach(function (r) {
      var from = baseY + r.at;
      s += '<polyline class="fig-leader" fill="none" points="' +
           (baseX + 21) + ',' + from + ' ' + (baseX + 34) + ',' + r.y + ' ' +
           (baseX + 42) + ',' + r.y + '"/>';
      s += '<text class="fig-keytext ' + r.cls + '" x="' + (baseX + 48) + '" y="' +
           (r.y + 3.8) + '" font-size="11.5">' + r.label + '</text>';
    });
    s += '</svg>';
    return s;
  }

  /* =======================================================================
   *  The structure of an antibody  (protocol Figure 1)
   *
   *  Two identical heavy chains run from the top of each arm all the way
   *  down the stem; two identical light chains cap the outside of the arms.
   *  The antigen binding sites are at the tips of the short arms, which is
   *  the detail the whole assay rests on.
   * ===================================================================== */
  function antibody() {
    return '<svg class="fig fig-antibody" viewBox="0 0 280 186" ' +
        'xmlns="http://www.w3.org/2000/svg" role="img" ' +
        'aria-label="A Y-shaped antibody: two heavy chains forming the stem and the inner ' +
        'arms, two light chains on the outside of the arms, and an antigen binding site at ' +
        'the tip of each arm.">' +
      /* heavy chains — one continuous run per chain, arm tip to stem foot */
      '<path class="ab-heavy" d="M80 40 L110 92 L110 158"/>' +
      '<path class="ab-heavy" d="M152 40 L122 92 L122 158"/>' +
      /* light chains — outboard of each arm, arms only */
      '<path class="ab-light" d="M62 50 L92 100"/>' +
      '<path class="ab-light" d="M170 50 L140 100"/>' +
      /* the hinge, drawn as the little waist a real IgG has */
      '<path class="ab-hinge" d="M110 114 L122 114"/>' +
      /* binding sites */
      '<circle class="ab-site" cx="71" cy="45" r="10"/>' +
      '<circle class="ab-site" cx="161" cy="45" r="10"/>' +
      /* labels */
      '<line class="fig-leader" x1="71" y1="31" x2="71" y2="20"/>' +
      '<text class="fig-keytext k-site" x="71" y="14" text-anchor="middle" font-size="10.5">Binding site</text>' +
      '<line class="fig-leader" x1="178" y1="56" x2="194" y2="56"/>' +
      '<text class="fig-keytext k-light" x="198" y="59" font-size="10.5">Light chain</text>' +
      '<line class="fig-leader" x1="130" y1="138" x2="156" y2="138"/>' +
      '<text class="fig-keytext k-heavy" x="160" y="141" font-size="10.5">Heavy chain</text>' +
    '</svg>';
  }

  /* =======================================================================
   *  A small standard-curve sketch for the briefing — twelve wells, each
   *  half the concentration of the one before, so the idea of the ladder
   *  lands before the student pipettes it.
   * ===================================================================== */
  function dilutionSketch() {
    var cfg = Lab.config;
    var n = cfg.WELLS_PER_STRIP, pitch = 32, pad = 20;
    var w = pad * 2 + (n - 1) * pitch, h = 104;
    var s = '<svg class="fig fig-ladder" viewBox="0 0 ' + w + ' ' + h + '" ' +
      'xmlns="http://www.w3.org/2000/svg" role="img" ' +
      'aria-label="Twelve wells, each half the antigen concentration of the one before, ' +
      'fading from strong colour at well 1 to almost none at well 12.">' +
      '<defs><marker id="ladder-tip" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" ' +
        'markerHeight="6" orient="auto"><path class="ladder-arrowhead" d="M0 0 L8 4 L0 8 Z"/>' +
      '</marker></defs>';
    for (var i = 1; i <= n; i++) {
      var x = pad + (i - 1) * pitch;
      var a = 0.08 + 0.9 * cfg.signalOf(cfg.standardConc(i));
      s += '<text class="fig-tick" x="' + x + '" y="13" text-anchor="middle" font-size="9">' + i + '</text>';
      s += '<rect class="ladder-well" x="' + (x - 12) + '" y="21" width="24" height="42" rx="4" ' +
           'fill-opacity="' + a.toFixed(3) + '"/>';
      s += '<rect class="ladder-rim" x="' + (x - 12) + '" y="21" width="24" height="42" rx="4" ' +
           'fill="none" stroke-width="1"/>';
    }
    /* one arrow under the whole strip, rather than eleven between the wells:
       at this size a per-step arrow is shorter than its own arrowhead */
    s += '<line class="ladder-arrow" x1="' + pad + '" y1="76" x2="' + (w - pad) +
         '" y2="76" marker-end="url(#ladder-tip)"/>';
    s += '<text class="fig-tick" x="' + pad + '" y="92" text-anchor="start" font-size="9">100 µg/mL</text>';
    s += '<text class="fig-tick" x="' + (w - pad) + '" y="92" text-anchor="end" font-size="9">0.05 µg/mL</text>';
    s += '<text class="fig-tick" x="' + (w / 2) + '" y="92" text-anchor="middle" font-size="9">' +
         'halved at every step</text>';
    s += '</svg>';
    return s;
  }

  Lab.figures = {
    workflow: workflow,
    workflowKey: workflowKey,
    antibody: antibody,
    dilutionSketch: dilutionSketch
  };
})(window.Lab = window.Lab || {});
