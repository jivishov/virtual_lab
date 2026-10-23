/**
 * Simulation runtime: a pure functional core.
 *
 *   let w = initWorld('syringe');
 *   w = setInput(w, 'V', 0.006);
 *   w = act(w, 'release');       // scenario actions (pressure cooker)
 *   w = stepWorld(w, dt);        // call every frame
 *   const view = observe(w);     // everything the UI and 3D scene need
 *
 * Every function returns a new world; nothing is mutated. No DOM, no Three.js.
 *
 * Most scenarios use the default process below (closed container, inputs V, n,
 * surroundings temperature). Scenarios with their own physics (hot air balloon,
 * pressure cooker) supply sc.process = { init, step, act }.
 */
import { SCENARIOS } from './scenarios.js';
import { LAWS } from './laws.js';
import { GASES, solve, relativeSpeed } from './gas.js';
import { R, P_ATM, N_A } from './units.js';
import { createInstrument, stepInstrument, readInstrument } from './instrument.js';

const MAX_FRAME = 0.1;   // s. Longer frames (tab switch) are clipped.
const SUBSTEP = 1 / 120; // s
const SETTLED_K = 0.2;   // K. Gas within this of its surroundings counts as settled.

const resolve = (v, preset) => (typeof v === 'function' ? v(preset) : v);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function getScenario(id) {
  const sc = SCENARIOS[id];
  if (!sc) throw new Error(`Unknown scenario "${id}"`);
  return sc;
}

function inputDefault(key, def, s0, state) {
  if (def.type === 'choice') return def.default ?? def.options[0].value;
  if (def.type === 'toggle') return def.default ?? false;
  if ('default' in def) return def.default;
  if (key === 'Tenv') return s0.Tenv;
  return state[key];
}

/** Surroundings temperature: a Tenv slider, or the chosen site's temperature. */
function envTemperature(w, targets) {
  if ('Tenv' in targets) return targets.Tenv;
  for (const [key, def] of Object.entries(w.inputs)) {
    if (def.type === 'choice') {
      const opt = def.options.find((o) => o.value === targets[key]);
      if (opt && 'Tenv' in opt) return opt.Tenv;
    }
  }
  return w.env.T;
}

export function initWorld(scenarioId, presetId) {
  const sc = getScenario(scenarioId);
  const preset = sc.presets.find((p) => p.id === presetId) ?? sc.presets[0];
  const gas = GASES[preset.gas ?? sc.gas];
  const law = LAWS[sc.law];
  const s0 = sc.initial(preset);
  const state = sc.process ? { P: s0.P, V: s0.V, T: s0.T, n: s0.n } : solve({ P: s0.P, V: s0.V, T: s0.T, n: s0.n }, law.responds);

  const inputs = {};
  for (const [key, def] of Object.entries(sc.inputs)) {
    inputs[key] = { ...def, min: resolve(def.min, preset), max: resolve(def.max, preset) };
    if ('default' in def) inputs[key].default = resolve(def.default, preset);
  }
  const targets = {};
  for (const [key, def] of Object.entries(inputs)) targets[key] = inputDefault(key, def, s0, state);

  const thermal = sc.thermal
    ? { ...sc.thermal, wallMolEq: resolve(sc.thermal.wallMolEq ?? 0, preset) }
    : null;

  let world = {
    scenarioId: sc.id,
    preset,
    gas,
    lawId: law.id,
    inputs,
    thermal,
    state,
    env: { T: s0.Tenv },
    targets,
    extra: sc.process ? sc.process.init(preset, s0) : {},
    instrument: null,
    molPerSphere: resolve(sc.particles.molPerSphere, preset) ?? state.n / sc.particles.count,
    latched: [],
    failed: null,
    events: [],
    time: 0,
  };
  world.env = { T: envTemperature(world, targets) };
  world.instrument = sc.instrument ? createInstrument(sc.instrument, world.state) : null;
  return applyEvents(world);
}

export function setInput(world, key, value) {
  const def = world.inputs[key];
  if (!def) throw new Error(`Scenario "${world.scenarioId}" has no input "${key}"`);
  if (world.failed && key === 'n') return world;
  const sc = getScenario(world.scenarioId);
  let v = value;
  if (def.type === 'choice') {
    if (!def.options.some((o) => o.value === v)) throw new Error(`"${v}" is not an option of ${key}`);
  } else if (def.type === 'toggle') {
    v = !!v;
  } else {
    v = clamp(+v, def.min, def.max);
  }
  // A scenario rule may adjust the value, ignore it (undefined), or rewrite
  // several targets at once ({ targets }).
  if (sc.inputRule) {
    const out = sc.inputRule(world, key, v);
    if (out === undefined) return world;
    if (out && typeof out === 'object' && out.targets) return { ...world, targets: out.targets };
    v = out;
  }
  return { ...world, targets: { ...world.targets, [key]: v } };
}

/** Scenario actions, such as releasing pressure or opening a lid. */
export function act(world, actionId) {
  const sc = getScenario(world.scenarioId);
  if (!sc.process?.act) throw new Error(`Scenario "${world.scenarioId}" has no actions`);
  return applyEvents(sc.process.act(world, actionId));
}

export function stepWorld(world, dt) {
  let w = world;
  let remaining = clamp(dt, 0, MAX_FRAME);
  while (remaining > 1e-9) {
    const h = Math.min(SUBSTEP, remaining);
    w = applyEvents(advance(w, h));
    remaining -= h;
  }
  return w;
}

function advance(w, h) {
  const sc = getScenario(w.scenarioId);
  let next;
  if (sc.process) {
    const envT = envTemperature(w, w.targets);
    const out = sc.process.step({ ...w, env: { T: envT } }, h);
    next = { ...w, state: out.state, extra: out.extra, env: { T: out.envT ?? envT }, targets: out.targets ?? w.targets };
  } else {
    next = defaultProcess(w, h);
  }
  const instrument = next.instrument ? stepInstrument(next.instrument, next.state, h) : null;
  return { ...next, instrument, time: w.time + h };
}

function defaultProcess(w, h) {
  const { thermal, gas, targets } = w;
  const law = LAWS[w.lawId];
  let { P, V, T, n } = w.state;
  const envT = envTemperature(w, targets);

  // Volume input: the plunger moves at hand speed. Fast strokes heat or cool the gas.
  if ('V' in targets && targets.V !== V) {
    const Vnew = V + ramp(w.inputs.V, targets.V - V, h);
    if (thermal?.adiabatic) T *= Math.pow(V / Vnew, gas.gamma - 1);
    V = Vnew;
  }

  // Amount input: gas flows at a finite rate.
  if ('n' in targets && targets.n !== n) {
    const dn = ramp(w.inputs.n, targets.n - n, h);
    if (thermal?.fill) {
      // Energy balance on gas + cylinder wall (W = wall heat capacity in moles of gas cv).
      // Inflow:  dT = (γ·T_in − T)·dn / (n + W)
      // Outflow: dT = (γ − 1)·T·dn / (n + W)
      const denom = n + thermal.wallMolEq;
      if (denom > 0) {
        T += dn > 0 ? ((gas.gamma * envT - T) * dn) / denom : ((gas.gamma - 1) * T * dn) / denom;
      }
    }
    n = Math.max(0, n + dn);
  }

  // Heat exchange with the surroundings.
  if (thermal) T = envT + (T - envT) * Math.exp(-h / thermal.tau);
  else if ('Tenv' in targets) T = envT;

  // A vented container is open to the air: gas flows in or out to keep 1 atm.
  let nextTargets = targets;
  if (w.failed === 'vent') {
    n = (P_ATM * V) / (R * T);
    nextTargets = { ...targets, n };
  }

  const state = solve({ P, V, T, n }, law.responds);
  return { ...w, state, targets: nextTargets, env: { T: envT } };
}

/** Step toward a target, limited by the input's rate (instant when it has none). */
function ramp(def, gap, h) {
  if (!def.rate) return gap;
  const limit = (gap > 0 ? def.rate.up : def.rate.down) * h;
  return Math.sign(gap) * Math.min(Math.abs(gap), limit);
}

function context(w) {
  const sc = getScenario(w.scenarioId);
  const ctx = {
    state: w.state,
    env: w.env,
    preset: w.preset,
    gas: w.gas,
    targets: w.targets,
    extra: w.extra,
    reading: w.instrument ? readInstrument(w.instrument) : null,
    derived: {},
  };
  for (const d of sc.derived) ctx.derived[d.id] = d.of(ctx);
  return ctx;
}

function applyEvents(w) {
  const sc = getScenario(w.scenarioId);
  let world = w;
  const ctx = context(world);
  const active = [];
  for (const e of sc.events) {
    const latched = world.latched.includes(e.id);
    if (!latched && !e.when(ctx)) continue;
    active.push(e.id);
    if (e.latch && !latched) world = triggerEffect({ ...world, latched: [...world.latched, e.id] }, e.effect);
  }
  if (world.thermal && sc.settling && Math.abs(world.state.T - world.env.T) >= SETTLED_K) active.push('settling');
  return { ...world, events: active };
}

function triggerEffect(w, effect) {
  if (effect === 'none') return w;
  const law = LAWS[w.lawId];
  const { V, T } = w.state;
  let n;
  if (effect === 'burst') n = 0;
  else if (effect === 'vent') n = (P_ATM * V) / (R * T);
  else throw new Error(`Unknown effect "${effect}"`);
  const state = solve({ ...w.state, n }, law.responds);
  return { ...w, state, targets: { ...w.targets, n }, failed: effect };
}

export function isSettled(w) {
  const sc = getScenario(w.scenarioId);
  if (sc.process?.settled) return sc.process.settled(w);
  if (w.thermal && Math.abs(w.state.T - w.env.T) >= SETTLED_K) return false;
  for (const key of ['V', 'n']) {
    if (key in w.targets && Math.abs(w.targets[key] - w.state[key]) > 1e-12) return false;
  }
  return true;
}

/** Snapshot for the interface and the 3D scene. */
export function observe(w) {
  const sc = getScenario(w.scenarioId);
  const law = LAWS[w.lawId];
  const ctx = context(w);
  const eventInfo = (id) => {
    if (id === 'settling') {
      const warmer = w.state.T > w.env.T;
      return {
        id, severity: 'info',
        title: warmer ? 'Cooling toward surroundings' : 'Warming toward surroundings',
        detail: warmer ? sc.settling.warmer : sc.settling.cooler,
      };
    }
    const { when, effect, latch, ...info } = sc.events.find((e) => e.id === id);
    return { ...info, detail: typeof info.detail === 'function' ? info.detail(ctx) : info.detail };
  };
  const count = Math.round(w.state.n / w.molPerSphere);
  return {
    scenario: { id: sc.id, title: sc.title, subtitle: sc.subtitle, presetId: w.preset.id, presetLabel: w.preset.label, timeNote: sc.timeNote ?? sc.thermal?.timeNote ?? null },
    law: { id: law.id, name: law.name, relation: law.relation, tex: law.tex, held: law.held, varies: law.varies, responds: law.responds, axes: law.axes },
    gas: w.gas,
    preset: w.preset,
    state: { ...w.state },
    env: { ...w.env },
    targets: { ...w.targets },
    extra: { ...w.extra },
    reading: ctx.reading,
    derived: sc.derived.map((d) => ({ id: d.id, label: d.label, unit: d.unit, digits: d.digits, note: d.note, value: ctx.derived[d.id] })),
    invariant: { label: law.invariant.label, tex: law.invariant.tex, unit: law.invariant.unit, value: law.invariant.of(w.state) },
    roles: sc.roles ? sc.roles(ctx) : null,
    inputs: Object.fromEntries(Object.entries(sc.inputs).map(([k, d]) => [k, {
      enabled: d.enabled ? d.enabled(ctx) : true,
      hint: typeof d.hint === 'function' ? d.hint(ctx) : d.hint ?? '',
    }])),
    notes: sc.notes ?? [],
    actions: (sc.actions ?? []).map((a) => ({ id: a.id, label: typeof a.label === 'function' ? a.label(ctx) : a.label, enabled: a.enabled ? a.enabled(ctx) : true })),
    events: w.events.map(eventInfo),
    settled: isSettled(w),
    failed: w.failed,
    particles: {
      count: Math.min(sc.particles.max ?? Infinity, count),
      molPerSphere: w.molPerSphere,
      moleculesPerSphere: w.molPerSphere * N_A,
      relativeSpeed: relativeSpeed(w.state.T, w.gas.M),
      mix: sc.particles.mix ? sc.particles.mix(ctx) : null,
    },
    time: w.time,
  };
}
