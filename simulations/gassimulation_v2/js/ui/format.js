/** Number formatting and per-system display units. */
import { atmTo, toAtm, P_ATM } from '../model/units.js';

export const MINUS = '−';

export function num(x, digits) {
  if (!Number.isFinite(x)) return '–';
  const s = x.toFixed(digits);
  return s.startsWith('-') && Number(s) !== 0 ? MINUS + s.slice(1) : s.replace(/^-/, '');
}

/** Significant figures. html: true writes powers of ten with <sup>. */
export function sig(x, n = 3, { html = true } = {}) {
  if (!Number.isFinite(x)) return '–';
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e < -2 || e >= 5) {
    const m = x / 10 ** e;
    const exp = e < 0 ? MINUS + Math.abs(e) : String(e);
    return html ? `${num(m, n - 1)} × 10<sup>${exp}</sup>` : `${num(m, n - 1)}e${e}`;
  }
  return num(x, Math.max(0, n - 1 - e));
}

/**
 * How each system shows P, V, T, n: unit, conversion from model units, and
 * significant figures. The ideal gas law keeps atm and L so R = 0.08206 works.
 */
const DEFAULT = {
  P: { unit: 'atm', of: (p) => p },
  V: { unit: 'L', of: (v) => v },
  T: { unit: 'K', of: (t) => t },
  n: { unit: 'mol', of: (n) => n },
};
const OVERRIDES = {
  syringe: { P: { unit: 'kPa', of: (p) => atmTo(p, 'kPa') }, V: { unit: 'mL', of: (v) => v * 1000 } },
  hotAirBalloon: { V: { unit: 'm³', of: (v) => v / 1000 } },
  pressureCooker: { P: { unit: 'psi', of: (p) => atmTo(p, 'psi') } },
  carTire: { P: { unit: 'psi', of: (p) => atmTo(p, 'psi') } },
};
export const unitFor = (scenarioId, k) => ({ ...DEFAULT[k], ...(OVERRIDES[scenarioId]?.[k] ?? {}) });

export const VAR_NAMES = { P: 'Pressure', V: 'Volume', T: 'Temperature', n: 'Amount of gas' };

/**
 * The values a student would work with: pressure from the pressure instrument
 * (gauge readings converted to absolute), temperature from a thermometer
 * instrument, everything else from the model.
 */
export function measured(view) {
  const s = view.state;
  const rd = view.reading;
  const out = { P: s.P, V: s.V, T: s.T, n: s.n, from: {} };
  if (rd && rd.quantity === 'P' && !rd.overRange) {
    const v = toAtm(rd.value, rd.unit);
    out.P = rd.reference === 'gauge' ? v + P_ATM : v;
    out.from.P = rd;
  }
  if (rd && rd.quantity === 'T') {
    out.T = rd.unit === 'K' ? rd.value : rd.value + 273.15;
    out.from.T = rd;
  }
  return out;
}
