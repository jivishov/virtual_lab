/**
 * Ideal gas law: an aluminum scuba cylinder, front half cut away. At the fill
 * station it stands in a cooling bath; at a dive site it rests on the seabed with
 * its regulator, and bubbles rise as the diver breathes from it. A valve and first
 * stage feed a high-pressure hose to the submersible pressure gauge (SPG).
 * Engine frame: capsule axis = local y, centered on the particle root.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { glass, liquid, metal, chrome, rubber, plastic, cutaway } from '../materials.js';
import { AnalogGauge } from '../instruments.js';
import { CONTAINERS } from '../../particles/containers.js';
import { shadows, lathe, arc, tube, Puffs, Bubbles, v3 } from './common.js';
import { fillStation, underwater } from '../environments.js';

const BATH = { w: 3.2, h: 2.9, d: 2.4 };

export function createScubaTank({ stage }) {
  const spec = CONTAINERS.scubaTank;
  const { radius, length } = spec.dims();
  const r = spec.particleRadius;
  const Rin = radius + r;           // inner wall
  const Rout = Rin + 0.11;          // aluminum is thick
  const half = length / 2;
  const bottomOut = -half - Rin - 0.16; // flat-ish aluminum base
  const clip = cutaway(0);

  const group = new THREE.Group();
  const envs = { fill: fillStation(), quarry: underwater('quarry'), temperate: underwater('temperate'), reef: underwater('reef') };
  for (const e of Object.values(envs)) { e.group.visible = false; group.add(e.group); }
  let site = null;
  const tank = new THREE.Group();
  tank.position.y = -bottomOut + 0.01;
  group.add(tank);
  const particleRoot = new THREE.Group();
  tank.add(particleRoot);

  // Outer profile: flat base, straight wall, domed shoulder, neck.
  const outerProfile = [
    [0, bottomOut], [Rout - 0.18, bottomOut], ...arc(Rout - 0.18, bottomOut + 0.18, 0.18, -Math.PI / 2, 0, 8),
    [Rout, half], ...arc(0, half, Rout, 0, Math.PI / 2 - 0.32, 16),
    [0.24, half + Rout * 0.97 + 0.02], [0.24, half + Rout + 0.32], [0, half + Rout + 0.32],
  ];
  const shellMat = metal(0xbcc4ca, 0.36);
  shellMat.clippingPlanes = clip;
  shellMat.side = THREE.DoubleSide;
  const shell = lathe(outerProfile, shellMat, 96);
  tank.add(shell);

  // Inner wall: the capsule the gas fills.
  const innerProfile = [...arc(0, -half, Rin, -Math.PI / 2, 0, 16), ...arc(0, half, Rin, 0, Math.PI / 2, 16)];
  const innerMat = metal(0x8e979e, 0.55);
  innerMat.clippingPlanes = clip;
  innerMat.side = THREE.BackSide;
  tank.add(lathe(innerProfile, innerMat, 96));

  // Section face where the cylinder is cut: outer silhouette with the capsule as a hole.
  const outline = new THREE.Shape();
  const right = outerProfile.filter(([x]) => x >= 0);
  outline.moveTo(-right[0][0], right[0][1]);
  for (const [x, y] of right) outline.lineTo(x, y);
  for (let i = right.length - 1; i >= 0; i--) outline.lineTo(-right[i][0], right[i][1]);
  const hole = new THREE.Path();
  const capsule = [...arc(0, -half, Rin, -Math.PI / 2, 0, 16), ...arc(0, half, Rin, 0, Math.PI, 32), ...arc(0, -half, Rin, Math.PI, Math.PI * 1.5, 16)];
  hole.moveTo(capsule[0][0], capsule[0][1]);
  for (const [x, y] of capsule) hole.lineTo(x, y);
  outline.holes.push(hole);
  const section = new THREE.Mesh(new THREE.ShapeGeometry(outline, 24), new THREE.MeshStandardMaterial({ color: 0xd9dee2, roughness: 0.55, metalness: 0.4 }));
  tank.add(section);

  // Valve, handwheel, burst disk plug, first stage.
  const topY = half + Rout + 0.32;
  const valve = new THREE.Group();
  const block = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.42, 0.42, 3, 0.06), chrome());
  block.position.y = topY + 0.2;
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 32), plastic(0x1f2529, 0.5));
  wheel.position.y = topY + 0.5;
  const stemTop = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 16), chrome());
  stemTop.position.y = topY + 0.43;
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 6), metal(0xc8a35a, 0.3));
  disk.rotation.z = Math.PI / 2;
  disk.position.set(-0.29, topY + 0.2, 0);
  const firstStage = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 32), chrome());
  firstStage.rotation.z = Math.PI / 2;
  firstStage.position.set(0.5, topY + 0.2, 0);
  valve.add(block, wheel, stemTop, disk, firstStage);
  tank.add(valve);

  // Water bath of the fill station.
  const waterMat = liquid(0x9cc9df, 0.2);
  const water = new THREE.Mesh(new THREE.BoxGeometry(BATH.w - 0.08, BATH.h - 0.1, BATH.d - 0.08), waterMat);
  water.position.y = (BATH.h - 0.1) / 2 + 0.04;
  water.renderOrder = 2;
  const box = new THREE.Mesh(new THREE.BoxGeometry(BATH.w, BATH.h, BATH.d), glass({ opacity: 0.1 }));
  box.position.y = BATH.h / 2;
  box.renderOrder = 2;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: 0x9fb1bb, transparent: true, opacity: 0.6 }));
  edges.position.copy(box.position);
  const bath = new THREE.Group();
  bath.add(water, box, edges);
  group.add(bath);

  // Second stage (the diver's mouthpiece) on its hose, for the dive sites.
  const second = new THREE.Group();
  const lp = tube([v3(0.75, 0, 0), v3(-0.4, -0.2, 0.6), v3(-1.6, -3.0, 1.2), v3(-1.9, -4.15, 1.5)], 0.04, rubber(0x1d2023));
  const mouth = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.3, 0.32, 3, 0.1), plastic(0x2a3036, 0.5));
  mouth.position.set(-1.95, -4.25, 1.55);
  second.add(lp, mouth);
  second.position.y = 0; // positioned with the first stage below
  group.add(second);
  const breath = new Bubbles(90, { radius: 0.05 });
  group.add(breath.mesh);

  // High-pressure hose to the gauge, held up toward the viewer.
  const gauge = new AnalogGauge({
    min: 0, max: 5000, major: 1000, minor: 250,
    outerUnit: { label: 'PSI ×1000', divide: 1000 },
    inner: { max: 340, step: 50, span: 340 / 344.74, label: 'bar' },
    zones: [{ from: 0, to: 500, color: '#c2362b' }],
    caption: 'Submersible pressure gauge',
    radius: 0.62,
  });
  gauge.group.position.set(2.65, 2.15, 1.35);
  gauge.group.rotation.set(-0.12, -0.48, 0);
  group.add(gauge.group);
  const fsWorld = v3(0.75, tank.position.y + topY + 0.2, 0);
  group.updateMatrixWorld(true);
  const hp = tube([fsWorld, v3(1.45, fsWorld.y + 0.25, 0.1), v3(2.5, 3.2, 0.6), v3(2.9, 2.6, 0.9), gauge.group.localToWorld(v3(0, -0.45, -0.25))], 0.05, rubber(0x1d2023));
  group.add(hp);

  // Fill whip, shown only while the tank is filling.
  const whip = tube([fsWorld.clone().add(v3(-1.35, 0.05, 0)), v3(-1.9, fsWorld.y + 0.6, -0.3), v3(-2.6, 2.5, -0.6), v3(-3.0, 0.2, -0.8)], 0.045, rubber(0x3a2f2a));
  whip.visible = false;
  group.add(whip);

  const mist = new Puffs(40, { opacity: 0.7, size: 0.5 });
  group.add(mist.group);

  shadows(group);
  let time = 0;
  let ventAge = null;

  return {
    group,
    particleRoot,
    camera: { position: [1.1, 3.4, 11.8], target: [0.7, 2.25, 0] },
    legend: 'speed',
    update(view, engine, dt) {
      time += dt;
      // Swap surroundings when the tank changes place.
      if (view.targets.site !== site) {
        site = view.targets.site;
        for (const [k, e] of Object.entries(envs)) e.group.visible = k === site;
        stage.setEnvironment(envs[site].settings);
        bath.visible = site === 'fill';
        second.visible = site !== 'fill';
      }
      envs[site].update?.(view, dt, time);
      second.position.set(0, tank.position.y + topY + 0.2, 0);
      const breathing = site !== 'fill' && view.targets.n < view.state.n - 1e-6;
      breath.mesh.position.set(-1.95, second.position.y - 4.1, 1.55);
      breath.update(dt, { rate: breathing ? 45 : 0, floor: 0, top: 9, radius: 0.12, size: 0.05 + Math.random() * 0.04 });
      if (view.reading) gauge.set(view.reading.fraction);
      // Water tint: deep blue when cold, turquoise when warm.
      const k = Math.min(1, Math.max(0, (view.env.T - 275) / 33));
      waterMat.color.setHex(0x7fb2d8).lerp(new THREE.Color(0x8fded3), k);
      whip.visible = view.targets.n > view.state.n + 1e-6 && !view.failed;
      if (view.failed === 'vent') ventAge = ventAge === null ? 0 : ventAge + dt;
      else ventAge = null;
      if (ventAge !== null && ventAge < 2.5) {
        const n = Math.ceil(3 * (1 - ventAge / 2.5));
        for (let i = 0; i < n; i++) {
          mist.emit(-0.4 + tank.position.x, tank.position.y + topY + 0.2, 0, {
            vx: -2.2 - Math.random() * 1.5, vy: (Math.random() - 0.3) * 0.8, vz: (Math.random() - 0.5) * 0.8, life: 1.4, opacity: 0.6,
          });
        }
      }
      mist.update(dt);
    },
  };
}
