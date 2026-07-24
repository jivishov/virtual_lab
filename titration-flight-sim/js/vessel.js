/**
 * vessel.js — Procedural glassware.
 *
 * A vessel is defined by its inner-wall profile (radius, height). From that
 * single description we derive the glass shells, the liquid body, and an exact
 * volume<->height table, so a conical flask fills the way a cone actually
 * fills: fast at the top, slow at the bottom.
 *
 * The liquid is a full-height solid clipped by a world-space horizontal plane.
 * That means the surface stays level even when the flask is tilted or swirled,
 * which is both cheaper and more correct than rebuilding geometry.
 */

import * as THREE from 'three';

/** Linear interpolation of the profile radius at height y. */
function radiusAt(profile, y) {
  if (y <= profile[0][1]) return profile[0][0];
  const last = profile[profile.length - 1];
  if (y >= last[1]) return last[0];
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1];
    const [r1, y1] = profile[i];
    if (y <= y1) {
      const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
      return r0 + (r1 - r0) * t;
    }
  }
  return last[0];
}

/** Volume of a conical frustum, m^3. */
function frustum(r0, r1, h) {
  return (Math.PI * h * (r0 * r0 + r0 * r1 + r1 * r1)) / 3;
}

/**
 * Sampled cumulative-volume table for a profile.
 * Volumes are in mL; heights in metres, measured from the profile base.
 */
export function volumeTable(profile, samples = 512) {
  const yMin = profile[0][1];
  const yMax = profile[profile.length - 1][1];
  const ys = new Float64Array(samples + 1);
  const vs = new Float64Array(samples + 1);
  let acc = 0;
  let prevR = radiusAt(profile, yMin);
  ys[0] = yMin;
  vs[0] = 0;
  for (let i = 1; i <= samples; i++) {
    const y = yMin + ((yMax - yMin) * i) / samples;
    const r = radiusAt(profile, y);
    acc += frustum(prevR, r, y - ys[i - 1]) * 1e6; // m^3 -> mL
    ys[i] = y;
    vs[i] = acc;
    prevR = r;
  }
  const capacityML = acc;

  return {
    yMin,
    yMax,
    capacityML,
    radiusAt: (y) => radiusAt(profile, y),
    /** mL contained below height y. */
    volumeAt(y) {
      if (y <= yMin) return 0;
      if (y >= yMax) return capacityML;
      let lo = 0;
      let hi = samples;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (ys[mid] <= y) lo = mid; else hi = mid;
      }
      const t = (y - ys[lo]) / (ys[hi] - ys[lo]);
      return vs[lo] + (vs[hi] - vs[lo]) * t;
    },
    /** Height of the surface when the vessel holds ml millilitres. */
    heightFor(ml) {
      if (ml <= 0) return yMin;
      if (ml >= capacityML) return yMax;
      let lo = 0;
      let hi = samples;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (vs[mid] <= ml) lo = mid; else hi = mid;
      }
      const dv = vs[hi] - vs[lo];
      const t = dv === 0 ? 0 : (ml - vs[lo]) / dv;
      return ys[lo] + (ys[hi] - ys[lo]) * t;
    },
  };
}

/**
 * Glassware is drawn as two shells (outer and inner wall), each double-sided,
 * so a line of sight crosses four surfaces. The per-surface opacity therefore
 * has to stay low or the vessel reads as frosted rather than clear; the sense
 * of glass comes from the clearcoat specular, not from opacity.
 */
const GLASS_DEFAULTS = {
  color: 0xe6f2ff,
  roughness: 0.05,
  metalness: 0,
  transparent: true,
  opacity: 0.13,
  side: THREE.DoubleSide,
  depthWrite: false,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
  ior: 1.5,
  envMapIntensity: 1.6,
};

export function glassMaterial(overrides = {}) {
  return new THREE.MeshPhysicalMaterial({ ...GLASS_DEFAULTS, ...overrides });
}

export class Vessel {
  /**
   * @param {object} opts
   * @param {Array<[number,number]>} opts.profile inner wall [radius, y] in metres
   * @param {number} [opts.wall] glass thickness
   * @param {number} [opts.segments] radial segments
   */
  constructor({
    name = 'vessel',
    profile,
    wall = 0.0016,
    segments = 48,
    glass = {},
    liquidColor = 0xdcecf8,
    liquidOpacity = 0.72,
  }) {
    this.name = name;
    this.profile = profile;
    this.table = volumeTable(profile);
    this.capacityML = this.table.capacityML;
    this.group = new THREE.Group();
    this.group.name = name;
    this._volumeML = 0;

    const inner = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0002), y));
    const outer = profile.map(([r, y], i) => new THREE.Vector2(
      Math.max(r + (i === 0 ? 0 : wall), 0.0002),
      y + (i === 0 ? -wall : 0),
    ));

    this.glassMat = glassMaterial(glass);
    const innerMesh = new THREE.Mesh(new THREE.LatheGeometry(inner, segments), this.glassMat);
    const outerMesh = new THREE.Mesh(new THREE.LatheGeometry(outer, segments), this.glassMat);
    innerMesh.renderOrder = 12;
    outerMesh.renderOrder = 13;
    this.group.add(innerMesh, outerMesh);
    this.glassMeshes = [innerMesh, outerMesh];

    // --- liquid body, clipped at the surface -----------------------------
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), this.table.yMin);
    const liqProfile = profile.map(([r, y]) => new THREE.Vector2(Math.max(r * 0.985, 0.0002), y));
    this.liquidMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(liquidColor),
      roughness: 0.14,
      metalness: 0,
      transparent: true,
      opacity: liquidOpacity,
      ior: 1.333,
      clearcoat: 0.5,
      side: THREE.DoubleSide,
      clippingPlanes: [this.clipPlane],
      envMapIntensity: 1.1,
    });
    this.liquid = new THREE.Mesh(new THREE.LatheGeometry(liqProfile, segments), this.liquidMat);
    this.liquid.renderOrder = 4;
    this.liquid.visible = false;
    this.group.add(this.liquid);

    // --- free surface -----------------------------------------------------
    this.surfaceMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(liquidColor),
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.9,
      clearcoat: 1,
      envMapIntensity: 1.6,
      side: THREE.DoubleSide,
    });
    this.surface = new THREE.Mesh(new THREE.CircleGeometry(1, segments), this.surfaceMat);
    this.surface.rotation.x = -Math.PI / 2;
    this.surface.renderOrder = 6;
    this.surface.visible = false;
    this.group.add(this.surface);

    // meniscus rim: the dark line students are taught to read
    this.rimMat = new THREE.MeshBasicMaterial({ color: 0x16222c, transparent: true, opacity: 0.78 });
    this.rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.085, 6, segments), this.rimMat);
    this.rim.rotation.x = -Math.PI / 2;
    this.rim.renderOrder = 7;
    this.rim.visible = false;
    this.group.add(this.rim);

    this.setVolume(0);
  }

  get volumeML() { return this._volumeML; }

  /** Set contents in mL; updates surface height, clip plane and surface disc. */
  setVolume(ml) {
    this._volumeML = Math.max(0, Math.min(ml, this.capacityML));
    this.setSurfaceLocalY(this.table.heightFor(this._volumeML), this._volumeML > 0.02);
  }

  /**
   * Drive the surface directly by height (used by the burette, whose reading
   * is the state variable rather than its contents).
   */
  setSurfaceLocalY(y, visible = true) {
    this._surfaceY = y;
    const show = visible && y > this.table.yMin + 1e-5;
    this.liquid.visible = show;
    this.surface.visible = show;
    this.rim.visible = show;
    if (!show) {
      this.clipPlane.constant = this.table.yMin - 1;
      return;
    }
    const worldY = this.worldYOf(y);
    this.clipPlane.constant = worldY;
    const r = Math.max(this.table.radiusAt(y) * 0.982, 0.0004);
    this.surface.position.y = y;
    this.surface.scale.setScalar(r);
    this.rim.position.y = y + 0.00012;
    this.rim.scale.set(r * 0.995, r * 0.995, 1);
  }

  /** Convert a local height to world Y (vessels are axis-aligned, no scaling). */
  worldYOf(localY) {
    const p = new THREE.Vector3();
    this.group.getWorldPosition(p);
    return p.y + localY;
  }

  get surfaceLocalY() { return this._surfaceY ?? this.table.yMin; }
  get surfaceWorldY() { return this.worldYOf(this.surfaceLocalY); }

  /** Recompute the clip plane after the vessel has been moved. */
  refreshClip() {
    if (this.liquid.visible) this.clipPlane.constant = this.surfaceWorldY;
  }

  /**
   * @param {number[]} rgb sRGB triple
   * @param {number} [opacity]
   * @param {number} [glow] small self-illumination, 0..0.25. A real solution is
   *   lit by light scattered from every direction; with three lights and an
   *   environment map, a coloured solution viewed side-on through glass comes
   *   out darker than it looks on the bench. This compensates for that.
   */
  setLiquidRGB([r, g, b], opacity, glow = 0) {
    // authored as sRGB so the pink reads the way it was picked
    this.liquidMat.color.setRGB(r, g, b, THREE.SRGBColorSpace);
    this.surfaceMat.color.setRGB(
      Math.min(1, r * 1.05), Math.min(1, g * 1.05), Math.min(1, b * 1.05),
      THREE.SRGBColorSpace,
    );
    this.liquidMat.emissive.setRGB(r * glow, g * glow, b * glow, THREE.SRGBColorSpace);
    if (opacity != null) {
      this.liquidMat.opacity = opacity;
      this.surfaceMat.opacity = Math.min(0.95, opacity + 0.15);
    }
  }

  setEnvironment(env) {
    this.glassMat.envMap = env;
    this.liquidMat.envMap = env;
    this.surfaceMat.envMap = env;
  }
}

// ---------------------------------------------------------------------------
// Standard glassware profiles (metres). Capacities are checked by volumeTable,
// so these match real catalogue dimensions closely enough to titrate with.
// ---------------------------------------------------------------------------

/** 250 mL Erlenmeyer flask. */
export const ERLENMEYER_250 = [
  [0.0002, 0], [0.0400, 0], [0.0424, 0.0055], [0.0424, 0.0125],
  [0.0392, 0.0230], [0.0336, 0.0400], [0.0278, 0.0570], [0.0218, 0.0730],
  [0.0170, 0.0840], [0.0132, 0.0910], [0.0118, 0.0965], [0.0116, 0.1330],
  [0.0126, 0.1405], [0.0146, 0.1440],
];

/** 250 mL low-form beaker (spout omitted). */
export const BEAKER_250 = [
  [0.0002, 0], [0.0300, 0], [0.0322, 0.0035], [0.0322, 0.0900], [0.0334, 0.0940],
];

/** 100 mL beaker, used for waste and rinsings. */
export const BEAKER_100 = [
  [0.0002, 0], [0.0215, 0], [0.0235, 0.0030], [0.0235, 0.0680], [0.0246, 0.0710],
];
