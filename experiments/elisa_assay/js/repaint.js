/* =============================================================================
 * repaint.js  —  Re-apply every runtime-painted colour after a theme change
 * or after switching the light box on.
 *
 * WHY NOT JUST REBUILD THE SVG?
 * Because build() is not idempotent.  Re-running it would re-register the
 * delegated click/keydown handlers in surfaces.js (every well click would fire
 * twice), append a second transfer pipet and marker via insertAdjacentHTML,
 * add another 'phase' subscriber (state.js has no off()), and leave engine.js
 * holding references to detached nodes.  A dwell timer still in flight would
 * then act on a node that is no longer in the document.
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

    // every well's liquid column: colour and opacity both come from state
    if (Lab.surfaces && Lab.surfaces.refreshAll) Lab.surfaces.refreshAll(false);

    // reagent tubes and the wash bottle carry their science colour as custom
    // properties on the <svg>
    document.querySelectorAll('[data-reagent]').forEach(function (svg) {
      var id = svg.getAttribute('data-reagent');
      if (!cfg.REAGENTS[id] || !svg.style) return;
      svg.style.setProperty('--tube-paint', sci(id, 'fill', cfg.REAGENTS[id].fill));
      svg.style.setProperty('--tube-cap', sci(id, 'dark', cfg.REAGENTS[id].dark));
    });

    // the tools
    if (Lab.pipette && Lab.pipette.setLiquid) {
      var holding = S.pipette.reagent === 'SAMPLE' ? S.pipette.lastReagent : S.pipette.reagent;
      Lab.pipette.setLiquid(holding, S.pipette.volume);
    }
    if (Lab.stations) {
      if (Lab.stations.setTransferLoad) Lab.stations.setTransferLoad(S.transfer.loaded ? 0.9 : 0);
      if (Lab.stations.paintInstruments) Lab.stations.paintInstruments();
      if (Lab.stations.updateLevels) Lab.stations.updateLevels(false);
    }

    if (Lab.ui && Lab.ui.updateHud) Lab.ui.updateHud();
  }

  Lab.repaint = repaint;
})(window.Lab = window.Lab || {});
