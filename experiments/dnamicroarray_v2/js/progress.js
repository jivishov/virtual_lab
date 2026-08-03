/* =============================================================================
 * progress.js  —  Remembers, in the browser, whether this student has actually
 * completed a run.
 *
 * WHY: "Skip to UV & analysis" jumps straight to the interesting part.  Handed
 * out unconditionally it lets a student bypass the entire bench procedure —
 * which is the lesson.  So the shortcut is earned: it unlocks only after one
 * genuine run has been carried through to the UV reveal.
 *
 * A demo run never counts (see engine.demoSkip), otherwise the shortcut would
 * unlock itself the first time it was used.
 *
 * Storage is guarded exactly like theme.js: Chrome can throw on localStorage
 * at a file:// origin, so every access is wrapped and degrades to session-only
 * memory rather than breaking the page.
 *
 * Exposed as  Lab.progress
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var KEY = 'lab.progress';
  var mem = null;              // fallback when storage is unavailable
  var listeners = [];

  function read() {
    // teacher / preview override, same spirit as ?theme= — lets staff reach the
    // shortcut on a fresh machine without grinding through 36 spots first
    if (/[?#&]unlock=1/.test(location.href)) return { runs: 1, unlocked: true };
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

  /** Has a full, non-demo run been completed at least once? */
  function unlocked() {
    var v = read();
    return !!(v.unlocked || (v.runs > 0));
  }

  function runs() { return read().runs || 0; }
  function lastAt() { return read().at || null; }

  /** Called by the engine when a genuine run reaches the UV reveal. */
  function recordRun() {
    var v = read();
    write({ runs: (v.runs || 0) + 1, at: new Date().toISOString() });
  }

  function clear() {
    mem = null;
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing to do */ }
    notify();
  }

  function onChange(fn) { listeners.push(fn); }

  Lab.progress = {
    unlocked: unlocked,
    runs: runs,
    lastAt: lastAt,
    recordRun: recordRun,
    clear: clear,
    onChange: onChange
  };
})(window.Lab = window.Lab || {});
