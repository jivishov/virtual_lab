/**
 * Verification suite.
 *
 * Level 1 - software verification: units, mass balance, degenerate inputs,
 *           event boundaries, linearity.
 * Level 2 - analytical reference cases and cross-check against an
 *           independent Dormand-Prince integrator.
 *
 * These establish that the code solves the equations it claims to solve.
 * They say nothing about whether those equations describe any real patient;
 * that is a separate question addressed in governance/validation-plan.md.
 *
 * Run: node tests/tests.js   (from the clinical/ directory)
 */

import { expm, identity, matMul, norm1 } from '../packages/linalg.js';
import { advanceSegment, rateMatrix, compartmentCount } from '../packages/pk-segment.js';
import { computeCrrtClearance, applyModalityMask, MODALITIES } from '../packages/crrt.js';
import { simulate, expandRegimen, clearanceAt, OUTPUT_STEP_H } from '../packages/simulate.js';
import {
  computeMetrics, timeAbove, integrate, counterfactualEventImpact,
} from '../packages/metrics.js';
import { rk45Advance } from '../validation/rk45-reference.js';
import { mlMinToLh, mlKgHToLh, requireFraction } from '../packages/units.js';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(`${name}${detail ? ` :: ${detail}` : ''}`);
  }
}

function closeTo(name, actual, expected, tol, relative = true) {
  const denom = relative ? Math.max(Math.abs(expected), 1e-12) : 1;
  const err = Math.abs(actual - expected) / denom;
  check(name, err <= tol, `expected ${expected}, got ${actual}, ${relative ? 'rel' : 'abs'} err ${err.toExponential(3)} > ${tol}`);
  return err;
}

function throws(name, fn) {
  try {
    fn();
    check(name, false, 'expected a throw, none occurred');
  } catch {
    check(name, true);
  }
}

/* =============================================================== units === */

closeTo('units: 200 mL/min -> 12 L/h', mlMinToLh(200), 12, 1e-12);
closeTo('units: 25 mL/kg/h at 70 kg -> 1.75 L/h', mlKgHToLh(25, 70), 1.75, 1e-12);
throws('units: fraction rejects 20 (percent entered as whole number)', () => requireFraction(20, 'fu'));
throws('units: fraction rejects negative', () => requireFraction(-0.1, 'fu'));

/* ============================================================== linalg === */

{
  const I = identity(3);
  const e0 = expm([[0, 0], [0, 0]]);
  closeTo('expm: exp(0) = I [0][0]', e0[0][0], 1, 1e-14);
  closeTo('expm: exp(0) = I [0][1]', e0[0][1], 0, 1e-14, false);

  const d = expm([[-0.5, 0], [0, -2]]);
  closeTo('expm: diagonal element 1', d[0][0], Math.exp(-0.5), 1e-13);
  closeTo('expm: diagonal element 2', d[1][1], Math.exp(-2), 1e-13);

  // exp(A) exp(-A) = I for a non-normal matrix.
  const Anon = [[-1.3, 0.7], [0.9, -2.1]];
  const prod = matMul(expm(Anon), expm(Anon.map((r) => r.map((v) => -v))));
  closeTo('expm: exp(A)exp(-A) = I diag', prod[0][0], 1, 1e-11);
  closeTo('expm: exp(A)exp(-A) = I offdiag', prod[0][1], 0, 1e-11, false);

  // Large-norm matrix exercises the scaling-and-squaring path.
  const big = [[-40, 12], [8, -55]];
  check('expm: scaling path returns finite values', Number.isFinite(expm(big)[0][0]));
  check('linalg: norm1 picks max column sum', norm1([[1, -9], [2, 3]]) === 12);
  void I;
}

/* ================================================ one-compartment exact === */

{
  const p = { CL: 5, V1: 20 };
  const k = p.CL / p.V1;
  const A0 = 1000;

  for (const dt of [0.01, 0.5, 3, 24]) {
    const got = advanceSegment([A0], p, 0, dt)[0];
    closeTo(`1-cmt decay exact at dt=${dt}`, got, A0 * Math.exp(-k * dt), 1e-12);
  }

  // Constant infusion from empty: A(t) = (R/k)(1 - exp(-kt))
  const R = 250;
  for (const dt of [0.25, 2, 10]) {
    const got = advanceSegment([0], p, R, dt)[0];
    const want = (R / k) * (1 - Math.exp(-k * dt));
    closeTo(`1-cmt infusion exact at dt=${dt}`, got, want, 1e-12);
  }

  // Steady state during infinite infusion: C_ss = R / CL
  const ss = advanceSegment([0], p, R, 500)[0] / p.V1;
  closeTo('1-cmt steady-state concentration = R/CL', ss, R / p.CL, 1e-9);
}

/* ================================== degenerate cases that break eigen code */

{
  // Zero clearance: the rate matrix is singular. Mass must be conserved.
  const p = { CL: 0, V1: 15, Q2: 4, V2: 30 };
  const out = advanceSegment([800, 0], p, 0, 12);
  closeTo('zero clearance conserves mass', out[0] + out[1], 800, 1e-9);
  check('zero clearance distributes into peripheral', out[1] > 0);

  // Zero clearance with infusion: total mass = infused mass.
  const out2 = advanceSegment([0, 0], p, 100, 5);
  closeTo('zero clearance + infusion: mass = rate x time', out2[0] + out2[1], 500, 1e-9);

  // Repeated eigenvalues: Q2 -> 0 makes the 2-cmt system nearly degenerate.
  const nearly = { CL: 3, V1: 10, Q2: 1e-9, V2: 10 };
  const r = advanceSegment([500, 0], nearly, 0, 6);
  closeTo('near-degenerate eigenvalues match 1-cmt limit', r[0], 500 * Math.exp(-0.3 * 6), 1e-6);

  // Zero dose stays at zero.
  const z = advanceSegment([0, 0], { CL: 5, V1: 10, Q2: 2, V2: 20 }, 0, 8);
  check('zero dose stays zero', z[0] === 0 && z[1] === 0);

  // Zero duration is the identity.
  const same = advanceSegment([123, 45], { CL: 5, V1: 10, Q2: 2, V2: 20 }, 99, 0);
  check('zero duration is identity', same[0] === 123 && same[1] === 45);
}

/* ======================================= cross-check vs RK45 (Level 2) === */

{
  const cases = [
    { name: '1-cmt bolus', p: { CL: 4, V1: 18 }, y0: [1500], rate: 0, dt: 8 },
    { name: '1-cmt infusion', p: { CL: 4, V1: 18 }, y0: [0], rate: 500, dt: 4 },
    { name: '2-cmt bolus', p: { CL: 5.5, V1: 16, Q2: 7, V2: 34 }, y0: [2000, 0], rate: 0, dt: 8 },
    { name: '2-cmt infusion loaded', p: { CL: 5.5, V1: 16, Q2: 7, V2: 34 }, y0: [400, 900], rate: 250, dt: 6 },
    { name: '2-cmt high clearance', p: { CL: 22, V1: 12, Q2: 9, V2: 40 }, y0: [3000, 0], rate: 0, dt: 12 },
    { name: '3-cmt bolus', p: { CL: 6, V1: 14, Q2: 8, V2: 30, Q3: 2, V3: 90 }, y0: [2000, 0, 0], rate: 0, dt: 10 },
  ];

  let worst = 0;
  for (const c of cases) {
    const exact = advanceSegment(c.y0, c.p, c.rate, c.dt);
    const ref = rk45Advance(c.y0, c.p, c.rate, c.dt);
    for (let i = 0; i < exact.length; i++) {
      const err = Math.abs(exact[i] - ref[i]) / Math.max(Math.abs(ref[i]), 1e-9);
      worst = Math.max(worst, err);
      check(
        `RK45 cross-check ${c.name} cmt${i + 1}`,
        err < 1e-7,
        `matrix-exponential ${exact[i]}, RK45 ${ref[i]}, rel err ${err.toExponential(3)}`
      );
    }
  }
  console.log(`  worst matrix-exponential vs RK45 relative disagreement: ${worst.toExponential(3)}`);
}

/* ===================================================== linearity/superposition */

{
  const p = { CL: 5, V1: 20, Q2: 6, V2: 40 };
  const a = advanceSegment([1000, 0], p, 0, 6);
  const b = advanceSegment([0, 500], p, 0, 6);
  const both = advanceSegment([1000, 500], p, 0, 6);
  closeTo('superposition central', both[0], a[0] + b[0], 1e-11);
  closeTo('superposition peripheral', both[1], a[1] + b[1], 1e-11);
}

/* ============================================= compartment count / matrix === */

{
  check('compartmentCount 1', compartmentCount({ CL: 1, V1: 1 }) === 1);
  check('compartmentCount 2', compartmentCount({ CL: 1, V1: 1, Q2: 3, V2: 5 }) === 2);
  check('compartmentCount 3', compartmentCount({ CL: 1, V1: 1, Q2: 3, V2: 5, Q3: 1, V3: 9 }) === 3);
  check('compartmentCount ignores Q2=0', compartmentCount({ CL: 1, V1: 1, Q2: 0, V2: 5 }) === 1);

  const M = rateMatrix({ CL: 10, V1: 10, Q2: 20, V2: 40 });
  closeTo('rate matrix k10+k12', M[0][0], -(1 + 2), 1e-12);
  closeTo('rate matrix k21', M[0][1], 0.5, 1e-12);
  // Column sums equal -(elimination rate) for the central column only.
  closeTo('rate matrix peripheral column conserves', M[0][1] + M[1][1], 0, 1e-12, false);
  throws('rate matrix rejects V1=0', () => rateMatrix({ CL: 1, V1: 0 }));
}

/* ================================================================ CRRT === */

{
  const base = {
    modality: MODALITIES.CVVH,
    bloodFlow: mlMinToLh(200),      // 12 L/h
    dialysateFlow: 0,
    preReplacementFlow: 0,
    postReplacementFlow: 2,
    netUltrafiltration: 0.1,
    haematocrit: 0.3,
    sievingCoefficient: 0.8,
    saturationCoefficient: 0.8,
  };

  const cvvh = computeCrrtClearance(base);
  closeTo('CVVH post-dilution: CL = SC x (Qpost + Qnet)', cvvh.total, 0.8 * 2.1, 1e-12);
  closeTo('CVVH has no diffusive component', cvvh.diffusive, 0, 1e-15, false);
  closeTo('CVVH plasma water flow', cvvh.plasmaWaterFlow, 12 * 0.7, 1e-12);
  closeTo('CVVH effluent flow', cvvh.effluentFlow, 2.1, 1e-12);
  check('CVVH dilution factor is 1', cvvh.dilutionFactor === 1);

  // Pre-dilution must reduce clearance relative to the same flow post-filter.
  const pre = computeCrrtClearance({
    ...base, postReplacementFlow: 0, preReplacementFlow: 2,
  });
  check('pre-dilution reduces clearance vs post-dilution', pre.total < cvvh.total);
  closeTo('pre-dilution factor = Qp/(Qp+Qpre)', pre.dilutionFactor, 8.4 / 10.4, 1e-12);

  // CVVHD: diffusive only.
  const cvvhd = computeCrrtClearance({
    ...base, modality: MODALITIES.CVVHD, dialysateFlow: 2, postReplacementFlow: 5,
  });
  closeTo('CVVHD masks replacement flow', cvvhd.convective, 0.8 * 0.1, 1e-12);
  closeTo('CVVHD diffusive = SA x Qd', cvvhd.diffusive, 0.8 * 2, 1e-12);

  // Modality mask must zero irrelevant flows rather than let them contribute.
  const masked = applyModalityMask({ ...base, modality: MODALITIES.SCUF, dialysateFlow: 9, postReplacementFlow: 9 });
  check('SCUF masks dialysate and replacement', masked.dialysateFlow === 0 && masked.postReplacementFlow === 0);

  // CVVHDF combines both.
  const cvvhdf = computeCrrtClearance({
    ...base, modality: MODALITIES.CVVHDF, dialysateFlow: 1.5, postReplacementFlow: 1.5,
  });
  closeTo('CVVHDF total = diffusive + convective', cvvhdf.total, 0.8 * 1.5 + 0.8 * 1.6, 1e-12);

  // Physical guard: clearance cannot exceed plasma water flow.
  const absurd = computeCrrtClearance({
    ...base, modality: MODALITIES.CVVHDF, bloodFlow: 1, dialysateFlow: 50,
    postReplacementFlow: 50, haematocrit: 0.3, sievingCoefficient: 1, saturationCoefficient: 1,
  });
  check('clearance capped at plasma water flow', absurd.total <= absurd.plasmaWaterFlow + 1e-12);
  check('cap emits a warning', absurd.warnings.some((w) => w.includes('exceeds plasma water flow')));

  // High filtration fraction warns.
  const ff = computeCrrtClearance({ ...base, postReplacementFlow: 4 });
  check('high filtration fraction warns', ff.warnings.some((w) => w.includes('Filtration fraction')));

  throws('unknown modality rejected', () => computeCrrtClearance({ ...base, modality: 'CVVHXX' }));
  throws('haematocrit > 1 rejected', () => computeCrrtClearance({ ...base, haematocrit: 45 }));
}

/* ============================================================= regimen === */

{
  const doses = expandRegimen({
    firstDoseTime: 0, amount: 2000, infusionDuration: 4, intervalH: 8, numberOfDoses: 3,
  });
  check('regimen expands to 3 doses', doses.length === 3);
  check('regimen spacing', doses[1].startTime === 8 && doses[2].startTime === 16);

  const withLoad = expandRegimen({
    firstDoseTime: 0, amount: 2000, infusionDuration: 4, intervalH: 8, numberOfDoses: 2,
    loadingDose: { amount: 2000, infusionDuration: 0.5 },
  });
  check('loading dose is first', withLoad[0].label === 'loading' && withLoad[0].amount === 2000);
  check('maintenance starts after loading infusion', withLoad[1].startTime === 0.5);
}

/* ================================== event boundaries and clearance steps === */

function buildScenario(overrides = {}) {
  const settings = {
    modality: MODALITIES.CVVHDF,
    bloodFlow: mlMinToLh(200),
    dialysateFlow: 1.0,
    preReplacementFlow: 0,
    postReplacementFlow: 1.0,
    netUltrafiltration: 0.1,
    haematocrit: 0.3,
    sievingCoefficient: 0.8,
    saturationCoefficient: 0.8,
  };
  return {
    id: 'test', label: 'test',
    drug: { name: 'test drug', unboundFraction: 0.8, nonrenalClearance: 1.0, V1: 18, Q2: 6, V2: 30 },
    patient: { weightKg: 70, haematocrit: 0.3 },
    residualRenal: [{ time: 0, clearance: 0.3 }],
    crrtEvents: [
      { time: 0, running: true, settings },
      { time: 10, running: false, settings: null },
      { time: 14, running: true, settings },
    ],
    doses: expandRegimen({
      firstDoseTime: 0, amount: 2000, infusionDuration: 4, intervalH: 8, numberOfDoses: 4,
    }),
    durationH: 32,
    ...overrides,
  };
}

{
  const sc = buildScenario();
  const res = simulate(sc);

  check('simulation produced output', res.t.length > 100);
  check('time is non-decreasing', res.t.every((v, i) => i === 0 || v >= res.t[i - 1]));
  check('concentrations are finite and non-negative',
    res.cTotal.every((v) => Number.isFinite(v) && v >= -1e-12));
  check('unbound = fu x total',
    res.cFree.every((v, i) => Math.abs(v - res.cTotal[i] * 0.8) < 1e-12));

  // Clearance must be a step function switching exactly at the event times.
  const clJustBefore = clearanceAt(sc, 10 - 1e-6);
  const clJustAfter = clearanceAt(sc, 10 + 1e-6);
  check('CRRT contributes before stop', clJustBefore.crrt > 0 && clJustBefore.running);
  check('CRRT contributes nothing after stop', clJustAfter.crrt === 0 && !clJustAfter.running);
  closeTo('off-CRRT total = nonrenal + residual', clJustAfter.total, 1.3, 1e-12);
  closeTo('on-CRRT total = nonrenal + residual + CRRT',
    clJustBefore.total, 1.3 + 0.8 * 1.0 + 0.8 * 1.1, 1e-12);

  // Interrupting CRRT must raise exposure over the interruption window.
  const scNoStop = buildScenario({
    crrtEvents: [{ time: 0, running: true, settings: buildScenario().crrtEvents[0].settings }],
  });
  const resNoStop = simulate(scNoStop);
  const aucInterrupted = integrate(res.t, res.cFree, 10, 14);
  const aucContinuous = integrate(resNoStop.t, resNoStop.cFree, 10, 14);
  check('CRRT interruption increases exposure', aucInterrupted > aucContinuous,
    `interrupted ${aucInterrupted.toFixed(2)} vs continuous ${aucContinuous.toFixed(2)}`);

  // Grid must resolve the events.
  check('grid contains the CRRT stop time', res.t.some((v) => Math.abs(v - 10) < 1e-9));
  check('grid contains the CRRT restart time', res.t.some((v) => Math.abs(v - 14) < 1e-9));
  check('grid contains infusion end', res.t.some((v) => Math.abs(v - 4) < 1e-9));
}

/* ============================================ analytic metric reference === */

{
  // Single bolus, one compartment, constant clearance: every metric has a
  // closed form, so the metric code is checked against algebra, not itself.
  const CL = 4;
  const V1 = 20;
  const fu = 0.5;
  const dose = 2000;
  const k = CL / V1;

  const sc = {
    id: 'analytic', label: 'analytic',
    drug: { name: 'ref', unboundFraction: fu, nonrenalClearance: CL, V1 },
    patient: { weightKg: 70, haematocrit: 0.3 },
    residualRenal: [{ time: 0, clearance: 0 }],
    crrtEvents: [{ time: 0, running: false, settings: null }],
    doses: [{ startTime: 0, amount: dose, infusionDuration: 0 }],
    durationH: 48,
  };

  const res = simulate(sc);
  const c0 = (fu * dose) / V1;
  closeTo('bolus initial unbound concentration', res.cFree[0], c0, 1e-12);

  const mic = 5;
  const expectedCrossing = Math.log(c0 / mic) / k;
  const above = timeAbove(res, sc, mic, 0, 48);
  closeTo('time above MIC matches closed form', above, expectedCrossing, 1e-5);

  // Unbound AUC over all time = fu * Dose / CL
  const m = computeMetrics(res, sc, { mic, t0: 0, t1: 48 });
  closeTo('unbound AUC = fu x Dose / CL', m.freeAuc, (fu * dose) / CL, 2e-4);
  closeTo('percent time above target', m.percentTimeAboveTarget, (expectedCrossing / 48) * 100, 1e-5);
  closeTo('fAUC/MIC', m.freeAucOverMic, (fu * dose) / CL / mic, 2e-4);
  closeTo('free Cmax', m.freeCmax, c0, 1e-9);
  closeTo('hours above + hours below = window', m.hoursAboveTarget + m.hoursBelowTarget, 48, 1e-9, false);

  // Threshold above Cmax gives zero, below the trough gives the full window.
  closeTo('time above unreachable threshold is zero', timeAbove(res, sc, c0 * 10, 0, 48), 0, 1e-9, false);
  closeTo('time above zero threshold is the whole window', timeAbove(res, sc, 0, 0, 48), 48, 1e-6);

  // Target multiple scales the threshold, not the window.
  const m4 = computeMetrics(res, sc, { mic, targetMultiple: 4, t0: 0, t1: 48 });
  closeTo('4x target crossing', m4.hoursAboveTarget, Math.log(c0 / (4 * mic)) / k, 1e-5);
  check('higher target gives less coverage', m4.percentTimeAboveTarget < m.percentTimeAboveTarget);

  throws('zero-width metric window rejected',
    () => computeMetrics(res, sc, { mic, t0: 5, t1: 5 }));
}

/* ================================== counterfactual event attribution === */

{
  const sc = buildScenario();
  // Event 1 is the stop at 10 h; event 2 is the restart at 14 h.
  const stop = counterfactualEventImpact(sc, 1, { mic: 8, maxWindowH: 12 });
  const start = counterfactualEventImpact(sc, 2, { mic: 8, maxWindowH: 12 });

  check('stop event yields an impact', stop != null);
  check('start event yields an impact', start != null);

  // The window must be truncated at the next event, not run past it.
  closeTo('stop window truncated at next event', stop.windowEnd, 14, 1e-9);
  closeTo('start window runs to the maxWindow', start.windowEnd, 14 + 12, 1e-9);

  // Stopping the circuit removes clearance, so exposure must rise relative to
  // the counterfactual in which it kept running.
  check('stopping CRRT raises unbound AUC vs counterfactual',
    stop.actual.freeAuc > stop.counterfactual.freeAuc,
    `actual ${stop.actual.freeAuc.toFixed(2)} vs counterfactual ${stop.counterfactual.freeAuc.toFixed(2)}`);

  // Restarting adds clearance back, so exposure must fall relative to the
  // counterfactual in which it stayed off. This is the direction that a naive
  // before/after window comparison reports incorrectly.
  check('restarting CRRT lowers unbound AUC vs counterfactual',
    start.actual.freeAuc < start.counterfactual.freeAuc,
    `actual ${start.actual.freeAuc.toFixed(2)} vs counterfactual ${start.counterfactual.freeAuc.toFixed(2)}`);
  check('restarting CRRT does not increase coverage',
    start.deltaPercentTimeAboveTarget <= 1e-9,
    `delta ${start.deltaPercentTimeAboveTarget.toFixed(2)} pp`);

  // Events outside the simulated period, or at t = 0, have no attributable effect.
  check('event at t=0 returns null', counterfactualEventImpact(sc, 0, { mic: 8 }) === null);
  check('out-of-range index returns null', counterfactualEventImpact(sc, 99, { mic: 8 }) === null);

  // With no interruption at all, removing a non-existent event changes nothing:
  // a scenario whose only event is at t=0 has no attributable impacts.
  const continuous = buildScenario({
    crrtEvents: [{ time: 0, running: true, settings: buildScenario().crrtEvents[0].settings }],
  });
  check('continuous CRRT has no attributable events',
    continuous.crrtEvents.every((_, i) => counterfactualEventImpact(continuous, i, { mic: 8 }) === null));
}

/* ============================================= integrate() sanity checks === */

{
  const xs = [0, 1, 2, 3, 4];
  const ys = [0, 1, 2, 3, 4];
  closeTo('integrate linear ramp full', integrate(xs, ys, 0, 4), 8, 1e-12);
  closeTo('integrate linear ramp partial', integrate(xs, ys, 1, 3), 4, 1e-12);
  closeTo('integrate clipped sub-interval', integrate(xs, ys, 0.5, 1.5), 1.0, 1e-12);
  closeTo('integrate outside range', integrate(xs, ys, 10, 12), 0, 1e-12, false);
  closeTo('integrate handles duplicate x', integrate([0, 1, 1, 2], [0, 1, 5, 6], 0, 1), 0.5, 1e-12);
}

/* ================================================= scenario validation === */

{
  throws('running CRRT without settings rejected', () => simulate(buildScenario({
    crrtEvents: [{ time: 0, running: true, settings: null }],
  })));
  throws('unsorted CRRT events rejected', () => simulate(buildScenario({
    crrtEvents: [
      { time: 5, running: false, settings: null },
      { time: 1, running: false, settings: null },
    ],
  })));
  throws('zero unbound fraction rejected', () => simulate(buildScenario({
    drug: { name: 'x', unboundFraction: 0, nonrenalClearance: 1, V1: 10 },
  })));
  throws('zero V1 rejected', () => simulate(buildScenario({
    drug: { name: 'x', unboundFraction: 0.5, nonrenalClearance: 1, V1: 0 },
  })));
}

/* ============================ source scans: privacy and claim language === */

{
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|html|css)$/.test(entry.name)) files.push(full);
    }
  };
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  for (const d of ['apps', 'packages', 'data']) walk(join(root, d));
  check('source scan found files', files.length > 0);

  // R7: the page must reference no external origin, or the "nothing is
  // transmitted" claim in governance/intended-use.md is false.
  const ALLOWED = [/w3\.org\/2000\/svg/];
  const externals = [];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/https?:\/\/[^\s"'`)<>]+/g)) {
      if (!ALLOWED.some((re) => re.test(m[0]))) externals.push(`${f.replace(root, '')}: ${m[0]}`);
    }
  }
  check('no external origins referenced in app sources', externals.length === 0, externals.join('; '));

  // R1: banned phrasings from governance/claim-language.md must not reach the UI.
  const BANNED = [
    /recommended dose/i, /reduce the dose by/i, /optimal regimen/i,
    /\bsubtherapeutic\b/i, /\bis safe\b/i, /\bis unsafe\b/i,
  ];
  const hits = [];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const re of BANNED) {
      const m = text.match(re);
      if (m) hits.push(`${f.replace(root, '')}: "${m[0]}"`);
    }
  }
  check('no banned recommendation phrasing in app sources', hits.length === 0, hits.join('; '));

  // Inline style attributes would break the page's own Content-Security-Policy.
  const inlineStyles = [];
  for (const f of files.filter((x) => x.endsWith('.html'))) {
    const text = readFileSync(f, 'utf8');
    if (/<[^>]+\sstyle\s*=/.test(text)) inlineStyles.push(f.replace(root, ''));
  }
  check('no inline style attributes (CSP style-src self)', inlineStyles.length === 0, inlineStyles.join('; '));
}

/* ================================================================ report === */

console.log('');
console.log(`Output grid: ${OUTPUT_STEP_H} h (${(OUTPUT_STEP_H * 3600).toFixed(0)} s)`);
console.log(`passed ${passed}, failed ${failed}`);
if (failures.length) {
  console.log('');
  for (const f of failures) console.log(`  FAIL  ${f}`);
  process.exitCode = 1;
} else {
  console.log('All verification checks passed.');
}
