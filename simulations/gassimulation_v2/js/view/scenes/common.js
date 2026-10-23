/** Small helpers shared by the scenes. */
import * as THREE from 'three';

export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** Mark meshes in a subtree as shadow casters (and receivers). */
export function shadows(obj, receive = false) {
  obj.traverse((o) => {
    if (o.isMesh && !o.material.transparent) {
      o.castShadow = true;
      o.receiveShadow = receive;
    }
  });
  return obj;
}

/** Revolve a 2D profile [[r, y], ...] around the y axis. */
export function lathe(profile, material, segments = 96) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  return new THREE.Mesh(new THREE.LatheGeometry(pts, segments), material);
}

/** Arc of points, angles in radians, for building rounded profiles. */
export function arc(cx, cy, r, a0, a1, steps = 12) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

export function tube(points, radius, material, segments = 64) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 12, false), material);
}

/** Soft round puff texture for fog, steam and mist. */
let puffTex = null;
export function puffTexture() {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  puffTex = new THREE.CanvasTexture(c);
  puffTex.colorSpace = THREE.SRGBColorSpace;
  return puffTex;
}

/**
 * A pool of drifting puffs (fog, steam, mist). emit() spawns; update() animates.
 * Each puff: rises, spreads, fades.
 */
export class Puffs {
  constructor(count = 40, { color = 0xffffff, opacity = 0.5, size = 0.5 } = {}) {
    this.group = new THREE.Group();
    this.items = [];
    this.size = size;
    for (let i = 0; i < count; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false;
      m.renderOrder = 5;
      this.group.add(m);
      this.items.push({ m, life: 0, max: 1, vx: 0, vy: 0, vz: 0, op: opacity });
    }
  }

  emit(x, y, z, { vx = 0, vy = 0.3, vz = 0, life = 2, opacity } = {}) {
    const it = this.items.find((p) => p.life <= 0);
    if (!it) return;
    it.life = it.max = life;
    it.vx = vx; it.vy = vy; it.vz = vz;
    if (opacity !== undefined) it.op = opacity;
    it.m.position.set(x, y, z);
    it.m.visible = true;
  }

  update(dt) {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      const k = 1 - it.life / it.max;
      it.m.position.x += it.vx * dt;
      it.m.position.y += it.vy * dt;
      it.m.position.z += it.vz * dt;
      const s = this.size * (0.6 + 1.6 * k);
      it.m.scale.set(s, s, s);
      it.m.material.opacity = it.op * Math.sin(Math.PI * Math.min(1, k * 1.2)) * (it.life > 0 ? 1 : 0);
      if (it.life <= 0) it.m.visible = false;
    }
  }
}

/** Rising bubbles inside a liquid column. */
export class Bubbles {
  constructor(count, { radius = 0.04, color = 0xffffff } = {}) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false }),
      count,
    );
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    this.items = Array.from({ length: count }, () => ({ alive: false, x: 0, y: 0, z: 0, v: 0, r: radius }));
    this.mesh.count = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  update(dt, { rate, floor, top, radius, size = 0.04 }) {
    // spawn
    let spawn = rate * dt;
    for (const b of this.items) {
      if (spawn <= 0) break;
      if (b.alive) continue;
      if (spawn < 1 && Math.random() > spawn) break;
      spawn -= 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      Object.assign(b, { alive: true, x: Math.cos(a) * r, y: floor, z: Math.sin(a) * r, v: 0.6 + Math.random() * 0.8, r: size * (0.5 + Math.random()) });
    }
    let i = 0;
    for (const b of this.items) {
      if (!b.alive) continue;
      b.y += b.v * dt;
      b.x += Math.sin(b.y * 9 + b.r * 50) * 0.002;
      if (b.y > top) { b.alive = false; continue; }
      this._m.compose(this._p.set(b.x, b.y, b.z), this._q, this._s.set(b.r, b.r, b.r));
      this.mesh.setMatrixAt(i++, this._m);
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
