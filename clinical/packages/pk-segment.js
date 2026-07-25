/**
 * Exact advance of a linear mammillary compartment model across a segment
 * over which every parameter is constant.
 *
 * The simulation timeline is cut at every discontinuity - infusion start and
 * stop, CRRT start, stop and setting change, residual renal function change.
 * Inside a segment the system is
 *
 *     dA/dt = M A + b
 *
 * with M and b constant. Embedding the constant term gives a homogeneous
 * system in one extra dimension,
 *
 *     d/dt [A; 1] = [[M, b], [0, 0]] [A; 1]
 *
 * whose solution is a single matrix exponential. This is exact rather than
 * approximate, and it degrades gracefully in the cases that break the usual
 * eigenvalue formulations: zero total clearance (singular M), and repeated
 * eigenvalues when intercompartmental clearance approaches zero.
 */

import { expm, matVec, zeros } from './linalg.js';
import { requireFinite } from './units.js';

/**
 * @typedef {object} PkParameters
 * @property {number} CL   total clearance out of the central compartment, L/h
 * @property {number} V1   central volume of distribution, L
 * @property {number} [Q2] intercompartmental clearance to peripheral 1, L/h
 * @property {number} [V2] peripheral volume 1, L
 * @property {number} [Q3] intercompartmental clearance to peripheral 2, L/h
 * @property {number} [V3] peripheral volume 2, L
 */

/**
 * Number of compartments implied by the supplied parameters.
 * @param {PkParameters} p
 * @returns {1|2|3}
 */
export function compartmentCount(p) {
  if (p.Q3 != null && p.V3 != null && p.Q3 > 0) return 3;
  if (p.Q2 != null && p.V2 != null && p.Q2 > 0) return 2;
  return 1;
}

/**
 * Build the rate matrix M for the given parameters.
 * @param {PkParameters} p
 * @returns {number[][]}
 */
export function rateMatrix(p) {
  const n = compartmentCount(p);
  const V1 = requireFinite(p.V1, 'V1', { min: 0, allowZero: false });
  const CL = requireFinite(p.CL, 'CL', { min: 0 });
  const k10 = CL / V1;

  if (n === 1) return [[-k10]];

  const Q2 = requireFinite(p.Q2 ?? 0, 'Q2', { min: 0 });
  const V2 = requireFinite(p.V2 ?? 1, 'V2', { min: 0, allowZero: false });
  const k12 = Q2 / V1;
  const k21 = Q2 / V2;

  if (n === 2) {
    return [
      [-(k10 + k12), k21],
      [k12, -k21],
    ];
  }

  const Q3 = requireFinite(p.Q3 ?? 0, 'Q3', { min: 0 });
  const V3 = requireFinite(p.V3 ?? 1, 'V3', { min: 0, allowZero: false });
  const k13 = Q3 / V1;
  const k31 = Q3 / V3;

  return [
    [-(k10 + k12 + k13), k21, k31],
    [k12, -k21, 0],
    [k13, 0, -k31],
  ];
}

/**
 * Advance the compartment amounts across a segment of length `dt` during
 * which the parameters and the infusion rate are constant.
 *
 * @param {number[]} amounts       compartment amounts at segment start, mg
 * @param {PkParameters} params
 * @param {number} infusionRate    mg/h into the central compartment
 * @param {number} dt              segment duration, h
 * @returns {number[]} compartment amounts at segment end, mg
 */
export function advanceSegment(amounts, params, infusionRate, dt) {
  requireFinite(dt, 'dt', { min: 0 });
  requireFinite(infusionRate, 'infusionRate', { min: 0 });
  if (dt === 0) return amounts.slice();

  const M = rateMatrix(params);
  const n = M.length;
  if (amounts.length !== n) {
    throw new RangeError(
      `advanceSegment: expected ${n} compartment amounts, received ${amounts.length}`
    );
  }

  // Augmented matrix [[M, b], [0, 0]] scaled by dt.
  const aug = zeros(n + 1, n + 1);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) aug[i][j] = M[i][j] * dt;
    aug[i][n] = (i === 0 ? infusionRate : 0) * dt;
  }

  const E = expm(aug);
  const z = matVec(E, [...amounts, 1]);

  // Compartment amounts are physical quantities; clamp round-off below zero.
  return z.slice(0, n).map((v) => (v < 0 && v > -1e-9 ? 0 : v));
}

/**
 * Central-compartment total concentration, mg/L.
 * @param {number[]} amounts
 * @param {PkParameters} params
 * @returns {number}
 */
export const centralConcentration = (amounts, params) => amounts[0] / params.V1;
