/* =============================================================================
 * state.js  —  Central, observable state store, and the liquid model.
 *
 * The liquid model is deliberately real rather than scripted: a well knows its
 * VOLUME and its CONCENTRATION, and every transfer is a volumetric mix.  So
 * the dilution series is not a lookup table — it falls out of pouring 50 µL of
 * buffer into a well and then 50 µL of the well before it, which means a
 * student who mis-pipettes gets a genuinely wrong ladder rather than a
 * pretend one.
 *
 * A tiny pub/sub lets the UI react without the engine knowing about the DOM.
 *
 * Exposed as  Lab.state
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var cfg = Lab.config;
  var V = cfg.VOLUME;

  // --- tiny event emitter -------------------------------------------------
  var listeners = {};
  function on(evt, cb) { (listeners[evt] = listeners[evt] || []).push(cb); }
  function emit(evt, payload) {
    (listeners[evt] || []).forEach(function (cb) {
      try { cb(payload); } catch (e) { console.error('listener error for ' + evt, e); }
    });
  }

  // --- the state object ---------------------------------------------------
  var S = {
    module: 1,
    phase: 'intro',
    busy: false,

    // the two patient samples this group was handed (config.PATIENTS ids)
    patients: ['sue', 'wanda'],

    // fresh = tip attached and never used; lastReagent = what it last held.
    // Both exist to enforce the protocol's "REPLACE the pipette tip" rules.
    pipette: { hasTip: false, reagent: null, volume: 0, fresh: false, lastReagent: null, source: null },

    // the plastic transfer pipet used for wash buffer (steps 17 & 19)
    transfer: { loaded: false },

    strips: { A: { labeled: false }, B: { labeled: false } },
    wells: {},

    wash: { step: 0 },          // 0..4 inside a wash phase: invert, fill, invert, fill, invert

    // where the serial dilution has got to: `target` is the well being filled
    // next, `carrying` the concentration of the 50 µL currently in the tip
    serial: { target: 2, carrying: 0 },
    discarded: false,           // the 50 µL taken back out of well 12 (step 8)


    done: {},                   // checklist keys marked complete
    prepared: false,            // this plate was handed over, not run here
    overfills: 0,               // wells flooded with wash buffer (technique note)
    developed: false            // TMB has been allowed to develop
  };

  function blankWell(n) {
    return {
      n: n,
      vol: 0,                   // µL in the well
      conc: 0,                  // µg/mL of antigen in that liquid
      content: null,            // reagent id of whatever is in there now
      label: '',                // what this well IS, for Table B
      bound: 0,                 // µg/mL of antigen adsorbed to the plastic
      received: { AB1: false, AB2: false, TMB: false, STOP: false },
      primary: false,           // 1° AB still attached after washing
      secondary: false,         // 2° AB still attached after washing
      stopped: false,
      dev: 0,                   // 0..1 developed colour strength
      mixStrokes: 0             // pipetting up and down, protocol step 5
    };
  }

  function reset(keepPatients) {
    var pts = keepPatients ? S.patients.slice() : ['sue', 'wanda'];
    S.module = 1;
    S.phase = 'intro';
    S.busy = false;
    S.patients = pts;
    S.pipette = { hasTip: false, reagent: null, volume: 0, fresh: false, lastReagent: null, source: null };
    S.transfer = { loaded: false };
    S.strips = { A: { labeled: false }, B: { labeled: false } };
    S.wells = {};
    S.wash = { step: 0 };
    S.serial = { target: 2, carrying: 0 };
    S.discarded = false;
    S.done = {};
    S.prepared = false;
    S.overfills = 0;
    S.developed = false;
    cfg.allWells().forEach(function (n) { S.wells[n] = blankWell(n); });
    emit('change');
  }

  /* =======================================================================
   * The liquid model
   * ===================================================================== */

  /** Pour `vol` µL of something at `conc` µg/mL into a well. */
  function pourInto(n, vol, conc, contentId) {
    var w = S.wells[n];
    if (!w) return;
    var total = w.vol + vol;
    w.conc = total > 0 ? (w.conc * w.vol + conc * vol) / total : 0;
    w.vol = total;
    w.content = contentId || w.content;
    return w;
  }

  /** Draw `vol` µL back out of a well.  Returns what came out. */
  function drawFrom(n, vol) {
    var w = S.wells[n];
    if (!w) return { vol: 0, conc: 0 };
    var got = Math.min(vol, w.vol);
    w.vol -= got;
    if (w.vol <= 0.0001) { w.vol = 0; }
    return { vol: got, conc: w.conc, content: w.content };
  }

  /** Invert over paper towels and tap: the liquid goes, whatever has bound
      to the plastic stays.  That distinction IS the assay. */
  function emptyWell(n) {
    var w = S.wells[n];
    if (!w) return;
    w.vol = 0;
    w.conc = 0;
    w.content = null;
  }
  function emptyStrip(stripId) {
    wellsOfStrip(stripId).forEach(emptyWell);
  }

  function wellsOfStrip(stripId) {
    var s = stripId === 'A' ? cfg.STRIPS[0] : cfg.STRIPS[1];
    var out = [];
    for (var n = s.first; n <= s.last; n++) out.push(n);
    return out;
  }

  /** End of the first incubation: antigen in solution adsorbs to the well. */
  function adsorb() {
    cfg.allWells().forEach(function (n) {
      var w = S.wells[n];
      if (w.vol > 0) w.bound = w.conc;
    });
  }

  /** A wash finishing is when unbound reagent is actually lost.  Primary
      antibody survives only where antigen is stuck down; secondary survives
      only where primary did. */
  function settleBinding() {
    cfg.allWells().forEach(function (n) {
      var w = S.wells[n];
      if (w.received.AB1 && w.bound > 0) w.primary = true;
      if (w.received.AB2 && w.primary) w.secondary = true;
    });
  }

  /** HRP turns TMB blue, in proportion to how much antigen was captured. */
  function develop() {
    S.developed = true;
    cfg.allWells().forEach(function (n) {
      var w = S.wells[n];
      w.dev = (w.received.TMB && w.primary && w.secondary) ? cfg.signalOf(w.bound) : 0;
    });
  }

  /* What colour is this well right now, and how strongly?
     Returns { key, alpha } where key indexes cfg.SIGNAL or is a reagent id. */
  function wellPaint(n) {
    var w = S.wells[n];
    if (!w) return { key: 'blank', alpha: 0 };
    if (w.stopped)   return { key: 'stopped', alpha: 0.10 + 0.88 * w.dev };
    if (S.developed && w.received.TMB) return { key: 'tmb', alpha: 0.08 + 0.88 * w.dev };
    if (w.vol <= 0)  return { key: 'blank', alpha: 0 };
    if (w.content && cfg.REAGENTS[w.content]) return { key: w.content, alpha: 0.72 };
    return { key: 'blank', alpha: 0.35 };
  }

  /* =======================================================================
   * Derived counts — these drive phase completion and the progress bar
   * ===================================================================== */
  function countWells(pred) {
    var n = 0;
    cfg.allWells().forEach(function (i) { if (pred(S.wells[i], i)) n++; });
    return n;
  }

  var counts = {
    // wells 2–12 that have had their 50 µL of dilution buffer (step 2)
    buffered: function () {
      return countWells(function (w, i) { return i >= 2 && i <= 12 && w.vol > 0; });
    },
    // wells that have received one of the four "add to every well" reagents
    filled:   function (id) { return countWells(function (w) { return w.received[id]; }); },
    // strip-B wells that have had their sample loaded (steps 11–14)
    loaded:   function () { return countWells(function (w, i) { return i >= 13 && w.vol > 0; }); },
    total:    function () { return cfg.WELLS_PER_STRIP * 2; }
  };

  /* =======================================================================
   * Mutators — each emits so the UI refreshes
   * ===================================================================== */
  function setPhase(p)   { S.phase = p; emit('phase', p); emit('change'); }
  function setModule(m)  { S.module = m; emit('module', m); emit('change'); }
  function setBusy(b)    { S.busy = b; emit('change'); }
  function markDone(key) { S.done[key] = true; emit('checklist', key); emit('change'); }

  function setPipette(patch) {
    for (var k in patch) if (patch.hasOwnProperty(k)) S.pipette[k] = patch[k];
    emit('pipette', S.pipette); emit('change');
  }

  function setPatients(ids) {
    S.patients = ids.slice(0, 2);
    emit('patients', S.patients); emit('change');
  }

  /** The patient (or control) a strip-B well holds, as a display name. */
  function sampleNameFor(well) {
    var block = cfg.blockForWell(well);
    if (!block) return '';
    if (block.key === 'POS') return 'Positive Control';
    if (block.key === 'NEG') return 'Negative Control';
    var p = cfg.patientById(S.patients[block.key === 'P1' ? 0 : 1]);
    return p ? p.name : block.short;
  }

  /** The concentration a strip-B well SHOULD read — the answer key. */
  function expectedFor(well) {
    var block = cfg.blockForWell(well);
    if (!block) return cfg.standardConc(well);
    if (block.key === 'POS') return cfg.CONTROL_CONC.POS;
    if (block.key === 'NEG') return cfg.CONTROL_CONC.NEG;
    var p = cfg.patientById(S.patients[block.key === 'P1' ? 0 : 1]);
    return p ? p.conc : 0;
  }

  /** The concentration that will be loaded into a strip-B well. */
  function sampleConc(blockKey) {
    if (blockKey === 'POS') return cfg.CONTROL_CONC.POS;
    if (blockKey === 'NEG') return cfg.CONTROL_CONC.NEG;
    var p = cfg.patientById(S.patients[blockKey === 'P1' ? 0 : 1]);
    return p ? p.conc : 0;
  }

  Lab.state = {
    S: S,
    on: on,
    emit: emit,
    reset: reset,
    counts: counts,
    countWells: countWells,
    wellsOfStrip: wellsOfStrip,

    pourInto: pourInto,
    drawFrom: drawFrom,
    emptyWell: emptyWell,
    emptyStrip: emptyStrip,
    adsorb: adsorb,
    settleBinding: settleBinding,
    develop: develop,
    wellPaint: wellPaint,

    setPhase: setPhase,
    setModule: setModule,
    setBusy: setBusy,
    markDone: markDone,
    setPipette: setPipette,
    setPatients: setPatients,

    sampleNameFor: sampleNameFor,
    sampleConc: sampleConc,
    expectedFor: expectedFor
  };
})(window.Lab = window.Lab || {});
