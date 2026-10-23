/**
 * Avogadro's law: an 11-inch latex balloon on an inflator nozzle, fed by a
 * helium tank, an air pump, or a CO₂ cartridge. When it bursts, the skin
 * tears into shreds and the gas escapes.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { latex, metal, plastic, rubber, chrome } from '../materials.js';
import { textPlate } from '../instruments.js';
import { CONTAINERS } from '../../particles/containers.js';
import { shadows, lathe, tube, v3 } from './common.js';
import { partyRoom } from '../environments.js';

const NOZZLE_Y = 1.15;
const SKIN = { helium: 0xa797e0, air: 0xe8b33a, co2: 0x7f9fbe };

function heliumTank() {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0x8c99a3, roughness: 0.45, metalness: 0.3 });
  const body = lathe([[0, 0], [0.5, 0], [0.52, 0.05], [0.52, 2.6], [0.44, 2.85], [0.2, 3.0], [0.13, 3.05], [0.13, 3.2], [0, 3.2]], paint, 64);
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 24), chrome());
  valve.position.y = 3.33;
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 24), plastic(0x2f3a42));
  knob.position.y = 3.52;
  const label = textPlate('Helium', { height: 0.2, color: '#1f2a33', bg: '#e9ece8', padding: 0.4 });
  label.position.set(0, 1.9, 0.525);
  g.add(body, valve, knob, label);
  g.userData.outlet = v3(0.12, 3.33, 0);
  return g;
}

function airPump() {
  const g = new THREE.Group();
  const red = plastic(0x5a6873, 0.5);
  const foot = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.08, 0.5, 2, 0.03), red);
  foot.position.y = 0.04;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.0, 32), red);
  barrel.position.y = 1.08;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 16), chrome());
  rod.position.y = 2.35;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 16), plastic(0x23292f));
  handle.rotation.z = Math.PI / 2;
  handle.position.y = 2.65;
  const label = textPlate('Air pump', { height: 0.16, color: '#f1f3f4', padding: 0.2 });
  label.position.set(0, 1.25, 0.205);
  label.rotation.z = Math.PI / 2;
  g.add(foot, barrel, rod, handle, label);
  g.userData.outlet = v3(0.15, 0.3, 0);
  return g;
}

function co2Cartridge() {
  const g = new THREE.Group();
  const stand = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.9, 0.5, 3, 0.06), plastic(0x2f3a42, 0.5));
  stand.position.y = 0.45;
  const cart = lathe([[0, 0], [0.13, 0.02], [0.14, 0.1], [0.14, 0.62], [0.08, 0.75], [0.05, 0.85], [0, 0.85]], metal(0xb8bfc5, 0.25), 48);
  cart.position.y = 0.9;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 24), chrome());
  head.position.y = 1.85;
  const label = textPlate('CO₂', { height: 0.18, color: '#d5dde2', padding: 0.2 });
  label.position.set(0, 0.5, 0.255);
  g.add(stand, cart, head, label);
  g.userData.outlet = v3(0.1, 1.85, 0);
  return g;
}

export function createPartyBalloon({ stage }) {
  const spec = CONTAINERS.partyBalloon;
  const r = spec.particleRadius;
  const group = new THREE.Group();
  const env = partyRoom();
  group.add(env.group);
  stage.setEnvironment(env.settings);

  // Inflator stand with nozzle pointing up.
  const steel = metal(0x9aa2a8, 0.3);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.12, 48), plastic(0x2f3a42, 0.55));
  base.position.y = 0.06;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, NOZZLE_Y - 0.25, 24), steel);
  column.position.y = 0.12 + (NOZZLE_Y - 0.25) / 2;
  const nozzle = lathe([[0, 0], [0.1, 0], [0.1, 0.06], [0.05, 0.12], [0.045, 0.24], [0, 0.24]], chrome(), 32);
  nozzle.position.y = NOZZLE_Y - 0.13;
  group.add(base, column, nozzle);

  const sources = { helium: heliumTank(), air: airPump(), co2: co2Cartridge() };
  for (const s of Object.values(sources)) {
    s.position.set(-2.7, 0, -0.4);
    s.visible = false;
    group.add(s);
  }
  let hose = null;
  const hoseMat = rubber(0x2a2e31);

  // Balloon: transparent latex, a neck, and a knot ring on the nozzle.
  const balloonRoot = new THREE.Group();
  group.add(balloonRoot);
  const particleRoot = new THREE.Group();
  balloonRoot.add(particleRoot);
  const skinMat = latex(SKIN.helium, { opacity: 0.36 });
  const skin = new THREE.Mesh(new THREE.SphereGeometry(1, 56, 40), skinMat);
  skin.renderOrder = 2;
  balloonRoot.add(skin);
  const neckMat = latex(SKIN.helium, { opacity: 0.85 });
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 1, 24, 1, true), neckMat);
  neck.renderOrder = 2;
  group.add(neck);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.03, 10, 24), neckMat);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = NOZZLE_Y + 0.02;
  group.add(lip);

  // Shreds after a burst.
  const shreds = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22 + Math.random() * 0.15, 0.12 + Math.random() * 0.1), latex(SKIN.helium, { opacity: 0.85 }));
    m.visible = false;
    group.add(m);
    shreds.push({ m, v: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0 });
  }
  let burstShown = false;
  let gasId = null;
  let time = 0;
  let rootY = NOZZLE_Y;

  shadows(group);

  function setGas(id) {
    gasId = id;
    for (const [k, s] of Object.entries(sources)) s.visible = k === id;
    const src = sources[id];
    if (hose) { group.remove(hose); hose.geometry.dispose(); }
    const out = src.userData.outlet.clone().add(src.position);
    hose = tube([out, v3(out.x + 0.6, Math.max(0.25, out.y - 0.6), out.z + 0.3), v3(-0.8, 0.12, 0.2), v3(-0.12, 0.35, 0)], 0.045, hoseMat);
    hose.castShadow = true;
    group.add(hose);
    const color = SKIN[id];
    skinMat.color.setHex(color);
    neckMat.color.setHex(color);
    for (const s of shreds) s.m.material.color.setHex(color);
  }

  return {
    group,
    particleRoot,
    camera: { position: [-0.6, 3.3, 12.8], target: [-0.6, 2.35, 0] },
    legend: 'speed',
    update(view, engine, dt) {
      time += dt;
      if (view.gas.id !== gasId) setGas(view.gas.id);
      const burst = view.failed === 'burst';
      const R = burst ? 0 : engine.dims.radius;
      const shown = !burst && view.state.n > 1e-4;
      const floats = view.derived.find((d) => d.id === 'lift')?.value > 0;

      // A tiny pouch of latex hangs on the nozzle before any gas goes in.
      const Rs = shown ? R + r : 0.16;
      const neckLen = shown ? 0.16 + 0.05 * Math.min(1, R) : 0.08;
      const bob = floats && shown ? Math.sin(time * 1.3) * 0.025 + 0.03 : 0;
      // Freeze the root once burst, so the escaping spheres don't jump with it.
      if (!burst) rootY = NOZZLE_Y + neckLen + Rs * 0.97 + bob;
      balloonRoot.position.set(0, rootY, 0);
      skin.scale.set(Rs, shown ? Rs * 1.04 : Rs * 0.6, Rs);
      balloonRoot.rotation.z = floats && shown ? Math.sin(time * 0.7) * 0.03 : 0;
      skin.visible = !burst;
      neck.visible = !burst;
      neck.scale.set(1, neckLen + 0.04 + bob, 1);
      neck.position.y = NOZZLE_Y + (neckLen + 0.04 + bob) / 2;

      if (burst && !burstShown) {
        burstShown = true;
        const c = balloonRoot.position;
        const Rb = engine.dims.radius || 1.7;
        for (const s of shreds) {
          const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize();
          s.m.position.copy(c).addScaledVector(d, Rb);
          s.v.copy(d).multiplyScalar(2 + Math.random() * 2.5);
          s.spin.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
          s.life = 2.2;
          s.m.visible = true;
        }
      }
      if (!burst) burstShown = false;
      for (const s of shreds) {
        if (s.life <= 0) { s.m.visible = false; continue; }
        s.life -= dt;
        s.v.y -= 6 * dt;
        s.v.multiplyScalar(1 - 1.5 * dt);
        s.m.position.addScaledVector(s.v, dt);
        if (s.m.position.y < 0.02) { s.m.position.y = 0.02; s.v.set(0, 0, 0); s.spin.set(0, 0, 0); s.m.rotation.set(-Math.PI / 2, 0, s.m.rotation.z); }
        s.m.rotation.x += s.spin.x * dt;
        s.m.rotation.y += s.spin.y * dt;
        s.m.rotation.z += s.spin.z * dt;
      }
    },
  };
}
