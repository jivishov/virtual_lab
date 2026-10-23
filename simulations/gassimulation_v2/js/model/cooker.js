/**
 * Stovetop pressure cooker: 6 L pot, aluminum, on a gas burner.
 *
 * Energy balance on water + pot:  C·dT/dt = Q_stove − h·(T − T_room) − L·(evaporation)
 *
 * Open (air vent up, or lid off): pressure is 1 atm, so water cannot pass 100 °C;
 * extra heat boils water away. When the water boils, steam pushes the air out and
 * the air vent closes (sealed).
 *
 * Sealed with water: the headspace holds water vapor in equilibrium with the
 * water plus a little leftover air:
 *     P = P_vapor(T) + n_air·R·T / V_headspace
 * The vapor term follows the steam curve (Antoine), not Gay-Lussac: as the water
 * warms, more of it evaporates, so the amount of gas n grows.
 * The weighted regulator caps the gauge pressure at 15 psi (121 °C); extra heat
 * vents steam. If the vent pipe is clogged, pressure climbs to the overpressure
 * plug (22 psi here), which blows out.
 *
 * Sealed without water (air-only demonstration, or boiled dry): a fixed amount of
 * gas, so Gay-Lussac's law applies exactly.
 *
 * Values are typical of stovetop cookers, not one model. Time is compressed.
 */
import { R, P_ATM, toAtm, atmTo, gaugeToAbs } from './units.js';
import { psat, tsat, L_VAP, M_WATER } from './steam.js';

export const COOKER = Object.freeze({
  Vpot: 6.0,          // L
  mPot: 2.3,          // kg aluminum
  cAl: 900,           // J/(kg·K)
  cW: 4186,           // J/(kg·K)
  Qmax: 1500,         // W reaching the pot on high (a 2.5 to 3 kW burner)
  hLoss: 6,           // W/K to the kitchen
  Troom: 295.15,      // 22 °C
  regPsi: 15,         // weighted regulator, gauge
  safetyPsi: 22,      // overpressure plug, gauge
  lidLockPsi: 0.3,    // lid stays locked above this
  compress: 30,       // model seconds per real second
  airLeft: 0.08,      // atm of air left in the headspace when the vent closes
  maxFill: 4.0,       // L, two-thirds of the pot
});

export const gaugePsi = (P) => atmTo(P - P_ATM, 'psi');
const absAtPsi = (psi) => gaugeToAbs(toAtm(psi, 'psi'));
const T_BOIL = tsat(P_ATM);

/** Temperature at which wet headspace pressure reaches P. */
function tAt(P, Vh, nAir) {
  let lo = 260, hi = 700;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (psat(mid) + (nAir * R * mid) / Vh < P) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export const cookerProcess = {
  init(preset) {
    const Vh = COOKER.Vpot - preset.water;
    const nGas = (P_ATM * Vh) / (R * COOKER.Troom);
    return {
      water: preset.water,
      airOnly: !!preset.airOnly,
      lid: 'on',
      sealed: !!preset.airOnly,
      everSealed: !!preset.airOnly,
      nAir: preset.airOnly ? nGas : 0,
      nGas,
      releasing: false,
      fired: false,
      venting: 0,       // 0 none, 1 regulator, 2 plug blew, 3 quick release
      ventRate: 0,      // kg of steam per real second
      boiling: 0,       // 0..1, for bubbles in the water
      lidLockedFor: 0,  // s left on the "lid locked" message
    };
  },

  step(w, h) {
    const C0 = COOKER;
    const ex = { ...w.extra };
    const blocked = !!w.targets.blocked;
    const heat = w.targets.heat ?? 0;
    if (ex.lid === 'off' && !ex.airOnly) ex.water = w.targets.water;

    const dt = h * C0.compress;
    let T = w.state.T;
    let Vh = C0.Vpot - ex.water;
    const wet = ex.water > 1e-6;
    const C = (wet ? ex.water * C0.cW : 0) + C0.mPot * C0.cAl;
    const Q = (heat / 10) * C0.Qmax;
    const net = Q - C0.hLoss * (T - C0.Troom);
    let evap = 0;
    let venting = 0;
    let P;

    if (!ex.sealed) {
      T += (net * dt) / C;
      if (wet && T > T_BOIL) { evap = ((T - T_BOIL) * C) / L_VAP; T = T_BOIL; }
      P = P_ATM;
      if (wet && ex.lid === 'on' && !ex.fired && heat > 0 && T >= T_BOIL - 0.05) {
        // Steam lifts the air vent closed. The first time, some air is still trapped;
        // after a release the headspace is already steam.
        ex.nAir = ((ex.everSealed ? 0.005 : C0.airLeft) * Vh) / (R * T);
        ex.sealed = true;
        ex.everSealed = true;
      }
    } else if (wet) {
      let Tn = T + (net * dt) / C;
      if (ex.releasing) {
        // A wide-open valve vents far more steam than the burner makes, so the
        // contents flash-boil down toward 100 °C whatever the stove is doing.
        const Tfloor = tAt(P_ATM, Vh, ex.nAir);
        const Tr = Math.max(Tfloor, Tfloor + (T - Tfloor) * Math.exp(-h / 0.5));
        evap = (Math.max(0, Tn - Tr) * C) / L_VAP;
        Tn = Tr;
        venting = 3;
      } else if (!blocked) {
        const Tmax = tAt(absAtPsi(C0.regPsi), Vh, ex.nAir);
        if (Tn > Tmax) { evap = ((Tn - Tmax) * C) / L_VAP; Tn = Tmax; venting = 1; }
      }
      T = Tn;
      P = psat(T) + (ex.nAir * R * T) / Vh;
      if (blocked && !ex.releasing && gaugePsi(P) >= C0.safetyPsi) {
        // Overpressure plug blows: the pot drops to 1 atm at once and the water flashes.
        evap += ((T - T_BOIL) * C) / L_VAP;
        T = T_BOIL;
        P = P_ATM;
        ex.fired = true;
        ex.sealed = false;
        ex.nAir = 0;
        venting = 2;
      }
      if (ex.sealed && evap > 0) {
        // Air leaves along with the vented steam, in proportion.
        const nTot = (P * Vh) / (R * T);
        ex.nAir *= Math.max(0, 1 - evap / M_WATER / Math.max(nTot, 1e-9));
      }
    } else {
      // Sealed, no water: a fixed amount of gas.
      T += (net * dt) / C;
      P = (ex.nGas * R * T) / Vh;
      if (ex.releasing) {
        const nTarget = (P_ATM * Vh) / (R * T);
        ex.nGas = nTarget + (ex.nGas - nTarget) * Math.exp(-h / 0.6);
        venting = 3;
      } else if (!blocked && P > absAtPsi(C0.regPsi)) {
        ex.nGas = (absAtPsi(C0.regPsi) * Vh) / (R * T);
        venting = 1;
      }
      P = (ex.nGas * R * T) / Vh;
      if (blocked && !ex.releasing && gaugePsi(P) >= C0.safetyPsi) {
        ex.fired = true;
        ex.sealed = false;
        ex.nGas = (P_ATM * Vh) / (R * T);
        P = P_ATM;
        venting = 2;
      }
      if (ex.airOnly) ex.nAir = ex.nGas;
    }

    ex.water = Math.max(0, ex.water - evap);
    Vh = C0.Vpot - ex.water;
    if (ex.sealed) {
      P = ex.water > 1e-6 ? psat(T) + (ex.nAir * R * T) / Vh : (ex.nGas * R * T) / Vh;
      if (ex.releasing && gaugePsi(P) < C0.lidLockPsi) { ex.releasing = false; ex.sealed = false; }
    } else {
      P = P_ATM;
      ex.releasing = false;
    }
    if (wet && ex.water <= 1e-6) ex.nGas = (P * Vh) / (R * T); // just boiled dry: freeze the gas amount
    if (ex.water > 1e-6) ex.nGas = (P * Vh) / (R * T);

    ex.venting = venting;
    ex.ventRate = evap / Math.max(h, 1e-9);
    const boilingNow = ex.water > 1e-6 && (venting > 0 || (!ex.sealed && T >= T_BOIL - 0.5 && heat > 0));
    ex.boiling = ex.boiling + ((boilingNow ? 1 : 0) - ex.boiling) * (1 - Math.exp(-h / 0.4));
    ex.lidLockedFor = Math.max(0, ex.lidLockedFor - h);

    const state = { P, V: Vh, T, n: (P * Vh) / (R * T) };
    return { state, extra: ex, envT: C0.Troom };
  },

  act(w, id) {
    const ex = { ...w.extra };
    if (id === 'release') {
      if (ex.sealed) ex.releasing = true;
    } else if (id === 'lid') {
      if (ex.lid === 'on') {
        if (gaugePsi(w.state.P) > COOKER.lidLockPsi) ex.lidLockedFor = 5;
        else { ex.lid = 'off'; ex.sealed = false; ex.releasing = false; }
      } else {
        ex.lid = 'on';
      }
    } else {
      throw new Error(`Unknown action "${id}"`);
    }
    return { ...w, extra: ex };
  },

  settled(w) {
    return w.extra.venting === 0 && w.targets.heat === 0 && Math.abs(w.state.T - COOKER.Troom) < 0.5;
  },
};
