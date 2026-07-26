/**
 * ui.js — Cockpit HUD: checklist, instruments, action dock, dialogs, charts.
 *
 * The HUD deliberately does not show the true burette reading unless the
 * student switches on the "training aid" readout, which is recorded in the
 * debrief. Everything else on the panel is derived from what they logged.
 */

import { theoreticalCurve, stats, VISIBLE_PINK } from './chem.js';
import { ALIQUOT_ML, TRIALS_REQUIRED } from './sim.js';
import { NAOH_NOMINAL_M } from './chem.js';

const $ = (sel) => document.querySelector(sel);

/** Buttons offered for each checklist step. */
const DOCK = {
  brief: [],
  ppe: [
    { a: 'wear:goggles', label: 'Put on goggles' },
    { a: 'wear:gloves', label: 'Put on gloves' },
    { a: 'wear:coat', label: 'Put on lab coat' },
  ],
  inspect: [{ a: 'inspect:burette', label: 'Inspect burette' }],
  condition: [
    { a: 'stage:waste', label: 'Waste beaker under tip' },
    { a: 'rinse:burette', label: 'Rinse with titrant', hot: true },
    { a: 'skip:step', label: 'Skip conditioning' },
  ],
  charge: [{ a: 'fill:burette', label: 'Charge burette with funnel', hot: true }],
  purge: [
    { a: 'stage:waste', label: 'Waste beaker under tip' },
    { a: 'hold:full', label: 'Open wide', key: 'Space', hold: true, hot: true },
    { a: 'hold:trickle', label: 'Trickle', key: 'S', hold: true },
    { a: 'drop', label: 'One drop', key: 'D' },
    { a: 'skip:step', label: 'Leave the air in' },
  ],
  initial: [{ a: 'read', label: 'Read the meniscus', key: 'R', hot: true }],
  aliquot: [
    { a: 'rinse:pipette', label: 'Condition pipette with sample' },
    { a: 'pipette:fill', label: 'Fill pipette to mark' },
    { a: 'pipette:deliver', label: 'Deliver 25.00 mL to flask', hot: true },
  ],
  indicator: [{ a: 'add:indicator', label: 'Add a drop of phenolphthalein', hot: true }],
  titrate: [
    { a: 'hold:full', label: 'Fast', key: 'Space', hold: true },
    { a: 'hold:trickle', label: 'Trickle', key: 'S', hold: true },
    { a: 'drop', label: 'Drop', key: 'D' },
    { a: 'half', label: '½ drop', key: 'F' },
    { a: 'swirl', label: 'Swirl', key: 'W', hot: true },
    { a: 'rinse:walls', label: 'Rinse walls', key: 'E' },
    { a: 'toggle:probe', label: 'pH probe', key: 'P' },
    { a: 'read', label: 'Endpoint — read burette', key: 'R', hot: true },
  ],
  dump: [
    { a: 'empty:flask', label: 'Empty flask to waste', hot: true },
    { a: 'rinse:walls', label: 'Rinse flask', key: 'E' },
  ],
  calculate: [{ a: 'open:calc', label: 'Open the calculation', hot: true }],
  debrief: [{ a: 'open:report', label: 'Show debrief', hot: true }],
};

export class UI {
  constructor({ sim, stage, lab, burette, sfx, views }) {
    this.sim = sim;
    this.stage = stage;
    this.lab = lab;
    this.burette = burette;
    this.sfx = sfx;
    this.views = views;
    this.assist = false;
    this.held = new Set();
    this.latched = 0;
    this.activeView = 'bench';

    this._cache();
    this._bindButtons();
    this._bindKeys();
    this._bindSim();

    $('#tbSample').textContent = sim.unknown.id;
    $('#bSample').textContent = sim.unknown.id;
    this.renderChecklist();
    this.renderStep();
    this.openModal('briefing');
  }

  _cache() {
    this.el = {
      clock: $('#tbClock'), trial: $('#tbTrial'), step: $('#tbStep'),
      checklist: $('#checklistItems'), brief: $('#stepBrief'), hint: $('#stepHint'),
      titre: $('#gTitre'), initial: $('#gInitial'), drops: $('#gDrops'),
      flow: $('#gFlow'), flowBar: $('#gFlowBar'), ph: $('#gPh'), phSrc: $('#gPhSrc'),
      swatch: $('#gSwatch'), pink: $('#gPink'), assistBtn: $('#assistBtn'), assist: $('#gAssist'),
      dock: $('#dockButtons'), toasts: $('#toasts'), chart: $('#chart'),
      hover: $('#hoverLabel'), crosshair: $('#crosshair'),
    };
  }

  // ------------------------------------------------------------- plumbing --
  _bindButtons() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ui],[data-view],[data-collapse]');
      if (!btn) return;
      this.sfx.resume();
      if (btn.dataset.view) { this.setView(btn.dataset.view); return; }
      if (btn.dataset.collapse) {
        document.getElementById(btn.dataset.collapse).classList.toggle('collapsed');
        return;
      }
      this._uiAction(btn.dataset.ui);
    });

    this.el.assistBtn.addEventListener('click', () => {
      this.assist = !this.assist;
      this.el.assistBtn.textContent = this.assist ? 'ON' : 'OFF';
      this.el.assistBtn.closest('.gauge').classList.toggle('on', this.assist);
      if (this.assist) {
        this.sim.notes.add('usedDigitalReadout');
        this.toast('Digital readout on. Useful for learning — noted in your debrief.', 'warn');
      }
    });

    $('#readInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._submitReading(); }
      e.stopPropagation();
    });
    $('#calcInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._submitCalc(); }
      e.stopPropagation();
    });
  }

  _uiAction(id) {
    switch (id) {
      case 'beginRun':
        this.closeModal('briefing');
        this.sim.begin();
        this.setView('bench');
        this.toast('Bench live. Goggles, gloves and coat before anything else.', 'good');
        break;
      case 'help': this.openModal('helpModal'); break;
      case 'closeHelp': this.closeModal('helpModal'); break;
      case 'notebook': this.openNotebook(); break;
      case 'closeNotebook': this.closeModal('notebookModal'); break;
      case 'closeReading': this.closeModal('readingModal'); break;
      case 'submitReading': this._submitReading(); break;
      case 'closeCalc': this.closeModal('calcModal'); break;
      case 'submitCalc': this._submitCalc(); break;
      case 'restart': window.location.reload(); break;
      case 'mute': {
        this.muted = !this.muted;
        this.sfx.setMuted(this.muted);
        this.toast(this.muted ? 'Sound off.' : 'Sound on.');
        break;
      }
      default: break;
    }
  }

  _bindKeys() {
    const isTyping = () => document.activeElement
      && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);

    window.addEventListener('keydown', (e) => {
      if (isTyping()) return;
      const k = e.key.toLowerCase();
      // W repeats so holding it keeps the flask swirling
      if (e.repeat && !['arrowup', 'arrowdown', 'w'].includes(k)) return;
      this.sfx.resume();

      if (k === 'escape') { this._closeTopModal(); return; }
      if (this._modalOpen() && k !== 'tab') return;

      if (k === ' ') { e.preventDefault(); this.held.add('full'); }
      else if (k === 's') this.held.add('trickle');
      else if (k === 'd') this.dispatch('drop');
      else if (k === 'f') this.dispatch('half');
      else if (k === 'w') this.dispatch('swirl');
      else if (k === 'e') this.dispatch('rinse:walls');
      else if (k === 'r' || k === 'enter') this.dispatch('read');
      else if (k === 'p') this.dispatch('toggle:probe');
      else if (k === 'm') this._uiAction('mute');
      else if (k === 'h' || k === '?') this.openModal('helpModal');
      else if (k === 'tab') { e.preventDefault(); this.openNotebook(); }
      else if (k === 'arrowup') { e.preventDefault(); this._nudge(+0.03); }
      else if (k === 'arrowdown') { e.preventDefault(); this._nudge(-0.03); }
      else if (['1', '2', '3', '4', '5'].includes(k)) {
        this.setView(['bench', 'tip', 'meniscus', 'flask', 'wide'][Number(k) - 1]);
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ') this.held.delete('full');
      if (k === 's') this.held.delete('trickle');
    });
    window.addEventListener('blur', () => this.held.clear());
  }

  _nudge(d) {
    this.latched = Math.max(0, Math.min(1, this.latched + d));
    this.toast(`Stopcock latched at ${(this.latched * 100).toFixed(0)}%`, 'warn', 900);
  }

  _bindSim() {
    const s = this.sim;
    s.on('step', () => { this.renderChecklist(); this.renderStep(); this.renderDock(); });
    s.on('deny', (m) => this.toast(m, 'bad'));
    s.on('violation', (m) => this.toast(`SAFETY: ${m}`, 'bad', 6000));
    s.on('note', (m) => this.toast(m, 'warn', 6500));
    s.on('trial', (t) => {
      this.toast(`Trial ${t.n} logged — titre ${t.titre.toFixed(2)} mL.`, 'good', 5000);
      this.renderChecklist();
    });
    s.on('report', () => this.openReport());
    s.on('closeStopcock', () => { this.latched = 0; this.held.clear(); });
  }

  /** Route a dock/keyboard action into the simulation. */
  dispatch(a) {
    const s = this.sim;
    switch (a) {
      case 'drop': s.releaseDrop(1); break;
      case 'half': s.releaseDrop(0.5); break;
      case 'read': this.openReading(); break;
      case 'open:calc': this.openCalc(); break;
      case 'open:report': this.openReport(); break;
      case 'hold:full': case 'hold:trickle': break;   // handled by hold state
      default: {
        const res = s.attempt(a);
        if (res && res.ok !== false && res.message && !res.quiet) this.toast(res.message, 'good');
        break;
      }
    }
    this.renderDock();
  }

  // --------------------------------------------------------------- panels --
  renderChecklist() {
    const s = this.sim;
    const html = s.steps
      .filter((st) => st.id !== 'brief')
      .map((st) => {
        const i = s.steps.indexOf(st);
        const current = i === s.stepIndex;
        const done = i < s.stepIndex && !(st.id === 'titrate' && s.trials.length < TRIALS_REQUIRED);
        const title = typeof st.title === 'function' ? st.title() : st.title;
        const extra = st.id === 'titrate' && s.trials.length
          ? ` <small style="color:var(--ink-faint)">(${s.trials.length}/${TRIALS_REQUIRED} done)</small>` : '';
        return `<li class="${current ? 'current' : done ? 'done' : ''}">
          <span class="tick">${done ? '✔' : current ? '▸' : '·'}</span>
          <span>${title}${extra}</span></li>`;
      }).join('');
    this.el.checklist.innerHTML = html;
    const cur = this.el.checklist.querySelector('.current');
    cur?.scrollIntoView({ block: 'nearest' });
  }

  renderStep() {
    const s = this.sim;
    this.el.step && (this.el.step.textContent = s.stepTitle);
    this.el.brief.textContent = s.step.brief;
    this.el.hint.textContent = s.step.hint;
    this.el.trial.textContent = `${Math.min(s.trials.length + (s.trial ? 1 : 0), TRIALS_REQUIRED)}/${TRIALS_REQUIRED}`;
    // helpful auto-framing for the fiddly steps
    if (s.step.id === 'titrate' && this.activeView === 'bench') this.setView('tip');
  }

  renderDock() {
    const s = this.sim;
    const list = DOCK[s.step.id] || [];
    this.el.dock.innerHTML = list.map((b) => `
      <button data-act="${b.a}" class="${b.hot ? 'hot' : ''}" ${b.hold ? 'data-hold="1"' : ''}>
        ${b.label}${b.key ? `<kbd>${b.key}</kbd>` : ''}
      </button>`).join('');

    this.el.dock.querySelectorAll('button').forEach((btn) => {
      const a = btn.dataset.act;
      if (btn.dataset.hold) {
        const key = a === 'hold:full' ? 'full' : 'trickle';
        const down = (e) => { e.preventDefault(); this.sfx.resume(); this.held.add(key); btn.classList.add('held'); };
        const up = () => { this.held.delete(key); btn.classList.remove('held'); };
        btn.addEventListener('pointerdown', down);
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointerleave', up);
        btn.addEventListener('pointercancel', up);
      } else {
        btn.addEventListener('click', () => this.dispatch(a));
      }
    });
  }

  setView(name) {
    this.activeView = name;
    this.views[name]?.();
    // the reading card is only in your hand when you are reading the scale
    this.burette.showReadingCard(name === 'meniscus');
    document.querySelectorAll('[data-view]').forEach((b) => {
      b.classList.toggle('active', b.dataset.view === name);
    });
    this.el.crosshair.hidden = name !== 'meniscus';
  }

  // ------------------------------------------------------------ per-frame --
  frame(dt) {
    const s = this.sim;

    // stopcock from held keys / dock buttons / latched value
    let open = this.latched;
    if (this.held.has('full')) open = 1;
    else if (this.held.has('trickle')) open = 0.22;
    if (!this._dragging) s.setStopcock(open);

    const mm = Math.floor(s.clock / 60);
    const ss = Math.floor(s.clock % 60);
    this.el.clock.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

    // The panel never volunteers the delivered volume: that is what the scale
    // on the burette is for. Drops are fair game — you can count those.
    const t = s.trial;
    const lastLogged = s.trials.length ? s.trials[s.trials.length - 1] : null;
    this.el.initial.textContent = t ? t.initial.toFixed(2) : '—';
    this.el.titre.textContent = this.assist && t
      ? (this.burette.reading - t.initialTrue).toFixed(2)
      : (lastLogged ? lastLogged.titre.toFixed(2) : '—');
    this.el.drops.textContent = t ? Math.round(t.delivered / 0.048) : '0';

    const flow = this.burette.flowRate;
    this.el.flow.textContent = flow.toFixed(2);
    this.el.flowBar.style.width = `${Math.min(100, (flow / 2.4) * 100)}%`;

    const ph = s.flask.volumeML > 1 ? s.flask.pH : null;
    this.el.ph.textContent = s.probeIn && ph !== null ? ph.toFixed(2) : '—';
    this.el.phSrc.textContent = s.probeIn ? 'electrode in flask' : 'probe out';

    const pink = s.flask.pink;
    const [r, g, b] = pinkCSS(pink);
    this.el.swatch.style.background = `rgb(${r},${g},${b})`;
    this.el.pink.textContent = pink < VISIBLE_PINK ? 'colourless'
      : pink < 0.28 ? 'faint pink' : pink < 0.60 ? 'pink' : 'deep magenta';

    this.el.assist.textContent = this.assist
      ? `${this.burette.reading.toFixed(2)} mL` : '––.–– mL';

    this._chartAcc = (this._chartAcc || 0) + dt;
    if (this._chartAcc > 0.12) { this._chartAcc = 0; this.drawLiveChart(); }
  }

  /** Hover tooltip for bench objects. */
  showHover(text, sub, x, y) {
    const el = this.el.hover;
    if (!text) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `${text}${sub ? `<i>${sub}</i>` : ''}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  toast(msg, kind = '', ms = 4200) {
    const d = document.createElement('div');
    d.className = `toast ${kind}`;
    d.textContent = msg;
    this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, ms);
  }

  // ---------------------------------------------------------------- charts --
  drawLiveChart() {
    const s = this.sim;
    const pts = s.curve;
    const xMax = Math.max(10, Math.ceil(((pts.at(-1)?.[0] ?? 0) + 4) / 5) * 5);
    drawCurve(this.el.chart, {
      pts, xMax,
      live: pts.length ? pts.at(-1) : null,
      label: s.trial ? `trial ${s.trial.n}` : 'idle',
      pinkNow: s.flask.pink,
    });
    const hint = document.getElementById('chartHint');
    if (hint) hint.textContent = s.probeIn ? 'electrode' : 'true pH (shown for training)';
  }

  // ---------------------------------------------------------------- modals --
  _modalOpen() { return !!document.querySelector('.modal.open'); }
  _closeTopModal() {
    const open = [...document.querySelectorAll('.modal.open')];
    const m = open[open.length - 1];
    if (m && m.id !== 'briefing' && m.id !== 'reportModal') m.classList.remove('open');
  }
  openModal(id) { document.getElementById(id).classList.add('open'); }
  closeModal(id) { document.getElementById(id).classList.remove('open'); }

  openReading() {
    const s = this.sim;
    const which = s.step.id === 'initial' ? 'initial' : 'final';
    if (which === 'final' && !s.trial) { this.toast('No trial in progress.', 'bad'); return; }
    if (which === 'final' && s.flask.pink < VISIBLE_PINK) {
      this.toast('The solution is still colourless — the endpoint has not been reached.', 'warn');
      return;
    }
    if (!s.step.allow.includes(which === 'initial' ? 'read:initial' : 'read:final')) {
      this.toast(`Not part of "${s.stepTitle}".`, 'bad');
      return;
    }
    this._readingWhich = which;
    this.setView('meniscus');
    $('#readTitle').textContent = which === 'initial'
      ? 'Initial burette reading' : 'Final burette reading';
    $('#readCopy').textContent = which === 'initial'
      ? 'Before you add any titrant, log where the meniscus sits now.'
      : `You have called the endpoint${s.flask.pink < 0.2 ? ' at a faint pink' : ''}. Log the meniscus now.`;
    const assistEl = $('#readAssist');
    assistEl.textContent = this.assist
      ? `Training readout: ${this.burette.reading.toFixed(2)} mL` : '';
    assistEl.classList.toggle('assist-on', this.assist);
    const input = $('#readInput');
    input.value = '';
    this.openModal('readingModal');
    setTimeout(() => input.focus(), 60);
  }

  _submitReading() {
    const v = $('#readInput').value.trim();
    if (v === '') { this.toast('Enter a value in mL.', 'bad'); return; }
    const action = this._readingWhich === 'initial' ? 'read:initial' : 'read:final';
    const res = this.sim.attempt(action, v);
    if (res.ok === false) return;
    this.closeModal('readingModal');
    this.toast(res.message, 'good');
    if (this.sim.step.id === 'calculate') this.openCalc();
    this.setView('bench');
  }

  openNotebook() {
    $('#notebookBody').innerHTML = this.trialTable(true);
    this.openModal('notebookModal');
  }

  trialTable(withGuidance) {
    const s = this.sim;
    const fine = s.trials.filter((t) => !t.rough);
    const st = stats(fine.map((t) => t.molarity));
    const rows = s.trials.map((t) => `
      <tr class="${t.rough ? 'rough' : ''}">
        <td>${t.n}${t.rough ? ' (scout)' : ''}</td>
        <td>${t.initial.toFixed(2)}</td>
        <td>${t.final.toFixed(2)}</td>
        <td>${t.titre.toFixed(2)}</td>
        <td>${t.molarity.toFixed(4)}</td>
      </tr>`).join('');
    const pending = s.trial
      ? `<tr><td>${s.trial.n}</td><td>${s.trial.initial.toFixed(2)}</td>
         <td>—</td><td>in progress</td><td>—</td></tr>` : '';
    return `
      <table class="data">
        <thead><tr>
          <th>Trial</th><th>Initial / mL</th><th>Final / mL</th><th>Titre / mL</th><th>c(HCl) / M</th>
        </tr></thead>
        <tbody>${rows}${pending}</tbody>
        ${st.n >= 2 ? `<tfoot><tr>
          <td>mean of ${st.n} precision trials</td><td></td><td></td>
          <td>${(fine.reduce((a, t) => a + t.titre, 0) / st.n).toFixed(3)}</td>
          <td>${st.mean.toFixed(4)}</td></tr>
          <tr><td>relative standard deviation</td><td></td><td></td><td></td>
          <td style="color:${st.rsd < 0.5 ? 'var(--green)' : 'var(--amber)'}">${st.rsd.toFixed(2)} %</td>
          </tr></tfoot>` : ''}
      </table>
      ${withGuidance ? `
        <p class="hint">Each row uses <b>your</b> logged readings and the label value
        c(NaOH) = ${NAOH_NOMINAL_M.toFixed(4)} M with a ${ALIQUOT_ML.toFixed(2)} mL aliquot:
        c(HCl) = c(NaOH)·V(NaOH) / ${ALIQUOT_ML.toFixed(2)}.</p>` : ''}`;
  }

  openCalc() {
    const s = this.sim;
    const fine = s.trials.filter((t) => !t.rough);
    const st = stats(fine.map((t) => t.titre));
    $('#calcBody').innerHTML = `
      ${this.trialTable(false)}
      <h3>Work it through</h3>
      <p class="eq">n(NaOH) = c · V = ${NAOH_NOMINAL_M.toFixed(4)} M × ${(st.mean / 1000).toFixed(5)} L
        = ${(NAOH_NOMINAL_M * st.mean / 1000).toExponential(3)} mol</p>
      <p class="eq">HCl + NaOH → NaCl + H₂O &nbsp;⇒&nbsp; n(HCl) = n(NaOH)</p>
      <p class="eq">c(HCl) = n(HCl) / V(HCl) = n / ${(ALIQUOT_ML / 1000).toFixed(5)} L</p>
      <p class="hint">Use the mean of your concordant precision titres — not the scouting run.
      Give three significant figures.</p>`;
    $('#calcInput').value = '';
    this.openModal('calcModal');
    setTimeout(() => $('#calcInput').focus(), 60);
  }

  _submitCalc() {
    const v = $('#calcInput').value.trim();
    const res = this.sim.attempt('submit:answer', v);
    if (res.ok === false) return;
    this.closeModal('calcModal');
  }

  openReport() {
    const r = this.sim.report;
    if (!r) return;
    const sc = r.scores;
    const bar = (label, val) => `
      <div class="sb"><span>${label}</span>
        <span class="track"><i class="fill" style="width:${Math.max(0, Math.min(100, val)).toFixed(0)}%"></i></span>
        <span class="val">${val.toFixed(0)}</span></div>`;

    const notes = [];
    if (r.notes.includes('dilutedTitrant')) notes.push('The burette was charged while still wet with water, so the titrant in the barrel was slightly weaker than 0.1000 M. That pushes every titre up and your answer high.');
    if (r.notes.includes('bubbleReleased')) notes.push('Air trapped below the stopcock escaped during a titration, adding about 0.22 mL to the burette reading without any titrant reaching the flask.');
    if (r.notes.includes('dilutedAliquot')) notes.push('The pipette still held rinse water, so the 25.00 mL aliquot contained slightly less acid than it should have — your answer comes out low.');
    if (r.notes.includes('tooMuchIndicator')) notes.push('More indicator than the method calls for. Phenolphthalein is itself a weak acid and consumes titrant.');
    if (r.notes.includes('overshoot')) notes.push('At least one endpoint was overshot to a deep pink. The colour change is your only signal — approach it a drop at a time.');
    if (r.notes.includes('skipped:condition')) notes.push('You chose to skip the conditioning rinses. Everything downstream of that was titrated with a slightly weaker base than the label claims.');
    if (r.notes.includes('skipped:purge')) notes.push('You chose to leave the air below the stopcock. It came out during a titration and took a slice of your titre with it.');
    if (r.notes.includes('usedDigitalReadout')) notes.push('The digital burette readout was switched on. On the bench you read the meniscus by eye — try the next run without it.');
    if (r.usedProbe) notes.push('You used the pH electrode. Worth doing once to see the curve, but the method itself is an indicator titration.');
    // credit last, so the list reads problems-first
    if (r.notes.includes('halfDrop')) notes.push('Nice touch: you used a half drop to land the endpoint.');

    $('#reportBody').innerHTML = `
      <div class="grade-row">
        <div class="grade-badge g-${r.grade}">${r.grade}</div>
        <div class="result-lines">
          <div class="big">Your answer: <b>${r.answer.toFixed(4)} mol/L</b></div>
          <div class="big">True value: <b>${r.trueCa.toFixed(4)} mol/L</b> &nbsp; (${r.unknown.id})</div>
          <div>Error: <b style="color:${Math.abs(r.errPct) < 1 ? 'var(--green)' : Math.abs(r.errPct) < 3 ? 'var(--amber)' : 'var(--red)'}">
            ${r.errPct >= 0 ? '+' : ''}${r.errPct.toFixed(2)} %</b>
            &nbsp;·&nbsp; equivalence volume was <b>${r.veqTrue.toFixed(2)} mL</b></div>
          <div>Precision: <b>RSD ${r.stats.n >= 2 ? `${r.stats.rsd.toFixed(2)} %` : 'n/a'}</b>
            &nbsp;·&nbsp; bench time <b>${Math.floor(r.elapsed / 60)}m ${Math.floor(r.elapsed % 60)}s</b></div>
        </div>
      </div>

      <div class="score-bars">
        ${bar('Accuracy', sc.accuracy)}
        ${bar('Precision', sc.precision)}
        ${bar('Technique', sc.technique)}
        ${bar('Safety', sc.safety)}
        ${bar('Overall', sc.overall)}
      </div>

      <h3>Your data</h3>
      ${this.trialTable(false)}

      <h3>Where your endpoints fell</h3>
      <canvas id="reportChart" width="880" height="300"></canvas>

      <h3>Technique review</h3>
      <ul class="tech">
        ${r.technique.map((t) => `<li class="${t.pass ? 'pass' : 'fail'}">
          <span class="mk">${t.pass ? '✔' : '✘'}</span>
          <span class="txt">${t.label}<span class="why">${t.why}</span></span></li>`).join('')}
      </ul>

      ${r.violations.length ? `<h3 style="color:var(--red)">Safety</h3>
        <ul class="tight">${r.violations.map((v) => `<li>${v}</li>`).join('')}</ul>` : ''}

      ${notes.length ? `<h3>What moved your number</h3>
        <ul class="tight">${notes.map((n) => `<li>${n}</li>`).join('')}</ul>` : ''}`;

    this.openModal('reportModal');
    requestAnimationFrame(() => this.drawReportChart(r));
  }

  drawReportChart(r) {
    const canvas = document.getElementById('reportChart');
    if (!canvas) return;
    const curve = theoreticalCurve({
      ca: r.trueCa, va: ALIQUOT_ML, cb: NAOH_NOMINAL_M,
      vMax: Math.max(r.veqTrue * 1.45, 12),
    });
    const marks = r.trials.map((t) => ({
      x: t.titreTrue, y: t.pHAtEnd, label: `T${t.n}`, rough: t.rough,
    }));
    drawCurve(canvas, {
      pts: curve,
      xMax: Math.ceil(Math.max(r.veqTrue * 1.45, 12)),
      marks,
      vLine: r.veqTrue,
      title: 'theoretical curve for the true concentration',
    });
  }
}

/** Perceived pink as a CSS triple, matching the 3D solution colour. */
function pinkCSS(intensity) {
  const t = Math.pow(Math.min(1, Math.max(0, intensity)), 0.75);
  const lerp = (a, b) => Math.round((a + (b - a) * t) * 255);
  return [lerp(0.90, 0.92), lerp(0.95, 0.16), lerp(0.99, 0.52)];
}

/**
 * Shared pH-vs-volume plot used for both the live trace and the debrief.
 */
function drawCurve(canvas, {
  pts = [], xMax = 30, live = null, marks = [], vLine = null, label = '', title = '',
}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  if (canvas.width !== Math.round(cssW * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, cssW, cssH);

  const pad = { l: 30, r: 8, t: 12, b: 22 };
  const W = cssW - pad.l - pad.r;
  const H = cssH - pad.t - pad.b;
  const X = (v) => pad.l + (v / xMax) * W;
  const Y = (ph) => pad.t + (1 - ph / 14) * H;

  // phenolphthalein transition band
  g.fillStyle = 'rgba(234, 42, 140, 0.16)';
  g.fillRect(pad.l, Y(10), W, Y(8.2) - Y(10));
  g.fillStyle = 'rgba(234, 42, 140, 0.75)';
  g.font = '9px ui-monospace, monospace';
  g.textAlign = 'left';
  g.fillText('phenolphthalein', pad.l + 4, Y(10) - 3);

  // grid
  g.strokeStyle = 'rgba(120,160,190,0.16)';
  g.lineWidth = 1;
  g.fillStyle = 'rgba(150,175,195,0.8)';
  g.font = '9px ui-monospace, monospace';
  for (let ph = 0; ph <= 14; ph += 2) {
    g.beginPath(); g.moveTo(pad.l, Y(ph)); g.lineTo(pad.l + W, Y(ph)); g.stroke();
    g.textAlign = 'right';
    g.fillText(String(ph), pad.l - 5, Y(ph) + 3);
  }
  const step = xMax <= 12 ? 2 : xMax <= 30 ? 5 : 10;
  for (let v = 0; v <= xMax; v += step) {
    g.beginPath(); g.moveTo(X(v), pad.t); g.lineTo(X(v), pad.t + H); g.stroke();
    g.textAlign = 'center';
    g.fillText(String(v), X(v), pad.t + H + 12);
  }
  g.textAlign = 'left';
  g.fillStyle = 'rgba(150,175,195,0.65)';
  g.fillText('pH', 4, pad.t + 8);
  g.textAlign = 'right';
  g.fillText('V(NaOH) / mL', pad.l + W, cssH - 4);

  // equivalence marker
  if (vLine != null) {
    g.strokeStyle = 'rgba(255,181,69,0.7)';
    g.setLineDash([4, 3]);
    g.beginPath(); g.moveTo(X(vLine), pad.t); g.lineTo(X(vLine), pad.t + H); g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(255,181,69,0.9)';
    g.textAlign = 'center';
    g.fillText(`V(eq) ${vLine.toFixed(2)}`, X(vLine), pad.t + 9);
  }

  // trace
  if (pts.length > 1) {
    g.strokeStyle = '#4fd6ff';
    g.lineWidth = 1.8;
    g.beginPath();
    pts.forEach(([v, ph], i) => (i ? g.lineTo(X(v), Y(ph)) : g.moveTo(X(v), Y(ph))));
    g.stroke();
  }

  if (live) {
    g.fillStyle = '#4fd6ff';
    g.beginPath();
    g.arc(X(live[0]), Y(live[1]), 3, 0, Math.PI * 2);
    g.fill();
  }

  // Concordant titres land almost on top of each other — which is the point —
  // so stagger the labels rather than letting them overprint.
  marks.forEach((m, i) => {
    g.fillStyle = m.rough ? 'rgba(150,175,195,0.85)' : '#52e0a3';
    g.beginPath();
    g.arc(X(m.x), Y(m.y), 4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = m.rough ? 'rgba(150,175,195,0.9)' : '#52e0a3';
    g.textAlign = 'left';
    g.fillText(m.label, X(m.x) + 7, Y(m.y) - 6 - i * 12);
  });

  if (label) {
    g.fillStyle = 'rgba(150,175,195,0.7)';
    g.textAlign = 'right';
    g.fillText(label, pad.l + W - 2, pad.t + 9);
  }
  if (title) {
    g.fillStyle = 'rgba(150,175,195,0.6)';
    g.textAlign = 'left';
    g.fillText(title, pad.l + 4, cssH - 4);
  }
}
