/**
 * main.js — Wiring: build the bench, hook up picking and the camera stations,
 * run the loop.
 */

import * as THREE from 'three';
import { Stage } from './scene.js';
import { buildLab, BENCH_Y, TILE_Y } from './lab.js';
import { Burette, DropSystem, Plume, Ripples } from './apparatus.js';
import { Sim } from './sim.js';
import { UI } from './ui.js';
import { SFX } from './audio.js';

// ---------------------------------------------------------------- capability
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) {
    return false;
  }
}
if (!hasWebGL()) {
  document.getElementById('loading').classList.add('gone');
  document.getElementById('fatal').hidden = false;
  throw new Error('WebGL unavailable');
}

// ------------------------------------------------------------------- build
const canvas = document.getElementById('view');
const stage = new Stage(canvas);
const lab = buildLab(stage);

const burette = new Burette(stage.scene, { position: new THREE.Vector3(0, 1.18, 0) });
const drops = new DropSystem(stage.scene, { count: 48 });
const plume = new Plume(lab.flask.group);
const ripples = new Ripples(lab.flask.group, 7);
const sfx = new SFX();

const sim = new Sim({ stage, lab, burette, drops, plume, ripples, sfx });

// ------------------------------------------------------- camera stations
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const views = {
  bench: () => stage.flyTo({ target: V(0, 1.00, 0), radius: 0.85, theta: 0.06, phi: 1.12 }),
  // the working view: tip, flask body and liquid surface all clear of the dock
  tip: () => stage.flyTo({ target: V(0, 0.98, 0), radius: 0.34, theta: 0.18, phi: 1.12 }),
  meniscus: () => stage.flyTo({
    target: V(0, burette.meniscusWorldY, 0), radius: 0.055, theta: 0, phi: Math.PI / 2,
    duration: 0.7,
  }),
  flask: () => stage.flyTo({ target: V(0, 0.955, 0), radius: 0.19, theta: 0.10, phi: 0.80 }),
  wide: () => stage.flyTo({ target: V(0, 1.06, 0), radius: 1.95, theta: -0.30, phi: 1.06 }),
};

const ui = new UI({ sim, stage, lab, burette, sfx, views });

// ------------------------------------------------------------------ picking
const pickables = [...lab.pickables];
const registry = {};
Object.values(lab.items).forEach((it) => { registry[it.id] = it; });

function register(root, id, label, hint) {
  root.traverse((o) => {
    if (o.isMesh) { o.userData.pickId = id; pickables.push(o); }
  });
  registry[id] = { id, root, label, hint };
}

register(burette.vessel.group, 'burette', 'Burette, 50 mL class A',
  'Graduated downwards: 0.00 at the top. Read to 0.01 mL.');
burette.graduations.userData.pickId = 'burette';
pickables.push(burette.graduations);
register(burette.stopcock, 'stopcock', 'PTFE stopcock',
  'Drag the handle down to open. Small movements — the last drop decides the result.');

/** What clicking each object means, given where we are in the procedure. */
function actionFor(id) {
  switch (id) {
    case 'goggles': return 'wear:goggles';
    case 'gloves': return 'wear:gloves';
    case 'coat': return 'wear:coat';
    case 'burette': return 'inspect:burette';
    case 'naohBeaker': return 'rinse:burette';
    case 'funnel': return 'fill:burette';
    case 'indicator': return 'add:indicator';
    case 'washBottle': return 'rinse:walls';
    case 'waste': return 'stage:waste';
    case 'phMeter': case 'probe': return 'toggle:probe';
    case 'flask': return sim.step.id === 'dump' ? 'empty:flask' : 'stage:flask';
    case 'hclBeaker': return sim.pipetteConditioned ? 'pipette:fill' : 'rinse:pipette';
    case 'pipette': return sim.pipetteState === 'full' ? 'pipette:deliver' : 'pipette:fill';
    case 'notebook': return '__notebook';
    case 'stopcock': return '__stopcock';
    default: return '__info';
  }
}

let hoveredId = null;

function setHalo(id) {
  const halo = lab.halo;
  const entry = id && registry[id];
  if (!entry || id === 'stopcock') { halo.visible = false; return; }
  const b = new THREE.Box3().setFromObject(entry.root);
  if (!Number.isFinite(b.min.y)) { halo.visible = false; return; }
  const size = b.getSize(new THREE.Vector3());
  const c = b.getCenter(new THREE.Vector3());
  halo.visible = true;
  halo.scale.setScalar(Math.max(0.022, Math.max(size.x, size.z) * 0.65));
  halo.position.set(c.x, Math.max(b.min.y + 0.004, 0.02), c.z);
}

function updateHover() {
  if (document.querySelector('.modal.open') || !stage.hasPointer) {
    ui.showHover(null);
    if (hoveredId) { hoveredId = null; setHalo(null); }
    return;
  }
  const hit = stage.pick(pickables);
  const id = hit?.object?.userData?.pickId ?? null;
  if (id !== hoveredId) {
    hoveredId = id;
    setHalo(id);
    canvas.style.cursor = id ? 'pointer' : 'grab';
  }
  if (!id) { ui.showHover(null); return; }
  const entry = registry[id];
  const p = stage.project(hit.point);
  ui.showHover(entry?.label ?? id, entry?.hint ?? '', p.x, p.y);
}

stage.onClick = () => {
  sfx.resume();
  if (document.querySelector('.modal.open')) return;
  const hit = stage.pick(pickables);
  const id = hit?.object?.userData?.pickId;
  if (!id) return;
  const action = actionFor(id);

  if (action === '__stopcock') {
    ui.toast('Drag the stopcock handle up and down, or use Space / S / D.', 'warn');
    return;
  }
  if (action === '__notebook') { ui.openNotebook(); return; }
  if (action === '__info') {
    const e = registry[id];
    if (e) ui.toast(`${e.label}${e.hint ? ` — ${e.hint}` : ''}`);
    return;
  }
  ui.dispatch(action);
};

// --------------------------------------------------- stopcock drag control
let dragBase = 0;
let dragAccum = 0;
stage.onDragObject = (dx, dy, first) => {
  if (first) {
    if (hoveredId !== 'stopcock') return false;
    dragBase = ui.latched;
    dragAccum = 0;
    sfx.resume();
  }
  dragAccum += dy;                        // drag down = open
  const open = Math.max(0, Math.min(1, dragBase + dragAccum * 0.0055));
  ui.latched = open;
  ui._dragging = true;
  sim.setStopcock(open);
  return true;
};
stage.onDragEnd = () => { ui._dragging = false; };

// ------------------------------------------------------------------- loop
let last = performance.now();
let started = false;

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  stage.update(dt);
  sim.update(dt);
  ui.frame(dt);
  updateHover();
  stage.render();

  if (!started) {
    started = true;
    document.getElementById('loading').classList.add('gone');
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// keep the liquid clip planes correct if anything is moved by a tween
sim.on('tick', () => {
  lab.vessels.forEach((v) => v.refreshClip());
  burette.vessel.refreshClip();
});

// Expose state for debugging and automated checks. `step` advances the
// simulation independently of the render loop, which is what lets the
// end-to-end test drive a full three-trial run without waiting in real time.
window.__titration = {
  stage, lab, burette, sim, ui, views,
  step(dt = 0.02, count = 1) {
    for (let i = 0; i < count; i++) {
      ui.frame(dt);
      sim.update(dt);
    }
  },
};
