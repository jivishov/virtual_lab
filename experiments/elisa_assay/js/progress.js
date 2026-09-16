/* =============================================================================
 * progress.js  —  Remembers, in the browser, what this student has done.
 *
 * WHAT IT IS NOT: a gate.  The two modules of this experiment are separate
 * pieces of work — running the assay, and reading it — and a student who is
 * only here to practise the analysis should be able to open Module 2 and get a
 * finished plate.  So nothing here locks anything.  It exists so that
 *
 *   - Module 2 can offer YOUR strips if you ran them, and a prepared plate if
 *     you did not;
 *   - the two patient samples you were handed survive a reload;
 *   - the bench can say how many runs you have taken all the way through.
 *
 * Storage is guarded throughout: Chrome can throw on localStorage at a file://
 * origin, so every access is wrapped and degrades to session-only memory
 * rather than breaking the page.
 *
 * Exposed as  Lab.progress
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var KEY = 'elisa.progress';
  var mem = null;              // fallback when storage is unavailable
  var listeners = [];

  function read() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = mem; }
    if (!raw) raw = mem;
    if (!raw) return { runs: 0 };
    try {
      var v = JSON.parse(raw);
      return (v && typeof v === 'object') ? v : { runs: 0 };
    } catch (e) { return { runs: 0 }; }
  }

  function write(v) {
    var raw = JSON.stringify(v);
    mem = raw;
    try { localStorage.setItem(KEY, raw); } catch (e) { /* session-only */ }
    notify();
  }

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (e) { console.error('progress listener', e); }
    }
  }

  function runs() { return read().runs || 0; }
  function lastAt() { return read().at || null; }

  /** The two patient samples this group was handed last time. */
  function patients() {
    var v = read();
    return (v.patients && v.patients.length === 2) ? v.patients : null;
  }

  function rememberPatients(ids) {
    var v = read();
    v.patients = ids.slice(0, 2);
    write(v);
  }

  /** Called when a run reaches the end of Module 1 by hand. */
  function recordRun(ids) {
    var v = read();
    write({
      runs: (v.runs || 0) + 1,
      at: new Date().toISOString(),
      patients: (ids && ids.slice(0, 2)) || v.patients || null
    });
  }

  function clear() {
    mem = null;
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing to do */ }
    notify();
  }

  function onChange(fn) { listeners.push(fn); }

  Lab.progress = {
    runs: runs,
    lastAt: lastAt,
    patients: patients,
    rememberPatients: rememberPatients,
    recordRun: recordRun,
    clear: clear,
    onChange: onChange
  };
})(window.Lab = window.Lab || {});
