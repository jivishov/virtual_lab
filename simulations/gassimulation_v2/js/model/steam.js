/**
 * Vapor pressure of water, Antoine equation (P in mmHg, T in °C).
 * Two standard constant sets: 1 to 100 °C and 99 to 374 °C. Blended across
 * 99 to 101 °C so the curve has no step. Accurate to about 1% for 1 to 200 °C
 * (121.1 °C gives 2.02 atm; steam tables give 2.03 atm).
 */
const LOW = { A: 8.07131, B: 1730.63, C: 233.426 };
const HIGH = { A: 8.14019, B: 1810.94, C: 244.485 };
const MMHG_PER_ATM = 760;

const antoine = (k, c) => 10 ** (k.A - k.B / (k.C + c)) / MMHG_PER_ATM;

/** Saturation (vapor) pressure of water in atm at temperature T in kelvin. */
export function psat(T) {
  const c = T - 273.15;
  if (c <= 99) return antoine(LOW, c);
  if (c >= 101) return antoine(HIGH, c);
  const f = (c - 99) / 2;
  return antoine(LOW, c) * (1 - f) + antoine(HIGH, c) * f;
}

/** Boiling temperature in kelvin at absolute pressure P in atm (inverse of psat). */
export function tsat(P) {
  let lo = 250, hi = 650;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (psat(mid) < P) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Latent heat of vaporization of water, J/kg, near 100 to 130 °C. */
export const L_VAP = 2.2e6;
export const M_WATER = 0.018015; // kg/mol
