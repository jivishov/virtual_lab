/**
 * How each scenario's gas state maps onto a particle container.
 *
 * Consistency rule: the particle-accessible volume must be proportional to the
 * model volume V, the sphere count to n, and speed to √(T/M). Then wall impacts
 * per area per second, times momentum per impact, scale as nT/V, the same as
 * the model pressure. tests/particles.test.mjs checks this.
 *
 *   shape           see shapes.js
 *   dims(state)     container dimensions from the model state (P, V, T, n)
 *   particleRadius  drawn radius, scene units
 *   rmsSpeed        scene units per second for air at 22 °C, before slow motion
 *   inlet, outlet   port names where gas enters and leaves
 */

const SYRINGE_MAX_L = 0.020;
const SYRINGE_MAX_LEN = 4.2;
const BATH_V0 = 4.0;
const BATH_R0 = 1.15;
const PARTY_BURST_L = 24;
const PARTY_R_BURST = 1.75;
const ENVELOPE_L = 2.8e6;      // L, hot air balloon envelope when full
export const ENVELOPE_S = 3.0; // teardrop scale when full (scene units; 1 unit ≈ 3 m)
export const POT = { radius: 2.2, height: 3.2, volume: 6.0, perLitre: 0.48 }; // scene units, 1 unit ≈ 5 cm

export const CONTAINERS = Object.freeze({
  syringe: {
    shape: 'cylinder',
    dims: (s) => ({ radius: 0.6, length: (SYRINGE_MAX_LEN * s.V) / SYRINGE_MAX_L }),
    particleRadius: 0.055,
    rmsSpeed: 1.6,
    collisions: true,
  },
  balloonBath: {
    shape: 'sphere',
    dims: (s) => ({ radius: BATH_R0 * Math.cbrt(s.V / BATH_V0) }),
    particleRadius: 0.06,
    rmsSpeed: 1.6,
    collisions: true,
  },
  carTire: {
    shape: 'torus',
    dims: () => ({ major: 1.45, minor: 0.36 }),
    particleRadius: 0.05,
    rmsSpeed: 1.6,
    collisions: true,
  },
  partyBalloon: {
    shape: 'sphere',
    dims: (s) => ({ radius: PARTY_R_BURST * Math.cbrt(Math.max(s.V, 0) / PARTY_BURST_L) }),
    particleRadius: 0.055,
    rmsSpeed: 1.2,
    collisions: true,
    inlet: 'bottom',
    outlet: 'bottom',
  },
  hotAirBalloon: {
    shape: 'teardrop',
    dims: (s) => ({ s: ENVELOPE_S * Math.cbrt(Math.max(s.V, 1) / ENVELOPE_L) }),
    particleRadius: 0.12,
    rmsSpeed: 3.0,
    collisions: true,
    inlet: 'bottom',
    outlet: 'bottom',
  },
  pressureCooker: {
    shape: 'cylinder',
    // Gas space above the water: fixed radius, height proportional to the headspace volume.
    dims: (s) => ({ radius: POT.radius - 0.1, length: POT.perLitre * s.V }),
    particleRadius: 0.085,
    rmsSpeed: 1.8,
    collisions: true,
    inlet: 'bottom',   // steam rises off the water surface
    outlet: 'top',     // and leaves through the regulator
  },
  scubaTank: {
    shape: 'capsule',
    dims: () => ({ radius: 0.62, length: 2.5 }),
    particleRadius: 0.05,
    rmsSpeed: 1.6,
    collisions: true,
    inlet: 'top',
    outlet: 'top',
  },
});
