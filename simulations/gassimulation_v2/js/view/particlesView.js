/**
 * Draws the particle engine: spheres colored by speed, and brief flashes
 * where spheres strike the wall. Both live in the scene's particle root,
 * which carries the engine's local coordinates.
 */
import * as THREE from 'three';

const CAPACITY = 280;
const FLASH_POOL = 220;
const FLASH_LIFE = 0.22; // s

// Speed ramp, slow to fast: indigo, blue, amber, orange.
// Kept clear of the role colors (teal = you change, red = responds).
const RAMP = [
  [0.0, new THREE.Color(0x24358c)],
  [0.7, new THREE.Color(0x4f70d8)],
  [1.25, new THREE.Color(0xe9a23b)],
  [2.0, new THREE.Color(0xef7a2a)],
];

export function speedColor(f, out = new THREE.Color()) {
  const x = Math.min(2, Math.max(0, f));
  for (let i = 1; i < RAMP.length; i++) {
    if (x <= RAMP[i][0]) {
      const [x0, c0] = RAMP[i - 1];
      const [x1, c1] = RAMP[i];
      return out.copy(c0).lerp(c1, (x - x0) / (x1 - x0));
    }
  }
  return out.copy(RAMP[RAMP.length - 1][1]);
}

export class ParticlesView {
  constructor() {
    const geom = new THREE.SphereGeometry(1, 14, 10);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0, emissive: 0x111827, emissiveIntensity: 0.4, fog: false });
    this.spheres = new THREE.InstancedMesh(geom, mat, CAPACITY);
    this.spheres.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.spheres.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 3), 3);
    this.spheres.frustumCulled = false;
    this.spheres.renderOrder = 1;

    // A ring reads as an impact; a filled disc reads as glare on glass.
    const fgeom = new THREE.RingGeometry(0.62, 1, 28);
    const fmat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      toneMapped: false, side: THREE.DoubleSide, fog: false,
    });
    this.flashes = new THREE.InstancedMesh(fgeom, fmat, FLASH_POOL);
    this.flashes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.flashes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FLASH_POOL * 3), 3);
    this.flashes.frustumCulled = false;
    this.flashes.renderOrder = 3;
    this.flashes.count = 0;

    this.pool = [];
    this.root = null;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this._z = new THREE.Vector3(0, 0, 1);
    this.flashColor = new THREE.Color(0xffa646);
    this.airColor = new THREE.Color(0xc3cbd2); // air in a steam mixture
  }

  attach(root) {
    this.root?.remove(this.spheres, this.flashes);
    this.root = root;
    root.add(this.spheres, this.flashes);
    this.pool = [];
  }

  update(engine, dt) {
    const r = engine.radius;
    const vr = engine.vrms || 1;
    const q = this._q.identity();
    let i = 0;
    for (const p of engine.particles) {
      if (i >= CAPACITY) break;
      const fade = p.state === 'gas' ? 1 : p.alpha;
      const s = r * (0.35 + 0.65 * fade);
      this._m.compose(this._v.set(p.x, p.y, p.z), q, this._s.set(s, s, s));
      this.spheres.setMatrixAt(i, this._m);
      if (p.tag === 'air') this._c.copy(this.airColor).multiplyScalar(0.8 + 0.25 * Math.min(1.6, Math.hypot(p.vx, p.vy, p.vz) / vr));
      else speedColor(Math.hypot(p.vx, p.vy, p.vz) / vr, this._c);
      if (fade < 1) this._c.multiplyScalar(0.4 + 0.6 * fade);
      this.spheres.setColorAt(i, this._c);
      i++;
    }
    this.spheres.count = i;
    this.spheres.instanceMatrix.needsUpdate = true;
    this.spheres.instanceColor.needsUpdate = true;

    // Wall flashes. Size and brightness grow with the momentum delivered.
    for (const f of engine.drainImpacts()) {
      if (this.pool.length >= FLASH_POOL) this.pool.shift();
      this.pool.push({ ...f, life: 1, size: r * (0.9 + 1.1 * Math.sqrt(Math.min(2, f.strength))) });
    }
    let k = 0;
    for (const f of this.pool) {
      f.life -= dt / FLASH_LIFE;
      if (f.life <= 0) continue;
      this._v.set(f.nx, f.ny, f.nz);
      q.setFromUnitVectors(this._z, this._v);
      const grow = f.size * (0.6 + 0.6 * (1 - f.life));
      this._m.compose(this._s.set(f.x + f.nx * r * 1.05, f.y + f.ny * r * 1.05, f.z + f.nz * r * 1.05), q, this._v.set(grow, grow, grow));
      this.flashes.setMatrixAt(k, this._m);
      this.flashes.setColorAt(k, this._c.copy(this.flashColor).multiplyScalar(0.75 * f.life * Math.min(1, 0.3 + 0.5 * f.strength)));
      k++;
    }
    this.pool = this.pool.filter((f) => f.life > 0);
    this.flashes.count = k;
    this.flashes.instanceMatrix.needsUpdate = true;
    if (this.flashes.instanceColor) this.flashes.instanceColor.needsUpdate = true;
  }
}
