/**
 * App wiring: model → particle engine → 3D scene, plus the side panel.
 *
 * Each frame:
 *   world = stepWorld(world, dt × speed)          the model, source of truth
 *   engine.sync(observe(world)); engine.step(dt)  molecules follow the model
 *   scene.update(view, engine, dt)                apparatus, instruments, surroundings
 */
import { initWorld, setInput, stepWorld, observe, act } from './model/runtime.js';
import { SCENARIOS, LAW_ORDER, SYSTEMS } from './model/scenarios.js';
import { LAWS } from './model/laws.js';
import { kToC } from './model/units.js';
import { ParticleEngine } from './particles/engine.js';
import { Stage } from './view/stage.js';
import { ParticlesView } from './view/particlesView.js';
import { SCENES } from './view/scenes/index.js';
import { num, sig, unitFor, VAR_NAMES, measured } from './ui/format.js';
import { renderCheck } from './ui/equation.js';
import { LawGraph } from './ui/graph.js';

const $ = (id) => document.getElementById(id);
const MODEL_CHUNK = 1 / 30;
const UI_INTERVAL = 0.1;

const app = {
  scenarioId: SYSTEMS[LAW_ORDER[0]][0],
  presetId: null,
  world: null,
  engine: null,
  scene: null,
  speed: 1,
  slow: 1,
  paused: false,
  uiClock: 0,
  s1: null,
};
let stage, particles, graph;

// ───────────── formatting ─────────────

function formatInput(key, def, v) {
  if (def.show?.format) return def.show.format(v);
  if (key === 'Tenv') return `${num(v, 0)} K (${num(kToC(v), 0)} °C)`;
  const f = def.show.factor ?? 1;
  return `${num(v * f, def.show.digits)}${def.show.unit ? ' ' + def.show.unit : ''}`;
}

// ───────────── loading ─────────────

function disposeTree(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) { m.map?.dispose(); m.dispose(); }
  });
}

function load(scenarioId, presetId, { instant = false } = {}) {
  const changedScenario = scenarioId !== app.scenarioId || !app.scene;
  app.scenarioId = scenarioId;
  app.world = initWorld(scenarioId, presetId ?? undefined);
  app.presetId = app.world.preset.id;
  app.engine = new ParticleEngine(scenarioId, { seed: (Math.random() * 2 ** 31) | 0, slowMotion: app.slow });
  const v0 = observe(app.world);
  app.engine.sync(v0);

  const old = app.scene;
  app.scene = SCENES[scenarioId]({ stage, preset: app.world.preset });
  stage.scene.add(app.scene.group);
  particles.attach(app.scene.particleRoot);
  if (old) { stage.scene.remove(old.group); disposeTree(old.group); }
  if (changedScenario || presetId) stage.frame(app.scene.camera, { instant: instant || !changedScenario });

  app.s1 = measured(v0);
  graph.reset(v0, app.s1);
  $('zero-wrap').hidden = v0.law.axes.x !== 'T' && v0.law.axes.x !== 'n';
  renderSwitcher();
  renderLaw();
  buildControls();
  renderUI(v0, { full: true });
  graph.draw(v0);
}

// ───────────── panel: structure ─────────────

function renderSwitcher() {
  const nav = $('switcher');
  if (!nav.children.length) {
    nav.setAttribute('role', 'tablist');
    for (const lawId of LAW_ORDER) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.dataset.law = lawId;
      const systems = SYSTEMS[lawId].map((id) => SCENARIOS[id].title);
      b.innerHTML = `<strong>${LAWS[lawId].name}</strong><span>${systems.join(' or ').replace(/^./, (c) => c.toUpperCase())}</span>`;
      b.addEventListener('click', () => { if (SCENARIOS[app.scenarioId].law !== lawId) load(SYSTEMS[lawId][0]); });
      nav.appendChild(b);
    }
  }
  const lawId = SCENARIOS[app.scenarioId].law;
  for (const b of nav.children) {
    const on = b.dataset.law === lawId;
    b.setAttribute('aria-selected', String(on));
    // On narrow screens the tab row scrolls; keep the current law in view.
    if (on && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = b.offsetLeft - (nav.clientWidth - b.offsetWidth) / 2;
  }
}

function renderLaw() {
  const sc = SCENARIOS[app.scenarioId];
  const law = LAWS[sc.law];
  $('law-name').textContent = law.name;
  $('law-relation').textContent = law.relation;
  $('law-statement').textContent = law.statement;
  $('subtitle').textContent = sc.subtitle;

  const systems = SYSTEMS[sc.law];
  const box = $('systems');
  box.hidden = systems.length < 2;
  box.innerHTML = systems.map((id) => `<button type="button" data-id="${id}" aria-pressed="${id === sc.id}">${SCENARIOS[id].title}</button>`).join('');
  for (const b of box.children) b.addEventListener('click', () => { if (b.dataset.id !== app.scenarioId) load(b.dataset.id); });

  const wrap = $('preset-wrap');
  const sel = $('preset');
  wrap.hidden = sc.presets.length < 2;
  sel.innerHTML = sc.presets.map((p) => `<option value="${p.id}"${p.id === app.presetId ? ' selected' : ''}>${p.label}</option>`).join('');
  sel.onchange = () => load(app.scenarioId, sel.value);

  $('notes').innerHTML = (sc.notes ?? []).map((n) => `<li>${n}</li>`).join('');
  const timeNote = sc.timeNote ?? sc.thermal?.timeNote ?? '';
  $('time-note').textContent = timeNote;
}

function buildControls() {
  const box = $('controls');
  box.innerHTML = '';
  for (const [key, def] of Object.entries(app.world.inputs)) {
    const el = document.createElement('div');
    el.className = `control control-${def.type ?? 'range'}`;
    if (def.type === 'choice') {
      el.innerHTML = `<p class="label" id="lab-${key}">${def.label}</p>
        <div class="choices" role="group" aria-labelledby="lab-${key}" id="in-${key}">
          ${def.options.map((o) => `<button type="button" data-value="${o.value}" title="${o.detail ?? ''}"><strong>${o.label}</strong>${o.detail ? `<span>${o.detail}</span>` : ''}</button>`).join('')}
        </div>
        <div class="hint" id="hint-${key}"></div>`;
      box.appendChild(el);
      for (const b of el.querySelectorAll('button')) {
        b.addEventListener('click', () => { app.world = setInput(app.world, key, b.dataset.value); paint(key); });
      }
    } else if (def.type === 'toggle') {
      el.innerHTML = `<label class="switch"><input type="checkbox" id="in-${key}"><span class="track" aria-hidden="true"></span><span>${def.label}</span></label>
        <div class="hint" id="hint-${key}"></div>`;
      box.appendChild(el);
      const input = el.querySelector('input');
      input.addEventListener('change', () => { app.world = setInput(app.world, key, input.checked); paint(key); });
    } else {
      el.innerHTML = `
        <div class="head"><label for="in-${key}">${def.label}</label><output id="out-${key}" for="in-${key}"></output></div>
        <input type="range" id="in-${key}" min="${def.min}" max="${def.max}" step="${def.step}">
        <div class="lag" id="lag-${key}"></div>
        ${def.marks ? `<div class="marks" id="marks-${key}" role="group" aria-label="${def.label} presets"></div>` : ''}
        <div class="hint" id="hint-${key}"></div>`;
      box.appendChild(el);
      const input = el.querySelector('input');
      input.value = app.world.targets[key];
      input.addEventListener('input', () => { app.world = setInput(app.world, key, +input.value); paint(key); });
      for (const m of def.marks ?? []) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = m.label;
        b.dataset.value = m.value;
        b.title = formatInput(key, def, m.value);
        b.addEventListener('click', () => { app.world = setInput(app.world, key, m.value); input.value = m.value; paint(key); });
        el.querySelector('.marks').appendChild(b);
      }
    }
    paint(key);
  }

  const sc = SCENARIOS[app.scenarioId];
  const actions = $('actions');
  actions.hidden = !sc.actions?.length;
  actions.innerHTML = (sc.actions ?? []).map((a) => `<button type="button" class="btn action" data-action="${a.id}"></button>`).join('');
  for (const b of actions.children) {
    b.addEventListener('click', () => { app.world = act(app.world, b.dataset.action); renderUI(observe(app.world)); });
  }
}

/** Reflect a target value in its control. */
function paint(key, view) {
  const def = app.world.inputs[key];
  const v = app.world.targets[key];
  const meta = view?.inputs?.[key] ?? observe(app.world).inputs[key];
  if (def.type === 'choice') {
    for (const b of $(`in-${key}`).children) b.setAttribute('aria-pressed', String(b.dataset.value === v));
  } else if (def.type === 'toggle') {
    $(`in-${key}`).checked = !!v;
  } else {
    const input = $(`in-${key}`);
    if (document.activeElement !== input) input.value = v;
    input.style.setProperty('--pct', `${((v - def.min) / (def.max - def.min)) * 100}%`);
    const text = formatInput(key, def, v);
    $(`out-${key}`).textContent = text;
    input.setAttribute('aria-valuetext', text);
    input.disabled = !meta.enabled || (key === 'n' && !!app.world.failed);
    const marks = $(`marks-${key}`);
    if (marks) {
      for (const b of marks.children) {
        b.setAttribute('aria-pressed', String(Math.abs(+b.dataset.value - v) < def.step / 2));
        b.disabled = input.disabled;
      }
    }
  }
  $(`hint-${key}`).textContent = meta.hint ?? '';
}

// ───────────── panel: live values ─────────────

function roleOf(k, view) {
  if (view.roles?.[k]) return view.roles[k];
  if (view.law.responds === k) return ['respond', 'responds'];
  if (k in app.world.inputs) return ['change', 'you change'];
  if (k === 'T' && ('Tenv' in app.world.inputs || 'site' in app.world.inputs)) return ['change', 'follows surroundings'];
  if (view.law.held.includes(k)) return ['held', 'held constant'];
  return ['fixed', 'fixed'];
}

function stateRows(view) {
  const s = view.state;
  const id = view.scenario.id;
  const rd = view.reading;
  const rows = [];
  // Pressure: the instrument's reading when there is one, as a student would read it.
  if (rd && rd.quantity === 'P') {
    const ref = rd.reference === 'gauge' ? 'gauge' : 'absolute';
    rows.push(['P', `${rd.text} ${rd.unit}`, `${rd.name}, ${ref}. Absolute: ${sig(s.P, 4)} atm`]);
  } else {
    const u = unitFor(id, 'P');
    rows.push(['P', `${sig(u.of(s.P), 3)} ${u.unit}`, u.unit === 'atm' ? 'absolute' : `${sig(s.P, 3)} atm absolute`]);
  }
  const uv = unitFor(id, 'V');
  rows.push(['V', `${sig(uv.of(s.V), 4)} ${uv.unit}`, uv.unit === 'L' ? '' : `${sig(s.V, 4)} L`]);
  if (rd && rd.quantity === 'T') rows.push(['T', `${rd.text} °C`, `${rd.name}. ${num(s.T, 1)} K`]);
  else rows.push(['T', `${num(s.T, 1)} K`, `${num(kToC(s.T), 1)} °C`]);
  rows.push(['n', `${sig(s.n, 3)} mol`, '']);
  return rows;
}

const LEGENDS = {
  speed: 'Molecule color shows speed: <i class="dot slow"></i> slow, <i class="dot fast"></i> fast. Rings flash where molecules hit the wall.',
  mix: '<i class="dot air"></i> air. Water vapor by speed: <i class="dot slow"></i> slow, <i class="dot fast"></i> fast. One sphere stands for many molecules.',
};

function renderUI(view, { full = false } = {}) {
  for (const key of Object.keys(app.world.inputs)) {
    paint(key, view);
    const def = app.world.inputs[key];
    if (def.type === 'choice' || def.type === 'toggle') continue;
    const actual = key === 'Tenv' ? view.env.T : key in view.state ? view.state[key] : key === 'water' ? view.extra.water : view.targets[key];
    const target = view.targets[key];
    let lag = '';
    if (Math.abs(actual - target) > def.step / 4 && !view.failed && (view.inputs[key]?.enabled ?? true)) {
      const verb = key === 'n' ? (target > actual ? 'Filling' : 'Releasing') : key === 'V' ? 'Moving' : 'Changing';
      lag = `${verb}, now ${formatInput(key, def, actual)}`;
    }
    $(`lag-${key}`).textContent = lag;
  }
  for (const b of $('actions').children) {
    const a = view.actions.find((x) => x.id === b.dataset.action);
    if (!a) continue;
    b.textContent = a.label;
    b.disabled = !a.enabled;
  }

  $('state').innerHTML = stateRows(view).map(([k, main, alt]) => {
    const [role, label] = roleOf(k, view);
    return `<div class="row" data-role="${role}"><dt>${VAR_NAMES[k]}<span class="role">${label}</span></dt><dd>${main}</dd>${alt ? `<div class="alt">${alt}</div>` : ''}</div>`;
  }).join('');

  $('check').innerHTML = renderCheck(view, app.s1, measured(view));

  $('derived').innerHTML = view.derived.map((d) => `<div class="row"><dt>${d.label}${d.note ? `<span class="dnote">${d.note}</span>` : ''}</dt><dd>${Number.isFinite(d.value) ? num(d.value, d.digits) : '–'} <span class="u">${d.unit}</span></dd></div>`).join('');

  // Stage overlays: the most serious event, the instrument inset, the color key.
  const order = { critical: 0, warn: 1, info: 2 };
  const events = [...view.events].sort((a, b) => order[a.severity] - order[b.severity]);
  const note = $('note');
  if (events.length) {
    const e = events[0];
    note.hidden = false;
    note.dataset.severity = e.severity;
    const more = events.length > 1 ? `<p class="more">Also: ${events.slice(1).map((x) => x.title.replace(/^./, (c) => c.toLowerCase())).join('; ')}</p>` : '';
    const html = `<strong>${e.title}</strong><p>${e.detail}</p>${more}`;
    if (note.innerHTML !== html) note.innerHTML = html;
  } else {
    note.hidden = true;
  }
  const inset = $('inset');
  const ins = app.scene.inset?.(view);
  inset.hidden = !ins;
  if (ins) {
    const html = `<p class="inset-title">${ins.title}</p>${ins.rows.map(([k, v]) => `<div class="inset-row"><span>${k}</span><b>${v}</b></div>`).join('')}${ins.alert ? `<p class="inset-alert">${ins.alert}</p>` : ''}`;
    if (inset.innerHTML !== html) inset.innerHTML = html;
    inset.classList.toggle('warn', !!ins.warn);
  }
  if (full) $('legend').innerHTML = LEGENDS[app.scene.legend ?? 'speed'];
}

// ───────────── transport ─────────────

function bindTransport() {
  $('play').addEventListener('click', () => {
    app.paused = !app.paused;
    $('play').textContent = app.paused ? 'Play' : 'Pause';
  });
  $('reset').addEventListener('click', () => load(app.scenarioId, app.presetId, { instant: true }));
  $('record').addEventListener('click', () => {
    const v = observe(app.world);
    app.s1 = measured(v);
    graph.setState1(app.s1);
    renderUI(v);
  });
  $('zero').addEventListener('change', (e) => { graph.toZero = e.target.checked; });
  for (const b of document.querySelectorAll('[data-speed]')) {
    b.addEventListener('click', () => {
      app.speed = +b.dataset.speed;
      for (const x of document.querySelectorAll('[data-speed]')) x.setAttribute('aria-pressed', String(x === b));
    });
  }
  for (const b of document.querySelectorAll('[data-slow]')) {
    b.addEventListener('click', () => {
      app.slow = +b.dataset.slow;
      app.engine.setSlowMotion(app.slow);
      for (const x of document.querySelectorAll('[data-slow]')) x.setAttribute('aria-pressed', String(x === b));
    });
  }
}

// ───────────── loop ─────────────

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (!app.paused) {
    let t = dt * app.speed;
    while (t > 1e-6) {
      const h = Math.min(MODEL_CHUNK, t);
      app.world = stepWorld(app.world, h);
      t -= h;
    }
  }
  const view = observe(app.world);
  app.engine.sync(view);
  const live = app.paused ? 0 : dt;
  if (live) app.engine.step(live);
  app.scene.update(view, app.engine, live);
  particles.update(app.engine, live);
  stage.setBackground(stage.envBackground ?? stageColor);
  stage.render(dt);
  graph.push(view);

  app.uiClock += dt;
  if (app.uiClock >= UI_INTERVAL) {
    app.uiClock = 0;
    renderUI(view);
    graph.draw(view);
  }
  requestAnimationFrame(frame);
}

let stageColor = '#e9edef';
async function boot() {
  const fonts = document.fonts?.load ? Promise.all([
    document.fonts.load('600 40px "Barlow Semi Condensed"'),
    document.fonts.load('500 40px "Barlow Semi Condensed"'),
    document.fonts.load('400 16px "Barlow"'),
  ]) : Promise.resolve();
  await Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]);

  stageColor = getComputedStyle(document.documentElement).getPropertyValue('--stage').trim() || stageColor;
  stage = new Stage($('viewport'));
  stage.setBackground(stageColor);
  particles = new ParticlesView();
  graph = new LawGraph($('graph'));
  bindTransport();
  // Debug handle for automated checks: fast-forward the model, set inputs, run actions.
  window.__gasLab = {
    app, stage,
    advance(seconds) {
      for (let t = 0; t < seconds; t += 0.05) { app.world = stepWorld(app.world, 0.05); graph.push(observe(app.world)); }
      const v = observe(app.world); renderUI(v); graph.draw(v);
    },
    set(key, value) { app.world = setInput(app.world, key, value); renderUI(observe(app.world)); },
    act(id) { app.world = act(app.world, id); renderUI(observe(app.world)); },
    load: (id, preset) => load(id, preset, { instant: true }),
  };
  const fromHash = location.hash.slice(1);
  load(SCENARIOS[fromHash] ? fromHash : app.scenarioId, null, { instant: true });
  $('loading').hidden = true;
  requestAnimationFrame((t) => { last = t; frame(t); });
}

boot().catch((err) => {
  console.error(err);
  $('loading').textContent = 'The 3D view could not start. Try a recent version of Chrome, Edge, Firefox or Safari.';
});
