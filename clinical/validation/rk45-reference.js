/**
 * Independent reference integrator: adaptive Dormand-Prince 5(4).
 *
 * This exists solely to cross-check `packages/pk-segment.js`. It deliberately
 * shares no code with the production path - it builds its own rate constants
 * from clearances and volumes and writes the derivative out longhand. If both
 * implementations agreed because they called the same helper, the agreement
 * would prove nothing.
 *
 * Verification level 2 in governance/validation-plan.md.
 */

/* Dormand-Prince 5(4) tableau. */
const A = [
  [],
  [1 / 5],
  [3 / 40, 9 / 40],
  [44 / 45, -56 / 15, 32 / 9],
  [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
  [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
];
const B5 = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];
const B4 = [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40];
const C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];

/**
 * Derivative of a mammillary compartment system with central infusion,
 * written out explicitly.
 *
 * @param {number[]} y compartment amounts, mg
 * @param {{CL: number, V1: number, Q2?: number, V2?: number, Q3?: number, V3?: number}} p
 * @param {number} rate mg/h into the central compartment
 * @returns {number[]}
 */
function derivative(y, p, rate) {
  const k10 = p.CL / p.V1;
  const n = y.length;

  if (n === 1) return [rate - k10 * y[0]];

  const k12 = (p.Q2 ?? 0) / p.V1;
  const k21 = (p.Q2 ?? 0) / (p.V2 ?? 1);

  if (n === 2) {
    return [
      rate - k10 * y[0] - k12 * y[0] + k21 * y[1],
      k12 * y[0] - k21 * y[1],
    ];
  }

  const k13 = (p.Q3 ?? 0) / p.V1;
  const k31 = (p.Q3 ?? 0) / (p.V3 ?? 1);
  return [
    rate - k10 * y[0] - k12 * y[0] - k13 * y[0] + k21 * y[1] + k31 * y[2],
    k12 * y[0] - k21 * y[1],
    k13 * y[0] - k31 * y[2],
  ];
}

/**
 * Integrate across a segment with constant parameters and infusion rate.
 *
 * @param {number[]} y0
 * @param {{CL: number, V1: number, Q2?: number, V2?: number, Q3?: number, V3?: number}} p
 * @param {number} rate mg/h
 * @param {number} dt hours
 * @param {{rtol?: number, atol?: number, maxSteps?: number}} [opts]
 * @returns {number[]}
 */
export function rk45Advance(y0, p, rate, dt, opts = {}) {
  const { rtol = 1e-11, atol = 1e-13, maxSteps = 2_000_000 } = opts;
  if (dt === 0) return y0.slice();

  const n = y0.length;
  let y = y0.slice();
  let t = 0;
  let h = Math.min(dt, 1e-3);
  let steps = 0;

  while (t < dt - 1e-15) {
    if (steps++ > maxSteps) throw new Error('rk45Advance: step limit exceeded');
    if (t + h > dt) h = dt - t;

    const k = [];
    for (let i = 0; i < 7; i++) {
      const yi = y.slice();
      for (let j = 0; j < i; j++) {
        const a = A[i][j];
        if (!a) continue;
        for (let c = 0; c < n; c++) yi[c] += h * a * k[j][c];
      }
      void C[i];
      k.push(derivative(yi, p, rate));
    }

    const y5 = y.slice();
    const y4 = y.slice();
    for (let c = 0; c < n; c++) {
      let s5 = 0;
      let s4 = 0;
      for (let i = 0; i < 7; i++) {
        s5 += B5[i] * k[i][c];
        s4 += B4[i] * k[i][c];
      }
      y5[c] += h * s5;
      y4[c] += h * s4;
    }

    let err = 0;
    for (let c = 0; c < n; c++) {
      const scale = atol + rtol * Math.max(Math.abs(y[c]), Math.abs(y5[c]));
      err = Math.max(err, Math.abs(y5[c] - y4[c]) / scale);
    }

    if (err <= 1) {
      t += h;
      y = y5;
    }

    const factor = err === 0 ? 5 : 0.9 * err ** -0.2;
    h *= Math.min(5, Math.max(0.2, factor));
    if (h < 1e-14) throw new Error('rk45Advance: step size underflow');
  }

  return y;
}
