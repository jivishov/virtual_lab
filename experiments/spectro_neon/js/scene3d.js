// scene3d.js - Photorealistic Three.js WebGL Engine for Blender 5.2 GLB Lab Assets
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import * as config from './config.js';
import { getState, findObjectById } from './state.js';

let containerEl = null;
let labelsOverlayEl = null;
let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let clock = null;
let rafId = null;

// Loaded asset instances indexed by logical lab object ID
const objects3D = new Map();
const pickTargets = []; // Invisible ergonomic hit volumes + direct clickable parts
const labelAnchors = new Map(); // id -> { el, localOffset: Vector3, getText: fn }
let labelsVisible = true;

// Smooth animation state
const animState = {
    // Smoothly interpolated visual liquid fill ratios per object id
    fillRatios: new Map(),
    // Bottle cap open amounts (0 = closed, 1 = lifted aside)
    capOpen: new Map(),
    capHoverTarget: null,
    // Spec 20 hinged lid open amount (0 = closed, 1 = open)
    lidOpen: 0,
    lidTarget: 0,
    // Spec 20 button physical press timers
    btnPress: { zero: 0, measure: 0, mode: 0 },
    beamFlash: 0,
    // Active choreographed action animation (dip/dispense/pour/insert)
    activeChoreo: null,
    // Camera flight tween
    cameraFlight: null,
    // Active drag override
    draggedId: null,
    dragWorldPos: new THREE.Vector3(),
    dropHoverId: null,
};

// Reusable fluid pour/dispense stream mesh
let pourStreamMesh = null;
let pourStreamMat = null;

// Spec 20 live LCD canvas texture
let specLcdCanvas = null;
let specLcdCtx = null;
let specLcdTexture = null;
let lastSpecDisplayKey = '';

// Shared highlight ring geometry
const ringGeoCache = new Map();

// ---------------------------------------------------------------------------
// Liquid Beer-Lambert Optical Color Helper
// ---------------------------------------------------------------------------

export function getLiquidOpticalStyle(concentration, isWaste = false) {
    if (isWaste) {
        return {
            color: new THREE.Color(0x47648e),
            opacity: 0.78,
            emissive: new THREE.Color(0x0b1526),
        };
    }
    if (concentration === null || concentration === undefined) {
        return {
            color: new THREE.Color(0x64748b),
            opacity: 0.65,
            emissive: new THREE.Color(0x080d14),
        };
    }
    if (concentration === -1) {
        // Unknown Drink — rich translucent royal violet-indigo beverage
        return {
            color: new THREE.Color(0x6e18de),
            opacity: 0.90,
            emissive: new THREE.Color(0x16032e),
        };
    }

    const eff = Math.max(0, Math.min(concentration, config.STOCK_CONCENTRATION));
    const t = config.STOCK_CONCENTRATION > 0 ? eff / config.STOCK_CONCENTRATION : 0;

    // Non-linear Beer-Lambert visual perception curve so dilute tubes (2/8, 4/6) stay vividly distinct
    const perceived = Math.pow(t, 0.72);
    const waterCol = new THREE.Color(0xd2ecff);
    const stockCol = new THREE.Color(0x0432ee);
    const col = waterCol.clone().lerp(stockCol, perceived);

    const opacity = 0.34 + 0.60 * perceived;
    const emissive = new THREE.Color(0x020b2a).multiplyScalar(perceived * 0.85);
    return { color: col, opacity, emissive };
}

// ---------------------------------------------------------------------------
// Node Lookup & PBR Material Enhancement for Blender 5.2 GLBs
// ---------------------------------------------------------------------------

function findNodeByPrefix(root, prefix) {
    let found = null;
    root.traverse((child) => {
        if (found) return;
        if (
            child.name === prefix ||
            child.name.startsWith(prefix + '.') ||
            child.name.startsWith(prefix + '_')
        ) {
            found = child;
        }
    });
    return found;
}

function findExactOrDotNode(root, baseName) {
    // Three.js GLTFLoader sanitizes Blender's '.001' suffixes to '001' (stripping the dot)
    const re = new RegExp(`^${baseName}(?:[._]?\\d+)?$`);
    let found = null;
    root.traverse((child) => {
        if (found) return;
        if (re.test(child.name)) {
            found = child;
        }
    });
    return found;
}

function makeBorosilicateGlassMat(isFrosted = false) {
    if (isFrosted) {
        return new THREE.MeshPhysicalMaterial({
            color: 0xe6eff7,
            transparent: true,
            opacity: 0.44,
            roughness: 0.40,
            metalness: 0.02,
            ior: 1.49,
            reflectivity: 0.85,
            clearcoat: 0.4,
            clearcoatRoughness: 0.35,
            envMapIntensity: 1.4,
            depthWrite: false,
            side: THREE.FrontSide,
        });
    }
    return new THREE.MeshPhysicalMaterial({
        color: 0xf0f8ff,
        transparent: true,
        opacity: 0.24,
        roughness: 0.035,
        metalness: 0.02,
        ior: 1.47,
        reflectivity: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        envMapIntensity: 2.15,
        depthWrite: false,
        side: THREE.FrontSide,
    });
}

function makeDynamicLiquidMat(style) {
    return new THREE.MeshPhysicalMaterial({
        color: style.color.clone(),
        emissive: style.emissive.clone(),
        emissiveIntensity: 0.65,
        transparent: true,
        opacity: style.opacity,
        roughness: 0.05,
        metalness: 0.0,
        ior: 1.333,
        reflectivity: 0.92,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        envMapIntensity: 1.65,
        depthWrite: true,
        side: THREE.DoubleSide,
    });
}

function enhanceLoadedAssetMaterials(root, options = {}) {
    const liquidStyle = options.liquidStyle || getLiquidOpticalStyle(0);
    const sharedLiquidMat = options.hasDynamicLiquid ? makeDynamicLiquidMat(liquidStyle) : null;
    const clearGlassMat = makeBorosilicateGlassMat(false);
    const frostedGlassMat = makeBorosilicateGlassMat(true);

    root.traverse((obj) => {
        if (!obj.isMesh) return;
        const name = obj.name || '';
        const matName = obj.material?.name || '';

        obj.castShadow = true;
        obj.receiveShadow = true;

        // Dynamic Liquid Meshes
        if (
            sharedLiquidMat &&
            (name.startsWith('LiquidBody') ||
                name.startsWith('LiquidBottom') ||
                name.startsWith('LiquidColumn') ||
                name.startsWith('LiquidStem') ||
                name.startsWith('LiquidTip') ||
                name.startsWith('LiquidMeniscus'))
        ) {
            obj.material = sharedLiquidMat;
            obj.renderOrder = 1;
            obj.castShadow = false;
            return;
        }

        // Cuvette Residue Film
        if (name.startsWith('ResidueFilm')) {
            obj.material = new THREE.MeshPhysicalMaterial({
                color: 0x3b82f6,
                transparent: true,
                opacity: 0.24,
                roughness: 0.35,
                depthWrite: false,
            });
            obj.renderOrder = 2;
            obj.visible = false;
            obj.castShadow = false;
            return;
        }

        // Borosilicate Glassware (supports multi-material cuvette clear + frosted!)
        if (
            name.startsWith('GlassBody') ||
            name.startsWith('CuvetteGlass') ||
            matName.includes('Glass') ||
            matName.includes('Acrylic')
        ) {
            if (Array.isArray(obj.material)) {
                obj.material = obj.material.map((m) =>
                    (m.name || '').includes('Frosted') ? frostedGlassMat : clearGlassMat
                );
            } else if (matName.includes('Frosted') || matName.includes('Acrylic')) {
                obj.material = frostedGlassMat;
            } else {
                obj.material = clearGlassMat;
            }
            obj.renderOrder = 3;
            obj.castShadow = false;
            return;
        }

        // Transparent Ceramic Graduations on Pipettes & Waste Beaker
        if (name.startsWith('BeakerGraduations') || name.startsWith('PipetteGraduations')) {
            if (obj.material) {
                obj.material.transparent = true;
                obj.material.depthWrite = false;
                obj.material.alphaTest = 0.04;
                obj.material.roughness = 0.35;
                obj.material.side = THREE.FrontSide;
            }
            obj.renderOrder = 4;
            obj.castShadow = false;
            return;
        }

        // Printed Paper Bottle Labels
        if (name.startsWith('BottleLabel')) {
            if (obj.material) {
                obj.material.roughness = 0.58;
                obj.material.metalness = 0.0;
                obj.material.envMapIntensity = 0.75;
            }
            obj.renderOrder = 4;
            return;
        }

        // Standard opaque PBR materials — enhance reflection crispness
        if (obj.material && !Array.isArray(obj.material)) {
            obj.material.envMapIntensity = obj.material.metalness > 0.5 ? 1.35 : 0.95;
        }
    });

    return sharedLiquidMat;
}

// ---------------------------------------------------------------------------
// Highlight Ring Beacon & Ergonomic Pick Collider Helpers
// ---------------------------------------------------------------------------

function createHighlightBeacon(radius = 0.048) {
    const key = radius.toFixed(4);
    let geo = ringGeoCache.get(key);
    if (!geo) {
        geo = new THREE.RingGeometry(radius, radius + 0.0075, 48);
        geo.rotateX(-Math.PI / 2);
        ringGeoCache.set(key, geo);
    }
    const mat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.0022;
    mesh.renderOrder = 5;
    mesh.visible = false;
    return mesh;
}

function addPickCollider(parent, interactId, shape, dims, offsetY = 0, extra = {}) {
    let geo;
    if (shape === 'cylinder') {
        geo = new THREE.CylinderGeometry(dims[0], dims[0], dims[1], 14);
    } else {
        geo = new THREE.BoxGeometry(dims[0], dims[1], dims[2]);
    }
    const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
    });
    const hit = new THREE.Mesh(geo, mat);
    hit.position.y = offsetY;
    hit.userData = { interactId, ...extra };
    hit.name = `__Hit_${interactId}`;
    parent.add(hit);
    pickTargets.push(hit);
    return hit;
}

// ---------------------------------------------------------------------------
// Live Spectronic 20D+ Digital LCD Canvas Texture
// ---------------------------------------------------------------------------

function initSpecDisplayCanvas() {
    specLcdCanvas = document.createElement('canvas');
    specLcdCanvas.width = 512;
    specLcdCanvas.height = 160;
    specLcdCtx = specLcdCanvas.getContext('2d');
    specLcdTexture = new THREE.CanvasTexture(specLcdCanvas);
    specLcdTexture.flipY = false; // glTF 2.0 UV convention has V=0 at top
    specLcdTexture.colorSpace = THREE.SRGBColorSpace;
    specLcdTexture.anisotropy = 8;
}

function updateSpecDisplayTexture(specState, force = false) {
    if (!specLcdCtx || !specLcdTexture) return;
    const key = `${specState.reading}|${specState.wavelength}|${specState.isZeroed}|${specState.absorbanceMode}|${specState.cuvetteInsideId || ''}|${animState.beamFlash > 0.05 ? 1 : 0}`;
    if (!force && key === lastSpecDisplayKey) return;
    lastSpecDisplayKey = key;

    const ctx = specLcdCtx;
    const W = specLcdCanvas.width;
    const H = specLcdCanvas.height;

    // Deep recessed emerald-dark LCD panel
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#071610');
    grad.addColorStop(0.5, '#0b2218');
    grad.addColorStop(1, '#06140e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle scanline texture
    ctx.fillStyle = 'rgba(130, 255, 160, 0.03)';
    for (let y = 0; y < H; y += 4) {
        ctx.fillRect(0, y, W, 1);
    }

    // Inner bezel frame
    ctx.strokeStyle = 'rgba(118, 255, 140, 0.25)';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, W - 12, H - 12);

    // Top status bar: Wavelength & Mode
    ctx.font = 'bold 20px "Consolas", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6ee7b7';
    ctx.fillText(`λ ${specState.wavelength} nm`, 18, 32);

    ctx.textAlign = 'right';
    ctx.fillStyle = specState.absorbanceMode ? '#c084fc' : '#38bdf8';
    ctx.fillText(specState.absorbanceMode ? 'MODE: ABS' : 'MODE: %T', W - 18, 32);

    // Main digital numeric readout
    ctx.save();
    ctx.font = 'bold 64px "Consolas", "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.shadowColor = '#76ff03';
    ctx.shadowBlur = animState.beamFlash > 0.05 ? 24 : 12;
    ctx.fillStyle = '#c6ff00';
    ctx.fillText(specState.reading || '-- %T', W - 22, 108);
    ctx.restore();

    // Bottom indicators: ZEROED + CUVETTE IN
    ctx.font = 'bold 17px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = specState.isZeroed ? '#4ade80' : '#fbbf24';
    ctx.fillText(specState.isZeroed ? '● ZEROED' : '○ ZERO NEEDED', 18, 142);

    ctx.textAlign = 'right';
    ctx.fillStyle = specState.cuvetteInsideId ? '#38bdf8' : '#64748b';
    ctx.fillText(specState.cuvetteInsideId ? '■ CUVETTE SEATED' : '□ CHAMBER EMPTY', W - 18, 142);

    specLcdTexture.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Floating 3D-Projected Labels Overlay
// ---------------------------------------------------------------------------

function registerLabel(id, anchorPos, getText, accentColor = null) {
    if (!labelsOverlayEl) return;
    const el = document.createElement('div');
    el.className = 'label-3d';
    if (accentColor) {
        el.style.setProperty('--label-accent', accentColor);
        el.classList.add('label-3d--accented');
    }
    el.dataset.id = id;
    labelsOverlayEl.appendChild(el);
    labelAnchors.set(id, { el, offset: anchorPos.clone(), getText });
}

export function setLabelsVisible(visible) {
    labelsVisible = Boolean(visible);
    if (labelsOverlayEl) {
        labelsOverlayEl.classList.toggle('labels-overlay--hidden', !labelsVisible);
    }
}

export function getLabelsVisible() {
    return labelsVisible;
}

function updateProjectedLabels() {
    if (!labelsVisible || !camera || !renderer) return;
    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;
    if (width === 0 || height === 0) return;

    const state = getState();
    const tmp = new THREE.Vector3();

    for (const [id, info] of labelAnchors.entries()) {
        const entry = objects3D.get(id);
        if (!entry) continue;

        entry.root.updateWorldMatrix(true, false);
        tmp.copy(info.offset).applyMatrix4(entry.root.matrixWorld);
        tmp.project(camera);

        if (tmp.z > 1 || tmp.z < -1) {
            info.el.style.opacity = '0';
            continue;
        }

        const sx = (tmp.x * 0.5 + 0.5) * width;
        const sy = (-tmp.y * 0.5 + 0.5) * height;
        info.el.style.transform = `translate(-50%, -100%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        info.el.style.opacity = '1';

        const obj = findObjectById(id);
        const text = info.getText(obj, state);
        if (info.el.textContent !== text) {
            info.el.textContent = text;
        }

        const isHighlighted = state.highlights.includes(id);
        const isSelected = state.selectedObjectId === id || animState.draggedId === id;
        const isDropHover = animState.dropHoverId === id;
        info.el.classList.toggle('label-3d--highlight', isHighlighted);
        info.el.classList.toggle('label-3d--selected', isSelected);
        info.el.classList.toggle('label-3d--drop', isDropHover);
    }
}

// ---------------------------------------------------------------------------
// Scene Initialization & Parallel GLB Asset Loading
// ---------------------------------------------------------------------------

export async function initScene3D(viewportEl, labelsEl, onProgress = null) {
    containerEl = viewportEl;
    labelsOverlayEl = labelsEl;
    clock = new THREE.Clock();

    // Renderer configured for photorealistic PBR + ACES Filmic tone mapping + crisp soft shadows
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true, // Enables crisp visual inspection screenshots
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(containerEl.clientWidth || 960, containerEl.clientHeight || 560);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerEl.appendChild(renderer.domElement);

    // Scene & subtle laboratory atmosphere
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcbd5e1);

    // Camera (ergonomic 35mm lab scientist perspective)
    const aspect = (containerEl.clientWidth || 960) / (containerEl.clientHeight || 560);
    camera = new THREE.PerspectiveCamera(38, aspect, 0.04, 15.0);
    const ov = config.CAMERA_PRESETS.overview;
    camera.position.set(...ov.pos);

    // OrbitControls (damped, bounded so camera never clips below bench or behind wall)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...ov.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.28;
    controls.maxDistance = 1.85;
    controls.minPolarAngle = 0.14;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.panSpeed = 0.65;
    controls.update();

    // Photorealistic Studio Chemistry Lab Lighting + Blender Cycles OPTIX HDRI!
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    try {
        const rgbeLoader = new RGBELoader();
        const hdrTex = await rgbeLoader.loadAsync('./assets/env/lab_studio.hdr');
        const envRT = pmrem.fromEquirectangular(hdrTex);
        scene.environment = envRT.texture;
        hdrTex.dispose();
    } catch (err) {
        console.warn('Fallback to RoomEnvironment (HDRI load issue):', err);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    }
    pmrem.dispose();

    // Soft overhead laboratory troffer key light (casts crisp soft shadows onto dark epoxy bench)
    const hemi = new THREE.HemisphereLight(0xf1f7ff, 0x1e293b, 0.52);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfcfdff, 1.55);
    keyLight.position.set(-0.35, 1.45, 0.72);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.2;
    keyLight.shadow.camera.far = 3.5;
    keyLight.shadow.camera.left = -0.95;
    keyLight.shadow.camera.right = 0.95;
    keyLight.shadow.camera.top = 0.75;
    keyLight.shadow.camera.bottom = -0.65;
    keyLight.shadow.bias = -0.00035;
    keyLight.shadow.normalBias = 0.008;
    scene.add(keyLight);

    // Subtle cool rim fill from lab window on left
    const rimLight = new THREE.DirectionalLight(0xdbeafe, 0.55);
    rimLight.position.set(-1.3, 0.7, -0.5);
    scene.add(rimLight);

    // Subtle warm fill from right to give metallic/glass contrast
    const warmFill = new THREE.DirectionalLight(0xfff1dc, 0.38);
    warmFill.position.set(1.2, 0.65, 0.55);
    scene.add(warmFill);

    // Reusable fluid delivery / pour stream cylinder
    pourStreamMat = new THREE.MeshPhysicalMaterial({
        color: 0x0432ee,
        transparent: true,
        opacity: 0.85,
        roughness: 0.05,
        clearcoat: 1.0,
    });
    const streamGeo = new THREE.CylinderGeometry(0.0014, 0.0011, 1.0, 12);
    streamGeo.translate(0, -0.5, 0); // origin at top spout/tip, extends down -Y
    pourStreamMesh = new THREE.Mesh(streamGeo, pourStreamMat);
    pourStreamMesh.visible = false;
    pourStreamMesh.renderOrder = 4;
    scene.add(pourStreamMesh);

    initSpecDisplayCanvas();

    // Load all Blender 5.2 GLB models in parallel!
    const gltfLoader = new GLTFLoader();
    const assetPaths = {
        bench: './assets/models/lab_bench.glb',
        bottle_stock: './assets/models/bottle_stock.glb',
        bottle_water: './assets/models/bottle_water.glb',
        bottle_unknown: './assets/models/bottle_unknown.glb',
        pipette_stand: './assets/models/pipette_stand.glb',
        pipette_stock: './assets/models/pipette_stock.glb',
        pipette_water: './assets/models/pipette_water.glb',
        pipette_unknown: './assets/models/pipette_unknown.glb',
        test_tube_rack: './assets/models/test_tube_rack.glb',
        test_tube: './assets/models/test_tube.glb',
        cuvette_holder: './assets/models/cuvette_holder.glb',
        cuvette: './assets/models/cuvette.glb',
        waste_beaker: './assets/models/waste_beaker.glb',
        spec20: './assets/models/spec20.glb',
    };

    const keys = Object.keys(assetPaths);
    let loadedCount = 0;
    const loadedMap = {};

    await Promise.all(
        keys.map(async (k) => {
            const gltf = await gltfLoader.loadAsync(assetPaths[k]);
            loadedMap[k] = gltf.scene;
            loadedCount++;
            if (onProgress) onProgress(loadedCount / keys.length);
        })
    );

    // Mount all apparatus at exact LAYOUT_3D world coordinates
    mountBench(loadedMap.bench);
    mountStaticStand('pipetteStand', loadedMap.pipette_stand, config.LAYOUT_3D.pipetteStand);
    mountStaticStand('testTubeRack', loadedMap.test_tube_rack, config.LAYOUT_3D.testTubeRack);
    mountStaticStand('cuvetteHolder', loadedMap.cuvette_holder, config.LAYOUT_3D.cuvetteHolder);

    mountBottle('stockBottle', loadedMap.bottle_stock, config.LAYOUT_3D.stockBottle, config.STOCK_CONCENTRATION, 0.052, 'Stock Blue #1');
    mountBottle('waterBottle', loadedMap.bottle_water, config.LAYOUT_3D.waterBottle, 0, 0.052, 'Distilled H₂O');
    mountBottle('unknownBottle', loadedMap.bottle_unknown, config.LAYOUT_3D.unknownBottle, -1, 0.046, 'Unknown Drink');

    mountPipette('pipette_stock', loadedMap.pipette_stock, config.LAYOUT_3D.pipette_stock, '#3b82f6');
    mountPipette('pipette_water', loadedMap.pipette_water, config.LAYOUT_3D.pipette_water, '#22d3ee');
    mountPipette('pipette_unknown', loadedMap.pipette_unknown, config.LAYOUT_3D.pipette_unknown, '#a855f7');

    // Instantiate 6 independent test tubes from the Blender test_tube.glb template!
    const tubeIds = ['tube_10_0', 'tube_8_2', 'tube_6_4', 'tube_4_6', 'tube_2_8', 'tube_0_10'];
    tubeIds.forEach((tid, idx) => {
        const clone = idx === 0 ? loadedMap.test_tube : loadedMap.test_tube.clone(true);
        mountTestTube(tid, clone, config.LAYOUT_3D[tid]);
    });

    mountCuvette('cuvette', loadedMap.cuvette, config.LAYOUT_3D.cuvette);
    mountWasteBeaker('wasteBeaker', loadedMap.waste_beaker, config.LAYOUT_3D.wasteBeaker);
    mountSpec20('spec20', loadedMap.spec20, config.LAYOUT_3D.spec20);

    // Sync initial visual state immediately
    syncSceneFromState(true);

    // Resize listener
    const onResize = () => {
        if (!containerEl || !renderer || !camera) return;
        const w = containerEl.clientWidth || 960;
        const h = containerEl.clientHeight || 560;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Start 60fps animation loop
    const animate = () => {
        rafId = requestAnimationFrame(animate);
        const dt = Math.min(clock.getDelta(), 0.05);
        updateAnimations(dt);
        controls.update();
        renderer.render(scene, camera);
        updateProjectedLabels();
    };
    animate();

    return {
        renderer,
        scene,
        camera,
        controls,
        domElement: renderer.domElement,
    };
}

// ---------------------------------------------------------------------------
// Apparatus Mount Helpers
// ---------------------------------------------------------------------------

function mountBench(gltfScene) {
    enhanceLoadedAssetMaterials(gltfScene);
    gltfScene.traverse((o) => {
        if (o.isMesh) {
            o.castShadow = false;
            o.receiveShadow = true;
        }
    });
    scene.add(gltfScene);
}

function mountStaticStand(id, gltfScene, posCfg) {
    enhanceLoadedAssetMaterials(gltfScene);
    gltfScene.position.set(posCfg.x, posCfg.y, posCfg.z);
    gltfScene.rotation.y = posCfg.rotY || 0;
    scene.add(gltfScene);
}

function mountBottle(id, gltfScene, posCfg, initialConc, beaconRadius, displayName) {
    const group = new THREE.Group();
    group.position.set(posCfg.x, posCfg.y, posCfg.z);
    group.rotation.y = posCfg.rotY || 0;
    group.add(gltfScene);
    scene.add(group);

    const liqMat = enhanceLoadedAssetMaterials(gltfScene, {
        hasDynamicLiquid: true,
        liquidStyle: getLiquidOpticalStyle(initialConc),
    });

    const metaNode = gltfScene.children[0] || gltfScene;
    const isSmall = id === 'unknownBottle';
    const liquidBaseY = metaNode.userData?.liquidBaseY ?? 0.0076;
    const liquidMaxHeight = metaNode.userData?.liquidMaxHeight ?? (isSmall ? 0.082 : 0.104);
    const neckTopY = metaNode.userData?.neckTopY ?? (isSmall ? 0.156 : 0.184);

    const liquidBody = findExactOrDotNode(gltfScene, 'LiquidBody');
    const liquidMeniscus = findExactOrDotNode(gltfScene, 'LiquidMeniscus');
    const bottleCap = findExactOrDotNode(gltfScene, 'BottleCap');
    const capRestPos = bottleCap ? bottleCap.position.clone() : new THREE.Vector3(0, neckTopY, 0);

    const beacon = createHighlightBeacon(beaconRadius);
    group.add(beacon);

    addPickCollider(group, id, 'cylinder', [isSmall ? 0.044 : 0.050, neckTopY + 0.025], (neckTopY + 0.025) * 0.5);

    objects3D.set(id, {
        id,
        type: 'bottle',
        root: group,
        homePos: new THREE.Vector3(posCfg.x, posCfg.y, posCfg.z),
        homeRotY: posCfg.rotY || 0,
        liquidMat: liqMat,
        liquidBody,
        liquidMeniscus,
        liquidBaseY,
        liquidMaxHeight,
        neckTopY,
        bottleCap,
        capRestPos,
        beacon,
        mouthOffset: new THREE.Vector3(0, neckTopY + 0.012, 0),
    });
    animState.fillRatios.set(id, 1.0);
    animState.capOpen.set(id, 0.0);

    // Stagger bottle label heights cleanly so adjacent reagent pills never touch
    const bottleLabelHeights = {
        stockBottle: neckTopY + 0.024,
        waterBottle: neckTopY + 0.064,
        unknownBottle: neckTopY + 0.024,
    };
    registerLabel(id, new THREE.Vector3(0, bottleLabelHeights[id] ?? neckTopY + 0.036, 0), () => displayName);
}

function mountPipette(id, gltfScene, posCfg, accentColor) {
    const group = new THREE.Group();
    group.position.set(posCfg.x, posCfg.y, posCfg.z);
    group.rotation.y = posCfg.rotY || 0;
    group.add(gltfScene);
    scene.add(group);

    const liqMat = enhanceLoadedAssetMaterials(gltfScene, {
        hasDynamicLiquid: true,
        liquidStyle: getLiquidOpticalStyle(0),
    });

    const metaNode = gltfScene.children[0] || gltfScene;
    const liquidBaseY = metaNode.userData?.liquidBaseY ?? 0.036;
    const liquidMaxHeight = metaNode.userData?.liquidMaxHeight ?? 0.146;

    const liquidTip = findExactOrDotNode(gltfScene, 'LiquidTip');
    const liquidStem = findExactOrDotNode(gltfScene, 'LiquidStem');
    const liquidMeniscus = findExactOrDotNode(gltfScene, 'LiquidMeniscus');
    const bulb = findExactOrDotNode(gltfScene, 'PipetteBulb');

    // Beacon sits at stand drip-cup height just beneath pipette tip
    const beacon = createHighlightBeacon(0.020);
    beacon.position.y = 0.002;
    group.add(beacon);

    // Generous ergonomic picking cylinder spanning entire pipette (tip to bulb)
    addPickCollider(group, id, 'cylinder', [0.021, 0.255], 0.128);

    objects3D.set(id, {
        id,
        type: 'pipette',
        root: group,
        homePos: new THREE.Vector3(posCfg.x, posCfg.y, posCfg.z),
        homeRotY: posCfg.rotY || 0,
        liquidMat: liqMat,
        liquidTip,
        liquidStem,
        liquidMeniscus,
        bulb,
        liquidBaseY,
        liquidMaxHeight,
        beacon,
    });
    animState.fillRatios.set(id, 0.0);

    // Stagger center pipette label slightly higher so all 3 dedicated pipette pills stay 100% clear
    const pipLabelY = id === 'pipette_water' ? 0.305 : 0.268;
    registerLabel(
        id,
        new THREE.Vector3(0, pipLabelY, 0),
        (obj) => {
            if (!obj) return '';
            return obj.currentVolume > 0
                ? `${obj.shortLabel} (${obj.currentVolume.toFixed(0)}mL)`
                : obj.shortLabel;
        },
        accentColor
    );
}

function mountTestTube(id, gltfScene, posCfg) {
    const group = new THREE.Group();
    group.position.set(posCfg.x, posCfg.y, posCfg.z);
    group.rotation.y = posCfg.rotY || 0;
    group.add(gltfScene);
    scene.add(group);

    const liqMat = enhanceLoadedAssetMaterials(gltfScene, {
        hasDynamicLiquid: true,
        liquidStyle: getLiquidOpticalStyle(0),
    });

    const metaNode = gltfScene.children[0] || gltfScene;
    const domeTopY = metaNode.userData?.domeTopY ?? 0.0125;
    const columnMaxHeight = metaNode.userData?.columnMaxHeight ?? 0.1045;

    const liquidBottom = findExactOrDotNode(gltfScene, 'LiquidBottom');
    const liquidColumn = findExactOrDotNode(gltfScene, 'LiquidColumn');
    const liquidMeniscus = findExactOrDotNode(gltfScene, 'LiquidMeniscus');

    // Highlight halo right around the test tube rim at top of rack!
    const beacon = createHighlightBeacon(0.0175);
    beacon.position.y = 0.078;
    group.add(beacon);

    addPickCollider(group, id, 'cylinder', [0.0185, 0.158], 0.078);

    objects3D.set(id, {
        id,
        type: 'testTube',
        root: group,
        homePos: new THREE.Vector3(posCfg.x, posCfg.y, posCfg.z),
        homeRotY: posCfg.rotY || 0,
        liquidMat: liqMat,
        liquidBottom,
        liquidColumn,
        liquidMeniscus,
        domeTopY,
        columnMaxHeight,
        beacon,
        mouthOffset: new THREE.Vector3(0, 0.152, 0),
    });
    animState.fillRatios.set(id, 0.0);

    // Alternate test tube label heights (high/low) & stack volume neatly on line 2 so all 6 labels stay narrow & non-overlapping!
    const oddTube = id === 'tube_8_2' || id === 'tube_4_6' || id === 'tube_0_10';
    registerLabel(id, new THREE.Vector3(0, oddTube ? 0.205 : 0.162, 0), (obj) => {
        if (!obj) return '';
        const short = obj.label.replace(' (Blank)', '');
        return obj.currentVolume > 0 ? `${short}\n${obj.currentVolume.toFixed(0)}mL` : short;
    });
}

function mountCuvette(id, gltfScene, posCfg) {
    const group = new THREE.Group();
    group.position.set(posCfg.x, posCfg.y, posCfg.z);
    group.rotation.y = posCfg.rotY || 0;
    group.add(gltfScene);
    scene.add(group);

    const liqMat = enhanceLoadedAssetMaterials(gltfScene, {
        hasDynamicLiquid: true,
        liquidStyle: getLiquidOpticalStyle(0),
    });

    const metaNode = gltfScene.children[0] || gltfScene;
    const liquidBaseY = metaNode.userData?.liquidBaseY ?? 0.0059;
    const liquidMaxHeight = metaNode.userData?.liquidMaxHeight ?? 0.0536;

    const liquidBody = findExactOrDotNode(gltfScene, 'LiquidBody');
    const liquidMeniscus = findExactOrDotNode(gltfScene, 'LiquidMeniscus');
    const residueFilm = findExactOrDotNode(gltfScene, 'ResidueFilm');

    const beacon = createHighlightBeacon(0.032);
    beacon.position.y = -0.003;
    group.add(beacon);

    // Ergonomic click/drag box around optical cuvette
    addPickCollider(group, id, 'box', [0.044, 0.088, 0.044], 0.038);

    objects3D.set(id, {
        id,
        type: 'cuvette',
        root: group,
        homePos: new THREE.Vector3(posCfg.x, posCfg.y, posCfg.z),
        homeRotY: posCfg.rotY || 0,
        liquidMat: liqMat,
        liquidBody,
        liquidMeniscus,
        residueFilm,
        liquidBaseY,
        liquidMaxHeight,
        beacon,
        mouthOffset: new THREE.Vector3(0, 0.072, 0),
    });
    animState.fillRatios.set(id, 0.0);

    registerLabel(id, new THREE.Vector3(0, 0.090, 0), (obj) => {
        if (!obj) return 'Cuvette';
        if (obj.isInSpec) return 'Cuvette (In Spec)';
        if (obj.currentVolume > 0) return `Cuvette (${obj.currentVolume.toFixed(0)} mL)`;
        return obj.isClean ? 'Cuvette (Clean)' : 'Cuvette (Rinse!)';
    });
}

function mountWasteBeaker(id, gltfScene, posCfg) {
    const group = new THREE.Group();
    group.position.set(posCfg.x, posCfg.y, posCfg.z);
    group.rotation.y = posCfg.rotY || 0;
    group.add(gltfScene);
    scene.add(group);

    const liqMat = enhanceLoadedAssetMaterials(gltfScene, {
        hasDynamicLiquid: true,
        liquidStyle: getLiquidOpticalStyle(null, true),
    });

    const metaNode = gltfScene.children[0] || gltfScene;
    const liquidBaseY = metaNode.userData?.liquidBaseY ?? 0.005;
    const liquidMaxHeight = metaNode.userData?.liquidMaxHeight ?? 0.087;

    const liquidBody = findExactOrDotNode(gltfScene, 'LiquidBody');
    const liquidMeniscus = findExactOrDotNode(gltfScene, 'LiquidMeniscus');

    const beacon = createHighlightBeacon(0.052);
    group.add(beacon);

    addPickCollider(group, id, 'cylinder', [0.052, 0.125], 0.062);

    objects3D.set(id, {
        id,
        type: 'beaker',
        root: group,
        homePos: new THREE.Vector3(posCfg.x, posCfg.y, posCfg.z),
        homeRotY: posCfg.rotY || 0,
        liquidMat: liqMat,
        liquidBody,
        liquidMeniscus,
        liquidBaseY,
        liquidMaxHeight,
        beacon,
        mouthOffset: new THREE.Vector3(0, 0.118, 0),
    });
    animState.fillRatios.set(id, 0.0);

    registerLabel(id, new THREE.Vector3(0, 0.130, 0), (obj) => {
        if (!obj) return 'Waste';
        return obj.currentVolume > 0 ? `Waste (${obj.currentVolume.toFixed(0)} mL)` : 'Waste Beaker';
    });
}

function mountSpec20(id, gltfScene, posCfg) {
    const group = new THREE.Group();
    group.position.set(posCfg.x, posCfg.y, posCfg.z);
    group.rotation.y = posCfg.rotY || 0;
    group.add(gltfScene);
    scene.add(group);

    enhanceLoadedAssetMaterials(gltfScene);

    // Wire live HTML5 CanvasTexture onto the Spec 20 digital LCD screen mesh!
    const displayMesh = findExactOrDotNode(gltfScene, 'SpecDisplay');
    if (displayMesh && displayMesh.isMesh) {
        displayMesh.material = new THREE.MeshStandardMaterial({
            map: specLcdTexture,
            emissiveMap: specLcdTexture,
            emissive: new THREE.Color(0xffffff),
            emissiveIntensity: 0.92,
            roughness: 0.15,
            metalness: 0.05,
        });
    }

    const lidPivot = findExactOrDotNode(gltfScene, 'SpecLid');
    const beamLed = findExactOrDotNode(gltfScene, 'OpticalBeamLED');

    // Wire individually clickable 3D physical buttons (`BtnZero`, `BtnMeasure`, `BtnMode`)
    const btnNodes = {
        zero: findExactOrDotNode(gltfScene, 'BtnZero'),
        measure: findExactOrDotNode(gltfScene, 'BtnMeasure'),
        mode: findExactOrDotNode(gltfScene, 'BtnMode'),
    };
    const btnRestZ = {};

    Object.entries(btnNodes).forEach(([btnKey, node]) => {
        if (!node) return;
        btnRestZ[btnKey] = node.position.z;
        // Tag all child meshes + add generous invisible click pad right over each button face
        node.traverse((ch) => {
            if (ch.isMesh) {
                ch.userData.interactId = `btn_${btnKey}`;
                ch.userData.specButton = btnKey;
                pickTargets.push(ch);
            }
        });
        const pad = new THREE.Mesh(
            new THREE.BoxGeometry(0.058, 0.032, 0.024),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
        );
        pad.position.set(0, 0, 0.008);
        pad.userData = { interactId: `btn_${btnKey}`, specButton: btnKey };
        node.add(pad);
        pickTargets.push(pad);
    });

    // Main Spec 20 drop target collider (sample compartment & instrument body)
    addPickCollider(group, id, 'box', [0.35, 0.16, 0.25], 0.08);

    const metaNode = gltfScene.children[0] || gltfScene;
    const slotLocal = new THREE.Vector3(
        metaNode.userData?.slotLocalX ?? 0.098,
        metaNode.userData?.slotLocalY ?? 0.100,
        metaNode.userData?.slotLocalZ ?? -0.022
    );

    // Highlight beacon directly around the Spec 20 optical sample compartment on top deck!
    const beacon = createHighlightBeacon(0.036);
    beacon.position.set(slotLocal.x, 0.155, slotLocal.z);
    group.add(beacon);

    objects3D.set(id, {
        id,
        type: 'spectrophotometer',
        root: group,
        homePos: new THREE.Vector3(posCfg.x, posCfg.y, posCfg.z),
        homeRotY: posCfg.rotY || 0,
        lidPivot,
        beamLed,
        btnNodes,
        btnRestZ,
        slotLocal,
        beacon,
        mouthOffset: new THREE.Vector3(slotLocal.x, 0.185, slotLocal.z),
    });

    // Place Spec 20 label cleanly above the left display deck so Cuvette (In Spec) on the right never collides
    registerLabel(id, new THREE.Vector3(-0.075, 0.195, 0.0), (obj, st) => {
        return `Spec 20D+ • ${st.spec20State.reading}`;
    });
}

// ---------------------------------------------------------------------------
// State -> 3D Synchronization & Choreographed Action Effects
// ---------------------------------------------------------------------------

export function getWorldMouthPosition(id) {
    const entry = objects3D.get(id);
    if (!entry) return new THREE.Vector3();
    entry.root.updateWorldMatrix(true, false);
    const offset = entry.mouthOffset || new THREE.Vector3(0, 0.15, 0);
    return offset.clone().applyMatrix4(entry.root.matrixWorld);
}

export function getSpecCuvetteWorldTransform() {
    const spec = objects3D.get('spec20');
    if (!spec) return { pos: new THREE.Vector3(0.45, 0.10, -0.11), rotY: 0 };
    spec.root.updateWorldMatrix(true, false);
    const worldPos = spec.slotLocal.clone().applyMatrix4(spec.root.matrixWorld);
    return { pos: worldPos, rotY: spec.homeRotY };
}

export function syncSceneFromState(immediate = false) {
    const state = getState();
    if (!scene) return;

    // Update Spec 20 digital LCD texture
    updateSpecDisplayTexture(state.spec20State, immediate);

    // Sync liquids & cleanliness flags across all vessels
    state.labObjects.forEach((obj) => {
        const entry = objects3D.get(obj.id);
        if (!entry) return;

        const targetRatio = obj.maxVolume > 0 ? Math.max(0, Math.min(1, obj.currentVolume / obj.maxVolume)) : 0;
        if (immediate) {
            animState.fillRatios.set(obj.id, targetRatio);
        }

        // Update liquid optical color
        if (entry.liquidMat) {
            const conc = obj.type === 'pipette' ? obj.contentsConcentration : obj.concentration;
            const style = getLiquidOpticalStyle(conc, obj.type === 'beaker');
            entry.liquidMat.color.copy(style.color);
            entry.liquidMat.opacity = style.opacity;
            entry.liquidMat.emissive.copy(style.emissive);
        }

        // Cuvette residue film (visible when empty AND dirty / awaiting rinse!)
        if (entry.residueFilm) {
            entry.residueFilm.visible = !obj.isClean && obj.currentVolume < 0.01;
        }
    });

    // Ensure cuvette docks in Spec 20 or its holder when not dragging or animating
    const cuvObj = findObjectById('cuvette');
    const cuvEntry = objects3D.get('cuvette');
    if (cuvObj && cuvEntry && animState.draggedId !== 'cuvette' && (!animState.activeChoreo || animState.activeChoreo.actorId !== 'cuvette')) {
        if (cuvObj.isInSpec) {
            const { pos, rotY } = getSpecCuvetteWorldTransform();
            if (immediate) {
                cuvEntry.root.position.copy(pos);
                cuvEntry.root.rotation.set(0, rotY, 0);
            }
        } else if (immediate) {
            cuvEntry.root.position.copy(cuvEntry.homePos);
            cuvEntry.root.rotation.set(0, cuvEntry.homeRotY, 0);
        }
    }
}

export function triggerActionEffect(type, payload = {}) {
    if (type === 'buttonPress') {
        if (payload.button && Object.prototype.hasOwnProperty.call(animState.btnPress, payload.button)) {
            animState.btnPress[payload.button] = 1.0;
        }
        return;
    }

    if (type === 'zeroSpec' || type === 'measure') {
        animState.beamFlash = 1.0;
        animState.lidTarget = 0.0;
        return;
    }

    if (type === 'fillPipette') {
        const pip = objects3D.get(payload.pipetteId);
        const src = objects3D.get(payload.sourceId);
        if (!pip || !src) return;
        const mouth = getWorldMouthPosition(payload.sourceId);
        const startPos = pip.root.position.clone();
        const hoverPos = mouth.clone().add(new THREE.Vector3(0, 0.055, 0));
        const dipPos = mouth.clone().add(new THREE.Vector3(0, -0.025, 0));
        const restLoadedPos = pip.homePos.clone().add(new THREE.Vector3(0, 0.032, 0));

        animState.activeChoreo = {
            kind: 'fillPipette',
            actorId: payload.pipetteId,
            sourceId: payload.sourceId,
            elapsed: 0,
            duration: 0.72,
            startPos,
            hoverPos,
            dipPos,
            endPos: restLoadedPos,
        };
        return;
    }

    if (type === 'dispensePipette') {
        const pip = objects3D.get(payload.pipetteId);
        const dest = objects3D.get(payload.destId);
        if (!pip || !dest) return;
        const mouth = getWorldMouthPosition(payload.destId);
        const startPos = pip.root.position.clone();
        const dispensePos = mouth.clone().add(new THREE.Vector3(0, 0.018, 0));
        const style = getLiquidOpticalStyle(payload.concentration);

        animState.activeChoreo = {
            kind: 'dispensePipette',
            actorId: payload.pipetteId,
            destId: payload.destId,
            elapsed: 0,
            duration: 0.68,
            startPos,
            dispensePos,
            streamTargetY: dest.root.position.y + 0.035,
            streamColor: style.color,
            endPos: pip.homePos.clone(),
        };
        return;
    }

    if (type === 'insertCuvette') {
        const cuv = objects3D.get('cuvette');
        if (!cuv) return;
        const { pos: slotPos, rotY: slotRotY } = getSpecCuvetteWorldTransform();
        const aboveSlot = slotPos.clone().add(new THREE.Vector3(0, 0.115, 0));
        animState.activeChoreo = {
            kind: 'insertCuvette',
            actorId: 'cuvette',
            elapsed: 0,
            duration: 0.65,
            startPos: cuv.root.position.clone(),
            aboveSlot,
            endPos: slotPos,
            endRotY: slotRotY,
        };
        return;
    }

    if (type === 'removeCuvette') {
        const cuv = objects3D.get('cuvette');
        if (!cuv) return;
        animState.lidTarget = 1.0;
        setTimeout(() => {
            if (animState.draggedId !== 'cuvette') animState.lidTarget = 0.0;
        }, 550);
        return;
    }

    if (type === 'emptyCuvette') {
        const cuv = objects3D.get('cuvette');
        const waste = objects3D.get('wasteBeaker');
        if (!cuv || !waste) return;
        const wasteRim = getWorldMouthPosition('wasteBeaker').add(new THREE.Vector3(-0.026, 0.035, 0));
        const style = getLiquidOpticalStyle(payload.concentration);

        animState.activeChoreo = {
            kind: 'emptyCuvette',
            actorId: 'cuvette',
            elapsed: 0,
            duration: 0.85,
            startPos: cuv.root.position.clone(),
            pourPos: wasteRim,
            streamTargetY: waste.root.position.y + 0.02,
            streamColor: style.color,
            endPos: cuv.homePos.clone(),
        };
    }
}

// ---------------------------------------------------------------------------
// Per-Frame 60fps Animation Engine
// ---------------------------------------------------------------------------

function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

function applyLiquidGeometry(entry, ratio) {
    const r = Math.max(0, Math.min(1, ratio));
    const hasLiq = r > 0.002;

    if (entry.type === 'bottle' || entry.type === 'cuvette' || entry.type === 'beaker') {
        if (entry.liquidBody) {
            entry.liquidBody.visible = hasLiq;
            entry.liquidBody.scale.y = Math.max(0.001, r);
        }
        if (entry.liquidMeniscus) {
            entry.liquidMeniscus.visible = hasLiq;
            entry.liquidMeniscus.position.y = entry.liquidBaseY + entry.liquidMaxHeight * r;
        }
    } else if (entry.type === 'pipette') {
        if (entry.liquidTip) entry.liquidTip.visible = hasLiq;
        if (entry.liquidStem) {
            entry.liquidStem.visible = hasLiq;
            entry.liquidStem.scale.y = Math.max(0.015, r);
        }
        if (entry.liquidMeniscus) {
            entry.liquidMeniscus.visible = hasLiq;
            entry.liquidMeniscus.position.y = entry.liquidBaseY + entry.liquidMaxHeight * r;
        }
    } else if (entry.type === 'testTube') {
        if (entry.liquidBottom) entry.liquidBottom.visible = hasLiq;
        const colRatio = hasLiq ? Math.max(0, Math.min(1, (r - 0.04) / 0.96)) : 0;
        if (entry.liquidColumn) {
            entry.liquidColumn.visible = colRatio > 0.002;
            entry.liquidColumn.scale.y = Math.max(0.001, colRatio);
        }
        if (entry.liquidMeniscus) {
            entry.liquidMeniscus.visible = hasLiq;
            entry.liquidMeniscus.position.y = entry.domeTopY + entry.columnMaxHeight * colRatio;
        }
    }
}

function updateAnimations(dt) {
    const now = performance.now() * 0.001;
    const state = getState();
    const damp = 1 - Math.exp(-10 * dt);

    // 1. Camera Preset Smooth Flight
    if (animState.cameraFlight) {
        const fl = animState.cameraFlight;
        fl.elapsed += dt;
        const u = smoothstep(0, fl.duration, fl.elapsed);
        camera.position.lerpVectors(fl.fromPos, fl.toPos, u);
        controls.target.lerpVectors(fl.fromTarget, fl.toTarget, u);
        if (fl.elapsed >= fl.duration) {
            animState.cameraFlight = null;
        }
    }

    // 2. Smooth Liquid Levels Across All Apparatus
    state.labObjects.forEach((obj) => {
        const entry = objects3D.get(obj.id);
        if (!entry) return;
        const targetRatio = obj.maxVolume > 0 ? Math.max(0, Math.min(1, obj.currentVolume / obj.maxVolume)) : 0;
        const cur = animState.fillRatios.get(obj.id) ?? targetRatio;
        const next = cur + (targetRatio - cur) * Math.min(1, dt * 8.5);
        animState.fillRatios.set(obj.id, Math.abs(targetRatio - next) < 0.0005 ? targetRatio : next);
        applyLiquidGeometry(entry, next);
    });

    // 3. Reagent Bottle Cap Lift-Off Animation (when hovered by pipette or actively aspirating!)
    ['stockBottle', 'waterBottle', 'unknownBottle'].forEach((bid) => {
        const entry = objects3D.get(bid);
        if (!entry || !entry.bottleCap) return;
        const wantOpen =
            animState.capHoverTarget === bid ||
            (animState.activeChoreo?.kind === 'fillPipette' && animState.activeChoreo.sourceId === bid);
        const cur = animState.capOpen.get(bid) ?? 0;
        const target = wantOpen ? 1 : 0;
        const next = cur + (target - cur) * damp;
        animState.capOpen.set(bid, next);

        entry.bottleCap.position.set(
            entry.capRestPos.x + next * 0.048,
            entry.capRestPos.y + Math.sin(next * Math.PI) * 0.028 + next * 0.015,
            entry.capRestPos.z - next * 0.012
        );
        entry.bottleCap.rotation.z = -next * 0.55;
        entry.bottleCap.rotation.y = next * 2.4;
    });

    // 4. Spec 20 Hinged Sample Compartment Lid & Buttons & 630nm Optical Beam Flash
    const spec = objects3D.get('spec20');
    if (spec) {
        const cuvObj = findObjectById('cuvette');
        const wantLidOpen =
            animState.dropHoverId === 'spec20' ||
            (animState.draggedId === 'cuvette' && cuvObj?.isInSpec) ||
            (animState.activeChoreo?.kind === 'insertCuvette' && animState.activeChoreo.elapsed < 0.50) ||
            (animState.activeChoreo?.kind === 'emptyCuvette' && animState.activeChoreo.elapsed < 0.25) ||
            animState.lidTarget > 0.5;

        animState.lidOpen += ((wantLidOpen ? 1 : 0) - animState.lidOpen) * Math.min(1, dt * 11);
        if (spec.lidPivot) {
            // Rotate hinged lid backward open cleanly (-92 deg around local X)
            spec.lidPivot.rotation.x = -animState.lidOpen * (Math.PI * 0.52);
        }

        // Physical tactile button depression & step guidance glow
        const highlights = state.highlights || [];
        Object.entries(spec.btnNodes).forEach(([btnKey, node]) => {
            if (!node) return;
            animState.btnPress[btnKey] = Math.max(0, animState.btnPress[btnKey] - dt * 5.2);
            const pressDepth = Math.sin(animState.btnPress[btnKey] * Math.PI) * 0.0045;
            node.position.z = spec.btnRestZ[btnKey] - pressDepth;

            const isBtnHighlighted = highlights.includes(`btn_${btnKey}`);
            node.traverse((ch) => {
                if (ch.isMesh && ch.name.includes('_Face') && ch.material) {
                    const pulse = isBtnHighlighted ? 0.55 + 0.45 * Math.sin(now * 5.0) : 0.14;
                    ch.material.emissiveIntensity = pulse;
                }
            });
        });

        // 630 nm ruby beam LED flash during zero/measure
        if (animState.beamFlash > 0) {
            animState.beamFlash = Math.max(0, animState.beamFlash - dt * 1.4);
            updateSpecDisplayTexture(state.spec20State);
        }
        if (spec.beamLed && spec.beamLed.material) {
            spec.beamLed.material.emissiveIntensity = 1.6 + animState.beamFlash * 8.0;
        }
    }

    // 5. Choreographed Action Animations (Fill, Dispense, Insert Cuvette, Pour Waste)
    pourStreamMesh.visible = false;
    if (animState.activeChoreo) {
        const ch = animState.activeChoreo;
        ch.elapsed += dt;
        const t = Math.min(1, ch.elapsed / ch.duration);
        const actor = objects3D.get(ch.actorId);

        if (actor && ch.kind === 'fillPipette') {
            if (t < 0.25) {
                const u = smoothstep(0, 0.25, t);
                actor.root.position.lerpVectors(ch.startPos, ch.hoverPos, u);
            } else if (t < 0.45) {
                const u = smoothstep(0.25, 0.45, t);
                actor.root.position.lerpVectors(ch.hoverPos, ch.dipPos, u);
                if (actor.bulb) actor.bulb.scale.set(0.84, 1.0, 0.84);
            } else if (t < 0.68) {
                actor.root.position.copy(ch.dipPos);
                // Rubber bulb visibly expands as liquid aspirates!
                const u = smoothstep(0.45, 0.68, t);
                const sx = 0.84 + 0.16 * u;
                if (actor.bulb) actor.bulb.scale.set(sx, 1.0, sx);
            } else if (t < 0.84) {
                const u = smoothstep(0.68, 0.84, t);
                actor.root.position.lerpVectors(ch.dipPos, ch.hoverPos, u);
            } else {
                const u = smoothstep(0.84, 1.0, t);
                actor.root.position.lerpVectors(ch.hoverPos, ch.endPos, u);
            }
            actor.root.rotation.set(0, actor.homeRotY, 0);
        } else if (actor && ch.kind === 'dispensePipette') {
            if (t < 0.28) {
                const u = smoothstep(0, 0.28, t);
                actor.root.position.lerpVectors(ch.startPos, ch.dispensePos, u);
            } else if (t < 0.72) {
                actor.root.position.copy(ch.dispensePos);
                const u = smoothstep(0.28, 0.72, t);
                const squeeze = 1.0 - 0.18 * Math.sin(u * Math.PI);
                if (actor.bulb) actor.bulb.scale.set(squeeze, 1.0, squeeze);

                // Render shimmering liquid delivery stream from pipette tip into target!
                const streamLen = Math.max(0.01, ch.dispensePos.y - ch.streamTargetY);
                pourStreamMesh.position.copy(ch.dispensePos);
                pourStreamMesh.scale.set(1, streamLen, 1);
                pourStreamMat.color.copy(ch.streamColor);
                pourStreamMesh.visible = true;
            } else {
                const u = smoothstep(0.72, 1.0, t);
                actor.root.position.lerpVectors(ch.dispensePos, ch.endPos, u);
                if (actor.bulb) actor.bulb.scale.set(1, 1, 1);
            }
            actor.root.rotation.set(0, actor.homeRotY, 0);
        } else if (actor && ch.kind === 'insertCuvette') {
            if (t < 0.48) {
                const u = smoothstep(0, 0.48, t);
                actor.root.position.lerpVectors(ch.startPos, ch.aboveSlot, u);
                actor.root.position.y += Math.sin(u * Math.PI) * 0.04;
            } else {
                const u = smoothstep(0.48, 1.0, t);
                actor.root.position.lerpVectors(ch.aboveSlot, ch.endPos, u);
            }
            actor.root.rotation.set(0, ch.endRotY, 0);
        } else if (actor && ch.kind === 'emptyCuvette') {
            if (t < 0.28) {
                const u = smoothstep(0, 0.28, t);
                actor.root.position.lerpVectors(ch.startPos, ch.pourPos, u);
                actor.root.position.y += Math.sin(u * Math.PI) * 0.05;
                actor.root.rotation.z = -u * 0.3;
            } else if (t < 0.72) {
                const u = smoothstep(0.28, 0.72, t);
                actor.root.position.copy(ch.pourPos);
                // Tilt cuvette to pour cleanly into waste beaker!
                const tilt = Math.sin(u * Math.PI) * 2.05;
                actor.root.rotation.set(0, 0, -tilt);

                if (u > 0.18 && u < 0.82) {
                    const streamOrigin = ch.pourPos.clone().add(new THREE.Vector3(0.025, 0.012, 0));
                    const len = Math.max(0.02, streamOrigin.y - ch.streamTargetY);
                    pourStreamMesh.position.copy(streamOrigin);
                    pourStreamMesh.scale.set(1.4, len, 1.4);
                    pourStreamMat.color.copy(ch.streamColor);
                    pourStreamMesh.visible = true;
                }
            } else {
                const u = smoothstep(0.72, 1.0, t);
                actor.root.position.lerpVectors(ch.pourPos, ch.endPos, u);
                actor.root.rotation.set(0, actor.homeRotY, 0);
            }
        }

        if (t >= 1.0) {
            if (actor?.bulb) actor.bulb.scale.set(1, 1, 1);
            animState.activeChoreo = null;
        }
    }

    // 6. Idle / Selected / Loaded Resting Positions for Draggable Objects
    ['pipette_stock', 'pipette_water', 'pipette_unknown', 'cuvette'].forEach((id) => {
        if (animState.draggedId === id) return;
        if (animState.activeChoreo?.actorId === id) return;

        const entry = objects3D.get(id);
        const obj = findObjectById(id);
        if (!entry || !obj) return;

        let targetPos = entry.homePos.clone();
        let targetRotY = entry.homeRotY;

        if (id === 'cuvette' && obj.isInSpec) {
            const specXform = getSpecCuvetteWorldTransform();
            targetPos.copy(specXform.pos);
            targetRotY = specXform.rotY;
            if (state.selectedObjectId === id) {
                targetPos.y += 0.065; // Lift partially out of open chamber when selected
                animState.lidTarget = 1.0;
            }
        } else {
            // Subtle float lift when pipette is loaded with liquid or object is click-selected!
            if (obj.type === 'pipette' && obj.currentVolume > 0) {
                targetPos.y += 0.032 + Math.sin(now * 3.4) * 0.004;
            }
            if (state.selectedObjectId === id) {
                targetPos.y += 0.045 + Math.sin(now * 5.0) * 0.005;
            }
        }

        entry.root.position.lerp(targetPos, damp);
        entry.root.rotation.x += (0 - entry.root.rotation.x) * damp;
        entry.root.rotation.z += (0 - entry.root.rotation.z) * damp;
        entry.root.rotation.y += (targetRotY - entry.root.rotation.y) * damp;
    });

    // 7. Actively Dragged 3D Object Smoothing
    if (animState.draggedId) {
        const entry = objects3D.get(animState.draggedId);
        if (entry) {
            entry.root.position.lerp(animState.dragWorldPos, Math.min(1, dt * 22));
            entry.root.rotation.z += (0 - entry.root.rotation.z) * damp;
        }
    }

    // 8. Highlight Beacons (Amber Step Guidance vs Emerald Active Drop Target)
    const highlights = state.highlights || [];
    for (const [id, entry] of objects3D.entries()) {
        if (!entry.beacon) continue;
        const isDropHover = animState.dropHoverId === id;
        const isSelected = state.selectedObjectId === id || animState.draggedId === id;
        const isStepHighlight = highlights.includes(id);

        if (isDropHover) {
            entry.beacon.visible = true;
            entry.beacon.material.color.setHex(0x22c55e);
            entry.beacon.material.opacity = 0.85;
            const s = 1.06 + 0.08 * Math.sin(now * 8.0);
            entry.beacon.scale.set(s, s, s);
        } else if (isSelected) {
            entry.beacon.visible = true;
            entry.beacon.material.color.setHex(0x38bdf8);
            entry.beacon.material.opacity = 0.85;
            entry.beacon.scale.set(1.08, 1.08, 1.08);
        } else if (isStepHighlight) {
            entry.beacon.visible = true;
            entry.beacon.material.color.setHex(0xf59e0b);
            entry.beacon.material.opacity = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(now * 4.5));
            const s = 1.0 + 0.06 * Math.sin(now * 4.5);
            entry.beacon.scale.set(s, s, s);
        } else {
            entry.beacon.visible = false;
        }
    }
}

// ---------------------------------------------------------------------------
// External Hooks Used by interaction3d.js
// ---------------------------------------------------------------------------

export function setCameraPreset(presetKey) {
    const preset = config.CAMERA_PRESETS[presetKey];
    if (!preset || !camera || !controls) return;
    animState.cameraFlight = {
        elapsed: 0,
        duration: 0.55,
        fromPos: camera.position.clone(),
        toPos: new THREE.Vector3(...preset.pos),
        fromTarget: controls.target.clone(),
        toTarget: new THREE.Vector3(...preset.target),
    };
}

export function setDragVisualState(draggedId, worldPos = null, dropHoverId = null) {
    animState.draggedId = draggedId;
    animState.dropHoverId = dropHoverId;
    if (worldPos) {
        animState.dragWorldPos.copy(worldPos);
    }
    // Automatically open bottle cap if dragging/hovering a pipette over that bottle!
    if (draggedId && draggedId.startsWith('pipette_') && dropHoverId && dropHoverId.endsWith('Bottle')) {
        animState.capHoverTarget = dropHoverId;
    } else {
        animState.capHoverTarget = null;
    }
}

export function getPickTargets() {
    return pickTargets;
}

export function getObject3D(id) {
    return objects3D.get(id) || null;
}

export function getCamera() {
    return camera;
}

export function getControls() {
    return controls;
}

export function getDomElement() {
    return renderer?.domElement || null;
}

export function getScreenPoint(interactId) {
    if (!camera || !renderer) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const worldPos = new THREE.Vector3();

    if (interactId.startsWith('btn_')) {
        const spec = objects3D.get('spec20');
        const key = interactId.replace('btn_', '');
        const node = spec?.btnNodes?.[key];
        if (!node) return null;
        node.updateWorldMatrix(true, false);
        node.getWorldPosition(worldPos);
    } else {
        const entry = objects3D.get(interactId);
        if (!entry) return null;
        entry.root.updateWorldMatrix(true, false);
        const yOffsets = {
            pipette: 0.15,
            bottle: 0.09,
            testTube: 0.095,
            cuvette: 0.036,
            beaker: 0.055,
            spectrophotometer: 0.12,
        };
        const localPt = new THREE.Vector3(
            entry.type === 'spectrophotometer' ? entry.slotLocal.x : 0,
            yOffsets[entry.type] ?? 0.08,
            entry.type === 'spectrophotometer' ? entry.slotLocal.z : 0
        );
        worldPos.copy(localPt).applyMatrix4(entry.root.matrixWorld);
    }

    worldPos.project(camera);
    return {
        x: rect.left + (worldPos.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-worldPos.y * 0.5 + 0.5) * rect.height,
    };
}
