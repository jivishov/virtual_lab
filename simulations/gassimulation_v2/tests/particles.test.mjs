// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { initWorld, setInput, stepWorld, observe } from '../js/model/runtime.js';
import { SCENARIO_ORDER } from '../js/model/scenarios.js';
import { ParticleEngine, mulberry32 } from '../js/particles/engine.js';
import { CONTAINERS } from '../js/particles/containers.js';
import { SHAPES, getShape, randomPoint } from '../js/particles/shapes.js';

const DT = 1 / 60;
const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} expected ${expected} ± ${tol}, got ${actual}`);
const rel = (a, b) => Math.abs(a / b - 1);

/** Model + engine driven together, the way the app will run them. */
function sim(id, { preset, seed = 3, collisions } = {}) {
  let w = initWorld(id, preset);
  const e = new ParticleEngine(id, { seed, collisions });
  e.sync(observe(w));
  return {
    e,
    get w() { return w; },
    set(key, v) { w = setInput(w, key, v); return this; },
    run(seconds, each) {
      for (let t = 0; t < seconds - 1e-9; t += DT) {
        w = stepWorld(w, DT);
        const v = observe(w);
        e.sync(v);
        e.step(DT);
        if (each) each(w, e, v);
      }
      return this;
    },
    /** Measured pressure averaged over `seconds`, after the meter is reset. */
    measure(seconds) {
      e.resetMeter();
      this.run(seconds);
      return e.measure();
    },
  };
}

// ───────────── shapes ─────────────

test('shape volumes match Monte Carlo estimates', () => {
  const rand = mulberry32(11);
  const cases = {
    cylinder: { radius: 0.6, length: 2 },
    sphere: { radius: 1.1 },
    torus: { major: 1.45, minor: 0.36 },
    capsule: { radius: 0.62, length: 2.5 },
  };
  for (const [name, d] of Object.entries(cases)) {
    const s = getShape(name);
    const { min, max } = s.bounds(d);
    const box = (max[0] - min[0]) * (max[1] - min[1]) * (max[2] - min[2]);
    let inside = 0;
    const N = 200000;
    const p = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < N; i++) {
      p.x = min[0] + rand() * (max[0] - min[0]);
      p.y = min[1] + rand() * (max[1] - min[1]);
      p.z = min[2] + rand() * (max[2] - min[2]);
      if (s.sdf(p, d) < 0) inside++;
    }
    assert.ok(rel((inside / N) * box, s.volume(d)) < 0.02, `${name} volume`);
  }
});

test('outward normals point away from the interior', () => {
  const rand = mulberry32(5);
  const d = { cylinder: { radius: 0.6, length: 2 }, sphere: { radius: 1 }, torus: { major: 1.45, minor: 0.36 }, capsule: { radius: 0.62, length: 2.5 } };
  for (const [name, dims] of Object.entries(d)) {
    const s = SHAPES[name];
    for (let i = 0; i < 500; i++) {
      const p = randomPoint(s, dims, rand);
      const n = s.normal(p, dims, { x: 0, y: 0, z: 0 });
      const eps = 1e-3;
      const q = { x: p.x + n.x * eps, y: p.y + n.y * eps, z: p.z + n.z * eps };
      assert.ok(s.sdf(q, dims) > s.sdf(p, dims) - 1e-12, `${name} normal`);
    }
  }
});

test('container volume is proportional to model volume in every scenario', () => {
  for (const id of SCENARIO_ORDER) {
    const c = CONTAINERS[id];
    const s = getShape(c.shape);
    const w = initWorld(id);
    const V0 = w.state.V > 0 ? w.state.V : 1;
    const k0 = s.volume(c.dims({ ...w.state, V: V0 })) / V0;
    for (const f of [0.5, 0.8, 1.3, 2]) {
      const V = V0 * f;
      const k = s.volume(c.dims({ ...w.state, V })) / V;
      // fixed containers: model V never changes, so only check the variable ones
      if (['syringe', 'balloonBath', 'partyBalloon', 'hotAirBalloon', 'pressureCooker'].includes(id)) assert.ok(rel(k, k0) < 1e-9, `${id} scale`);
    }
  }
});

// ───────────── containment and population ─────────────

for (const id of SCENARIO_ORDER) {
  test(`${id}: spheres stay inside and match the model count`, () => {
    const s = sim(id, { seed: 9 });
    const rand = mulberry32(2);
    const inputs = Object.entries(s.w.inputs);
    for (let k = 0; k < 8; k++) {
      for (const [key, def] of inputs) {
        if (def.type === 'choice') s.set(key, def.options[Math.floor(rand() * def.options.length)].value);
        else if (def.type === 'toggle') s.set(key, rand() < 0.5);
        else s.set(key, def.min + rand() * (def.max - def.min));
      }
      s.run(1.5, (w, e, v) => {
        if (!v.failed) assert.equal(e.count, v.particles.count, 'count');
        const sh = e.shape;
        for (const p of e.gas) assert.ok(sh.sdf(p, e.dims) <= 1e-6, `outside by ${sh.sdf(p, e.dims)}`);
      });
    }
  });
}

test('party balloon: gas enters through the neck at the bottom', () => {
  const s = sim('partyBalloon', { preset: 'helium' }).set('n', 0.3);
  const seen = new Set();
  let firstPositions = [];
  s.run(0.5, (w, e) => {
    for (const p of e.gas) {
      if (!seen.has(p.id)) { seen.add(p.id); firstPositions.push(p.y / e.dims.radius); }
    }
  });
  // Observed one frame after entry, so they have already moved up a little.
  assert.ok(firstPositions.length > 5);
  for (const y of firstPositions) assert.ok(y < 0, `first seen at y/R = ${y}`);
  const mean = firstPositions.reduce((a, b) => a + b, 0) / firstPositions.length;
  assert.ok(mean < -0.5, `mean first-seen y/R = ${mean}`);
});

test('party balloon: burst frees every sphere, then they fade out', () => {
  const s = sim('partyBalloon', { preset: 'helium' }).set('n', 1.1);
  let burstAt = null;
  s.run(10, (w, e, v) => {
    if (v.failed && burstAt === null) {
      burstAt = w.time;
      assert.equal(e.count, 0);
      assert.ok(e.particles.length > 90, 'spheres still visible as they fly off');
      assert.ok(e.particles.every((p) => p.state === 'free'));
    }
  });
  assert.ok(burstAt !== null);
  assert.equal(s.e.particles.length, 0, 'all faded');
});

test('scuba: venting sends spheres out through the valve at the top', () => {
  const s = sim('scubaTank', { preset: 'al80' });
  s.set('n', s.w.inputs.n.max);
  let ok = false;
  s.run(15, (w, e) => {
    const esc = e.particles.filter((p) => p.state === 'escaping');
    if (esc.length > 20) {
      const top = e.dims.length / 2 + e.dims.radius;
      ok = esc.every((p) => p.vy > 0 || p.y > top - 1.5);
    }
  });
  assert.equal(s.w.failed, 'vent');
  assert.ok(ok, 'escaping spheres head for the top');
  assert.equal(s.e.count, 0);
});

// ───────────── kinetic theory ─────────────

test('collisions turn equal speeds into a Maxwell-Boltzmann distribution', () => {
  const s = sim('syringe', { seed: 21 });
  const rand = mulberry32(4);
  for (const p of s.e.gas) {
    const u = 2 * rand() - 1, phi = 2 * Math.PI * rand(), r = Math.sqrt(1 - u * u);
    p.vx = s.e.vrms * r * Math.cos(phi); p.vy = s.e.vrms * r * Math.sin(phi); p.vz = s.e.vrms * u;
  }
  s.run(25);
  const v = [];
  s.run(40, (w, e) => { if (Math.round(w.time * 60) % 6 === 0) v.push(...e.speeds()); });
  const m1 = v.reduce((a, b) => a + b, 0) / v.length;
  const m2 = v.reduce((a, b) => a + b * b, 0) / v.length;
  const m4 = v.reduce((a, b) => a + b ** 4, 0) / v.length;
  near(m1 / Math.sqrt(m2), Math.sqrt(8 / (3 * Math.PI)), 0.015, 'mean/rms');
  near(m4 / (m2 * m2), 5 / 3, 0.12, '⟨v⁴⟩/⟨v²⟩²');
});

test('rms speed follows √T: liquid nitrogen vs boiling water', () => {
  const rms = (e) => Math.sqrt(e.speeds().reduce((a, b) => a + b * b, 0) / e.count);
  const cold = sim('balloonBath').set('Tenv', 77).run(40);
  const hot = sim('balloonBath').set('Tenv', 373).run(40);
  near(rms(hot.e) / rms(cold.e), Math.sqrt(hot.w.state.T / cold.w.state.T), 1e-9);
});

test('helium moves √(44/4) ≈ 3.3× faster than CO₂ at the same temperature', () => {
  const he = sim('partyBalloon', { preset: 'helium' }).set('n', 0.3).run(4);
  const co2 = sim('partyBalloon', { preset: 'co2' }).set('n', 0.3).run(4);
  near(he.e.vrms / co2.e.vrms, Math.sqrt(44.01 / 4.003), 1e-9);
});

// ───────────── what students see matches the gauge ─────────────

// Runs with sphere collisions on, as the app does. Collisions make the motion
// ergodic, so time averages converge. Without them every sphere keeps a fixed
// path and finite samples scatter by ±8%, which says nothing about the physics.

for (const id of SCENARIO_ORDER.filter((x) => x !== 'partyBalloon')) {
  test(`${id}: impact pressure matches kinetic theory P = N·m·⟨v²⟩/3V`, () => {
    const s = sim(id, { seed: 17 }).run(3);
    const r = s.measure(60).pressure / s.e.expectedPressure();
    assert.ok(r > 0.97 && r < 1.08, `measured/expected = ${r}`);
  });
}

test('syringe: halving the volume doubles the measured impact pressure', () => {
  const a = sim('syringe', { seed: 31 }).run(2);
  const pa = a.measure(80).pressure;
  const b = sim('syringe', { seed: 31 }).set('V', 0.005).run(12);
  const pb = b.measure(80).pressure;
  near(pb / pa / (b.w.state.P / a.w.state.P), 1, 0.06);
});

test('car tire: hot tire measures higher in the ratio of absolute temperatures', () => {
  const cold = sim('carTire', { seed: 8 }).set('Tenv', 253.15).run(40);
  const hot = sim('carTire', { seed: 8 }).set('Tenv', 333.15).run(40);
  const pc = cold.measure(60).pressure;
  const ph = hot.measure(60).pressure;
  near(ph / pc / (hot.w.state.T / cold.w.state.T), 1, 0.05);
});

test('Avogadro: helium hits 3.3× as often, each hit 3.3× softer, same pressure as CO₂', () => {
  const he = sim('partyBalloon', { preset: 'helium', seed: 5 }).set('n', 0.5).run(8);
  const co2 = sim('partyBalloon', { preset: 'co2', seed: 5 }).set('n', 0.5).run(8);
  const mh = he.measure(60);
  const mc = co2.measure(60);
  near(mh.hitRate / mc.hitRate / Math.sqrt(44.01 / 4.003), 1, 0.12, 'hit rate ratio');
  near(mh.pressure / mc.pressure, 1, 0.06, 'pressure ratio');
});

// ───────────── performance ─────────────

test('engine step stays fast at the largest sphere count', () => {
  const s = sim('scubaTank', { preset: 'al80' });
  s.set('n', 0.9 * (s.w.inputs.n.max / 1.05)).run(14); // 1.5× working pressure, below the burst disk
  assert.equal(s.w.failed, null);
  assert.ok(s.e.count > 130, `count ${s.e.count}`);
  const t0 = performance.now();
  for (let i = 0; i < 300; i++) s.e.step(DT);
  const ms = (performance.now() - t0) / 300;
  assert.ok(ms < 4, `${ms.toFixed(2)} ms per frame`);
});


test('hot air balloon: heating pushes spheres out through the mouth', () => {
  const s = sim('hotAirBalloon', { seed: 4 });
  const n0 = s.e.count;
  let sawEscape = false;
  s.set('burner', 80).run(30, (w, e) => {
    for (const p of e.particles) if (p.state === 'escaping') { sawEscape = true; break; }
  });
  assert.ok(s.w.extra.full);
  assert.ok(s.e.count < n0, `${s.e.count} < ${n0}`);
  assert.ok(sawEscape);
});

test('pressure cooker: steam spheres join the air as the water heats; air share falls', () => {
  const s = sim('pressureCooker', { seed: 6 });
  const airShare = (e) => e.gas.filter((p) => p.tag === 'air').length / e.count;
  const before = airShare(s.e);
  assert.ok(before > 0.9, `mostly air at 22 °C: ${before}`);
  s.set('heat', 10).run(40);
  assert.ok(s.e.count > 80, `more gas once at pressure: ${s.e.count}`);
  assert.ok(airShare(s.e) < 0.1, `mostly steam at 15 psi: ${airShare(s.e)}`);
});
