/* =============================================================================
 * engine.js  —  Procedure state machine + interaction resolver.
 *
 * The engine is the single authority on "given the current phase and what the
 * pipette holds, is THIS action on THIS target allowed, and what does it do?"
 * It never touches SVG directly: it asks Lab.pipette / Lab.surfaces /
 * Lab.stations to play the visuals, then mutates Lab.state.
 *
 * Exposed as  Lab.engine
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var cfg = Lab.config;
  var st  = Lab.state;
  var S   = st.S;
  var V   = cfg.VOLUME;

  var pipetteEl = null;      // set by pipette.js after mount
  var highlighted = [];      // currently glowing targets

  /* --------------------------------------------------------------------- */
  /*  Hit-testing: what lab object is under a screen point?                */
  /* --------------------------------------------------------------------- */
  function probe(x, y) {
    var prev = pipetteEl ? pipetteEl.style.pointerEvents : null;
    if (pipetteEl) pipetteEl.style.pointerEvents = 'none';
    var el = document.elementFromPoint(x, y);
    if (pipetteEl) pipetteEl.style.pointerEvents = prev || '';
    return el;
  }

  function targetAt(point) {
    var el = probe(point.x, point.y);
    if (!el || !el.closest) return null;
    var spot = el.closest('[data-spot]'); if (spot) return { kind: 'spot', id: spot.dataset.spot, el: spot };
    var well = el.closest('[data-well]'); if (well) return { kind: 'well', id: well.dataset.well, el: well };
    var stn  = el.closest('[data-station]');
    if (stn) {
      var s = stn.dataset.station;
      if (s === 'tube') return { kind: 'tube', reagent: stn.dataset.reagent, el: stn };
      return { kind: s, el: stn };
    }
    return null;
  }

  /* --------------------------------------------------------------------- */
  /*  Validation: is an action allowed right now?                          */
  /*  Returns { ok, action, reason }                                       */
  /* --------------------------------------------------------------------- */
  function neededReagent() {
    if (S.phase === 'eb') return 'EB';
    if (S.phase === 'hb') return 'HB';
    if (S.phase === 'samples') return 'cDNA';
    return null;
  }

  // May the current tip aspirate `reagent` without cross-contamination?
  // A fresh tip may take anything; a used tip may only *refill* the same bulk
  // buffer (EB/HB) it already held.  A new sample (cDNA) always needs a fresh tip.
  function canAspirate(reagent) {
    var p = S.pipette;
    if (!p.hasTip || p.reagent) return false;
    var bulk = (reagent === 'EB' || reagent === 'HB');
    return p.fresh || (bulk && p.lastReagent === reagent);
  }

  function evaluate(t) {
    if (!t) return { ok: false };
    var p = S.pipette;

    switch (t.kind) {
      case 'tipbox':
        return { ok: true, action: 'retip' };

      case 'waste':
        return p.hasTip ? { ok: true, action: 'discard' }
                        : { ok: false, reason: 'No tip to discard.' };

      case 'tube': {
        if (!p.hasTip) return { ok: false, reason: 'Attach a fresh tip first.' };
        if (p.reagent)  return { ok: false, reason: 'Tip already holds ' + p.reagent + ' — discard it first.' };
        var need = neededReagent();
        if (!need) return { ok: false, reason: 'No reagent needed at this step.' };
        if (t.reagent !== need) return { ok: false, reason: 'Wrong reagent — this step needs ' + cfg.REAGENTS[need].name + '.' };
        if (!canAspirate(need)) return { ok: false, reason: 'Attach a FRESH tip before loading ' + cfg.REAGENTS[need].name + ' (avoid cross-contamination).' };
        return { ok: true, action: 'aspirate', reagent: need };
      }

      case 'spot': {
        var sp = S.spots[t.id];
        if (!sp) return { ok: false };
        if (S.phase === 'eb') {
          if (p.reagent !== 'EB') return { ok: false, reason: 'Load Equilibration Buffer first.' };
          if (sp.eb) return { ok: false, reason: 'Spot ' + t.id + ' already has EB.' };
          if (p.volume < V.dispense) return { ok: false, reason: 'Tip empty — refill EB.' };
          return { ok: true, action: 'dispense-eb' };
        }
        if (S.phase === 'hb') {
          if (p.reagent !== 'HB') return { ok: false, reason: 'Load Hybridisation Buffer first.' };
          if (!sp.sample) return { ok: false, reason: 'That spot has no sample.' };
          if (sp.hb) return { ok: false, reason: 'Spot ' + t.id + ' already has HB.' };
          if (p.volume < V.dispense) return { ok: false, reason: 'Tip empty — refill HB.' };
          return { ok: true, action: 'dispense-hb' };
        }
        if (S.phase === 'samples') {
          if (p.reagent !== 'MIX') return { ok: false, reason: 'Mix a sample and pick it up first.' };
          if (p.mixFrom !== t.id) return { ok: false, reason: 'This sample belongs on spot ' + p.mixFrom + '.' };
          if (sp.sample) return { ok: false, reason: 'Spot already has its sample.' };
          return { ok: true, action: 'dispense-mix' };
        }
        return { ok: false };
      }

      case 'well': {
        if (S.phase !== 'samples') return { ok: false, reason: 'Wells are only used during the sample step.' };
        var w = S.wells[t.id];
        if (!w) return { ok: false };
        if (p.reagent === 'cDNA') {
          if (w.cdna) return { ok: false, reason: 'Well ' + t.id + ' already has cDNA.' };
          return { ok: true, action: 'dispense-cdna' };
        }
        if (!p.reagent && p.hasTip) {
          if (!w.cdna) return { ok: false, reason: 'Add cDNA to this well first.' };
          if (w.mixed) return { ok: false, reason: 'Well ' + t.id + ' is already mixed.' };
          return { ok: true, action: 'mix' };
        }
        if (p.reagent === 'MIX') return { ok: false, reason: 'Carry the mixed sample to its spot on the card.' };
        return { ok: false, reason: 'Attach a fresh tip and load cDNA.' };
      }

      case 'incubator': {
        var dry = (S.phase === 'dry-eb' || S.phase === 'dry-samples' || S.phase === 'dry-hb');
        return dry ? { ok: true, action: 'incubate' } : { ok: false, reason: 'Nothing to dry yet.' };
      }
    }
    return { ok: false };
  }

  /* --------------------------------------------------------------------- */
  /*  Continuous gestures during a drag (paint + swirl-mix)                */
  /* --------------------------------------------------------------------- */
  var swirl = { well: null, last: null };
  // Hover-to-act: dwelling the tip over a target performs discrete actions
  // (attach tip, aspirate, dispense, incubate) without a click or a release.
  var hover = { pendingEl: null, actedEl: null, timer: null };
  var DWELL_MS = 360;
  var DISCRETE = {
    retip: 1, discard: 1, aspirate: 1, incubate: 1,
    'dispense-eb': 1, 'dispense-hb': 1, 'dispense-cdna': 1, 'dispense-mix': 1
  };

  function cancelDwell() {
    if (hover.timer) { clearTimeout(hover.timer); hover.timer = null; }
    if (hover.pendingEl && hover.pendingEl.classList) hover.pendingEl.classList.remove('dwelling');
    hover.pendingEl = null;
  }

  function hoverAt(point) {
    if (S.busy || S.phase === 'intro') return;
    var t = targetAt(point);
    setHighlight(t);

    // re-arm once the tip leaves the element it last acted on
    if (!t || (hover.actedEl && (!t.el || t.el !== hover.actedEl))) hover.actedEl = null;

    if (!t) { swirl.well = null; cancelDwell(); return; }

    // swirl-mix inside a well
    if (t.kind === 'well' && S.phase === 'samples') {
      var evw = evaluate(t);
      if (evw.ok && evw.action === 'mix') {
        cancelDwell();
        if (swirl.well !== t.id) { swirl.well = t.id; swirl.last = point; return; }
        var dx = point.x - swirl.last.x, dy = point.y - swirl.last.y;
        swirl.last = point;
        addMix(t.id, Math.sqrt(dx * dx + dy * dy) / 420); // ~420px of swirl = fully mixed
        return;
      }
    }
    swirl.well = null;

    // dwell-to-act for discrete actions
    var ev = evaluate(t);
    if (ev.ok && DISCRETE[ev.action]) {
      if (t.el === hover.actedEl) return;    // already performed; wait for tip to leave
      if (hover.pendingEl === t.el) return;  // dwell already counting down
      cancelDwell();
      hover.pendingEl = t.el;
      if (t.el.classList) t.el.classList.add('dwelling');
      hover.timer = setTimeout(function () {
        hover.timer = null;
        if (hover.pendingEl && hover.pendingEl.classList) hover.pendingEl.classList.remove('dwelling');
        hover.pendingEl = null;
        if (evaluate(t).ok) { perform(t, point); hover.actedEl = t.el; }
      }, DWELL_MS);
      return;
    }
    cancelDwell();
  }

  function releaseAt(point) {
    swirl.well = null;
    cancelDwell();
    if (S.busy || S.phase === 'intro') { hover.actedEl = null; return; }
    var t = targetAt(point);
    clearHighlight();
    // a quick drag-and-drop still works; skip if the dwell already handled it
    if (t && !(hover.actedEl && t.el === hover.actedEl)) perform(t, point);
    hover.actedEl = null;
    refresh();
  }

  /* --------------------------------------------------------------------- */
  /*  Perform an action (validated), play visuals, mutate state            */
  /* --------------------------------------------------------------------- */
  function perform(t, point) {
    var ev = evaluate(t);
    if (!ev.ok) { if (ev.reason) Lab.ui.flash(ev.reason); return; }
    var p = S.pipette;

    switch (ev.action) {
      case 'retip':
        Lab.pipette.setTip(true);
        st.setPipette({ hasTip: true, reagent: null, volume: 0, mixFrom: null, fresh: true, lastReagent: null });
        break;

      case 'discard':
        Lab.pipette.setTip(false);
        st.setPipette({ hasTip: false, reagent: null, volume: 0, mixFrom: null, fresh: false, lastReagent: null });
        break;

      case 'aspirate': {
        var fill = V.fill;   // one dose per aspiration for every reagent
        st.setBusy(true);
        Lab.pipette.aspirate(t.el, ev.reagent, fill, function () {
          st.setPipette({ reagent: ev.reagent, volume: fill, fresh: false, lastReagent: ev.reagent });
          st.setBusy(false);
          refresh();
        });
        break;
      }

      case 'dispense-eb':
      case 'dispense-hb': {
        var kind = ev.action === 'dispense-eb' ? 'eb' : 'hb';
        var sp = S.spots[t.id];
        var col = cfg.REAGENTS[p.reagent].fill;
        p.volume -= V.dispense;
        Lab.pipette.dispense(t.el, col);
        Lab.surfaces.coatSpot(t.id, kind, col);
        sp[kind] = true;
        p.fresh = false;
        if (p.volume < V.dispense) { p.reagent = null; p.volume = 0; Lab.pipette.setLiquid(null, 0); }
        else { Lab.pipette.setLiquid(p.reagent, p.volume); }
        st.setPipette({});
        break;
      }

      case 'dispense-cdna': {
        var w = S.wells[t.id];
        Lab.pipette.dispense(t.el, cfg.REAGENTS.cDNA.fill);
        Lab.surfaces.punctureWell(t.id);
        Lab.surfaces.fillWell(t.id, cfg.REAGENTS.cDNA.fill, 0.55);
        w.cdna = true;
        st.setPipette({ reagent: null, volume: 0, fresh: false, lastReagent: 'cDNA' });
        break;
      }

      case 'dispense-mix': {
        var spm = S.spots[t.id];
        Lab.pipette.dispense(t.el, cfg.REAGENTS.MIX.fill);
        Lab.surfaces.coatSpot(t.id, 'sample', cfg.REAGENTS.MIX.fill);
        spm.sample = true;
        st.setPipette({ reagent: null, volume: 0, mixFrom: null, fresh: false, lastReagent: 'MIX' });
        break;
      }

      case 'incubate':
        runIncubation();
        break;
    }
    refresh();
  }

  // swirl accumulation -> when full, auto-pick-up the mixed sample
  function addMix(wellId, delta) {
    var w = S.wells[wellId];
    if (!w || w.mixed) return;
    S.pipette.fresh = false;   // the tip is now in patient material
    w.mixProgress = Math.min(1, w.mixProgress + delta);
    Lab.surfaces.mixWell(wellId, w.mixProgress);
    Lab.pipette.plungerPulse();
    if (w.mixProgress >= 1) {
      w.mixed = true;
      st.setBusy(true);
      var el = document.querySelector('[data-well="' + wellId + '"]');
      Lab.pipette.aspirate(el, 'MIX', V.fill, function () {
        w.aspirated = true;
        Lab.surfaces.fillWell(wellId, cfg.REAGENTS.MIX.fill, 0.12);
        st.setPipette({ reagent: 'MIX', volume: V.fill, mixFrom: wellId, fresh: false, lastReagent: 'MIX' });
        st.setBusy(false);
        refresh();
      });
    }
  }

  /* --------------------------------------------------------------------- */
  /*  Incubation (drying) sequence                                          */
  /* --------------------------------------------------------------------- */
  function runIncubation() {
    if (S.busy) return;
    st.setBusy(true);
    Lab.stations.incubate(function () {
      // mark whatever is on the card as dried
      if (S.phase === 'dry-eb')      { st.markDone('dry1'); st.setPhase('samples'); }
      else if (S.phase === 'dry-samples') { st.markDone('dry2'); st.setPhase('hb'); }
      else if (S.phase === 'dry-hb') { st.markDone('dry3'); st.setPhase('visualize'); Lab.stations.enterDarkroom(); }
      st.setBusy(false);
      refresh();
    });
  }

  /* --------------------------------------------------------------------- */
  /*  Phase progression + hint computation                                  */
  /* --------------------------------------------------------------------- */
  function advance() {
    var c = st.counts, total = c.total();
    if (S.phase === 'eb' && c.ebDone() >= total)          { st.markDone('eb'); st.setPhase('dry-eb'); }
    else if (S.phase === 'samples' && c.sampleDone() >= total) { st.markDone('mixSpot'); st.setPhase('dry-samples'); }
    else if (S.phase === 'hb' && c.hbDone() >= total)     { st.markDone('hb'); st.setPhase('dry-hb'); }
  }

  // Human-readable guidance + which targets to make glow.
  function hint() {
    var p = S.pipette, c = st.counts, total = c.total();
    switch (S.phase) {
      case 'intro':
        return { text: 'Press “Start Experiment” to enter the lab.', glow: [] };
      case 'eb': {
        var needEb = firstWhere(S.spots, function (s) { return !s.eb; });
        if (p.reagent === 'EB') return { text: 'Dispense EB onto spot ' + (needEb || '') + ' (' + c.ebDone() + '/' + total + ' done). Then aspirate again for the next spot.', glow: needEb ? ['[data-spot="' + needEb + '"]'] : [] };
        if (canAspirate('EB'))  return { text: 'Aspirate one 5 µL dose of Equilibration Buffer from the blue EB tube.', glow: ['[data-reagent="EB"]'] };
        return { text: 'Attach a fresh tip — hover the pipette over the tip box.', glow: ['.tip-box'] };
      }
      case 'dry-eb':
        return { text: 'EB applied. Drop the card into the incubator (or click it) to dry.', glow: ['.incubator'] };
      case 'samples': {
        if (p.reagent === 'MIX')  return { text: 'Carry the mixed sample to spot ' + p.mixFrom + ' on the card.', glow: ['[data-spot="' + p.mixFrom + '"]'] };
        // a well that has cDNA but is not yet mixed -> stir it
        var midCdna = firstWhere(S.wells, function (w, id) { return w.cdna && !w.mixed; });
        if (!p.reagent && p.hasTip && midCdna) return { text: 'Swirl the tip inside well ' + midCdna + ' to mix (keep dragging in small circles).', glow: ['[data-well="' + midCdna + '"]'] };
        if (p.reagent === 'cDNA') {
          var target = firstWhere(S.wells, function (w) { return !w.cdna; });
          return { text: 'Dispense cDNA into sample well ' + (target || '') + ' (' + c.sampleDone() + '/' + total + ' spotted).', glow: target ? ['[data-well="' + target + '"]'] : [] };
        }
        var nextWell = firstWhere(S.wells, function (w, id) { return !S.spots[id].sample && !w.cdna; });
        if (canAspirate('cDNA')) return { text: 'Aspirate Control cDNA from the green tube for sample ' + (nextWell || '') + '.', glow: ['[data-reagent="cDNA"]'] };
        return { text: 'Fresh tip for sample ' + (nextWell || '') + ' — drag the pipette to the tip box.', glow: ['.tip-box'] };
      }
      case 'dry-samples':
        return { text: 'All ' + total + ' samples spotted. Incubate the card again to dry.', glow: ['.incubator'] };
      case 'hb': {
        var needHb = firstWhere(S.spots, function (s) { return s.sample && !s.hb; });
        if (p.reagent === 'HB') return { text: 'Dispense HB onto sample spot ' + (needHb || '') + ' (' + c.hbDone() + '/' + total + '). Then aspirate again for the next.', glow: needHb ? ['[data-spot="' + needHb + '"]'] : [] };
        if (canAspirate('HB'))  return { text: 'Aspirate one 5 µL dose of Hybridisation Buffer from the violet HB tube.', glow: ['[data-reagent="HB"]'] };
        return { text: 'Fresh tip, please — hover the pipette over the tip box.', glow: ['.tip-box'] };
      }
      case 'dry-hb':
        return { text: 'HB applied. Final incubation — dry the card.', glow: ['.incubator'] };
      case 'visualize':
        return { text: 'Lights out! Drag the UV lamp across the card to reveal the fluorescent spots.', glow: ['.uv-lamp'] };
      case 'analyze':
        return { text: 'Read the colours and fill in the results table below, then check your answers.', glow: [] };
      case 'done':
        return { text: 'Analysis complete — great work, technician!', glow: [] };
    }
    return { text: '', glow: [] };
  }

  function firstWhere(bag, pred) {
    var ids = cfg.allIds();
    for (var i = 0; i < ids.length; i++) if (pred(bag[ids[i]], ids[i])) return ids[i];
    return null;
  }

  /* --------------------------------------------------------------------- */
  /*  Highlighting                                                          */
  /* --------------------------------------------------------------------- */
  function setHighlight(t) {
    clearHighlight();
    if (!t || !t.el) return;
    var ev = evaluate(t);
    t.el.classList.add(ev.ok ? 'hot-ok' : 'hot-no');
    highlighted.push(t.el);
  }
  function clearHighlight() {
    highlighted.forEach(function (el) { el.classList.remove('hot-ok', 'hot-no'); });
    highlighted = [];
  }

  // glow the *recommended* next targets (persistent pulse from the hint)
  function applyHintGlow(selectors) {
    document.querySelectorAll('.next-target').forEach(function (el) { el.classList.remove('next-target'); });
    (selectors || []).forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) { el.classList.add('next-target'); });
    });
  }

  /* --------------------------------------------------------------------- */
  /*  Refresh: recompute phase, instruction, glow, HUD                      */
  /* --------------------------------------------------------------------- */
  function refresh() {
    advance();
    var h = hint();
    Lab.ui.setInstruction(h.text);
    applyHintGlow(h.glow);
    Lab.ui.updateHud();
    if (S.phase === 'analyze' || S.phase === 'done') Lab.analysis.reveal();
  }

  /* --------------------------------------------------------------------- */
  /*  Public API                                                            */
  /* --------------------------------------------------------------------- */
  // Build a target descriptor from an element the user *clicked*.
  function buildTarget(el) {
    if (!el || !el.closest) return null;
    var spot = el.closest('[data-spot]'); if (spot) return { kind: 'spot', id: spot.dataset.spot, el: spot };
    var well = el.closest('[data-well]'); if (well) return { kind: 'well', id: well.dataset.well, el: well };
    var stn = el.closest('[data-station]');
    if (stn) {
      var s = stn.dataset.station;
      if (s === 'tube') return { kind: 'tube', reagent: stn.dataset.reagent, el: stn };
      return { kind: s, el: stn };
    }
    return null;
  }

  function centerOf(node) {
    var r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Click / keyboard activation of a target: pipette flies over, then acts.
  function clickAct(el) {
    if (S.busy || S.phase === 'intro') return;
    var t = buildTarget(el);
    if (!t) return;
    var ev = evaluate(t);
    if (!ev.ok) { if (ev.reason) Lab.ui.flash(ev.reason); return; }
    // the incubator isn't a pipette action — don't fly the pipette to it.
    if (ev.action === 'incubate') { perform(t, centerOf(t.el)); return; }
    var center = centerOf(t.el);
    st.setBusy(true);
    Lab.pipette.flyTo(center, function () {
      st.setBusy(false);
      if (ev.action === 'mix') { addMix(t.id, 1); }   // one click finishes a stir
      else { perform(t, center); }
      refresh();
    });
  }

  function start() {
    st.markDone('orient');
    st.setPhase('eb');
    refresh();
  }

  // True once demoSkip has been used this session, so a skipped run can never
  // unlock the very shortcut that produced it.
  var demoRun = false;
  var runRecorded = false;

  // UV reveal reports here when all spots have fluoresced.
  function onUvRevealed() {
    if (S.phase === 'visualize') { st.markDone('visualize'); st.setPhase('analyze'); refresh(); }
    // Reaching the reveal by hand IS doing the experiment — record it, so the
    // "skip" shortcut is available on later visits.
    if (!demoRun && !runRecorded && Lab.progress) {
      runRecorded = true;
      Lab.progress.recordRun();
    }
  }

  // Analysis reports success here.
  function onAnalysisComplete() {
    st.markDone('analyze'); st.setPhase('done'); refresh();
  }

  // Fast-forward through the wet-lab steps (teacher demo / quick preview).
  // Leaves the UV reveal + analysis interactive.
  function demoSkip() {
    demoRun = true;                 // this run must not count as "done"
    cfg.allIds().forEach(function (id) {
      var sp = S.spots[id];
      sp.eb = sp.sample = sp.hb = true;
      Lab.surfaces.coatSpot(id, 'sample', cfg.REAGENTS.MIX.fill);
    });
    ['orient', 'eb', 'dry1', 'mixSpot', 'dry2', 'hb', 'dry3'].forEach(function (k) { st.markDone(k); });
    st.setPipette({ hasTip: false, reagent: null, volume: 0, mixFrom: null });
    Lab.pipette.setTip(false);
    st.setPhase('visualize');
    Lab.stations.enterDarkroom();
    refresh();
  }

  return (Lab.engine = {
    setPipetteEl: function (el) { pipetteEl = el; },
    targetAt: targetAt,
    evaluate: evaluate,
    hoverAt: hoverAt,
    releaseAt: releaseAt,
    perform: perform,
    clickAct: clickAct,
    clearHighlight: clearHighlight,
    refresh: refresh,
    start: start,
    demoSkip: demoSkip,
    onUvRevealed: onUvRevealed,
    onAnalysisComplete: onAnalysisComplete
  });
})(window.Lab = window.Lab || {});
