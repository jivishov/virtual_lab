/* =============================================================================
 * engine.js  —  Procedure state machine + interaction resolver.
 *
 * The engine is the single authority on "given the current step, the tool in
 * my hand, and what that tool is holding, is THIS action on THIS target
 * allowed, and what does it do?"  It never touches SVG directly: it asks
 * Lab.pipette / Lab.surfaces / Lab.stations to play the visuals, then mutates
 * Lab.state.
 *
 * The protocol's step numbers are in the comments throughout, because the
 * rules here are not design decisions — they are the printed procedure.
 *
 * Exposed as  Lab.engine
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var cfg = Lab.config;
  var st = Lab.state;
  var S = st.S;
  var V = cfg.VOLUME;

  var toolEls = {};          // tool id -> element, so hit-testing can ignore them
  var highlighted = [];

  function registerTool(id, el) { toolEls[id] = el; }

  /* Which instrument this step is done with.  A step done with the wrong tool
     is not a wrong ANSWER, it is the wrong tool — so the engine says so. */
  function toolFor(phase) {
    if (phase === 'label') return 'marker';
    if (isWash(phase) && isFillStep()) return 'transfer';
    return 'pipette';
  }
  function isWash(p) { return p === 'wash1' || p === 'wash2' || p === 'wash3'; }
  function isFillStep() { return S.wash.step === 1 || S.wash.step === 3; }
  function isIncubation(p) { return !!cfg.INCUBATIONS[p]; }

  /* --------------------------------------------------------------------- */
  /*  Hit-testing: what is under a screen point?                           */
  /* --------------------------------------------------------------------- */
  function probe(x, y) {
    // Read the hit stack without changing pointer-events on three tools for
    // every camera sample. Those writes forced repeated style/layout work.
    if (document.elementsFromPoint) {
      var stack = document.elementsFromPoint(x, y);
      for (var i = 0; i < stack.length; i++) {
        var isTool = false;
        for (var id in toolEls) {
          if (toolEls[id] && toolEls[id].contains(stack[i])) { isTool = true; break; }
        }
        if (!isTool) return stack[i];
      }
      return null;
    }
    var saved = [];
    for (var k in toolEls) {
      if (toolEls[k]) { saved.push([toolEls[k], toolEls[k].style.pointerEvents]); toolEls[k].style.pointerEvents = 'none'; }
    }
    var el = document.elementFromPoint(x, y);
    saved.forEach(function (p) { p[0].style.pointerEvents = p[1] || ''; });
    return el;
  }

  function describe(el) {
    if (!el || !el.closest) return null;
    var well = el.closest('[data-well]');
    if (well) return { kind: 'well', n: parseInt(well.dataset.well, 10), strip: well.dataset.strip, el: well };
    var stn = el.closest('[data-station]');
    if (stn) {
      var s = stn.dataset.station;
      if (s === 'tube') return { kind: 'tube', reagent: stn.dataset.reagent, el: stn };
      if (s === 'sample') return { kind: 'sample', sample: stn.dataset.sample, el: stn };
      return { kind: s, el: stn };
    }
    var strip = el.closest('[data-strip]');
    if (strip) return { kind: 'strip', strip: strip.dataset.strip, el: strip };
    return null;
  }

  function targetAt(point) { return describe(probe(point.x, point.y)); }

  /* --------------------------------------------------------------------- */
  /*  Tip hygiene                                                          */
  /*                                                                       */
  /*  "In addition, replacing the tip between components and using care to  */
  /*  prevent overflowing the wells during the washes will help to prevent  */
  /*  cross-contamination."  —  Experiment Overview                        */
  /* --------------------------------------------------------------------- */
  // The four sample loads each demand a brand-new tip (steps 11–14).  The
  // bulk reagents may be re-drawn on the tip that is already holding them.
  var STRICT_FRESH = { POS: 1, NEG: 1, P1: 1, P2: 1, AB1: 1, AB2: 1, TMB: 1, STOP: 1, AG: 1, DIL: 1 };

  function canAspirate(reagent) {
    var p = S.pipette;
    if (!p.hasTip || p.volume > 0) return false;
    if (p.fresh) return true;
    if (STRICT_FRESH[reagent]) return p.lastReagent === reagent;   // a refill is fine
    return true;
  }

  /* The serial dilution runs on ONE tip from well 1 to well 12 (steps 4–8),
     so the rule there is different: the tip may already have held antigen or
     a dilution of it, and nothing else. */
  function canCarrySerial() {
    var p = S.pipette;
    if (!p.hasTip) return false;
    return p.fresh || p.lastReagent === 'AG' || p.lastReagent === 'MIX';
  }

  /* --------------------------------------------------------------------- */
  /*  Where are we inside the current step?                                */
  /* --------------------------------------------------------------------- */
  function firstWell(from, to, pred) {
    for (var n = from; n <= to; n++) if (pred(S.wells[n], n)) return n;
    return null;
  }

  /** The sample block being loaded right now (steps 11–14, in order). */
  function currentBlock() {
    for (var i = 0; i < cfg.SAMPLE_BLOCKS.length; i++) {
      var b = cfg.SAMPLE_BLOCKS[i];
      for (var j = 0; j < b.wells.length; j++) {
        if (S.wells[b.wells[j]].vol <= 0) return b;
      }
    }
    return null;
  }

  /** The sample tube a block draws from. */
  function tubeIdForBlock(key) {
    if (key === 'POS' || key === 'NEG') return key;
    return S.patients[key === 'P1' ? 0 : 1];
  }

  /* --------------------------------------------------------------------- */
  /*  Validation                                                           */
  /* --------------------------------------------------------------------- */
  function evaluate(t, tool) {
    if (!t) return { ok: false };
    tool = tool || toolFor(S.phase);
    var p = S.pipette;
    var phase = S.phase;

    if (phase === 'intro' || phase === 'analysis' || phase === 'done') return { ok: false };

    /* ---- the marker: step 1 ------------------------------------------- */
    if (tool === 'marker') {
      if (phase !== 'label') return { ok: false, reason: 'The strips are already labelled.' };
      var sid = t.strip || (t.kind === 'well' ? t.strip : null);
      if (!sid) return { ok: false, reason: 'Run the marker along a strip to number it.' };
      if (S.strips[sid].labeled) return { ok: false, reason: 'Strip ' + sid + ' is already numbered.' };
      return { ok: true, action: 'label', strip: sid };
    }

    /* ---- the transfer pipet: steps 17 and 19 --------------------------- */
    if (tool === 'transfer') {
      if (!isWash(phase)) return { ok: false, reason: 'Wash buffer is only used at the wash steps.' };
      if (!isFillStep()) return { ok: false, reason: 'Invert the strips over the towels first.' };
      if (t.kind === 'wash') {
        return S.transfer.loaded
          ? { ok: false, reason: 'The transfer pipet is already full.' }
          : { ok: true, action: 'load-wash' };
      }
      if (t.kind === 'well') {
        if (!S.transfer.loaded) return { ok: false, reason: 'Fill the transfer pipet from the wash bottle.' };
        var w = S.wells[t.n];
        if (w.vol >= V.washFill) return { ok: true, action: 'overfill' };
        return { ok: true, action: 'wash-fill' };
      }
      return { ok: false };
    }

    /* ---- the micropipette --------------------------------------------- */
    switch (t.kind) {
      /* "REPLACE the pipette tip" is two movements at the bench, not one: the
         used tip is ejected into the waste and THEN a clean one is picked up.
         Letting a student take a fresh tip straight from the box would have
         quietly binned whatever the old tip was still holding, and would have
         taught the cheaper half of the habit the protocol is drilling. */
      case 'tipbox':
        if (isWash(phase)) return { ok: false, reason: 'The washes are done with the transfer pipet.' };
        if (p.volume > 0) {
          return { ok: false, reason: 'The tip still holds ' + label(p.reagent) +
            ' — empty it into the waste before you change tips.' };
        }
        if (p.hasTip) {
          return { ok: false, reason: 'Eject the used tip into the waste first. REPLACING a tip ' +
            'means the old one comes off — that is what stops one reagent reaching the next.' };
        }
        return { ok: true, action: 'retip' };

      case 'waste':
        if (p.volume > 0) return { ok: true, action: 'dump' };
        return p.hasTip ? { ok: true, action: 'discard-tip' }
                        : { ok: false, reason: 'Nothing to discard.' };

      case 'timer':
        if (!isIncubation(phase)) return { ok: false, reason: 'Nothing is incubating yet.' };
        return { ok: true, action: 'incubate' };

      case 'towels':
        if (!isWash(phase)) return { ok: false, reason: 'The strips only go on the towels at a wash step.' };
        if (isFillStep()) return { ok: false, reason: 'Fill every well with wash buffer first.' };
        return { ok: true, action: 'invert' };

      case 'wash':
        return { ok: false, reason: 'Wash buffer goes in with the transfer pipet, not the micropipette.' };

      case 'tube': {
        var need = cfg.PHASE_REAGENT[phase];
        if (!p.hasTip) return { ok: false, reason: 'Attach a fresh tip first.' };
        if (p.volume > 0) return { ok: false, reason: 'The tip is still holding ' + label(p.reagent) + '.' };
        if (!need) return { ok: false, reason: 'No reagent is drawn at this step.' };
        if (t.reagent !== need) {
          return { ok: false, reason: 'Wrong tube — this step needs ' + cfg.REAGENTS[need].name + '.' };
        }
        if (!canAspirate(need)) {
          return { ok: false, reason: 'Fit a FRESH tip before drawing ' + cfg.REAGENTS[need].name +
            ' — a used tip would carry contamination into the reagent.' };
        }
        return { ok: true, action: 'aspirate', reagent: need };
      }

      case 'sample': {
        if (phase !== 'samples') return { ok: false, reason: 'Samples are loaded at steps 11–14.' };
        var blk = currentBlock();
        if (!blk) return { ok: false, reason: 'Every sample is already loaded.' };
        if (!p.hasTip) return { ok: false, reason: 'Attach a fresh tip first.' };
        if (p.volume > 0) return { ok: false, reason: 'The tip is still holding a sample — use it or discard it.' };
        // one draw per well, so the SAME tip comes back to the same tube twice
        // more within a block; it is moving between samples that demands a new one
        if (!p.fresh && p.lastReagent !== blk.key) {
          return { ok: false, reason: 'REPLACE the pipette tip between samples (step 11).' };
        }
        var wantTube = tubeIdForBlock(blk.key);
        if (t.sample !== wantTube) {
          return { ok: false, reason: 'Next up is the ' + blk.label + ' — wells ' +
            blk.wells[0] + '–' + blk.wells[2] + '.' };
        }
        return { ok: true, action: 'aspirate-sample', block: blk };
      }

      case 'well':
        return evaluateWell(t);
    }
    return { ok: false };
  }

  function label(id) { return (cfg.REAGENTS[id] && cfg.REAGENTS[id].name) || 'liquid'; }

  function evaluateWell(t) {
    var p = S.pipette, n = t.n, w = S.wells[n], phase = S.phase;

    switch (phase) {
      /* step 2 — 50 µL of dilution buffer into wells 2–12 */
      case 'buffer':
        if (p.reagent !== 'DIL') return { ok: false, reason: 'Draw Dilution Buffer first.' };
        if (n === 1) return { ok: false, reason: 'Well 1 takes antigen, not buffer (step 3).' };
        if (n > 12) return { ok: false, reason: 'Buffer goes into wells 2–12 of the first strip.' };
        if (w.vol > 0) return { ok: false, reason: 'Well ' + n + ' already has its buffer.' };
        if (p.volume < V.dose) return { ok: false, reason: 'Tip empty — draw more buffer.' };
        return { ok: true, action: 'dispense', reagent: 'DIL' };

      /* step 3 — 100 µL of antigen into well 1, as two 50 µL doses */
      case 'antigen':
        if (p.reagent !== 'AG') return { ok: false, reason: 'Draw Antigen first.' };
        if (n !== 1) return { ok: false, reason: 'The antigen goes into well 1 only.' };
        if (w.vol >= 100) return { ok: false, reason: 'Well 1 already holds 100 µL.' };
        if (p.volume < V.dose) return { ok: false, reason: 'Tip empty — draw more antigen.' };
        return { ok: true, action: 'dispense', reagent: 'AG' };

      /* steps 4–7 — draw 50 µL, move it one well along, mix five times */
      case 'serial': {
        var target = S.serial.target;
        if (n > 12) return { ok: false, reason: 'The dilution series is the first strip only.' };
        if (p.volume > 0) {
          if (n !== target) return { ok: false, reason: 'That 50 µL belongs in well ' + target + '.' };
          return { ok: true, action: 'serial-dispense' };
        }
        // the well just filled still owes its five mixing strokes (step 5)
        if (n === target && w.vol > 0 && w.mixStrokes < 5) {
          return { ok: true, action: 'serial-mix' };
        }
        if (n === target - 1) {
          if (!canCarrySerial()) {
            return { ok: false, reason: 'Use the SAME tip all the way down the series (step 6).' };
          }
          if (n >= 2 && S.wells[n].mixStrokes < 5) {
            return { ok: false, reason: 'Mix well ' + n + ' fully before moving 50 µL on.' };
          }
          if (w.vol < V.dose) return { ok: false, reason: 'Well ' + n + ' has nothing left to transfer.' };
          return { ok: true, action: 'serial-draw' };
        }
        return { ok: false, reason: 'Next: 50 µL from well ' + (target - 1) + ' into well ' + target + '.' };
      }

      /* step 8 — take 50 µL back out of well 12 and throw it away */
      case 'discard':
        if (p.volume > 0) return { ok: false, reason: 'Empty the tip into the waste first.' };
        if (n !== 12) return { ok: false, reason: 'Only well 12 is over-volume.' };
        if (S.discarded) return { ok: false, reason: 'Well 12 is already down to 50 µL.' };
        if (!S.pipette.hasTip) return { ok: false, reason: 'Attach a tip first.' };
        return { ok: true, action: 'discard-draw' };

      /* steps 11–14 — three wells per sample */
      case 'samples': {
        if (n <= 12) return { ok: false, reason: 'Samples go in the second strip, wells 13–24.' };
        if (p.reagent !== 'SAMPLE') return { ok: false, reason: 'Draw a sample from its tube first.' };
        var blk = cfg.blockForWell(n);
        if (!blk || blk.key !== p.source) {
          return { ok: false, reason: 'That sample belongs in wells ' + blockWells(p.source) + '.' };
        }
        if (w.vol > 0) return { ok: false, reason: 'Well ' + n + ' already has its 50 µL.' };
        if (p.volume < V.dose) return { ok: false, reason: 'Tip empty — draw more of this sample.' };
        return { ok: true, action: 'dispense-sample' };
      }

      /* steps 20, 23, 26, 28 — 50 µL into every one of the 24 wells */
      case 'primary': case 'secondary': case 'substrate': case 'stop': {
        var need = cfg.PHASE_REAGENT[phase];
        if (p.reagent !== need) return { ok: false, reason: 'Draw ' + cfg.REAGENTS[need].name + ' first.' };
        if (w.received[need]) return { ok: false, reason: 'Well ' + n + ' already has it.' };
        if (p.volume < V.dose) return { ok: false, reason: 'Tip empty — draw more.' };
        return { ok: true, action: 'dispense', reagent: need };
      }

      /* the wash steps are done with the transfer pipet, not this one */
      case 'wash1': case 'wash2': case 'wash3':
        return { ok: false, reason: isFillStep()
          ? 'Wash buffer goes in with the transfer pipet.'
          : 'Invert the strips over the paper towels.' };
    }
    return { ok: false };
  }

  function blockWells(key) {
    for (var i = 0; i < cfg.SAMPLE_BLOCKS.length; i++) {
      if (cfg.SAMPLE_BLOCKS[i].key === key) {
        var b = cfg.SAMPLE_BLOCKS[i];
        return b.wells[0] + '–' + b.wells[2];
      }
    }
    return '13–24';
  }

  /* --------------------------------------------------------------------- */
  /*  Hover-to-act                                                          */
  /*                                                                        */
  /*  Dwelling a tool's working point over a legal target performs the       */
  /*  action, so a whole strip can be filled by drawing the tool across it   */
  /*  rather than by twenty-four separate clicks.  A click still works.      */
  /* --------------------------------------------------------------------- */
  var hover = { pendingEl: null, actedEl: null, timer: null };
  var DWELL = { pipette: 300, transfer: 170, marker: 260 };
  var DISCRETE = {
    retip: 1, 'discard-tip': 1, dump: 1, aspirate: 1, 'aspirate-sample': 1,
    dispense: 1, 'dispense-sample': 1, 'serial-draw': 1, 'serial-dispense': 1,
    'serial-mix': 1, 'discard-draw': 1, incubate: 1, invert: 1,
    'load-wash': 1, 'wash-fill': 1, overfill: 1, label: 1
  };

  function cancelDwell() {
    if (hover.timer) { clearTimeout(hover.timer); hover.timer = null; }
    if (hover.pendingEl && hover.pendingEl.classList) hover.pendingEl.classList.remove('dwelling');
    hover.pendingEl = null;
  }

  function hoverAt(point, tool) {
    if (S.busy || S.phase === 'intro' || S.phase === 'analysis') return;
    var t = targetAt(point);
    setHighlight(t, tool);

    // re-arm as soon as the tool leaves whatever it last acted on
    if (!t || (hover.actedEl && (!t.el || t.el !== hover.actedEl))) hover.actedEl = null;
    if (!t) { cancelDwell(); return; }

    var ev = evaluate(t, tool);
    // mixing is the one repeated action: five strokes into the same well, so
    // it must be allowed to fire again without the tip leaving
    var repeatable = ev.ok && ev.action === 'serial-mix';
    if (ev.ok && DISCRETE[ev.action]) {
      if (!repeatable && t.el === hover.actedEl) return;
      if (hover.pendingEl === t.el && hover.timer) return;
      cancelDwell();
      hover.pendingEl = t.el;
      if (t.el.classList) t.el.classList.add('dwelling');
      hover.timer = setTimeout(function () {
        hover.timer = null;
        if (hover.pendingEl && hover.pendingEl.classList) hover.pendingEl.classList.remove('dwelling');
        hover.pendingEl = null;
        var again = evaluate(t, tool);
        if (again.ok) { perform(t, again, point); hover.actedEl = repeatable ? null : t.el; }
      }, DWELL[tool] || 300);
      return;
    }
    cancelDwell();
  }

  function releaseAt(point, tool) {
    cancelDwell();
    if (S.busy || S.phase === 'intro' || S.phase === 'analysis') { hover.actedEl = null; return; }
    var t = targetAt(point);
    clearHighlight();
    if (t && !(hover.actedEl && t.el === hover.actedEl)) {
      var ev = evaluate(t, tool);
      if (ev.ok) perform(t, ev, point);
    }
    hover.actedEl = null;
    refresh();
  }

  /* Aim a tool without arming the dwell.

     The camera path (js/handcontrol.js) has no equivalent of "the pointer
     came to rest": a hand held in the air is never still, and a hand that
     pauses over a well is usually a student looking at the bench rather than
     one asking for 50 µL.  So the hand only ever AIMS — it highlights what is
     under the working point and says whether that would be legal — and the
     THUMB commits, exactly as the thumb commits on the real instrument.

     Returns the target so the caller can report the refusal in its own HUD
     instead of firing a toast at every frame. */
  function aimAt(point, tool) {
    if (S.busy || S.phase === 'intro' || S.phase === 'analysis') { clearHighlight(); return null; }
    var t = targetAt(point);
    setHighlight(t, tool);
    return t;
  }

  /* --------------------------------------------------------------------- */
  /*  Perform                                                               */
  /* --------------------------------------------------------------------- */
  function perform(t, ev, point) {
    if (!ev) ev = evaluate(t);
    if (!ev.ok) { if (ev.reason) Lab.ui.flash(ev.reason); return; }
    var p = S.pipette;

    switch (ev.action) {

      case 'label':
        st.setBusy(true);
        Lab.surfaces.labelStrip(ev.strip, function () { st.setBusy(false); refresh(); });
        break;

      case 'retip':
        Lab.pipette.setTip(true);
        st.setPipette({ hasTip: true, reagent: null, volume: 0, fresh: true, lastReagent: null, source: null });
        break;

      case 'discard-tip':
        Lab.pipette.setTip(false);
        st.setPipette({ hasTip: false, reagent: null, volume: 0, fresh: false, lastReagent: null, source: null });
        break;

      case 'dump':
        Lab.pipette.dispense(t.el, paintOf(p.reagent));
        Lab.pipette.setLiquid(null, 0);
        st.setPipette({ reagent: null, volume: 0, source: null });
        if (S.phase === 'discard') S.discarded = true;
        break;

      case 'aspirate': {
        var vol = loadFor(ev.reagent);
        st.setBusy(true);
        Lab.pipette.aspirate(ev.reagent, vol, function () {
          st.setPipette({ reagent: ev.reagent, volume: vol, fresh: false, lastReagent: ev.reagent, source: null });
          st.setBusy(false);
          refresh();
        });
        break;
      }

      case 'aspirate-sample': {
        var blk = ev.block;
        var vol = V.dose;                         // one well's worth, one draw
        st.setBusy(true);
        Lab.pipette.aspirate(blk.key, vol, function () {
          st.setPipette({ reagent: 'SAMPLE', volume: vol, fresh: false,
                          lastReagent: blk.key, source: blk.key });
          st.setBusy(false);
          refresh();
        });
        break;
      }

      case 'dispense': {
        var rid = ev.reagent;
        p.volume -= V.dose;
        Lab.pipette.dispense(t.el, paintOf(rid));
        st.pourInto(t.n, V.dose, rid === 'AG' ? cfg.STOCK : 0, rid);
        if (S.wells[t.n].received.hasOwnProperty(rid)) S.wells[t.n].received[rid] = true;
        if (rid === 'STOP') { S.wells[t.n].stopped = true; Lab.surfaces.flipToStopped(t.n); }
        else Lab.surfaces.dispenseInto(t.n);
        drainTip();
        break;
      }

      case 'dispense-sample': {
        p.volume -= V.dose;
        Lab.pipette.dispense(t.el, paintOf('POS'));
        st.pourInto(t.n, V.dose, st.sampleConc(p.source), p.source);
        S.wells[t.n].label = st.sampleNameFor(t.n);
        Lab.surfaces.dispenseInto(t.n);
        drainTip();
        break;
      }

      case 'serial-draw': {
        var got = st.drawFrom(t.n, V.dose);
        st.setPipette({ reagent: 'MIX', volume: got.vol, fresh: false, lastReagent: 'MIX', source: t.n });
        Lab.pipette.setLiquid('MIX', got.vol);
        Lab.pipette.plungerPulse();
        Lab.surfaces.drawWell(t.n, true);
        S.serial.carrying = got.conc;
        break;
      }

      case 'serial-dispense': {
        Lab.pipette.dispense(t.el, paintOf('AG'));
        st.pourInto(t.n, p.volume, S.serial.carrying || 0, 'MIX');
        Lab.surfaces.dispenseInto(t.n);
        st.setPipette({ reagent: null, volume: 0, source: null });
        Lab.pipette.setLiquid(null, 0);
        break;
      }

      case 'serial-mix': {
        var w = S.wells[t.n];
        w.mixStrokes = Math.min(5, w.mixStrokes + 1);
        Lab.pipette.plungerPulse();
        Lab.surfaces.mixPulse(t.n);
        if (w.mixStrokes >= 5) {
          S.serial.target = Math.min(13, t.n + 1);
          Lab.ui.flash('Well ' + t.n + ' mixed — ' + cfg.fmtConc(w.conc) + ' µg/mL.');
        }
        st.emit('change');
        break;
      }

      case 'discard-draw': {
        var out = st.drawFrom(12, V.dose);
        st.setPipette({ reagent: 'MIX', volume: out.vol, fresh: false, lastReagent: 'MIX', source: 12 });
        Lab.pipette.setLiquid('MIX', out.vol);
        Lab.pipette.plungerPulse();
        Lab.surfaces.drawWell(12, true);
        break;
      }

      case 'load-wash':
        S.transfer.loaded = true;
        Lab.stations.setTransferLoad(0.9);
        st.emit('change');
        break;

      case 'wash-fill': {
        Lab.stations.squeeze();
        var wf = S.wells[t.n];
        st.pourInto(t.n, V.washFill - wf.vol, 0, 'WASH');
        Lab.surfaces.dispenseInto(t.n);
        // the pipet is a bulb, not a reservoir: it holds about six wells
        washUsed++;
        if (washUsed >= 6) { washUsed = 0; S.transfer.loaded = false; Lab.stations.setTransferLoad(0); }
        else Lab.stations.setTransferLoad(0.9 - washUsed * 0.14);
        // once every well on both strips is full, this half of the wash is
        // done and the strips go back over the towels
        if (every(1, 24, function (w) { return w.vol >= V.washFill; })) S.wash.step++;
        st.emit('change');
        break;
      }

      case 'overfill': {
        // "being careful not to overfill … avoid spilling buffer into
        // neighbouring wells."  It is allowed to happen, and it is noted.
        S.overfills++;
        Lab.surfaces.spill(t.n);
        Lab.ui.flash('Careful — well ' + t.n + ' overflowed into its neighbours. ' +
          'That is how cross-contamination gets into a plate.');
        st.emit('change');
        break;
      }

      case 'invert':
        runInvert();
        break;

      case 'incubate':
        runIncubation();
        break;
    }
    refresh();
  }

  var washUsed = 0;

  /* One draw, one well.  The pipette is set to 50 µL and that is what it
     moves: the student charges it again for every single well, which is both
     what the instrument does and what makes the count of wells felt rather
     than read.  Well 1 is the only well that takes 100 µL, and the protocol
     says how — "You can pipette 50 µL into the well twice". */
  function loadFor() { return V.dose; }

  function paintOf(id) {
    if (id === 'SAMPLE' || !cfg.REAGENTS[id]) id = 'POS';
    return (Lab.theme && Lab.theme.sci) ? Lab.theme.sci(id, 'fill') : cfg.REAGENTS[id].fill;
  }

  // A tip that no longer holds a full dose is an empty tip, as at the bench.
  function drainTip() {
    var p = S.pipette;
    if (p.volume < V.dose) {
      p.volume = 0;
      p.reagent = null;
      p.source = null;
      Lab.pipette.setLiquid(null, 0);
    } else {
      Lab.pipette.setLiquid(p.reagent === 'SAMPLE' ? p.lastReagent : p.reagent, p.volume);
    }
    st.setPipette({});
  }

  /* --------------------------------------------------------------------- */
  /*  Inverting over the towels, and the incubations                        */
  /* --------------------------------------------------------------------- */
  function runInvert() {
    if (S.busy) return;
    st.setBusy(true);
    Lab.surfaces.invertStrip('A', function () {
      Lab.surfaces.invertStrip('B', function () {
        S.wash.step++;
        if (S.wash.step >= 5) finishWash();
        st.setBusy(false);
        refresh();
      });
    });
  }

  function finishWash() {
    // Unbound reagent has now actually been washed away; whatever found a
    // partner is still stuck to the plastic.  This is the step that makes an
    // ELISA specific rather than just colourful.
    st.settleBinding();
    st.markDone(S.phase);
    S.wash.step = 0;
    S.transfer.loaded = false;
    washUsed = 0;
    Lab.stations.setTransferLoad(0);
    st.setPhase(cfg.WASHES[S.phase]);
  }

  function runIncubation() {
    if (S.busy) return;
    var spec = cfg.INCUBATIONS[S.phase];
    if (!spec) return;
    var from = S.phase;
    st.setBusy(true);
    Lab.stations.runTimer(spec.seconds, function () {
      if (from === 'incubate1') st.adsorb();
      if (from === 'develop') { st.develop(); Lab.surfaces.refreshAll(true); }
      st.markDone(from);
      st.setPhase(spec.after);
      st.setBusy(false);
      refresh();
    });
  }

  /** Are the strips liftable right now?  Only when the protocol says invert. */
  function stripsAreLiftable() {
    return isWash(S.phase) && !isFillStep() && !S.busy;
  }

  /* --------------------------------------------------------------------- */
  /*  Phase progression                                                     */
  /* --------------------------------------------------------------------- */
  function every(from, to, pred) {
    for (var n = from; n <= to; n++) if (!pred(S.wells[n], n)) return false;
    return true;
  }

  function phaseComplete() {
    switch (S.phase) {
      case 'label':  return S.strips.A.labeled && S.strips.B.labeled;
      case 'buffer': return every(2, 12, function (w) { return w.vol > 0; });
      case 'antigen':return S.wells[1].vol >= 100;
      case 'serial': return S.serial.target > 12 && S.wells[12].mixStrokes >= 5;
      case 'discard':return S.discarded;
      case 'samples':return every(13, 24, function (w) { return w.vol > 0; });
      case 'wash1': case 'wash2': case 'wash3': return false;   // finishWash drives these
      case 'primary':   return every(1, 24, function (w) { return w.received.AB1; });
      case 'secondary': return every(1, 24, function (w) { return w.received.AB2; });
      case 'substrate': return every(1, 24, function (w) { return w.received.TMB; });
      case 'stop':      return every(1, 24, function (w) { return w.received.STOP; });
    }
    return false;
  }

  function advance() {
    if (S.busy || isIncubation(S.phase)) return;
    if (!phaseComplete()) return;
    st.markDone(S.phase);
    var i = cfg.PHASE_ORDER.indexOf(S.phase);
    var next = cfg.PHASE_ORDER[i + 1];
    if (!next) return;
    if (next === 'analysis') { enterAnalysis(false); return; }
    st.setPhase(next);
    if (next === 'wash1' || next === 'wash2' || next === 'wash3') S.wash.step = 0;
  }

  /* --------------------------------------------------------------------- */
  /*  The next instruction, and what to make glow                           */
  /* --------------------------------------------------------------------- */
  /* Every "you need a clean tip" hint has to name the step the student is
     actually on — eject first if a tip is fitted, empty it first if it is not
     empty — so all of them come through here rather than pointing blankly at
     the tip box. */
  function tipHint(why) {
    var p = S.pipette;
    if (p.volume > 0) {
      return { text: 'The tip is still holding ' + label(p.reagent) +
        '. Empty it into the waste first.', glow: ['.waste-bin'] };
    }
    if (p.hasTip) {
      return { text: 'Eject the used tip into the waste — ' + why, glow: ['.waste-bin'] };
    }
    return { text: 'Fit a fresh tip — rest the pipette over the tip box.', glow: ['.tip-box'] };
  }

  function hint() {
    var p = S.pipette, phase = S.phase;

    switch (phase) {
      case 'intro':
        return { text: 'Choose a module to begin.', glow: [] };

      case 'label': {
        var un = !S.strips.A.labeled ? 'A' : 'B';
        var range = un === 'A' ? '1–12' : '13–24';
        return { text: 'Take the fine-tipped marker and run it along the ' +
          (un === 'A' ? 'first' : 'second') + ' strip to number it ' + range + '.',
          glow: ['[data-strip="' + un + '"]'] };
      }

      case 'buffer': {
        var nb = firstWell(2, 12, function (w) { return w.vol <= 0; });
        if (p.reagent === 'DIL') {
          return { text: 'Dispense 50 µL of Dilution Buffer into well ' + nb + '. ' +
            'Drag the pipette along the strip — it dispenses as you go.',
            glow: nb ? ['[data-well="' + nb + '"]'] : [] };
        }
        if (canAspirate('DIL')) return { text: 'Draw Dilution Buffer from the pink-labelled tube.', glow: ['[data-reagent="DIL"]'] };
        return tipHint('the dilution buffer needs a clean one.');
      }

      case 'antigen': {
        if (p.reagent === 'AG') {
          return { text: 'Well 1 needs 100 µL — that is two 50 µL doses of antigen.',
            glow: ['[data-well="1"]'] };
        }
        if (canAspirate('AG')) return { text: 'Draw Antigen from the yellow-labelled tube. It is supplied at 100 µg/mL.', glow: ['[data-reagent="AG"]'] };
        return tipHint('nothing used may touch the antigen stock.');
      }

      case 'serial': {
        var tg = S.serial.target, src = tg - 1;
        if (p.volume > 0) {
          return { text: 'Carry the 50 µL into well ' + tg + '.', glow: ['[data-well="' + tg + '"]'] };
        }
        var tw = S.wells[tg];
        if (tw.vol > 0 && tw.mixStrokes < 5) {
          return { text: 'Mix well ' + tg + ' by pipetting up and down — ' +
            tw.mixStrokes + ' of 5 strokes.', glow: ['[data-well="' + tg + '"]'] };
        }
        if (!canCarrySerial()) return tipHint('the series runs on one clean tip from well 1 to well 12.');
        return { text: 'Draw 50 µL out of well ' + src + ' with the same tip.',
          glow: ['[data-well="' + src + '"]'] };
      }

      case 'discard':
        if (p.volume > 0) return { text: 'Discard that 50 µL into the waste — well 12 must not be over-volume.', glow: ['.waste-bin'] };
        if (!p.hasTip) return { text: 'Fit a tip to take 50 µL back out of well 12.', glow: ['.tip-box'] };
        return { text: 'Remove 50 µL from well 12, so every standard holds the same volume.',
          glow: ['[data-well="12"]'] };

      case 'samples': {
        var blk = currentBlock();
        if (!blk) return { text: 'All four samples are loaded.', glow: [] };
        if (p.reagent === 'SAMPLE') {
          var nw = firstWell(blk.wells[0], blk.wells[2], function (w) { return w.vol <= 0; });
          return { text: 'Dispense 50 µL of the ' + blk.label + ' into well ' + nw + '.',
            glow: nw ? ['[data-well="' + nw + '"]'] : [] };
        }
        if (!p.fresh) {
          return tipHint('a sample carried over into the ' + blk.label +
            ' would read as a false positive.');
        }
        return { text: 'Draw the ' + blk.label + ' for wells ' + blk.wells[0] + '–' + blk.wells[2] + '.',
          glow: ['[data-sample="' + tubeIdForBlock(blk.key) + '"]'] };
      }

      case 'incubate1':
        return { text: 'Both strips incubate for 5 minutes at room temperature while the antigen sticks to the wells. Start the timer.', glow: ['.bench-timer'] };
      case 'incubate2':
        return { text: 'Incubate 5 minutes — the primary antibody is finding its antigen.', glow: ['.bench-timer'] };
      case 'incubate3':
        return { text: 'Incubate 5 minutes — the secondary antibody is binding the primary.', glow: ['.bench-timer'] };
      case 'develop':
        return { text: 'Let the TMB develop for 2–5 minutes. Leave it longer than 10 and the strongest wells saturate.', glow: ['.bench-timer'] };

      case 'wash1': case 'wash2': case 'wash3': {
        var round = S.wash.step < 2 ? 'first' : 'second';
        if (S.wash.step === 0) {
          return { text: 'Invert both strips over the paper towels and tap them 4–5 times. ' +
            'Everything unbound pours out; what has bound stays.', glow: ['.towels'] };
        }
        if (isFillStep()) {
          var nf = firstWell(1, 24, function (w) { return w.vol < V.washFill; });
          if (!S.transfer.loaded) return { text: 'Fill the transfer pipet from the wash bottle.', glow: ['.wash-bottle'] };
          return { text: 'Fill every well with wash buffer — ' + round + ' wash. ' +
            'Sweep the transfer pipet along the strip, and do not overfill.',
            glow: nf ? ['[data-well="' + nf + '"]'] : [] };
        }
        return { text: 'Invert over the towels and tap again.', glow: ['.towels'] };
      }

      case 'primary': case 'secondary': case 'substrate': case 'stop': {
        var rid = cfg.PHASE_REAGENT[phase];
        var nn = firstWell(1, 24, function (w) { return !w.received[rid]; });
        var doneN = 24 - st.countWells(function (w) { return !w.received[rid]; });
        if (p.reagent === rid) {
          return { text: 'Dispense 50 µL of ' + cfg.REAGENTS[rid].name + ' into well ' + nn +
            ' (' + doneN + ' of 24 done).', glow: nn ? ['[data-well="' + nn + '"]'] : [] };
        }
        if (canAspirate(rid)) {
          return { text: 'Draw 50 µL of ' + cfg.REAGENTS[rid].name + ' — one well\'s worth. ' +
            '(' + doneN + ' of 24 done.)', glow: ['[data-reagent="' + rid + '"]'] };
        }
        return tipHint('the ' + cfg.REAGENTS[rid].name + ' needs a tip of its own.');
      }

      case 'analysis':
        return { text: 'Read the strips on the light box and fill in the tables.', glow: [] };
      case 'done':
        return { text: 'Analysis complete — good work.', glow: [] };
    }
    return { text: '', glow: [] };
  }

  /* --------------------------------------------------------------------- */
  /*  Highlighting                                                          */
  /* --------------------------------------------------------------------- */
  function setHighlight(t, tool) {
    if (!t || !t.el) { clearHighlight(); return; }
    var ev = evaluate(t, tool);
    if (highlighted.length === 1 && highlighted[0] === t.el &&
        t.el.classList.contains(ev.ok ? 'hot-ok' : 'hot-no')) return;
    clearHighlight();
    t.el.classList.add(ev.ok ? 'hot-ok' : 'hot-no');
    highlighted.push(t.el);
  }
  function clearHighlight() {
    highlighted.forEach(function (el) { el.classList.remove('hot-ok', 'hot-no'); });
    highlighted = [];
  }
  function applyHintGlow(selectors) {
    document.querySelectorAll('.next-target').forEach(function (el) { el.classList.remove('next-target'); });
    (selectors || []).forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) { el.classList.add('next-target'); });
    });
  }

  /* --------------------------------------------------------------------- */
  /*  Refresh                                                               */
  /* --------------------------------------------------------------------- */
  function refresh() {
    advance();
    var h = hint();
    Lab.ui.setInstruction(h.text);
    applyHintGlow(h.glow);
    Lab.ui.updateHud();
    Lab.stations.syncToolVisibility();
  }

  /* --------------------------------------------------------------------- */
  /*  Click / keyboard activation                                           */
  /* --------------------------------------------------------------------- */
  function clickAct(el) {
    if (S.busy || S.phase === 'intro' || S.phase === 'analysis') return;
    var t = describe(el);
    if (!t) return;
    // picking your two patient samples is allowed any time before they are used
    if (t.kind === 'sample' && S.phase !== 'samples') { Lab.ui.pickSample(t.sample); return; }

    var tool = toolFor(S.phase);
    var ev = evaluate(t, tool);
    if (!ev.ok) { if (ev.reason) Lab.ui.flash(ev.reason); return; }

    // the timer and the towels are not things you carry a tool to
    if (ev.action === 'incubate' || ev.action === 'invert') { perform(t, ev, null); return; }

    var center = Lab.tools.centerOf(t.el);
    var toolEl = toolEls[tool];
    if (!toolEl) { perform(t, ev, center); refresh(); return; }
    st.setBusy(true);
    var fly = tool === 'pipette' ? Lab.pipette.flyTo
      : function (pt, cb) { Lab.tools.flyTo(toolEl, Lab.tools.posOf(toolEl),
          tool === 'transfer' ? Lab.stations.transferTip : Lab.stations.markerNib, pt, cb); };
    fly(center, function () {
      st.setBusy(false);
      perform(t, evaluate(t, tool), center);
      refresh();
    });
  }

  /* --------------------------------------------------------------------- */
  /*  Module entry points                                                   */
  /* --------------------------------------------------------------------- */
  var runRecorded = false;

  function startModule1() {
    runRecorded = false;
    st.setModule(1);
    st.setPhase('label');
    S.serial = { target: 2, carrying: 0 };
    S.discarded = false;
    refresh();
  }

  /** Enter Module 2.  `standalone` means the student chose to analyse a plate
      they did not run themselves, so a finished plate is handed to them — the
      analysis is a skill of its own and should not be gated behind the bench. */
  function enterAnalysis(standalone) {
    if (standalone) fabricateFinishedPlate();
    ['read', 'quantify', 'trace'].forEach(function (k) { delete S.done[k]; });
    st.setModule(2);
    st.setPhase('analysis');
    Lab.surfaces.refreshAll(false);
    Lab.analysis.open(standalone);
    // once per run, not once per visit: the module tabs come back here freely
    if (Lab.progress && !standalone && !runRecorded) {
      runRecorded = true;
      Lab.progress.recordRun(S.patients);
    }
    refresh();
  }

  /** Run the whole protocol in memory, correctly, and leave the strips as a
      finished assay.  Used by the "analyse a prepared plate" path and by the
      teacher preview. */
  function fabricateFinishedPlate() {
    st.reset(true);
    S.prepared = true;
    S.serial = { target: 13, carrying: 0 };
    S.discarded = true;
    S.strips.A.labeled = S.strips.B.labeled = true;
    // A finished well holds 100 µL: 50 µL of TMB and 50 µL of stop solution,
    // with no wash between them (protocol steps 26 and 28).
    var FINAL_VOL = cfg.DOSE * 2;

    // the standards, exactly as the dilution series would leave them
    for (var n = 1; n <= 12; n++) {
      var w = S.wells[n];
      w.vol = FINAL_VOL;
      w.conc = cfg.standardConc(n);
      w.bound = w.conc;
      w.mixStrokes = 5;
      w.content = 'STOP';
    }
    // the controls and the two patient samples
    cfg.SAMPLE_BLOCKS.forEach(function (b) {
      b.wells.forEach(function (i) {
        var ww = S.wells[i];
        ww.vol = FINAL_VOL;
        ww.conc = st.sampleConc(b.key);
        ww.bound = ww.conc;
        ww.content = 'STOP';
        ww.label = st.sampleNameFor(i);
      });
    });
    cfg.allWells().forEach(function (i) {
      var ww = S.wells[i];
      ww.received.AB1 = ww.received.AB2 = ww.received.TMB = ww.received.STOP = true;
      ww.stopped = true;
    });
    st.settleBinding();
    st.develop();
    cfg.CHECKLIST.filter(function (c) { return c.module === 1; })
      .forEach(function (c) { S.done[c.key] = true; });
  }

  /** Back to the bench with fresh strips.  There is no way to un-develop a
      plate, so once one is finished — whether this student ran it or was
      handed it — the only thing Module 1 can mean is a new run. */
  function restartModule1() {
    var keep = S.patients.slice();
    st.reset(true);
    st.setPatients(keep);
    Lab.pipette.setTip(false);
    Lab.pipette.setLiquid(null, 0);
    Lab.stations.setTransferLoad(0);
    Lab.surfaces.refreshAll(false);
    Lab.ui.renderChecklist();
    Lab.analysis.reset();
    startModule1();
  }

  function onAnalysisStep(key) { st.markDone(key); refresh(); }
  function onAnalysisComplete() { st.markDone('trace'); st.setPhase('done'); refresh(); }

  Lab.engine = {
    registerTool: registerTool,
    targetAt: targetAt,
    describe: describe,
    evaluate: evaluate,
    hoverAt: hoverAt,
    aimAt: aimAt,
    releaseAt: releaseAt,
    perform: perform,
    clickAct: clickAct,
    clearHighlight: clearHighlight,
    refresh: refresh,
    hint: hint,
    toolFor: toolFor,
    stripsAreLiftable: stripsAreLiftable,
    startModule1: startModule1,
    restartModule1: restartModule1,
    enterAnalysis: enterAnalysis,
    fabricateFinishedPlate: fabricateFinishedPlate,
    onAnalysisStep: onAnalysisStep,
    onAnalysisComplete: onAnalysisComplete
  };
})(window.Lab = window.Lab || {});
