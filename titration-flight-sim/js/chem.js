/**
 * chem.js — Aqueous acid/base chemistry for the titration simulator.
 *
 * Everything the simulator shows the student is derived from these functions.
 * There are no scripted "the flask turns pink now" triggers: the colour comes
 * from the indicator equilibrium, which comes from the pH, which comes from an
 * exact charge/mass balance on the solution actually in the flask.
 */

export const Kw = 1e-14;

/** Phenolphthalein: colourless (HIn) <-> magenta (In-). pKa ~9.4. */
export const PHENOLPHTHALEIN = { pKa: 9.4, dropML: 0.05, stockM: 0.031 };

/** Molarity of the standardised titrant, before any dilution effects. */
export const NAOH_NOMINAL_M = 0.1000;

/**
 * Exact pH of a strong-acid / strong-base mixture, including water
 * autoionisation (which is what keeps the curve finite at equivalence).
 *
 *   charge balance:  [H+] + [Na+] = [OH-] + [Cl-]
 *   with [OH-] = Kw/[H+]  and  C = ([Cl-] - [Na+]) = (nH - nOH)/V
 *   =>  [H+]^2 - C[H+] - Kw = 0
 */
export function pHOf(nH, nOH, volumeL) {
  if (volumeL <= 0) return 7;
  const C = (nH - nOH) / volumeL;
  const h = (C + Math.sqrt(C * C + 4 * Kw)) / 2;
  return -Math.log10(Math.max(h, 1e-15));
}

/** Fraction of phenolphthalein present as the coloured In- form. */
export function indicatorFraction(pH) {
  return 1 / (1 + Math.pow(10, PHENOLPHTHALEIN.pKa - pH));
}

/**
 * Perceived pink intensity, 0..1.
 *
 * Beer–Lambert in its linear regime: what you see tracks the concentration of
 * the coloured In- form, i.e. the ionised fraction times how much indicator
 * was added. Forget the indicator and no amount of titrant produces a colour.
 *
 * Calibrated so a normal 2–3 drops of 1% phenolphthalein in ~55 mL crosses the
 * visible threshold at about pH 8.2 — the textbook value — reads as a clear
 * pink one drop past equivalence, and saturates well past that.
 */
export function pinkIntensity(pH, indicatorMol, volumeL) {
  if (volumeL <= 0 || indicatorMol <= 0) return 0;
  const conc = indicatorMol / volumeL;          // mol/L
  const ratio = Math.min(conc / 7.0e-5, 1.5);   // ~0.8 for a normal 2-3 drops
  return Math.max(0, Math.min(1, indicatorFraction(pH) * ratio));
}

/**
 * Faintest pink a student can honestly claim to see. With a normal indicator
 * dose this lands at about pH 8.2, which is where phenolphthalein is quoted as
 * beginning to show colour.
 */
export const VISIBLE_PINK = 0.045;

/** Colour of the bulk solution for a given pink intensity (linear-ish sRGB). */
export function solutionRGB(intensity) {
  const i = Math.min(1, Math.max(0, intensity));
  // clear, very slightly blue-grey  ->  phenolphthalein magenta
  const clear = [0.86, 0.93, 0.98];
  const pink = [0.83, 0.10, 0.44];
  const t = Math.pow(i, 0.75);
  return [
    clear[0] + (pink[0] - clear[0]) * t,
    clear[1] + (pink[1] - clear[1]) * t,
    clear[2] + (pink[2] - clear[2]) * t,
  ];
}

/** Opacity/darkness of the solution, so strong pink also reads as denser. */
export function solutionOpacity(intensity) {
  return 0.55 + 0.35 * Math.min(1, intensity);
}

/**
 * A single well-mixed portion of solution in a vessel.
 * Tracks moles, not concentrations, so dilution is automatically correct:
 * adding water changes pH not at all in terms of moles of analyte.
 */
export class Solution {
  constructor() {
    this.volumeL = 0;
    this.nH = 0;            // moles of strong acid (HCl)
    this.nOH = 0;           // moles of strong base (NaOH)
    this.indicatorMol = 0;
  }

  reset() {
    this.volumeL = 0;
    this.nH = 0;
    this.nOH = 0;
    this.indicatorMol = 0;
  }

  /** Add v mL of a solution containing cH / cOH mol/L of strong acid/base. */
  add(ml, { cH = 0, cOH = 0, indicatorM = 0 } = {}) {
    const L = ml / 1000;
    if (L <= 0) return;
    this.volumeL += L;
    this.nH += cH * L;
    this.nOH += cOH * L;
    this.indicatorMol += indicatorM * L;
  }

  get volumeML() { return this.volumeL * 1000; }

  /**
   * pH of the mixture, accounting for the indicator itself.
   *
   * Phenolphthalein is a weak acid, so turning it pink consumes hydroxide:
   * whatever fraction f is ionised has taken f·n(indicator) moles of OH- out
   * of circulation. That couples pH and f, so solve it by a short fixed-point
   * iteration — which is why dosing eight drops of indicator visibly costs you
   * titrant, exactly as it does on the bench.
   */
  get pH() {
    let ph = pHOf(this.nH, this.nOH, this.volumeL);
    if (this.indicatorMol > 0) {
      for (let i = 0; i < 4; i++) {
        const consumed = indicatorFraction(ph) * this.indicatorMol;
        ph = pHOf(this.nH, this.nOH - consumed, this.volumeL);
      }
    }
    return ph;
  }
  get pink() { return pinkIntensity(this.pH, this.indicatorMol, this.volumeL); }
  get hasIndicator() { return this.indicatorMol > 1e-9; }
}

/**
 * Theoretical titration curve, used for the debrief chart so students can
 * compare where their endpoint landed against the real equivalence point.
 */
export function theoreticalCurve({ ca, va, cb, vMax, points = 400 }) {
  const out = [];
  const nH = ca * (va / 1000);
  for (let i = 0; i <= points; i++) {
    const vb = (vMax * i) / points;
    const nOH = cb * (vb / 1000);
    out.push([vb, pHOf(nH, nOH, (va + vb) / 1000)]);
  }
  return out;
}

/** Equivalence volume in mL for the given amounts. */
export function equivalenceVolume({ ca, va, cb }) {
  return (ca * va) / cb;
}

/** Mean / sample standard deviation / relative standard deviation (%). */
export function stats(values) {
  const n = values.length;
  if (n === 0) return { mean: 0, sd: 0, rsd: 0, n: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { mean, sd: 0, rsd: 0, n };
  const varr = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(varr);
  return { mean, sd, rsd: mean !== 0 ? (sd / mean) * 100 : 0, n };
}
