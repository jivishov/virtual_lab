/**
 * Boyle's law: a sealed glass syringe on V-blocks, tubing to a pressure sensor.
 * Engine frame: cylinder axis = local y. The barrel frame is turned so local y
 * runs along world +x.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { glass, rubber, plastic, ink } from '../materials.js';
import { Screen, drawLcd, textPlate } from '../instruments.js';
import { CONTAINERS } from '../../particles/containers.js';
import { shadows, lathe, tube, v3 } from './common.js';
import { labBench } from '../environments.js';

const SCALE = 0.85;
const AXIS_Y = 1.05;
const ORIGIN_X = -1.5;
const ML = 4.2 / 20; // accessible length per mL, from containers.js
const BARREL_END = 4.75;
const ROD = 3.75;

export function createSyringe({ stage }) {
  const spec = CONTAINERS.syringe;
  const r = spec.particleRadius;
  const Rin = 0.6 + r;
  const Rout = Rin + 0.07;

  const group = new THREE.Group();
  const env = labBench({ props: 'syringe' });
  group.add(env.group);
  stage.setEnvironment(env.settings);
  const frame = new THREE.Group();
  frame.position.set(ORIGIN_X, AXIS_Y, 0);
  frame.rotation.z = -Math.PI / 2;
  frame.scale.setScalar(SCALE);
  group.add(frame);

  const particleRoot = new THREE.Group();
  frame.add(particleRoot);

  // Glass barrel with a closed, tapered end and luer tip.
  const barrel = lathe(
    [
      [0.07, -0.78], [0.11, -0.78], [0.13, -0.42], [0.3, -0.22], [Rout, -r - 0.08],
      [Rout, BARREL_END], [Rin, BARREL_END], [Rin, -r], [0.28, -r - 0.04], [0.06, -0.4], [0.04, -0.78],
    ],
    glass({ opacity: 0.2 }),
  );
  barrel.renderOrder = 2;
  frame.add(barrel);

  // Finger flange at the open end.
  const flange = new THREE.Mesh(new RoundedBoxGeometry(2.3, 0.08, 1.0, 3, 0.04), glass({ opacity: 0.35 }));
  flange.position.y = BARREL_END - 0.04;
  flange.renderOrder = 2;
  frame.add(flange);

  // Printed graduations facing the camera: every 1 mL, numbered every 5.
  const marks = new THREE.Group();
  const markMat = ink(0x2a3640);
  // Local x maps to world −y, so negative x is the upper face of the barrel.
  const onFace = (x) => Math.sqrt(Rout * Rout - x * x) + 0.004;
  for (let m = 0; m <= 20; m++) {
    const major = m % 5 === 0;
    const x = major ? -0.27 : -0.21;
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(major ? 0.3 : 0.18, 0.016), markMat);
    tick.position.set(x, ML * m + r, onFace(x));
    marks.add(tick);
    if (major) {
      const label = textPlate(String(m), { height: 0.16, color: '#2a3640' });
      label.position.set(0.12, ML * m + r, onFace(0.12));
      label.rotation.z = Math.PI / 2;
      marks.add(label);
    }
  }
  const mlLabel = textPlate('mL', { height: 0.14, color: '#2a3640' });
  mlLabel.position.set(0.12, ML * 21.4 + r, onFace(0.12));
  mlLabel.rotation.z = Math.PI / 2;
  marks.add(mlLabel);
  marks.traverse((o) => { if (o.material) { o.material.depthWrite = false; o.renderOrder = 3; } });
  frame.add(marks);

  // Plunger: ribbed rubber stopper, cross-section rod, thumb press.
  const plunger = new THREE.Group();
  const stopperMat = rubber(0x2b2f33);
  const stopper = new THREE.Mesh(new THREE.CylinderGeometry(Rin, Rin, 0.28, 64), stopperMat);
  stopper.position.y = 0.14;
  const rib1 = new THREE.Mesh(new THREE.CylinderGeometry(Rin + 0.004, Rin + 0.004, 0.05, 64), stopperMat);
  rib1.position.y = 0.04;
  const rib2 = rib1.clone();
  rib2.position.y = 0.24;
  const rodMat = plastic(0xeeeeea, 0.4);
  const vane1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, ROD, 0.08), rodMat);
  vane1.position.y = 0.28 + ROD / 2;
  const vane2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, ROD, 0.9), rodMat);
  vane2.position.y = 0.28 + ROD / 2;
  const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.09, 48), rodMat);
  thumb.position.y = 0.28 + ROD;
  plunger.add(stopper, rib1, rib2, vane1, vane2, thumb);
  frame.add(plunger);

  // V-block supports on the bench.
  const blockMat = plastic(0x56636d, 0.6);
  for (const x of [-0.2, 2.6]) {
    const block = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.42, 1.1, 3, 0.05), blockMat);
    block.position.set(x, 0.21, 0);
    group.add(block);
  }

  // Pressure sensor interface with LCD, tubing from the luer tip.
  const sensor = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.7, 1.05, 0.5, 4, 0.08), plastic(0x3d4a54, 0.55));
  sensor.add(body);
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(1.36, 0.6, 0.06, 3, 0.03), plastic(0x1d252b, 0.4));
  bezel.position.set(0, 0.12, 0.25);
  sensor.add(bezel);
  const lcd = new Screen({ width: 1.24, height: 0.5, res: 320, draw: drawLcd });
  lcd.mesh.position.set(0, 0.12, 0.285);
  sensor.add(lcd.mesh);
  const tag = textPlate('Gas pressure sensor', { height: 0.11, color: '#d5dde2', weight: 500 });
  tag.position.set(0, -0.34, 0.255);
  sensor.add(tag);
  sensor.position.set(-3.55, 0.53, 0.45);
  sensor.rotation.y = 0.35;
  group.add(sensor);

  const tipWorld = v3(ORIGIN_X - 0.78 * SCALE, AXIS_Y, 0);
  const tubing = tube(
    [tipWorld, v3(tipWorld.x - 0.35, AXIS_Y - 0.05, 0.05), v3(-2.9, 0.75, 0.35), v3(-2.85, 0.55, 0.42)],
    0.045, glass({ opacity: 0.45, color: 0xd9e6e8 }),
  );
  tubing.renderOrder = 2;
  group.add(tubing);

  shadows(group);

  return {
    group,
    particleRoot,
    camera: { position: [0.5, 3.4, 12.6], target: [0.4, 1.0, 0] },
    legend: 'speed',
    update(view) {
      const face = view.state.V * (4.2 / 0.020) + r;
      plunger.position.y = face;
      const rd = view.reading;
      if (rd) lcd.set({ text: rd.text, unit: rd.unit, sub: 'absolute', warn: rd.overRange });
    },
  };
}
