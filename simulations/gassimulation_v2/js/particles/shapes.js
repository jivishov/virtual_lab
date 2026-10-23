/**
 * Container shapes for the particle engine, in local scene units, y up.
 *
 * Dimensions describe the region particle CENTERS may occupy. The renderer
 * draws each wall one particle radius further out. This keeps the space
 * available to particles exactly proportional to the model volume V.
 *
 *   cylinder { radius, length }  axis y, from y = 0 (closed end) to y = length (piston face)
 *   sphere   { radius }          centered at the origin
 *   torus    { major, minor }    ring in the xy plane, axis z (a tire seen from the side)
 *   capsule  { radius, length }  axis y, cylinder part from −length/2 to +length/2, round ends
 *   teardrop { s }               hot air balloon envelope, unit profile scaled by s: a dome on
 *                                top (y 0 to 1) tapering to a mouth at y = −1.3 (radius 0.17)
 *
 * sdf(p) < 0 inside, > 0 outside. normal(p) points outward.
 */

const hyp2 = (a, b) => Math.sqrt(a * a + b * b);
const hyp3 = (a, b, c) => Math.sqrt(a * a + b * b + c * c);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const EPS = 1e-9;

export const SHAPES = {
  cylinder: {
    sdf(p, d) {
      return Math.max(hyp2(p.x, p.z) - d.radius, -p.y, p.y - d.length);
    },
    normal(p, d, out) {
      const radial = hyp2(p.x, p.z) - d.radius;
      const bottom = -p.y;
      const top = p.y - d.length;
      if (radial >= bottom && radial >= top) {
        const r = hyp2(p.x, p.z) || EPS;
        return set(out, p.x / r, 0, p.z / r);
      }
      return bottom > top ? set(out, 0, -1, 0) : set(out, 0, 1, 0);
    },
    volume: (d) => Math.PI * d.radius ** 2 * d.length,
    area: (d) => 2 * Math.PI * d.radius * d.length + 2 * Math.PI * d.radius ** 2,
    bounds: (d) => ({ min: [-d.radius, 0, -d.radius], max: [d.radius, d.length, d.radius] }),
    ports: (d) => ({
      bottom: { pos: [0, 0, 0], dir: [0, 1, 0] },
      top: { pos: [0, d.length, 0], dir: [0, -1, 0] },
    }),
  },

  sphere: {
    sdf: (p, d) => hyp3(p.x, p.y, p.z) - d.radius,
    normal(p, d, out) {
      const r = hyp3(p.x, p.y, p.z) || EPS;
      return set(out, p.x / r, p.y / r, p.z / r);
    },
    volume: (d) => (4 / 3) * Math.PI * d.radius ** 3,
    area: (d) => 4 * Math.PI * d.radius ** 2,
    bounds: (d) => ({ min: [-d.radius, -d.radius, -d.radius], max: [d.radius, d.radius, d.radius] }),
    ports: (d) => ({
      bottom: { pos: [0, -d.radius, 0], dir: [0, 1, 0] },
      top: { pos: [0, d.radius, 0], dir: [0, -1, 0] },
    }),
  },

  torus: {
    sdf(p, d) {
      return hyp2(hyp2(p.x, p.y) - d.major, p.z) - d.minor;
    },
    normal(p, d, out) {
      const rxy = hyp2(p.x, p.y) || EPS;
      const cx = (p.x / rxy) * d.major;
      const cy = (p.y / rxy) * d.major;
      const dx = p.x - cx, dy = p.y - cy, dz = p.z;
      const len = hyp3(dx, dy, dz) || EPS;
      return set(out, dx / len, dy / len, dz / len);
    },
    volume: (d) => 2 * Math.PI ** 2 * d.major * d.minor ** 2,
    area: (d) => 4 * Math.PI ** 2 * d.major * d.minor,
    bounds: (d) => {
      const r = d.major + d.minor;
      return { min: [-r, -r, -d.minor], max: [r, r, d.minor] };
    },
    ports: (d) => ({
      // valve stem on the inner rim at the top
      top: { pos: [0, d.major - d.minor, 0], dir: [0, 1, 0] },
    }),
  },

  capsule: {
    sdf(p, d) {
      const cy = clamp(p.y, -d.length / 2, d.length / 2);
      return hyp3(p.x, p.y - cy, p.z) - d.radius;
    },
    normal(p, d, out) {
      const cy = clamp(p.y, -d.length / 2, d.length / 2);
      const dx = p.x, dy = p.y - cy, dz = p.z;
      const len = hyp3(dx, dy, dz) || EPS;
      return set(out, dx / len, dy / len, dz / len);
    },
    volume: (d) => Math.PI * d.radius ** 2 * d.length + (4 / 3) * Math.PI * d.radius ** 3,
    area: (d) => 2 * Math.PI * d.radius * d.length + 4 * Math.PI * d.radius ** 2,
    bounds: (d) => ({
      min: [-d.radius, -d.length / 2 - d.radius, -d.radius],
      max: [d.radius, d.length / 2 + d.radius, d.radius],
    }),
    ports: (d) => ({
      top: { pos: [0, d.length / 2 + d.radius, 0], dir: [0, -1, 0] },
      bottom: { pos: [0, -d.length / 2 - d.radius, 0], dir: [0, 1, 0] },
    }),
  },
};

// ── teardrop profile (unit scale) ──
const TD = { top: 1, bottom: -1.3, mouth: 0.17 };
function tdRadius(y) {
  if (y >= 0) return Math.sqrt(Math.max(0, 1 - y * y));
  const t = (y - TD.bottom) / -TD.bottom;
  return TD.mouth + (1 - TD.mouth) * Math.sin((Math.PI / 2) * t) ** 0.8;
}
function tdUnitSdf(x, y, z) {
  const rho = Math.hypot(x, z);
  if (y > TD.top) return Math.hypot(rho, y - TD.top);
  if (y < TD.bottom) return Math.max(TD.bottom - y, rho - TD.mouth);
  return Math.max(rho - tdRadius(y), TD.bottom - y);
}
function tdIntegrals() {
  let vol = 0, area = Math.PI * TD.mouth ** 2;
  const N = 4000, dy = (TD.top - TD.bottom) / N;
  for (let i = 0; i < N; i++) {
    const y0 = TD.bottom + i * dy, y1 = y0 + dy;
    const r0 = tdRadius(y0), r1 = tdRadius(y1);
    vol += Math.PI * ((r0 + r1) / 2) ** 2 * dy;
    area += Math.PI * (r0 + r1) * Math.hypot(dy, r1 - r0);
  }
  return { vol, area };
}
const TD_UNIT = tdIntegrals();
export const TEARDROP = { ...TD, radius: tdRadius, unitVolume: TD_UNIT.vol };

SHAPES.teardrop = {
  sdf: (p, d) => tdUnitSdf(p.x / d.s, p.y / d.s, p.z / d.s) * d.s,
  normal(p, d, out) {
    const e = 1e-3, s = d.s;
    const f = (x, y, z) => tdUnitSdf(x / s, y / s, z / s);
    const gx = f(p.x + e, p.y, p.z) - f(p.x - e, p.y, p.z);
    const gy = f(p.x, p.y + e, p.z) - f(p.x, p.y - e, p.z);
    const gz = f(p.x, p.y, p.z + e) - f(p.x, p.y, p.z - e);
    const len = Math.hypot(gx, gy, gz) || EPS;
    return set(out, gx / len, gy / len, gz / len);
  },
  volume: (d) => TD_UNIT.vol * d.s ** 3,
  area: (d) => TD_UNIT.area * d.s ** 2,
  bounds: (d) => ({ min: [-d.s, TD.bottom * d.s, -d.s], max: [d.s, TD.top * d.s, d.s] }),
  ports: (d) => ({
    bottom: { pos: [0, TD.bottom * d.s, 0], dir: [0, 1, 0] },
  }),
  center: () => [0, 0, 0],
};

function set(out, x, y, z) {
  out.x = x; out.y = y; out.z = z;
  return out;
}

export function getShape(name) {
  const s = SHAPES[name];
  if (!s) throw new Error(`Unknown shape "${name}"`);
  return s;
}

/** Uniform random point inside the shape, by rejection sampling. */
export function randomPoint(shape, d, rand, out = { x: 0, y: 0, z: 0 }) {
  const { min, max } = shape.bounds(d);
  for (let i = 0; i < 1000; i++) {
    out.x = min[0] + rand() * (max[0] - min[0]);
    out.y = min[1] + rand() * (max[1] - min[1]);
    out.z = min[2] + rand() * (max[2] - min[2]);
    if (shape.sdf(out, d) < 0) return out;
  }
  throw new Error('randomPoint: shape has no interior');
}
