/**
 * Minimal SVG plotting.
 *
 * Hand-rolled rather than pulled from a charting library because the privacy
 * claim in governance/intended-use.md requires that the page make no request
 * to any external origin. Every colour comes from a CSS custom property, so
 * light and dark themes are handled by the stylesheet rather than by script.
 */

const NS = 'http://www.w3.org/2000/svg';

const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) node.setAttribute(k, String(v));
  }
  return node;
};

/**
 * Choose axis ticks at 1/2/5 x 10^n spacing.
 * @param {number} lo @param {number} hi @param {number} target
 * @returns {number[]}
 */
export function niceTicks(lo, hi, target = 6) {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const first = Math.ceil(lo / step) * step;
  const out = [];
  for (let v = first; v <= hi + step * 1e-9; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return out;
}

const fmt = (v) => {
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 1000) return v.toFixed(0);
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  return v.toPrecision(2);
};

/**
 * @typedef {object} Series
 * @property {string} name
 * @property {[number, number][]} points
 * @property {string} [stroke]     CSS colour or var()
 * @property {string} [dash]
 * @property {string} [fill]
 * @property {number} [width]
 */

/**
 * Render a line chart.
 *
 * @param {SVGSVGElement} svg
 * @param {{
 *   series: Series[],
 *   bands?: {x0: number, x1: number, label?: string}[],
 *   hlines?: {y: number, label: string, cls?: string}[],
 *   vlines?: {x: number, label?: string}[],
 *   xLabel: string, yLabel: string,
 *   xMin?: number, xMax?: number, yMin?: number, yMax?: number,
 *   height?: number
 * }} opts
 */
export function lineChart(svg, opts) {
  const {
    series, bands = [], hlines = [], vlines = [],
    xLabel, yLabel, height = 320,
  } = opts;

  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const width = svg.clientWidth || svg.parentElement?.clientWidth || 720;
  const m = { top: 14, right: 16, bottom: 44, left: 62 };
  const w = Math.max(220, width - m.left - m.right);
  const h = height - m.top - m.bottom;

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('height', String(height));
  svg.setAttribute('width', '100%');
  svg.setAttribute('role', 'img');

  const all = series.flatMap((s) => s.points);
  if (!all.length) return;

  const xMin = opts.xMin ?? Math.min(...all.map((p) => p[0]));
  const xMax = opts.xMax ?? Math.max(...all.map((p) => p[0]));
  const dataMax = Math.max(...all.map((p) => p[1]), ...hlines.map((l) => l.y));
  const yMin = opts.yMin ?? 0;
  const yMax = opts.yMax ?? (dataMax > 0 ? dataMax * 1.12 : 1);

  const sx = (x) => m.left + ((x - xMin) / (xMax - xMin || 1)) * w;
  const sy = (y) => m.top + h - ((y - yMin) / (yMax - yMin || 1)) * h;

  const g = el('g');
  svg.appendChild(g);

  /* shaded bands (CRRT stopped) drawn first, behind everything */
  for (const b of bands) {
    const x0 = sx(Math.max(b.x0, xMin));
    const x1 = sx(Math.min(b.x1, xMax));
    if (x1 <= x0) continue;
    g.appendChild(el('rect', {
      x: x0, y: m.top, width: x1 - x0, height: h, class: 'chart-band',
    }));
    if (b.label && x1 - x0 > 46) {
      const t = el('text', {
        x: (x0 + x1) / 2, y: m.top + 13, class: 'chart-band-label', 'text-anchor': 'middle',
      });
      t.textContent = b.label;
      g.appendChild(t);
    }
  }

  /* grid + axes */
  for (const ty of niceTicks(yMin, yMax)) {
    const y = sy(ty);
    g.appendChild(el('line', { x1: m.left, y1: y, x2: m.left + w, y2: y, class: 'chart-grid' }));
    const t = el('text', { x: m.left - 8, y: y + 4, class: 'chart-tick', 'text-anchor': 'end' });
    t.textContent = fmt(ty);
    g.appendChild(t);
  }
  for (const tx of niceTicks(xMin, xMax)) {
    const x = sx(tx);
    g.appendChild(el('line', { x1: x, y1: m.top, x2: x, y2: m.top + h, class: 'chart-grid' }));
    const t = el('text', { x, y: m.top + h + 20, class: 'chart-tick', 'text-anchor': 'middle' });
    t.textContent = fmt(tx);
    g.appendChild(t);
  }

  g.appendChild(el('line', {
    x1: m.left, y1: m.top + h, x2: m.left + w, y2: m.top + h, class: 'chart-axis',
  }));
  g.appendChild(el('line', { x1: m.left, y1: m.top, x2: m.left, y2: m.top + h, class: 'chart-axis' }));

  const xl = el('text', {
    x: m.left + w / 2, y: height - 6, class: 'chart-axis-label', 'text-anchor': 'middle',
  });
  xl.textContent = xLabel;
  g.appendChild(xl);

  const yl = el('text', {
    x: 14, y: m.top + h / 2, class: 'chart-axis-label', 'text-anchor': 'middle',
    transform: `rotate(-90 14 ${m.top + h / 2})`,
  });
  yl.textContent = yLabel;
  g.appendChild(yl);

  /* event markers */
  for (const v of vlines) {
    if (v.x < xMin || v.x > xMax) continue;
    g.appendChild(el('line', {
      x1: sx(v.x), y1: m.top, x2: sx(v.x), y2: m.top + h, class: 'chart-event',
    }));
  }

  /* threshold lines */
  for (const l of hlines) {
    if (l.y > yMax) continue;
    const y = sy(l.y);
    g.appendChild(el('line', {
      x1: m.left, y1: y, x2: m.left + w, y2: y, class: `chart-hline ${l.cls ?? ''}`,
    }));
    const t = el('text', { x: m.left + w - 4, y: y - 5, class: 'chart-hline-label', 'text-anchor': 'end' });
    t.textContent = l.label;
    g.appendChild(t);
  }

  /* data */
  for (const s of series) {
    if (!s.points.length) continue;
    const d = s.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p[0]).toFixed(2)},${sy(p[1]).toFixed(2)}`)
      .join(' ');

    if (s.fill) {
      const base = sy(Math.max(yMin, 0));
      const area = `${d} L${sx(s.points[s.points.length - 1][0]).toFixed(2)},${base.toFixed(2)} L${sx(s.points[0][0]).toFixed(2)},${base.toFixed(2)} Z`;
      g.appendChild(el('path', { d: area, fill: s.fill, stroke: 'none' }));
    }
    g.appendChild(el('path', {
      d, fill: 'none', stroke: s.stroke ?? 'currentColor',
      'stroke-width': s.width ?? 2, 'stroke-dasharray': s.dash ?? null,
      'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke',
    }));
  }
}

/**
 * Stacked-area chart for the clearance decomposition. The stack order is
 * fixed (non-renal, residual renal, extracorporeal) so the extracorporeal
 * contribution is always the top band and its appearance and disappearance
 * at CRRT events is immediately legible.
 *
 * @param {SVGSVGElement} svg
 * @param {{t: number[], layers: {name: string, values: number[], fill: string}[],
 *          bands?: {x0: number, x1: number, label?: string}[],
 *          xLabel: string, yLabel: string, height?: number}} opts
 */
export function stackedArea(svg, opts) {
  const { t, layers, bands = [], xLabel, yLabel, height = 210 } = opts;
  const cumulative = new Array(t.length).fill(0);
  const series = [];

  for (const layer of layers) {
    const lower = cumulative.slice();
    for (let i = 0; i < t.length; i++) cumulative[i] += layer.values[i];
    series.push({
      name: layer.name,
      lower,
      upper: cumulative.slice(),
      fill: layer.fill,
    });
  }

  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const width = svg.clientWidth || svg.parentElement?.clientWidth || 720;
  const m = { top: 12, right: 16, bottom: 40, left: 62 };
  const w = Math.max(220, width - m.left - m.right);
  const h = height - m.top - m.bottom;

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('height', String(height));
  svg.setAttribute('width', '100%');
  svg.setAttribute('role', 'img');

  const xMin = t[0];
  const xMax = t[t.length - 1];
  const yMax = Math.max(...cumulative, 1e-6) * 1.12;

  const sx = (x) => m.left + ((x - xMin) / (xMax - xMin || 1)) * w;
  const sy = (y) => m.top + h - (y / yMax) * h;

  const g = el('g');
  svg.appendChild(g);

  for (const b of bands) {
    const x0 = sx(Math.max(b.x0, xMin));
    const x1 = sx(Math.min(b.x1, xMax));
    if (x1 > x0) {
      g.appendChild(el('rect', { x: x0, y: m.top, width: x1 - x0, height: h, class: 'chart-band' }));
    }
  }

  for (const ty of niceTicks(0, yMax, 4)) {
    const y = sy(ty);
    g.appendChild(el('line', { x1: m.left, y1: y, x2: m.left + w, y2: y, class: 'chart-grid' }));
    const tk = el('text', { x: m.left - 8, y: y + 4, class: 'chart-tick', 'text-anchor': 'end' });
    tk.textContent = fmt(ty);
    g.appendChild(tk);
  }
  for (const tx of niceTicks(xMin, xMax)) {
    const tk = el('text', { x: sx(tx), y: m.top + h + 20, class: 'chart-tick', 'text-anchor': 'middle' });
    tk.textContent = fmt(tx);
    g.appendChild(tk);
  }

  for (const s of series) {
    const up = s.upper.map((v, i) => `${i === 0 ? 'M' : 'L'}${sx(t[i]).toFixed(2)},${sy(v).toFixed(2)}`).join(' ');
    const down = s.lower
      .map((v, i) => [sx(t[i]), sy(v)])
      .reverse()
      .map(([x, y]) => `L${x.toFixed(2)},${y.toFixed(2)}`)
      .join(' ');
    g.appendChild(el('path', { d: `${up} ${down} Z`, fill: s.fill, stroke: 'none' }));
  }

  g.appendChild(el('line', { x1: m.left, y1: m.top + h, x2: m.left + w, y2: m.top + h, class: 'chart-axis' }));
  g.appendChild(el('line', { x1: m.left, y1: m.top, x2: m.left, y2: m.top + h, class: 'chart-axis' }));

  const xl = el('text', { x: m.left + w / 2, y: height - 4, class: 'chart-axis-label', 'text-anchor': 'middle' });
  xl.textContent = xLabel;
  g.appendChild(xl);

  const yl = el('text', {
    x: 14, y: m.top + h / 2, class: 'chart-axis-label', 'text-anchor': 'middle',
    transform: `rotate(-90 14 ${m.top + h / 2})`,
  });
  yl.textContent = yLabel;
  g.appendChild(yl);
}
