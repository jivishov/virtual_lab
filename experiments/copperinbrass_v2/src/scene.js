import { LabScene } from '../../spectrophotometry_v2/src/scene.js?v=2';
import { fitCamera } from '../../spectrophotometry_v2/src/camera-fit.js';
import { CUVETTE } from '../../spectrophotometry_v2/assets/cuvette-dimensions.js';
import { pipetteLevel } from '../../spectrophotometry_v2/src/pipettes.js';
import { samples, concentrations, reactionTime } from './model.js?v=2';

const { G, M, V } = globalThis.E3D;
const floor = 0.012;
const stations = {
  balance: [-4.9, floor, 1.65],
  brass: [-3.66, floor, 2.07],
  beaker: [-2.72, 0.064, -0.3],
  acid: [-3.63, 0.064, -0.48],
  flask: [-1.18, floor, 1.35],
  pipette: [-5.18, 0.245, -1.27],
  water: [-1.18, floor, -1.48],
  std1: [-0.22, floor, -1.44],
  std2: [0.72, floor, -1.44],
  std4: [1.66, floor, -1.44],
  rack: [0.84, floor, 1.93],
  spec: [3.84, 0.02, -0.66],
  waste: [5.53, 0.02, 1.65],
};
const desk = [3.4, CUVETTE.homeY, 2.0];
const ports = {
  lid: [0.85, 1.31, -0.03],
  chamber: [0.85, 1.295, 0.1],
  zero: [0.35, 0.68, 1.25],
  read: [0.76, 0.68, 1.25],
};
const grip = {
  balance: [0, 0.44, -0.16],
  brass: [0, 0.105, 0],
  beaker: [0, 0.53, 0],
  acid: [0, 0.96, 0],
  flask: [0, 0.81, 0],
  pipette: [0, 1.26, 0],
  rack: [0, 0.28, 0],
  spec: [0, 0.81, 0.61],
  waste: [0, 0.62, 0],
  water: [0, 0.96, 0],
  std1: [0, 0.96, 0],
  std2: [0, 0.96, 0],
  std4: [0, 0.96, 0],
};
const bottleIds = ['acid', 'water', 'std1', 'std2', 'std4'];
const materialNames = {
  acid: ['HNO₃', 'CONC.', '#a75042'],
  water: ['H₂O', 'DIST.', '#357f83'],
  std1: ['Cu²⁺', '0.100 M', '#376e84'],
  std2: ['Cu²⁺', '0.200 M', '#30627e'],
  std4: ['Cu²⁺', '0.400 M', '#244d71'],
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);
const innerFlask = [
  [0.001, 0.039],
  [0.254, 0.039],
  [0.364, 0.076],
  [0.425, 0.18],
  [0.433, 0.298],
  [0.389, 0.45],
  [0.263, 0.627],
  [0.141, 0.773],
  [0.081, 0.875],
  [0.081, 1.114],
];

function filledFlask(height) {
  const profile = innerFlask.filter(([, y]) => y < height);
  const [r0, y0] = profile[profile.length - 1],
    [r1, y1] = innerFlask[profile.length];
  const radius = r0 + ((r1 - r0) * (height - y0)) / (y1 - y0);
  return G.lathe(
    [...profile, [radius, height], [radius * 0.96, height - 0.004], [0.0001, height - 0.004]],
    64
  );
}
function loadReference(groups) {
  const selected = {
    instrument: groups.instrument,
    instrument_lid: groups.instrument_lid,
    pipette: groups.pipette,
    pipetteStand: groups.pipetteStand,
    waste: groups.wasteBeaker,
    cuvetteDock: groups.cuvetteDock,
    clipboard: groups.clipboard,
    tissueBox: groups.tissueBox,
  };
  for (const id of bottleIds) selected[id] = groups.stockBottle;
  for (const id of samples) selected[id] = groups.cuvette;
  return selected;
}
function keepMesh(id, name) {
  if (bottleIds.includes(id)) return !/label|identification|glyph/i.test(name);
  if (id === 'clipboard') return !/protocol/i.test(name);
  return true;
}
function boxHit(renderer, x, y, node, bounds) {
  const ray = renderer.ray(x, y),
    inv = M.inverse(node.world);
  const origin = M.point(inv, ray.origin),
    dir = V.sub(M.point(inv, V.add(ray.origin, ray.dir)), origin);
  let near = 0,
    far = Infinity;
  for (let i = 0; i < 3; i++) {
    const lo = bounds.min[i] - 0.035,
      hi = bounds.max[i] + 0.035;
    if (Math.abs(dir[i]) < 1e-7) {
      if (origin[i] < lo || origin[i] > hi) return Infinity;
      continue;
    }
    const a = (lo - origin[i]) / dir[i],
      b = (hi - origin[i]) / dir[i];
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (far < near) return Infinity;
  }
  return near;
}

export class CopperScene extends LabScene {
  constructor(renderer) {
    super(renderer);
    this.motion = new Map();
    this.rackSlots = {};
  }
  async load() {
    await Promise.all([this.loadApparatus(loadReference, keepMesh), this.loadCopperKit()]);
    this.buildInstrument();
    this.objects.spec = this.objects.instrument;
    this.equipmentBounds.spec = this.equipmentBounds.instrument;
    this.objects.notebook = this.objects.clipboard;
    this.equipmentBounds.notebook = this.equipmentBounds.clipboard;
    this.objects.hood.set(-3.17, 0, -0.45);
    this.objects.hood.scale = [1.52, 1, 1.33];
    this.objects.acid.scale = [0.82, 0.82, 0.82];
    this.objects.notebook.set(0.35, 0.018, 0.28);
    this.objects.notebook.rot[1] = -0.1;
    this.objects.tissueBox.set(1.47, 0.02, -2.75);
    this.objects.cuvetteDock.set(desk[0], 0, desk[2]);
    this.objects.pipetteStand.set(stations.pipette[0], 0, stations.pipette[2]);
    this.addDetails();
    await this.appearance.select('cinematic');
  }
  async loadCopperKit() {
    const load = async (file, format) => {
      const response = await fetch(new URL('../assets/apparatus.' + file, import.meta.url));
      if (!response.ok) throw Error('Could not load copper apparatus: ' + response.status);
      return response[format]();
    };
    const [kit, buffer] = await Promise.all([load('json', 'json'), load('bin', 'arrayBuffer')]);
    for (const [id, batches] of Object.entries(kit)) {
      const group = this.r.group(),
        min = [Infinity, Infinity, Infinity],
        max = [-Infinity, -Infinity, -Infinity];
      for (const { material, offset, vertexCount, indexCount } of batches) {
        const { color, ...spec } = material,
          vertices = new Float32Array(buffer, offset, vertexCount * 8);
        const indices = new Uint32Array(buffer, offset + vertices.byteLength, indexCount);
        this.r.mesh(vertices, this.mat(color, spec), group, indices);
        for (let i = 0; i < vertices.length; i += 8)
          for (let j = 0; j < 3; j++) {
            min[j] = Math.min(min[j], vertices[i + j]);
            max[j] = Math.max(max[j], vertices[i + j]);
          }
      }
      this.objects[id] = group;
      this.equipmentBounds[id] = { min, max };
    }
  }
  addDetails() {
    for (const id of bottleIds) {
      const [name, amount, stripe] = materialNames[id],
        c = this.canvas(512, 268),
        ctx = c.getContext('2d');
      ctx.fillStyle = '#eeeadd';
      ctx.fillRect(0, 0, 512, 268);
      ctx.fillStyle = stripe;
      ctx.fillRect(0, 0, 512, 60);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1c343a';
      ctx.font = 'bold 82px sans-serif';
      ctx.fillText(name, 256, 154);
      ctx.font = '48px sans-serif';
      ctx.fillText(amount, 256, 224);
      this.wrapLabel(this.objects[id], c, 0.83, 0.46, 0.37, 0.69);
      this.addLiquid(id, 0.331, 0.99, this.objects[id], 0.06);
      this.fill(id, 0.79, { std1: 0.56, std2: 1.0, std4: 1.8 }[id] || 0);
    }
    this.balanceDisplay = this.flat('0.000 g', 0.77, 0.155, [-0.16, 0.373, 0.39], this.objects.balance, {
      ink: '#c8f2d6',
      bg: '#162c30',
    });
    this.flat('TARE', 0.125, 0.084, [0.35, 0.38, 0.39], this.objects.balance, { ink: '#312c22' });
    this.text('50 mL', 0.29, 0.09, [0, 0.49, 0.35], this.objects.beaker, { ink: '#ece9db' });
    this.text('100 mL', 0.34, 0.09, [0, 0.34, 0.448], this.objects.flask, { ink: '#eeecdc' });
    this.text('Cu', 0.2, 0.08, [0, 0.22, 0.45], this.objects.flask, { ink: '#eeecdc' });
    this.text('EXTRACT', 0.61, 0.078, [0, 1.65, 0.616], this.objects.hood, { ink: '#e4f0e5' });
    this.flat('Cu  /  BRASS', 1.04, 0.21, [0, 0.109, 0], this.objects.clipboard, {
      ink: '#314e55',
      bg: '#e5e1ce',
    });
    this.text(
      'BLK       0.1       0.2       0.4       ?',
      1.96,
      0.084,
      [0, 0.085, 0.3],
      this.objects.rack,
      { ink: '#33444b', bg: '#eeeadd' }
    );
    this.pipetteMark = this.flat('P', 0.72, 0.18, [0, 0.099, 0.2], this.objects.pipetteStand, {
      ink: '#283c42',
      bg: '#edeadf',
    });
    this.addLiquid('beaker', 0.319, 0.47, this.objects.beaker, 0.056);
    this.addLiquid('waste', 0.44, 0.88, this.objects.waste, 0.07);
    for (const id of samples)
      this.addLiquid(
        id,
        CUVETTE.liquidHalfWidth,
        CUVETTE.liquidHeight,
        this.objects[id],
        CUVETTE.base,
        true
      );
    const liquid = this.mat('#87b8c8', { rough: 0.1, opacity: 0.74, pattern: 11, thickness: 0.85 });
    this.digest = this.r.mesh(filledFlask(0.32), liquid, this.objects.flask);
    this.diluted = this.r.mesh(filledFlask(1.112), { ...liquid }, this.objects.flask);
    this.digest.mat.dye = 0.89;
    this.diluted.mat.dye = 0.51;
    this.bubbles = [];
    for (let i = 0; i < 9; i++) {
      const bubble = this.r.mesh(
        G.sphere(0.016 + (i % 3) * 0.005, 10, 8),
        this.mat('#c8ad75', { rough: 0.32, opacity: 0.61 }),
        this.objects.beaker
      );
      bubble.noShadow = true;
      this.bubbles.push(bubble);
    }
  }
  benchPosition(id, s) {
    return [...(s.positions[id] || stations[id])];
  }
  snapPosition(id, raw) {
    const b = this.equipmentBounds[id],
      margin = 0.08;
    return [
      clamp(raw[0], -7.35 - b.min[0] + margin, 7.35 - b.max[0] - margin),
      stations[id][1],
      clamp(raw[2], -4.83 - b.min[2] + margin, 4.83 - b.max[2] - margin),
    ];
  }
  canMove(id, s) {
    return (
      !!stations[id] &&
      !['beaker', 'acid'].includes(id) &&
      !(id === 'brass' && s.brass !== 'loose') &&
      !(id === 'spec' && s.inserted)
    );
  }
  pose(id, dest, animate, arc = 0.22) {
    const node = this.objects[id];
    if (!animate || this.reduced || !node.visible) {
      node.set(...dest);
      this.motion.delete(id);
      return;
    }
    if (V.dot(V.sub(node.pos, dest), V.sub(node.pos, dest)) < 0.00001) {
      this.motion.delete(id);
      return;
    }
    this.motion.set(id, {
      start: [...node.pos],
      end: dest,
      time: performance.now(),
      duration: 420,
      arc,
    });
  }
  sync(s, { animate = true, operation: op = null } = {}) {
    this.motion.clear();
    this.state = s;
    this.reactionProgress = -1;
    for (const id of Object.keys(stations)) {
      const node = this.objects[id];
      let dest = this.benchPosition(id, s);
      node.visible = id !== 'brass' || s.brass !== 'dissolved';
      if (id === 'pipette') node.visible = !!s.pipette && !s.cleanup[2];
      if (id === 'brass' && ['pan', 'beaker'].includes(s.brass)) {
        const base = this.benchPosition(s.brass === 'pan' ? 'balance' : 'beaker', s);
        dest = V.add(base, s.brass === 'pan' ? [0, 0.436, -0.16] : [0, 0.06, 0]);
      }
      this.pose(id, dest, animate);
    }
    const pip = this.benchPosition('pipette', s);
    this.objects.pipetteStand.set(pip[0], 0, pip[2]);
    const rack = this.benchPosition('rack', s),
      spec = this.benchPosition('spec', s);
    samples.forEach((id, i) => {
      // Unissued clean cuvettes sit in the rack. Issued cells return to their own slot.
      const node = this.objects[id];
      const slot = V.add(rack, [(i - 2) * 0.421, 0.107, 0]);
      const measured = s.readings.some((row) => row.id === id);
      const dest =
        s.inserted === id
          ? V.add(spec, CUVETTE.seat)
          : s.activeSample === id && !measured
            ? [...desk]
            : slot;
      this.pose(id, dest, animate, s.inserted === id || id === s.activeSample ? 1.1 : 0.13);
      this.fill(
        id,
        s.cuvettes[id]?.filled && !s.cleanup[0] ? 0.6 : 0,
        (concentrations[id] ?? 0.17) * 5.1
      );
      node.visible = true;
    });
    const lidTarget = s.lidOpen ? -1.43 : 0;
    if (animate && !this.reduced && Math.abs(this.lid.rot[0] - lidTarget) > 0.01)
      this.motion.set('lid', {
        time: performance.now(),
        start: this.lid.rot[0],
        end: lidTarget,
        duration: 310,
      });
    else this.lid.rot[0] = lidTarget;
    this.retext(this.balanceDisplay, (s.brass === 'pan' ? s.mass : 0).toFixed(3) + ' g');
    this.retext(
      this.pipetteMark,
      { acid: 'HNO₃', water: 'H₂O', copper: 'Cu²⁺', unknown: '? Cu' }[s.pipette?.role] ||
        (s.pipette?.role?.startsWith('std_') ? s.pipette.role.slice(4) + ' M' : 'P')
    );
    this.fill('beaker', s.fluid ? 0.72 : 0, s.fluid === 'copper' ? 0.91 : 0.32);
    this.digest.visible = s.flask === 'digest';
    this.diluted.visible = s.flask === 'diluted';
    this.fill('waste', s.cleanup[0] ? 0.22 : 0, 0.73);
    for (const bubble of this.bubbles) bubble.visible = s.fluid === 'reacting';
    const role = s.pipette?.role;
    const bulbColor =
      { acid: '#b65c43', water: '#438aa4', copper: '#4d8d80', unknown: '#8d6a99' }[role] || '#b78645';
    if (this.bulbColor !== bulbColor) {
      this.bulbColor = bulbColor;
      for (const bulb of this.bulbMeshes.pipette) bulb.mat.color = this.mat(bulbColor).color;
    }
    this.pipetteGlass.pipette.level = pipetteLevel(s.pipette?.content ? 6 : 0);
    this.pipetteGlass.pipette.dye = ['acid', 'blank', null, undefined].includes(s.pipette?.content)
      ? 0
      : 0.64;
    this.paintInstrument(s);
    this.r.root.update();
    if (animate && !this.reduced && op?.from === 'pipette' && op.to && op.to !== 'waste') {
      const target = this.point(op.to, true);
      this.motion.set('pipette', {
        start: [...this.objects.pipette.pos],
        via: target,
        end: pip,
        time: performance.now(),
        duration: 640,
        arc: 0.37,
      });
    }
    this.r.dirtyShadow = true;
  }
  paintInstrument(s) {
    const reading =
      s.reading == null ? null : { absorbance: s.reading, percentT: 100 * 10 ** -s.reading };
    this.updateTransmission(reading);
    const text = reading
      ? reading.absorbance.toFixed(3) + ' A'
      : s.lidOpen
        ? 'OPEN'
        : s.zeroed
          ? 'READY'
          : '—';
    if (this.lcdValue === text) return;
    this.lcdValue = text;
    const c = this.screen.canvas,
      ctx = c.getContext('2d');
    ctx.fillStyle = '#10252d';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#a5d6d5';
    ctx.font = '32px sans-serif';
    ctx.fillText('Cu²⁺    ·    ABS', 24, 44);
    ctx.fillStyle = '#537b81';
    ctx.fillRect(24, 57, 610, 3);
    ctx.fillStyle = '#f5f4de';
    ctx.font = '600 77px monospace';
    ctx.fillText(text, 23, 145, 612);
    this.r.texture(c, this.screen.mat.map);
  }
  tick(now) {
    let changed = this.motion.size > 0;
    for (const [id, m] of this.motion) {
      const t = clamp((now - m.time) / m.duration, 0, 1);
      if (id === 'lid') this.lid.rot[0] = m.start + (m.end - m.start) * smooth(t);
      else {
        let p;
        if (m.via) {
          const first = t < 0.54,
            local = first ? t / 0.54 : (t - 0.54) / 0.46;
          p = V.lerp(first ? m.start : m.via, first ? m.via : m.end, smooth(local));
          p[1] += m.arc * Math.sin(Math.PI * local);
        } else {
          p = V.lerp(m.start, m.end, smooth(t));
          p[1] += m.arc * Math.sin(Math.PI * t);
        }
        this.objects[id].set(...p);
      }
      if (t === 1) this.motion.delete(id);
    }
    if (this.state?.fluid === 'reacting' && this.reactionProgress < 1) {
      const t = clamp(1 - (this.state.reactionEnd - Date.now()) / reactionTime, 0, 1);
      this.reactionProgress = t;
      this.objects.brass.scale.fill(Math.max(0.02, 1 - t));
      this.fill('beaker', 0.72, 0.26 + 0.65 * t);
      this.bubbles.forEach((n, i) => {
        const u = (now * 0.00066 + i * 0.273) % 1;
        n.set(0.18 * Math.cos(i * 2.4), 0.13 + u * 0.43, 0.16 * Math.sin(i * 2.4));
        n.visible = t < 1 && !this.reduced;
      });
      changed = true;
    } else if (this.state?.fluid !== 'reacting') this.objects.brass.scale.fill(1);
    if (changed) this.r.dirtyShadow = true;
    return changed;
  }
  point(id, mouth = false) {
    if (ports[id]) return M.point(this.objects.spec.world, ports[id]);
    const node = this.objects[id];
    if (!node) return null;
    if (id === 'notebook') return M.point(node.world, [0, 0.13, 0]);
    if (samples.includes(id))
      return M.point(node.world, [0, mouth ? CUVETTE.height : CUVETTE.height * 0.6, 0]);
    const heights = {
      beaker: 0.7,
      flask: 1.51,
      acid: 1.64,
      water: 1.64,
      std1: 1.64,
      std2: 1.64,
      std4: 1.64,
      waste: 1.1,
    };
    return M.point(node.world, mouth && heights[id] ? [0, heights[id], 0] : grip[id] || [0, 0.4, 0]);
  }
  pick(x, y, expected = [], ignore = null) {
    this.r.root.update();
    // Physical controls and small glassware get a touch-sized target at their real projection.
    for (const id of expected.filter(Boolean)) {
      if (id === ignore) continue;
      const point = this.point(id);
      if (!point) continue;
      const p = this.r.project(point);
      if (p.z < 1 && Math.hypot(p.x - x, p.y - y) < (id === 'brass' || samples.includes(id) ? 25 : 20))
        return id;
    }
    let result = null,
      distance = Infinity;
    const ids = [...Object.keys(stations), ...samples, 'notebook'];
    for (const id of ids) {
      if (id === ignore || !this.objects[id].visible) continue;
      const t = boxHit(this.r, x, y, this.objects[id], this.equipmentBounds[id]);
      if (t < distance) {
        result = id;
        distance = t;
      }
    }
    return result;
  }
  frame(view) {
    this.view = view;
    const opts = {
      bench: Object.keys(stations),
      prep: ['balance', 'brass', 'hood', 'beaker', 'acid', 'flask', 'pipette', 'water'],
      optics: ['spec', 'rack', 'std1', 'std2', 'std4', 'waste', 'blank'],
    };
    const ids = Array.isArray(view) ? view : opts[view] || opts.bench;
    this.r.root.update();
    const points = [];
    for (let id of ids) {
      if (ports[id]) id = 'spec';
      const node = this.objects[id],
        b = this.equipmentBounds[id];
      if (!node?.visible || !b) continue;
      for (let mask = 0; mask < 8; mask++)
        points.push(
          M.point(
            node.world,
            [0, 1, 2].map((k) => (mask & (1 << k) ? b.max[k] : b.min[k]))
          )
        );
    }
    if (!points.length) return;
    const { width, height } = this.r.canvas.getBoundingClientRect(),
      phone = width < 720;
    const hudBottom = document.querySelector('.hud').getBoundingClientRect().bottom;
    const dockTop = document.querySelector('.toolbar').getBoundingClientRect().top;
    const bottom = Math.min(height * 0.27, Math.max(24, height - dockTop + 15));
    const top = Math.min(
      view === 'bench' ? height - bottom - Math.min(140, height * 0.24) : height * 0.41,
      hudBottom + 15
    );
    const cam = fitCamera(points, {
      width,
      height,
      yaw: view === 'bench' ? -0.105 : -0.065,
      pitch: view === 'bench' ? 0.34 : 0.57,
      minDistance: Array.isArray(view) ? 3.15 : 4.3,
      fov: 42,
      insets: { top, bottom, left: phone ? 16 : 45, right: phone ? 16 : 45 },
    });
    Object.assign(this.r.cam, cam);
    this.r.updateCamera();
  }
}
