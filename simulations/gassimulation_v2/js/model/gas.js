/**
 * Ideal gas: state solving and molecular-scale quantities.
 * A gas state is a plain object { P, V, T, n } in atm, L, K, mol.
 */
import { R, R_SI, T_ROOM } from './units.js';

export const GASES = Object.freeze({
  air:    { id: 'air',    name: 'Air',            symbol: 'air', M: 28.96, gamma: 1.40 },
  helium: { id: 'helium', name: 'Helium',         symbol: 'He',  M: 4.003, gamma: 1.66 },
  co2:    { id: 'co2',    name: 'Carbon dioxide', symbol: 'CO₂', M: 44.01, gamma: 1.29 },
  steam:  { id: 'steam',  name: 'Steam and air',  symbol: 'H₂O', M: 18.02, gamma: 1.33 },
});

/** Return a new state with `unknown` recomputed from PV = nRT. */
export function solve(s, unknown) {
  const { P, V, n, T } = s;
  switch (unknown) {
    case 'P': return { ...s, P: (n * R * T) / V };
    case 'V': return { ...s, V: (n * R * T) / P };
    case 'n': return { ...s, n: (P * V) / (R * T) };
    case 'T': return { ...s, T: (P * V) / (n * R) };
    default: throw new Error(`Cannot solve for "${unknown}"`);
  }
}

/** Relative deviation from PV = nRT. Zero for a consistent state. */
export function idealDeviation({ P, V, n, T }) {
  const pv = P * V;
  const nrt = n * R * T;
  const scale = Math.max(Math.abs(pv), Math.abs(nrt), 1e-12);
  return Math.abs(pv - nrt) / scale;
}

/** Density in g/L. */
export const density = (P, T, M) => (P * M) / (R * T);

/** Root-mean-square molecular speed in m/s (M in g/mol). */
export const rmsSpeed = (T, M) => Math.sqrt((3 * R_SI * T) / (M / 1000));

/** Molecular speed relative to air at room temperature: √(T/M) scaling. */
export const relativeSpeed = (T, M, ref = { T: T_ROOM, M: GASES.air.M }) =>
  Math.sqrt((T / M) / (ref.T / ref.M));

/** Diameter in cm of a sphere with volume V in L. */
export const sphereDiameterCm = (V) => Math.cbrt((6 * Math.max(V, 0)) / Math.PI) * 10;
