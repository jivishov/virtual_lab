/**
 * Gay-Lussac's law: the front wheel of a car parked in a driveway, the tire's
 * outer sidewall cut away to show the air inside. The season outside follows the
 * air temperature. The dashboard reading appears as an inset on the stage.
 * Engine frame: torus ring in the xy plane, axis z. The wheel uses the same frame.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rubber, metal, plastic, cutaway } from '../materials.js';
import { CONTAINERS } from '../../particles/containers.js';
import { shadows, lathe, arc } from './common.js';
import { driveway } from '../environments.js';

const CENTER_Y = 1.98;

export function createCarTire({ stage }) {
  const spec = CONTAINERS.carTire;
  const { major, minor } = spec.dims();
  const r = spec.particleRadius;
  const Rin = minor + r;          // inner air-cavity wall
  const clip = cutaway(0);

  const group = new THREE.Group();
  const env = driveway();
  group.add(env.group);
  stage.setEnvironment(env.settings);
  const wheel = new THREE.Group();
  wheel.position.y = CENTER_Y;
  group.add(wheel);
  const particleRoot = new THREE.Group();
  wheel.add(particleRoot);

  // Tire shell: outer profile (bead, sidewall, shoulder, tread) revolved around z.
  const bead = 1.02, tread = major + Rin + 0.12, halfW = 0.5;
  const outer = [
    [bead, -0.36], ...arc(bead + 0.06, -0.42, 0.06, Math.PI, Math.PI * 1.5, 4),
    [major, -halfW], ...arc(tread - 0.14, -halfW + 0.14, 0.14, -Math.PI / 2, 0, 8),
    ...arc(tread - 0.14, halfW - 0.14, 0.14, 0, Math.PI / 2, 8),
    [major, halfW], ...arc(bead + 0.06, 0.42, 0.06, Math.PI / 2, Math.PI, 4), [bead, 0.36],
  ];
  const tireMat = rubber(0x232629);
  tireMat.clippingPlanes = clip;
  tireMat.side = THREE.DoubleSide;
  const shell = lathe(outer, tireMat, 128);
  shell.rotation.x = Math.PI / 2;
  wheel.add(shell);

  // Air cavity wall, slightly lighter so the inside reads as a surface.
  const cavityMat = rubber(0x3b4046);
  cavityMat.clippingPlanes = clip;
  cavityMat.side = THREE.BackSide;
  const cavity = new THREE.Mesh(new THREE.TorusGeometry(major, Rin, 40, 128), cavityMat);
  wheel.add(cavity);

  // Cut faces at z = 0, where the rubber was sliced.
  const cutMat = rubber(0x2e3236);
  const treadCut = new THREE.Mesh(new THREE.RingGeometry(major + Rin, tread, 128, 1), cutMat);
  const beadCut = new THREE.Mesh(new THREE.RingGeometry(bead, major - Rin, 128, 1), cutMat);
  wheel.add(treadCut, beadCut);

  // Tread grooves.
  const grooveMat = rubber(0x141618);
  grooveMat.clippingPlanes = clip;
  for (const z of [-0.26, 0, 0.26]) {
    const groove = new THREE.Mesh(new THREE.TorusGeometry(tread + 0.004, 0.022, 8, 160), grooveMat);
    groove.position.z = z;
    wheel.add(groove);
  }

  // Alloy wheel: rim barrel, five spokes, hub, valve stem at the top.
  const alloy = metal(0xc3c9ce, 0.32);
  const rimBarrel = new THREE.Mesh(new THREE.CylinderGeometry(bead, bead, 0.78, 96, 1, true), alloy);
  rimBarrel.rotation.x = Math.PI / 2;
  rimBarrel.material.side = THREE.DoubleSide;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(bead + 0.01, 0.035, 12, 96), alloy);
  lip.position.z = 0.39;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.2, 48), alloy);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.2;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 32), metal(0x5d666e, 0.4));
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.32;
  wheel.add(rimBarrel, lip, hub, cap);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    const spoke = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.78, 0.1, 2, 0.04), alloy);
    spoke.position.set(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0.24);
    spoke.rotation.z = a - Math.PI / 2;
    wheel.add(spoke);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.24, 16), rubber(0x1b1d1f));
  stem.position.set(0.32, bead - 0.08, 0.3);
  stem.rotation.set(-0.9, 0, -0.3);
  wheel.add(stem);

  // The car's front corner: side panel with the wheel arch, fender lip, bumper, headlight.
  const paint = new THREE.MeshStandardMaterial({ color: 0x2e4a66, metalness: 0.55, roughness: 0.32 });
  const archR = tread + 0.32;
  const side = new THREE.Shape();
  side.moveTo(-9, 0.75);
  side.lineTo(-archR, 0.75);
  side.absarc(0, CENTER_Y, archR, Math.PI + Math.asin((CENTER_Y - 0.75) / archR), -Math.asin((CENTER_Y - 0.75) / archR), true);
  side.lineTo(4.2, 0.75);
  side.lineTo(4.6, 1.2);
  side.lineTo(4.7, 3.6);
  side.quadraticCurveTo(4.6, 4.3, 3.6, 4.45);
  side.lineTo(-2.4, 4.75);
  side.lineTo(-4.6, 7.2);
  side.lineTo(-9, 7.4);
  side.lineTo(-9, 0.75);
  const panel = new THREE.Mesh(new THREE.ExtrudeGeometry(side, { depth: 0.3, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 48 }), paint);
  panel.position.z = -0.95;
  group.add(panel);
  const well = new THREE.Mesh(new THREE.CircleGeometry(archR - 0.02, 48), rubber(0x121416));
  well.position.set(0, CENTER_Y, -0.9);
  group.add(well);
  const fenderLip = new THREE.Mesh(new THREE.TorusGeometry(archR + 0.02, 0.09, 8, 48, Math.PI * 0.86), plastic(0x1f2327, 0.5));
  fenderLip.rotation.z = Math.PI * 0.07;
  fenderLip.position.set(0, CENTER_Y, -0.5);
  group.add(fenderLip);
  const bumper = new THREE.Mesh(new RoundedBoxGeometry(1.2, 1.1, 2.6, 3, 0.25), plastic(0x24292e, 0.5));
  bumper.position.set(4.3, 1.4, -1.9);
  const lamp = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.45, 1.0, 3, 0.15), new THREE.MeshStandardMaterial({ color: 0xe9eef2, roughness: 0.1, metalness: 0.2, emissive: 0x1a1d20 }));
  lamp.position.set(4.45, 3.55, -1.4);
  const glassTop = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshStandardMaterial({ color: 0x2b3a46, roughness: 0.05, metalness: 0.4 }));
  glassTop.position.set(-3.5, 6.1, -0.94);
  glassTop.rotation.z = -0.85;
  group.add(bumper, lamp, glassTop);

  shadows(group);

  return {
    group,
    particleRoot,
    camera: { position: [2.2, 3.0, 11.8], target: [0.6, 2.0, 0] },
    legend: 'speed',
    update(view) {
      env.update(view);
    },
    inset(view) {
      const rd = view.reading;
      const c = Math.round(view.env.T - 273.15);
      const tpms = view.events.some((e) => e.id === 'tpms');
      return {
        title: 'Dashboard',
        warn: tpms,
        rows: [
          ['Front left tire', `${rd ? rd.text : '–'} psi`],
          ['Outside', `${c < 0 ? '−' + Math.abs(c) : c} °C`],
        ],
        alert: tpms ? 'Low tire pressure' : '',
      };
    },
  };
}
