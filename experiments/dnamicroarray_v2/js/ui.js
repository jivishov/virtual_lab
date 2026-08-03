/* =============================================================================
 * ui.js  —  Instruction text, step checklist, status HUD, cohort, theme
 * picker and toasts.
 *
 * Pure presentation: reads Lab.state, never mutates it.  The engine calls
 * setInstruction / updateHud; state changes are also observed directly.
 *
 * Exposed as  Lab.ui
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var cfg = Lab.config, st = Lab.state, S = Lab.state.S;
  var els = {};

  var PHASE_LABEL = {
    intro: 'Ready', eb: 'Step 1 · Equilibration Buffer', 'dry-eb': 'Step 2 · Drying',
    samples: 'Step 3 · Sample prep & spotting', 'dry-samples': 'Step 4 · Drying',
    hb: 'Step 5 · Hybridisation Buffer', 'dry-hb': 'Step 6 · Drying',
    visualize: 'Step 7 · UV visualisation', analyze: 'Step 8 · Analysis', done: 'Complete'
  };

  function reduced() { return Lab.theme && Lab.theme.reducedMotion; }

  function init(refs) {
    els = refs;
    renderChecklist();
    renderCohort();
    renderThemePicker();
    renderRecord();
    if (Lab.progress) Lab.progress.onChange(renderRecord);
    st.on('checklist', function (key) { markChecklist(key); });
    st.on('change', updateHud);
    st.on('change', syncThemePickerEnabled);
    updateHud();
  }

  /* ----- the cohort -------------------------------------------------------
     config.PATIENTS carries a `note` for every patient that the interface
     never used to show, and the old markup hard-coded "P2 / P3 / P4" instead
     of reading config at all.  These are the people the run is about, so they
     are rendered from the single source of truth. */
  function renderCohort() {
    var host = document.getElementById('cohort');
    if (!host) return;
    host.innerHTML = cfg.PATIENTS.map(function (p) {
      return '<li>' +
        '<span class="cohort__name">' + p.n + '. ' + esc(p.name) + '</span>' +
        '<span class="cohort__row">row ' + p.row + '</span>' +
        '<span class="cohort__note">' + esc(p.note) + '</span>' +
      '</li>';
    }).join('');
  }

  /* ----- bench record ----------------------------------------------------
     The UV/analysis shortcut is earned, not given: it stays disabled until one
     full run has been carried through by hand.  When locked, this line says
     WHY rather than leaving a dead button; once earned it becomes the place to
     wipe the saved record. */
  function renderRecord() {
    var host = document.getElementById('record');
    var demo = document.getElementById('demo-btn');
    if (!host || !Lab.progress) return;

    var open = Lab.progress.unlocked();
    if (demo) {
      demo.disabled = !open;
      demo.title = open
        ? 'Jump straight to the UV reveal and the read-out'
        : 'Complete one full run to unlock this';
    }

    if (!open) {
      host.innerHTML = 'Skipping to the UV reveal unlocks once you have taken ' +
        'one run all the way through the bench.';
      return;
    }

    var n = Lab.progress.runs();
    host.innerHTML = 'Bench record: <b>' + n + ' completed run' + (n === 1 ? '' : 's') +
      '</b>. <button type="button" class="linkbtn" id="clear-btn">Clear saved progress</button>';

    var btn = document.getElementById('clear-btn');
    if (btn) btn.addEventListener('click', function () {
      Lab.progress.clear();       // re-renders through the onChange listener
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
      // Mid-animation the incubator timeline owns element colours, so block
      // the switch rather than trying to queue it — every busy window is < 4s.
      if (S.busy) { flash('One moment — finishing that step.'); return; }
      Lab.theme.set(btn.getAttribute('data-theme-id'));
      if (Lab.repaint) Lab.repaint();
      syncThemePickerChecked();
    });

    Lab.theme.onChange(syncThemePickerChecked);
  }

  function syncThemePickerChecked() {
    var host = document.getElementById('themepick');
    if (!host || !Lab.theme) return;
    var active = Lab.theme.active();
    host.querySelectorAll('[data-theme-id]').forEach(function (b) {
      b.setAttribute('aria-checked', b.getAttribute('data-theme-id') === active ? 'true' : 'false');
    });
  }

  function syncThemePickerEnabled() {
    var host = document.getElementById('themepick');
    if (!host) return;
    host.querySelectorAll('[data-theme-id]').forEach(function (b) {
      if (S.busy) b.setAttribute('aria-disabled', 'true');
      else b.removeAttribute('aria-disabled');
    });
  }

  /* ----- instructions --------------------------------------------------- */
  function setInstruction(text) {
    if (!els.instruction) return;
    els.instruction.textContent = text;
    if (Lab.env.gsap && !reduced()) {
      gsap.fromTo(els.instruction, { opacity: 0.4, y: -4 }, { opacity: 1, y: 0, duration: 0.3, ease: 'expo.out' });
    }
  }

  /* ----- checklist ------------------------------------------------------ */
  function renderChecklist() {
    if (!els.checklist) return;
    els.checklist.innerHTML = '';
    cfg.CHECKLIST.forEach(function (step) {
      var li = document.createElement('li');
      li.id = 'chk-' + step.key;
      li.innerHTML = '<span class="chk-mark" aria-hidden="true"></span><span>' + esc(step.text) + '</span>';
      els.checklist.appendChild(li);
    });
  }
  function markChecklist(key) {
    var li = document.getElementById('chk-' + key);
    if (!li) return;
    li.classList.add('done');
    if (Lab.env.gsap && !reduced()) {
      // expo, not back.out — real objects decelerate, they do not bounce
      gsap.fromTo(li.querySelector('.chk-mark'), { scale: 0 }, { scale: 1, duration: 0.4, ease: 'expo.out' });
    }
  }

  /* ----- status HUD ----------------------------------------------------- */
  function updateHud() {
    var p = S.pipette, c = st.counts;
    if (els.phase) els.phase.textContent = PHASE_LABEL[S.phase] || S.phase;

    if (els.tip) {
      els.tip.textContent = p.hasTip ? 'Tip: attached' : 'Tip: none';
      els.tip.className = 'chip ' + (p.hasTip ? 'chip-on' : 'chip-off');
    }
    if (els.reagent) {
      if (p.reagent) {
        var R = cfg.REAGENTS[p.reagent];
        els.reagent.textContent = R.abbr + (p.mixFrom ? ' (' + p.mixFrom + ')' : '');
        els.reagent.className = 'chip chip-reagent';
        els.reagent.style.setProperty('--chip', paint(p.reagent, R.fill));
      } else {
        els.reagent.textContent = 'empty';
        els.reagent.className = 'chip chip-off';
        els.reagent.style.removeProperty('--chip');
      }
    }

    if (els.volFill) {
      var pct = Math.max(0, Math.min(100, (p.volume / cfg.VOLUME.max) * 100));
      els.volFill.style.height = pct + '%';
      els.volFill.style.background = p.reagent
        ? paint(p.reagent, cfg.REAGENTS[p.reagent].fill)
        : 'var(--ink-3)';
      if (els.volText) els.volText.textContent = Math.round(p.volume) + ' µL';
    }

    if (els.progFill && els.progText) {
      var done = 0, total = c.total(), label = '';
      if (S.phase === 'eb') { done = c.ebDone(); label = 'EB spots'; }
      else if (S.phase === 'samples' || S.phase === 'dry-samples') { done = c.sampleDone(); label = 'samples spotted'; }
      else if (S.phase === 'hb') { done = c.hbDone(); label = 'HB spots'; }
      else if (S.phase === 'visualize' || S.phase === 'analyze' || S.phase === 'done') {
        done = revealedCount(); label = 'spots revealed';
      } else { done = 0; total = 0; }
      els.progFill.style.width = total ? (done / total * 100) + '%' : '0%';
      els.progText.textContent = total ? (done + ' / ' + total + ' ' + label) : '—';
    }
  }

  function paint(reagentId, fb) {
    return (Lab.theme && Lab.theme.sci) ? Lab.theme.sci(reagentId, 'fill') : fb;
  }

  function revealedCount() {
    var n = 0; cfg.allIds().forEach(function (id) { if (S.spots[id].revealed) n++; }); return n;
  }

  /* ----- toast ---------------------------------------------------------- */
  var toastTimer = null;
  function flash(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, 2400);
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
    renderCohort: renderCohort
  };
})(window.Lab = window.Lab || {});
