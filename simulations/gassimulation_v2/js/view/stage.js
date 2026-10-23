/**
 * Renderer, camera, lights and the studio sweep. One instance for the app.
 * Scenes add their own groups to stage.scene and ask for a camera framing.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export class Stage {
  constructor(container) {
    this.container = container;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Apparatus moves slowly; refresh the shadow map at 10 Hz, not every frame.
    renderer.shadowMap.autoUpdate = false;
    this.shadowClock = 0;
    renderer.localClippingEnabled = true;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 3, 12);

    const controls = new OrbitControls(this.camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 22;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minPolarAngle = Math.PI * 0.12;
    this.controls = controls;

    this.hemi = new THREE.HemisphereLight(0xf4f7fa, 0x9aa3a8, 0.55);
    scene.add(this.hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    this.key = key;
    key.position.set(4.5, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -7; key.shadow.camera.right = 7;
    key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
    key.shadow.camera.near = 1; key.shadow.camera.far = 30;
    key.shadow.bias = -0.0004;
    key.shadow.radius = 5;
    scene.add(key, key.target);
    const rim = new THREE.DirectionalLight(0xdfe9f2, 0.45);
    rim.position.set(-6, 4, -5);
    scene.add(rim);

    // Seamless sweep: only the contact shadow shows.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    this.floor = floor;

    this.flight = null;
    this.framing = null;
    this.userMoved = false;
    controls.addEventListener('start', () => { this.userMoved = true; this.flight = null; });
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  /** Lights, fog, shadow coverage and floor for the current environment. */
  setEnvironment(e = {}) {
    this.key.color.setHex(e.key ?? 0xffffff);
    this.key.intensity = e.keyIntensity ?? 1.5;
    this.key.position.set(...(e.keyPos ?? [4.5, 9, 6]));
    const size = e.shadowSize ?? 7;
    const cam = this.key.shadow.camera;
    cam.left = -size; cam.right = size; cam.top = size; cam.bottom = -size;
    cam.far = Math.max(30, size * 5);
    cam.updateProjectionMatrix();
    this.key.position.multiplyScalar(Math.max(1, size / 7));
    this.hemi.color.setHex(e.hemiSky ?? 0xf4f7fa);
    this.hemi.groundColor.setHex(e.hemiGround ?? 0x9aa3a8);
    this.hemi.intensity = e.hemiIntensity ?? 0.55;
    this.scene.fog = e.fog ? new THREE.Fog(e.fog.color, e.fog.near, e.fog.far) : null;
    this.floor.visible = e.floor !== false;
    this.envBackground = e.background ?? null;
    this.renderer.shadowMap.needsUpdate = true;
  }

  setBackground(color) {
    if (!this.scene.background) this.scene.background = new THREE.Color();
    this.scene.background.set(color);
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.framing && !this.userMoved && !this.flight) this.frame(this.framing, { instant: true });
  }

  /** Framings are tuned for a wide stage; back the camera off on narrower ones. */
  fitted({ position, target }) {
    const t = new THREE.Vector3(...target);
    const p = new THREE.Vector3(...position);
    const k = Math.max(1, 1.45 / (this.camera.aspect || 1.45));
    return { position: t.clone().add(p.sub(t).multiplyScalar(k)), target: t };
  }

  /** Glide to a framing. The one orchestrated motion in the app. */
  frame(framing, { instant = false } = {}) {
    this.framing = framing;
    this.userMoved = false;
    this.controls.minDistance = framing.minDistance ?? 4;
    this.controls.maxDistance = framing.maxDistance ?? 22;
    this.camera.far = framing.far ?? 100;
    this.camera.updateProjectionMatrix();
    const to = this.fitted(framing);
    if (instant || this.reducedMotion) {
      this.camera.position.copy(to.position);
      this.controls.target.copy(to.target);
      this.flight = null;
      return;
    }
    this.flight = {
      t: 0, duration: 1.1,
      from: { position: this.camera.position.clone(), target: this.controls.target.clone() },
      to,
    };
  }

  render(dt) {
    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + dt / f.duration);
      const k = ease(f.t);
      this.camera.position.lerpVectors(f.from.position, f.to.position, k);
      this.controls.target.lerpVectors(f.from.target, f.to.target, k);
      if (f.t >= 1) this.flight = null;
    }
    this.controls.update();
    this.shadowClock -= dt;
    if (this.shadowClock <= 0) { this.renderer.shadowMap.needsUpdate = true; this.shadowClock = 0.1; }
    this.renderer.render(this.scene, this.camera);
  }
}
