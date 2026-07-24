/**
 * lab.js — The bench.
 *
 * Everything a real titration station has, built procedurally: casework, sink,
 * ring stand, glassware, reagent bottles, wash bottle, PPE, pH meter, notebook.
 * Objects that the student can act on are tagged with a pick id; sim.js decides
 * whether the current checklist step allows that action.
 */

import * as THREE from 'three';
import { box, cyl, mat, labelTexture } from './scene.js';
import { Vessel, ERLENMEYER_250, BEAKER_250, BEAKER_100, glassMaterial } from './vessel.js';

export const BENCH_Y = 0.90;      // work surface height
export const TILE_Y = BENCH_Y + 0.006;
export const STATION = { x: 0, z: 0 };   // under the burette tip

/** Where each movable vessel lives when it is not at the station. */
export const PARK = {
  flask: new THREE.Vector3(-0.255, TILE_Y, 0.135),
  waste: new THREE.Vector3(0.275, BENCH_Y, 0.115),
};

function tileTexture({ tile = 64, gap = 5, base = '#e9e6df', grout = '#b9b2a6', size = 1024 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = grout;
  g.fillRect(0, 0, size, size);
  g.fillStyle = base;
  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      g.fillRect(x + gap / 2, y + gap / 2, tile - gap, tile - gap);
    }
  }
  // faint mottling so the wall isn't flat
  for (let i = 0; i < 2400; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * size, Math.random() * size, 3, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function speckleTexture(base = '#22262b', size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) {
    const v = Math.random();
    g.fillStyle = v > 0.75 ? 'rgba(255,255,255,0.10)' : `rgba(0,0,0,${v * 0.25})`;
    const s = 1 + Math.random() * 2.5;
    g.fillRect(Math.random() * size, Math.random() * size, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 2);
  return t;
}

/** Attach a flat label to a cylindrical bottle. */
function bottleLabel(radius, lines, opts = {}) {
  const tex = labelTexture(lines, opts);
  const geo = new THREE.CylinderGeometry(
    radius * 1.008, radius * 1.008, opts.height ?? 0.042, 28, 1, true,
    -0.85, 1.7,
  );
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.75, side: THREE.DoubleSide,
  }));
  return m;
}

export function buildLab(stage) {
  const scene = stage.scene;
  const pickables = [];
  const items = {};

  const tag = (root, id, label, hint = '') => {
    root.traverse((o) => {
      if (o.isMesh) {
        o.userData.pickId = id;
        pickables.push(o);
      }
    });
    items[id] = { id, root, label, hint };
    return root;
  };

  // ---------------------------------------------------------------- room ---
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({
      map: tileTexture({ tile: 128, gap: 3, base: '#7d8288', grout: '#5d6268' }),
      roughness: 0.72,
    }),
  );
  floor.material.map.repeat.set(6, 6);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({
    map: tileTexture(), roughness: 0.5, metalness: 0.02,
  });
  wallMat.map.repeat.set(5, 3.2);
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.2), wallMat);
  backWall.position.set(0, 1.6, -0.62);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.2), wallMat.clone());
  sideWall.material.map = tileTexture();
  sideWall.material.map.repeat.set(2, 3.2);
  sideWall.position.set(-1.55, 1.6, 0.7);
  sideWall.rotation.y = Math.PI / 2;
  scene.add(sideWall);

  // ceiling light panels (visual only; lighting comes from scene.js)
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xf2f7ff, emissiveIntensity: 1.4, roughness: 0.9,
  });
  [-0.5, 0.7].forEach((x) => {
    const p = box(0.55, 0.02, 1.2, panelMat, x, 2.34, 0.05);
    p.castShadow = false;
    scene.add(p);
  });

  // ------------------------------------------------------------- casework ---
  const benchTopMat = new THREE.MeshStandardMaterial({
    map: speckleTexture('#1d2126'), roughness: 0.34, metalness: 0.06,
  });
  const cabinetMat = mat(0x2f3f52, { roughness: 0.6 });
  const drawerMat = mat(0x3a4d63, { roughness: 0.55 });
  const metalMat = mat(0xb9c1c9, { roughness: 0.3, metalness: 0.85 });

  scene.add(box(2.9, 0.055, 0.88, benchTopMat, 0, BENCH_Y - 0.0275, 0));
  scene.add(box(2.86, 0.012, 0.02, metalMat, 0, BENCH_Y - 0.058, 0.435)); // front trim
  scene.add(box(2.8, 0.75, 0.8, cabinetMat, 0, 0.475, -0.03));
  scene.add(box(2.7, 0.09, 0.72, mat(0x1b2430), 0, 0.055, -0.03));       // toe kick
  for (let i = 0; i < 6; i++) {
    const x = -1.15 + i * 0.46;
    scene.add(box(0.42, 0.2, 0.02, drawerMat, x, 0.74, 0.372));
    scene.add(box(0.42, 0.42, 0.02, drawerMat, x, 0.47, 0.372));
    scene.add(box(0.14, 0.016, 0.022, metalMat, x, 0.74, 0.386));
    scene.add(box(0.14, 0.016, 0.022, metalMat, x, 0.55, 0.386));
  }

  // ----------------------------------------------------------------- sink ---
  const sink = new THREE.Group();
  sink.position.set(1.02, BENCH_Y, 0.02);
  const basinMat = mat(0x9aa3ab, { roughness: 0.25, metalness: 0.7 });
  sink.add(box(0.34, 0.008, 0.28, basinMat, 0, -0.10, 0));          // bottom
  [[-0.17, 0, 0.008, 0.28], [0.17, 0, 0.008, 0.28]].forEach(([x, z, w, d]) => {
    sink.add(box(w, 0.1, d, basinMat, x, -0.05, z));
  });
  [[0, -0.14, 0.34, 0.008], [0, 0.14, 0.34, 0.008]].forEach(([x, z, w, d]) => {
    sink.add(box(w, 0.1, d, basinMat, x, -0.05, z));
  });
  const drain = cyl(0.016, 0.016, 0.006, mat(0x6e767e, { metalness: 0.8, roughness: 0.3 }));
  drain.position.set(0, -0.095, 0);
  sink.add(drain);
  const gooseneck = new THREE.Group();
  gooseneck.position.set(0, 0, -0.17);
  const riser = cyl(0.008, 0.009, 0.26, metalMat, 16);
  riser.position.y = 0.13;
  gooseneck.add(riser);
  const arm = cyl(0.007, 0.007, 0.15, metalMat, 16);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0, 0.255, 0.03);
  arm.rotation.x = Math.PI / 2;
  gooseneck.add(arm);
  const spout = cyl(0.006, 0.006, 0.05, metalMat, 16);
  spout.position.set(0, 0.235, 0.10);
  gooseneck.add(spout);
  const handle = cyl(0.006, 0.006, 0.05, mat(0x2a6fb0, { roughness: 0.4 }), 12);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.045, 0.24, 0);
  gooseneck.add(handle);
  sink.add(gooseneck);
  scene.add(sink);
  tag(sink, 'sink', 'Sink · aqueous waste', 'Neutralised rinsings go down here.');

  // ---------------------------------------------------------- ring stand ---
  const stand = new THREE.Group();
  stand.position.set(0, BENCH_Y, -0.185);
  const ironMat = mat(0x23272c, { roughness: 0.45, metalness: 0.5 });
  stand.add(box(0.21, 0.016, 0.14, ironMat, 0, 0.008, 0));
  const rod = cyl(0.0065, 0.0065, 0.95, mat(0xc2c8ce, { roughness: 0.28, metalness: 0.9 }), 18);
  rod.position.set(0, 0.49, 0);
  stand.add(rod);
  scene.add(stand);

  // burette clamp: boss head on the rod + two padded jaws reaching the burette
  const clamp = new THREE.Group();
  clamp.position.set(0, BENCH_Y + 0.62, -0.185);
  clamp.add(box(0.028, 0.05, 0.03, ironMat, 0, 0, 0));
  const clampArm = cyl(0.005, 0.005, 0.20, metalMat, 14);
  clampArm.rotation.x = Math.PI / 2;
  clampArm.position.set(0, 0, 0.095);
  clamp.add(clampArm);
  const jawMat = mat(0x1a1d21, { roughness: 0.85 });
  [-0.055, 0.055].forEach((dy) => {
    const jaw = new THREE.Mesh(
      new THREE.TorusGeometry(0.0115, 0.0035, 8, 20, Math.PI * 1.45),
      jawMat,
    );
    jaw.rotation.x = Math.PI / 2;
    jaw.rotation.z = -Math.PI / 2;
    jaw.position.set(0, dy, 0.185);
    clamp.add(jaw);
    const stem = box(0.006, 0.006, 0.03, ironMat, 0, dy, 0.165);
    clamp.add(stem);
  });
  const thumbscrew = cyl(0.009, 0.009, 0.008, metalMat, 14);
  thumbscrew.rotation.z = Math.PI / 2;
  thumbscrew.position.set(0.022, 0, 0.02);
  clamp.add(thumbscrew);
  scene.add(clamp);

  // ------------------------------------------------- white tile + flask ---
  const tile = box(0.15, 0.006, 0.15, mat(0xf6f6f2, { roughness: 0.22 }), 0, BENCH_Y + 0.003, 0);
  scene.add(tile);
  tag(tile, 'tile', 'White tile', 'A white background makes the first faint pink obvious.');

  const flask = new Vessel({
    name: 'flask',
    profile: ERLENMEYER_250,
    liquidColor: 0xdcecf8,
    segments: 56,
  });
  flask.group.position.copy(new THREE.Vector3(STATION.x, TILE_Y, STATION.z));
  scene.add(flask.group);
  // graduation marks + a "250 mL" style etch
  const flaskEtch = new THREE.Mesh(
    new THREE.PlaneGeometry(0.021, 0.013),
    new THREE.MeshStandardMaterial({
      map: labelTexture(['250 mL'], { w: 160, h: 110, bg: '#ffffff', fg: '#5b6670', band: false }),
      transparent: true, opacity: 0.4, roughness: 0.9,
    }),
  );
  flaskEtch.position.set(0, 0.049, 0.0322);
  flask.group.add(flaskEtch);
  tag(flask.group, 'flask', 'Erlenmeyer flask, 250 mL', 'Holds the HCl aliquot being titrated.');

  // ------------------------------------------------------------- beakers ---
  const naohBeaker = new Vessel({
    name: 'naohBeaker', profile: BEAKER_250, liquidColor: 0xdfeef7, segments: 40,
  });
  naohBeaker.group.position.set(-0.60, BENCH_Y, -0.10);
  naohBeaker.setVolume(190);
  const naohLabel = bottleLabel(0.0322, ['0.1000 M', 'NaOH', 'standardised'], {
    accent: '#1d6fa5', height: 0.05,
  });
  naohLabel.position.y = 0.055;
  naohBeaker.group.add(naohLabel);
  scene.add(naohBeaker.group);
  tag(naohBeaker.group, 'naohBeaker', 'Standardised NaOH · 0.1000 M',
    'The titrant. Its concentration is known to four figures.');

  const hclBeaker = new Vessel({
    name: 'hclBeaker', profile: BEAKER_250, liquidColor: 0xe4f0f7, segments: 40,
  });
  hclBeaker.group.position.set(-0.42, BENCH_Y, -0.10);
  hclBeaker.setVolume(160);
  const hclLabel = bottleLabel(0.0322, ['UNKNOWN', 'HCl', 'sample'], {
    accent: '#b02a37', height: 0.05,
  });
  hclLabel.position.y = 0.055;
  hclBeaker.group.add(hclLabel);
  scene.add(hclBeaker.group);
  tag(hclBeaker.group, 'hclBeaker', 'Unknown HCl sample',
    'Concentration unknown — that is what you are here to determine.');

  const waste = new Vessel({
    name: 'waste', profile: BEAKER_100, liquidColor: 0xdde9f2, segments: 36,
  });
  waste.group.position.copy(PARK.waste);
  scene.add(waste.group);
  tag(waste.group, 'waste', 'Waste beaker', 'Catches rinsings and the tip purge.');

  // --------------------------------------------------------- wash bottle ---
  const washBottle = new THREE.Group();
  washBottle.position.set(0.44, BENCH_Y, -0.09);
  const ldpe = new THREE.MeshPhysicalMaterial({
    color: 0xf2f7fb, roughness: 0.35, transmission: 0, transparent: true,
    opacity: 0.55, clearcoat: 0.8, side: THREE.DoubleSide,
  });
  const wbBody = cyl(0.031, 0.033, 0.115, ldpe, 32);
  wbBody.position.y = 0.0575;
  washBottle.add(wbBody);
  const wbWater = cyl(0.028, 0.030, 0.075, new THREE.MeshPhysicalMaterial({
    color: 0xd9ecf8, roughness: 0.15, transparent: true, opacity: 0.75,
  }), 28);
  wbWater.position.y = 0.038;
  washBottle.add(wbWater);
  const wbCap = cyl(0.019, 0.021, 0.02, mat(0x2b6ea8, { roughness: 0.4 }), 24);
  wbCap.position.y = 0.125;
  washBottle.add(wbCap);
  const wbTube = cyl(0.0022, 0.0022, 0.085, mat(0xdfe6ec, { roughness: 0.3 }), 10);
  wbTube.position.set(0, 0.17, 0);
  washBottle.add(wbTube);
  const wbBend = cyl(0.0022, 0.0022, 0.05, mat(0xdfe6ec, { roughness: 0.3 }), 10);
  wbBend.rotation.z = Math.PI / 2.1;
  wbBend.position.set(0.022, 0.208, 0);
  washBottle.add(wbBend);
  const wbLabel = bottleLabel(0.032, ['DI H₂O'], { accent: '#2b6ea8', height: 0.03 });
  wbLabel.position.y = 0.06;
  washBottle.add(wbLabel);
  scene.add(washBottle);
  tag(washBottle, 'washBottle', 'Wash bottle · deionised water',
    'Rinse the flask walls with it — water adds volume but no moles.');

  // ------------------------------------------------------ indicator bottle --
  const dropper = new THREE.Group();
  dropper.position.set(0.30, BENCH_Y, -0.14);
  const amber = new THREE.MeshPhysicalMaterial({
    color: 0x8a4a12, roughness: 0.15, transparent: true, opacity: 0.75,
    clearcoat: 1, side: THREE.DoubleSide,
  });
  const dBody = cyl(0.0155, 0.0165, 0.058, amber, 26);
  dBody.position.y = 0.029;
  dropper.add(dBody);
  const dNeck = cyl(0.008, 0.010, 0.012, amber, 20);
  dNeck.position.y = 0.064;
  dropper.add(dNeck);
  const dCap = cyl(0.0105, 0.0105, 0.022, mat(0x16181b, { roughness: 0.6 }), 20);
  dCap.position.y = 0.081;
  dropper.add(dCap);
  const dLabel = bottleLabel(0.016, ['phenol-', 'phthalein'], {
    accent: '#8e2f6b', height: 0.03, w: 220, h: 150,
  });
  dLabel.position.y = 0.03;
  dropper.add(dLabel);
  scene.add(dropper);
  tag(dropper, 'indicator', 'Phenolphthalein, 1% in ethanol',
    'Two or three drops. More does not make the endpoint sharper.');

  // ------------------------------------------------------------- pipette ---
  const pipette = new THREE.Group();
  const pipGlass = glassMaterial({ opacity: 0.3 });
  const pipProfile = [];
  // 25 mL class A volumetric pipette: stem, bulb, stem, delivery tip
  const pts = [
    [0.0011, 0], [0.0030, 0.006], [0.0032, 0.10], [0.0034, 0.135],
    [0.0110, 0.165], [0.0118, 0.205], [0.0110, 0.243], [0.0034, 0.272],
    [0.0032, 0.345], [0.0038, 0.352],
  ];
  pts.forEach(([r, y]) => pipProfile.push(new THREE.Vector2(r, y)));
  const pipMesh = new THREE.Mesh(new THREE.LatheGeometry(pipProfile, 28), pipGlass);
  pipMesh.renderOrder = 12;
  pipette.add(pipMesh);
  const pipRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.0033, 0.0004, 6, 20),
    new THREE.MeshBasicMaterial({ color: 0x30404d, transparent: true, opacity: 0.7 }),
  );
  pipRing.rotation.x = Math.PI / 2;
  pipRing.position.y = 0.300;      // the calibration mark
  pipette.add(pipRing);
  const pipLiquidMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2eff8, roughness: 0.15, transparent: true, opacity: 0.8,
    side: THREE.DoubleSide,
  });
  const pipLiquid = new THREE.Mesh(
    new THREE.LatheGeometry(pipProfile.map((v) => new THREE.Vector2(v.x * 0.94, v.y)), 24),
    pipLiquidMat,
  );
  pipLiquid.renderOrder = 4;
  pipLiquid.visible = false;
  pipette.add(pipLiquid);
  pipette.position.set(-0.155, BENCH_Y + 0.004, 0.245);
  pipette.rotation.z = Math.PI / 2;    // lying on the bench in a rest
  scene.add(pipette);
  const pipRest = box(0.05, 0.012, 0.03, mat(0x39424c), -0.155, BENCH_Y + 0.006, 0.185);
  scene.add(pipRest);
  tag(pipette, 'pipette', 'Volumetric pipette, 25.00 mL ± 0.03',
    'Delivers the aliquot. Condition it with the sample first.');

  // ---------------------------------------------------------- pipette bulb --
  const bulb = new THREE.Group();
  bulb.position.set(-0.06, BENCH_Y + 0.03, 0.245);
  const bulbBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 24, 18),
    mat(0x2c3238, { roughness: 0.75 }),
  );
  bulb.add(bulbBody);
  const bulbNeck = cyl(0.008, 0.008, 0.02, mat(0x2c3238, { roughness: 0.75 }), 14);
  bulbNeck.position.y = -0.03;
  bulb.add(bulbNeck);
  scene.add(bulb);
  tag(bulb, 'bulb', 'Pipette filler bulb', 'Never pipette by mouth.');

  // -------------------------------------------------------------- funnel ---
  const funnel = new THREE.Group();
  const funProfile = [
    new THREE.Vector2(0.0022, 0), new THREE.Vector2(0.0032, 0.0),
    new THREE.Vector2(0.0032, 0.030), new THREE.Vector2(0.0230, 0.062),
    new THREE.Vector2(0.0240, 0.065),
  ];
  const funMesh = new THREE.Mesh(new THREE.LatheGeometry(funProfile, 32), glassMaterial({ opacity: 0.3 }));
  funMesh.renderOrder = 12;
  funnel.add(funMesh);
  funnel.position.set(-0.235, BENCH_Y + 0.001, -0.235);
  scene.add(funnel);
  tag(funnel, 'funnel', 'Small funnel', 'For charging the burette without spills.');

  // ------------------------------------------------------------------ PPE ---
  const goggles = new THREE.Group();
  goggles.position.set(-0.86, BENCH_Y + 0.022, 0.14);
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0xdff1ff, roughness: 0.08, transparent: true, opacity: 0.45,
    clearcoat: 1, side: THREE.DoubleSide,
  });
  const frameMat = mat(0x20242a, { roughness: 0.7 });
  [-0.031, 0.031].forEach((x) => {
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.028, 20, 14), lensMat);
    lens.scale.set(1, 0.72, 0.5);
    lens.position.set(x, 0, 0);
    goggles.add(lens);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.004, 8, 22), frameMat);
    ring.scale.set(1, 0.74, 1);
    ring.position.set(x, 0, 0.004);
    goggles.add(ring);
  });
  goggles.add(box(0.026, 0.012, 0.012, frameMat, 0, 0, 0));
  const strap = cyl(0.004, 0.004, 0.10, frameMat, 10);
  strap.rotation.z = Math.PI / 2;
  strap.position.set(0, -0.004, -0.02);
  goggles.add(strap);
  scene.add(goggles);
  tag(goggles, 'goggles', 'Splash goggles', 'Chemical splash goggles, not safety glasses.');

  const gloveBox = new THREE.Group();
  gloveBox.position.set(-0.86, BENCH_Y, -0.12);
  gloveBox.add(box(0.13, 0.075, 0.075, mat(0x1f4f8a, { roughness: 0.75 }), 0, 0.0375, 0));
  const gloveOpen = box(0.06, 0.001, 0.03, mat(0x0d1b2c), 0, 0.0755, 0);
  gloveBox.add(gloveOpen);
  const gloveSheet = box(0.05, 0.014, 0.024, mat(0x6f7fd8, { roughness: 0.9 }), 0, 0.082, 0);
  gloveBox.add(gloveSheet);
  const gbLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.11, 0.05),
    new THREE.MeshStandardMaterial({
      map: labelTexture(['NITRILE', 'gloves M'], { accent: '#1f4f8a' }), roughness: 0.8,
    }),
  );
  gbLabel.position.set(0, 0.04, 0.0381);
  gloveBox.add(gbLabel);
  scene.add(gloveBox);
  tag(gloveBox, 'gloves', 'Nitrile gloves', 'Dilute acid and base still attack skin.');

  const coat = new THREE.Group();
  coat.position.set(-1.24, 1.42, -0.50);
  const coatMat = mat(0xf1f3f5, { roughness: 0.85 });
  coat.add(box(0.30, 0.52, 0.05, coatMat, 0, 0, 0));
  coat.add(box(0.08, 0.30, 0.045, coatMat, -0.17, 0.06, 0));
  coat.add(box(0.08, 0.30, 0.045, coatMat, 0.17, 0.06, 0));
  coat.add(box(0.05, 0.05, 0.02, mat(0xd8dde2), 0, 0.28, 0.02));
  const hook = cyl(0.004, 0.004, 0.06, metalMat, 10);
  hook.position.set(0, 0.31, -0.01);
  coat.add(hook);
  scene.add(coat);
  tag(coat, 'coat', 'Lab coat', 'Buttoned, sleeves down.');

  // ------------------------------------------------------------- pH meter ---
  const meter = new THREE.Group();
  meter.position.set(0.66, BENCH_Y, -0.18);
  meter.add(box(0.10, 0.055, 0.075, mat(0x2b3138, { roughness: 0.6 }), 0, 0.0275, 0));
  const screenTex = labelTexture(['pH  ----'], {
    w: 256, h: 96, bg: '#0b1c14', fg: '#7dffb0', band: false,
  });
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.075, 0.028),
    new THREE.MeshStandardMaterial({
      map: screenTex, emissive: 0x2f6b4a, emissiveIntensity: 0.6, roughness: 0.4,
    }),
  );
  screen.position.set(0, 0.04, 0.0378);
  screen.rotation.x = -0.35;
  meter.add(screen);
  scene.add(meter);
  const probe = new THREE.Group();
  probe.position.set(0.60, BENCH_Y + 0.02, -0.06);
  const probeBody = cyl(0.0055, 0.0055, 0.12, mat(0x30363d, { roughness: 0.5 }), 16);
  probeBody.position.y = 0.06;
  probe.add(probeBody);
  const probeGlass = new THREE.Mesh(
    new THREE.SphereGeometry(0.0055, 16, 12),
    glassMaterial({ opacity: 0.4 }),
  );
  probeGlass.position.y = 0.001;
  probe.add(probeGlass);
  scene.add(probe);
  tag(meter, 'phMeter', 'pH meter (training aid)',
    'Real titrations rely on the indicator; the meter is here to show you why it works.');
  tag(probe, 'probe', 'pH electrode', 'Click to move it in or out of the flask.');

  // ------------------------------------------------------------- notebook ---
  const notebook = new THREE.Group();
  notebook.position.set(0.62, BENCH_Y + 0.004, 0.235);
  notebook.add(box(0.20, 0.008, 0.15, mat(0xf7f5ee, { roughness: 0.9 }), 0, 0, 0));
  notebook.add(box(0.205, 0.004, 0.155, mat(0x8a2f3b, { roughness: 0.8 }), 0, -0.005, 0));
  const ruled = new THREE.Mesh(
    new THREE.PlaneGeometry(0.185, 0.135),
    new THREE.MeshStandardMaterial({
      map: labelTexture(['TRIAL DATA', '', 'V₁  ____', 'V₂  ____'], {
        w: 320, h: 240, bg: '#fdfcf6', fg: '#2b3d55', accent: '#2b3d55',
      }),
      roughness: 0.95,
    }),
  );
  ruled.rotation.x = -Math.PI / 2;
  ruled.position.y = 0.0045;
  notebook.add(ruled);
  scene.add(notebook);
  tag(notebook, 'notebook', 'Lab notebook', 'Record every reading as you take it.');

  // ------------------------------------------------------------- kimwipes ---
  const wipes = new THREE.Group();
  wipes.position.set(-0.86, BENCH_Y, 0.30);
  wipes.add(box(0.10, 0.05, 0.10, mat(0xe8e4d8, { roughness: 0.9 }), 0, 0.025, 0));
  wipes.add(box(0.04, 0.012, 0.02, mat(0xffffff, { roughness: 1 }), 0, 0.055, 0));
  scene.add(wipes);
  tag(wipes, 'wipes', 'Lint-free wipes', 'Dry the pipette tip and the outside of the burette.');

  // ------------------------------------------------------- hover highlight --
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.035, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0x5ad1ff, transparent: true, opacity: 0.75 }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.visible = false;
  halo.renderOrder = 20;
  scene.add(halo);

  return {
    pickables, items, halo,
    flask, naohBeaker, hclBeaker, waste,
    pipette, pipLiquid, pipLiquidMat, pipRing,
    funnel, washBottle, dropper, goggles, gloveBox, coat,
    phMeter: meter, phScreen: screen, probe, notebook, sink, faucetHandle: handle,
    vessels: [flask, naohBeaker, hclBeaker, waste],
  };
}
