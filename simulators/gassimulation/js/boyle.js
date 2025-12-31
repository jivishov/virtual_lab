/**
 * Boyle's Law Visualization
 * P₁V₁ = P₂V₂ (at constant temperature)
 *
 * Scene: Piston-Cylinder system
 * - Adjustable piston that changes volume
 * - Particles compress as volume decreases
 * - Visual pressure indicator
 * - Proper cylindrical particle containment
 */

import { ParticleSystem } from './particles.js';

export class BoyleScene {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        // Gas state - using real physics
        // At constant T=273K and n=1mol, using PV = nRT
        // Initial: V=5L, P = nRT/V = 1*0.0821*273/5 = 4.48 atm (we'll scale for visualization)
        this.state = {
            volume: 5.0,        // Liters
            pressure: 2.0,      // atm
            temperature: 273,   // K (constant)
            moles: 1.0,         // mol (constant)
            k: 10.0             // P*V constant (L·atm)
        };

        // Cylinder dimensions
        this.cylinderRadius = 1.4;
        this.cylinderBaseY = 0.15;  // Bottom of gas chamber
        this.maxPistonY = 3.5;      // Piston at max volume
        this.minPistonY = 1.0;      // Piston at min volume

        // Scene objects
        this.cylinder = null;
        this.piston = null;
        this.pistonHandle = null;
        this.pressureGauge = null;
        this.pressureNeedle = null;

        // Particle system
        this.particleSystem = null;
        this.cylinderParams = {
            radius: this.cylinderRadius - 0.1,
            yMin: this.cylinderBaseY,
            yMax: this.maxPistonY - 0.1
        };

        this.init();
    }

    init() {
        this.createCylinder();
        this.createPiston();
        this.createPressureGauge();
        this.createParticles();
        this.createBase();
        this.setupLighting();

        // Set camera position for good view
        this.camera.position.set(5, 3, 5);
        this.camera.lookAt(0, 1.5, 0);
    }

    createCylinder() {
        // Glass cylinder (transparent tube)
        const cylinderGeometry = new THREE.CylinderGeometry(
            this.cylinderRadius,
            this.cylinderRadius,
            4,
            32,
            1,
            true // Open ended
        );

        const cylinderMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
            metalness: 0.0,
            roughness: 0.1,
            envMapIntensity: 0.5
        });

        this.cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
        this.cylinder.position.y = 2;
        this.group.add(this.cylinder);

        // Cylinder base plate (sealed bottom)
        const baseGeometry = new THREE.CylinderGeometry(
            this.cylinderRadius,
            this.cylinderRadius,
            0.15,
            32
        );
        const metalMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            metalness: 0.9,
            roughness: 0.2
        });
        const basePlate = new THREE.Mesh(baseGeometry, metalMaterial);
        basePlate.position.y = 0.075;
        this.group.add(basePlate);

        // Cylinder rim at top (guide for piston)
        const rimGeometry = new THREE.TorusGeometry(this.cylinderRadius, 0.05, 8, 32);
        const rimMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            metalness: 0.9,
            roughness: 0.2
        });
        const topRim = new THREE.Mesh(rimGeometry, rimMaterial);
        topRim.rotation.x = Math.PI / 2;
        topRim.position.y = 4;
        this.group.add(topRim);

        // Inner glow effect
        const glowGeometry = new THREE.CylinderGeometry(
            this.cylinderRadius - 0.02,
            this.cylinderRadius - 0.02,
            3.8,
            32,
            1,
            true
        );
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.03,
            side: THREE.BackSide
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.y = 2;
        this.group.add(glow);
    }

    createPiston() {
        const pistonGroup = new THREE.Group();
        this.group.add(pistonGroup);

        // Piston head (fits snugly in cylinder)
        const pistonGeometry = new THREE.CylinderGeometry(
            this.cylinderRadius - 0.03,
            this.cylinderRadius - 0.03,
            0.15,
            32
        );
        const pistonMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.9,
            roughness: 0.15
        });

        const pistonHead = new THREE.Mesh(pistonGeometry, pistonMaterial);
        pistonGroup.add(pistonHead);

        // Rubber seal ring on piston
        const sealGeometry = new THREE.TorusGeometry(this.cylinderRadius - 0.05, 0.04, 8, 32);
        const sealMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.95
        });
        const seal = new THREE.Mesh(sealGeometry, sealMaterial);
        seal.rotation.x = Math.PI / 2;
        seal.position.y = -0.05;
        pistonGroup.add(seal);

        // Piston rod
        const rodGeometry = new THREE.CylinderGeometry(0.12, 0.12, 1.8, 16);
        const rodMaterial = new THREE.MeshStandardMaterial({
            color: 0x777777,
            metalness: 0.95,
            roughness: 0.15
        });
        const rod = new THREE.Mesh(rodGeometry, rodMaterial);
        rod.position.y = 1;
        pistonGroup.add(rod);

        // Piston handle (T-shape)
        const handleGeometry = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 16);
        const handleMaterial = new THREE.MeshStandardMaterial({
            color: 0xcc3333,
            metalness: 0.3,
            roughness: 0.5
        });
        this.pistonHandle = new THREE.Mesh(handleGeometry, handleMaterial);
        this.pistonHandle.rotation.z = Math.PI / 2;
        this.pistonHandle.position.y = 1.95;
        pistonGroup.add(this.pistonHandle);

        // Handle grips
        const gripGeometry = new THREE.SphereGeometry(0.12, 16, 16);
        const grip1 = new THREE.Mesh(gripGeometry, handleMaterial);
        grip1.position.set(0.5, 1.95, 0);
        pistonGroup.add(grip1);
        const grip2 = new THREE.Mesh(gripGeometry, handleMaterial);
        grip2.position.set(-0.5, 1.95, 0);
        pistonGroup.add(grip2);

        this.piston = pistonGroup;
        this.updatePistonPosition();
    }

    createPressureGauge() {
        const gaugeGroup = new THREE.Group();
        gaugeGroup.position.set(this.cylinderRadius + 1.0, 2.5, 0);
        gaugeGroup.rotation.y = -Math.PI / 6;
        this.group.add(gaugeGroup);

        // Gauge body (circular housing)
        const housingGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.15, 32);
        const housingMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.85,
            roughness: 0.2
        });
        const housing = new THREE.Mesh(housingGeometry, housingMaterial);
        housing.rotation.x = Math.PI / 2;
        gaugeGroup.add(housing);

        // Gauge face (white background)
        const faceGeometry = new THREE.CircleGeometry(0.45, 32);
        const faceMaterial = new THREE.MeshBasicMaterial({ color: 0xf8f8f8 });
        const face = new THREE.Mesh(faceGeometry, faceMaterial);
        face.position.z = 0.08;
        gaugeGroup.add(face);

        // Pressure zones (green-yellow-red arc)
        const createZone = (startAngle, arcLength, color) => {
            const zoneGeometry = new THREE.RingGeometry(0.28, 0.4, 24, 1, startAngle, arcLength);
            const zoneMaterial = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });
            const zone = new THREE.Mesh(zoneGeometry, zoneMaterial);
            zone.position.z = 0.081;
            return zone;
        };

        // Low pressure zone (green): 1-2 atm
        gaugeGroup.add(createZone(-Math.PI * 0.75, Math.PI * 0.5, 0x22aa22));
        // Medium pressure zone (yellow): 2-3.5 atm
        gaugeGroup.add(createZone(-Math.PI * 0.25, Math.PI * 0.5, 0xdddd22));
        // High pressure zone (red): 3.5-5 atm
        gaugeGroup.add(createZone(Math.PI * 0.25, Math.PI * 0.5, 0xdd2222));

        // Scale markings
        for (let i = 0; i <= 8; i++) {
            const angle = -Math.PI * 0.75 + (i / 8) * Math.PI * 1.5;
            const isMain = i % 2 === 0;
            const length = isMain ? 0.08 : 0.05;
            const markGeometry = new THREE.BoxGeometry(length, 0.02, 0.005);
            const markMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
            const mark = new THREE.Mesh(markGeometry, markMaterial);
            const radius = 0.35;
            mark.position.set(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                0.082
            );
            mark.rotation.z = angle;
            gaugeGroup.add(mark);
        }

        // Needle
        const needleGeometry = new THREE.BoxGeometry(0.32, 0.02, 0.01);
        const needleMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.pressureNeedle = new THREE.Mesh(needleGeometry, needleMaterial);
        this.pressureNeedle.geometry.translate(0.12, 0, 0);
        this.pressureNeedle.position.z = 0.09;
        gaugeGroup.add(this.pressureNeedle);

        // Needle center pivot
        const pivotGeometry = new THREE.CircleGeometry(0.04, 16);
        const pivotMaterial = new THREE.MeshBasicMaterial({ color: 0xcc0000 });
        const pivot = new THREE.Mesh(pivotGeometry, pivotMaterial);
        pivot.position.z = 0.091;
        gaugeGroup.add(pivot);

        // Connection pipe to cylinder
        const pipeGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8);
        const pipeMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            metalness: 0.85
        });
        const pipe = new THREE.Mesh(pipeGeometry, pipeMaterial);
        pipe.rotation.z = Math.PI / 2;
        pipe.position.set(-0.6, 0, 0);
        gaugeGroup.add(pipe);

        // Pipe elbow to cylinder wall
        const elbowGeometry = new THREE.TorusGeometry(0.15, 0.06, 8, 8, Math.PI / 2);
        const elbow = new THREE.Mesh(elbowGeometry, pipeMaterial);
        elbow.position.set(-1.0, -0.15, 0);
        elbow.rotation.y = Math.PI / 2;
        gaugeGroup.add(elbow);

        this.pressureGauge = gaugeGroup;
        this.updatePressureGauge();
    }

    createBase() {
        // Base platform
        const baseGeometry = new THREE.CylinderGeometry(2, 2.2, 0.2, 32);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.7,
            roughness: 0.3
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = -0.1;
        this.group.add(base);

        // Floor shadow catcher
        const floorGeometry = new THREE.PlaneGeometry(8, 8);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x333340,
            roughness: 0.9
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.2;
        this.group.add(floor);
    }

    createParticles() {
        this.particleSystem = new ParticleSystem(this.scene, {
            count: 50,
            baseSpeed: 0.009,
            particleSize: 0.06,
            showCollisions: true
        });

        // Set center and bounds for cylinder
        const pistonY = this.getPistonY();
        const centerY = (this.cylinderBaseY + pistonY) / 2;
        const halfHeight = (pistonY - this.cylinderBaseY) / 2;

        this.particleSystem.setCenterOffset(0, centerY, 0);
        this.particleSystem.setBounds(
            this.cylinderRadius - 0.15,
            halfHeight - 0.1,
            this.cylinderRadius - 0.15
        );

        this.particleSystem.createParticles();
        this.particleSystem.setTemperature(this.state.temperature);
    }

    setupLighting() {
        // Point light inside cylinder for particle illumination
        const innerLight = new THREE.PointLight(0x6699ff, 0.6, 4);
        innerLight.position.set(0, 2, 0);
        this.group.add(innerLight);

        // Spot light on gauge
        const gaugeLight = new THREE.SpotLight(0xffffff, 0.4, 5, Math.PI / 6);
        gaugeLight.position.set(3, 4, 2);
        gaugeLight.target.position.set(this.cylinderRadius + 1.0, 2.5, 0);
        this.group.add(gaugeLight);
        this.group.add(gaugeLight.target);
    }

    getPistonY() {
        // Map volume (2-10 L) to piston height
        const volumeRange = 10 - 2;
        const heightRange = this.maxPistonY - this.minPistonY;
        const normalizedVolume = (this.state.volume - 2) / volumeRange;
        return this.minPistonY + normalizedVolume * heightRange;
    }

    updatePistonPosition() {
        const pistonY = this.getPistonY();
        this.piston.position.y = pistonY;

        // Update cylinder params for particle containment
        this.cylinderParams.yMax = pistonY - 0.1;
    }

    updatePressureGauge() {
        // Map pressure (1-5 atm) to needle angle
        // -135 degrees (1 atm) to +135 degrees (5 atm)
        const minAngle = -Math.PI * 0.75;
        const maxAngle = Math.PI * 0.75;
        const pressureRange = 5 - 1;
        const normalizedPressure = Math.min(1, Math.max(0, (this.state.pressure - 1) / pressureRange));
        const angle = minAngle + normalizedPressure * (maxAngle - minAngle);

        if (this.pressureNeedle) {
            this.pressureNeedle.rotation.z = angle;
        }
    }

    updateParticleBounds() {
        const pistonY = this.getPistonY();
        const centerY = (this.cylinderBaseY + pistonY) / 2;
        const halfHeight = (pistonY - this.cylinderBaseY) / 2 - 0.05;

        this.particleSystem.setCenterOffset(0, centerY, 0);
        this.particleSystem.setBounds(
            this.cylinderRadius - 0.15,
            halfHeight,
            this.cylinderRadius - 0.15
        );

        // Update cylinder params
        this.cylinderParams.yMax = pistonY - 0.08;

        // Push particles that are now outside the piston
        this.particleSystem.particles.forEach(particle => {
            if (particle.mesh.position.y > pistonY - 0.15) {
                particle.mesh.position.y = pistonY - 0.2;
                particle.velocity.y = -Math.abs(particle.velocity.y);
            }
            if (particle.mesh.position.y < this.cylinderBaseY + 0.1) {
                particle.mesh.position.y = this.cylinderBaseY + 0.15;
            }
        });
    }

    setVolume(volume) {
        this.state.volume = volume;
        // Boyle's Law: P₁V₁ = P₂V₂ = k (constant at fixed T and n)
        this.state.pressure = this.state.k / volume;

        this.updatePistonPosition();
        this.updatePressureGauge();
        this.updateParticleBounds();

        return this.state;
    }

    getState() {
        return { ...this.state };
    }

    update(deltaTime) {
        if (this.particleSystem) {
            // Use cylindrical constraint for proper piston-cylinder physics
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
            volume: 5.0,
            pressure: 2.0,
            temperature: 273,
            moles: 1.0,
            k: 10.0
        };
        this.setVolume(5.0);
        this.particleSystem.setTemperature(273);
        this.particleSystem.repositionParticles();
    }
}
