/**
 * Simple, realistic surroundings for each system. Low-poly geometry and small
 * canvas textures, so classroom laptops can draw them.
 *
 * Each builder returns { group, settings, update?(view, dt) }.
 * settings go to stage.setEnvironment(): background, fog, lights, shadow size, floor.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { glass, plastic, metal, rubber } from './materials.js';
import { textPlate } from './instruments.js';
import { shadows, lathe } from './scenes/common.js';

// ───────────── textures ─────────────

function canvasTex(w, h, paint, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Speckled surface: base color with soft random flecks. */
function speckle(base, flecks, { size = 512, count = 2600, rMax = 2.2, seed = 1, repeat = [4, 4] } = {}) {
  return canvasTex(size, size, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < count; i++) {
      g.fillStyle = flecks[Math.floor(r() * flecks.length)];
      g.globalAlpha = 0.25 + r() * 0.5;
      g.beginPath(); g.arc(r() * w, r() * h, 0.4 + r() * rMax, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }, repeat);
}

function tiles(base, grout, { cols = 8, rows = 16, offset = true, repeat = [3, 2], size = 512 } = {}) {
  return canvasTex(size, size, (g, w, h) => {
    g.fillStyle = grout; g.fillRect(0, 0, w, h);
    const tw = w / cols, th = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = -1; x < cols + 1; x++) {
        const ox = offset && y % 2 ? tw / 2 : 0;
        const grad = g.createLinearGradient(0, y * th, 0, (y + 1) * th);
        grad.addColorStop(0, base); grad.addColorStop(1, shade(base, -0.05));
        g.fillStyle = grad;
        g.fillRect(x * tw + ox + 1.5, y * th + 1.5, tw - 3, th - 3);
      }
    }
  }, repeat);
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, k);
  return `#${c.getHexString()}`;
}

function skyDome(top, horizon, bottom = horizon) {
  const tex = canvasTex(8, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, top); grad.addColorStop(0.48, horizon); grad.addColorStop(0.52, horizon); grad.addColorStop(1, bottom);
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const m = new THREE.Mesh(new THREE.SphereGeometry(190, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -10;
  return m;
}

const LIGHT = {
  studio: { key: 0xffffff, keyIntensity: 1.5, keyPos: [4.5, 9, 6], hemiSky: 0xf4f7fa, hemiGround: 0x9aa3a8, hemiIntensity: 0.55 },
  room: { key: 0xfff4e6, keyIntensity: 1.35, keyPos: [3.5, 9, 5], hemiSky: 0xf6f2ea, hemiGround: 0x8a8378, hemiIntensity: 0.6 },
};

// ───────────── chemistry lab bench ─────────────

export function labBench({ width = 14, depth = 4.6, props = 'syringe' } = {}) {
  const group = new THREE.Group();
  const top = new THREE.Mesh(
    new RoundedBoxGeometry(width, 0.16, depth, 2, 0.04),
    new THREE.MeshStandardMaterial({ map: speckle('#2f3539', ['#3a4146', '#262b2f', '#454c52'], { repeat: [6, 2], seed: 3 }), roughness: 0.6 }),
  );
  top.position.set(0, -0.08, -0.4);
  top.receiveShadow = true;
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(width - 0.2, 3.2, depth - 0.4), plastic(0xd9dcd6, 0.7));
  cabinet.position.set(0, -1.76, -0.4);
  const doors = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const d = new THREE.Mesh(new RoundedBoxGeometry(width / 6 - 0.12, 2.9, 0.06, 2, 0.02), plastic(0xe6e8e3, 0.6));
    d.position.set(-width / 2 + (i + 0.5) * (width / 6), -1.8, depth / 2 - 0.58);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), metal(0x9aa1a7, 0.3));
    handle.position.set(d.position.x, -0.55, depth / 2 - 0.53);
    doors.add(d, handle);
  }
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 20, 14),
    new THREE.MeshStandardMaterial({ map: tiles('#eef0ec', '#c9cdc8', { cols: 6, rows: 12, repeat: [8, 3] }), roughness: 0.8 }),
  );
  wall.position.set(0, 5, -2.7);
  wall.receiveShadow = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ map: speckle('#b9bdb8', ['#a8ada7', '#c8ccc6'], { repeat: [10, 6] }), roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.36;
  group.add(top, cabinet, doors, wall, floor);

  // Shelf of reagent bottles on the back wall.
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.08, 0.6), plastic(0xcfd3cd, 0.6));
  shelf.position.set(3.6, 3.9, -2.4);
  group.add(shelf);
  const amber = new THREE.MeshStandardMaterial({ color: 0x7a4a18, roughness: 0.15, transparent: true, opacity: 0.85 });
  const clear = glass({ opacity: 0.35 });
  for (let i = 0; i < 7; i++) {
    const h = 0.55 + (i % 3) * 0.15;
    const bottle = lathe([[0, 0], [0.2, 0], [0.22, 0.04], [0.22, h], [0.12, h + 0.12], [0.1, h + 0.25], [0, h + 0.25]], i % 3 === 1 ? clear : amber, 24);
    bottle.position.set(1.4 + i * 0.68, 3.94, -2.4);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 16), plastic(i % 2 ? 0x2c3f57 : 0x30363b));
    cap.position.set(bottle.position.x, 3.94 + h + 0.3, -2.4);
    group.add(bottle, cap);
  }

  // Props on the bench.
  const goggles = new THREE.Group();
  const lens = new THREE.MeshStandardMaterial({ color: 0xdfe9ee, roughness: 0.1, transparent: true, opacity: 0.5 });
  for (const x of [-0.24, 0.24]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), lens);
    l.scale.set(1, 0.5, 0.8);
    l.position.x = x;
    goggles.add(l);
  }
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 32, Math.PI), rubber(0x2c4b6e));
  strap.rotation.x = -Math.PI / 2;
  goggles.add(strap);
  const notebook = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.08, 1.7, 2, 0.02), plastic(0x3a5a7a, 0.7));
  const page = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.02, 1.62), plastic(0xf3f1ea, 0.9));
  page.position.y = 0.05;
  const nb = new THREE.Group();
  nb.add(notebook, page);
  if (props === 'syringe') {
    goggles.position.set(4.8, 0.06, 1.0);
    goggles.rotation.y = -0.5;
    nb.position.set(-5.6, 0.04, 0.9);
    nb.rotation.y = 0.25;
  } else {
    goggles.position.set(-4.6, 0.06, 1.1);
    goggles.rotation.y = 0.6;
    nb.position.set(5.2, 0.04, 1.0);
    nb.rotation.y = -0.3;
    // Cryo gloves and a small Dewar flask for liquid nitrogen work.
    const glove = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.18, 1.5, 3, 0.08), plastic(0x3a6ea5, 0.8));
    glove.position.set(4.4, 0.09, -0.9);
    glove.rotation.y = 0.4;
    const dewar = lathe([[0, 0], [0.55, 0], [0.6, 0.08], [0.6, 1.6], [0.45, 1.75], [0.3, 1.8], [0, 1.8]], metal(0xc2c8cd, 0.25), 32);
    dewar.position.set(-5.6, 0, -1.6);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 24), plastic(0x2f3a42, 0.5));
    cap.position.set(-5.6, 1.88, -1.6);
    const tag = textPlate('LN₂', { height: 0.22, color: '#1e2b35', bg: '#f2f3ef', padding: 0.4 });
    tag.position.set(-5.6, 1.0, -0.99);
    group.add(glove, dewar, cap, tag);
  }
  group.add(goggles, nb);
  shadows(group, true);
  top.castShadow = false;
  return { group, settings: { background: 0xdfe3e0, fog: null, floor: false, shadowSize: 8, ...LIGHT.room } };
}

// ───────────── open meadow at dawn or afternoon ─────────────

export function meadow({ time = 'morning' } = {}) {
  const dawn = time === 'morning';
  const group = new THREE.Group();
  const grass = new THREE.Mesh(
    new THREE.CircleGeometry(120, 64),
    new THREE.MeshStandardMaterial({ map: speckle(dawn ? '#5f7f45' : '#6c8c3e', ['#4d6b37', '#7a9a52', '#8aa85e', '#5a7a3a'], { count: 5200, rMax: 1.6, repeat: [40, 40], seed: 9 }), roughness: 0.95 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  group.add(grass);
  // Launch tarp under the basket.
  const tarp = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 3), new THREE.MeshStandardMaterial({ color: 0x3e5872, roughness: 0.8 }));
  tarp.rotation.x = -Math.PI / 2;
  tarp.position.set(3.2, 0.01, 0);
  tarp.receiveShadow = true;
  group.add(tarp);

  const sky = dawn ? skyDome('#7fa6cf', '#f2d2ae', '#d9c3a3') : skyDome('#4f8fd6', '#cfe2f2', '#bfd0d8');
  group.add(sky);

  // Tree line and low hills on the horizon.
  const r = rng(21);
  const foliage = new THREE.MeshStandardMaterial({ color: dawn ? 0x3b5a3a : 0x3f6b35, roughness: 0.9, flatShading: true });
  const trunk = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.9 });
  const crown = new THREE.IcosahedronGeometry(1, 0);
  const stem = new THREE.CylinderGeometry(0.12, 0.18, 1.6, 6);
  const trees = new THREE.InstancedMesh(crown, foliage, 90);
  const trunks = new THREE.InstancedMesh(stem, trunk, 90);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < 90; i++) {
    const a = -Math.PI * 0.95 + r() * Math.PI * 0.9;
    const d = 70 + r() * 35;
    const k = 1.0 + r() * 1.1;
    p.set(Math.cos(a) * d, 1.6 * k * 0.5 + k, Math.sin(a) * d);
    s.set(k * 1.2, k * 1.5, k * 1.2);
    trees.setMatrixAt(i, m.compose(p, q, s));
    p.y = 0.8 * k;
    trunks.setMatrixAt(i, m.compose(p, q, s.set(k, k, k)));
  }
  group.add(trees, trunks);
  const hillMat = new THREE.MeshStandardMaterial({ color: dawn ? 0x5d7564 : 0x6a8a5a, roughness: 1 });
  for (const [x, z, sx, sy] of [[-60, -110, 70, 14], [40, -120, 90, 18], [110, -80, 60, 10]]) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
    hill.scale.set(sx, sy, 30);
    hill.position.set(x, 0, z);
    group.add(hill);
  }
  return {
    group,
    settings: {
      background: dawn ? 0xe9cfae : 0xc9dcec,
      fog: { color: dawn ? 0xe8d3b8 : 0xd3e2ec, near: 45, far: 180 },
      floor: false,
      shadowSize: 16,
      key: dawn ? 0xffd2a0 : 0xffffff,
      keyIntensity: dawn ? 1.6 : 1.9,
      keyPos: dawn ? [14, 6, 10] : [6, 16, 8],
      hemiSky: dawn ? 0xbfd2ea : 0xdcecff,
      hemiGround: 0x6b7a4f,
      hemiIntensity: dawn ? 0.55 : 0.75,
    },
  };
}

// ───────────── home kitchen with a gas cooktop ─────────────

export function kitchen() {
  const group = new THREE.Group();
  const counter = new THREE.Mesh(
    new RoundedBoxGeometry(18, 0.5, 7, 2, 0.06),
    new THREE.MeshStandardMaterial({ map: speckle('#d8d2c8', ['#c4bdb2', '#e6e1d9', '#b5aea3', '#9b948a'], { count: 4200, rMax: 1.4, repeat: [5, 2], seed: 5 }), roughness: 0.45 }),
  );
  counter.position.set(0, -0.25, -0.6);
  counter.receiveShadow = true;
  const cabinets = new THREE.Mesh(new THREE.BoxGeometry(17.6, 7, 6.2), plastic(0x5b6b73, 0.6));
  cabinets.position.set(0, -4.0, -0.7);
  const backsplash = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 9),
    new THREE.MeshStandardMaterial({ map: tiles('#f1efe9', '#cfcac0', { cols: 6, rows: 12, repeat: [7, 2.5] }), roughness: 0.35 }),
  );
  backsplash.position.set(0, 4.5, -4.1);
  backsplash.receiveShadow = true;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), plastic(0xe9e4da, 0.9));
  wall.position.set(0, 10, -4.12);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 3), plastic(0x5b6b73, 0.6));
  upper.position.set(0, 11.5, -2.7);
  group.add(counter, cabinets, backsplash, wall, upper);

  // Cooktop: dark steel plate with four burners and cast-iron grates.
  const plate = new THREE.Mesh(new RoundedBoxGeometry(9.6, 0.08, 5.6, 2, 0.03), metal(0x2a2e32, 0.35));
  plate.position.set(0, 0.04, -0.4);
  plate.receiveShadow = true;
  group.add(plate);
  const iron = new THREE.MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.7, metalness: 0.4 });
  const burners = [[0, 0.6], [-3.1, -1.6], [3.1, -1.6], [-3.1, 0.6], [3.1, 0.6], [0, -1.6]].slice(0, 4);
  const spots = [[0, 0.4], [-3.4, -1.7], [3.4, -1.7], [3.4, 0.9]];
  for (const [x, z] of spots) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.18, 32), metal(0x3a3f44, 0.4));
    cap.position.set(x, 0.17, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 8, 40), metal(0x4a5057, 0.35));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.12, z);
    group.add(cap, ring);
    // grate: four fingers on a square frame
    const frame = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.07, 6, 4), iron);
    frame.rotation.set(Math.PI / 2, 0, Math.PI / 4);
    frame.position.set(x, 0.46, z);
    group.add(frame);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const finger = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.12), iron);
      finger.position.set(x + Math.cos(a) * 1.25, 0.47, z + Math.sin(a) * 1.25);
      finger.rotation.y = -a;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12), iron);
      leg.position.set(x + Math.cos(a + Math.PI / 4) * 1.95, 0.24, z + Math.sin(a + Math.PI / 4) * 1.95);
      group.add(finger, leg);
    }
  }
  void burners;
  // Knobs along the front edge.
  const knobs = [];
  for (let i = 0; i < 4; i++) {
    const k = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.3, 24), plastic(0x2a2d30, 0.4));
    const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.3), plastic(0xe6e6e0));
    pointer.position.set(0, 0.17, 0.12);
    k.add(body, pointer);
    k.position.set(-3 + i * 2, 0.23, 2.2);
    group.add(k);
    knobs.push(k);
  }
  // A wooden spoon rest and a towel, for scale and context.
  const towel = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.1, 2.6, 2, 0.04), plastic(0xc9d6cf, 0.95));
  towel.position.set(-6.8, 0.05, 1.2);
  towel.rotation.y = 0.2;
  group.add(towel);
  shadows(group, true);
  return {
    group,
    knob: knobs[0],
    settings: { background: 0xe6e0d6, fog: null, floor: false, shadowSize: 9, ...LIGHT.room },
  };
}

// ───────────── driveway with seasons ─────────────

export function driveway() {
  const group = new THREE.Group();
  const concrete = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 30),
    new THREE.MeshStandardMaterial({ map: tiles('#b9b6ae', '#8f8c86', { cols: 2, rows: 2, offset: false, repeat: [5, 4] }), roughness: 0.95 }),
  );
  concrete.rotation.x = -Math.PI / 2;
  concrete.receiveShadow = true;
  const lawnMat = new THREE.MeshStandardMaterial({ map: speckle('#6a8a45', ['#55733a', '#7d9c55', '#4a6833'], { count: 4000, rMax: 1.5, repeat: [12, 6], seed: 4 }), roughness: 0.95 });
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), lawnMat);
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(0, -0.01, -28);
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fa, roughness: 0.9, transparent: true, opacity: 0 });
  const snow = new THREE.Mesh(new THREE.PlaneGeometry(70, 50), snowMat);
  snow.rotation.x = -Math.PI / 2;
  snow.position.set(0, 0.015, -10);
  snow.receiveShadow = true;
  const banks = new THREE.Group();
  for (const [x, z, sx] of [[-8, -6, 3.5], [7, -7.5, 4], [-12, 3, 3], [12, 4, 3.4]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.85 }));
    b.scale.set(sx, 0.9, 1.6);
    b.position.set(x, 0, z);
    banks.add(b);
  }
  // House wall and garage door behind.
  const house = new THREE.Mesh(new THREE.BoxGeometry(34, 14, 1), plastic(0xd8d2c6, 0.85));
  house.position.set(0, 7, -16);
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 7),
    new THREE.MeshStandardMaterial({ map: tiles('#eceae4', '#c5c2bb', { cols: 1, rows: 4, offset: false, repeat: [1, 1] }), roughness: 0.6 }),
  );
  door.position.set(-4, 3.5, -15.49);
  // Trees: bare in winter, leafy otherwise.
  const bare = new THREE.Group();
  const leafy = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: 0x4b3d31, roughness: 0.9 });
  const leaves = new THREE.MeshStandardMaterial({ color: 0x4e7a3a, roughness: 0.9, flatShading: true });
  for (const [x, z] of [[11, -12], [16, -10], [-16, -11]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 8), bark);
    t.position.set(x, 3.5, z);
    const t2 = t.clone();
    leafy.add(t2);
    bare.add(t);
    for (let i = 0; i < 4; i++) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 2.6, 5), bark);
      br.position.set(x + (i - 1.5) * 0.5, 5.5 + i * 0.3, z);
      br.rotation.z = (i - 1.5) * 0.5;
      bare.add(br);
    }
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 1), leaves);
    c.position.set(x, 7.5, z);
    leafy.add(c);
  }
  group.add(concrete, lawn, snow, banks, house, door, bare, leafy);
  shadows(group, true);

  return {
    group,
    settings: { background: 0xdfe6ec, fog: { color: 0xdfe6ec, near: 30, far: 90 }, floor: false, shadowSize: 9, ...LIGHT.studio, keyPos: [6, 10, 7] },
    /** Season from the air temperature in kelvin. */
    update(view) {
      const T = view.env.T;
      const winter = T < 275;
      const hot = T > 303;
      snowMat.opacity = winter ? Math.min(1, (275 - T) / 10) * 0.92 : 0;
      banks.visible = winter;
      bare.visible = winter;
      leafy.visible = !winter;
      leaves.color.setHex(hot ? 0x5a7d32 : 0x4e7a3a);
      lawnMat.color.setHex(winter ? 0xc8d0c8 : hot ? 0xd8d0a0 : 0xffffff);
    },
  };
}

// ───────────── party room ─────────────

export function partyRoom() {
  const group = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 24),
    new THREE.MeshStandardMaterial({
      map: canvasTex(512, 512, (g, w, h) => {
        const r = rng(7);
        for (let i = 0; i < 8; i++) {
          g.fillStyle = shade('#b48a5a', (r() - 0.5) * 0.08);
          g.fillRect(0, (i * h) / 8, w, h / 8 - 2);
          g.fillStyle = 'rgba(60,40,20,0.25)';
          g.fillRect(0, ((i + 1) * h) / 8 - 2, w, 2);
        }
      }, [6, 4]),
      roughness: 0.6,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), plastic(0xe8e1ef, 0.9));
  wall.position.set(0, 8, -4.5);
  wall.receiveShadow = true;
  const skirting = new THREE.Mesh(new THREE.BoxGeometry(40, 0.4, 0.1), plastic(0xf6f3f0, 0.6));
  skirting.position.set(0, 0.2, -4.45);
  group.add(floor, wall, skirting);
  // Bunting across the wall.
  const colors = [0xe8b33a, 0x7f9fbe, 0xa797e0, 0x8cc4a8, 0xf0d58a];
  const string = [];
  for (let i = 0; i <= 14; i++) {
    const x = -9 + (i / 14) * 18;
    const y = 6.2 - 0.9 * Math.sin((i / 14) * Math.PI);
    string.push(new THREE.Vector3(x, y, -4.35));
    if (i < 14) {
      const flag = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.45, 0, 0), new THREE.Vector3(0.45, 0, 0), new THREE.Vector3(0, -0.95, 0)]), new THREE.MeshStandardMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide, roughness: 0.8 }));
      flag.geometry.computeVertexNormals();
      flag.position.set(x + 0.64, y - 0.1 - 0.06 * Math.sin(((i + 0.5) / 14) * Math.PI), -4.33);
      group.add(flag);
    }
  }
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(string), new THREE.LineBasicMaterial({ color: 0x6a5f55 })));
  // A wrapped gift box for scale.
  const gift = new THREE.Group();
  const box = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.8, 1.0, 2, 0.03), plastic(0x7f9fbe, 0.6));
  box.position.y = 0.4;
  const ribbon1 = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.82, 0.14), plastic(0xf0d58a, 0.4));
  ribbon1.position.y = 0.4;
  const ribbon2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.82, 1.02), plastic(0xf0d58a, 0.4));
  ribbon2.position.y = 0.4;
  gift.add(box, ribbon1, ribbon2);
  gift.position.set(2.6, 0, 1.0);
  gift.rotation.y = 0.5;
  group.add(gift);
  shadows(group, true);
  return { group, settings: { background: 0xe8e1ef, fog: null, floor: false, shadowSize: 8, ...LIGHT.room } };
}

// ───────────── dive shop fill station ─────────────

export function fillStation() {
  const group = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 24),
    new THREE.MeshStandardMaterial({ map: tiles('#9fb3bd', '#7d8f99', { cols: 4, rows: 4, offset: false, repeat: [10, 6] }), roughness: 0.7 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), plastic(0xdfe6e8, 0.9));
  wall.position.set(0, 8, -3.6);
  wall.receiveShadow = true;
  group.add(floor, wall);
  // Compressor panel with gauges, and a rack of tanks.
  const panel = new THREE.Mesh(new RoundedBoxGeometry(2.6, 3.4, 0.8, 3, 0.08), plastic(0x2f4e66, 0.5));
  panel.position.set(-4.6, 1.7, -2.6);
  group.add(panel);
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 24), new THREE.MeshStandardMaterial({ color: 0xf4f4ef, roughness: 0.4 }));
    g.rotation.x = Math.PI / 2;
    g.position.set(-5.4 + i * 0.8, 2.6, -2.18);
    group.add(g);
  }
  const sign = textPlate('Fill station', { height: 0.36, color: '#f4f6f7', bg: '#2f4e66', padding: 0.5 });
  sign.position.set(-4.6, 3.9, -2.18);
  group.add(sign);
  const paint = [0xd8b13a, 0xc8ced2, 0x5d84a8];
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 2.0, 6, 20), new THREE.MeshStandardMaterial({ color: paint[i], roughness: 0.4, metalness: 0.3 }));
    t.position.set(5.0 + i * 1.0, 1.45, -2.8);
    group.add(t);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.1), metal(0x9aa2a8, 0.3));
  rail.position.set(6.0, 2.0, -2.3);
  group.add(rail);
  shadows(group, true);
  return { group, settings: { background: 0xd9e2e5, fog: null, floor: false, shadowSize: 8, ...LIGHT.studio } };
}

// ───────────── underwater dive sites ─────────────

const SITES = {
  quarry: { water: 0x4f6b55, sand: '#6d6a58', fogNear: 2, fogFar: 22, light: 0xc9d8b6 },
  temperate: { water: 0x2f6f86, sand: '#a99c7a', fogNear: 3, fogFar: 32, light: 0xbfe0ea },
  reef: { water: 0x2fa3b8, sand: '#e8dcbc', fogNear: 5, fogFar: 46, light: 0xe8fbff },
};

export function underwater(site) {
  const cfg = SITES[site];
  const group = new THREE.Group();
  const seabed = new THREE.Mesh(
    new THREE.CircleGeometry(80, 48),
    new THREE.MeshStandardMaterial({ map: speckle(cfg.sand, [shade(cfg.sand, -0.08), shade(cfg.sand, 0.06), shade(cfg.sand, -0.15)], { count: 5000, rMax: 1.3, repeat: [24, 24], seed: 12 }), roughness: 1 }),
  );
  seabed.rotation.x = -Math.PI / 2;
  seabed.receiveShadow = true;
  group.add(seabed);
  const r = rng(site.length * 17);
  const rockMat = new THREE.MeshStandardMaterial({ color: site === 'quarry' ? 0x55574f : 0x6f6a5f, roughness: 0.95, flatShading: true });
  for (let i = 0; i < (site === 'quarry' ? 16 : 9); i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + r() * 1.8, 0), rockMat);
    const a = r() * Math.PI * 2, d = 3.5 + r() * 12;
    rock.position.set(Math.cos(a) * d, 0.2, Math.sin(a) * d - 3);
    rock.scale.y = 0.55 + r() * 0.4;
    rock.rotation.set(r(), r(), r());
    group.add(rock);
  }
  const swaying = [];
  if (site === 'temperate') {
    // Kelp: tall ribbons that sway.
    const kelpMat = new THREE.MeshStandardMaterial({ color: 0x6b7a2e, roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 26; i++) {
      const h = 6 + r() * 7;
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.5, h, 1, 8), kelpMat);
      blade.geometry.translate(0, h / 2, 0);
      const a = r() * Math.PI * 2, d = 4 + r() * 12;
      blade.position.set(Math.cos(a) * d, 0, Math.sin(a) * d - 4);
      blade.rotation.y = r() * Math.PI;
      blade.userData.phase = r() * 6;
      swaying.push(blade);
      group.add(blade);
    }
  }
  if (site === 'reef') {
    const corals = [0xe07a5f, 0xf2cc8f, 0x81b29a, 0xb388c9, 0xf4a259];
    for (let i = 0; i < 22; i++) {
      const c = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: corals[i % corals.length], roughness: 0.7, flatShading: true });
      const kind = i % 3;
      if (kind === 0) {
        for (let k = 0; k < 6; k++) {
          const br = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.8 + r() * 0.8, 6), mat);
          br.position.set((r() - 0.5) * 0.6, 0.4, (r() - 0.5) * 0.6);
          br.rotation.set((r() - 0.5) * 0.9, 0, (r() - 0.5) * 0.9);
          c.add(br);
        }
      } else if (kind === 1) {
        const brain = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + r() * 0.5, 1), mat);
        brain.scale.y = 0.6;
        brain.position.y = 0.25;
        c.add(brain);
      } else {
        const fan = new THREE.Mesh(new THREE.CircleGeometry(0.9 + r() * 0.5, 12, 0, Math.PI), new THREE.MeshStandardMaterial({ color: corals[(i + 2) % corals.length], side: THREE.DoubleSide, roughness: 0.8, transparent: true, opacity: 0.9 }));
        fan.position.y = 0.05;
        fan.userData.phase = r() * 6;
        swaying.push(fan);
        c.add(fan);
      }
      const a = r() * Math.PI * 2, d = 2.8 + r() * 10;
      c.position.set(Math.cos(a) * d, 0, Math.sin(a) * d - 2.5);
      c.rotation.y = r() * Math.PI;
      group.add(c);
    }
  }
  // Sun rays from the surface.
  const rayMat = new THREE.MeshBasicMaterial({ color: cfg.light, transparent: true, opacity: site === 'quarry' ? 0.04 : 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  for (let i = 0; i < 7; i++) {
    const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.6, 22, 12, 1, true), rayMat);
    ray.position.set(-8 + i * 2.8 + r() * 1.5, 10, -6 + r() * 6);
    ray.rotation.z = 0.25;
    group.add(ray);
  }
  shadows(group, true);
  return {
    group,
    settings: {
      background: cfg.water,
      fog: { color: cfg.water, near: cfg.fogNear, far: cfg.fogFar },
      floor: false,
      shadowSize: 8,
      key: cfg.light, keyIntensity: site === 'quarry' ? 1.0 : 1.4, keyPos: [2, 14, 4],
      hemiSky: cfg.light, hemiGround: cfg.water, hemiIntensity: 0.7,
    },
    update(view, dt, t) {
      for (const s of swaying) s.rotation.z = Math.sin(t * 0.8 + s.userData.phase) * 0.12;
    },
  };
}
