/**
 * Pressure instruments with realistic response.
 *
 * analog:  Bourdon-tube needle, modeled as a damped second-order system
 *          (slight overshoot, settles), stopped by pins at both ends of the dial.
 * digital: sensor with first-order lag, sampled and held, quantized,
 *          shows OVER when the true value leaves the sensor range.
 *
 * reference 'gauge' reads absolute minus atmosphere; 'absolute' reads absolute.
 */
import { atmTo, P_ATM } from './units.js';

const NEEDLE_STEP = 1 / 480; // s, integration step for the needle

/**
 * What the instrument would show with no lag. `s` is a gas state { P, V, T, n }
 * or, for pressure instruments, a bare absolute pressure in atm.
 * spec.quantity: 'P' (default) or 'T' (temperature, unit '°C' or 'K').
 */
function trueValue(spec, s) {
  if (spec.quantity === 'T') {
    const T = typeof s === 'number' ? s : s.T;
    return spec.unit === 'K' ? T : T - 273.15;
  }
  const pAbs = typeof s === 'number' ? s : s.P;
  return atmTo(spec.reference === 'gauge' ? pAbs - P_ATM : pAbs, spec.unit);
}

const quantize = (x, res) => Math.round(x / res) * res;

export function createInstrument(spec, s) {
  const v = trueValue(spec, s);
  return { spec, needle: v, velocity: 0, sensor: v, held: v, clock: 0 };
}

export function stepInstrument(inst, s, dt) {
  const { spec } = inst;
  const target = trueValue(spec, s);
  const [lo, hi] = spec.range;

  if (spec.kind === 'analog') {
    let { needle, velocity } = inst;
    const w = spec.omega;
    const z = spec.zeta;
    let t = dt;
    while (t > 1e-12) {
      const h = Math.min(NEEDLE_STEP, t);
      velocity += (w * w * (target - needle) - 2 * z * w * velocity) * h;
      needle += velocity * h;
      if (needle < lo) { needle = lo; velocity = Math.max(0, velocity); }
      if (needle > hi) { needle = hi; velocity = Math.min(0, velocity); }
      t -= h;
    }
    return { ...inst, needle, velocity };
  }

  // digital
  const sensor = spec.tau > 0 ? target + (inst.sensor - target) * Math.exp(-dt / spec.tau) : target;
  let { held, clock } = inst;
  clock += dt;
  if (clock >= spec.samplePeriod) {
    clock %= spec.samplePeriod;
    held = sensor;
  }
  return { ...inst, sensor, held, clock };
}

/** What the student sees on the instrument. */
export function readInstrument(inst) {
  const { spec } = inst;
  const [lo, hi] = spec.range;
  if (spec.kind === 'analog') {
    return {
      kind: 'analog',
      name: spec.name,
      unit: spec.unit,
      quantity: spec.quantity ?? 'P',
      reference: spec.reference,
      value: quantize(inst.needle, spec.resolution),
      raw: inst.needle,
      text: quantize(inst.needle, spec.resolution).toFixed(Math.max(0, -Math.floor(Math.log10(spec.resolution) + 1e-9))),
      fraction: (inst.needle - lo) / (hi - lo),
      overRange: inst.needle >= hi,
      underRange: inst.needle <= lo,
    };
  }
  const overRange = inst.held > hi;
  const underRange = inst.held < lo;
  const clipped = Math.min(hi, Math.max(lo, inst.held));
  const value = quantize(clipped, spec.resolution);
  const decimals = Math.max(0, -Math.floor(Math.log10(spec.resolution) + 1e-9));
  return {
    kind: 'digital',
    name: spec.name,
    unit: spec.unit,
    quantity: spec.quantity ?? 'P',
    reference: spec.reference,
    value,
    raw: inst.held,
    fraction: (clipped - lo) / (hi - lo),
    text: overRange ? 'OVER' : value.toFixed(decimals).replace('-', '−'),
    overRange,
    underRange,
  };
}
