/**
 * Charles's law: a sealed balloon held under the surface of a bath by a clamp.
 * The bath changes with temperature: liquid nitrogen, dry ice in ethanol,
 * ice water, room air (empty), hot water, boiling water.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { glass, latex, liquid, metal, plastic, chrome } from '../materials.js';
import { Screen, drawLcd } from '../instruments.js';
import { CONTAINERS } from '../../particles/containers.js';
import { shadows, lathe, Puffs, Bubbles, v3 } from './common.js';
import { labBench } from '../environments.js';

const VESSEL_R = 1.78;
const VESSEL_H = 3.7;
const LIQUID_TOP = 3.25;
const NECK_Y = 3.05;

/** What the bath looks like at a given temperature. */
export function bathLook(T) {
  if (T < 150) return { id: 'ln2', liquid: true, tint: 0xe3ecf6, opacity: 0.2, bubbles: 70, fog: 9, ice: false, steam: 0 };
  if (T < 240) return { id: 'dryice', liquid: true, tint: 0xeceff3, opacity: 0.22, bubbles: 45, fog: 6, ice: false, steam: 0 };
  if (T < 284) return { id: 'ice', liquid: true, tint: 0xcfe5ef, opacity: 0.26, bubbles: 0, fog: 0, ice: T < 278, steam: 0 };
  if (T <= 305) return { id: 'air', liquid: false, tint: 0, opacity: 0, bubbles: 0, fog: 0, ice: false, steam: 0 };
  if (T < 368) return { id: 'hot', liquid: true, tint: 0xd6eaf1, opacity: 0.24, bubbles: 0, fog: 0, ice: false, steam: (T - 305) / 63 * 4 };
  return { id: 'boil', liquid: true, tint: 0xd6eaf1, opacity: 0.24, bubbles: 55, fog: 0, ice: false, steam: 7 };
}

export function createBalloonBath({ stage }) {
  const spec = CONTAINERS.balloonBath;
  const r = spec.particleRadius;
  const group = new THREE.Group();
  const env = labBench({ props: 'bath' });
  group.add(env.group);
  stage.setEnvironment(env.settings);

  // Tall glass vessel.
  const wall = 0.06;
  const vessel = lathe(
    [[0, 0.002], [VESSEL_R, 0.002], [VESSEL_R, VESSEL_H], [VESSEL_R + 0.03, VESSEL_H + 0.02], [VESSEL_R - wall, VESSEL_H], [VESSEL_R - wall, 0.08], [0, 0.08]],
    glass({ opacity: 0.17 }),
  );
  vessel.renderOrder = 2;
  group.add(vessel);

  const liquidMat = liquid(0xd6eaf1, 0.24);
  const bath = new THREE.Mesh(new THREE.CylinderGeometry(VESSEL_R - wall - 0.005, VESSEL_R - wall - 0.005, LIQUID_TOP - 0.08, 72, 1, true), liquidMat);
  bath.position.y = 0.08 + (LIQUID_TOP - 0.08) / 2;
  bath.renderOrder = 2;
  const surfaceMat = liquid(0xe9f4f8, 0.32);
  const surface = new THREE.Mesh(new THREE.CircleGeometry(VESSEL_R - wall - 0.005, 72), surfaceMat);
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = LIQUID_TOP;
  surface.renderOrder = 2;
  group.add(bath, surface);

  // Balloon, held by its knot just under the surface.
  const balloonRoot = new THREE.Group();
  group.add(balloonRoot);
  const particleRoot = new THREE.Group();
  balloonRoot.add(particleRoot);
  const skin = new THREE.Mesh(new THREE.SphereGeometry(1, 56, 40), latex(0xb9a3df, { opacity: 0.34 }));
  skin.renderOrder = 2;
  balloonRoot.add(skin);
  const knotMat = latex(0x8f78c2, { opacity: 1, transparent: false, depthWrite: true });
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 0.22, 24), knotMat);
  const knot = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.035, 12, 24), knotMat);
  knot.rotation.x = Math.PI / 2;
  group.add(neck, knot);

  // Ring stand and clamp holding the knot.
  const stand = new THREE.Group();
  const steel = metal(0x8f979d, 0.35);
  const base = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.12, 1.6, 3, 0.04), plastic(0x2f3940, 0.6));
  base.position.set(2.75, 0.06, -0.3);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.6, 20), steel);
  post.position.set(2.75, 2.3, -0.3);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.75, 16), steel);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(1.375, 4.15, -0.3);
  const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.15 - NECK_Y - 0.12, 16), steel);
  drop.position.set(0, (4.15 + NECK_Y + 0.12) / 2, -0.3);
  const jaw = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.1, 0.34, 2, 0.03), chrome());
  jaw.position.set(0, NECK_Y + 0.1, -0.3);
  const boss = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.2, 0.2, 2, 0.03), chrome());
  boss.position.set(2.75, 4.15, -0.3);
  stand.add(base, post, arm, drop, jaw, boss);
  // the clamp holds the knot toward the back so the balloon sits centered
  group.add(stand);

  // Digital probe thermometer: rod in the bath, display above the rim.
  const probe = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 3.3, 16), chrome());
  rod.position.y = 1.65 + 0.25;
  const handle = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.95, 0.24, 3, 0.07), plastic(0xe9ecee, 0.5));
  handle.position.y = 3.95;
  const display = new Screen({ width: 0.56, height: 0.3, res: 360, draw: drawLcd });
  display.mesh.position.set(0, 4.05, 0.125);
  probe.add(rod, handle, display.mesh);
  probe.position.set(-1.25, 0, 0.75);
  probe.rotation.z = -0.1;
  group.add(probe);

  const bubbles = new Bubbles(140);
  group.add(bubbles.mesh);
  const fog = new Puffs(24, { opacity: 0.5, size: 0.75 });
  group.add(fog.group);
  const ice = [];
  const iceMat = glass({ color: 0xf2fbff, opacity: 0.55, roughness: 0.25 });
  for (let i = 0; i < 6; i++) {
    const cube = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.34, 0.42, 3, 0.06), iceMat);
    const a = (i / 6) * Math.PI * 2 + 0.4;
    cube.userData = { a, rad: 1.35 + (i % 2) * 0.12, phase: i * 1.7 };
    cube.renderOrder = 2;
    ice.push(cube);
    group.add(cube);
  }

  shadows(group);
  let time = 0;
  let emitClock = 0;

  return {
    group,
    particleRoot,
    camera: { position: [0.5, 3.6, 12.4], target: [0.2, 2.1, 0] },
    legend: 'speed',
    update(view, engine, dt) {
      time += dt;
      const R = engine.dims.radius + r;
      balloonRoot.position.set(0, NECK_Y - 0.2 - R, 0);
      skin.scale.setScalar(R);
      neck.position.set(0, NECK_Y - 0.1, 0);
      knot.position.set(0, NECK_Y + 0.02, 0);

      const T = view.env.T;
      const look = bathLook(T);
      bath.visible = surface.visible = look.liquid;
      if (look.liquid) {
        liquidMat.color.setHex(look.tint);
        liquidMat.opacity = look.opacity;
      }
      for (const c of ice) {
        c.visible = look.ice;
        const { a, rad, phase } = c.userData;
        c.position.set(Math.cos(a) * rad, LIQUID_TOP - 0.06 + Math.sin(time * 1.2 + phase) * 0.015, Math.sin(a) * rad);
        c.rotation.y = a + Math.sin(time * 0.3 + phase) * 0.1;
      }
      bubbles.update(dt, { rate: look.bubbles, floor: 0.1, top: LIQUID_TOP - 0.02, radius: VESSEL_R - 0.25, size: look.id === 'boil' ? 0.06 : 0.035 });

      emitClock += dt;
      const rate = look.fog + look.steam;
      if (rate > 0 && emitClock > 1 / rate) {
        emitClock = 0;
        const a = Math.random() * Math.PI * 2;
        const rr = Math.random() * (VESSEL_R - 0.4);
        const cold = look.fog > 0;
        fog.emit(Math.cos(a) * rr, LIQUID_TOP + 0.1, Math.sin(a) * rr, {
          vx: (Math.random() - 0.5) * 0.2 + (cold ? 0.25 : 0),
          vy: cold ? 0.05 : 0.45,
          vz: (Math.random() - 0.5) * 0.2,
          life: cold ? 3.2 : 2.4,
          opacity: cold ? 0.5 : 0.32,
        });
      }
      fog.update(dt);

      const c = T - 273.15;
      display.set({ text: c.toFixed(1).replace('-', '−'), unit: '°C', sub: 'bath' });
    },
  };
}
