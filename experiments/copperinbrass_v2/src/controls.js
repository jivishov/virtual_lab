const { V } = globalThis.E3D;
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export class BenchControls {
  constructor(canvas, scene, actions) {
    this.canvas = canvas;
    this.scene = scene;
    this.r = scene.r;
    this.actions = actions;
    this.points = new Map();
    const point = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button > 2) return;
      if (this.stroke?.id === 'hand') this.cancel();
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(e.pointerId);
      this.start(e.pointerId, point(e), e.button, e.shiftKey);
    });
    canvas.addEventListener('pointermove', (e) => this.move(e.pointerId, point(e)));
    canvas.addEventListener('pointerup', (e) => this.end(e.pointerId, point(e)));
    for (const name of ['pointercancel', 'lostpointercapture'])
      canvas.addEventListener(name, (e) => {
        if (this.points.has(e.pointerId)) this.cancel();
      });
    window.addEventListener('blur', () => this.cancel());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (this.points.size) return;
        this.actions.freeView();
        this.zoom(Math.exp(clamp(e.deltaY * (e.deltaMode ? 16 : 1), -180, 180) * 0.0016), point(e));
        this.changed();
      },
      { passive: false }
    );
    canvas.addEventListener('keydown', (e) => {
      const cam = this.r.cam;
      switch (e.key) {
        case 'ArrowLeft':
          if (e.shiftKey) cam.at[0] -= 0.2;
          else cam.yaw -= 0.1;
          break;
        case 'ArrowRight':
          if (e.shiftKey) cam.at[0] += 0.2;
          else cam.yaw += 0.1;
          break;
        case 'ArrowUp':
          if (e.shiftKey) cam.at[2] -= 0.2;
          else cam.pitch = clamp(cam.pitch + 0.07, 0.07, 1.46);
          break;
        case 'ArrowDown':
          if (e.shiftKey) cam.at[2] += 0.2;
          else cam.pitch = clamp(cam.pitch - 0.07, 0.07, 1.46);
          break;
        case '+':
        case '=':
          this.zoom(0.85);
          break;
        case '-':
          this.zoom(1.18);
          break;
        case 'Home':
          this.actions.frame('bench');
          break;
        case 'Escape':
          this.cancel();
          this.actions.clear();
          break;
        default:
          return;
      }
      if (!['Escape', 'Home'].includes(e.key)) this.actions.freeView();
      e.preventDefault();
      this.changed();
    });
  }
  changed() {
    this.r.updateCamera();
    this.actions.dirty();
  }
  pan(a, b) {
    const height = this.r.cam.at[1],
      p = this.r.onPlane(a.x, a.y, height),
      q = this.r.onPlane(b.x, b.y, height);
    if (p && q)
      this.r.cam.at = V.add(this.r.cam.at, V.sub(p, q)).map((v, i) =>
        clamp(v, i === 1 ? -1 : -9, i === 1 ? 3 : 9)
      );
  }
  zoom(scale, point) {
    const cam = this.r.cam,
      before = point && this.r.onPlane(point.x, point.y, cam.at[1]);
    cam.distance = clamp(cam.distance * scale, 0.95, 34);
    this.r.updateCamera();
    const after = point && this.r.onPlane(point.x, point.y, cam.at[1]);
    if (before && after) cam.at = V.add(cam.at, V.sub(before, after));
  }
  start(id, point, button = 0, shift = false) {
    if (id === 'hand' && this.points.size) return;
    this.points.set(id, point);
    if (this.points.size > 1) {
      if (this.stroke?.item) this.scene.sync(this.actions.state(), { animate: false });
      this.stroke = null;
      this.multi = true;
      return;
    }
    const s = this.actions.state(),
      op = this.actions.operation();
    const item =
      button === 0 && !shift
        ? this.scene.pick(point.x, point.y, [this.actions.selected() ? op?.to : op?.from])
        : null;
    const node = this.scene.objects[item],
      origin = node ? [...node.pos] : null;
    const height = item ? this.scene.point(item)?.[1] : null;
    this.stroke = {
      id,
      item,
      point,
      last: point,
      origin,
      height,
      anchor: origin && this.r.onPlane(point.x, point.y, height),
      movable: item && (this.scene.canMove(item, s) || (item === op?.from && !!op?.to)),
      pan: shift || button !== 0,
      dragged: false,
    };
  }
  move(id, point) {
    const prev = this.points.get(id);
    if (!prev) return;
    const before = [...this.points.values()];
    this.points.set(id, point);
    if (this.multi && this.points.size === 2) {
      const after = [...this.points.values()],
        mid = midpoint(...after);
      this.actions.freeView();
      this.zoom(Math.max(1, distance(...before)) / Math.max(1, distance(...after)), mid);
      this.pan(midpoint(...before), mid);
      this.changed();
      return;
    }
    const a = this.stroke;
    if (!a || a.id !== id) return;
    if (!a.dragged && distance(point, a.point) < 5) return;
    a.dragged = true;
    if (a.item) {
      if (a.movable && a.origin && a.anchor) {
        const p = this.r.onPlane(point.x, point.y, a.height);
        if (p) {
          const node = this.scene.objects[a.item];
          this.scene.motion.delete(a.item);
          node.set(
            clamp(a.origin[0] + p[0] - a.anchor[0], -8, 8),
            a.origin[1] + 0.1,
            clamp(a.origin[2] + p[2] - a.anchor[2], -5.5, 5.5)
          );
          this.r.dirtyShadow = true;
          this.r.root.update();
        }
      }
    } else if (a.pan) {
      this.actions.freeView();
      this.pan(a.last, point);
    } else {
      this.actions.freeView();
      this.r.cam.yaw -= (point.x - a.last.x) * 0.006;
      this.r.cam.pitch = clamp(this.r.cam.pitch + (point.y - a.last.y) * 0.005, 0.07, 1.46);
    }
    a.last = point;
    this.changed();
  }
  end(id, point) {
    if (!this.points.has(id)) return;
    this.points.delete(id);
    if (this.multi) {
      if (!this.points.size) this.multi = false;
      return;
    }
    const a = this.stroke;
    if (!a || a.id !== id) return;
    this.stroke = null;
    if (!a.item) return;
    if (!a.dragged) {
      this.actions.tap(a.item);
      return;
    }
    const op = this.actions.operation(),
      s = this.actions.state();
    const target = this.scene.pick(point.x, point.y, [op?.to], a.item);
    if (a.item === op?.from && op.to && target === op.to) {
      this.actions.perform({ from: a.item, to: target });
      return;
    }
    const ground = this.r.onPlane(point.x, point.y, 0);
    const inside = ground && Math.abs(ground[0]) < 7.5 && Math.abs(ground[2]) < 5;
    if (inside && !op?.to && a.item === op?.from && this.actions.isPlacement()) {
      this.actions.perform({ from: a.item }, this.scene.snapPosition(a.item, ground));
      return;
    }
    if (inside && !target && s.placed[a.item] && this.scene.canMove(a.item, s)) {
      s.positions[a.item] = this.scene.snapPosition(a.item, this.scene.objects[a.item].pos);
    } else if (op?.to && a.item === op.from) this.actions.wrong();
    this.scene.sync(s);
    this.changed();
  }
  cancel() {
    if (this.stroke?.dragged && this.stroke.item)
      this.scene.sync(this.actions.state(), { animate: false });
    this.points.clear();
    this.stroke = null;
    this.multi = false;
    this.actions.dirty();
  }
}
