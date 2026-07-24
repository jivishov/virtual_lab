/**
 * scene.js — Renderer, lighting, camera rig and picking.
 *
 * The camera rig is deliberately "flight simulator": free orbit for looking
 * around, plus numbered preset stations (bench / tip / meniscus / flask) that
 * you snap to for the precision parts of the job. Grabbing the mouse cancels
 * any preset flight in progress.
 */

import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.localClippingEnabled = true;   // required for liquid surfaces
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f1216);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.008, 40);

    // --- orbit state ------------------------------------------------------
    this.target = new THREE.Vector3(0, 1.02, 0);
    this._targetGoal = this.target.clone();
    this.orbit = { radius: 1.05, theta: 0.0, phi: 1.16 };
    this._orbitGoal = { ...this.orbit };
    this.minRadius = 0.055;
    this.maxRadius = 4.2;

    this._flight = null;         // active preset transition
    this._pointers = new Map();
    this._dragMode = null;
    this._dragMoved = 0;
    this._downTime = 0;
    this._pinchDist = 0;
    this.enabled = true;
    this.onClick = null;         // (ndc, event) => void
    this.onDragObject = null;    // (dx, dy) => bool  — consumes drag if true
    this._grabbed = false;

    this._setupLights();
    this._setupEnvironment();
    this._bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.raycaster = new THREE.Raycaster();
    this.pointerNDC = new THREE.Vector2(0, 0);
    this.hasPointer = false;
  }

  // -----------------------------------------------------------------------
  _setupLights() {
    this.scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x30363d, 0.55));

    // Overhead fluorescent bank: the key light, and the one that makes the
    // white tile under the flask worth having.
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(0.55, 2.5, 0.85);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 6;
    key.shadow.camera.left = -1.6;
    key.shadow.camera.right = 1.6;
    key.shadow.camera.top = 1.6;
    key.shadow.camera.bottom = -1.6;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.012;
    this.scene.add(key);
    this.keyLight = key;

    const fill = new THREE.DirectionalLight(0xcfe0f0, 0.55);
    fill.position.set(-1.4, 1.6, 1.1);
    this.scene.add(fill);

    const rim = new THREE.PointLight(0xfff2e0, 3.2, 4, 2);
    rim.position.set(-0.35, 1.85, -0.45);
    this.scene.add(rim);
  }

  _setupEnvironment() {
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      pmrem.compileEquirectangularShader();
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
      this.environment = env.texture;
      this.scene.environment = this.environment;
      pmrem.dispose();
    } catch (err) {
      console.warn('[stage] environment map unavailable, falling back', err);
      this.environment = null;
    }
  }

  // -----------------------------------------------------------------------
  _bindInput() {
    const el = this.canvas;
    el.style.touchAction = 'none';

    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      el.setPointerCapture(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this._dragMoved = 0;
      this._downTime = performance.now();
      this._grabbed = false;
      this._dragMode = e.button === 2 || e.shiftKey ? 'pan' : 'rotate';
      if (this._pointers.size === 2) {
        const [a, b] = [...this._pointers.values()];
        this._pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
      this._updateNDC(e);
    });

    el.addEventListener('pointermove', (e) => {
      this._updateNDC(e);
      const prev = this._pointers.get(e.pointerId);
      if (!prev || !this.enabled) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      prev.x = e.clientX;
      prev.y = e.clientY;
      this._dragMoved += Math.abs(dx) + Math.abs(dy);

      if (this._pointers.size === 2) {
        const [a, b] = [...this._pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this._pinchDist > 0) this._zoom((this._pinchDist - d) * 0.006);
        this._pinchDist = d;
        return;
      }

      // Let interactive controls (the stopcock) claim the drag first.
      if (!this._grabbed && this.onDragObject && this._dragMoved > 2) {
        this._grabbed = this.onDragObject(dx, dy, true);
      } else if (this._grabbed && this.onDragObject) {
        this.onDragObject(dx, dy, false);
        return;
      }
      if (this._grabbed) return;

      this._flight = null;
      if (this._dragMode === 'pan') this._pan(dx, dy);
      else {
        this._orbitGoal.theta -= dx * 0.0055;
        this._orbitGoal.phi = THREE.MathUtils.clamp(
          this._orbitGoal.phi - dy * 0.0048, 0.12, 1.62,
        );
      }
    });

    const release = (e) => {
      if (!this._pointers.has(e.pointerId)) return;
      this._pointers.delete(e.pointerId);
      this._pinchDist = 0;
      const quick = performance.now() - this._downTime < 450;
      if (!this._grabbed && quick && this._dragMoved < 7 && this.onClick) {
        this._updateNDC(e);
        this.onClick(this.pointerNDC, e);
      }
      if (this._grabbed) this.onDragEnd?.();
      this._grabbed = false;
      this._dragMode = null;
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this._flight = null;
      this._zoom(e.deltaY * 0.0011);
    }, { passive: false });
  }

  _updateNDC(e) {
    const r = this.canvas.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    this.hasPointer = true;
  }

  _zoom(amount) {
    this._orbitGoal.radius = THREE.MathUtils.clamp(
      this._orbitGoal.radius * Math.exp(amount), this.minRadius, this.maxRadius,
    );
  }

  _pan(dx, dy) {
    const scale = this._orbitGoal.radius * 0.0016;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
    const delta = right.multiplyScalar(-dx * scale).add(up.multiplyScalar(dy * scale));
    this._targetGoal.add(delta);
    this._targetGoal.y = THREE.MathUtils.clamp(this._targetGoal.y, 0.35, 2.1);
    this._targetGoal.x = THREE.MathUtils.clamp(this._targetGoal.x, -1.3, 1.3);
    this._targetGoal.z = THREE.MathUtils.clamp(this._targetGoal.z, -0.9, 0.9);
  }

  /** Fly to a preset station. */
  flyTo({ target, radius, theta, phi, duration = 0.85 }) {
    this._flight = {
      t: 0,
      duration,
      from: { target: this.target.clone(), ...this.orbit },
      to: {
        target: target ? target.clone() : this.target.clone(),
        radius: radius ?? this.orbit.radius,
        theta: theta ?? this.orbit.theta,
        phi: phi ?? this.orbit.phi,
      },
    };
  }

  update(dt) {
    if (this._flight) {
      const f = this._flight;
      f.t = Math.min(1, f.t + dt / f.duration);
      const k = easeInOut(f.t);
      this.target.lerpVectors(f.from.target, f.to.target, k);
      this._targetGoal.copy(this.target);
      // shortest angular path
      let dTheta = f.to.theta - f.from.theta;
      while (dTheta > Math.PI) dTheta -= Math.PI * 2;
      while (dTheta < -Math.PI) dTheta += Math.PI * 2;
      this.orbit.theta = f.from.theta + dTheta * k;
      this.orbit.phi = f.from.phi + (f.to.phi - f.from.phi) * k;
      this.orbit.radius = f.from.radius + (f.to.radius - f.from.radius) * k;
      this._orbitGoal = { ...this.orbit };
      if (f.t >= 1) this._flight = null;
    } else {
      const k = 1 - Math.exp(-dt * 13);
      this.orbit.radius += (this._orbitGoal.radius - this.orbit.radius) * k;
      this.orbit.theta += (this._orbitGoal.theta - this.orbit.theta) * k;
      this.orbit.phi += (this._orbitGoal.phi - this.orbit.phi) * k;
      this.target.lerp(this._targetGoal, k);
    }

    const { radius, theta, phi } = this.orbit;
    const sp = Math.sin(phi);
    this.camera.position.set(
      this.target.x + radius * sp * Math.sin(theta),
      this.target.y + radius * Math.cos(phi),
      this.target.z + radius * sp * Math.cos(theta),
    );
    this.camera.lookAt(this.target);
  }

  /** Raycast against a list of meshes, returning the first hit. */
  pick(objects) {
    if (!this.hasPointer) return null;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(objects, true);
    return hits.length ? hits[0] : null;
  }

  /** Project a world point to CSS pixels within the canvas. */
  project(v3) {
    const p = v3.clone().project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((p.x + 1) / 2) * r.width,
      y: ((1 - p.y) / 2) * r.height,
      visible: p.z < 1,
    };
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// ---------------------------------------------------------------------------
// small geometry helpers shared by lab.js / apparatus.js
// ---------------------------------------------------------------------------

export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function cyl(rt, rb, h, mat, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...opts });
}

/** Canvas-drawn label texture, used for every bottle label in the lab. */
export function labelTexture(lines, {
  w = 256, h = 160, bg = '#fbfbf7', fg = '#12161b', accent = '#b02a37', band = true,
} = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (band) {
    g.fillStyle = accent;
    g.fillRect(0, 0, w, 10);
    g.fillRect(0, h - 10, w, 10);
  }
  g.fillStyle = fg;
  g.textAlign = 'center';
  const n = lines.length;
  lines.forEach((line, i) => {
    const size = i === 0 ? 34 : 22;
    g.font = `${i === 0 ? '700' : '400'} ${size}px ui-monospace, "DejaVu Sans Mono", monospace`;
    g.fillText(line, w / 2, h / 2 + (i - (n - 1) / 2) * 30 + 10, w - 16);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
