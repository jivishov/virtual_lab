/**
 * Exposure metrics computed from a simulated profile.
 *
 * Threshold-crossing times are refined by bisection against an exact
 * evaluation of the model rather than read off the plotting grid. On a
 * 0.005 h grid, grid-reading alone biases the percentage of the interval
 * above target by up to a few tenths of a percent per crossing, which is
 * enough to change a reported target-attainment figure.
 */

import { freeConcentrationAt, simulate } from './simulate.js';

/**
 * @param {number[]} xs
 * @param {number[]} ys
 * @param {number} t0
 * @param {number} t1
 * @returns {number} trapezoidal integral of ys over [t0, t1]
 */
export function integrate(xs, ys, t0, t1) {
  let area = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    if (b <= t0 || a >= t1) continue;
    const lo = Math.max(a, t0);
    const hi = Math.min(b, t1);
    if (hi <= lo) continue;
    const span = b - a;
    // Linear interpolation of the endpoints onto the clipped interval.
    const ya = span > 0 ? ys[i] + ((ys[i + 1] - ys[i]) * (lo - a)) / span : ys[i];
    const yb = span > 0 ? ys[i] + ((ys[i + 1] - ys[i]) * (hi - a)) / span : ys[i + 1];
    area += ((ya + yb) / 2) * (hi - lo);
  }
  return area;
}

/**
 * Refine a threshold crossing known to lie in [ta, tb].
 * @param {ReturnType<import('./simulate.js').simulate>} result
 * @param {import('./simulate.js').Scenario} sc
 * @param {number} threshold
 * @param {number} ta
 * @param {number} tb
 * @returns {number}
 */
function refineCrossing(result, sc, threshold, ta, tb) {
  let lo = ta;
  let hi = tb;
  const fLo = freeConcentrationAt(result, sc, lo) - threshold;
  for (let i = 0; i < 60 && hi - lo > 1e-7; i++) {
    const mid = (lo + hi) / 2;
    const fMid = freeConcentrationAt(result, sc, mid) - threshold;
    if (Math.sign(fMid) === Math.sign(fLo)) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Time (hours) during [t0, t1] for which the unbound concentration exceeds
 * `threshold`.
 *
 * @param {ReturnType<import('./simulate.js').simulate>} result
 * @param {import('./simulate.js').Scenario} sc
 * @param {number} threshold mg/L
 * @param {number} t0
 * @param {number} t1
 * @returns {number} hours above threshold
 */
export function timeAbove(result, sc, threshold, t0, t1) {
  const { t, cFree } = result;
  let total = 0;

  for (let i = 0; i < t.length - 1; i++) {
    const a = t[i];
    const b = t[i + 1];
    if (b <= t0 || a >= t1) continue;
    if (b === a) continue;

    const lo = Math.max(a, t0);
    const hi = Math.min(b, t1);
    if (hi <= lo) continue;

    const ya = cFree[i] - threshold;
    const yb = cFree[i + 1] - threshold;

    if (ya > 0 && yb > 0) {
      total += hi - lo;
    } else if (ya <= 0 && yb <= 0) {
      // entirely below
    } else {
      const cross = refineCrossing(result, sc, threshold, a, b);
      const clipped = Math.min(Math.max(cross, lo), hi);
      total += ya > 0 ? clipped - lo : hi - clipped;
    }
  }
  return total;
}

/**
 * Full metric set over an evaluation window.
 *
 * @param {ReturnType<import('./simulate.js').simulate>} result
 * @param {import('./simulate.js').Scenario} sc
 * @param {{mic: number, targetMultiple?: number, t0: number, t1: number,
 *          toxicityThreshold?: number|null}} opts
 */
export function computeMetrics(result, sc, opts) {
  const { mic, targetMultiple = 1, t0, t1, toxicityThreshold = null } = opts;
  const window = t1 - t0;
  if (window <= 0) throw new RangeError('metric window must be positive');

  const threshold = mic * targetMultiple;
  const hoursAbove = timeAbove(result, sc, threshold, t0, t1);

  const idx = result.t
    .map((v, i) => [v, i])
    .filter(([v]) => v >= t0 - 1e-12 && v <= t1 + 1e-12)
    .map(([, i]) => i);

  const freeInWindow = idx.map((i) => result.cFree[i]);
  const fAuc = integrate(result.t, result.cFree, t0, t1);

  return {
    windowStart: t0,
    windowEnd: t1,
    threshold,
    percentTimeAboveTarget: (hoursAbove / window) * 100,
    hoursAboveTarget: hoursAbove,
    hoursBelowTarget: window - hoursAbove,
    freeAuc: fAuc,
    freeAucOverMic: mic > 0 ? fAuc / mic : null,
    freeCmax: freeInWindow.length ? Math.max(...freeInWindow) : null,
    freeCmin: freeInWindow.length ? Math.min(...freeInWindow) : null,
    hoursAboveToxicityThreshold:
      toxicityThreshold != null ? timeAbove(result, sc, toxicityThreshold, t0, t1) : null,
  };
}

/**
 * Effect of a single CRRT state change, as a counterfactual.
 *
 * The obvious approach - compare equal windows before and after the event -
 * is wrong, and wrong in a way that is easy to miss. Those two windows differ
 * in where they sit relative to the dosing schedule as well as in CRRT state,
 * so a window that happens to start just after a dose looks better than one
 * that ends in a trough regardless of what the circuit was doing. In testing,
 * that artefact made *starting* CRRT appear to increase target coverage.
 *
 * Instead the same window is compared against a counterfactual in which this
 * one event did not occur and the previous CRRT state simply continued. Dose
 * timing is then identical on both sides, so the difference isolates the
 * event. Model error is also largely common to both arms and cancels.
 *
 * The window is truncated at the next event so that each event's effect is
 * attributed to that event alone.
 *
 * @param {import('./simulate.js').Scenario} sc
 * @param {number} eventIndex index into sc.crrtEvents
 * @param {{mic: number, targetMultiple?: number, maxWindowH?: number}} opts
 * @returns {null | {
 *   event: any, windowStart: number, windowEnd: number,
 *   actual: ReturnType<typeof computeMetrics>,
 *   counterfactual: ReturnType<typeof computeMetrics>,
 *   deltaPercentTimeAboveTarget: number, deltaFreeAuc: number
 * }}
 */
export function counterfactualEventImpact(sc, eventIndex, opts) {
  const { mic, targetMultiple = 1, maxWindowH = 8 } = opts;
  const ev = sc.crrtEvents[eventIndex];
  if (!ev || ev.time <= 0 || ev.time >= sc.durationH) return null;

  const next = sc.crrtEvents[eventIndex + 1];
  const windowEnd = Math.min(
    ev.time + maxWindowH,
    next ? next.time : sc.durationH,
    sc.durationH
  );
  if (windowEnd <= ev.time) return null;

  const counterfactualScenario = {
    ...sc,
    crrtEvents: sc.crrtEvents.filter((_, i) => i !== eventIndex),
  };

  const window = { mic, targetMultiple, t0: ev.time, t1: windowEnd };
  const actual = computeMetrics(simulate(sc), sc, window);
  const counterfactual = computeMetrics(
    simulate(counterfactualScenario), counterfactualScenario, window
  );

  return {
    event: ev,
    windowStart: ev.time,
    windowEnd,
    actual,
    counterfactual,
    deltaPercentTimeAboveTarget:
      actual.percentTimeAboveTarget - counterfactual.percentTimeAboveTarget,
    deltaFreeAuc: actual.freeAuc - counterfactual.freeAuc,
  };
}
