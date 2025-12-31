/**
 * Gay-Lussac's Law Visualization
 * P₁/T₁ = P₂/T₂ (at constant volume)
 *
 * Scene: Pressure Cooker on Stove
 * - Fixed volume container (pressure cooker)
 * - Stove burner heating the cooker
 * - Pressure gauge showing increasing pressure
 * - Steam release valve
 */

import { ParticleSystem } from './particles.js';

export class GayLussacScene {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        // Gas state
        this.state = {
            temperature: 350,   // K
            pressure: 1.17,     // atm (P = k * T)
            volume: 10.0,       // L (constant)
            moles: 1.0,         // mol (constant)
            k: 0.00333          // P/T constant
        };

        // Scene objects
        this.cooker = null;
        this.lid = null;
        this.stove = null;
        this.burnerFlames = [];
        this.pressureGauge = null;
        this.pressureNeedle = null;
        this.steamValve = null;
        this.steamParticles = [];

        // Particle system
        this.particleSystem = null;

        // Animation
        this.flameTime = 0;
        this.heatLevel = 0.5;
        this.steamTime = 0;
        this.lidVibration = 0;

        this.init();
    }

    init() {
        this.createStove();
        this.createCooker();
        this.createPressureGauge();
        this.createSteamValve();
        this.createParticles();
        this.createKitchenElements();
        this.setupLighting();

        // Set camera position
        this.camera.position.set(6, 5, 8);
        this.camera.lookAt(0, 1, 0);
    }

    createStove() {
        const stoveGroup = new THREE.Group();
        this.group.add(stoveGroup);

        // Stove top surface
        const stoveTopGeometry = new THREE.BoxGeometry(5, 0.2, 4);
        const stoveMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            metalness: 0.8,
            roughness: 0.3
        });
        const stoveTop = new THREE.Mesh(stoveTopGeometry, stoveMaterial);
        stoveTop.position.y = 0;
        stoveGroup.add(stoveTop);

        // Burner ring
        const burnerGeometry = new THREE.TorusGeometry(0.8, 0.08, 8, 32);
        const burnerMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.9,
            roughness: 0.2
        });
        const burner = new THREE.Mesh(burnerGeometry, burnerMaterial);
        burner.rotation.x = Math.PI / 2;
        burner.position.y = 0.15;
        stoveGroup.add(burner);

        // Inner burner grate
        for (let i = 0; i < 4; i++) {
            const grateGeometry = new THREE.BoxGeometry(1.4, 0.08, 0.08);
            const grate = new THREE.Mesh(grateGeometry, burnerMaterial);
            grate.rotation.y = (i * Math.PI) / 4;
            grate.position.y = 0.2;
            stoveGroup.add(grate);
        }

        // Burner flames
        this.createBurnerFlames(stoveGroup);

        // Stove control knob
        const knobGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16);
        const knobMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const knob = new THREE.Mesh(knobGeometry, knobMaterial);
        knob.rotation.x = Math.PI / 2;
        knob.position.set(2, 0, 0);
        stoveGroup.add(knob);

        // Knob indicator
        const indicatorGeometry = new THREE.BoxGeometry(0.02, 0.1, 0.02);
        const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        indicator.position.set(2, 0.05, 0);
        stoveGroup.add(indicator);
        this.knobIndicator = indicator;

        this.stove = stoveGroup;
    }

    createBurnerFlames(parent) {
        this.burnerFlames = [];
        const flameCount = 24; // More flames for fuller ring

        for (let i = 0; i < flameCount; i++) {
            const angle = (i / flameCount) * Math.PI * 2;
            const radius = 0.55;

            const flameGroup = new THREE.Group();
            flameGroup.position.set(
                Math.cos(angle) * radius,
                0.22,
                Math.sin(angle) * radius
            );

            // Core flame (white-blue hottest part)
            const coreGeometry = new THREE.ConeGeometry(0.015, 0.12, 6);
            const coreMaterial = new THREE.MeshBasicMaterial({
                color: 0xaaddff,
                transparent: true,
                opacity: 0.95
            });
            const core = new THREE.Mesh(coreGeometry, coreMaterial);
            core.position.y = 0.06;
            flameGroup.add(core);

            // Inner flame (bright blue)
            const innerGeometry = new THREE.ConeGeometry(0.03, 0.18, 6);
            const innerMaterial = new THREE.MeshBasicMaterial({
                color: 0x4488ff,
                transparent: true,
                opacity: 0.85
            });
            const inner = new THREE.Mesh(innerGeometry, innerMaterial);
            inner.position.y = 0.08;
            flameGroup.add(inner);

            // Outer flame (darker blue)
            const outerGeometry = new THREE.ConeGeometry(0.045, 0.25, 6);
            const outerMaterial = new THREE.MeshBasicMaterial({
                color: 0x2255cc,
                transparent: true,
                opacity: 0.6
            });
            const outer = new THREE.Mesh(outerGeometry, outerMaterial);
            outer.position.y = 0.1;
            flameGroup.add(outer);

            // Flame tip (faint blue)
            const tipGeometry = new THREE.ConeGeometry(0.025, 0.1, 4);
            const tipMaterial = new THREE.MeshBasicMaterial({
                color: 0x1133aa,
                transparent: true,
                opacity: 0.3
            });
            const tip = new THREE.Mesh(tipGeometry, tipMaterial);
            tip.position.y = 0.18;
            flameGroup.add(tip);

            parent.add(flameGroup);
            this.burnerFlames.push({
                group: flameGroup,
                core: core,
                inner: inner,
                outer: outer,
                tip: tip,
                phase: i * 0.3
            });
        }
    }

    createCooker() {
        const cookerGroup = new THREE.Group();
        cookerGroup.position.set(0, 0.05, 0);
        this.group.add(cookerGroup);

        // Materials
        const metalMaterial = new THREE.MeshStandardMaterial({
            color: 0xd0d0d0,
            metalness: 1,
            roughness: 0.18
        });
        const darkMetal = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            metalness: 0.8,
            roughness: 0.35
        });
        const glassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xdbe7f3,
            metalness: 0,
            roughness: 0.04,
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide,
            transmission: 0.75,
            thickness: 0.2
        });

        // Pot base plate
        const basePlate = new THREE.Mesh(
            new THREE.CylinderGeometry(1.45, 1.45, 0.08, 48),
            darkMetal
        );
        basePlate.position.y = 0.04;
        basePlate.receiveShadow = true;
        cookerGroup.add(basePlate);

        // Pot body (transparent to show particles)
        const potBody = new THREE.Mesh(
            new THREE.CylinderGeometry(1.4, 1.35, 1.25, 64, 1, true),
            glassMaterial
        );
        potBody.position.y = 0.65;
        potBody.castShadow = false;
        potBody.receiveShadow = false;
        cookerGroup.add(potBody);

        // Interior liner (dark) to give depth
        const innerLiner = new THREE.Mesh(
            new THREE.CylinderGeometry(1.25, 1.25, 1.15, 64, 1, true),
            new THREE.MeshStandardMaterial({
                color: 0x0f0f0f,
                metalness: 0.6,
                roughness: 0.6,
                side: THREE.BackSide
            })
        );
        innerLiner.position.y = 0.65;
        cookerGroup.add(innerLiner);

        // Glass window band near the top to visualize gas
        const windowBand = new THREE.Mesh(
            new THREE.CylinderGeometry(1.3, 1.3, 0.55, 64, 1, true),
            glassMaterial
        );
        windowBand.position.y = 0.95;
        cookerGroup.add(windowBand);

        // Top rim
        const rim = new THREE.Mesh(
            new THREE.TorusGeometry(1.38, 0.07, 16, 64),
            darkMetal
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 1.28;
        cookerGroup.add(rim);

        // Side handles
        const handleGeo = new THREE.BoxGeometry(0.16, 0.12, 0.6);
        const handle1 = new THREE.Mesh(handleGeo, darkMetal);
        handle1.position.set(1.65, 0.95, 0);
        cookerGroup.add(handle1);

        const handle2 = new THREE.Mesh(handleGeo, darkMetal);
        handle2.position.set(-1.65, 0.95, 0);
        cookerGroup.add(handle2);

        // Lid group
        this.lidGroup = new THREE.Group();
        this.baseLidY = 1.35;
        this.lidGroup.position.y = this.baseLidY;
        cookerGroup.add(this.lidGroup);

        // Lid body (metal with slight dome)
        const lidMetal = new THREE.MeshPhysicalMaterial({
            color: 0xd0d0d0,
            metalness: 0.8,
            roughness: 0.25
        });
        const lidBase = new THREE.Mesh(
            new THREE.CylinderGeometry(1.38, 1.38, 0.12, 64),
            lidMetal
        );
        lidBase.position.y = 0.06;
        this.lidGroup.add(lidBase);

        // Lid seal ring
        const lidSeal = new THREE.Mesh(
            new THREE.TorusGeometry(1.22, 0.04, 12, 48),
            new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
        );
        lidSeal.rotation.x = Math.PI / 2;
        lidSeal.position.y = 0.02;
        this.lidGroup.add(lidSeal);

        // Lid handle
        const lidHandle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.13, 0.13, 0.22, 16),
            darkMetal
        );
        lidHandle.position.y = 0.23;
        this.lidGroup.add(lidHandle);

        const lidHandleTop = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.1, 0.2),
            darkMetal
        );
        lidHandleTop.position.y = 0.4;
        this.lidGroup.add(lidHandleTop);

        // Locking bar across lid
        const lockBar = new THREE.Mesh(
            new THREE.BoxGeometry(1.45, 0.06, 0.12),
            darkMetal
        );
        lockBar.position.y = 0.15;
        this.lidGroup.add(lockBar);

        const lockPost = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.1, 0.15, 16),
            metalMaterial
        );
        lockPost.position.set(0, 0.2, 0);
        this.lidGroup.add(lockPost);

        // Safety valve + jiggle weight (centered on lock bar)
        const valveGroup = new THREE.Group();
        valveGroup.position.set(0, 0.25, 0);
        this.lidGroup.add(valveGroup);

        const valveBody = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.1, 0.16, 16),
            metalMaterial
        );
        valveGroup.add(valveBody);

        const valveCap = new THREE.Mesh(
            new THREE.ConeGeometry(0.09, 0.12, 16),
            darkMetal
        );
        valveCap.position.y = 0.16;
        valveGroup.add(valveCap);
        this.valveCap = valveCap;

        // Pressure gauge mount point (created later)
        this.cooker = cookerGroup;
    }

    createPressureGauge() {
        const gaugeGroup = new THREE.Group();
        // Mount gauge on front of lid, facing the user
        gaugeGroup.position.set(0.0, 0.45, 0.95);
        gaugeGroup.rotation.set(0, 0, 0); // Facing forward toward camera
        this.lidGroup.add(gaugeGroup); // Attach to lid so it moves with it

        // Gauge housing (chrome finish)
        const housingGeometry = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 32);
        const housingMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.9,
            roughness: 0.15
        });
        const housing = new THREE.Mesh(housingGeometry, housingMaterial);
        housing.rotation.x = Math.PI / 2;
        gaugeGroup.add(housing);

        // Chrome bezel ring
        const bezelGeometry = new THREE.TorusGeometry(0.28, 0.02, 8, 32);
        const bezelMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.95,
            roughness: 0.1
        });
        const bezel = new THREE.Mesh(bezelGeometry, bezelMaterial);
        bezel.position.z = 0.06;
        gaugeGroup.add(bezel);

        // Gauge face (off-white dial)
        const faceGeometry = new THREE.CircleGeometry(0.26, 32);
        const faceMaterial = new THREE.MeshBasicMaterial({ color: 0xf8f8f0 });
        const face = new THREE.Mesh(faceGeometry, faceMaterial);
        face.position.z = 0.061;
        gaugeGroup.add(face);

        // Pressure zones arc (cleaner design)
        const lowZone = new THREE.RingGeometry(0.16, 0.23, 24, 1, -Math.PI * 0.7, Math.PI * 0.45);
        const lowMaterial = new THREE.MeshBasicMaterial({ color: 0x44bb44, side: THREE.DoubleSide });
        const low = new THREE.Mesh(lowZone, lowMaterial);
        low.position.z = 0.062;
        gaugeGroup.add(low);

        const medZone = new THREE.RingGeometry(0.16, 0.23, 16, 1, -Math.PI * 0.25, Math.PI * 0.35);
        const medMaterial = new THREE.MeshBasicMaterial({ color: 0xddcc22, side: THREE.DoubleSide });
        const med = new THREE.Mesh(medZone, medMaterial);
        med.position.z = 0.062;
        gaugeGroup.add(med);

        const highZone = new THREE.RingGeometry(0.16, 0.23, 16, 1, Math.PI * 0.1, Math.PI * 0.45);
        const highMaterial = new THREE.MeshBasicMaterial({ color: 0xdd3333, side: THREE.DoubleSide });
        const high = new THREE.Mesh(highZone, highMaterial);
        high.position.z = 0.062;
        gaugeGroup.add(high);

        // Scale markings (major and minor)
        for (let i = 0; i <= 10; i++) {
            const angle = -Math.PI * 0.7 + (i / 10) * Math.PI * 1.25;
            const isMajor = i % 2 === 0;
            const markLength = isMajor ? 0.06 : 0.04;
            const markWidth = isMajor ? 0.015 : 0.01;
            const markGeometry = new THREE.BoxGeometry(markLength, markWidth, 0.005);
            const markMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
            const mark = new THREE.Mesh(markGeometry, markMaterial);
            const radius = 0.2;
            mark.position.set(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                0.063
            );
            mark.rotation.z = angle;
            gaugeGroup.add(mark);
        }

        // Needle (red, tapered)
        const needleShape = new THREE.Shape();
        needleShape.moveTo(0, -0.008);
        needleShape.lineTo(0.18, -0.003);
        needleShape.lineTo(0.18, 0.003);
        needleShape.lineTo(0, 0.008);
        needleShape.lineTo(-0.03, 0);
        needleShape.closePath();

        const needleGeometry = new THREE.ShapeGeometry(needleShape);
        const needleMaterial = new THREE.MeshBasicMaterial({ color: 0xdd0000 });
        this.pressureNeedle = new THREE.Mesh(needleGeometry, needleMaterial);
        this.pressureNeedle.position.z = 0.065;
        gaugeGroup.add(this.pressureNeedle);

        // Center pivot cap
        const pivotGeometry = new THREE.CircleGeometry(0.025, 16);
        const pivotMaterial = new THREE.MeshBasicMaterial({ color: 0xbb0000 });
        const pivot = new THREE.Mesh(pivotGeometry, pivotMaterial);
        pivot.position.z = 0.066;
        gaugeGroup.add(pivot);

        // Glass cover
        const glassGeometry = new THREE.CircleGeometry(0.26, 32);
        const glassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.15,
            metalness: 0,
            roughness: 0
        });
        const glass = new THREE.Mesh(glassGeometry, glassMaterial);
        glass.position.z = 0.07;
        gaugeGroup.add(glass);

        // Mounting stem connecting gauge down to the lid surface
        const stemCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, -0.06, 0),
            new THREE.Vector3(-0.08, -0.18, 0.02),
            new THREE.Vector3(-0.15, -0.32, 0.04)
        ]);
        const stemGeometry = new THREE.TubeGeometry(stemCurve, 16, 0.04, 10, false);
        const stemMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            metalness: 0.85,
            roughness: 0.2
        });
        const stem = new THREE.Mesh(stemGeometry, stemMaterial);
        gaugeGroup.add(stem);

        // Base mount on lid
        const mountBase = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.1, 0.08, 12),
            stemMaterial
        );
        mountBase.position.set(-0.15, -0.36, 0.04);
        gaugeGroup.add(mountBase);

        this.pressureGauge = gaugeGroup;
        this.updatePressureGauge();
    }

    createSteamValve() {
        const valveGroup = new THREE.Group();
        // Position on top of the flat lid, opposite side from gauge
        valveGroup.position.set(-0.5, 0.15, -0.5);
        this.lidGroup.add(valveGroup); // Attach to lid

        // Valve body base
        const baseGeometry = new THREE.CylinderGeometry(0.1, 0.12, 0.1, 12);
        const valveMaterial = new THREE.MeshStandardMaterial({
            color: 0x777777,
            metalness: 0.9,
            roughness: 0.15
        });
        const base = new THREE.Mesh(baseGeometry, valveMaterial);
        valveGroup.add(base);

        // Valve stem
        const stemGeometry = new THREE.CylinderGeometry(0.06, 0.07, 0.15, 8);
        const stem = new THREE.Mesh(stemGeometry, valveMaterial);
        stem.position.y = 0.12;
        valveGroup.add(stem);

        // Valve weight/cap (jiggles when pressure is high)
        const capGeometry = new THREE.CylinderGeometry(0.08, 0.1, 0.12, 12);
        const capMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.8,
            roughness: 0.3
        });
        const cap = new THREE.Mesh(capGeometry, capMaterial);
        cap.position.y = 0.25;
        valveGroup.add(cap);
        this.valveCap = cap;

        // Top knob on cap
        const knobGeometry = new THREE.SphereGeometry(0.05, 12, 8);
        const knob = new THREE.Mesh(knobGeometry, capMaterial);
        knob.position.y = 0.35;
        valveGroup.add(knob);

        this.steamValve = valveGroup;
    }

    createParticles() {
        this.particleSystem = new ParticleSystem(this.scene, {
            count: 50,
            baseSpeed: 0.01,
            particleSize: 0.05,
            showCollisions: true
        });

        // Cooker center is at y=1.1 (cooker body center)
        this.particleSystem.setCenterOffset(0, 0.75, 0);

        // Cylindrical bounds for pressure cooker (radius ~1.1, height from bottom to lid)
        this.cylinderParams = {
            radius: 1.1,
            yMin: 0.1,   // Cooker base on stove surface
            yMax: this.baseLidY - 0.08   // Just below lid with a tighter seal
        };

        this.particleSystem.setBounds(1.1, 0.6, 1.1);
        this.particleSystem.createParticles();
        this.particleSystem.setTemperature(this.state.temperature);
    }

    createKitchenElements() {
        // Counter/table
        const counterGeometry = new THREE.BoxGeometry(8, 0.5, 5);
        const counterMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b7355,
            roughness: 0.7
        });
        const counter = new THREE.Mesh(counterGeometry, counterMaterial);
        counter.position.y = -0.35;
        this.group.add(counter);

        // Back wall
        const wallGeometry = new THREE.PlaneGeometry(8, 4);
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0xe8e4dc,
            roughness: 0.9
        });
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.position.set(0, 1.5, -2.5);
        this.group.add(wall);

        // Kitchen tiles (backsplash)
        for (let x = -3; x <= 3; x += 0.5) {
            for (let y = 0; y <= 2; y += 0.5) {
                const tileGeometry = new THREE.PlaneGeometry(0.48, 0.48);
                const tileMaterial = new THREE.MeshStandardMaterial({
                    color: (x + y) % 1 === 0 ? 0xffffff : 0xf0f0f0,
                    roughness: 0.3
                });
                const tile = new THREE.Mesh(tileGeometry, tileMaterial);
                tile.position.set(x, y + 0.25, -2.49);
                this.group.add(tile);
            }
        }
    }

    setupLighting() {
        // Stove burner glow
        const burnerLight = new THREE.PointLight(0x4488ff, 1, 3);
        burnerLight.position.set(0, 0.5, 0);
        this.group.add(burnerLight);
        this.burnerLight = burnerLight;

        // Kitchen overhead light
        const overheadLight = new THREE.PointLight(0xfff5e6, 0.5, 10);
        overheadLight.position.set(0, 4, 0);
        this.group.add(overheadLight);
    }

    updateFlames() {
        this.flameTime += 0.1;

        this.burnerFlames.forEach((flame) => {
            const t = this.flameTime + flame.phase;

            // Visibility based on heat level
            flame.group.visible = this.heatLevel > 0.05;

            if (!flame.group.visible) return;

            const baseScale = this.heatLevel;

            // Animate each flame layer with different frequencies for realistic flicker
            const coreFlicker = 0.9 + Math.sin(t * 12) * 0.1;
            flame.core.scale.set(baseScale * coreFlicker, baseScale * (1 + Math.sin(t * 10) * 0.1), baseScale * coreFlicker);

            const innerFlicker = 0.85 + Math.sin(t * 8 + 0.3) * 0.15;
            flame.inner.scale.set(baseScale * innerFlicker, baseScale * (1.1 + Math.sin(t * 7) * 0.15), baseScale * innerFlicker);

            const outerFlicker = 0.8 + Math.sin(t * 6 + 0.6) * 0.2;
            flame.outer.scale.set(baseScale * outerFlicker, baseScale * (1.15 + Math.sin(t * 5) * 0.2), baseScale * outerFlicker);

            const tipFlicker = 0.7 + Math.sin(t * 4 + 0.9) * 0.3;
            flame.tip.scale.set(baseScale * tipFlicker, baseScale * (1 + Math.sin(t * 3) * 0.3), baseScale * tipFlicker);
            flame.tip.position.y = 0.18 + Math.sin(t * 5) * 0.02;
        });

        // Update burner light with flicker
        if (this.burnerLight) {
            this.burnerLight.intensity = this.heatLevel * 2 * (0.9 + Math.sin(this.flameTime * 8) * 0.1);
        }

        // Update knob indicator rotation
        if (this.knobIndicator) {
            this.knobIndicator.rotation.z = this.heatLevel * Math.PI;
        }

        // Update lid vibration at high pressure
        this.updateLidVibration();
    }

    updateLidVibration() {
        if (!this.lidGroup) return;

        // Lid vibrates when pressure is high (above 1.5 atm)
        if (this.state.pressure > 1.4) {
            const pressureExcess = (this.state.pressure - 1.4) / 0.6; // 0 to 1 scale
            const vibrationIntensity = pressureExcess * 0.003;

            // Slow, subtle vibration
            this.lidVibration += 0.08;
            const vibX = Math.sin(this.lidVibration * 3) * vibrationIntensity;
            const vibZ = Math.cos(this.lidVibration * 2.5) * vibrationIntensity;
            const vibY = Math.sin(this.lidVibration * 4) * vibrationIntensity * 0.5;

            this.lidGroup.position.x = vibX;
            this.lidGroup.position.z = vibZ;
            this.lidGroup.position.y = this.baseLidY + vibY;
        } else {
            // Reset to normal position
            this.lidGroup.position.set(0, this.baseLidY, 0);
        }
    }

    updatePressureGauge() {
        // Map pressure (1-2 atm) to needle angle
        // -126 degrees (low) to +126 degrees (high)
        const minAngle = -Math.PI * 0.7;
        const maxAngle = Math.PI * 0.6;
        const pressureRange = 2 - 1;
        const normalizedPressure = Math.min(1, Math.max(0, (this.state.pressure - 1) / pressureRange));
        const angle = minAngle + normalizedPressure * (maxAngle - minAngle);

        if (this.pressureNeedle) {
            this.pressureNeedle.rotation.z = angle;
        }
    }

    updateSteamValve() {
        if (!this.valveCap) return;

        // Valve jiggles when pressure is high (above 1.5 atm)
        if (this.state.pressure > 1.5) {
            const pressureExcess = (this.state.pressure - 1.5) / 0.5; // 0 to 1 scale

            // Slower, more deliberate jiggle (like a real pressure cooker valve)
            const jiggleFreq = 2 + pressureExcess * 2; // 2-4 Hz
            const jiggleAmp = 0.015 + pressureExcess * 0.02;

            const jiggle = Math.sin(this.flameTime * jiggleFreq) * jiggleAmp;
            this.valveCap.position.y = 0.25 + Math.max(0, jiggle); // Only lift, don't push down
            this.valveCap.rotation.y = Math.sin(this.flameTime * jiggleFreq * 0.7) * 0.15 * pressureExcess;

            // Slight tilt during venting
            this.valveCap.rotation.x = Math.sin(this.flameTime * jiggleFreq * 0.5) * 0.05 * pressureExcess;
        } else {
            // Reset to rest position
            this.valveCap.position.y = 0.25;
            this.valveCap.rotation.set(0, 0, 0);
        }
    }

    setTemperature(temp) {
        this.state.temperature = temp;
        // Gay-Lussac's Law: P₁/T₁ = P₂/T₂ = k
        this.state.pressure = this.state.k * temp;

        // Drive flame level from temperature range (300–500 K)
        const minT = 300;
        const maxT = 500;
        const normalized = Math.min(1, Math.max(0, (temp - minT) / (maxT - minT)));
        this.heatLevel = normalized;

        // Update particle speeds
        this.particleSystem.setTemperature(temp);

        this.updatePressureGauge();

        return this.state;
    }

    getState() {
        return { ...this.state };
    }

    update(deltaTime) {
        this.updateFlames();
        this.updateSteamValve();

        if (this.particleSystem) {
            // Use cylindrical bounds for the pressure cooker
            this.particleSystem.update(deltaTime, false, this.cylinderParams);
        }
    }

    setParticleCount(count) {
        if (this.particleSystem) {
            this.particleSystem.setParticleCount(count);
            this.particleSystem.repositionParticles();
            this.particleSystem.enforceContainment();
        }
    }

    setAnimationSpeed(speed) {
        if (this.particleSystem) {
            this.particleSystem.animationSpeed = speed;
        }
    }

    setParticleSize(size) {
        if (this.particleSystem) {
            this.particleSystem.setParticleSize(size);
        }
    }

    setShowTrails(show) {
        if (this.particleSystem) {
            this.particleSystem.setShowTrails(show);
        }
    }

    setShowCollisions(show) {
        if (this.particleSystem) {
            this.particleSystem.setShowCollisions(show);
        }
    }

    dispose() {
        if (this.particleSystem) {
            this.particleSystem.clearParticles();
        }
        this.scene.remove(this.group);
    }

    reset() {
        this.state = {
            temperature: 350,
            pressure: 1.17,
            volume: 10.0,
            moles: 1.0,
            k: 0.00333
        };
        this.heatLevel = 0.5;
        this.setTemperature(350);
    }
}
