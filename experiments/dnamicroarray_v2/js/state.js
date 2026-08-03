/* =============================================================================
 * state.js  —  Central, observable state store.
 *
 * All mutable simulation state lives in one place.  A tiny pub/sub lets the UI
 * (instructions, checklist, HUD) react to changes without the engine knowing
 * anything about the DOM.
 *
 * Exposed as  Lab.state
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var cfg = Lab.config;

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
    phase: 'intro',
    // fresh = tip attached and untouched; lastReagent = what it last held
    // (both used to enforce cross-contamination rules).
    pipette: { hasTip: false, reagent: null, volume: 0, mixFrom: null, fresh: false, lastReagent: null },
    uvOn: false,
    busy: false,
    spots: {},   // id -> { eb, sample, hb, color, revealed }
    wells: {},   // id -> { sealed, cdna, mixProgress, mixed, aspirated }
    done: {}     // checklist keys marked complete
  };

  function reset() {
    S.phase = 'intro';
    S.pipette = { hasTip: false, reagent: null, volume: 0, mixFrom: null, fresh: false, lastReagent: null };
    S.uvOn = false;
    S.busy = false;
    S.spots = {};
    S.wells = {};
    S.done = {};
    cfg.allIds().forEach(function (id) {
      S.spots[id] = { eb: false, sample: false, hb: false, color: cfg.expectedColor(id), revealed: false };
      S.wells[id] = { sealed: true, cdna: false, mixProgress: 0, mixed: false, aspirated: false };
    });
  }

  // --- derived counts (drive phase completion & the HUD) ------------------
  function count(pred, bag) {
    var n = 0, obj = S[bag];
    for (var k in obj) if (obj.hasOwnProperty(k) && pred(obj[k], k)) n++;
    return n;
  }
  var counts = {
    ebDone:      function () { return count(function (s) { return s.eb; }, 'spots'); },
    sampleDone:  function () { return count(function (s) { return s.sample; }, 'spots'); },
    hbDone:      function () { return count(function (s) { return s.hb; }, 'spots'); },
    total:       function () { return cfg.allIds().length; }
  };

  // --- mutators (each emits 'change' so the UI refreshes) -----------------
  function setPhase(p)   { S.phase = p; emit('phase', p); emit('change'); }
  function setBusy(b)    { S.busy = b; emit('change'); }
  function markDone(key) { S.done[key] = true; emit('checklist', key); emit('change'); }

  function setPipette(patch) {
    for (var k in patch) if (patch.hasOwnProperty(k)) S.pipette[k] = patch[k];
    emit('pipette', S.pipette); emit('change');
  }

  Lab.state = {
    S: S,
    on: on,
    emit: emit,
    reset: reset,
    counts: counts,
    setPhase: setPhase,
    setBusy: setBusy,
    markDone: markDone,
    setPipette: setPipette
  };
})(window.Lab = window.Lab || {});
