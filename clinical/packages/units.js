/**
 * Unit handling for the clinical simulators.
 *
 * Every quantity that crosses a module boundary is expressed in the canonical
 * base set below. Conversion happens once, at the input edge. Mixing mL/min
 * flows with L/h clearances is the single most common defect in hand-rolled
 * pharmacokinetic code, so conversions live here and nowhere else.
 *
 * Canonical units
 *   time           hours          h
 *   volume         litres         L
 *   flow/clearance litres/hour    L/h
 *   amount         milligrams     mg
 *   concentration  mg/L           mg/L  (numerically equal to ug/mL)
 */

/** @typedef {number} Hours */
/** @typedef {number} Litres */
/** @typedef {number} LitresPerHour */
/** @typedef {number} Milligrams */
/** @typedef {number} MgPerLitre */

export const UNITS = Object.freeze({
  time: 'h',
  volume: 'L',
  flow: 'L/h',
  amount: 'mg',
  concentration: 'mg/L',
});

/* ------------------------------------------------------------------ flows */

/** @param {number} v mL/min @returns {LitresPerHour} */
export const mlMinToLh = (v) => v * 0.06;

/** @param {LitresPerHour} v @returns {number} mL/min */
export const lhToMlMin = (v) => v / 0.06;

/** @param {number} v mL/h @returns {LitresPerHour} */
export const mlHToLh = (v) => v / 1000;

/** @param {LitresPerHour} v @returns {number} mL/h */
export const lhToMlH = (v) => v * 1000;

/**
 * Weight-indexed effluent prescriptions are quoted in mL/kg/h (KDIGO doses
 * sit around 20-25 mL/kg/h), but the engine needs an absolute flow.
 * @param {number} mlPerKgPerH
 * @param {number} weightKg
 * @returns {LitresPerHour}
 */
export const mlKgHToLh = (mlPerKgPerH, weightKg) => (mlPerKgPerH * weightKg) / 1000;

/**
 * @param {LitresPerHour} lh
 * @param {number} weightKg
 * @returns {number} mL/kg/h
 */
export const lhToMlKgH = (lh, weightKg) => (lh * 1000) / weightKg;

/* ----------------------------------------------------------------- amounts */

/** @param {number} g @returns {Milligrams} */
export const gToMg = (g) => g * 1000;

/** @param {Milligrams} mg @returns {number} g */
export const mgToG = (mg) => mg / 1000;

/* -------------------------------------------------------------------- time */

/** @param {number} min @returns {Hours} */
export const minToH = (min) => min / 60;

/** @param {Hours} h @returns {number} min */
export const hToMin = (h) => h * 60;

/* ------------------------------------------------------------- validation */

/**
 * Guard used at every input edge. Throws rather than silently producing NaN,
 * because a NaN propagating into a concentration curve is far harder to
 * notice than an exception at the point of entry.
 *
 * @param {unknown} value
 * @param {string} name
 * @param {{min?: number, max?: number, allowZero?: boolean}} [opts]
 * @returns {number}
 */
export function requireFinite(value, name, opts = {}) {
  const { min = -Infinity, max = Infinity, allowZero = true } = opts;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number, received ${JSON.stringify(value)}`);
  }
  if (!allowZero && value === 0) {
    throw new RangeError(`${name} must not be zero`);
  }
  if (value < min || value > max) {
    throw new RangeError(`${name} must lie in [${min}, ${max}], received ${value}`);
  }
  return value;
}

/**
 * Fractions (unbound fraction, haematocrit, sieving coefficient) are a
 * recurring source of "entered 20 meaning 20%" errors.
 *
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
export function requireFraction(value, name) {
  return requireFinite(value, name, { min: 0, max: 1 });
}
