/**
 * Gas Laws 3D Simulation - Main Orchestrator
 * Handles scene management, UI interactions, and module loading
 */

import { BoyleScene } from './boyle.js';
import { CharlesScene } from './charles.js';
import { GayLussacScene } from './gayLussac.js';
import { AvogadroScene } from './avogadro.js';
import { IdealScene } from './ideal.js';

// ============================================
// Configuration
// ============================================
const LAW_CONFIG = {
    boyle: {
        name: "Boyle's Law",
        formula: "P₁V₁ = P₂V₂",
        description: "At constant temperature, the pressure of a gas is inversely proportional to its volume.",
        info: "Discovered by Robert Boyle in 1662. This simulation shows a piston-cylinder system. As you push down the piston (decrease volume), gas molecules have less space and collide more frequently with the walls, increasing pressure. This principle is used in syringes, bicycle pumps, and internal combustion engines.",
        scenario: "Piston-Cylinder",
        hint: "Adjust the volume slider to see how pressure changes inversely"
    },
    charles: {
        name: "Charles's Law",
        formula: "V₁/T₁ = V₂/T₂",
        description: "At constant pressure, the volume of a gas is directly proportional to its absolute temperature.",
        info: "Discovered by Jacques Charles in 1787. This simulation shows a hot air balloon. As the burner heats the air inside, molecules move faster and the balloon expands to maintain constant pressure. This is how hot air balloons achieve lift - hot air is less dense than cool air.",
        scenario: "Hot Air Balloon",
        hint: "Increase temperature to see the balloon expand"
    },
    gayLussac: {
        name: "Gay-Lussac's Law",
        formula: "P₁/T₁ = P₂/T₂",
        description: "At constant volume, the pressure of a gas is directly proportional to its absolute temperature.",
        info: "Formulated by Joseph Louis Gay-Lussac in 1809. This simulation shows a pressure cooker on a stove. The sealed container maintains constant volume, so when heated, molecules move faster and create higher pressure. This is why pressure cookers have safety valves and pressure gauges.",
        scenario: "Pressure Cooker",
        hint: "Increase temperature to see pressure rise on the gauge"
    },
    avogadro: {
        name: "Avogadro's Law",
        formula: "V₁/n₁ = V₂/n₂",
        description: "At constant temperature and pressure, the volume of a gas is directly proportional to the number of moles.",
        info: "Proposed by Amedeo Avogadro in 1811. This simulation shows helium balloons being filled. At STP (273K, 1 atm), one mole of any gas occupies 22.4 liters. Adding more moles of helium makes the balloon larger. This is why you need more helium for bigger balloons!",
        scenario: "Helium Balloons",
        hint: "Add more moles of gas to see the balloon grow"
    },
    ideal: {
        name: "Ideal Gas Law",
        formula: "PV = nRT",
        description: "Combines all gas laws: pressure times volume equals moles times gas constant times temperature.",
        info: "The Ideal Gas Law combines all previous gas laws into one equation. This simulation shows a scuba diving scenario where divers must calculate available air. A typical 12L tank at 200 atm and 15°C contains about 100 moles of air. Knowing how P, V, and T affect air supply is crucial for dive safety.",
        scenario: "Scuba Tank",
        hint: "Adjust P, V, or T to see how moles of air changes"
    }
};

// ============================================
// Global State
// ============================================
let scene, camera, renderer, controls;
let currentLaw = 'boyle';
let currentScene = null;
let lastTime = performance.now();
let animationId = null;

// ============================================
// Initialization
// ============================================
function init() {
    const canvasContainer = document.getElementById('canvas-container');

    // Three.js scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1a);

    // Camera
    const aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    camera.position.set(8, 6, 8);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvasContainer.appendChild(renderer.domElement);

    // Orbit controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI * 0.85;

    // Lighting (global)
    setupGlobalLighting();

    // Event listeners
    setupEventListeners();

    // Load initial scene
    loadScene('boyle');

    // Start animation
    animate();
}

function setupGlobalLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404060, 0.3);
    scene.add(ambientLight);

    // Main directional light
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(5, 10, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    scene.add(mainLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0x4f46e5, 0.2);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
}

// ============================================
// Scene Management
// ============================================
function loadScene(law) {
    // Dispose current scene
    if (currentScene) {
        currentScene.dispose();
        currentScene = null;
    }

    // Clear fog
    scene.fog = null;

    // Create new scene based on law
    switch (law) {
        case 'boyle':
            currentScene = new BoyleScene(scene, camera);
            break;
        case 'charles':
            currentScene = new CharlesScene(scene, camera);
            break;
        case 'gayLussac':
            currentScene = new GayLussacScene(scene, camera);
            break;
        case 'avogadro':
            currentScene = new AvogadroScene(scene, camera);
            break;
        case 'ideal':
            currentScene = new IdealScene(scene, camera);
            break;
    }

    currentLaw = law;

    // Apply slowest animation speed on load
    if (currentScene && currentScene.setAnimationSpeed) {
        currentScene.setAnimationSpeed(0.05);
    }

    // Update UI
    updateUI(law);
    updateFormulaDisplay(law);

    // Reset controls target
    controls.target.set(0, 1, 0);
    controls.update();
}

function updateUI(law) {
    const config = LAW_CONFIG[law];

    // Update tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.law === law);
    });

    // Update formula card
    document.querySelector('.formula-card h3').textContent = config.name;
    document.getElementById('formula-equation').textContent = config.formula;
    document.getElementById('formula-description').textContent = config.description;

    // Update about law info section
    document.querySelector('#law-info h4').textContent = `About ${config.name}`;
    document.querySelector('#law-info p').textContent = config.info;

    // Update scenario label and hint
    document.getElementById('scenario-label').textContent = config.scenario;
    document.getElementById('scenario-description').querySelector('p').textContent = config.hint;

    // Show/hide control groups
    document.querySelectorAll('.control-group').forEach(group => {
        group.classList.add('hidden');
    });
    document.getElementById(`${law}-controls`).classList.remove('hidden');

    // Hide stove heat slider when not used (Gay-Lussac driven by temperature)
    const stoveControl = document.getElementById('stove-heat')?.closest('.control-item');
    if (stoveControl) {
        stoveControl.style.display = law === 'gayLussac' ? 'none' : '';
    }

    // Show/hide formula displays
    document.querySelectorAll('.formula-row').forEach(row => {
        row.classList.add('hidden');
    });
    document.getElementById(`${law}-formula-display`).classList.remove('hidden');

    // Update particle count display
    if (currentScene && currentScene.particleSystem) {
        const particleCount = currentScene.particleSystem.getCount();
        document.getElementById('particle-slider').value = particleCount;
        document.getElementById('particle-value').textContent = particleCount;
        document.getElementById('particle-count').textContent =
            `Particles: ${particleCount}`;

        const particleSize = currentScene.particleSystem.options.particleSize;
        document.getElementById('size-slider').value = particleSize;
        document.getElementById('size-value').textContent = particleSize.toFixed(2);

        const animationSpeed = currentScene.particleSystem.animationSpeed;
        document.getElementById('speed-slider').value = animationSpeed;
        document.getElementById('speed-value').textContent = `${animationSpeed.toFixed(2)}x`;

        document.getElementById('show-trails').checked =
            !!currentScene.particleSystem.options.showTrails;
        document.getElementById('show-collisions').checked =
            !!currentScene.particleSystem.options.showCollisions;
    }
}

function updateFormulaDisplay(law) {
    const state = currentScene ? currentScene.getState() : {};

    switch (law) {
        case 'boyle':
            document.getElementById('boyle-p-val').textContent = state.pressure?.toFixed(2) || '2.00';
            document.getElementById('boyle-v-val').textContent = state.volume?.toFixed(1) || '5.0';
            document.getElementById('boyle-k-val').textContent =
                ((state.pressure || 2) * (state.volume || 5)).toFixed(1);
            updateLiveValues(state.pressure, state.volume, 273, 1);
            break;

        case 'charles':
            document.getElementById('charles-v-val').textContent = state.volume?.toFixed(1) || '24.6';
            document.getElementById('charles-t-val').textContent = state.temperature?.toFixed(0) || '300';
            document.getElementById('charles-k-val').textContent =
                ((state.volume || 24.6) / (state.temperature || 300)).toFixed(4);
            updateLiveValues(1, state.volume, state.temperature, 1);
            break;

        case 'gayLussac':
            document.getElementById('gl-p-val').textContent = state.pressure?.toFixed(2) || '1.17';
            document.getElementById('gl-t-val').textContent = state.temperature?.toFixed(0) || '350';
            document.getElementById('gl-k-val').textContent =
                ((state.pressure || 1.17) / (state.temperature || 350)).toFixed(5);
            updateLiveValues(state.pressure, 10, state.temperature, 1);
            break;

        case 'avogadro':
            document.getElementById('avo-v-val').textContent = state.volume?.toFixed(1) || '22.4';
            document.getElementById('avo-n-val').textContent = state.moles?.toFixed(1) || '1.0';
            document.getElementById('avo-vm-val').textContent =
                ((state.volume || 22.4) / (state.moles || 1)).toFixed(1);
            updateLiveValues(1, state.volume, 273, state.moles);
            break;

        case 'ideal':
            document.getElementById('ideal-p-val').textContent = state.pressure?.toFixed(0) || '200';
            document.getElementById('ideal-v-val').textContent = state.volume?.toFixed(1) || '12';
            document.getElementById('ideal-pv-val').textContent =
                ((state.pressure || 200) * (state.volume || 12)).toFixed(0);
            document.getElementById('ideal-n-val').textContent = state.moles?.toFixed(1) || '100.2';
            document.getElementById('ideal-t-val').textContent = state.temperature?.toFixed(0) || '288';
            updateLiveValues(state.pressure, state.volume, state.temperature, state.moles);
            break;
    }
}

function updateLiveValues(pressure, volume, temperature, moles) {
    document.getElementById('live-pressure').textContent = `${pressure?.toFixed(2) || '1.00'} atm`;
    document.getElementById('live-volume').textContent = `${volume?.toFixed(1) || '22.4'} L`;
    document.getElementById('live-temperature').textContent = `${temperature?.toFixed(0) || '273'} K`;
    document.getElementById('live-moles').textContent = `${moles?.toFixed(1) || '1.0'} mol`;
}

// ============================================
// Event Handlers
// ============================================
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            loadScene(btn.dataset.law);
        });
    });

    // Collapsible visualization panel
    document.getElementById('viz-toggle').addEventListener('click', () => {
        const section = document.querySelector('.viz-settings-section');
        section.classList.toggle('collapsed');
    });

    // Boyle's Law controls
    document.getElementById('volume-slider').addEventListener('input', (e) => {
        const volume = parseFloat(e.target.value);
        document.getElementById('volume-value').textContent = `${volume.toFixed(1)} L`;
        if (currentScene && currentScene.setVolume) {
            currentScene.setVolume(volume);
            updateFormulaDisplay('boyle');
        }
    });

    // Charles's Law controls
    document.getElementById('temperature-charles').addEventListener('input', (e) => {
        const temp = parseFloat(e.target.value);
        document.getElementById('temperature-charles-value').textContent = `${temp} K`;
        if (currentScene && currentScene.setTemperature) {
            currentScene.setTemperature(temp);
            updateFormulaDisplay('charles');
        }
    });

    document.getElementById('flame-intensity').addEventListener('input', (e) => {
        const intensity = parseFloat(e.target.value);
        document.getElementById('flame-value').textContent = `${intensity}%`;
        if (currentScene && currentScene.setFlameIntensity) {
            currentScene.setFlameIntensity(intensity);
        }
    });

    // Gay-Lussac's Law controls
    document.getElementById('temperature-gl').addEventListener('input', (e) => {
        const temp = parseFloat(e.target.value);
        document.getElementById('temperature-gl-value').textContent = `${temp} K`;
        if (currentScene && currentScene.setTemperature) {
            currentScene.setTemperature(temp);
            updateFormulaDisplay('gayLussac');
        }
    });

    // Hide stove heat slider for Gay-Lussac (temperature drives flame)
    const stoveControl = document.getElementById('stove-heat').closest('.control-item');
    if (stoveControl) stoveControl.classList.add('hidden');

    // Avogadro's Law controls
    document.getElementById('moles-slider').addEventListener('input', (e) => {
        const moles = parseFloat(e.target.value);
        document.getElementById('moles-value').textContent = `${moles.toFixed(1)} mol`;
        if (currentScene && currentScene.setMoles) {
            currentScene.setMoles(moles);
            updateFormulaDisplay('avogadro');
            // Update particle count display
            if (currentScene.particleSystem) {
                const particleCount = currentScene.particleSystem.getCount();
                document.getElementById('particle-slider').value = particleCount;
                document.getElementById('particle-value').textContent = particleCount;
                document.getElementById('particle-count').textContent =
                    `Particles: ${particleCount}`;
            }
        }
    });

    // Ideal Gas Law controls
    document.getElementById('pressure-ideal').addEventListener('input', (e) => {
        const pressure = parseFloat(e.target.value);
        document.getElementById('pressure-ideal-value').textContent = `${pressure} atm`;
        if (currentScene && currentScene.setPressure) {
            currentScene.setPressure(pressure);
            updateFormulaDisplay('ideal');
        }
    });

    document.getElementById('volume-ideal').addEventListener('input', (e) => {
        const volume = parseFloat(e.target.value);
        document.getElementById('volume-ideal-value').textContent = `${volume} L`;
        if (currentScene && currentScene.setVolume) {
            currentScene.setVolume(volume);
            updateFormulaDisplay('ideal');
        }
    });

    document.getElementById('temperature-ideal').addEventListener('input', (e) => {
        const temp = parseFloat(e.target.value);
        const celsius = temp - 273;
        document.getElementById('temperature-ideal-value').textContent = `${temp} K (${celsius}°C)`;
        if (currentScene && currentScene.setTemperature) {
            currentScene.setTemperature(temp);
            updateFormulaDisplay('ideal');
        }
    });

    // Visualization settings
    document.getElementById('particle-slider').addEventListener('input', (e) => {
        const count = parseInt(e.target.value);
        if (currentScene && currentScene.setParticleCount) {
            currentScene.setParticleCount(count);
        }
        document.getElementById('particle-value').textContent = count;
        document.getElementById('particle-count').textContent = `Particles: ${count}`;
    });

    document.getElementById('speed-slider').addEventListener('input', (e) => {
        const speed = parseFloat(e.target.value);
        document.getElementById('speed-value').textContent = `${speed.toFixed(2)}x`;
        if (currentScene && currentScene.setAnimationSpeed) {
            currentScene.setAnimationSpeed(speed);
        }
    });

    document.getElementById('size-slider').addEventListener('input', (e) => {
        const size = parseFloat(e.target.value);
        document.getElementById('size-value').textContent = size.toFixed(2);
        if (currentScene && currentScene.setParticleSize) {
            currentScene.setParticleSize(size);
        }
    });

    document.getElementById('show-trails').addEventListener('change', (e) => {
        if (currentScene && currentScene.setShowTrails) {
            currentScene.setShowTrails(e.target.checked);
        }
    });

    document.getElementById('show-collisions').addEventListener('change', (e) => {
        if (currentScene && currentScene.setShowCollisions) {
            currentScene.setShowCollisions(e.target.checked);
        }
    });

    // Reset button
    document.getElementById('reset-btn').addEventListener('click', () => {
        if (currentScene && currentScene.reset) {
            currentScene.reset();
            resetControlValues();
            updateFormulaDisplay(currentLaw);
        }
    });

    // Window resize
    window.addEventListener('resize', onWindowResize);
}

function resetControlValues() {
    // Reset sliders to default values based on current law
    switch (currentLaw) {
        case 'boyle':
            document.getElementById('volume-slider').value = 5;
            document.getElementById('volume-value').textContent = '5.0 L';
            break;
        case 'charles':
            document.getElementById('temperature-charles').value = 300;
            document.getElementById('temperature-charles-value').textContent = '300 K';
            document.getElementById('flame-intensity').value = 50;
            document.getElementById('flame-value').textContent = '50%';
            break;
        case 'gayLussac':
            document.getElementById('temperature-gl').value = 350;
            document.getElementById('temperature-gl-value').textContent = '350 K';
            document.getElementById('stove-heat').value = 50;
            document.getElementById('stove-value').textContent = 'Medium';
            break;
        case 'avogadro':
            document.getElementById('moles-slider').value = 1;
            document.getElementById('moles-value').textContent = '1.0 mol';
            break;
        case 'ideal':
            document.getElementById('pressure-ideal').value = 200;
            document.getElementById('pressure-ideal-value').textContent = '200 atm';
            document.getElementById('volume-ideal').value = 12;
            document.getElementById('volume-ideal-value').textContent = '12 L';
            document.getElementById('temperature-ideal').value = 288;
            document.getElementById('temperature-ideal-value').textContent = '288 K (15°C)';
            break;
    }

    // Reset visualization settings - start with slowest speed
    document.getElementById('particle-slider').value = 50;
    document.getElementById('particle-value').textContent = '50';
    document.getElementById('speed-slider').value = 0.05;
    document.getElementById('speed-value').textContent = '0.05x';
    document.getElementById('show-trails').checked = false;
    document.getElementById('show-collisions').checked = true;
}

function onWindowResize() {
    const canvasContainer = document.getElementById('canvas-container');
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// ============================================
// Animation Loop
// ============================================
function animate() {
    animationId = requestAnimationFrame(animate);

    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 16.67; // Normalize to 60fps
    lastTime = currentTime;

    // Update current scene
    if (currentScene && currentScene.update) {
        currentScene.update(deltaTime);
    }

    // Update controls
    controls.update();

    // Render
    renderer.render(scene, camera);
}

// ============================================
// Initialize on DOM ready
// ============================================
document.addEventListener('DOMContentLoaded', init);
