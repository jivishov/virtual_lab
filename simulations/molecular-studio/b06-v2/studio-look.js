import {THREE as T} from '../vendor/three-bundle.js';

// Rendering looks shared by the two Molecular Studio viewers.
// 'kit' is the VSEPR lab's injection-moulded model kit: glossy, punchy highlights.
// 'cad' is the molecule builder's clean scientific rendering: satin, crisp, calm.
//
// The reflection room and the light rig are defined in camera space. Each frame
// a viewer calls rig.align(camera), which turns the rig and the environment with
// the eye, so the softbox highlights and the dark edge flags that outline light
// atoms against the light page backdrop stay put however the model is turned.
// Nothing here paints a background: the canvas stays transparent for the camera
// overlay, and the backdrop colour belongs to the page CSS.

// Camera space: +x right, +y up, +z toward the viewer.
const ROOMS = {
  kit: {
    walls: [.13, .14, .14],
    cards: [
      [[-5.5, 4.5, 6], [.1, 4.4, 3.4], [12, 11.6, 11]],     // key softbox, upper left
      [[0, 8, 3.5], [6.5, .1, 3], [5.2, 5.3, 5.4]],          // overhead box
      [[6.2, 1.2, 4.5], [.1, 5.5, .55], [7, 7.2, 7.5]],      // narrow strip, right
      [[-3.5, 3, -7], [.45, 6.5, .1], [3.6, 3.7, 3.8]],      // rim strips behind
      [[4.5, 4.2, -6.5], [.35, 6, .1], [3, 3.1, 3.2]],
      [[0, -6, 0], [30, .1, 30], [.025, .028, .028]],        // dark floor
    ],
  },
  cad: {
    walls: [.26, .275, .28],
    cards: [
      [[-5.5, 4, 6.5], [.1, 5, 4.5], [7.5, 7.4, 7.2]],       // broad key box, upper left
      [[0, 8, 3], [7, .1, 4], [3.6, 3.65, 3.7]],             // overhead box
      [[6.2, .5, 5], [.1, 4, 1.4], [3.2, 3.3, 3.4]],         // soft fill panel, right
      [[0, 4, -7], [7, 5, .1], [1.5, 1.55, 1.6]],            // even back wall
      [[0, -6, 0], [30, .1, 30], [.06, .065, .065]],         // dark floor
    ],
  },
};

export function studioRoom(renderer, look = 'kit') {
  const spec = ROOMS[look], room = new T.Scene();
  room.background = new T.Color(...spec.walls);
  for (const [at, size, rgb] of spec.cards) {
    const card = new T.Mesh(new T.BoxGeometry(...size), new T.MeshBasicMaterial({color: new T.Color(...rgb)}));
    card.position.set(...at);
    room.add(card);
  }
  const pmrem = new T.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(room, look === 'kit' ? .01 : .035, .1, 40, {size: 256}).texture;
  pmrem.dispose();
  room.children.forEach(o => {o.geometry.dispose(); o.material.dispose();});
  return texture;
}

const RIGS = {
  //       env  hemi  key   fill  rim
  kit: [.95, .42, 2.7, .45, 1.6],
  cad: [.85, .62, 2.25, .7, 1.05],
};

// Key from upper left front, low fill from the right, rim from behind. `level`
// dims the whole rig, e.g. for the small top-down parts-tray views.
export function lightRig(scene, environment, look = 'kit', {shadow = false, extent = 3.8, level = 1} = {}) {
  const [envLevel, hemiLevel, keyLevel, fillLevel, rimLevel] = RIGS[look].map(x => x * level);
  scene.environment = environment;
  scene.environmentIntensity = envLevel;
  const rig = new T.Group(), hemi = new T.HemisphereLight(0xf5f8ff, 0x353d3c, hemiLevel);
  const key = new T.DirectionalLight(0xfff3e2, keyLevel), keyDir = new T.Vector3(-4, 5, 6).normalize();
  const fill = new T.DirectionalLight(0xe2eeff, fillLevel), rim = new T.DirectionalLight(0xffffff, rimLevel);
  fill.position.set(5, -.6, 5);
  rim.position.set(3, 4.5, -6);
  for (const light of [key, fill, rim]) rig.add(light, light.target);
  scene.add(rig, hemi);
  let size = 0;
  const fit = reach => {
    if (Math.abs(reach - size) < .05 * size) return;
    size = reach;
    key.position.copy(keyDir).multiplyScalar(reach + 8);
    Object.assign(key.shadow.camera, {left: -reach, right: reach, top: reach, bottom: -reach, near: .5, far: 2 * reach + 16});
    key.shadow.camera.updateProjectionMatrix();
  };
  if (shadow) {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 3;
    key.shadow.bias = -.0004;
    key.shadow.normalBias = .018;
    key.shadow.intensity = look === 'kit' ? .8 : .55;
  }
  fit(extent);
  return {
    key, fit,
    align(camera, target) {
      rig.quaternion.copy(camera.quaternion);
      if (target) rig.position.copy(target);
      hemi.position.set(0, 1, 0).applyQuaternion(camera.quaternion);
      scene.environmentRotation.setFromQuaternion(camera.quaternion);
    },
  };
}

// Translucent plastic and electron density: denser at grazing edges, airier
// face-on, as a real translucent volume looks. Alpha-blended only, never
// transmission, so the room video behind the canvas still shows through.
export function translucent(material, {opacity = material.opacity, edge = 1.5, core = .6, max = .95} = {}) {
  material.transparent = true;
  material.opacity = opacity;
  material.depthWrite = false;
  const f = x => x.toFixed(3);
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
      `diffuseColor.a = min( ${f(max)}, diffuseColor.a * mix( ${f(edge)}, ${f(core)}, abs( dot( normal, geometryViewDir ) ) ) );
#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `b06-translucent-${edge}-${core}-${max}`;
  material.needsUpdate = true;
  return material;
}

// Soft contact shadow for a floating molecule: a camera-relative floor tilted
// toward the eye sits just under the lowest atom, and each atom drops a soft
// blob onto it, larger and fainter the higher it floats. Plain alpha blending
// over the transparent canvas, so it reads as a shadow on the page or the room.
export function contactShadow(capacity = 96, strength = .24) {
  const geometry = new T.PlaneGeometry(2, 2), fade = new T.InstancedBufferAttribute(new Float32Array(capacity), 1);
  geometry.setAttribute('fade', fade);
  const material = new T.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: {strength: {value: strength}},
    vertexShader: `attribute float fade;varying vec2 vUv;varying float vFade;
void main(){vUv=uv;vFade=fade;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float strength;varying vec2 vUv;varying float vFade;
void main(){float d=length(vUv-.5)*2.;float a=1.-smoothstep(0.,1.,d);gl_FragColor=vec4(0.,0.,0.,a*a*vFade*strength);}`,
  });
  const mesh = new T.InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  const up = new T.Vector3(), back = new T.Vector3(), normal = new T.Vector3(), floor = new T.Vector3();
  const spot = new T.Vector3(), turn = new T.Quaternion(), scale = new T.Vector3(), matrix = new T.Matrix4(), Z = new T.Vector3(0, 0, 1);
  return {
    mesh,
    update(atoms, camera, tilt = .4) {
      mesh.count = Math.min(atoms.length, capacity);
      if (!mesh.count) return;
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      back.set(0, 0, 1).applyQuaternion(camera.quaternion);
      normal.copy(up).multiplyScalar(Math.cos(tilt)).addScaledVector(back, Math.sin(tilt)).normalize();
      let low = Infinity, high = -Infinity;
      for (const a of atoms) {
        const h = a.position.dot(normal);
        low = Math.min(low, h - a.radius);
        high = Math.max(high, h + a.radius);
      }
      const span = Math.max(1, high - low);
      floor.copy(normal).multiplyScalar(low - .08);
      turn.setFromUnitVectors(Z, normal);
      for (let i = 0; i < mesh.count; i++) {
        const a = atoms[i], h = Math.max(0, a.position.clone().sub(floor).dot(normal));
        spot.copy(a.position).addScaledVector(normal, -h);
        const r = a.radius * 1.2 + h * .34;
        matrix.compose(spot, turn, scale.set(r, r, 1));
        mesh.setMatrixAt(i, matrix);
        fade.setX(i, T.MathUtils.clamp(1.15 - (h - a.radius) / (span + .4), .12, 1) * Math.min(1, a.radius / .3));
      }
      mesh.instanceMatrix.needsUpdate = true;
      fade.needsUpdate = true;
    },
  };
}
