/* =============================================================================
 * repaint.js  —  Re-apply every runtime-painted colour after a theme change.
 *
 * WHY NOT JUST REBUILD THE SVG?
 * Because build() is not idempotent.  Re-running it would: re-register the
 * delegated click/keydown handlers in surfaces.js (every spot click would fire
 * twice), append a SECOND #uv-beam / #uv-lamp-holder / pipette via
 * insertAdjacentHTML, add another 'phase' subscriber (state.js has no off()),
 * and leave engine.js holding references to detached nodes.  A dwell timer
 * still in flight would then act on a node no longer in the document.
 *
 * So: tokens repaint the static artwork through CSS for free, and this module
 * nudges only the handful of elements whose colour is written at runtime.
 * Everything is derived from Lab.state, so no new state is needed.
 *
 * Exposed as  Lab.repaint
 * ========================================================================== */
(function (Lab) {
  'use strict';

  function sci(name, variant, fb) {
    return (Lab.theme && Lab.theme.sci) ? Lab.theme.sci(name, variant) : fb;
  }

  function repaint() {
    var cfg = Lab.config, S = Lab.state && Lab.state.S;
    if (!cfg || !S) return;

    cfg.allIds().forEach(function (id) {
      var s = S.spots[id];
      if (s) {
        // Precedence mirrors the dispense order in engine.js: a spot coated
        // with HB was necessarily sampled and EB'd first, and S.spots records
        // only booleans — not "which reagent painted this".
        if (s.revealed)   Lab.surfaces.revealSpot(id);
        else if (s.hb)     Lab.surfaces.coatSpot(id, 'hb', sci('HB', 'fill', cfg.REAGENTS.HB.fill));
        else if (s.sample) Lab.surfaces.coatSpot(id, 'sample', sci('MIX', 'fill', cfg.REAGENTS.MIX.fill));
        else if (s.eb)     Lab.surfaces.coatSpot(id, 'eb', sci('EB', 'fill', cfg.REAGENTS.EB.fill));
      }

      var w = S.wells[id];
      if (w) {
        if (w.aspirated) Lab.surfaces.fillWell(id, sci('MIX', 'fill', cfg.REAGENTS.MIX.fill), 0.12);
        else if (w.mixed || w.mixProgress > 0) Lab.surfaces.mixWell(id, w.mixProgress || 1);
        else if (w.cdna) Lab.surfaces.fillWell(id, sci('cDNA', 'fill', cfg.REAGENTS.cDNA.fill), 0.55);
      }
    });

    // reagent tubes carry their science colour as custom properties
    document.querySelectorAll('.reagent-tube[data-reagent]').forEach(function (svg) {
      var id = svg.getAttribute('data-reagent');
      if (!cfg.REAGENTS[id]) return;
      svg.style.setProperty('--tube-paint', sci(id, 'fill', cfg.REAGENTS[id].fill));
      svg.style.setProperty('--tube-cap', sci(id, 'dark', cfg.REAGENTS[id].dark));
    });

    // pipette liquid + instrument LEDs (attribute-painted, see stations.js)
    if (Lab.pipette && Lab.pipette.setLiquid) {
      Lab.pipette.setLiquid(S.pipette.reagent, S.pipette.volume);
    }
    if (Lab.stations && Lab.stations.paintInstruments) Lab.stations.paintInstruments();
    if (Lab.stations && Lab.stations.updateTubeLevels) Lab.stations.updateTubeLevels(false);

    // legend swatches carry a per-theme same-hue rim.  Rebuild the LEGEND only
    // — never the table, which holds the student's typed answers.
    if (Lab.analysis && Lab.analysis.rebuildLegend) Lab.analysis.rebuildLegend();

    if (Lab.ui && Lab.ui.updateHud) Lab.ui.updateHud();
  }

  Lab.repaint = repaint;
})(window.Lab = window.Lab || {});
