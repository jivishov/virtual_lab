/**
 * Avogadro's Law Visualization
 * V₁/n₁ = V₂/n₂ (at constant temperature and pressure)
 *
 * Scene: Helium Tank Filling Balloons
 * - Helium gas tank with regulator
 * - Multiple balloons being filled
 * - More moles = larger balloons
 * - Molar volume demonstration (22.4 L/mol at STP)
 */

import { ParticleSystem } from './particles.js';

export class AvogadroScene {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.baseParticleDensity = 50;
        this.lastKnotPosition = new THREE.Vector3(2.5, 2, 0);

        // Gas state
        this.state = {
            moles: 1.0,         // mol
            volume: 22.4,       // L (V = Vm * n)
            temperature: 273,   // K (constant - STP)
            pressure: 1.0,      // atm (constant)
            Vm: 22.4            // Molar volume at STP
        };

        // Scene objects
        this.tank = null;
        this.regulator = null;
        this.hose = null;
        this.balloons = [];
        this.nozzle = null;

        // Particle system
        this.particleSystem = null;

        // Animation
        this.flowTime = 0;
        this.gasFlowParticles = [];

        this.init();
    }

    init() {
        this.createTank();
        this.createRegulator();
        this.createHose();
        this.createBalloons();
        this.createEnvironment();
        this.createParticles();
        this.setupLighting();

        // Set camera position
        this.camera.position.set(7, 4, 8);
        this.camera.lookAt(0, 2, 0);
    }

    createTank() {
        const tankGroup = new THREE.Group();
        tankGroup.position.set(-3, 0, 0);
        this.group.add(tankGroup);

        // Main tank body (tall cylinder)
        const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 3, 32);
        const tankMaterial = new THREE.MeshStandardMaterial({
            color: 0x228b22, // Forest green for helium tanks
            metalness: 0.7,
            roughness: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, tankMaterial);
        body.position.y = 1.5;
        tankGroup.add(body);

        // Tank top dome
        const topGeometry = new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const top = new THREE.Mesh(topGeometry, tankMaterial);
        top.position.y = 3;
        tankGroup.add(top);

        // Tank bottom dome
        const bottomGeometry = new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
        const bottom = new THREE.Mesh(bottomGeometry, tankMaterial);
        bottom.position.y = 0;
        tankGroup.add(bottom);

        // Tank valve assembly
        const valveGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.3, 16);
        const valveMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccc00,
            metalness: 0.9,
            roughness: 0.2
        });
        const valve = new THREE.Mesh(valveGeometry, valveMaterial);
        valve.position.y = 3.4;
        tankGroup.add(valve);

        // Valve handle (wheel)
        const wheelGeometry = new THREE.TorusGeometry(0.15, 0.03, 8, 16);
        const wheel = new THREE.Mesh(wheelGeometry, valveMaterial);
        wheel.position.y = 3.55;
        tankGroup.add(wheel);

        // Safety cap
        const capGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.4, 16);
        const capMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.6
        });
        const cap = new THREE.Mesh(capGeometry, capMaterial);
        cap.position.y = 3.3;
        tankGroup.add(cap);

        // Create readable helium tank label using canvas texture
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 256;
        labelCanvas.height = 192;
        const ctx = labelCanvas.getContext('2d');

        // Yellow/gold background
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);

        // Green header bar
        ctx.fillStyle = '#228b22';
        ctx.fillRect(0, 0, labelCanvas.width, 50);

        // "He" symbol in white on green bar
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('He', labelCanvas.width / 2, 28);

        // "HELIUM" text in black
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 42px Arial, sans-serif';
        ctx.fillText('HELIUM', labelCanvas.width / 2, 95);

        // "GAS" subtext
        ctx.font = 'bold 28px Arial, sans-serif';
        ctx.fillText('GAS', labelCanvas.width / 2, 135);

        // Red warning stripe at bottom
        ctx.fillStyle = '#cc0000';
        ctx.fillRect(0, 165, labelCanvas.width, 27);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.fillText('CAUTION: COMPRESSED GAS', labelCanvas.width / 2, 178);

        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelGeometry = new THREE.PlaneGeometry(0.8, 0.6);
        const labelMaterial = new THREE.MeshBasicMaterial({
            map: labelTexture,
            side: THREE.DoubleSide
        });
        const label = new THREE.Mesh(labelGeometry, labelMaterial);
        label.position.set(0, 2.2, 0.51);
        tankGroup.add(label);

        // Secondary label on side (rotated)
        const sideLabel = new THREE.Mesh(labelGeometry.clone(), labelMaterial.clone());
        sideLabel.position.set(0.51, 2.2, 0);
        sideLabel.rotation.y = Math.PI / 2;
        tankGroup.add(sideLabel);

        // Tank stand/base
        const baseGeometry = new THREE.CylinderGeometry(0.6, 0.7, 0.2, 32);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.5
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = -0.1;
        tankGroup.add(base);

        this.tank = tankGroup;
    }

    createRegulator() {
        const regGroup = new THREE.Group();
        regGroup.position.set(-2.3, 3.2, 0);
        this.group.add(regGroup);

        // Regulator body
        const bodyGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.3);
        const regMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.8
        });
        const body = new THREE.Mesh(bodyGeometry, regMaterial);
        regGroup.add(body);

        // Pressure gauge
        const gaugeGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16);
        const gaugeMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            metalness: 0.9
        });
        const gauge = new THREE.Mesh(gaugeGeometry, gaugeMaterial);
        gauge.rotation.x = Math.PI / 2;
        gauge.position.set(0, 0.1, 0.17);
        regGroup.add(gauge);

        // Gauge face
        const faceGeometry = new THREE.CircleGeometry(0.1, 16);
        const faceMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const face = new THREE.Mesh(faceGeometry, faceMaterial);
        face.position.set(0, 0.1, 0.2);
        regGroup.add(face);

        // Flow control knob
        const knobGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 12);
        const knobMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const knob = new THREE.Mesh(knobGeometry, knobMaterial);
        knob.position.set(0.25, 0, 0);
        knob.rotation.z = Math.PI / 2;
        regGroup.add(knob);

        // Connection to tank
        const connGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.3, 8);
        const conn = new THREE.Mesh(connGeometry, regMaterial);
        conn.rotation.z = Math.PI / 2;
        conn.position.set(-0.35, 0, 0);
        regGroup.add(conn);

        this.regulator = regGroup;
    }

    createHose() {
        this.hoseGroup = new THREE.Group();
        this.group.add(this.hoseGroup);

        // Hose connects from regulator to balloon's knot opening
        // Regulator is at (-2.1, 3.1, 0)
        // Balloon is at (2.5, 3, 0), knot is at y = -1 relative, so absolute (2.5, 2, 0)
        const hoseStartY = 3.1;
        const knotPosition = new THREE.Vector3(2.5, 2, 0);

        // Create curved hose path that drapes naturally then curves up to balloon knot
        const hoseCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-2.1, hoseStartY, 0.1),          // From regulator
            new THREE.Vector3(-1.5, 2.2, 0.3),                  // Drops down
            new THREE.Vector3(-0.5, 1.5, 0.4),                  // Sags in middle
            new THREE.Vector3(0.5, 1.3, 0.3),                   // Low point
            new THREE.Vector3(1.5, 1.5, 0.15),                   // Rises toward balloon
            new THREE.Vector3(2.2, 1.8, 0.05),                   // Approaching knot
            new THREE.Vector3(2.5, 2.0, 0)                       // At balloon knot
        ]);

        const tubeGeometry = new THREE.TubeGeometry(hoseCurve, 32, 0.06, 8, false);
        const hoseMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.7
        });
        const hose = new THREE.Mesh(tubeGeometry, hoseMaterial);
        this.hoseGroup.add(hose);

        // Create nozzle/adapter at the balloon end
        const nozzleGroup = new THREE.Group();
        nozzleGroup.position.copy(knotPosition);

        // Nozzle adapter connecting to balloon knot
        const adapterGeometry = new THREE.CylinderGeometry(0.08, 0.06, 0.15, 12);
        const nozzleMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            metalness: 0.7,
            roughness: 0.3
        });
        const adapter = new THREE.Mesh(adapterGeometry, nozzleMaterial);
        nozzleGroup.add(adapter);

        // Grip ridges on adapter
        for (let i = 0; i < 3; i++) {
            const ridgeGeometry = new THREE.TorusGeometry(0.075, 0.008, 6, 16);
            const ridge = new THREE.Mesh(ridgeGeometry, nozzleMaterial);
            ridge.rotation.x = Math.PI / 2;
            ridge.position.y = -0.04 + i * 0.04;
            nozzleGroup.add(ridge);
        }

        this.hoseGroup.add(nozzleGroup);
        this.nozzle = nozzleGroup;

        // Create gas flow particles along the hose
        this.createGasFlowParticles(hoseCurve);

        this.hose = hose;
        this.hoseCurve = hoseCurve;
    }

    createBalloons() {
        this.balloons = [];
        const colors = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181];

        // Create main balloon (the one being filled)
        const mainBalloonGroup = new THREE.Group();
        mainBalloonGroup.position.set(2.5, 3, 0);
        this.group.add(mainBalloonGroup);

        // Balloon body with slight teardrop shape
        const mainGeometry = new THREE.SphereGeometry(1, 32, 24);
        // Slightly stretch bottom to make teardrop
        const positions = mainGeometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const y = positions.getY(i);
            if (y < 0) {
                positions.setY(i, y * 1.15);
            }
        }
        mainGeometry.computeVertexNormals();

        const mainMaterial = new THREE.MeshPhysicalMaterial({
            color: colors[0],
            transparent: true,
            opacity: 0.75,
            metalness: 0.05,
            roughness: 0.25,
            side: THREE.DoubleSide
        });
        const mainBalloon = new THREE.Mesh(mainGeometry, mainMaterial);
        mainBalloonGroup.add(mainBalloon);

        // Balloon knot (tied opening where hose connects)
        const knotGroup = new THREE.Group();
        knotGroup.position.y = -1;
        mainBalloonGroup.add(knotGroup);

        // Neck opening transition
        const neckGeometry = new THREE.CylinderGeometry(0.1, 0.15, 0.12, 12);
        const knotMaterial = new THREE.MeshStandardMaterial({
            color: colors[0],
            roughness: 0.6
        });
        const neck = new THREE.Mesh(neckGeometry, knotMaterial);
        neck.position.y = 0.06;
        knotGroup.add(neck);

        // Knot bulge
        const knotGeometry = new THREE.SphereGeometry(0.07, 10, 8);
        const knot = new THREE.Mesh(knotGeometry, knotMaterial);
        knot.scale.set(1, 1.3, 0.8);
        knotGroup.add(knot);

        // Tail below knot
        const tailGeometry = new THREE.ConeGeometry(0.05, 0.08, 8);
        const tail = new THREE.Mesh(tailGeometry, knotMaterial);
        tail.position.y = -0.08;
        tail.rotation.z = Math.PI;
        knotGroup.add(tail);

        this.balloonKnot = knotGroup;

        // String attached to knot
        const stringCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, -1.12, 0),
            new THREE.Vector3(-0.05, -1.5, 0.02),
            new THREE.Vector3(0.03, -1.9, -0.02),
            new THREE.Vector3(-0.02, -2.3, 0.01)
        ]);
        const stringGeometry = new THREE.TubeGeometry(stringCurve, 12, 0.008, 4, false);
        const stringMaterial = new THREE.MeshBasicMaterial({ color: 0x666666 });
        const string = new THREE.Mesh(stringGeometry, stringMaterial);
        mainBalloonGroup.add(string);

        this.mainBalloon = mainBalloonGroup;
        this.mainBalloonMesh = mainBalloon;
        this.balloons.push({
            group: mainBalloonGroup,
            mesh: mainBalloon,
            baseY: 3
        });

        // Create some background balloons (already filled and floating)
        const bgPositions = [
            { x: 4.5, y: 4.2, z: -1.2 },
            { x: 4, y: 5, z: 0.8 },
            { x: 5.5, y: 3.8, z: 0.3 }
        ];

        bgPositions.forEach((pos, i) => {
            const bgGroup = new THREE.Group();
            bgGroup.position.set(pos.x, pos.y, pos.z);
            this.group.add(bgGroup);

            const size = 0.5 + Math.random() * 0.3;
            const bgGeometry = new THREE.SphereGeometry(size, 16, 12);
            const bgMaterial = new THREE.MeshPhysicalMaterial({
                color: colors[(i + 1) % colors.length],
                transparent: true,
                opacity: 0.7,
                metalness: 0.05,
                roughness: 0.3
            });
            const bgBalloon = new THREE.Mesh(bgGeometry, bgMaterial);
            bgGroup.add(bgBalloon);

            // Simple knot for background balloons
            const bgKnotGeometry = new THREE.SphereGeometry(0.05, 8, 6);
            const bgKnotMaterial = new THREE.MeshStandardMaterial({
                color: colors[(i + 1) % colors.length]
            });
            const bgKnot = new THREE.Mesh(bgKnotGeometry, bgKnotMaterial);
            bgKnot.position.y = -size - 0.05;
            bgKnot.scale.y = 1.4;
            bgGroup.add(bgKnot);

            // String for background balloons
            const bgStringGeometry = new THREE.CylinderGeometry(0.006, 0.006, 1.2, 4);
            const bgString = new THREE.Mesh(bgStringGeometry, stringMaterial.clone());
            bgString.position.y = -size - 0.7;
            bgGroup.add(bgString);

            this.balloons.push({
                group: bgGroup,
                mesh: bgBalloon,
                baseY: pos.y
            });
        });
    }

    createEnvironment() {
        // Floor
        const floorGeometry = new THREE.PlaneGeometry(15, 15);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.8
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.2;
        this.group.add(floor);

        // Back wall
        const wallGeometry = new THREE.PlaneGeometry(15, 8);
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x111827,
            roughness: 0.9
        });
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.position.set(0, 3.8, -5);
        this.group.add(wall);

        // Table for tank
        const tableGeometry = new THREE.BoxGeometry(2, 0.1, 1.5);
        const tableMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            roughness: 0.7
        });
        const table = new THREE.Mesh(tableGeometry, tableMaterial);
        table.position.set(-3, -0.15, 0);
        this.group.add(table);

        // Table legs
        const legGeometry = new THREE.BoxGeometry(0.1, 0.8, 0.1);
        const corners = [[-0.9, -0.6], [0.9, -0.6], [-0.9, 0.6], [0.9, 0.6]];
        corners.forEach(([x, z]) => {
            const leg = new THREE.Mesh(legGeometry, tableMaterial);
            leg.position.set(-3 + x, -0.6, z);
            this.group.add(leg);
        });

        // Sign: "HELIUM - Handle with Care"
        const signGeometry = new THREE.PlaneGeometry(1.5, 0.5);
        const signMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            side: THREE.DoubleSide
        });
        const sign = new THREE.Mesh(signGeometry, signMaterial);
        sign.position.set(-3, 4, -0.6);
        sign.rotation.y = 0.3;
        this.group.add(sign);
    }

    createParticles() {
        this.particleSystem = new ParticleSystem(this.scene, {
            count: 50,
            baseSpeed: 0.006,
            particleSize: 0.04,
            showCollisions: true
        });

        // Set center offset to main balloon position
        this.particleSystem.setCenterOffset(2.5, 3, 0);

        // Use spherical bounds for the balloon - particles must stay inside
        const volumeRatio = this.state.volume / 22.4;
        const radiusRatio = Math.cbrt(volumeRatio);
        const radius = 0.82 * radiusRatio * 0.55; // Keep particles just behind balloon walls

        this.particleSystem.sphereParams = {
            radius: radius,
            centerY: -0.18 // Nudge center downward to match balloon shape
        };

        this.updateParticleBounds();
        this.particleSystem.createParticles();
        this.particleSystem.setTemperature(this.state.temperature);
    }

    createGasFlowParticles(hoseCurve) {
        // Small particles showing gas flow along the hose
        this.gasFlowParticles = [];

        for (let i = 0; i < 12; i++) {
            const geometry = new THREE.SphereGeometry(0.015 + Math.random() * 0.01, 6, 6);
            const material = new THREE.MeshBasicMaterial({
                color: 0x99ddff,
                transparent: true,
                opacity: 0.7
            });
            const particle = new THREE.Mesh(geometry, material);
            particle.visible = false;
            this.hoseGroup.add(particle);
            this.gasFlowParticles.push({
                mesh: particle,
                progress: i / 12,
                speed: 0.008 + Math.random() * 0.004,
                active: false
            });
        }
    }

    updateGasFlowParticles() {
        if (!this.hoseCurve || !this.gasFlowParticles) return;

        this.gasFlowParticles.forEach((particle) => {
            // Randomly activate particles
            if (!particle.active && Math.random() < 0.02) {
                particle.active = true;
                particle.progress = 0;
                particle.mesh.visible = true;
            }

            if (particle.active) {
                particle.progress += particle.speed;

                if (particle.progress >= 1) {
                    particle.active = false;
                    particle.mesh.visible = false;
                    particle.progress = 0;
                } else {
                    // Position along curve
                    const point = this.hoseCurve.getPoint(particle.progress);
                    particle.mesh.position.copy(point);

                    // Slight random offset for natural look
                    particle.mesh.position.x += (Math.random() - 0.5) * 0.02;
                    particle.mesh.position.y += (Math.random() - 0.5) * 0.02;

                    // Fade near the end
                    particle.mesh.material.opacity = particle.progress < 0.8 ? 0.7 : 0.7 * (1 - (particle.progress - 0.8) / 0.2);
                }
            }
        });
    }

    setupLighting() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.group.add(ambient);

        // Spotlight on balloons
        const spotlight = new THREE.SpotLight(0xffffff, 0.8);
        spotlight.position.set(5, 8, 5);
        spotlight.angle = Math.PI / 4;
        spotlight.castShadow = true;
        this.group.add(spotlight);
    }

    updateBalloonSize() {
        // Calculate balloon radius based on moles
        // V = Vm * n, and V = (4/3)πr³
        // So r = ³√(3V/4π)
        const volume = this.state.volume;
        const radius = Math.cbrt((3 * volume) / (4 * Math.PI)) * 0.3; // Scale factor

        if (this.mainBalloonMesh) {
            this.mainBalloonMesh.scale.set(radius, radius * 1.1, radius);

            // Adjust knot position (child index 1 is the knot group)
            if (this.balloonKnot) {
                this.balloonKnot.position.y = -radius * 1.15;
            }

            // Balloon floats higher with more helium
            const newBalloonY = 3 + (this.state.moles - 1) * 0.5;
            this.mainBalloon.position.y = newBalloonY;

            // Update particle center offset to match balloon position
            if (this.particleSystem) {
                this.particleSystem.setCenterOffset(2.5, newBalloonY, 0);
            }

            // Keep hose and nozzle aligned with the knot
            this.updateHoseAndNozzle();
        }
    }

    updateHoseCurve(knotPosition) {
        if (!this.hose || !this.hoseGroup) return;

        const knotY = knotPosition ? knotPosition.y : (this.balloonKnot ? this.balloonKnot.getWorldPosition(new THREE.Vector3()).y : 2);
        const knotX = knotPosition ? knotPosition.x : 2.5;
        const knotZ = knotPosition ? knotPosition.z : 0;

        // Recreate hose with updated endpoint
        const newCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-2.1, 3.1, 0.1),
            new THREE.Vector3(-1.5, 2.2, 0.3),
            new THREE.Vector3(-0.5, 1.5, 0.4),
            new THREE.Vector3(0.5, 1.3, 0.3),
            new THREE.Vector3(1.5, Math.min(1.5, knotY - 0.3), 0.15),
            new THREE.Vector3(2.2, Math.min(1.8, knotY - 0.1), 0.05),
            new THREE.Vector3(knotX, knotY, knotZ)
        ]);

        // Update geometry
        const newGeometry = new THREE.TubeGeometry(newCurve, 32, 0.06, 8, false);
        this.hose.geometry.dispose();
        this.hose.geometry = newGeometry;
        this.hoseCurve = newCurve;
    }

    getBalloonKnotWorldPosition() {
        if (!this.balloonKnot) return null;
        const position = new THREE.Vector3();
        if (this.balloonKnot.parent) {
            this.balloonKnot.parent.updateMatrixWorld(true);
        }
        this.balloonKnot.updateMatrixWorld();
        this.balloonKnot.getWorldPosition(position);
        return position;
    }

    updateHoseAndNozzle() {
        const knotPosition = this.getBalloonKnotWorldPosition();
        if (!knotPosition) return;

        if (this.nozzle) {
            this.nozzle.position.copy(knotPosition);
        }

        if (!this.lastKnotPosition) {
            this.lastKnotPosition = knotPosition.clone();
        }

        if (this.lastKnotPosition.distanceTo(knotPosition) > 0.0025) {
            this.updateHoseCurve(knotPosition);
            this.lastKnotPosition.copy(knotPosition);
        }
    }

    updateParticleBounds() {
        // Scale bounds with balloon size
        const volumeRatio = this.state.volume / 22.4;
        const radiusRatio = Math.cbrt(volumeRatio);
        const radius = 0.82 * radiusRatio * 0.55; // Keep particles just behind balloon walls

        this.particleSystem.setBounds(radius, radius * 1.1, radius);

        // Update sphere params for proper containment
        if (this.particleSystem.sphereParams) {
            this.particleSystem.sphereParams.radius = radius;
            this.particleSystem.sphereParams.centerY = -0.18;
        }
    }

    setMoles(moles) {
        this.state.moles = moles;
        // Avogadro's Law: V = Vm * n
        this.state.volume = this.state.Vm * moles;

        this.updateBalloonSize();
        this.updateParticleBounds();

        // Adjust particle count proportionally (more moles = more molecules)
        const newCount = this.calculateParticleCountFromMoles(moles);
        this.setParticleCount(newCount);

        // Ensure any reposition after count changes respects updated bounds
        if (this.particleSystem) {
            this.particleSystem.repositionParticles();
            this.particleSystem.enforceContainment();
        }

        return this.state;
    }

    calculateParticleCountFromMoles(moles) {
        const targetCount = Math.round(this.baseParticleDensity * moles);
        return Math.min(150, Math.max(10, targetCount));
    }

    getState() {
        return { ...this.state };
    }

    update(deltaTime) {
        this.flowTime += deltaTime * 0.05;

        // Gentle floating animation for balloons
        this.balloons.forEach((balloon, i) => {
            const offset = Math.sin(this.flowTime + i * 1.5) * 0.05;
            balloon.group.position.y = balloon.baseY + offset + (this.state.moles - 1) * 0.3;
            balloon.group.rotation.z = Math.sin(this.flowTime * 0.5 + i) * 0.05;
        });

        // Update main balloon position
        if (this.mainBalloon) {
            this.balloons[0].baseY = 3 + (this.state.moles - 1) * 0.5;
        }

        // Keep hose and nozzle attached to the moving balloon knot
        this.updateHoseAndNozzle();

        // Animate gas flow particles along hose
        this.updateGasFlowParticles();

        if (this.particleSystem && this.mainBalloon) {
            // Keep particle system aligned with the moving balloon so molecules stay inside
            this.particleSystem.setCenterOffset(
                this.mainBalloon.position.x,
                this.mainBalloon.position.y,
                this.mainBalloon.position.z
            );

            // Update particle physics with animation speed
            this.particleSystem.update(deltaTime);

            // Ensure particles stay within balloon bounds
            this.particleSystem.enforceContainment();
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
            moles: 1.0,
            volume: 22.4,
            temperature: 273,
            pressure: 1.0,
            Vm: 22.4
        };
        this.setMoles(1.0);
    }
}
