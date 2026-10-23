/**
 * Live graph of the law's relationship, drawn like a chart on graph paper.
 * Trail: every state the gas passes through. Dashed line: the law's prediction
 * through state 1. Hollow ring: state 1. Filled dot: now.
 */
import { R } from '../model/units.js';
import { sig, unitFor, VAR_NAMES } from './format.js';

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export class LawGraph {
  constructor(canvas) {
    this.canvas = canvas;
    this.trail = [];
    this.lastT = -Infinity;
    this.toZero = false;
    this.range = null;
  }

  reset(view, s1) {
    this.scenarioId = view.scenario.id;
    this.lawId = view.law.id;
    this.axes = view.law.axes;
    this.s1 = s1;
    this.trail = [];
    this.lastT = -Infinity;
    this.range = null;
  }

  setState1(s1) {
    this.s1 = s1;
  }

  push(view) {
    if (view.time - this.lastT < 0.15) return;
    this.lastT = view.time;
    const { x, y } = this.axes;
    if (!(view.state.n > 1e-9)) return;
    const p = [view.state[x], view.state[y]];
    const last = this.trail[this.trail.length - 1];
    if (last && Math.abs(last[0] - p[0]) < 1e-9 * Math.abs(p[0]) && Math.abs(last[1] - p[1]) < 1e-9 * Math.abs(p[1])) return;
    this.trail.push(p);
    if (this.trail.length > 900) this.trail.shift();
  }

  /** The law's curve through state 1, as y(x) in model units. */
  lawY(xv) {
    const s = this.s1;
    switch (this.lawId) {
      case 'boyle': return (s.P * s.V) / xv;
      case 'charles': return (s.V * xv) / s.T;
      case 'gayLussac': return (s.P * xv) / s.T;
      case 'avogadro': return s.n > 1e-9 ? (s.V * xv) / s.n : NaN;
      case 'ideal': return (s.n * R * xv) / s.V; // constant n and V through state 1
      default: return NaN;
    }
  }

  draw(view) {
    const c = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const { x, y } = this.axes;
    const ux = unitFor(this.scenarioId, x);
    const uy = unitFor(this.scenarioId, y);
    const now = [view.state[x], view.state[y]];
    const pts = [...this.trail, now];
    if (this.s1) pts.push([this.s1[x], this.s1[y]]);
    const finite = pts.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
    if (!finite.length) return;

    // Range grows to fit and never shrinks while the scenario runs.
    let x0 = Math.min(...finite.map((p) => p[0])), x1 = Math.max(...finite.map((p) => p[0]));
    let y0 = Math.min(...finite.map((p) => p[1])), y1 = Math.max(...finite.map((p) => p[1]));
    const padX = Math.max((x1 - x0) * 0.12, Math.abs(x1) * 0.06 || 1);
    const padY = Math.max((y1 - y0) * 0.12, Math.abs(y1) * 0.06 || 1);
    x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
    if (this.range) {
      x0 = Math.min(x0, this.range.x0); x1 = Math.max(x1, this.range.x1);
      y0 = Math.min(y0, this.range.y0); y1 = Math.max(y1, this.range.y1);
    }
    this.range = { x0, x1, y0, y1 };
    if (this.toZero) { x0 = 0; y0 = 0; }
    x0 = Math.max(x0, 0); y0 = Math.max(y0, 0);

    const L = 54, Rm = 14, T = 12, B = 38;
    const X = (v) => L + ((v - x0) / (x1 - x0)) * (w - L - Rm);
    const Y = (v) => h - B - ((v - y0) / (y1 - y0)) * (h - T - B);

    // Graph paper.
    g.fillStyle = css('--paper');
    g.fillRect(L, T, w - L - Rm, h - T - B);
    const grid = (n, major) => {
      g.strokeStyle = major ? css('--paper-major') : css('--paper-minor');
      g.lineWidth = 1;
      for (let i = 0; i <= n; i++) {
        const px = L + ((w - L - Rm) * i) / n;
        const py = T + ((h - T - B) * i) / n;
        g.beginPath(); g.moveTo(px, T); g.lineTo(px, h - B); g.stroke();
        g.beginPath(); g.moveTo(L, py); g.lineTo(w - Rm, py); g.stroke();
      }
    };
    grid(20, false);
    grid(4, true);

    g.fillStyle = css('--ink-2');
    g.font = '500 12px "Barlow", system-ui, sans-serif';
    g.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const v = y0 + ((y1 - y0) * i) / 4;
      g.fillText(sig(uy.of(v), 3, { html: false }), L - 6, Y(v) + 4);
    }
    g.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const v = x0 + ((x1 - x0) * i) / 4;
      g.fillText(sig(ux.of(v), 3, { html: false }), X(v), h - B + 16);
    }
    g.font = '600 13px "Barlow Semi Condensed", system-ui, sans-serif';
    g.fillStyle = css('--ink');
    g.fillText(`${VAR_NAMES[x]}, ${x} (${ux.unit})`, (L + w - Rm) / 2, h - 6);
    g.save();
    g.translate(13, (T + h - B) / 2);
    g.rotate(-Math.PI / 2);
    g.fillText(`${y} (${uy.unit})`, 0, 0);
    g.restore();

    g.save();
    g.beginPath();
    g.rect(L, T, w - L - Rm, h - T - B);
    g.clip();

    // Law prediction through state 1.
    if (this.s1) {
      g.strokeStyle = css('--held');
      g.lineWidth = 1.6;
      g.setLineDash([6, 5]);
      g.beginPath();
      let started = false;
      for (let i = 0; i <= 120; i++) {
        const xv = x0 + ((x1 - x0) * i) / 120;
        const yv = this.lawY(xv);
        if (!Number.isFinite(yv) || xv <= 0) { started = false; continue; }
        if (!started) { g.moveTo(X(xv), Y(yv)); started = true; } else g.lineTo(X(xv), Y(yv));
      }
      g.stroke();
      g.setLineDash([]);
    }

    // Trail.
    g.strokeStyle = css('--respond');
    g.globalAlpha = 0.75;
    g.lineWidth = 2;
    g.beginPath();
    this.trail.forEach(([a, b], i) => (i ? g.lineTo(X(a), Y(b)) : g.moveTo(X(a), Y(b))));
    g.lineTo(X(now[0]), Y(now[1]));
    g.stroke();
    g.globalAlpha = 1;

    if (this.s1) {
      g.strokeStyle = css('--ink');
      g.lineWidth = 2;
      g.beginPath(); g.arc(X(this.s1[x]), Y(this.s1[y]), 6, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = css('--respond');
    g.beginPath(); g.arc(X(now[0]), Y(now[1]), 5, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}
