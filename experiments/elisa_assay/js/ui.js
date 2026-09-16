/* =============================================================================
 * ui.js  —  Instruction text, the two checklists, the status HUD, the cohort,
 * the sample picker, the theme picker and toasts.
 *
 * Pure presentation: reads Lab.state, never mutates the simulation.  The
 * engine calls setInstruction / updateHud; state changes are also observed
 * directly.
 *
 * Exposed as  Lab.ui
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var cfg = Lab.config, st = Lab.state, S = Lab.state.S;
  var els = {};

  function reduced() { return Lab.theme && Lab.theme.reducedMotion; }

  function init(refs) {
    els = refs;
    renderChecklist();
    renderCohort();
    renderThemePicker();
    renderRecord();
    if (Lab.progress) Lab.progress.onChange(renderRecord);
    st.on('checklist', markChecklist);
    st.on('change', updateHud);
    st.on('patients', function () { renderCohort(); Lab.stations.renderRack(); });
    st.on('module', syncModuleTabs);
    st.on('phase', syncModuleTabs);
    st.on('phase', syncChecklistCursor);
    updateHud();
    syncChecklistCursor();
  }

  /* ----- the cohort ------------------------------------------------------
     These are nine named people with case histories, and the histories are
     what turns a column of numbers into an outbreak — so they are rendered in
     full, and each one is the control for choosing your two samples. */
  function renderCohort() {
    var host = document.getElementById('cohort');
    if (!host) return;
    host.innerHTML = cfg.PATIENTS.map(function (p) {
      var slot = S.patients.indexOf(p.id);
      return '<li class="cohort__item' + (slot >= 0 ? ' is-picked' : '') + '">' +
        '<button type="button" class="cohort__btn" data-pick="' + p.id + '" ' +
          'aria-pressed="' + (slot >= 0 ? 'true' : 'false') + '">' +
          '<span class="cohort__name">' + esc(p.name) + '</span>' +
          (slot >= 0 ? '<span class="cohort__slot">Patient ' + (slot + 1) + '</span>' : '') +
          '<span class="cohort__note">' + esc(p.history) + '</span>' +
        '</button></li>';
    }).join('');

    if (!host.__wired) {
      host.__wired = true;
      host.addEventListener('click', function (e) {
        var b = e.target.closest('[data-pick]');
        if (b) pickSample(b.getAttribute('data-pick'));
      });
    }
  }

  /** Put a patient into the pair, or take them out again.  Two at a time, and
      not once their sample has already gone into the strip. */
  function pickSample(id) {
    if (!cfg.patientById(id)) return;          // the controls are not choosable
    if (S.wells[19].vol > 0 || S.wells[22].vol > 0) {
      flash('Those samples are already loaded — you cannot swap them now.');
      return;
    }
    var next = S.patients.slice();
    var at = next.indexOf(id);
    if (at >= 0) next.splice(at, 1);
    else if (next.length < 2) next.push(id);
    else next = [next[1], id];                 // oldest choice drops off
    if (next.length !== 2) { flash('You need two patient samples — pick another.'); }
    st.setPatients(next);
    if (Lab.progress && next.length === 2) Lab.progress.rememberPatients(next);
  }

  /* ----- bench record ---------------------------------------------------- */
  function renderRecord() {
    var host = document.getElementById('record');
    if (!host || !Lab.progress) return;
    var n = Lab.progress.runs();
    if (!n) {
      host.innerHTML = 'Module 2 can be opened on its own at any time — you will be handed ' +
        'a prepared plate to read.';
      return;
    }
    host.innerHTML = 'Bench record: <b>' + n + ' completed run' + (n === 1 ? '' : 's') +
      '</b>. <button type="button" class="linkbtn" id="clear-btn">Clear saved progress</button>';
    var btn = document.getElementById('clear-btn');
    if (btn) btn.addEventListener('click', function () {
      Lab.progress.clear();
      flash('Saved progress cleared.');
    });
  }

  /* ----- theme picker ----------------------------------------------------- */
  function renderThemePicker() {
    var host = document.getElementById('themepick');
    if (!host || !Lab.theme) return;
    var active = Lab.theme.active();
    host.innerHTML = Lab.theme.THEMES.map(function (t) {
      return '<button type="button" class="themepick__btn" role="radio" data-theme-id="' + t.id + '" ' +
        'aria-checked="' + (t.id === active ? 'true' : 'false') + '" title="' + esc(t.hint) + '">' +
        esc(t.label) + '</button>';
    }).join('');

    host.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-theme-id]');
      if (!btn) return;
      // mid-animation the incubation timeline owns element colours, so block
      // the switch rather than trying to queue it — every busy window is short
      if (S.busy) { flash('One moment — finishing that step.'); return; }
      Lab.theme.set(btn.getAttribute('data-theme-id'));
      if (Lab.repaint) Lab.repaint();
      syncThemeChecked();
    });
    Lab.theme.onChange(syncThemeChecked);
  }

  function syncThemeChecked() {
    var host = document.getElementById('themepick');
    if (!host || !Lab.theme) return;
    var active = Lab.theme.active();
    host.querySelectorAll('[data-theme-id]').forEach(function (b) {
      b.setAttribute('aria-checked', b.getAttribute('data-theme-id') === active ? 'true' : 'false');
    });
  }

  /* ----- module tabs ------------------------------------------------------ */
  function syncModuleTabs() {
    var host = document.getElementById('moduletabs');
    if (!host) return;
    host.querySelectorAll('[data-module]').forEach(function (b) {
      var m = parseInt(b.getAttribute('data-module'), 10);
      b.setAttribute('aria-current', (S.module === m && S.phase !== 'intro') ? 'true' : 'false');
    });
  }

  /* ----- instructions ----------------------------------------------------- */
  function setInstruction(text) {
    if (!els.instruction || els.instruction.textContent === text) return;
    els.instruction.textContent = text;
    if (Lab.env.gsap && !reduced()) {
      gsap.fromTo(els.instruction, { opacity: 0.4, y: -4 },
        { opacity: 1, y: 0, duration: 0.28, ease: 'expo.out' });
    }
  }

  /* ----- checklists ------------------------------------------------------- */
  function renderChecklist() {
    if (!els.checklist) return;
    var html = '';
    [1, 2].forEach(function (m) {
      html += '<li class="chk-group"><span>Module ' + m + ' · ' +
        (m === 1 ? 'Performing the assay' : 'Analysing the results') + '</span></li>';
      cfg.CHECKLIST.filter(function (c) { return c.module === m; }).forEach(function (step) {
        html += '<li id="chk-' + step.key + '"' + (S.done[step.key] ? ' class="done"' : '') + '>' +
          '<span class="chk-mark" aria-hidden="true"></span><span>' + esc(step.text) + '</span></li>';
      });
    });
    els.checklist.innerHTML = html;
    syncChecklistCursor();
  }

  /* The procedure list is taller than the rail it lives in, so it scrolls —
     which only works if the step you are on is marked and kept in view.  The
     phase keys and the checklist keys are the same strings by construction
     (config.PHASE_ORDER and config.CHECKLIST), so the current step needs no
     lookup table; during Module 2 the cursor rests on its first step. */
  function syncChecklistCursor() {
    if (!els.checklist) return;
    var key = S.phase === 'analysis' || S.phase === 'done' ? 'read' : S.phase;
    var prev = els.checklist.querySelector('li.now');
    if (prev) prev.classList.remove('now');
    var li = document.getElementById('chk-' + key);
    if (!li) return;
    li.classList.add('now');

    // keep it inside the scroll port without scrolling the PAGE — a bench that
    // fits the screen must not be nudged off it by a list doing housekeeping
    var box = els.checklist.getBoundingClientRect();
    var row = li.getBoundingClientRect();
    if (row.top < box.top + 4) {
      els.checklist.scrollTop -= (box.top + 4 - row.top);
    } else if (row.bottom > box.bottom - 4) {
      els.checklist.scrollTop += (row.bottom - box.bottom + 4);
    }
  }

  function markChecklist(key) {
    var li = document.getElementById('chk-' + key);
    if (!li || li.classList.contains('done')) return;
    li.classList.add('done');
    if (Lab.env.gsap && !reduced()) {
      gsap.fromTo(li.querySelector('.chk-mark'), { scale: 0 },
        { scale: 1, duration: 0.4, ease: 'expo.out' });
    }
  }

  /* ----- status HUD ------------------------------------------------------- */
  function updateHud() {
    var p = S.pipette;
    if (els.phase) els.phase.textContent = cfg.PHASE_LABEL[S.phase] || S.phase;

    if (els.tool) {
      var tool = Lab.engine.toolFor(S.phase);
      els.tool.textContent = { pipette: 'Micropipette', transfer: 'Transfer pipet', marker: 'Marker' }[tool];
      els.tool.className = 'chip chip-tool';
    }

    if (els.tip) {
      els.tip.textContent = p.hasTip ? (p.fresh ? 'Tip: fresh' : 'Tip: used') : 'Tip: none';
      els.tip.className = 'chip ' + (p.hasTip ? (p.fresh ? 'chip-on' : 'chip-warn') : 'chip-off');
    }

    if (els.reagent) {
      var holding = p.reagent === 'SAMPLE' ? p.lastReagent : p.reagent;
      if (holding && cfg.REAGENTS[holding]) {
        var R = cfg.REAGENTS[holding];
        els.reagent.textContent = R.abbr;
        els.reagent.className = 'chip chip-reagent';
        els.reagent.style.setProperty('--chip', paint(holding, R.fill));
      } else {
        els.reagent.textContent = 'empty';
        els.reagent.className = 'chip chip-off';
        els.reagent.style.removeProperty('--chip');
      }
    }

    if (els.volFill) {
      var pct = Math.max(0, Math.min(100, (p.volume / cfg.VOLUME.tipMax) * 100));
      els.volFill.style.height = pct + '%';
      var holding2 = p.reagent === 'SAMPLE' ? p.lastReagent : p.reagent;
      els.volFill.style.background = (holding2 && cfg.REAGENTS[holding2])
        ? paint(holding2, cfg.REAGENTS[holding2].fill) : 'var(--ink-3)';
      if (els.volText) els.volText.textContent = Math.round(p.volume) + ' µL';
    }

    var pr = progressOf();
    if (els.progFill && els.progText) {
      els.progFill.style.width = pr.total ? (pr.done / pr.total * 100) + '%' : '0%';
      els.progText.textContent = pr.total ? (pr.done + ' / ' + pr.total + ' ' + pr.label) : pr.label;
    }
  }

  /* What "done" means inside the step we are on.  Every branch is a real
     count out of a real total, so the bar never invents progress. */
  function progressOf() {
    var c = st.counts, phase = S.phase;
    switch (phase) {
      case 'label':
        return { done: (S.strips.A.labeled ? 1 : 0) + (S.strips.B.labeled ? 1 : 0), total: 2, label: 'strips labelled' };
      case 'buffer':
        return { done: c.buffered(), total: 11, label: 'wells buffered' };
      case 'antigen':
        return { done: Math.round(S.wells[1].vol / cfg.DOSE), total: 2, label: '50 µL doses in well 1' };
      case 'serial':
        return { done: Math.min(11, S.serial.target - 2), total: 11, label: 'dilutions made' };
      case 'discard':
        return { done: S.discarded ? 1 : 0, total: 1, label: 'excess removed' };
      case 'samples':
        return { done: c.loaded(), total: 12, label: 'sample wells loaded' };
      case 'wash1': case 'wash2': case 'wash3':
        return { done: S.wash.step, total: 5, label: 'wash actions' };
      case 'primary':
        return { done: c.filled('AB1'), total: 24, label: 'wells with 1° AB' };
      case 'secondary':
        return { done: c.filled('AB2'), total: 24, label: 'wells with 2° AB' };
      case 'substrate':
        return { done: c.filled('TMB'), total: 24, label: 'wells with TMB' };
      case 'stop':
        return { done: c.filled('STOP'), total: 24, label: 'wells stopped' };
      case 'incubate1': case 'incubate2': case 'incubate3': case 'develop':
        return { done: 0, total: 0, label: 'waiting on the timer' };
      case 'analysis':
        return { done: 0, total: 0, label: 'reading the strips' };
    }
    return { done: 0, total: 0, label: '—' };
  }

  function paint(id, fb) {
    return (Lab.theme && Lab.theme.sci) ? Lab.theme.sci(id, 'fill') : fb;
  }

  /* ----- toast ------------------------------------------------------------ */
  var toastTimer = null;
  function flash(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, 3200);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  Lab.ui = {
    init: init,
    setInstruction: setInstruction,
    updateHud: updateHud,
    flash: flash,
    pickSample: pickSample,
    renderCohort: renderCohort,
    renderChecklist: renderChecklist,
    esc: esc
  };
})(window.Lab = window.Lab || {});
