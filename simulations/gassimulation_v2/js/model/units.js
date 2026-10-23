/**
 * Units and physical constants.
 *
 * Internal units used everywhere in the model:
 *   P  atm (absolute)   V  L   T  K   n  mol
 * Conversions to display units happen only at the edges (instruments, readouts).
 */

export const R_SI = 8.314462618;            // J/(mol·K)
export const PA_PER_ATM = 101325;           // Pa
export const R = R_SI / (PA_PER_ATM / 1000); // L·atm/(mol·K) = 0.0820574
export const N_A = 6.02214076e23;           // 1/mol
export const P_ATM = 1;                     // sea-level atmosphere, atm. Gauge readings reference this.
export const T_ROOM = 295;                  // K. Reference temperature for relative particle speed.
export const L_PER_FT3 = 28.316846592;

const PER_ATM = Object.freeze({
  atm: 1,
  kPa: 101.325,
  psi: 14.6959488,
  bar: 1.01325,
  mmHg: 760,
});

export const PRESSURE_UNITS = Object.keys(PER_ATM);

function factor(unit) {
  const f = PER_ATM[unit];
  if (f === undefined) throw new Error(`Unknown pressure unit "${unit}"`);
  return f;
}

export const atmTo = (p, unit) => p * factor(unit);
export const toAtm = (p, unit) => p / factor(unit);

/** Gauge pressure = absolute pressure minus the surrounding atmosphere. */
export const absToGauge = (pAbs) => pAbs - P_ATM;
export const gaugeToAbs = (pGauge) => pGauge + P_ATM;

export const kToC = (k) => k - 273.15;
export const cToK = (c) => c + 273.15;
export const kToF = (k) => ((k - 273.15) * 9) / 5 + 32;
export const fToK = (f) => ((f - 32) * 5) / 9 + 273.15;
