/**
 * Gay-Lussac's law with steam: a stovetop pressure cooker on a gas burner in a
 * home kitchen. Front half cut away to show the water and the gas above it.
 * Scale: 1 scene unit ≈ 5 cm. Grey spheres are air, colored spheres water vapor.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { metal, chrome, plastic, rubber, liquid, cutaway } from '../materials.js';
import { AnalogGauge } from '../instruments.js';
import { CONTAINERS, POT } from '../../particles/containers.js';
import { kitchen } from '../environments.js';
import { shadows, lathe, arc, Puffs, Bubbles } from './common.js';

const BURNER = { x: 0, z: 0.4 };
const GRATE_TOP = 0.53;
const FLOOR_Y = GRATE_TOP + 0.15;            // inside bottom of the pot
const RIM_Y = FLOOR_Y + POT.height;          // lid seals here
const R_IN = POT.radius;
const R_OUT = R_IN + 0.08;

export function createPressureCooker({ stage }) {
  const spec = CONTAINERS.pressureCooker;
  const r = spec.particleRadius;
  const env = kitchen();
  const group = new THREE.Group();
  group.add(env.group);
  stage.setEnvironment(env.settings);

  const pot = new THREE.Group();
  pot.position.set(BURNER.x, 0, BURNER.z);
  group.add(pot);
  const clip = cutaway(BURNER.z);

  // Stainless pot body: outer wall, rim lip, inner wall, floor.
  const steelMat = metal(0xc9ced3, 0.22);
  steelMat.clippingPlanes = clip;
  steelMat.side = THREE.DoubleSide;
  const body = lathe([
    [0, GRATE_TOP], [R_OUT - 0.25, GRATE_TOP], ...arc(R_OUT - 0.25, GRATE_TOP + 0.25, 0.25, -Math.PI / 2, 0, 6),
    [R_OUT, RIM_Y - 0.1], [R_OUT + 0.12, RIM_Y - 0.05], [R_OUT + 0.12, RIM_Y], [R_IN, RIM_Y], [R_IN, FLOOR_Y], [0, FLOOR_Y],
  ], steelMat, 96);
  pot.add(body);
  // Cut face of the wall, so the section reads as solid metal.
  const cutMat = new THREE.MeshStandardMaterial({ color: 0xdfe3e6, metalness: 0.6, roughness: 0.35 });
  for (const sx of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(R_OUT - R_IN, RIM_Y - FLOOR_Y), cutMat);
    face.position.set(sx * (R_IN + R_OUT) / 2, (RIM_Y + FLOOR_Y) / 2, 0.001);
    pot.add(face);
  }
  const base = new THREE.Mesh(new THREE.PlaneGeometry(2 * R_OUT - 0.4, FLOOR_Y - GRATE_TOP), cutMat);
  base.position.set(0, (FLOOR_Y + GRATE_TOP) / 2, 0.001);
  pot.add(base);

  // Handles: long pot handle and a helper handle.
  const bakelite = plastic(0x1e2124, 0.45);
  const handle = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.34, 0.5, 3, 0.12), bakelite);
  handle.position.set(R_OUT + 1.45, RIM_Y - 0.35, 0);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.42), metal(0xaab1b7, 0.3));
  bracket.position.set(R_OUT + 0.2, RIM_Y - 0.35, 0);
  const helper = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.26, 0.5, 3, 0.1), bakelite);
  helper.position.set(-R_OUT - 0.4, RIM_Y - 0.4, 0);
  pot.add(handle, bracket, helper);

  // Water: clipped column, its cut face, and the surface.
  const waterMat = liquid(0x9fc7d8, 0.38);
  waterMat.clippingPlanes = clip;
  waterMat.side = THREE.DoubleSide;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(R_IN - 0.01, R_IN - 0.01, 1, 64, 1, true), waterMat);
  const waterFace = new THREE.Mesh(new THREE.PlaneGeometry(2 * R_IN - 0.02, 1), liquid(0x8fbfd3, 0.5));
  const surfaceMat = liquid(0xc4e0ea, 0.45);
  surfaceMat.clippingPlanes = clip;
  const surface = new THREE.Mesh(new THREE.CircleGeometry(R_IN - 0.01, 64), surfaceMat);
  surface.rotation.x = -Math.PI / 2;
  water.renderOrder = waterFace.renderOrder = surface.renderOrder = 2;
  pot.add(water, waterFace, surface);
  const bubbles = new Bubbles(160);
  bubbles.mesh.position.y = 0;
  pot.add(bubbles.mesh);

  const particleRoot = new THREE.Group();
  pot.add(particleRoot);

  // Lid: domed, with vent pipe and weighted regulator, dial gauge, lid-lock pin
  // and overpressure plug. A lid handle lines up with the pot handle when locked.
  const lid = new THREE.Group();
  const lidMat = metal(0xd3d8dc, 0.2);
  lidMat.clippingPlanes = clip;
  lidMat.side = THREE.DoubleSide;
  // Spherical cap rising 0.46 above the flange.
  const capH = 0.46, capR = (R_OUT ** 2 + capH ** 2) / (2 * capH), capY = 0.16 + capH - capR;
  const domePts = [[R_OUT + 0.14, 0], [R_OUT + 0.14, 0.12], [R_OUT, 0.16]];
  for (let i = 1; i <= 14; i++) { const x = R_OUT * (1 - i / 14); domePts.push([x, capY + Math.sqrt(capR ** 2 - x ** 2)]); }
  const dome = lathe(domePts, lidMat, 96);
  lid.add(dome);
  const gasketMat = rubber(0x7a5a3a);
  gasketMat.clippingPlanes = clip;
  const gasket = new THREE.Mesh(new THREE.TorusGeometry(R_IN + 0.04, 0.05, 8, 64), gasketMat);
  gasket.rotation.x = Math.PI / 2;
  gasket.position.y = 0.02;
  lid.add(gasket);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 16), chrome());
  pipe.position.y = 0.72;
  const regulator = new THREE.Group();
  const weight = lathe([[0, 0], [0.3, 0], [0.32, 0.08], [0.3, 0.3], [0.14, 0.42], [0.1, 0.5], [0, 0.5]], metal(0x8b9298, 0.35), 32);
  const knobTop = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), metal(0x8b9298, 0.35));
  knobTop.position.y = 0.55;
  regulator.add(weight, knobTop);
  regulator.position.y = 0.86;
  const gauge = new AnalogGauge({
    min: 0, max: 30, major: 5, minor: 1,
    outerUnit: { label: 'PSI' },
    zones: [{ from: 10, to: 15, color: '#3a9d5d' }, { from: 20, to: 30, color: '#c2362b' }],
    caption: 'Pressure cooker gauge',
    radius: 0.42,
  });
  gauge.group.position.set(-1.2, 0.62, -0.55);
  gauge.group.rotation.set(-0.55, 0.25, 0);
  const lockPin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 12), plastic(0xd94a2b, 0.5));
  lockPin.position.set(1.15, 0.45, -0.25);
  const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16), rubber(0x2a2d30));
  plug.position.set(0.75, 0.5, -0.95);
  const lidHandle = new THREE.Mesh(new RoundedBoxGeometry(2.3, 0.3, 0.42, 3, 0.1), bakelite);
  lidHandle.position.set(R_OUT + 1.3, 0.3, 0);
  lid.add(pipe, regulator, gauge.group, lockPin, plug, lidHandle);
  pot.add(lid);

  // Gas flame: two rings of small blue flames under the pot.
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x4f86ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const flameGeom = new THREE.ConeGeometry(0.06, 1, 8, 1, true).translate(0, 0.5, 0);
  const flames = new THREE.InstancedMesh(flameGeom, flameMat, 56);
  flames.frustumCulled = false;
  group.add(flames);
  const fm = new THREE.Matrix4(), fq = new THREE.Quaternion(), fp = new THREE.Vector3(), fs = new THREE.Vector3();
  const flameSlots = [];
  for (let i = 0; i < 36; i++) flameSlots.push({ a: (i / 36) * Math.PI * 2, rad: 1.0, k: 1 });
  for (let i = 0; i < 20; i++) flameSlots.push({ a: (i / 20) * Math.PI * 2, rad: 0.62, k: 0.7 });

  const steam = new Puffs(60, { color: 0xf2f6f8, opacity: 0.55, size: 0.8 });
  group.add(steam.group);
  shadows(pot);

  let time = 0;
  let lidT = 1; // 1 = on the pot, 0 = set aside on the counter
  let lidClipped = true;
  let plugGone = false;
  let blastAge = Infinity;
  const restOff = new THREE.Vector3(-6.4 - BURNER.x, 0.08, 1.2 - BURNER.z);
  const restOn = new THREE.Vector3(0, RIM_Y, 0);

  return {
    group,
    particleRoot,
    camera: { position: [3.2, 8.2, 14.5], target: [0.4, 2.6, 0], maxDistance: 30 },
    legend: 'mix',
    update(view, engine, dt) {
      time += dt;
      const ex = view.extra;
      const heat = view.targets.heat ?? 0;
      const wl = POT.height * (ex.water / POT.volume);

      // Water column and surface.
      water.visible = waterFace.visible = surface.visible = ex.water > 0.005;
      water.scale.y = Math.max(0.001, wl);
      water.position.y = FLOOR_Y + wl / 2;
      waterFace.scale.y = Math.max(0.001, wl);
      waterFace.position.set(0, FLOOR_Y + wl / 2, 0.002);
      surface.position.y = FLOOR_Y + wl + 0.002;
      bubbles.update(dt, { rate: 160 * ex.boiling, floor: FLOOR_Y + 0.05, top: FLOOR_Y + wl - 0.03, radius: R_IN - 0.25, size: 0.06 });

      // Gas space sits under the lid.
      particleRoot.position.y = RIM_Y - r - engine.dims.length;

      // Lid on the pot, or set aside on the counter.
      lidT += ((ex.lid === 'on' ? 1 : 0) - lidT) * (1 - Math.exp(-dt * 6));
      lid.position.lerpVectors(restOff, restOn, lidT);
      lid.position.y += Math.sin(Math.PI * lidT) * 1.3; // lifted over the rim
      // The cutaway applies only while the lid is on the pot.
      const onPot = lidT > 0.5;
      if (onPot !== lidClipped) {
        lidClipped = onPot;
        for (const m of [lidMat, gasketMat]) { m.clippingPlanes = onPot ? clip : []; m.needsUpdate = true; }
      }
      lockPin.position.y = 0.45 + (ex.sealed ? 0.14 : 0);

      // Regulator rocks while venting; jets steam.
      const rocking = ex.venting === 1;
      regulator.rotation.set(rocking ? Math.sin(time * 22) * 0.12 : 0, 0, rocking ? Math.cos(time * 19) * 0.1 : 0);
      gauge.set(view.reading ? view.reading.fraction : 0);

      const top = lid.position.clone().add(pot.position);
      if (rocking && Math.random() < 0.6) steam.emit(top.x + (Math.random() - 0.5) * 0.2, top.y + 1.3, top.z, { vx: (Math.random() - 0.5) * 0.6, vy: 1.6, vz: (Math.random() - 0.5) * 0.4, life: 1.6, opacity: 0.55 });
      if (ex.venting === 3) for (let i = 0; i < 2; i++) steam.emit(top.x, top.y + 1.25, top.z, { vx: 1.8 + Math.random(), vy: 2.6, vz: (Math.random() - 0.5) * 0.8, life: 1.4, opacity: 0.7 });
      if (ex.fired && !plugGone) { plugGone = true; blastAge = 0; }
      if (!ex.fired) plugGone = false;
      plug.visible = !plugGone;
      blastAge += dt;
      if (blastAge < 2.2) {
        const k = 1 - blastAge / 2.2;
        for (let i = 0; i < 4 * k + 1; i++) {
          steam.emit(top.x + 0.75, top.y + 0.6, top.z - 0.95, { vx: (Math.random() - 0.3) * 3, vy: 3 + Math.random() * 2, vz: (Math.random() - 0.5) * 3, life: 1.8, opacity: 0.8 * k + 0.2 });
        }
      }
      if (ex.lid === 'off' && ex.boiling > 0.2 && Math.random() < ex.boiling * 0.5) {
        const a = Math.random() * Math.PI * 2, rr = Math.random() * (R_IN - 0.4);
        steam.emit(pot.position.x + Math.cos(a) * rr, FLOOR_Y + wl + 0.2, pot.position.z + Math.sin(a) * rr, { vy: 0.9, vx: (Math.random() - 0.5) * 0.3, life: 2.2, opacity: 0.4 });
      }
      steam.update(dt);

      // Burner flames scale with the stove setting; knob turns.
      const k = heat / 10;
      let i = 0;
      for (const f of flameSlots) {
        const h = k > 0 ? (0.12 + 0.32 * k) * f.k * (1 + 0.15 * Math.sin(time * 30 + f.a * 7)) : 0;
        fp.set(BURNER.x + Math.cos(f.a) * f.rad, 0.18, BURNER.z + Math.sin(f.a) * f.rad);
        fq.setFromAxisAngle(fp.clone().set(-Math.sin(f.a), 0, Math.cos(f.a)), k > 0 ? 0.35 : 0);
        flames.setMatrixAt(i++, fm.compose(fp, fq, fs.set(1, Math.max(0.0001, h), 1)));
      }
      flames.instanceMatrix.needsUpdate = true;
      flames.visible = k > 0;
      env.knob.rotation.y = -k * Math.PI * 0.75;
    },
  };
}
