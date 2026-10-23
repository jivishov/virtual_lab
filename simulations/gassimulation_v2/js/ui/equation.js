/**
 * "Check the law": state 1 (recorded) against now, with the law's prediction
 * and, when they disagree, the physical reason.
 */
import { R, P_ATM, atmTo } from '../model/units.js';
import { LAWS } from '../model/laws.js';
import { sig, num, unitFor, MINUS } from './format.js';

const SUB = { 1: '₁', 2: '₂' };

/** Why the amount of gas changed, in each system's own terms. */
const N_REASON = {
  hotAirBalloon: (up) => (up ? 'Outside air flowed in through the mouth as the envelope cooled.' : 'Air left through the mouth. The envelope is full, so the hot air cannot expand any further.'),
  pressureCooker: (up) => (up ? 'Water evaporated, adding water vapor molecules to the gas.' : 'Steam left through the vent.'),
  scubaTank: (up) => (up ? 'Air was pumped in.' : 'Air was let out.'),
  partyBalloon: (up) => (up ? 'Gas was added.' : 'Gas escaped.'),
};

function changed(a, b, rel = 0.005) {
  return Math.abs(a - b) > rel * Math.max(Math.abs(a), Math.abs(b), 1e-12);
}

/**
 * Pure: compare two measured states under a law.
 * Returns { rows, invariant: [inv1, inv2], prediction: { key, value } | null, actual, diff, reasons[] }.
 */
export function compare(lawId, scenarioId, s1, s2) {
  const law = LAWS[lawId];
  const keys = { boyle: ['P', 'V'], charles: ['V', 'T'], gayLussac: ['P', 'T'], avogadro: ['V', 'n'], ideal: ['P', 'V', 'n', 'T'] }[lawId];
  const inv = law.invariant.of;
  const out = { keys, inv: [inv(s1), inv(s2)], prediction: null, actual: null, diff: null, reasons: [] };
  const y = law.responds;
  let pred = null;
  if (lawId === 'boyle') pred = (s1.P * s1.V) / s2.V;
  else if (lawId === 'charles') pred = (s1.V * s2.T) / s1.T;
  else if (lawId === 'gayLussac') pred = (s1.P * s2.T) / s1.T;
  else if (lawId === 'avogadro') pred = s1.n > 1e-9 ? (s1.V * s2.n) / s1.n : NaN;
  else if (lawId === 'ideal') pred = (s2.n * R * s2.T) / s2.V;
  out.prediction = { key: y, value: pred };
  out.actual = s2[y];
  out.diff = Number.isFinite(pred) && pred !== 0 ? s2[y] / pred - 1 : NaN;

  if (Math.abs(out.diff) > 0.01 && lawId !== 'ideal') {
    for (const k of law.held) {
      if (!changed(s1[k], s2[k], k === 'T' ? 0.002 : 0.005)) continue;
      if (k === 'T') {
        const d = s2.T - s1.T;
        out.reasons.push(`The temperature is ${num(Math.abs(d), 1)} K ${d > 0 ? 'higher' : 'lower'} than in state 1, so it was not held constant. ${scenarioId === 'syringe' ? 'Wait for the gas to return to room temperature.' : ''}`.trim());
      } else if (k === 'n') {
        const up = s2.n > s1.n;
        out.reasons.push(`The amount of gas changed by ${num(Math.abs(s2.n / s1.n - 1) * 100, 0)}%. ${(N_REASON[scenarioId] ?? (() => 'The amount of gas changed.'))(up)}`);
      } else if (k === 'V') {
        out.reasons.push(`The volume changed by ${num(Math.abs(s2.V / s1.V - 1) * 100, 1)}%${scenarioId === 'pressureCooker' ? ': boiling water away leaves more room for gas' : ''}.`);
      } else if (k === 'P') {
        out.reasons.push('The pressure changed.');
      }
    }
    if (!out.reasons.length) out.reasons.push('The readings are still changing, or they are rounded. Wait for them to settle.');
  }
  return out;
}

function value(scId, k, v) {
  const u = unitFor(scId, k);
  return `${sig(u.of(v), 4)} ${u.unit}`;
}

/** HTML for the check panel. */
export function renderCheck(view, s1, s2) {
  const scId = view.scenario.id;
  const lawId = view.law.id;
  const law = LAWS[lawId];
  const c = compare(lawId, scId, s1, s2);
  const head = `<tr><th></th><th scope="col">State 1</th><th scope="col">Now</th></tr>`;
  const rows = c.keys.map((k) => `<tr><th scope="row">${k}</th><td>${value(scId, k, s1[k])}</td><td>${value(scId, k, s2[k])}</td></tr>`).join('');

  // Invariant row in display units, so students can check it by hand.
  const invDisplay = (s) => {
    const u = (k) => unitFor(scId, k).of(s[k]);
    switch (lawId) {
      case 'boyle': return [u('P') * u('V'), `${unitFor(scId, 'P').unit}·${unitFor(scId, 'V').unit}`];
      case 'charles': return [u('V') / u('T'), `${unitFor(scId, 'V').unit}/K`];
      case 'gayLussac': return [u('P') / u('T'), `${unitFor(scId, 'P').unit}/K`];
      case 'avogadro': return [s.n > 1e-9 ? u('V') / u('n') : NaN, `${unitFor(scId, 'V').unit}/mol`];
      default: return [s.n > 1e-9 ? (s.P * s.V) / (s.n * s.T) : NaN, 'L·atm/(mol·K)'];
    }
  };
  const [i1, unit] = invDisplay(s1);
  const [i2] = invDisplay(s2);
  const invRow = `<tr class="inv"><th scope="row">${law.invariant.label}</th><td>${sig(i1, 4)}</td><td>${sig(i2, 4)} <span class="u">${unit}</span></td></tr>`;

  const y = c.prediction.key;
  const yu = unitFor(scId, y);
  const ok = Math.abs(c.diff) <= 0.01;
  const sign = c.diff >= 0 ? '+' : MINUS;
  let predLine;
  if (lawId === 'ideal') {
    predLine = `<p class="pred">From n, T and V now: <span class="math">P = nRT/V = ${sig(s2.n, 4)} × 0.08206 × ${sig(s2.T, 4)} / ${sig(s2.V, 4)} = <b>${sig(c.prediction.value, 4)} atm</b></span></p>`;
  } else {
    const expr = {
      boyle: `P${SUB[2]} = P${SUB[1]}V${SUB[1]} / V${SUB[2]}`,
      charles: `V${SUB[2]} = V${SUB[1]} × T${SUB[2]} / T${SUB[1]}`,
      gayLussac: `P${SUB[2]} = P${SUB[1]} × T${SUB[2]} / T${SUB[1]}`,
      avogadro: `V${SUB[2]} = V${SUB[1]} × n${SUB[2]} / n${SUB[1]}`,
    }[lawId];
    predLine = `<p class="pred">${law.name} predicts <span class="math">${expr} = <b>${sig(yu.of(c.prediction.value), 4)} ${yu.unit}</b></span></p>`;
  }
  const verdict = Number.isFinite(c.diff)
    ? `<p class="verdict ${ok ? 'ok' : 'off'}">${ok ? `Measured ${sig(yu.of(c.actual), 4)} ${yu.unit}: matches within ${num(Math.abs(c.diff) * 100, 1)}%.` : `Measured ${sig(yu.of(c.actual), 4)} ${yu.unit}: ${sign}${num(Math.abs(c.diff) * 100, 1)}% from the prediction.`}</p>`
    : '<p class="verdict">Record state 1 once there is gas in the balloon.</p>';
  const why = c.reasons.length ? `<ul class="why">${c.reasons.map((r) => `<li>${r}</li>`).join('')}</ul>` : '';

  // Gauge pressure has to be converted before it goes into a gas law.
  let gaugeLine = '';
  const rd = view.reading;
  if (rd && rd.quantity === 'P' && rd.reference === 'gauge') {
    const atmIn = atmTo(P_ATM, rd.unit);
    const abs = rd.value + atmIn;
    const extra = rd.unit === 'atm' ? '' : ` = ${sig(abs / atmTo(1, rd.unit), 4)} atm`;
    gaugeLine = `<p class="gauge">The gauge shows ${rd.text} ${rd.unit} above the air outside. Absolute pressure: ${rd.text} + ${num(atmIn, 1)} = <b>${sig(abs, 4)} ${rd.unit}</b>${extra}.</p>`;
  } else if (rd && rd.quantity === 'P' && rd.overRange) {
    gaugeLine = '<p class="gauge">The sensor is over range, so the table uses the model value.</p>';
  }

  return `<table class="check">${head}${rows}${invRow}</table>${gaugeLine}${predLine}${verdict}${why}`;
}
