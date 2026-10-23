/**
 * Hot air balloon: an envelope open at the bottom (the mouth), so the air
 * inside is always at outside pressure.
 *
 * Phase 1, envelope not yet full: the fan has put a fixed amount of cool air
 * in (85% of the envelope). Heating it makes it expand at constant P and n:
 * Charles's law, V/T constant.
 *
 * Phase 2, envelope full: V cannot grow, so the expanding air spills out of the
 * mouth. n = PV/RT falls as T rises, and the air inside gets less dense.
 * If it cools, outside air flows back in through the mouth.
 *
 * Lift = (ρ_outside − ρ_inside)·V. The balloon leaves the ground when lift
 * exceeds the 680 kg of envelope, basket, burner, fuel and four people.
 */
import { R, P_ATM } from './units.js';
import { density } from './gas.js';

export const BALLOON = Object.freeze({
  Venv: 2.8e6,        // L. 2,800 m³, a common four-passenger envelope
  coldFill: 0.85,     // fraction filled by the fan before the burner is lit
  mTotal: 680,        // kg: envelope 110, basket and burner 90, three full tanks 120, four people 360
  mEnvelope: 110,     // kg of fabric that must be lifted for the envelope to stand up
  tether: 15,         // m
  heatSpan: 125,      // K above ambient at full burner, steady state
  tau: 8,             // s, compressed. A real envelope responds over about a minute.
  Twarn: 383.15,      // 110 °C
  Tlimit: 393.15,     // 120 °C, typical maximum continuous envelope temperature
  Mair: 28.96,
});

const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/** Lift in kg for the current state and ambient temperature. */
export function lift(state, Tamb) {
  const dRho = density(P_ATM, Tamb, BALLOON.Mair) - density(state.P, state.T, BALLOON.Mair); // kg/m³
  return dRho * (state.V / 1000);
}

export const hotAirProcess = {
  init(preset) {
    return { full: false, stand: 0, height: 0, Tamb: preset.Tamb, Tsrc: preset.Tamb, lift: 0, net: -BALLOON.mTotal };
  },

  step(w, h) {
    const { Tamb } = w.extra;
    const burner = w.targets.burner ?? 0;
    const Tsrc = Tamb + (BALLOON.heatSpan * burner) / 100;
    let { n, T } = w.state;
    const P = P_ATM;
    T = Tsrc + (T - Tsrc) * Math.exp(-h / BALLOON.tau);

    let { full } = w.extra;
    let V = (n * R * T) / P;
    if (!full && V >= BALLOON.Venv) full = true;
    if (full) {
      V = BALLOON.Venv;
      n = (P * V) / (R * T);
    }
    const state = { P, V, T, n };
    const L = lift(state, Tamb);
    const net = L - BALLOON.mTotal;

    // The envelope stands up once its warm air can carry the fabric.
    const standTarget = smooth((L / BALLOON.mEnvelope - 0.5) / 0.7);
    const stand = w.extra.stand + (standTarget - w.extra.stand) * (1 - Math.exp(-h / 1.2));

    // Tethered flight: climb or sink with net lift, up to the tether length.
    let { height } = w.extra;
    if (stand > 0.97 && net > 0) height += Math.min(2.5, net / 30) * h;
    else if (height > 0) height -= Math.min(2.5, Math.max(0.4, -net / 30)) * h;
    height = Math.min(BALLOON.tether, Math.max(0, height));

    return { state, extra: { ...w.extra, full, stand, height, lift: L, net, Tsrc }, envT: Tamb };
  },

  settled(w) {
    return Math.abs(w.state.T - w.extra.Tsrc) < 0.3;
  },
};
