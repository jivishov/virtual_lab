/**
 * Instruments and printed surfaces, drawn on canvas textures.
 * Fonts must be loaded before these are built (main.js awaits document.fonts).
 */
import * as THREE from 'three';
import { chrome, rubber, glass } from './materials.js';

export const FONT = '"Barlow Semi Condensed", "Barlow", system-ui, sans-serif';
const NEEDLE = '#c2362b';

function canvasTexture(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas, ctx: canvas.getContext('2d'), tex };
}

/**
 * A flat screen or printed plate that redraws when its data changes.
 * draw(ctx, w, h, data) paints the canvas.
 */
export class Screen {
  constructor({ width, height, res = 360, draw, transparent = false, emissive = true }) {
    const { canvas, ctx, tex } = canvasTexture(Math.round(width * res), Math.round(height * res));
    this.canvas = canvas;
    this.ctx = ctx;
    this.tex = tex;
    this.drawFn = draw;
    this.last = undefined;
    const mat = emissive
      ? new THREE.MeshBasicMaterial({ map: tex, transparent, toneMapped: false })
      : new THREE.MeshStandardMaterial({ map: tex, transparent, roughness: 0.5 });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  }

  set(data) {
    const key = JSON.stringify(data);
    if (key === this.last) return;
    this.last = key;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawFn(this.ctx, this.canvas.width, this.canvas.height, data);
    this.tex.needsUpdate = true;
  }
}

/** Static text plate, for printed labels on apparatus. */
export function textPlate(text, { height = 0.18, color = '#26323b', weight = 600, align = 'center', bg = null, padding = 0.15 } = {}) {
  const res = 300;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `${weight} ${Math.round(height * res * 0.78)}px ${FONT}`;
  const textW = probe.measureText(text).width / res;
  const width = textW + height * padding * 2;
  const screen = new Screen({
    width, height, res, transparent: !bg, emissive: false,
    draw(ctx, w, h) {
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
      ctx.fillStyle = color;
      ctx.font = `${weight} ${Math.round(h * 0.78)}px ${FONT}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = align;
      ctx.fillText(text, align === 'center' ? w / 2 : height * padding * res, h * 0.54);
    },
  });
  screen.set(text);
  screen.mesh.material.depthWrite = !!bg;
  return screen.mesh;
}

/**
 * Bourdon-tube pressure gauge: enamel dial, dual scale, red needle, chrome bezel
 * in a rubber boot. set(fraction) turns the needle; fraction comes from the model's
 * instrument reading, so the needle has the damped overshoot of a real gauge.
 */
export class AnalogGauge {
  constructor({ min, max, major, minor, outerUnit, inner = null, zones = [], caption = '', radius = 0.6 }) {
    this.min = min;
    this.max = max;
    this.start = (225 * Math.PI) / 180;
    this.sweep = (270 * Math.PI) / 180;
    this.group = new THREE.Group();

    const { canvas, ctx, tex } = canvasTexture(1024, 1024);
    this.drawDial(ctx, canvas.width, { min, max, major, minor, outerUnit, inner, zones, caption });
    tex.needsUpdate = true;
    const face = new THREE.Mesh(new THREE.CircleGeometry(radius, 96), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }));
    this.group.add(face);

    const bezel = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.03, radius * 0.07, 20, 96), chrome());
    bezel.position.z = 0.02;
    const boot = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.16, radius * 1.2, radius * 0.45, 64), rubber(0x1f2224));
    boot.rotation.x = Math.PI / 2;
    boot.position.z = -radius * 0.24;
    const cover = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.0, 64), glass({ opacity: 0.1 }));
    cover.position.z = 0.06;
    cover.renderOrder = 4;
    this.group.add(bezel, boot, cover);

    this.pivot = new THREE.Group();
    this.pivot.position.z = 0.03;
    const needleMat = new THREE.MeshStandardMaterial({ color: NEEDLE, roughness: 0.4 });
    const needle = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.035, radius * 0.86, 0.01), needleMat);
    needle.position.y = radius * 0.33;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.06, radius * 0.22, 0.01), needleMat);
    tail.position.y = -radius * 0.1;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.07, radius * 0.07, 0.03, 24), chrome());
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 0.01;
    this.pivot.add(needle, tail, hub);
    this.group.add(this.pivot);
    this.set(0);
  }

  angleAt(f) {
    return this.start - f * this.sweep;
  }

  set(fraction) {
    const f = Math.min(1.02, Math.max(-0.02, fraction));
    // Needle mesh points along +y; dial angles are measured from +x.
    this.pivot.rotation.z = this.angleAt(f) - Math.PI / 2;
  }

  drawDial(ctx, S, { min, max, major, minor, outerUnit, inner, zones, caption }) {
    const c = S / 2;
    const R = S * 0.47;
    const grad = ctx.createRadialGradient(c, c * 0.8, S * 0.05, c, c, R);
    grad.addColorStop(0, '#fbfbf8');
    grad.addColorStop(1, '#eceee9');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.fill();
    const ang = (v) => this.start - ((v - min) / (max - min)) * this.sweep;
    const at = (a, r) => [c + r * Math.cos(a), c - r * Math.sin(a)];

    for (const z of zones) {
      ctx.strokeStyle = z.color;
      ctx.lineWidth = S * 0.035;
      ctx.beginPath();
      ctx.arc(c, c, R * 0.86, -ang(z.from), -ang(z.to));
      ctx.stroke();
    }
    ctx.strokeStyle = '#26323b';
    for (let v = min; v <= max + 1e-9; v += minor) {
      const isMajor = Math.abs((v - min) / major - Math.round((v - min) / major)) < 1e-6;
      const a = ang(v);
      const [x0, y0] = at(a, R * 0.9);
      const [x1, y1] = at(a, R * (isMajor ? 0.77 : 0.83));
      ctx.lineWidth = isMajor ? S * 0.009 : S * 0.004;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      if (isMajor) {
        ctx.fillStyle = '#1e2b35';
        ctx.font = `600 ${Math.round(S * 0.075)}px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const [tx, ty] = at(a, R * 0.64);
        ctx.fillText(String(v / (outerUnit.divide ?? 1)), tx, ty);
      }
    }
    if (inner) {
      ctx.fillStyle = '#5b6873';
      ctx.font = `500 ${Math.round(S * 0.042)}px ${FONT}`;
      for (let v = 0; v <= inner.max + 1e-9; v += inner.step) {
        const a = ang(min + (v / inner.max) * inner.span * (max - min));
        if ((v / inner.max) * inner.span > 1.0001) break;
        const [tx, ty] = at(a, R * 0.47);
        ctx.fillText(String(v), tx, ty);
      }
      ctx.fillText(inner.label, c, c + R * 0.28);
    }
    ctx.fillStyle = '#1e2b35';
    ctx.font = `700 ${Math.round(S * 0.06)}px ${FONT}`;
    ctx.fillText(outerUnit.label, c, c + R * 0.5);
    if (caption) {
      ctx.fillStyle = '#5b6873';
      ctx.font = `500 ${Math.round(S * 0.038)}px ${FONT}`;
      ctx.fillText(caption, c, c + R * 0.66);
    }
  }
}

/** Seven-segment-style LCD: dark digits on grey-green, like bench sensors. */
export function drawLcd(ctx, w, h, { text, unit, sub = '', warn = false }) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#b9c4ad');
  g.addColorStop(1, '#a8b59c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = warn ? '#7a1d16' : '#1c241b';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  ctx.font = `600 ${Math.round(h * 0.62)}px ${FONT}`;
  ctx.fillText(text, w * 0.74, h * 0.72);
  ctx.textAlign = 'left';
  ctx.font = `600 ${Math.round(h * 0.2)}px ${FONT}`;
  ctx.fillText(unit, w * 0.77, h * 0.72);
  if (sub) {
    ctx.font = `500 ${Math.round(h * 0.15)}px ${FONT}`;
    ctx.fillText(sub, w * 0.05, h * 0.2);
  }
}
