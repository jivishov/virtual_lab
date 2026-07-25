/**
 * apparatus.js — Burette, stopcock, falling drops, and the local pink plume.
 *
 * Geometry is in burette-local metres:
 *    y = +0.520  the 0.00 mL graduation   (top of the scale)
 *    y =  0.000  the 50.00 mL graduation  (bottom of the scale)
 *    y = -0.105  the delivery tip
 * so a burette reading maps linearly onto a height, exactly as on the bench.
 */

import * as THREE from 'three';
import { cyl, mat } from './scene.js';
import { Vessel, glassMaterial } from './vessel.js';

export const SCALE_LEN = 0.520;       // metres spanned by 0.00 -> 50.00 mL
export const SCALE_ML = 50;
export const BARREL_R = 0.0055;       // inner radius -> 50 mL over SCALE_LEN
export const TIP_Y = -0.105;
export const DROP_ML = 0.048;         // ~21 drops per mL from a burette tip
export const MAX_FLOW = 2.4;          // mL/s, stopcock wide open

/**
 * Burette graduation decal: 0.1 mL divisions, numbered every mL.
 *
 * The canvas aspect ratio must match the physical strip it is mapped onto,
 * otherwise the numerals come out as slivers. The decal wraps GRAD_THETA
 * radians of a barrel of radius GRAD_R, so its real width is GRAD_R·GRAD_THETA
 * (16.25 mm) against a height of SCALE_LEN (520 mm) — hence 128 × 4096, which
 * gives a uniform 7.88 px/mm in both directions and stays within the 4096
 * texture limit of even modest mobile GPUs.
 */
export const GRAD_R = BARREL_R + 0.0019;
/** Blank margin above the 0.00 mark, where the class designation is etched. */
export const GRAD_PAD = 0.050;
export const STRIP_LEN = SCALE_LEN + GRAD_PAD;
export const GRAD_THETA = 2.406;

function graduationTexture() {
  const W = 128;
  const H = 4096;
  const PX_PER_MM = H / (STRIP_LEN * 1000);      // 7.186
  const mm = (v) => v * PX_PER_MM;
  const PAD = mm(GRAD_PAD * 1000);

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);

  // 0.00 mL sits below the top margin; 50.00 mL at the bottom of the strip
  const yFor = (ml) => PAD + (ml / SCALE_ML) * (H - PAD);
  const right = W - mm(1);                       // graduations right-aligned
  g.strokeStyle = 'rgba(26,36,46,0.95)';
  g.lineCap = 'butt';

  for (let i = 0; i <= SCALE_ML * 10; i++) {
    const ml = i / 10;
    const y = yFor(ml);
    const isWhole = i % 10 === 0;
    const isHalf = i % 5 === 0;
    const len = mm(isWhole ? 11 : isHalf ? 7 : 4.5);
    g.lineWidth = mm(isWhole ? 0.36 : isHalf ? 0.3 : 0.26);
    g.beginPath();
    g.moveTo(right - len, y);
    g.lineTo(right, y);
    g.stroke();
    if (isWhole) {
      // numerals sit to the left of the long lines, as on real glassware
      g.fillStyle = 'rgba(22,32,42,0.96)';
      g.font = `700 ${Math.round(mm(3))}px ui-monospace, "DejaVu Sans Mono", monospace`;
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      g.fillText(ml.toFixed(0), right - len - mm(0.7), y);
    }
  }

  // class designation, etched above the scale as it is on real glassware
  g.save();
  g.translate(W * 0.5, PAD - mm(2));
  g.rotate(-Math.PI / 2);
  g.fillStyle = 'rgba(22,32,42,0.8)';
  g.font = `700 ${Math.round(mm(2.6))}px ui-monospace, monospace`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText('50 mL  CLASS A  ±0.05  20 °C', 0, 0);
  g.restore();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * A white card with a black band, held behind the burette so the meniscus
 * stands out — the standard trick for reading to the last decimal place.
 */
function readingCardTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f6f1';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#14181c';
  g.fillRect(0, 64, 128, 64);           // band fills the lower half
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Burette {
  constructor(scene, { position = new THREE.Vector3(0, 1.18, 0) } = {}) {
    this.group = new THREE.Group();
    this.group.position.copy(position);
    scene.add(this.group);

    this._reading = SCALE_ML;      // starts empty
    this.hasBubble = false;

    // ---- barrel (glass + clipped liquid), including the filling zone -----
    const top = SCALE_LEN + 0.055;
    this.vessel = new Vessel({
      name: 'buretteBarrel',
      profile: [
        [0.0002, -0.020], [BARREL_R, -0.020], [BARREL_R, top],
        [BARREL_R + 0.0016, top + 0.004], [BARREL_R + 0.0026, top + 0.010],
      ],
      wall: 0.0015,
      segments: 40,
      liquidColor: 0xe3f1fa,
      liquidOpacity: 0.62,
    });
    this.group.add(this.vessel.group);

    // ---- graduation decal, facing the operator --------------------------
    const gradGeo = new THREE.CylinderGeometry(
      GRAD_R, GRAD_R, STRIP_LEN, 40, 1, true, -GRAD_THETA / 2, GRAD_THETA,
    );
    this.graduations = new THREE.Mesh(gradGeo, new THREE.MeshStandardMaterial({
      map: graduationTexture(),
      transparent: true,
      roughness: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    }));
    // strip runs from the 50.00 mL mark (local y = 0) up past the 0.00 mark
    this.graduations.position.y = STRIP_LEN / 2;
    this.graduations.renderOrder = 14;
    this.group.add(this.graduations);

    // ---- stopcock -------------------------------------------------------
    const ptfe = mat(0xf0f2f4, { roughness: 0.35 });
    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0105, 0.0105, 0.030, 24),
      glassMaterial({ opacity: 0.34 }),
    );
    housing.position.y = -0.037;
    housing.renderOrder = 12;
    this.group.add(housing);

    this.stopcock = new THREE.Group();
    this.stopcock.position.y = -0.037;
    const plug = cyl(0.0075, 0.0075, 0.040, ptfe, 20);
    plug.rotation.z = Math.PI / 2;
    this.stopcock.add(plug);
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.0075, 0.0125, 0.032), ptfe);
    paddle.position.set(0.0245, 0, 0.015);
    paddle.castShadow = true;
    this.stopcock.add(paddle);
    const knurl = cyl(0.0105, 0.0105, 0.006, ptfe, 18);
    knurl.rotation.z = Math.PI / 2;
    knurl.position.x = 0.0225;
    this.stopcock.add(knurl);
    this.group.add(this.stopcock);
    this.handleMesh = paddle;

    // ---- delivery tip ---------------------------------------------------
    const tipProfile = [
      new THREE.Vector2(0.0002, TIP_Y), new THREE.Vector2(0.0011, TIP_Y),
      new THREE.Vector2(0.0013, TIP_Y + 0.006), new THREE.Vector2(0.0026, TIP_Y + 0.030),
      new THREE.Vector2(0.0050, TIP_Y + 0.046), new THREE.Vector2(0.0062, TIP_Y + 0.047),
    ];
    const tip = new THREE.Mesh(new THREE.LatheGeometry(tipProfile, 24), glassMaterial({ opacity: 0.32 }));
    tip.renderOrder = 12;
    this.group.add(tip);

    // trapped air bubble: the classic systematic error
    this.bubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.0032, 14, 10),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.35,
        clearcoat: 1, side: THREE.DoubleSide,
      }),
    );
    this.bubble.scale.set(1, 1.5, 1);
    this.bubble.position.y = TIP_Y + 0.040;
    this.bubble.visible = false;
    this.bubble.renderOrder = 8;
    this.group.add(this.bubble);

    // pendant drop hanging on the tip
    this.pendant = new THREE.Mesh(
      new THREE.SphereGeometry(1, 14, 10),
      new THREE.MeshPhysicalMaterial({
        color: 0xdff0fb, roughness: 0.05, transparent: true, opacity: 0.85,
        clearcoat: 1, ior: 1.33,
      }),
    );
    this.pendant.visible = false;
    this.pendant.renderOrder = 9;
    this.group.add(this.pendant);
    this.pendantML = 0;

    // continuous stream, shown when the stopcock is more than a trickle open
    this.stream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0009, 0.0006, 1, 10, 1, true),
      new THREE.MeshPhysicalMaterial({
        color: 0xe8f5ff, roughness: 0.08, transparent: true, opacity: 0,
        clearcoat: 1, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    this.stream.renderOrder = 9;
    this.stream.visible = false;
    scene.add(this.stream);

    // reading aid, shown only at the meniscus camera station
    this.readingCard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.055, 0.055),
      new THREE.MeshBasicMaterial({ map: readingCardTexture(), side: THREE.DoubleSide }),
    );
    this.readingCard.position.set(0, 0, -0.028);
    this.readingCard.visible = false;
    this.group.add(this.readingCard);

    this.setStopcockOpen(0);
  }

  setEnvironment(env) { this.vessel.setEnvironment(env); }

  /** Hold the reading card behind the barrel, band just under the meniscus. */
  showReadingCard(on) {
    this.readingCard.visible = on;
    if (on) this._placeCard();
  }

  _placeCard() {
    if (!this.readingCard.visible) return;
    const y = SCALE_LEN * (1 - this._reading / SCALE_ML);
    this.readingCard.position.y = y - 0.0018;   // band top just below the surface
  }

  get reading() { return this._reading; }

  /** Setting the reading moves the meniscus; negative = charged above 0.00. */
  set reading(v) {
    this._reading = Math.max(-1.6, Math.min(SCALE_ML + 0.6, v));
    const y = SCALE_LEN * (1 - this._reading / SCALE_ML);
    this.vessel.setSurfaceLocalY(y, this._reading < SCALE_ML - 0.001);
    this._placeCard();
  }

  /** True while liquid remains above the 50.00 mL mark. */
  get hasLiquid() { return this._reading < SCALE_ML - 0.002; }

  get meniscusWorldY() { return this.group.position.y + SCALE_LEN * (1 - this._reading / SCALE_ML); }

  get tipWorld() {
    return new THREE.Vector3(
      this.group.position.x, this.group.position.y + TIP_Y, this.group.position.z,
    );
  }

  /** 0 = shut, 1 = wide open. Drives both the handle and the flow rate. */
  setStopcockOpen(f) {
    this.open = Math.max(0, Math.min(1, f));
    this.stopcock.rotation.x = this.open * (Math.PI / 2);
  }

  /** Valve characteristic: quadratic, so fine control lives near the bottom. */
  get flowRate() {
    if (!this.hasLiquid) return 0;
    return MAX_FLOW * this.open * this.open;
  }

  setPendant(ml) {
    this.pendantML = Math.max(0, ml);
    if (this.pendantML < 0.002) {
      this.pendant.visible = false;
      return;
    }
    // a 0.048 mL drop is ~2.25 mm across
    const r = 0.0011 + 0.0019 * Math.cbrt(this.pendantML / DROP_ML);
    this.pendant.visible = true;
    this.pendant.scale.set(r, r * 1.18, r);
    this.pendant.position.set(0, TIP_Y - r * 0.55, 0);
  }

  setLiquidRGB(rgb, opacity) { this.vessel.setLiquidRGB(rgb, opacity); }

  /** Draw the stream between the tip and the receiving surface. */
  updateStream(flow, targetY, t) {
    const show = flow > 0.14;
    this.stream.visible = show;
    if (!show) {
      this.stream.material.opacity = 0;
      return;
    }
    const tipY = this.group.position.y + TIP_Y;
    const len = Math.max(0.004, tipY - targetY);
    this.stream.scale.set(1, len, 1);
    this.stream.position.set(
      this.group.position.x + Math.sin(t * 34) * 0.00018,
      tipY - len / 2,
      this.group.position.z,
    );
    const w = 0.55 + 0.75 * Math.min(1, flow / MAX_FLOW);
    this.stream.scale.x = w;
    this.stream.scale.z = w;
    this.stream.material.opacity = 0.55 + 0.3 * Math.min(1, flow / MAX_FLOW);
  }

  setBubble(on) {
    this.hasBubble = on;
    this.bubble.visible = on;
  }
}

/** Pooled falling drops with real ballistics and an impact callback. */
export class DropSystem {
  constructor(scene, { count = 40 } = {}) {
    this.pool = [];
    this.active = [];
    const geo = new THREE.SphereGeometry(1, 12, 9);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xe8f5ff, roughness: 0.05, transparent: true, opacity: 0.9,
      clearcoat: 1, ior: 1.33,
    });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, material);
      m.visible = false;
      m.renderOrder = 9;
      scene.add(m);
      this.pool.push(m);
    }
    this.g = -9.81;
  }

  spawn(from, ml, targetY, onArrive) {
    const mesh = this.pool.pop();
    if (!mesh) { onArrive?.(ml); return; }   // never lose volume to the pool
    const r = 0.0011 + 0.0019 * Math.cbrt(Math.max(ml, 0.004) / DROP_ML);
    mesh.scale.setScalar(r);
    mesh.position.copy(from);
    mesh.visible = true;
    this.active.push({ mesh, v: -0.12, ml, targetY, onArrive, r });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const d = this.active[i];
      d.v += this.g * dt;
      d.mesh.position.y += d.v * dt;
      // stretch a little while falling, like a real drop
      const s = Math.min(2.2, 1 + Math.abs(d.v) * 0.35);
      d.mesh.scale.set(d.r / Math.sqrt(s), d.r * s, d.r / Math.sqrt(s));
      if (d.mesh.position.y <= d.targetY + d.r) {
        d.mesh.visible = false;
        this.pool.push(d.mesh);
        this.active.splice(i, 1);
        d.onArrive?.(d.ml);
      }
    }
  }
}

/**
 * The pink flash where a drop of base lands before it is mixed in — the single
 * most recognisable moment in a real titration, and the reason you swirl.
 */
export class Plume {
  constructor(parent) {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshPhysicalMaterial({
        color: 0xd4187e, roughness: 0.35, transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    parent.add(this.mesh);
    this.intensity = 0;
    this.radius = 0.004;
    this.y = 0.01;
  }

  /** A drop just landed: bloom the plume. */
  hit(surfaceLocalY, amount = 0.6) {
    this.intensity = Math.min(1.15, this.intensity + amount);
    this.y = Math.max(0.004, surfaceLocalY - 0.006);
    this.radius = 0.0045;
  }

  /** Swirling shears the plume out; standing still lets it linger. */
  update(dt, swirl) {
    if (this.intensity <= 0.001) {
      this.mesh.visible = false;
      this.intensity = 0;
      return;
    }
    const decay = 0.55 + 5.2 * swirl;
    this.intensity = Math.max(0, this.intensity - decay * dt);
    this.radius = Math.min(0.026, this.radius + (0.9 + 5 * swirl) * dt * 0.02);
    this.mesh.visible = true;
    this.mesh.position.set(0, this.y, 0);
    this.mesh.scale.set(this.radius, this.radius * 0.55, this.radius);
    this.mesh.material.opacity = Math.min(0.8, this.intensity * 0.72);
  }

  clear() { this.intensity = 0; this.mesh.visible = false; }
}

/** Expanding ring on the liquid surface where a drop lands. */
export class Ripples {
  constructor(parent, count = 6) {
    this.items = [];
    const geo = new THREE.RingGeometry(0.7, 1, 24);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide,
        depthWrite: false,
      }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.renderOrder = 8;
      parent.add(m);
      this.items.push({ mesh: m, t: 1, max: 0.02 });
    }
  }

  hit(localY, maxRadius = 0.02) {
    const it = this.items.find((i) => i.t >= 1);
    if (!it) return;
    it.t = 0;
    it.max = maxRadius;
    it.mesh.position.y = localY + 0.0004;
    it.mesh.visible = true;
  }

  update(dt) {
    for (const it of this.items) {
      if (it.t >= 1) continue;
      it.t = Math.min(1, it.t + dt * 2.6);
      const r = 0.002 + it.max * it.t;
      it.mesh.scale.setScalar(r);
      it.mesh.material.opacity = 0.42 * (1 - it.t);
      if (it.t >= 1) it.mesh.visible = false;
    }
  }
}
