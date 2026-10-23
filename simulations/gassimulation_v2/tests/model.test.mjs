// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { R, atmTo, toAtm, kToC, kToF, fToK, cToK, L_PER_FT3 } from '../js/model/units.js';
import { GASES, solve, idealDeviation, density, relativeSpeed, sphereDiameterCm } from '../js/model/gas.js';
import { LAWS } from '../js/model/laws.js';
import { SCENARIOS, SCENARIO_ORDER } from '../js/model/scenarios.js';
import { createInstrument, stepInstrument, readInstrument } from '../js/model/instrument.js';
import { initWorld, setInput, stepWorld, observe, isSettled, act } from '../js/model/runtime.js';
import { psat, tsat } from '../js/model/steam.js';
import { BALLOON, lift } from '../js/model/hotAir.js';
import { COOKER } from '../js/model/cooker.js';
import { SYSTEMS, LAW_ORDER } from '../js/model/scenarios.js';

const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} expected ${expected} ± ${tol}, got ${actual}`);

/** Step the world for `seconds`, calling check(world) after every frame. */
function run(world, seconds, check, frame = 1 / 60) {
  let w = world;
  for (let t = 0; t < seconds - 1e-9; t += frame) {
    w = stepWorld(w, frame);
    if (check) check(w);
  }
  return w;
}

// ───────────── units and gas ─────────────

test('pressure units and temperature scales', () => {
  near(atmTo(1, 'kPa'), 101.325, 1e-9);
  near(atmTo(1, 'psi'), 14.696, 1e-3);
  near(toAtm(232, 'bar'), 228.97, 0.01);
  near(toAtm(atmTo(3.3, 'mmHg'), 'mmHg'), 3.3, 1e-12);
  near(kToC(273.15), 0, 1e-12);
  near(kToF(373.15), 212, 1e-9);
  near(fToK(-40), cToK(-40), 1e-9);
  near(R, 0.0820574, 1e-7);
});

test('molar volume at STP is 22.4 L and at 22 °C is 24.2 L', () => {
  near(solve({ P: 1, T: 273.15, n: 1, V: 1 }, 'V').V, 22.41, 0.01);
  near(solve({ P: 1, T: 295, n: 1, V: 1 }, 'V').V, 24.21, 0.01);
});

test('molecular quantities', () => {
  near(relativeSpeed(295, GASES.helium.M), 2.69, 0.01, 'helium vs air speed');
  near(relativeSpeed(4 * 295, GASES.air.M), 2, 1e-12, 'speed doubles when T quadruples');
  near(density(1, 295, GASES.air.M), 1.196, 0.001);
  near(sphereDiameterCm(4), 19.7, 0.05);
});

// ───────────── instruments ─────────────

test('analog needle overshoots slightly, then settles', () => {
  const spec = SCENARIOS.scubaTank.instrument;
  let inst = createInstrument(spec, 1); // 0 psig
  const target = toAtm(3000, 'psi') + 1;
  let peak = 0;
  for (let i = 0; i < 180; i++) {
    inst = stepInstrument(inst, target, 1 / 60);
    peak = Math.max(peak, inst.needle);
  }
  assert.ok(peak > 3000 && peak < 3000 * 1.06, `overshoot ${peak}`);
  near(readInstrument(inst).raw, 3000, 3000 * 0.01, 'settled within 1% after 3 s');
});

test('digital sensor quantizes, samples, and shows OVER', () => {
  const spec = SCENARIOS.syringe.instrument;
  let inst = createInstrument(spec, 1);
  assert.equal(readInstrument(inst).text, '101.3');
  inst = stepInstrument(inst, 2.5, 1); // 253 kPa
  const r = readInstrument(inst);
  assert.equal(r.text, 'OVER');
  assert.ok(r.overRange);
});

// ───────────── every scenario obeys PV = nRT at every step ─────────────

for (const id of SCENARIO_ORDER) {
  test(`${id}: PV = nRT holds through random input changes`, () => {
    for (const preset of SCENARIOS[id].presets) {
      let w = initWorld(id, preset.id);
      assert.ok(idealDeviation(w.state) < 1e-12, 'initial state');
      let seed = 7;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let k = 0; k < 12; k++) {
        for (const [key, def] of Object.entries(w.inputs)) {
          if (def.type === 'choice') w = setInput(w, key, def.options[Math.floor(rand() * def.options.length)].value);
          else if (def.type === 'toggle') w = setInput(w, key, rand() < 0.5);
          else w = setInput(w, key, def.min + rand() * (def.max - def.min));
        }
        w = run(w, 1, (x) => {
          if (x.state.n > 0) assert.ok(idealDeviation(x.state) < 1e-9, `deviation at t=${x.time}`);
          assert.ok(Number.isFinite(x.state.P) && Number.isFinite(x.state.V) && Number.isFinite(x.state.T));
        });
      }
      // held variables really are held (scenarios with their own process change n on purpose)
      const law = LAWS[SCENARIOS[id].law];
      const w0 = initWorld(id, preset.id);
      if (!w.failed && !SCENARIOS[id].process) for (const v of law.held) if (v !== 'T') near(w.state[v], w0.state[v], 1e-9, `${v} held`);
    }
  });
}

// ───────────── Boyle: sealed syringe ─────────────

test('syringe: halving the volume doubles the pressure once settled', () => {
  let w = initWorld('syringe');
  w = setInput(w, 'V', 0.005);
  w = run(w, 0.25); // a quick 5 mL stroke at hand speed
  near(w.state.V, 0.005, 1e-12);
  assert.ok(w.state.P > 2.05, `fast stroke overshoots: ${w.state.P}`);
  assert.ok(w.events.includes('settling'));
  w = run(w, 12);
  near(w.state.P, 2.0, 1e-4);
  assert.ok(isSettled(w));
  near(LAWS.boyle.invariant.of(w.state), 0.010, 1e-6, 'PV constant');
  const force = observe(w).derived.find((d) => d.id === 'force').value;
  near(force, 29.0, 0.5, 'push force at 5 mL');
});

test('syringe: fast stroke to 5 mL briefly over-ranges the 210 kPa sensor', () => {
  let w = initWorld('syringe');
  w = setInput(w, 'V', 0.006);
  w = run(w, 6);
  w = setInput(w, 'V', 0.005);
  let sawOver = false;
  w = run(w, 2, (x) => { if (x.events.includes('overRange')) sawOver = true; });
  assert.ok(sawOver);
  w = run(w, 6);
  assert.ok(!w.events.includes('overRange'), 'settled 202.7 kPa is in range');
});

// ───────────── Charles: balloon in baths ─────────────

test('balloon: V/T stays constant across baths', () => {
  let w = initWorld('balloonBath');
  w = setInput(w, 'Tenv', 373);
  w = run(w, 30);
  near(w.state.V, (4 * 373) / 295, 1e-3);
  w = setInput(w, 'Tenv', 195);
  w = run(w, 30);
  near(w.state.V / w.state.T, 4 / 295, 1e-6);
  assert.equal(w.state.P, 1);
});

test('balloon: liquid nitrogen triggers the condensation warning', () => {
  let w = initWorld('balloonBath');
  w = setInput(w, 'Tenv', 77);
  w = run(w, 30);
  assert.ok(w.events.includes('condensing'));
});

// ───────────── Gay-Lussac: car tire ─────────────

test('tire: about 0.9 psi per 10 °F, which matches the rule of thumb', () => {
  let w = initWorld('carTire');
  w = setInput(w, 'Tenv', fToK(68 - 10)); // set point 68 °F, then 10 °F colder
  w = run(w, 40);
  const drop = 32 - atmTo(w.state.P - 1, 'psi');
  near(drop, 0.89, 0.02);
});

test('tire: −30 °C reaches the TPMS threshold, and gauge-pressure math gets it wrong', () => {
  let w = initWorld('carTire');
  w = setInput(w, 'Tenv', 243.15);
  w = run(w, 40);
  const v = observe(w);
  assert.equal(v.reading.value, 24);
  assert.ok(w.events.includes('tpms'));
  const mistake = v.derived.find((d) => d.id === 'gaugeMistake').value;
  near(mistake, 26.5, 0.1, 'wrong prediction');
  near(v.reading.value + 14.7, atmTo(w.state.P, 'psi'), 0.6, 'gauge = absolute − atmosphere');
});

// ───────────── Avogadro: party balloon ─────────────

test('balloon fill: same moles give the same volume for any gas; only helium floats', () => {
  const fill = (presetId) => run(setInput(initWorld('partyBalloon', presetId), 'n', 0.5), 6);
  const he = fill('helium');
  const co2 = fill('co2');
  near(he.state.V, co2.state.V, 1e-12);
  near(he.state.V / he.state.n, 24.21, 0.01, 'molar volume at 22 °C');
  const lift = (w) => observe(w).derived.find((d) => d.id === 'lift').value;
  assert.ok(lift(he) > 9, `helium lift ${lift(he)}`);
  assert.ok(lift(co2) < 0);
  assert.ok(he.events.includes('liftoff'));
});

test('balloon fill: overfilling bursts it, and it stays burst', () => {
  let w = setInput(initWorld('partyBalloon', 'helium'), 'n', 1.1);
  w = run(w, 10);
  assert.equal(w.failed, 'burst');
  assert.equal(w.state.n, 0);
  assert.equal(w.state.V, 0);
  w = run(setInput(w, 'n', 0.3), 2);
  assert.equal(w.state.n, 0, 'cannot refill a burst balloon');
});

// ───────────── Ideal: scuba tank ─────────────

test('scuba: AL80 at 3000 psi holds about 80 ft³ by the ideal gas law', () => {
  const w = initWorld('scubaTank', 'al80');
  const ft3 = observe(w).derived.find((d) => d.id === 'freeAirFt3').value;
  near(ft3, 80.4, 0.5);
  near(w.state.n * R * w.state.T / L_PER_FT3, ft3, 1e-9);
});

test('scuba: filling heats the tank, then the pressure drops as it cools (fill drop)', () => {
  let w = initWorld('scubaTank', 'al80');
  const full = w.state.n;
  w = setInput(w, 'n', w.inputs.n.min);
  w = run(w, 90);
  w = setInput(w, 'n', full);
  let peakT = 0;
  w = run(w, 10, (x) => { peakT = Math.max(peakT, x.state.T); });
  assert.ok(peakT > 300, `tank warmed to ${peakT} K`);
  const hot = atmTo(w.state.P - 1, 'psi');
  w = run(w, 120);
  const cool = atmTo(w.state.P - 1, 'psi');
  assert.ok(hot - cool > 150 && hot - cool < 400, `fill drop ${hot - cool} psi`);
  near(cool, 3000, 1, 'back to rated pressure once cool');
});

test('scuba: cold water lowers the pressure', () => {
  let w = initWorld('scubaTank', 'al80');
  w = setInput(w, 'site', 'quarry');
  w = run(w, 120);
  near(atmTo(w.state.P - 1, 'psi'), (3014.7 * 277.15) / 293.15 - 14.7, 1);
});

test('scuba: overfilling ruptures the burst disk and vents the tank', () => {
  let w = initWorld('scubaTank', 'al80');
  w = setInput(w, 'n', w.inputs.n.max);
  w = run(w, 15);
  assert.equal(w.failed, 'vent');
  near(w.state.P, 1, 1e-9);
  w = run(w, 5);
  assert.ok(observe(w).reading.value < 100, 'needle falls back');
});


// ───────────── steam table ─────────────

test('water vapor pressure matches steam tables', () => {
  near(psat(373.15), 1.0, 0.01, '100 °C');
  near(psat(394.25), 2.03, 0.03, '121.1 °C');
  near(psat(298.15), 0.0313, 0.001, '25 °C');
  near(tsat(2.0207), 394.2, 0.3, 'boiling point at 15 psi gauge');
  for (const T of [300, 350, 373, 380, 420]) near(tsat(psat(T)), T, 0.01, 'inverse');
  let prev = 0;
  for (let T = 280; T < 450; T += 0.5) { const p = psat(T); assert.ok(p > prev, 'monotonic'); prev = p; }
});

// ───────────── systems per law ─────────────

test('every law has at least one system and every system appears once', () => {
  const all = LAW_ORDER.flatMap((l) => SYSTEMS[l]);
  assert.deepEqual([...all].sort(), [...SCENARIO_ORDER].sort());
  for (const l of LAW_ORDER) for (const id of SYSTEMS[l]) assert.equal(SCENARIOS[id].law, l);
});

// ───────────── hot air balloon ─────────────

function balloonRun(preset, burner, seconds, each) {
  let w = setInput(initWorld('hotAirBalloon', preset), 'burner', burner);
  return run(w, seconds, each);
}

test("hot air balloon: Charles's law while filling, then n·T constant once full", () => {
  const T0 = 283.15;
  let sawPhase1 = false, sawPhase2 = false;
  balloonRun('morning', 70, 60, (w) => {
    assert.equal(w.state.P, 1);
    if (!w.extra.full) { near(w.state.V / w.state.T, (0.85 * BALLOON.Venv) / T0, 1e-6, 'V/T'); sawPhase1 = true; }
    else { near(w.state.V, BALLOON.Venv, 1e-6); near(w.state.n * w.state.T, BALLOON.Venv / 0.0820574, 1e-3 * BALLOON.Venv, 'nT'); sawPhase2 = true; }
  });
  assert.ok(sawPhase1 && sawPhase2);
});

test('hot air balloon: full at T_amb / 0.85, lift-off where lift equals 680 kg', () => {
  let fullT = null;
  const w = balloonRun('morning', 70, 60, (x) => { if (fullT === null && x.extra.full) fullT = x.state.T; });
  near(fullT, 283.15 / 0.85, 0.6, 'fills at 60 °C');
  // Analytic lift-off temperature: (ρ_out − ρ_in)·V = 680 kg
  const rhoOut = (28.96 / (0.0820574 * 283.15));
  const Tlift = 283.15 / (1 - 680 / (rhoOut * 2800));
  near(Tlift - 273.15, 78.5, 0.5, 'analytic');
  // the model's lift crosses zero at that temperature
  near(lift({ P: 1, V: BALLOON.Venv, T: Tlift }, 283.15), 680, 0.5);
  assert.ok(w.extra.height > 14.9, 'tethered at 15 m');
  assert.ok(observe(w).events.some((e) => e.id === 'liftoff'));
});

test('hot air balloon: a hot afternoon needs about 113 °C to fly, close to the limit', () => {
  const rhoOut = 28.96 / (0.0820574 * 305.15);
  const Tlift = 305.15 / (1 - 680 / (rhoOut * 2800)) - 273.15;
  near(Tlift, 113, 1);
  const w = balloonRun('afternoon', 100, 40);
  assert.ok(observe(w).events.some((e) => e.id === 'overheat'), 'full burner overheats');
  const calm = balloonRun('afternoon', 60, 40);
  assert.equal(calm.extra.height, 0, '60% burner is not enough on a hot afternoon');
});

test('hot air balloon: the envelope stands up before it is full', () => {
  let standAtFill = null;
  balloonRun('morning', 30, 60, (w) => { if (standAtFill === null && w.extra.stand > 0.97) standAtFill = w.state.V / BALLOON.Venv; });
  assert.ok(standAtFill !== null && standAtFill < 1, `stood up at ${standAtFill}`);
});

// ───────────── pressure cooker ─────────────

function cooker(preset = 'water') { return initWorld('pressureCooker', preset); }

test('cooker: vent closes at 100 °C, regulator holds 15 psi and 121 °C', () => {
  let sealedT = null;
  const w = run(setInput(cooker(), 'heat', 10), 45, (x) => { if (sealedT === null && x.extra.sealed) sealedT = x.state.T; });
  near(sealedT - 273.15, 100, 0.2);
  near(atmTo(w.state.P - 1, 'psi'), 15, 0.05, 'gauge');
  near(w.state.T - 273.15, 121.1, 0.3);
  assert.equal(w.extra.venting, 1);
  assert.ok(w.extra.water < 2, 'steam vented');
  const d = Object.fromEntries(observe(w).derived.map((x) => [x.id, x.value]));
  near(d.gl, 1.336, 0.01, "Gay-Lussac alone");
  near(d.pSteam + d.pAir, w.state.P, 1e-9, 'partial pressures add up');
  assert.ok(d.pSteam > 1.9, 'most of the pressure is steam');
});

test('cooker: clogged vent climbs to 22 psi and blows the plug', () => {
  let peak = 0;
  const w = run(setInput(setInput(cooker(), 'heat', 10), 'blocked', true), 45, (x) => { peak = Math.max(peak, atmTo(x.state.P - 1, 'psi')); });
  assert.ok(w.extra.fired);
  near(peak, 22, 0.2);
  near(w.state.P, 1, 1e-9);
  assert.ok(observe(w).events.some((e) => e.id === 'fired'));
});

test('cooker: lid stays locked under pressure; release, then it opens', () => {
  let w = run(setInput(cooker(), 'heat', 10), 35);
  w = act(w, 'lid');
  assert.equal(w.extra.lid, 'on');
  assert.ok(observe(w).events.some((e) => e.id === 'lidLocked'));
  // Releasing with the stove still on: the float valve closes again and pressure rebuilds.
  let minT = Infinity;
  w = run(act(w, 'release'), 6, (x) => { minT = Math.min(minT, x.state.T); });
  near(minT - 273.15, 100, 0.5, 'flash-cools to about 100 °C');
  assert.ok(w.extra.sealed && atmTo(w.state.P - 1, 'psi') > 3, 'rebuilds pressure');
  // The safe sequence: stove off, release, then open.
  w = run(act(setInput(w, 'heat', 0), 'release'), 6);
  assert.equal(w.extra.sealed, false);
  w = act(w, 'lid');
  assert.equal(w.extra.lid, 'off');
});

test('cooker: water can only be changed with the lid off; overfilling warns', () => {
  let w = setInput(cooker(), 'water', 5);
  w = run(w, 0.2);
  near(w.extra.water, 2, 1e-9, 'ignored with lid on');
  assert.equal(observe(w).inputs.water.enabled, false);
  w = act(w, 'lid');
  w = run(setInput(w, 'water', 5), 0.2);
  near(w.extra.water, 5, 1e-9);
  assert.ok(observe(w).events.some((e) => e.id === 'overfill'));
});

test('cooker: left on high it boils dry, then overheats', () => {
  const w = run(setInput(cooker(), 'heat', 10), 230);
  assert.equal(w.extra.water, 0);
  assert.ok(observe(w).events.some((e) => e.id === 'dry'));
  assert.ok(w.state.T > 394.5, 'past 121 °C once dry');
});

test("cooker: air-only demonstration follows Gay-Lussac's law exactly", () => {
  const w0 = cooker('air');
  run(setInput(w0, 'heat', 4), 10, (x) => near(x.state.P / x.state.T, w0.state.P / w0.state.T, 1e-9, 'P/T'));
});

// ───────────── scuba sites ─────────────

test('scuba: filling only at the fill station; leaving it stops a fill', () => {
  let w = initWorld('scubaTank', 'al80');
  w = setInput(w, 'n', w.inputs.n.min);
  w = run(w, 20);
  w = setInput(w, 'n', 60);
  w = run(w, 1);
  const midFill = w.state.n;
  assert.ok(midFill < 60);
  w = setInput(w, 'site', 'reef');
  near(w.targets.n, w.state.n, 1e-9, 'fill stops');
  w = setInput(w, 'n', 90);
  near(w.targets.n, w.state.n, 1e-9, 'cannot fill at a dive site');
  w = run(w, 30);
  near(w.env.T, 301.15, 1e-9);
});
