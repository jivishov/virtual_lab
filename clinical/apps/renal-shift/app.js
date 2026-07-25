/**
 * RenalShift — interface wiring.
 *
 * Responsibilities kept deliberately narrow: read the form, build a scenario,
 * call the engine, render. No pharmacology lives in this file, and no output
 * produced here may recommend an action (see governance/claim-language.md).
 */

import { DRUG_DATA } from '../../data/drugs.js';
import { simulate, expandRegimen } from '../../packages/simulate.js';
import { computeMetrics, counterfactualEventImpact } from '../../packages/metrics.js';
import { MODALITIES, UNMODELLED_EFFECTS } from '../../packages/crrt.js';
import { lineChart, stackedArea } from '../../packages/chart.js';
import { mlMinToLh, lhToMlKgH } from '../../packages/units.js';

const $ = (id) => /** @type {HTMLInputElement|HTMLSelectElement} */ (document.getElementById(id));
const num = (id) => Number($(id).value);

/** @type {{time: number, running: boolean, settings: any}[]} */
let eventRows = [];
/** @type {object|null} */
let pinned = null;

/* ----------------------------------------------------------- event rows */

const DEFAULT_SETTINGS = () => ({
  modality: MODALITIES.CVVHDF,
  bloodFlowMlMin: 200,
  dialysateFlowLh: 1.0,
  preReplacementFlowLh: 0,
  postReplacementFlowLh: 0.65,
  netUltrafiltrationLh: 0.1,
});

function seedEvents() {
  eventRows = [
    { time: 0, running: true, settings: DEFAULT_SETTINGS() },
    { time: 10, running: false, settings: null },
    { time: 14, running: true, settings: { ...DEFAULT_SETTINGS(), dialysateFlowLh: 1.5, postReplacementFlowLh: 1.0 } },
  ];
}

function renderEventRows() {
  const host = document.getElementById('crrtEvents');
  host.textContent = '';

  eventRows.forEach((ev, i) => {
    const row = document.createElement('div');
    row.className = 'event-row';

    const head = document.createElement('div');
    head.className = 'event-head';

    const timeLabel = document.createElement('label');
    const timeSpan = document.createElement('span');
    timeSpan.textContent = 'At (h)';
    const timeInput = document.createElement('input');
    timeInput.type = 'number';
    timeInput.step = '0.5';
    timeInput.min = '0';
    timeInput.value = String(ev.time);
    timeInput.addEventListener('input', () => { ev.time = Number(timeInput.value); refresh(); });
    timeLabel.append(timeSpan, timeInput);

    const stateSelect = document.createElement('select');
    for (const [val, text] of [['running', 'CRRT running'], ['stopped', 'CRRT stopped']]) {
      const o = document.createElement('option');
      o.value = val;
      o.textContent = text;
      if ((val === 'running') === ev.running) o.selected = true;
      stateSelect.appendChild(o);
    }
    stateSelect.addEventListener('change', () => {
      ev.running = stateSelect.value === 'running';
      ev.settings = ev.running ? (ev.settings ?? DEFAULT_SETTINGS()) : null;
      renderEventRows();
      refresh();
    });

    head.append(timeLabel, stateSelect);

    if (eventRows.length > 1) {
      const drop = document.createElement('button');
      drop.type = 'button';
      drop.className = 'drop';
      drop.textContent = '×';
      drop.title = 'Remove this event';
      drop.setAttribute('aria-label', `Remove event at ${ev.time} hours`);
      drop.addEventListener('click', () => {
        eventRows.splice(i, 1);
        renderEventRows();
        refresh();
      });
      head.appendChild(drop);
    }
    row.appendChild(head);

    if (ev.running) {
      const flows = document.createElement('div');
      flows.className = 'event-flows';

      const modLabel = document.createElement('label');
      const modSpan = document.createElement('span');
      modSpan.textContent = 'Modality';
      const modSelect = document.createElement('select');
      for (const m of Object.keys(MODALITIES)) {
        const o = document.createElement('option');
        o.value = m;
        o.textContent = m;
        if (m === ev.settings.modality) o.selected = true;
        modSelect.appendChild(o);
      }
      modSelect.addEventListener('change', () => {
        ev.settings.modality = modSelect.value;
        refresh();
      });
      modLabel.append(modSpan, modSelect);
      flows.appendChild(modLabel);

      const fields = [
        ['bloodFlowMlMin', 'Blood flow (mL/min)', 10],
        ['dialysateFlowLh', 'Dialysate (L/h)', 0.1],
        ['preReplacementFlowLh', 'Pre-dilution (L/h)', 0.1],
        ['postReplacementFlowLh', 'Post-dilution (L/h)', 0.1],
        ['netUltrafiltrationLh', 'Net UF (L/h)', 0.05],
      ];
      for (const [key, text, step] of fields) {
        const l = document.createElement('label');
        const s = document.createElement('span');
        s.textContent = text;
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.step = String(step);
        inp.min = '0';
        inp.value = String(ev.settings[key]);
        inp.addEventListener('input', () => {
          ev.settings[key] = Number(inp.value);
          refresh();
        });
        l.append(s, inp);
        flows.appendChild(l);
      }
      row.appendChild(flows);
    } else {
      const note = document.createElement('p');
      note.className = 'event-off';
      note.textContent = 'Circuit off — only non-renal and residual renal clearance apply.';
      row.appendChild(note);
    }

    host.appendChild(row);
  });
}

/* ------------------------------------------------------ scenario build */

function readForm() {
  return {
    fu: num('fu'),
    clNonrenal: num('clNonrenal'),
    v1: num('v1'),
    q2: num('q2'),
    v2: num('v2'),
    clResidual: num('clResidual'),
    weight: num('weight'),
    hct: num('hct'),
    dose: num('dose'),
    infDur: num('infDur'),
    interval: num('interval'),
    nDoses: num('nDoses'),
    loadDose: num('loadDose'),
    loadDur: num('loadDur'),
    mic: num('mic'),
    targetMult: num('targetMult'),
    duration: num('duration'),
    evalStart: num('evalStart'),
    provenanceNote: /** @type {HTMLInputElement} */ ($('provenanceNote')).value.trim(),
    events: structuredClone(eventRows),
  };
}

/**
 * @param {ReturnType<typeof readForm>} f
 * @param {string} label
 */
function buildScenario(f, label) {
  const crrtEvents = f.events
    .slice()
    .sort((a, b) => a.time - b.time)
    .map((ev) => ({
      time: ev.time,
      running: ev.running,
      settings: ev.running
        ? {
          modality: ev.settings.modality,
          bloodFlow: mlMinToLh(ev.settings.bloodFlowMlMin),
          dialysateFlow: ev.settings.dialysateFlowLh,
          preReplacementFlow: ev.settings.preReplacementFlowLh,
          postReplacementFlow: ev.settings.postReplacementFlowLh,
          netUltrafiltration: ev.settings.netUltrafiltrationLh,
          haematocrit: f.hct,
          sievingCoefficient: f.fu,
          saturationCoefficient: f.fu,
        }
        : null,
    }));

  if (!crrtEvents.length || crrtEvents[0].time > 0) {
    crrtEvents.unshift({ time: 0, running: false, settings: null });
  }

  return {
    id: label,
    label,
    drug: {
      name: 'user-supplied parameter set',
      unboundFraction: f.fu,
      nonrenalClearance: f.clNonrenal,
      V1: f.v1,
      Q2: f.q2 > 0 ? f.q2 : undefined,
      V2: f.q2 > 0 && f.v2 > 0 ? f.v2 : undefined,
    },
    patient: { weightKg: f.weight, haematocrit: f.hct },
    residualRenal: [{ time: 0, clearance: f.clResidual }],
    crrtEvents,
    doses: expandRegimen({
      firstDoseTime: 0,
      amount: f.dose,
      infusionDuration: f.infDur,
      intervalH: f.interval,
      numberOfDoses: f.nDoses,
      loadingDose: f.loadDose > 0 ? { amount: f.loadDose, infusionDuration: f.loadDur } : undefined,
    }),
    durationH: f.duration,
  };
}

/** Intervals during which CRRT is stopped, for chart shading. */
function offBands(sc) {
  const bands = [];
  for (let i = 0; i < sc.crrtEvents.length; i++) {
    const ev = sc.crrtEvents[i];
    if (ev.running) continue;
    const end = i + 1 < sc.crrtEvents.length ? sc.crrtEvents[i + 1].time : sc.durationH;
    if (end > ev.time) bands.push({ x0: ev.time, x1: end, label: 'CRRT off' });
  }
  return bands;
}

/* ------------------------------------------------------------- render */

const fmtN = (v, dp = 2) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(dp));

function metricRows(m) {
  return [
    ['Time above target', `${fmtN(m.percentTimeAboveTarget, 1)} %`, m.percentTimeAboveTarget, 1],
    ['Hours above target', `${fmtN(m.hoursAboveTarget, 2)} h`, m.hoursAboveTarget, 2],
    ['Unbound AUC over window', `${fmtN(m.freeAuc, 1)} mg·h/L`, m.freeAuc, 1],
    ['Unbound AUC / MIC', fmtN(m.freeAucOverMic, 1), m.freeAucOverMic, 1],
    ['Unbound Cmax', `${fmtN(m.freeCmax, 2)} mg/L`, m.freeCmax, 2],
    ['Unbound Cmin', `${fmtN(m.freeCmin, 3)} mg/L`, m.freeCmin, 3],
  ];
}

function renderMetrics(current, comparison) {
  const tbody = document.querySelector('#metricsTable tbody');
  tbody.textContent = '';

  const rowsA = metricRows(current);
  const rowsB = comparison ? metricRows(comparison) : null;

  rowsA.forEach(([name, text, value, dp], i) => {
    const tr = document.createElement('tr');
    const th = document.createElement('td');
    th.textContent = name;
    const tdA = document.createElement('td');
    tdA.className = 'num';
    tdA.textContent = text;
    const tdB = document.createElement('td');
    tdB.className = 'num';
    tdB.textContent = rowsB ? rowsB[i][1] : '—';
    const tdD = document.createElement('td');
    tdD.className = 'num';
    if (rowsB && Number.isFinite(value) && Number.isFinite(rowsB[i][2])) {
      const d = value - rowsB[i][2];
      tdD.textContent = `${d >= 0 ? '+' : ''}${d.toFixed(dp)}`;
    } else {
      tdD.textContent = '—';
    }
    tr.append(th, tdA, tdB, tdD);
    tbody.appendChild(tr);
  });
}

function renderEventImpacts(sc, f) {
  const tbody = document.querySelector('#eventTable tbody');
  tbody.textContent = '';

  const impacts = sc.crrtEvents
    .map((_, i) => counterfactualEventImpact(sc, i, {
      mic: f.mic, targetMultiple: f.targetMult, maxWindowH: Math.min(f.interval, 12),
    }))
    .filter(Boolean);

  if (!impacts.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = 'No CRRT changes within the simulated period.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const imp of impacts) {
    const tr = document.createElement('tr');

    const label = document.createElement('td');
    label.textContent =
      `${imp.event.running ? 'CRRT started' : 'CRRT stopped'} at ${imp.event.time} h `
      + `(${imp.windowStart.toFixed(1)}–${imp.windowEnd.toFixed(1)} h)`;

    const actual = document.createElement('td');
    actual.className = 'num';
    actual.textContent = `${imp.actual.percentTimeAboveTarget.toFixed(1)} %`;

    const cf = document.createElement('td');
    cf.className = 'num';
    cf.textContent = `${imp.counterfactual.percentTimeAboveTarget.toFixed(1)} %`;

    const delta = document.createElement('td');
    delta.className = 'num';
    const d = imp.deltaPercentTimeAboveTarget;
    delta.textContent = `${d >= 0 ? '+' : ''}${d.toFixed(1)} pp`;

    const auc = document.createElement('td');
    auc.className = 'num';
    const da = imp.deltaFreeAuc;
    auc.textContent = `${da >= 0 ? '+' : ''}${da.toFixed(1)} mg·h/L`;

    tr.append(label, actual, cf, delta, auc);
    tbody.appendChild(tr);
  }
}

function renderProvenance(f, sc) {
  const host = document.getElementById('provenanceBody');
  host.textContent = '';

  const section = (title, items) => {
    const h = document.createElement('h3');
    h.textContent = title;
    const ul = document.createElement('ul');
    for (const item of items) {
      const li = document.createElement('li');
      if (typeof item === 'string') li.textContent = item;
      else li.append(...item);
      ul.appendChild(li);
    }
    host.append(h, ul);
  };

  const flag = () => {
    const s = document.createElement('span');
    s.className = 'flag';
    s.textContent = f.provenanceNote ? 'user-supplied' : 'illustrative';
    return s;
  };

  section('Parameter provenance', [
    [flag(), document.createTextNode(
      ` ${f.provenanceNote || 'No source recorded. The values in use are illustrative placeholders and must not be relied upon.'}`
    )],
    `Unbound fraction ${f.fu}; non-renal clearance ${f.clNonrenal} L/h; V1 ${f.v1} L; ` +
    `Q ${f.q2} L/h; V2 ${f.v2} L; residual renal clearance ${f.clResidual} L/h.`,
    `Sieving and saturation coefficients are both set equal to the unbound fraction (${f.fu}). ` +
    'These are distinct measured quantities; substituting the unbound fraction is an approximation.',
  ]);

  section('Model structure', [
    `${sc.drug.Q2 ? 'Two' : 'One'}-compartment mammillary model with first-order elimination from the central compartment.`,
    'Total clearance = non-renal + residual renal + extracorporeal, evaluated as a step function of time.',
    'Extracorporeal clearance is decomposed into diffusive (saturation coefficient x dialysate flow) ' +
    'and convective (sieving coefficient x filtration rate) components, with a pre-dilution correction ' +
    'of Qp/(Qp + Qpre) applied to the whole filter clearance.',
    'Within each interval between events the system is linear and time-invariant and is solved exactly ' +
    'by matrix exponential, so no integration step crosses an event boundary.',
  ]);

  section('Not modelled', UNMODELLED_EFFECTS);

  section('Verification status', [
    'Software and numerical verification: complete. 110 automated checks, including agreement with an ' +
    'independent Dormand-Prince integrator to about 4e-12 relative, and closed-form checks on every metric.',
    'External validation against clinical observations: not performed. No qualified population model is bundled.',
    'Clinical impact: not established and not claimed.',
  ]);
}

function showError(message) {
  const box = document.getElementById('errorBox');
  if (!message) {
    box.hidden = true;
    box.textContent = '';
    return;
  }
  box.hidden = false;
  box.textContent = message;
}

/* ------------------------------------------------------------ refresh */

function refresh() {
  let f;
  try {
    f = readForm();
    const sc = buildScenario(f, 'current');

    const evalStart = Math.min(f.evalStart, Math.max(0, sc.durationH - 0.5));
    const evalEnd = Math.min(evalStart + f.interval, sc.durationH);
    if (evalEnd <= evalStart) throw new Error('The evaluation window has no width. Reduce its start time or extend the simulation.');

    const result = simulate(sc);
    const metrics = computeMetrics(result, sc, {
      mic: f.mic, targetMultiple: f.targetMult, t0: evalStart, t1: evalEnd,
    });

    let pinnedResult = null;
    let pinnedMetrics = null;
    if (pinned) {
      const scP = buildScenario(pinned, 'comparison');
      pinnedResult = simulate(scP);
      const pStart = Math.min(pinned.evalStart, Math.max(0, scP.durationH - 0.5));
      const pEnd = Math.min(pStart + pinned.interval, scP.durationH);
      pinnedMetrics = computeMetrics(pinnedResult, scP, {
        mic: pinned.mic, targetMultiple: pinned.targetMult, t0: pStart, t1: pEnd,
      });
    }

    /* concentration chart */
    const series = [{
      name: 'current',
      points: result.t.map((t, i) => [t, result.cFree[i]]),
      stroke: 'var(--accent)',
      width: 2,
    }];
    if (pinnedResult) {
      series.push({
        name: 'comparison',
        points: pinnedResult.t.map((t, i) => [t, pinnedResult.cFree[i]]),
        stroke: 'var(--compare)',
        dash: '6 4',
        width: 1.75,
      });
    }

    lineChart(document.getElementById('concChart'), {
      series,
      bands: offBands(sc),
      hlines: [{
        y: f.mic * f.targetMult,
        label: `target ${f.targetMult > 1 ? `${f.targetMult}×` : ''}MIC = ${(f.mic * f.targetMult).toFixed(2)} mg/L`,
      }],
      vlines: sc.crrtEvents.filter((e) => e.time > 0).map((e) => ({ x: e.time })),
      xLabel: 'Time (h)',
      yLabel: 'Unbound concentration (mg/L)',
      xMin: 0,
      xMax: sc.durationH,
    });

    const legend = document.getElementById('concLegend');
    legend.textContent = '';
    const mkKey = (cls, text) => {
      const s = document.createElement('span');
      s.className = 'key';
      const i = document.createElement('i');
      i.className = cls;
      s.append(i, document.createTextNode(text));
      return s;
    };
    legend.appendChild(mkKey('line', 'Current'));
    if (pinnedResult) legend.appendChild(mkKey('line-dash', 'Pinned comparison'));

    /* clearance decomposition */
    stackedArea(document.getElementById('clChart'), {
      t: result.t,
      layers: [
        { name: 'Non-renal', values: result.clNonrenal, fill: 'var(--c-nonrenal)' },
        { name: 'Residual renal', values: result.clResidual, fill: 'var(--c-residual)' },
        { name: 'Extracorporeal', values: result.clCrrt, fill: 'var(--c-crrt)' },
      ],
      bands: offBands(sc),
      xLabel: 'Time (h)',
      yLabel: 'Clearance (L/h)',
    });

    /* captions and tables */
    const onSettings = sc.crrtEvents.find((e) => e.running);
    const effluent = onSettings
      ? onSettings.settings.dialysateFlow + onSettings.settings.preReplacementFlow
        + onSettings.settings.postReplacementFlow + onSettings.settings.netUltrafiltration
      : 0;

    document.getElementById('chartCaption').textContent =
      `Evaluation window ${evalStart.toFixed(1)}–${evalEnd.toFixed(1)} h. `
      + (onSettings
        ? `First running prescription delivers ${effluent.toFixed(2)} L/h effluent `
          + `(${lhToMlKgH(effluent, f.weight).toFixed(0)} mL/kg/h at ${f.weight} kg). `
        : 'No CRRT running in this scenario. ')
      + 'Shaded regions are periods with the circuit off.';

    renderMetrics(metrics, pinnedMetrics);
    renderEventImpacts(sc, f);
    renderProvenance(f, sc);

    document.getElementById('comparisonNote').textContent = pinnedMetrics
      ? 'The two columns describe different scenarios under the same model and assumptions. '
        + 'The application does not determine which regimen is appropriate.'
      : 'Pin a scenario to compare two timelines side by side.';

    /* warnings */
    const warnSection = document.getElementById('warningSection');
    const list = document.getElementById('warningList');
    list.textContent = '';
    if (result.warnings.length) {
      warnSection.hidden = false;
      for (const w of result.warnings) {
        const li = document.createElement('li');
        li.textContent = w;
        list.appendChild(li);
      }
    } else {
      warnSection.hidden = true;
    }

    showError(null);
  } catch (err) {
    showError(`Could not run the scenario: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/* --------------------------------------------------------------- init */

function initPresets() {
  const sel = /** @type {HTMLSelectElement} */ ($('drugPreset'));
  for (const d of DRUG_DATA.drugs) {
    const o = document.createElement('option');
    o.value = d.id;
    o.textContent = d.name;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => {
    const d = DRUG_DATA.drugs.find((x) => x.id === sel.value);
    if (!d) return;
    const p = d.parameters;
    $('fu').value = String(p.unboundFraction.value);
    $('clNonrenal').value = String(p.nonrenalClearance.value);
    $('v1').value = String(p.V1.value);
    $('q2').value = String(p.Q2.value);
    $('v2').value = String(p.V2.value);
    $('mic').value = String(d.defaultTarget.mic);
    $('targetMult').value = String(d.defaultTarget.targetMultiple);
    /** @type {HTMLInputElement} */ ($('provenanceNote')).value = '';
    refresh();
  });
}

function init() {
  initPresets();
  seedEvents();
  renderEventRows();

  document.getElementById('controls').addEventListener('input', (e) => {
    // Event-row inputs manage their own listeners; ignore them here.
    if (/** @type {HTMLElement} */ (e.target).closest('.event-row')) return;
    refresh();
  });

  document.getElementById('addEvent').addEventListener('click', () => {
    const last = eventRows[eventRows.length - 1];
    eventRows.push({
      time: (last ? last.time : 0) + 4,
      running: !(last && last.running),
      settings: last && last.running ? null : DEFAULT_SETTINGS(),
    });
    renderEventRows();
    refresh();
  });

  document.getElementById('pin').addEventListener('click', () => {
    pinned = readForm();
    /** @type {HTMLButtonElement} */ (document.getElementById('clearPin')).disabled = false;
    refresh();
  });

  document.getElementById('clearPin').addEventListener('click', () => {
    pinned = null;
    /** @type {HTMLButtonElement} */ (document.getElementById('clearPin')).disabled = true;
    refresh();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refresh, 120);
  });

  refresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
