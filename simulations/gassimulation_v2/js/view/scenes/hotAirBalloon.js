/**
 * Charles's law, real version: hot inflation of a hot air balloon in a field.
 *
 * Scale: 1 scene unit ≈ 3 m. The envelope lies on its side after the fan fills it
 * (cold inflation), stands up as the burner heats the air, then fills, spills air
 * through the mouth, and rises on its tether. The front half is cut away so the
 * air inside is visible.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { metal, chrome, plastic, rubber, cutaway } from '../materials.js';
import { TEARDROP } from '../../particles/shapes.js';
import { CONTAINERS } from '../../particles/containers.js';
import { meadow } from '../environments.js';
import { shadows } from './common.js';

const UNIT_M = 3;
const LYING = -1.42;            // envelope angle when lying in the grass
const SQUASH = 0.32;            // a lying envelope is flattened by its own weight
const BASKET = { w: 0.46, h: 0.38 };
const MOUTH_ABOVE = 1.0;        // mouth height above the basket rim when upright
const GORES = 24;

const smooth = (t) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;

function goreTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const colors = ['#1f3a5f', '#e8a33d', '#efe6d2', '#e8a33d'];
  const gw = c.width / GORES;
  for (let i = 0; i < GORES; i++) {
    g.fillStyle = colors[i % colors.length];
    g.fillRect(i * gw, 0, gw + 1, c.height);
  }
  // A band near the equator, and a darker crown and mouth.
  g.fillStyle = '#6b3a5b';
  g.fillRect(0, c.height * 0.5, c.width, c.height * 0.07);
  g.fillStyle = '#1b2f4a';
  g.fillRect(0, c.height * 0.93, c.width, c.height * 0.07);
  g.fillStyle = '#3a2a24';
  g.fillRect(0, 0, c.width, c.height * 0.06);
  // Load tapes along every seam.
  g.fillStyle = 'rgba(30, 30, 30, 0.55)';
  for (let i = 0; i <= GORES; i++) g.fillRect(i * gw - 1.5, 0, 3, c.height);
  for (const v of [0.25, 0.45, 0.62, 0.78]) g.fillRect(0, c.height * v, c.width, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function wickerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8a6a43';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 8) {
    for (let x = 0; x < 256; x += 16) {
      g.fillStyle = (x / 16 + y / 8) % 2 ? '#a07c50' : '#76593a';
      g.fillRect(x + ((y / 8) % 2 ? 8 : 0), y, 14, 6);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 1.5);
  return t;
}

function flameTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0, 'rgba(255,255,240,1)');
  grad.addColorStop(0.25, 'rgba(255,200,90,0.95)');
  grad.addColorStop(0.6, 'rgba(255,120,30,0.6)');
  grad.addColorStop(1, 'rgba(255,80,20,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createHotAirBalloon({ stage, preset }) {
  const spec = CONTAINERS.hotAirBalloon;
  const r = spec.particleRadius;
  const env = meadow({ time: preset?.id === 'afternoon' ? 'afternoon' : 'morning' });
  const group = new THREE.Group();
  group.add(env.group);
  stage.setEnvironment(env.settings);

  const lift = new THREE.Group();
  group.add(lift);
  const squash = new THREE.Group();
  lift.add(squash);
  const envelope = new THREE.Group();
  squash.add(envelope);
  const particleRoot = new THREE.Group();
  envelope.add(particleRoot);

  // Envelope fabric: the teardrop profile plus a flared skirt below the mouth.
  const clip = cutaway(0);
  const fabricMat = new THREE.MeshStandardMaterial({ map: goreTexture(), side: THREE.DoubleSide, roughness: 0.8, clippingPlanes: clip });
  const pts = [];
  pts.push(new THREE.Vector2(TEARDROP.mouth + 0.16, TEARDROP.bottom - 0.16));
  for (let i = 0; i <= 80; i++) {
    const y = TEARDROP.bottom + ((TEARDROP.top - TEARDROP.bottom) * i) / 80;
    pts.push(new THREE.Vector2(TEARDROP.radius(y) + 0.04, y));
  }
  pts.push(new THREE.Vector2(0.001, TEARDROP.top + 0.04));
  const fabricGeom = new THREE.LatheGeometry(pts, GORES * 3);
  const fabric = new THREE.Mesh(fabricGeom, fabricMat);
  fabric.castShadow = true;
  envelope.add(fabric);
  const mouthRing = new THREE.Mesh(new THREE.TorusGeometry(TEARDROP.mouth + 0.05, 0.012, 6, 32), metal(0x8a8f94, 0.4));
  mouthRing.rotation.x = Math.PI / 2;
  mouthRing.position.y = TEARDROP.bottom;
  envelope.add(mouthRing);

  // Basket with burner frame, uprights, burner coils and the flame.
  const basket = new THREE.Group();
  lift.add(basket);
  const wicker = new THREE.Mesh(new RoundedBoxGeometry(BASKET.w, BASKET.h, BASKET.w * 0.85, 3, 0.03), new THREE.MeshStandardMaterial({ map: wickerTexture(), roughness: 0.9 }));
  wicker.position.y = BASKET.h / 2;
  const rim = new THREE.Mesh(new RoundedBoxGeometry(BASKET.w + 0.03, 0.05, BASKET.w * 0.85 + 0.03, 2, 0.02), plastic(0x4a2e1f, 0.6));
  rim.position.y = BASKET.h;
  basket.add(wicker, rim);
  const steel = metal(0x9aa2a8, 0.3);
  const frameY = BASKET.h + 0.32;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [sx * BASKET.w * 0.42, sz * BASKET.w * 0.36]);
  for (const [x, z] of corners) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 6), steel);
    rod.position.set(x, BASKET.h + 0.16, z);
    basket.add(rod);
  }
  const frame = new THREE.Mesh(new THREE.TorusGeometry(BASKET.w * 0.56, 0.012, 6, 4), steel);
  frame.rotation.set(Math.PI / 2, 0, Math.PI / 4);
  frame.position.y = frameY;
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 24), chrome());
  coil.rotation.x = Math.PI / 2;
  coil.position.y = frameY + 0.03;
  basket.add(frame, coil);
  const flameMat = new THREE.MeshBasicMaterial({ map: flameTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const flameGeom = new THREE.ConeGeometry(0.09, 1, 16, 1, true);
  flameGeom.translate(0, 0.5, 0); // base at the burner, texture fades toward the tip
  const flame = new THREE.Mesh(flameGeom, flameMat);
  flame.position.y = frameY + 0.05;
  flame.renderOrder = 6;
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.035, 1, 12, 1, true).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  core.position.y = frameY + 0.05;
  const glow = new THREE.PointLight(0xffa24a, 0, 8, 1.4);
  glow.position.y = frameY + 0.5;
  basket.add(flame, core, glow);

  // Load cables from the burner frame to the mouth ring.
  const cableGeom = new THREE.BufferGeometry();
  cableGeom.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(8 * 3 * 2), 3));
  const cables = new THREE.LineSegments(cableGeom, new THREE.LineBasicMaterial({ color: 0x3a3f44 }));
  cables.frustumCulled = false;
  lift.add(cables);

  // Inflator fan on the grass, aimed at the mouth.
  const fan = new THREE.Group();
  const shroud = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 32), plastic(0xd8a52c, 0.5));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 16), plastic(0x2a2e31));
  hub.rotation.x = Math.PI / 2;
  const blades = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.015), plastic(0x2a2e31));
    b.position.y = 0.13;
    const holder = new THREE.Group();
    holder.rotation.z = (i / 4) * Math.PI * 2;
    holder.add(b);
    blades.add(holder);
  }
  const legs = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.06, 0.4, 2, 0.02), plastic(0x2a2e31));
  legs.position.y = -0.3;
  fan.add(shroud, hub, blades, legs);
  fan.rotation.y = Math.PI / 2;
  fan.position.set(-0.75, 0.34, 0.55);
  group.add(fan);

  // Tether to a ground stake.
  const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.01, 0.25, 8), metal(0x6b7177, 0.4));
  stake.position.set(-1.6, 0.1, 1.2);
  group.add(stake);
  const tetherGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tether = new THREE.Line(tetherGeom, new THREE.LineBasicMaterial({ color: 0xeae3cf }));
  tether.frustumCulled = false;
  group.add(tether);

  shadows(basket);
  shadows(fan);
  let time = 0;
  const v = new THREE.Vector3();

  return {
    group,
    particleRoot,
    camera: { position: [7.5, 6.4, 29], target: [2.0, 6.0, 0], maxDistance: 70, minDistance: 6, far: 500 },
    legend: 'speed',
    update(view, engine, dt) {
      time += dt;
      const s = engine.dims.s;
      const st = smooth(view.extra.stand);
      const height = view.extra.height / UNIT_M;
      lift.position.y = height;

      // Basket: on its side for inflation, upright once the envelope stands.
      const basketLyingY = BASKET.w * 0.42;
      // Lying, the basket is tipped so the burner aims into the mouth the crew holds open.
      basket.rotation.z = lerp(-Math.PI / 2 + 0.55, 0, st);
      basket.position.set(lerp(0.0, 0, st), lerp(basketLyingY, 0, st), 0);

      // Envelope pose: lying in the grass (squashed), then standing over the basket.
      const theta = lerp(LYING, 0, st);
      squash.scale.y = lerp(SQUASH, 1, st);
      const sin = Math.sin(LYING), cos = Math.cos(LYING);
      const lyingC = new THREE.Vector3(0.95 + -TEARDROP.bottom * s * -sin, s, 0);
      void cos;
      const upC = new THREE.Vector3(0, BASKET.h + MOUTH_ABOVE + -TEARDROP.bottom * s, 0);
      envelope.position.lerpVectors(lyingC, upC, st);
      envelope.rotation.z = theta;
      fabric.scale.setScalar(s);
      mouthRing.scale.setScalar(s);
      mouthRing.position.y = TEARDROP.bottom * s;

      // Burner flame and its glow inside the envelope.
      const b = (view.targets.burner ?? 0) / 100;
      const flick = 1 + 0.12 * Math.sin(time * 37) + 0.08 * Math.sin(time * 23 + 1);
      flame.visible = core.visible = b > 0.01;
      flame.scale.set(0.8 + 0.5 * b, (0.25 + 1.05 * b) * flick, 0.8 + 0.5 * b);
      core.scale.set(1, (0.12 + 0.35 * b) * flick, 1);
      glow.intensity = 60 * b * flick;

      // Fan runs during cold and hot inflation.
      fan.visible = !view.extra.full || st < 0.98;
      blades.rotation.z += dt * 40;

      // Cables: burner frame corners to four points on the mouth ring.
      lift.updateMatrixWorld(true);
      const pos = cableGeom.attributes.position.array;
      for (let i = 0; i < 4; i++) {
        const [cx, cz] = corners[i];
        v.set(cx, frameY, cz);
        basket.localToWorld(v); lift.worldToLocal(v);
        pos.set([v.x, v.y, v.z], i * 6);
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        v.set(Math.cos(a) * TEARDROP.mouth * s, TEARDROP.bottom * s, Math.sin(a) * TEARDROP.mouth * s);
        envelope.localToWorld(v); lift.worldToLocal(v);
        pos.set([v.x, v.y, v.z], i * 6 + 3);
      }
      for (let i = 4; i < 8; i++) pos.set([0, 0, 0, 0, 0, 0], i * 6);
      cableGeom.attributes.position.needsUpdate = true;

      // Tether from the stake to the basket floor.
      const tp = tetherGeom.attributes.position.array;
      tp.set([stake.position.x, 0.2, stake.position.z, 0, height + 0.02, 0]);
      tetherGeom.attributes.position.needsUpdate = true;
    },
    inset(view) {
      const rd = view.reading;
      const net = view.extra.net;
      return {
        title: "Pilot's instrument",
        warn: view.state.T >= 383.15,
        rows: [
          ['Envelope', rd ? `${rd.text} °C` : '–'],
          ['Height', `${view.extra.height.toFixed(1)} m`],
          ['Net lift', `${net >= 0 ? '+' : '−'}${Math.abs(Math.round(net))} kg`],
        ],
      };
    },
  };
}
