/**
 * Kinetic particle engine. Renderer-agnostic: positions, velocities, wall impacts.
 *
 * The domain model is the source of truth. Each frame the caller passes the
 * model snapshot (observe(world)) to sync(), then calls step(dt). The engine:
 *   - keeps the sphere count equal to the model's count (gas enters at the
 *     inlet, leaves through the outlet, or escapes everywhere when a balloon bursts)
 *   - sizes the container from the model volume
 *   - sets the rms speed from √(T/M), with a Maxwell-Boltzmann spread kept by
 *     elastic collisions between spheres
 *   - reports wall impacts, with strength = momentum delivered
 *
 * Mutable by design: it runs every frame and feeds GPU buffers.
 */
import { getShape, randomPoint } from './shapes.js';
import { CONTAINERS } from './containers.js';

const M_AIR = 28.96;
const ESCAPE_TIME = 0.9;  // s, fade-out of gas leaving through a port
const RELEASE_TIME = 1.6; // s, fade-out after a burst
const MAX_IMPACTS = 512;
const MAX_SUBSTEPS = 40;
// Spheres bounce at 80% of their drawn diameter. Drawn spheres are vastly larger
// than real molecules, so full-size hard spheres would act like a real gas
// (excluded volume, the b in van der Waals) and push impact pressure 5 to 25%
// above ideal at high density. At 80% the error stays near 5% or below.
const CONTACT = 0.8;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand) {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

export class ParticleEngine {
  /**
   * @param {string} scenarioId
   * @param {{ seed?: number, slowMotion?: number, collisions?: boolean }} opts
   */
  constructor(scenarioId, opts = {}) {
    const spec = CONTAINERS[scenarioId];
    if (!spec) throw new Error(`No container for scenario "${scenarioId}"`);
    this.scenarioId = scenarioId;
    this.spec = spec;
    this.shape = getShape(spec.shape);
    this.radius = spec.particleRadius;
    this.rand = mulberry32(opts.seed ?? 1);
    this.slowMotion = opts.slowMotion ?? 1;
    this.collisions = opts.collisions ?? spec.collisions;
    this.particles = [];
    this.impacts = [];
    this.dims = null;
    this.mass = 1;
    this.vrms = 0;
    this.gasId = null;
    this.released = false;
    this.initialized = false;
    this.nextId = 0;
    this.pairHits = 0;
    this._n = { x: 0, y: 0, z: 0 };
    this.resetMeter();
  }

  /** Bring the engine in line with a model snapshot from observe(). */
  sync(view) {
    this.gasId = view.gas.id;
    this.mass = view.gas.M / M_AIR;
    this.dims = this.spec.dims(view.state);
    this.vrms = this.spec.rmsSpeed * view.particles.relativeSpeed * this.slowMotion;
    this.mix = view.particles.mix ?? null;
    if (view.failed === 'burst') {
      if (!this.released) this.release();
      return;
    }
    this.matchCount(view.particles.count);
    if (this.mix !== null) this.rebalance();
    this.initialized = true;
  }

  /** Mixed gases (air + water vapor): keep the share of 'air' spheres near the model's. */
  wantedAir(total) { return Math.round((this.mix ?? 0) * total); }

  rebalance() {
    // A few spheres per frame, so the change reads as mixing rather than a flash.
    for (let k = 0; k < 3; k++) {
      const gas = this.gas;
      const air = gas.filter((p) => p.tag === 'air');
      const want = this.wantedAir(gas.length);
      if (air.length > want) air[Math.floor(this.rand() * air.length)].tag = 'vapor';
      else if (air.length < want) {
        const vap = gas.filter((p) => p.tag !== 'air');
        if (vap.length) vap[Math.floor(this.rand() * vap.length)].tag = 'air';
      } else break;
    }
  }

  setSlowMotion(f) {
    if (f <= 0) throw new Error('slowMotion must be positive');
    const k = f / this.slowMotion;
    for (const p of this.particles) { p.vx *= k; p.vy *= k; p.vz *= k; }
    this.vrms *= k;
    this.slowMotion = f;
  }

  get gas() { return this.particles.filter((p) => p.state === 'gas'); }
  get count() { return this.particles.reduce((c, p) => c + (p.state === 'gas'), 0); }

  // ───────────── population ─────────────

  matchCount(target) {
    const gas = this.gas;
    if (target > gas.length) {
      const port = this.initialized && this.spec.inlet ? this.port(this.spec.inlet) : null;
      for (let i = gas.length; i < target; i++) this.spawn(port);
    } else if (target < gas.length) {
      const port = this.spec.outlet ? this.port(this.spec.outlet) : null;
      let leaving = gas;
      if (this.mix !== null) {
        // Remove the over-represented kind first.
        const extraAir = gas.filter((p) => p.tag === 'air').length - this.wantedAir(target);
        leaving = [...gas].sort((a, b) => ((b.tag === 'air') === extraAir > 0) - ((a.tag === 'air') === extraAir > 0));
      }
      if (port) {
        const [px, py, pz] = port.pos;
        const d2 = (p) => (p.x - px) ** 2 + (p.y - py) ** 2 + (p.z - pz) ** 2;
        leaving = [...leaving].sort((a, b) => d2(a) - d2(b));
      }
      for (let i = 0; i < gas.length - target; i++) this.escape(leaving[i], port);
    }
  }

  port(name) {
    const p = this.shape.ports(this.dims)[name];
    if (!p) throw new Error(`Shape "${this.spec.shape}" has no port "${name}"`);
    return p;
  }

  spawn(port) {
    const sigma = this.vrms / Math.sqrt(3);
    let tag = 'gas';
    if (this.mix !== null) {
      const gas = this.gas;
      tag = gas.filter((q) => q.tag === 'air').length < this.wantedAir(gas.length + 1) ? 'air' : 'vapor';
    }
    const p = {
      id: this.nextId++, state: 'gas', age: 0, alpha: 1, tag,
      x: 0, y: 0, z: 0,
      vx: gaussian(this.rand) * sigma, vy: gaussian(this.rand) * sigma, vz: gaussian(this.rand) * sigma,
    };
    if (port) {
      const [dx, dy, dz] = port.dir;
      const inset = Math.min(0.08, 0.5 * this.size());
      p.x = port.pos[0] + dx * inset + (this.rand() - 0.5) * 0.04;
      p.y = port.pos[1] + dy * inset + (this.rand() - 0.5) * 0.04;
      p.z = port.pos[2] + dz * inset + (this.rand() - 0.5) * 0.04;
      // Gas jets in through the port.
      const along = Math.abs(gaussian(this.rand)) * sigma + this.vrms;
      p.vx = dx * along + p.vx * 0.4;
      p.vy = dy * along + p.vy * 0.4;
      p.vz = dz * along + p.vz * 0.4;
      this.contain(p, false);
    } else {
      randomPoint(this.shape, this.dims, this.rand, p);
    }
    this.particles.push(p);
    return p;
  }

  escape(p, port) {
    p.state = 'escaping';
    p.age = 0;
    const speed = Math.max(this.vrms, 1e-3) * 1.4;
    let dx, dy, dz;
    if (port) {
      // Head for the port, then out through it.
      dx = port.pos[0] - port.dir[0] * 0.4 - p.x;
      dy = port.pos[1] - port.dir[1] * 0.4 - p.y;
      dz = port.pos[2] - port.dir[2] * 0.4 - p.z;
    } else {
      this.shape.normal(p, this.dims, this._n);
      ({ x: dx, y: dy, z: dz } = this._n);
    }
    const len = Math.hypot(dx, dy, dz) || 1;
    p.vx = (dx / len) * speed;
    p.vy = (dy / len) * speed;
    p.vz = (dz / len) * speed;
  }

  /** Balloon burst: every sphere flies free and fades. */
  release() {
    for (const p of this.particles) {
      if (p.state !== 'gas') continue;
      p.state = 'free';
      p.age = 0;
      this.shape.normal(p, this.dims, this._n);
      const kick = this.vrms * 0.8;
      p.vx += this._n.x * kick;
      p.vy += this._n.y * kick;
      p.vz += this._n.z * kick;
    }
    this.released = true;
  }

  size() {
    const d = this.dims;
    return d.radius ?? d.minor ?? 1;
  }

  // ───────────── dynamics ─────────────

  step(dt) {
    if (!(dt > 0) || !this.dims) return;
    let vmax = 0;
    for (const p of this.particles) vmax = Math.max(vmax, Math.abs(p.vx), Math.abs(p.vy), Math.abs(p.vz));
    const n = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil((vmax * Math.sqrt(3) * dt) / (0.4 * this.radius))));
    const h = dt / n;
    const area = this.shape.area(this.dims);
    for (let k = 0; k < n; k++) this.substep(h, area);
    this.thermostat();
    for (const p of this.particles) {
      if (p.state === 'gas') continue;
      p.age += dt;
      p.alpha = Math.max(0, 1 - p.age / (p.state === 'free' ? RELEASE_TIME : ESCAPE_TIME));
    }
    this.particles = this.particles.filter((p) => p.state === 'gas' || p.alpha > 0);
    this.meter.time += dt;
  }

  substep(h, area) {
    const gas = [];
    for (const p of this.particles) {
      p.x += p.vx * h;
      p.y += p.vy * h;
      p.z += p.vz * h;
      if (p.state === 'gas') {
        gas.push(p);
        this.contain(p, true, area);
      }
    }
    if (this.collisions) this.collide(gas);
  }

  /** Keep a sphere center inside the container; reflect it off the wall. */
  contain(p, record, area) {
    const n = this._n;
    for (let iter = 0; iter < 4; iter++) {
      const s = this.shape.sdf(p, this.dims);
      if (s <= 0) return;
      if (iter === 3) { this.pullInside(p); return; }
      this.shape.normal(p, this.dims, n);
      const push = s + 1e-7;
      p.x -= n.x * push;
      p.y -= n.y * push;
      p.z -= n.z * push;
      const vn = p.vx * n.x + p.vy * n.y + p.vz * n.z;
      if (vn > 0) {
        p.vx -= 2 * vn * n.x;
        p.vy -= 2 * vn * n.y;
        p.vz -= 2 * vn * n.z;
        if (record) {
          const impulse = 2 * this.mass * vn;
          this.meter.impulsePerArea += impulse / area;
          this.meter.hits += 1;
          if (this.impacts.length < MAX_IMPACTS) {
            this.impacts.push({
              x: p.x, y: p.y, z: p.z, nx: n.x, ny: n.y, nz: n.z,
              strength: impulse / (2 * this.spec.rmsSpeed * this.slowMotion),
            });
          }
        }
      }
    }
  }

  /** Last resort for shapes whose sdf is not an exact distance: bisect toward the center. */
  pullInside(p) {
    const c = this.shape.center ? this.shape.center(this.dims) : [0, 0, 0];
    const q = { x: c[0], y: c[1], z: c[2] };
    let lo = 0, hi = 1; // fraction of the way from center to p
    const at = (f, o) => { o.x = c[0] + (p.x - c[0]) * f; o.y = c[1] + (p.y - c[1]) * f; o.z = c[2] + (p.z - c[2]) * f; return o; };
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (this.shape.sdf(at(mid, q), this.dims) < 0) lo = mid; else hi = mid;
    }
    at(lo * 0.999, q);
    p.x = q.x; p.y = q.y; p.z = q.z;
    this.shape.normal(p, this.dims, this._n);
    const vn = p.vx * this._n.x + p.vy * this._n.y + p.vz * this._n.z;
    if (vn > 0) { p.vx -= 2 * vn * this._n.x; p.vy -= 2 * vn * this._n.y; p.vz -= 2 * vn * this._n.z; }
  }

  /** Elastic hard-sphere collisions between equal masses. */
  collide(gas) {
    const d = 2 * this.radius * CONTACT;
    const d2 = d * d;
    gas.sort((a, b) => a.x - b.x);
    for (let i = 0; i < gas.length; i++) {
      const a = gas[i];
      for (let j = i + 1; j < gas.length; j++) {
        const b = gas[j];
        const dx = b.x - a.x;
        if (dx > d) break;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const r2 = dx * dx + dy * dy + dz * dz;
        if (r2 >= d2 || r2 === 0) continue;
        const r = Math.sqrt(r2);
        const nx = dx / r, ny = dy / r, nz = dz / r;
        const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny + (a.vz - b.vz) * nz;
        if (approach <= 0) continue;
        a.vx -= approach * nx; a.vy -= approach * ny; a.vz -= approach * nz;
        b.vx += approach * nx; b.vy += approach * ny; b.vz += approach * nz;
        this.pairHits += 1;
      }
    }
  }

  /** Match the mean kinetic energy to the model temperature exactly. */
  thermostat() {
    let sum = 0;
    let count = 0;
    for (const p of this.particles) {
      if (p.state !== 'gas') continue;
      sum += p.vx * p.vx + p.vy * p.vy + p.vz * p.vz;
      count += 1;
    }
    if (!count || sum === 0) return;
    const k = Math.sqrt((count * this.vrms * this.vrms) / sum);
    for (const p of this.particles) {
      if (p.state !== 'gas') continue;
      p.vx *= k; p.vy *= k; p.vz *= k;
    }
  }

  // ───────────── outputs ─────────────

  drainImpacts() {
    const out = this.impacts;
    this.impacts = [];
    return out;
  }

  resetMeter() {
    this.meter = { impulsePerArea: 0, hits: 0, time: 0 };
  }

  /** Pressure measured from wall impacts since resetMeter(), in engine units. */
  measure() {
    const { impulsePerArea, hits, time } = this.meter;
    return { pressure: time > 0 ? impulsePerArea / time : 0, hitRate: time > 0 ? hits / time : 0, time };
  }

  /** Kinetic theory prediction for the same engine: P = N·m·⟨v²⟩ / 3V. */
  expectedPressure() {
    if (!this.dims) return 0;
    const V = this.shape.volume(this.dims);
    return V > 0 ? (this.count * this.mass * this.vrms * this.vrms) / (3 * V) : 0;
  }

  speeds() {
    return this.gas.map((p) => Math.hypot(p.vx, p.vy, p.vz));
  }
}
