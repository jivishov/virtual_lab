/**
 * Scenario assembly and simulation.
 *
 * The timeline is cut at every discontinuity so that no integration step ever
 * straddles an event. Getting this wrong is the defect that makes naive CRRT
 * simulators wrong precisely where they are most interesting: at the moment
 * the circuit stops.
 */

import { advanceSegment, compartmentCount } from './pk-segment.js';
import { computeCrrtClearance } from './crrt.js';
import { requireFinite, requireFraction } from './units.js';

/** Dense output resolution, hours. 0.005 h = 18 s. */
export const OUTPUT_STEP_H = 0.005;

/**
 * @typedef {object} Dose
 * @property {number} startTime         h
 * @property {number} amount            mg
 * @property {number} infusionDuration  h  (0 = bolus, handled as a very short infusion)
 */

/**
 * @typedef {object} CrrtEvent
 * @property {number} time     h
 * @property {boolean} running
 * @property {import('./crrt.js').CrrtSettings|null} settings
 */

/**
 * @typedef {object} Scenario
 * @property {string} id
 * @property {string} label
 * @property {{name: string, unboundFraction: number, nonrenalClearance: number,
 *            V1: number, Q2?: number, V2?: number}} drug
 * @property {{weightKg: number, haematocrit: number}} patient
 * @property {{time: number, clearance: number}[]} residualRenal
 * @property {CrrtEvent[]} crrtEvents
 * @property {Dose[]} doses
 * @property {number} durationH
 */

/**
 * Expand a repeating regimen into explicit doses.
 *
 * @param {{firstDoseTime: number, amount: number, infusionDuration: number,
 *          intervalH: number, numberOfDoses: number,
 *          loadingDose?: {amount: number, infusionDuration: number}}} regimen
 * @returns {Dose[]}
 */
export function expandRegimen(regimen) {
  const doses = [];
  const {
    firstDoseTime, amount, infusionDuration, intervalH, numberOfDoses, loadingDose,
  } = regimen;

  requireFinite(firstDoseTime, 'firstDoseTime', { min: 0 });
  requireFinite(amount, 'amount', { min: 0 });
  requireFinite(infusionDuration, 'infusionDuration', { min: 0 });
  requireFinite(intervalH, 'intervalH', { min: 0 });
  requireFinite(numberOfDoses, 'numberOfDoses', { min: 0 });

  let cursor = firstDoseTime;
  if (loadingDose && loadingDose.amount > 0) {
    doses.push({
      startTime: cursor,
      amount: loadingDose.amount,
      infusionDuration: loadingDose.infusionDuration,
      label: 'loading',
    });
    cursor += Math.max(loadingDose.infusionDuration, 0);
  }

  for (let i = 0; i < numberOfDoses; i++) {
    doses.push({
      startTime: cursor + i * intervalH,
      amount,
      infusionDuration,
      label: 'maintenance',
    });
  }
  return doses;
}

/**
 * Value of a right-continuous step function at time t.
 * @template T
 * @param {{time: number}[]} points sorted ascending
 * @param {number} t
 * @returns {T|null}
 */
function stepValueAt(points, t) {
  let current = null;
  for (const p of points) {
    if (p.time <= t + 1e-12) current = p;
    else break;
  }
  return /** @type {any} */ (current);
}

/**
 * Collect every time at which the governing equations change.
 * @param {Scenario} sc
 * @returns {number[]} sorted unique breakpoints within [0, durationH]
 */
export function buildBreakpoints(sc) {
  const set = new Set([0, sc.durationH]);
  const add = (t) => {
    if (t > 1e-12 && t < sc.durationH - 1e-12) set.add(Number(t.toFixed(9)));
  };

  for (const d of sc.doses) {
    add(d.startTime);
    add(d.startTime + Math.max(d.infusionDuration, 0));
  }
  for (const e of sc.crrtEvents) add(e.time);
  for (const r of sc.residualRenal) add(r.time);

  return [...set].sort((a, b) => a - b);
}

/**
 * Total infusion rate into the central compartment at time t (mg/h).
 * A dose with zero infusion duration is treated as a bolus and is applied as
 * an instantaneous amount at its start time rather than as a rate.
 *
 * @param {Dose[]} doses
 * @param {number} tMid  a time strictly inside the segment
 * @returns {number} mg/h
 */
function infusionRateAt(doses, tMid) {
  let rate = 0;
  for (const d of doses) {
    if (d.infusionDuration <= 0) continue;
    const end = d.startTime + d.infusionDuration;
    if (tMid > d.startTime && tMid < end) rate += d.amount / d.infusionDuration;
  }
  return rate;
}

/**
 * Bolus amount delivered exactly at time t.
 * @param {Dose[]} doses
 * @param {number} t
 * @returns {number} mg
 */
function bolusAt(doses, t) {
  let amt = 0;
  for (const d of doses) {
    if (d.infusionDuration <= 0 && Math.abs(d.startTime - t) < 1e-9) amt += d.amount;
  }
  return amt;
}

/**
 * Clearance decomposition in force at time t.
 * @param {Scenario} sc
 * @param {number} t
 */
export function clearanceAt(sc, t) {
  const nonrenal = sc.drug.nonrenalClearance;
  const residualPoint = stepValueAt(sc.residualRenal, t);
  const residual = residualPoint ? residualPoint.clearance : 0;

  const crrtPoint = /** @type {CrrtEvent|null} */ (stepValueAt(sc.crrtEvents, t));
  let crrt = 0;
  let crrtDetail = null;
  let running = false;

  if (crrtPoint && crrtPoint.running && crrtPoint.settings) {
    const settings = {
      ...crrtPoint.settings,
      haematocrit: sc.patient.haematocrit,
      sievingCoefficient: crrtPoint.settings.sievingCoefficient ?? sc.drug.unboundFraction,
      saturationCoefficient: crrtPoint.settings.saturationCoefficient ?? sc.drug.unboundFraction,
    };
    crrtDetail = computeCrrtClearance(settings);
    crrt = crrtDetail.total;
    running = true;
  }

  return { nonrenal, residual, crrt, total: nonrenal + residual + crrt, running, crrtDetail };
}

/**
 * Run a scenario.
 *
 * @param {Scenario} sc
 * @returns {{
 *   t: number[], cTotal: number[], cFree: number[],
 *   clTotal: number[], clNonrenal: number[], clResidual: number[], clCrrt: number[],
 *   crrtRunning: boolean[],
 *   segments: {tStart: number, tEnd: number, amounts: number[],
 *              params: any, infusionRate: number}[],
 *   warnings: string[]
 * }}
 */
export function simulate(sc) {
  validateScenario(sc);

  const fu = sc.drug.unboundFraction;
  const nCmt = compartmentCount({
    CL: 1, V1: sc.drug.V1, Q2: sc.drug.Q2, V2: sc.drug.V2,
  });

  const breakpoints = buildBreakpoints(sc);
  let amounts = new Array(nCmt).fill(0);

  const t = [];
  const cTotal = [];
  const cFree = [];
  const clTotal = [];
  const clNonrenal = [];
  const clResidual = [];
  const clCrrt = [];
  const crrtRunning = [];
  const segments = [];
  const warningSet = new Set();

  const record = (time, amts, cl) => {
    const conc = amts[0] / sc.drug.V1;
    t.push(time);
    cTotal.push(conc);
    cFree.push(conc * fu);
    clTotal.push(cl.total);
    clNonrenal.push(cl.nonrenal);
    clResidual.push(cl.residual);
    clCrrt.push(cl.crrt);
    crrtRunning.push(cl.running);
  };

  // Bolus at t = 0, if any.
  amounts[0] += bolusAt(sc.doses, 0);

  for (let s = 0; s < breakpoints.length - 1; s++) {
    const tStart = breakpoints[s];
    const tEnd = breakpoints[s + 1];
    const dt = tEnd - tStart;
    if (dt <= 0) continue;

    const tMid = tStart + dt / 2;
    const cl = clearanceAt(sc, tMid);
    if (cl.crrtDetail) cl.crrtDetail.warnings.forEach((w) => warningSet.add(w));

    const params = {
      CL: cl.total, V1: sc.drug.V1, Q2: sc.drug.Q2, V2: sc.drug.V2,
    };
    const infusionRate = infusionRateAt(sc.doses, tMid);

    segments.push({ tStart, tEnd, amounts: amounts.slice(), params, infusionRate });

    // Dense output across the segment, advancing exactly step by step.
    const nSteps = Math.max(1, Math.ceil(dt / OUTPUT_STEP_H));
    const h = dt / nSteps;
    record(tStart, amounts, cl);
    for (let i = 0; i < nSteps; i++) {
      amounts = advanceSegment(amounts, params, infusionRate, h);
      record(tStart + (i + 1) * h, amounts, cl);
    }

    // Apply any bolus landing exactly on the segment boundary.
    const bolus = bolusAt(sc.doses, tEnd);
    if (bolus > 0) {
      amounts = amounts.slice();
      amounts[0] += bolus;
      record(tEnd, amounts, cl);
    }
  }

  return {
    t, cTotal, cFree, clTotal, clNonrenal, clResidual, clCrrt, crrtRunning,
    segments, warnings: [...warningSet],
  };
}

/**
 * Evaluate the unbound concentration at an arbitrary time by advancing
 * exactly from the start of the containing segment. Used for refining
 * threshold-crossing times, where interpolating the dense grid would leave a
 * visible bias in the reported percentage of the interval above target.
 *
 * @param {ReturnType<typeof simulate>} result
 * @param {Scenario} sc
 * @param {number} time
 * @returns {number} unbound concentration, mg/L
 */
export function freeConcentrationAt(result, sc, time) {
  const seg = result.segments.find((s) => time >= s.tStart - 1e-12 && time <= s.tEnd + 1e-12)
    ?? result.segments[result.segments.length - 1];
  const amounts = advanceSegment(seg.amounts, seg.params, seg.infusionRate, Math.max(0, time - seg.tStart));
  return (amounts[0] / sc.drug.V1) * sc.drug.unboundFraction;
}

/** @param {Scenario} sc */
export function validateScenario(sc) {
  requireFinite(sc.durationH, 'durationH', { min: 0, allowZero: false });
  requireFinite(sc.drug.V1, 'drug.V1', { min: 0, allowZero: false });
  requireFinite(sc.drug.nonrenalClearance, 'drug.nonrenalClearance', { min: 0 });
  requireFraction(sc.drug.unboundFraction, 'drug.unboundFraction');
  requireFraction(sc.patient.haematocrit, 'patient.haematocrit');
  if (sc.drug.unboundFraction === 0) {
    throw new RangeError('drug.unboundFraction of 0 would make every unbound target unreachable');
  }
  if (!Array.isArray(sc.doses)) throw new TypeError('scenario.doses must be an array');

  const crrtTimes = sc.crrtEvents.map((e) => e.time);
  for (let i = 1; i < crrtTimes.length; i++) {
    if (crrtTimes[i] < crrtTimes[i - 1]) {
      throw new RangeError('crrtEvents must be sorted by ascending time');
    }
  }
  for (const e of sc.crrtEvents) {
    if (e.running && !e.settings) {
      throw new RangeError(`CRRT event at t=${e.time} h is marked running but has no settings`);
    }
  }
}
