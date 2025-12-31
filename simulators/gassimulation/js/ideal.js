/**
 * Ideal Gas Law Visualization
 * PV = nRT
 *
 * Scene: Scuba Diving - Air Tank Calculation
 * - Scuba tank with pressure gauge
 * - Underwater environment
 * - Calculate moles of air available for diving
 * - Real-world application of ideal gas law
 */

import { ParticleSystem } from './particles.js';

export class IdealScene {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        // Gas constant
        this.R = 0.0821; // L·atm/(mol·K)
        this.basePressure = 200;
        this.baseTankDimensions = { radius: 0.38, height: 2.3, yMin: 0.1 };

        // Gas state
        this.state = {
            pressure: 200,      // atm (typical full tank)
            volume: 12,         // L (standard tank size)
            temperature: 288,   // K (15°C - typical water temp)
            moles: 100.2        // Calculated: n = PV/RT
        };

        this.calculateMoles();
        this.baseMoles = this.state.moles;

        // Scene objects
        this.tank = null;
        this.gasGroup = null;
        this.gasChamberGroup = null;
        this.gasChamber = null;
        this.gasChamberEdges = null;
        this.pressureGauge = null;
        this.pressureNeedle = null;
        this.regulator = null;
        this.bubbles = [];

        // Particle system
        this.particleSystem = null;

        // Info panel
        this.infoCanvas = null;
        this.infoContext = null;
        this.infoTexture = null;

        // Animation
        this.waterTime = 0;
        this.bubbleTime = 0;
        this.bubbleRate = 0.006;
        this.bubbleRiseMultiplier = 1;

        this.init();
    }

    init() {
        this.createUnderwaterEnvironment();
        this.createScubaTank();
        this.createGasChamber();
        this.createPressureGauge();
        this.createRegulator();
        this.createBubbles();
        this.createParticles();
        this.createInfoPanel();
        this.setupLighting();
        this.updateBubbleDynamics();
        this.updateInfoPanel();

        // Set camera position
        this.camera.position.set(5, 2, 8);
        this.camera.lookAt(0, 1, 0);
    }

    createUnderwaterEnvironment() {
        // Ocean floor
        const floorGeometry = new THREE.PlaneGeometry(20, 20);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0xc2b280, // Sandy color
            roughness: 0.9
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -2;
        this.group.add(floor);

        // Coral and rocks
        this.createCoralFormations();

        // Water caustics simulation (light patterns)
        const causticGeometry = new THREE.PlaneGeometry(20, 20);
        const causticMaterial = new THREE.MeshBasicMaterial({
            color: 0x4488cc,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide
        });
        const caustics = new THREE.Mesh(causticGeometry, causticMaterial);
        caustics.rotation.x = -Math.PI / 2;
        caustics.position.y = -1.9;
        this.group.add(caustics);

        // Water fog effect
        this.scene.fog = new THREE.FogExp2(0x1a5276, 0.05);
    }

    createCoralFormations() {
        const coralColors = [0xff6b6b, 0xffa07a, 0x98d8c8, 0xf7dc6f, 0xbb8fce];

        // Create coral pieces
        for (let i = 0; i < 15; i++) {
            const coralGroup = new THREE.Group();
            const x = (Math.random() - 0.5) * 12;
            const z = (Math.random() - 0.5) * 12 - 3;

            if (Math.abs(x) < 2 && Math.abs(z) < 2) continue;

            coralGroup.position.set(x, -2, z);
            this.group.add(coralGroup);

            // Different coral types
            const type = Math.floor(Math.random() * 3);
            const color = coralColors[Math.floor(Math.random() * coralColors.length)];

            if (type === 0) {
                // Branch coral
                for (let j = 0; j < 5; j++) {
                    const branchGeometry = new THREE.CylinderGeometry(0.02, 0.05, 0.4 + Math.random() * 0.3, 6);
                    const branchMaterial = new THREE.MeshStandardMaterial({ color: color });
                    const branch = new THREE.Mesh(branchGeometry, branchMaterial);
                    branch.position.set(
                        (Math.random() - 0.5) * 0.2,
                        0.2,
                        (Math.random() - 0.5) * 0.2
                    );
                    branch.rotation.set(
                        (Math.random() - 0.5) * 0.5,
                        Math.random() * Math.PI,
                        (Math.random() - 0.5) * 0.5
                    );
                    coralGroup.add(branch);
                }
            } else if (type === 1) {
                // Brain coral
                const brainGeometry = new THREE.SphereGeometry(0.2 + Math.random() * 0.2, 12, 12);
                const brainMaterial = new THREE.MeshStandardMaterial({ color: color });
                const brain = new THREE.Mesh(brainGeometry, brainMaterial);
                brain.scale.y = 0.6;
                brain.position.y = 0.1;
                coralGroup.add(brain);
            } else {
                // Rock
                const rockGeometry = new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.3, 0);
                const rockMaterial = new THREE.MeshStandardMaterial({
                    color: 0x666666,
                    roughness: 0.9
                });
                const rock = new THREE.Mesh(rockGeometry, rockMaterial);
                rock.position.y = 0.15;
                rock.rotation.set(Math.random(), Math.random(), Math.random());
                coralGroup.add(rock);
            }
        }

        // Seaweed
        for (let i = 0; i < 20; i++) {
            const x = (Math.random() - 0.5) * 14;
            const z = (Math.random() - 0.5) * 14;

            if (Math.abs(x) < 2.5 && Math.abs(z) < 2) continue;

            const seaweedGroup = new THREE.Group();
            seaweedGroup.position.set(x, -2, z);
            this.group.add(seaweedGroup);

            const height = 0.5 + Math.random() * 1;
            const seaweedGeometry = new THREE.PlaneGeometry(0.1, height);
            const seaweedMaterial = new THREE.MeshStandardMaterial({
                color: 0x228b22,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8
            });

            for (let j = 0; j < 3; j++) {
                const blade = new THREE.Mesh(seaweedGeometry, seaweedMaterial);
                blade.position.set((Math.random() - 0.5) * 0.1, height / 2, 0);
                blade.rotation.y = Math.random() * Math.PI;
                seaweedGroup.add(blade);
            }

            this.seaweedGroups = this.seaweedGroups || [];
            this.seaweedGroups.push(seaweedGroup);
        }
    }

    createScubaTank() {
        const tankGroup = new THREE.Group();
        tankGroup.position.set(0, 0, 0);
        tankGroup.rotation.x = -0.2; // Slight tilt
        this.group.add(tankGroup);

        // Main tank body (aluminum cylinder)
        const bodyGeometry = new THREE.CylinderGeometry(0.45, 0.45, 2.5, 32);
        const tankBodyMaterial = new THREE.MeshStandardMaterial({
            color: 0xffcc00, // Yellow aluminum tank
            metalness: 0.7,
            roughness: 0.3,
            transparent: true,
            opacity: 0.65,
            depthWrite: false
        });
        const tankCapMaterial = new THREE.MeshStandardMaterial({
            color: 0xffcc00,
            metalness: 0.7,
            roughness: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, tankBodyMaterial);
        body.position.y = 1.25;
        tankGroup.add(body);

        // Tank top dome
        const topGeometry = new THREE.SphereGeometry(0.45, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const top = new THREE.Mesh(topGeometry, tankCapMaterial);
        top.position.y = 2.5;
        tankGroup.add(top);

        // Tank bottom dome
        const bottomGeometry = new THREE.SphereGeometry(0.45, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
        const bottom = new THREE.Mesh(bottomGeometry, tankCapMaterial);
        bottom.position.y = 0;
        tankGroup.add(bottom);

        // Tank boot (rubber base)
        const bootGeometry = new THREE.CylinderGeometry(0.5, 0.52, 0.3, 32);
        const bootMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.9
        });
        const boot = new THREE.Mesh(bootGeometry, bootMaterial);
        boot.position.y = -0.15;
        tankGroup.add(boot);

        // Valve assembly (DIN/Yoke)
        const valveGeometry = new THREE.CylinderGeometry(0.12, 0.15, 0.25, 12);
        const valveMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.9,
            roughness: 0.2
        });
        const valve = new THREE.Mesh(valveGeometry, valveMaterial);
        valve.position.y = 2.75;
        tankGroup.add(valve);

        // Valve handwheel
        const wheelGeometry = new THREE.TorusGeometry(0.1, 0.02, 8, 16);
        const wheel = new THREE.Mesh(wheelGeometry, valveMaterial);
        wheel.position.y = 2.9;
        tankGroup.add(wheel);

        // Burst disk
        const diskGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8);
        const diskMaterial = new THREE.MeshStandardMaterial({ color: 0xcd7f32 });
        const disk = new THREE.Mesh(diskGeometry, diskMaterial);
        disk.position.set(0.15, 2.75, 0);
        disk.rotation.z = Math.PI / 2;
        tankGroup.add(disk);

        // Tank markings/label area
        const labelGeometry = new THREE.PlaneGeometry(0.6, 0.3);
        const labelMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide
        });
        const label = new THREE.Mesh(labelGeometry, labelMaterial);
        label.position.set(0, 1.8, 0.46);
        tankGroup.add(label);

        // Tank strap/band
        const strapGeometry = new THREE.TorusGeometry(0.48, 0.02, 4, 32);
        const strapMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const strap1 = new THREE.Mesh(strapGeometry, strapMaterial);
        strap1.rotation.x = Math.PI / 2;
        strap1.position.y = 0.8;
        tankGroup.add(strap1);
        const strap2 = new THREE.Mesh(strapGeometry, strapMaterial);
        strap2.rotation.x = Math.PI / 2;
        strap2.position.y = 1.8;
        tankGroup.add(strap2);

        this.gasGroup = new THREE.Group();
        tankGroup.add(this.gasGroup);

        this.tank = tankGroup;
    }

    createGasChamber() {
        if (!this.tank) return;

        const base = this.baseTankDimensions;
        const chamberGroup = new THREE.Group();
        chamberGroup.position.set(0, base.yMin, 0);
        this.tank.add(chamberGroup);

        const chamberGeometry = new THREE.CylinderGeometry(base.radius, base.radius, base.height, 24, 1, true);
        const chamberMaterial = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.12,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const chamber = new THREE.Mesh(chamberGeometry, chamberMaterial);
        chamber.position.y = base.height / 2;
        chamberGroup.add(chamber);

        const edgeGeometry = new THREE.EdgesGeometry(chamberGeometry);
        const edgeMaterial = new THREE.LineBasicMaterial({
            color: 0x7dd3fc,
            transparent: true,
            opacity: 0.6
        });
        const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        edges.position.y = base.height / 2;
        chamberGroup.add(edges);

        this.gasChamberGroup = chamberGroup;
        this.gasChamber = chamber;
        this.gasChamberEdges = edges;
    }

    createPressureGauge() {
        const gaugeGroup = new THREE.Group();
        gaugeGroup.position.set(0.8, 2.2, 0.3);
        gaugeGroup.rotation.y = Math.PI / 4;
        const gaugeParent = this.tank || this.group;
        gaugeParent.add(gaugeGroup);

        // Gauge housing
        const housingGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.1, 32);
        const housingMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            metalness: 0.8
        });
        const housing = new THREE.Mesh(housingGeometry, housingMaterial);
        housing.rotation.x = Math.PI / 2;
        gaugeGroup.add(housing);

        // Gauge face (white background)
        const faceGeometry = new THREE.CircleGeometry(0.22, 32);
        const faceMaterial = new THREE.MeshBasicMaterial({ color: 0xfafafa });
        const face = new THREE.Mesh(faceGeometry, faceMaterial);
        face.position.z = 0.051;
        gaugeGroup.add(face);

        // Pressure zones
        const greenZone = new THREE.RingGeometry(0.12, 0.19, 32, 1, Math.PI * 0.1, Math.PI * 0.9);
        const greenMaterial = new THREE.MeshBasicMaterial({ color: 0x22aa22, side: THREE.DoubleSide });
        const green = new THREE.Mesh(greenZone, greenMaterial);
        green.position.z = 0.052;
        gaugeGroup.add(green);

        const yellowZone = new THREE.RingGeometry(0.12, 0.19, 16, 1, -Math.PI * 0.3, Math.PI * 0.4);
        const yellowMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaa22, side: THREE.DoubleSide });
        const yellow = new THREE.Mesh(yellowZone, yellowMaterial);
        yellow.position.z = 0.052;
        gaugeGroup.add(yellow);

        const redZone = new THREE.RingGeometry(0.12, 0.19, 16, 1, -Math.PI * 0.7, Math.PI * 0.4);
        const redMaterial = new THREE.MeshBasicMaterial({ color: 0xcc2222, side: THREE.DoubleSide });
        const red = new THREE.Mesh(redZone, redMaterial);
        red.position.z = 0.052;
        gaugeGroup.add(red);

        // Scale markings
        for (let i = 0; i <= 8; i++) {
            const angle = -Math.PI * 0.7 + (i / 8) * Math.PI * 1.4;
            const markLength = i % 2 === 0 ? 0.05 : 0.03;
            const markGeometry = new THREE.BoxGeometry(markLength, 0.01, 0.005);
            const markMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
            const mark = new THREE.Mesh(markGeometry, markMaterial);
            const radius = 0.18;
            mark.position.set(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                0.053
            );
            mark.rotation.z = angle;
            gaugeGroup.add(mark);
        }

        // Needle
        const needleGeometry = new THREE.BoxGeometry(0.15, 0.015, 0.008);
        const needleMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.pressureNeedle = new THREE.Mesh(needleGeometry, needleMaterial);
        this.pressureNeedle.geometry.translate(0.06, 0, 0);
        this.pressureNeedle.position.z = 0.055;
        gaugeGroup.add(this.pressureNeedle);

        // Pivot
        const pivotGeometry = new THREE.CircleGeometry(0.025, 16);
        const pivotMaterial = new THREE.MeshBasicMaterial({ color: 0xcc0000 });
        const pivot = new THREE.Mesh(pivotGeometry, pivotMaterial);
        pivot.position.z = 0.056;
        gaugeGroup.add(pivot);

        // Hose connection to tank
        const hoseGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
        const hoseMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.8
        });
        const hose = new THREE.Mesh(hoseGeometry, hoseMaterial);
        hose.position.set(-0.3, 0, -0.2);
        hose.rotation.set(0, 0, Math.PI / 3);
        gaugeGroup.add(hose);

        this.pressureGauge = gaugeGroup;
        this.updatePressureGauge();
    }

    createRegulator() {
        const regGroup = new THREE.Group();
        regGroup.position.set(0, 2.9, 0.2);
        const regParent = this.tank || this.group;
        regParent.add(regGroup);

        // First stage (attached to tank)
        const firstStageGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.2, 12);
        const regMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.7
        });
        const firstStage = new THREE.Mesh(firstStageGeometry, regMaterial);
        firstStage.rotation.z = Math.PI / 2;
        regGroup.add(firstStage);

        // Hose ports
        for (let i = 0; i < 3; i++) {
            const portGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8);
            const port = new THREE.Mesh(portGeometry, regMaterial);
            const angle = (i - 1) * 0.8;
            port.position.set(0, Math.sin(angle) * 0.15, Math.cos(angle) * 0.15);
            port.rotation.x = angle;
            regGroup.add(port);
        }

        this.regulator = regGroup;
    }

    createBubbles() {
        this.bubbles = [];

        for (let i = 0; i < 20; i++) {
            const size = 0.03 + Math.random() * 0.05;
            const bubbleGeometry = new THREE.SphereGeometry(size, 8, 8);
            const bubbleMaterial = new THREE.MeshPhysicalMaterial({
                color: 0xaaddff,
                transparent: true,
                opacity: 0.4,
                metalness: 0.1,
                roughness: 0.1
            });
            const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);

            bubble.position.set(
                (Math.random() - 0.5) * 8,
                -2 + Math.random() * 6,
                (Math.random() - 0.5) * 8
            );
            bubble.visible = false;

            this.group.add(bubble);
            this.bubbles.push({
                mesh: bubble,
                speed: 0.02 + Math.random() * 0.03,
                wobble: Math.random() * Math.PI * 2
            });
        }
    }

    createParticles() {
        this.particleSystem = new ParticleSystem(this.gasGroup || this.scene, {
            count: 50,
            baseSpeed: 0.01,
            particleSize: 0.04,
            showCollisions: true
        });

        const base = this.baseTankDimensions;
        const baseHeight = base.height;

        // Tank center is at half the height above the boot
        this.particleSystem.setCenterOffset(0, base.yMin + baseHeight / 2, 0);

        // Cylindrical bounds for scuba tank (radius ~0.4, height from bottom to top dome)
        this.cylinderParams = {
            radius: base.radius,
            yMin: base.yMin,                 // Tank bottom with boot
            yMax: base.yMin + baseHeight     // Tank top before valve
        };

        this.particleSystem.setBounds(base.radius, baseHeight / 2, base.radius);
        this.particleSystem.setCylinderParams(this.cylinderParams);
        this.particleSystem.createParticles();
        this.particleSystem.setTemperature(this.state.temperature);
        this.particleSystem.enforceContainment();
    }

    createInfoPanel() {
        // 3D info panel showing calculation
        const panelGroup = new THREE.Group();
        panelGroup.position.set(-2, 2, 1);
        panelGroup.rotation.set(0, 0, 0);
        this.group.add(panelGroup);

        // Panel background
        const bgGeometry = new THREE.PlaneGeometry(2.3, 1.4);
        this.infoCanvas = document.createElement('canvas');
        this.infoCanvas.width = 640;
        this.infoCanvas.height = 420;
        this.infoContext = this.infoCanvas.getContext('2d');
        this.infoTexture = new THREE.CanvasTexture(this.infoCanvas);
        this.infoTexture.minFilter = THREE.LinearFilter;
        this.infoTexture.magFilter = THREE.LinearFilter;

        const bgMaterial = new THREE.MeshBasicMaterial({
            map: this.infoTexture,
            transparent: true,
            side: THREE.DoubleSide
        });
        const bg = new THREE.Mesh(bgGeometry, bgMaterial);
        panelGroup.add(bg);

        // Border
        const borderGeometry = new THREE.EdgesGeometry(bgGeometry);
        const borderMaterial = new THREE.LineBasicMaterial({ color: 0x4f46e5 });
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        border.position.z = 0.001;
        panelGroup.add(border);

        this.infoPanel = panelGroup;
    }

    updateInfoPanel() {
        if (!this.infoContext || !this.infoTexture) return;

        const ctx = this.infoContext;
        const width = this.infoCanvas.width;
        const height = this.infoCanvas.height;
        const margin = 20;
        const innerWidth = width - margin * 2;

        ctx.clearRect(0, 0, width, height);

        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#0b132b');
        gradient.addColorStop(1, '#111827');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, width - 20, height - 20);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 26px Arial';
        ctx.fillText('Ideal Gas Law', margin, 38);
        ctx.font = '20px Arial';
        ctx.fillText('PV = nRT', margin, 66);

        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin, 78);
        ctx.lineTo(width - margin, 78);
        ctx.stroke();

        const pressure = this.state.pressure;
        const volume = this.state.volume;
        const temperature = this.state.temperature;
        const moles = this.state.moles;

        const colLeft = margin;
        const colRight = margin + innerWidth / 2 + 10;
        const labelY = 105;
        const valueY = 130;
        const rowGap = 60;

        ctx.font = '13px Arial';
        ctx.fillStyle = '#93c5fd';
        ctx.fillText('Pressure (P)', colLeft, labelY);
        ctx.fillText('Volume (V)', colRight, labelY);
        ctx.fillText('Temperature (T)', colLeft, labelY + rowGap);
        ctx.fillText('Amount (n)', colRight, labelY + rowGap);

        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(`${pressure.toFixed(0)} atm`, colLeft, valueY);
        ctx.fillText(`${volume.toFixed(1)} L`, colRight, valueY);
        ctx.fillText(`${temperature.toFixed(0)} K`, colLeft, valueY + rowGap);
        ctx.fillText(`${moles.toFixed(1)} mol`, colRight, valueY + rowGap);

        const pv = pressure * volume;
        const nrt = moles * this.R * temperature;
        const density = moles / volume;
        const calcY = valueY + rowGap + 34;
        ctx.font = '15px Arial';
        ctx.fillStyle = '#cbd5f5';
        ctx.fillText(`PV = ${pv.toFixed(0)} L*atm`, margin, calcY);
        ctx.fillText(`nRT = ${nrt.toFixed(0)} L*atm`, margin + innerWidth / 2 + 10, calcY);

        ctx.fillStyle = '#a5b4fc';
        ctx.fillText(`R = 0.0821 L*atm/(mol*K)`, margin, calcY + 26);
        ctx.fillText(`n/V = ${density.toFixed(2)} mol/L`, margin + innerWidth / 2 + 10, calcY + 26);

        const fillRatio = this.baseMoles ? moles / this.baseMoles : 1;
        const fillPercent = Math.round(fillRatio * 100);
        const barX = margin;
        const barY = calcY + 50;
        const barW = innerWidth;
        const barH = 14;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(barX, barY, barW, barH);

        const clampedFill = Math.max(0, Math.min(1, fillRatio));
        let barColor = '#22c55e';
        if (fillRatio > 1.1) {
            barColor = '#f97316';
        } else if (fillRatio < 0.5) {
            barColor = '#60a5fa';
        }
        ctx.fillStyle = barColor;
        ctx.fillRect(barX, barY, barW * clampedFill, barH);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '14px Arial';
        ctx.fillText(`Tank fill: ${fillPercent}%`, margin, barY - 6);

        let statusLabel = 'Normal pressure';
        let statusColor = '#22c55e';
        if (pressure >= 290) {
            statusLabel = 'Over pressure';
            statusColor = '#ef4444';
        } else if (pressure >= 260) {
            statusLabel = 'High pressure';
            statusColor = '#f97316';
        } else if (pressure <= 80) {
            statusLabel = 'Low pressure';
            statusColor = '#60a5fa';
        }

        ctx.fillStyle = statusColor;
        ctx.font = '15px Arial';
        ctx.fillText(`Status: ${statusLabel}`, margin, barY + 34);

        ctx.fillStyle = '#a5b4fc';
        ctx.font = '13px Arial';
        ctx.fillText('n is computed from the sliders. Change P, V, or T to update it.', margin, barY + 58);

        this.infoTexture.needsUpdate = true;
    }

    updateInfoPanelOrientation() {
        if (!this.infoPanel || !this.camera) return;

        const panelPosition = new THREE.Vector3();
        const cameraPosition = new THREE.Vector3();
        this.infoPanel.getWorldPosition(panelPosition);
        this.camera.getWorldPosition(cameraPosition);

        const angle = Math.atan2(
            cameraPosition.x - panelPosition.x,
            cameraPosition.z - panelPosition.z
        );
        this.infoPanel.rotation.set(0, angle, 0);
    }

    setupLighting() {
        // Underwater ambient light (bluish)
        const ambient = new THREE.AmbientLight(0x4488aa, 0.4);
        this.group.add(ambient);

        // Directional light from above (sun through water)
        const sunLight = new THREE.DirectionalLight(0x88ccff, 0.8);
        sunLight.position.set(2, 10, 2);
        sunLight.castShadow = true;
        this.group.add(sunLight);

        // Underwater caustic effect light
        const causticLight = new THREE.PointLight(0x66aacc, 0.3, 15);
        causticLight.position.set(0, 5, 0);
        this.group.add(causticLight);
    }

    updatePressureGauge() {
        // Map pressure (0-300 atm) to needle angle
        const minAngle = -Math.PI * 0.7;
        const maxAngle = Math.PI * 0.7;
        const normalizedPressure = Math.min(1, Math.max(0, this.state.pressure / 300));
        const angle = minAngle + normalizedPressure * (maxAngle - minAngle);

        if (this.pressureNeedle) {
            this.pressureNeedle.rotation.z = angle;
        }
    }

    updateTankBounds() {
        if (!this.particleSystem) return;

        const base = this.baseTankDimensions;
        const volumeScale = Math.cbrt(this.state.volume / 12);

        if (this.tank) {
            this.tank.scale.set(volumeScale, volumeScale, volumeScale);
        }

        const radius = base.radius;
        const height = base.height;
        const yMin = base.yMin;
        const yMax = yMin + height;

        this.cylinderParams = { radius, yMin, yMax };
        this.particleSystem.setBounds(radius, height / 2, radius);
        this.particleSystem.setCenterOffset(0, yMin + height / 2, 0);
        this.particleSystem.setCylinderParams(this.cylinderParams);
        this.particleSystem.enforceContainment();
        this.updateGasChamber(volumeScale);
    }

    updateGasChamber(volumeScale) {
        if (!this.gasChamberGroup) return;
        this.gasChamberGroup.scale.set(1, 1, 1);
    }

    updateBubbleDynamics() {
        const pressureFactor = Math.max(0.2, Math.min(1.5, this.state.pressure / this.basePressure));
        const tempFactor = Math.max(0.7, Math.min(1.3, this.state.temperature / 288));

        // Higher pressure increases spawn rate, higher temp slightly speeds rise
        this.bubbleRate = 0.003 + 0.007 * pressureFactor;
        this.bubbleRiseMultiplier = 0.8 + 0.5 * pressureFactor + 0.3 * (tempFactor - 1);
    }

    calculateMoles() {
        // PV = nRT  →  n = PV/RT
        this.state.moles = (this.state.pressure * this.state.volume) /
                          (this.R * this.state.temperature);
    }

    setPressure(pressure) {
        this.state.pressure = pressure;
        this.calculateMoles();
        this.updatePressureGauge();
        this.updateBubbleDynamics();

        // Adjust particle behavior based on pressure
        if (this.particleSystem) {
            const baseSpeed = this.particleSystem.options.baseSpeed *
                              Math.sqrt(this.state.temperature / 273);
            const pressureFactor = this.state.pressure / this.basePressure;

            this.particleSystem.particles.forEach(p => {
                const dir = p.velocity.lengthSq() > 0 ? p.velocity.clone().normalize() :
                    new THREE.Vector3(
                        (Math.random() - 0.5),
                        (Math.random() - 0.5),
                        (Math.random() - 0.5)
                    ).normalize();
                const scaledSpeed = baseSpeed * pressureFactor;
                p.velocity.copy(dir.multiplyScalar(scaledSpeed));
            });
        }

        this.updateInfoPanel();
        return this.state;
    }

    setVolume(volume) {
        this.state.volume = volume;
        this.calculateMoles();
        this.updateTankBounds();

        this.updateInfoPanel();
        return this.state;
    }

    setTemperature(temp) {
        this.state.temperature = temp;
        this.calculateMoles();
        if (this.particleSystem) {
            this.particleSystem.setTemperature(temp);
        }
        this.updateBubbleDynamics();

        this.updateInfoPanel();
        return this.state;
    }

    getState() {
        return { ...this.state };
    }

    update(deltaTime) {
        this.waterTime += deltaTime * 0.02;
        this.bubbleTime += deltaTime;

        // Animate seaweed
        if (this.seaweedGroups) {
            this.seaweedGroups.forEach((group, i) => {
                group.rotation.z = Math.sin(this.waterTime + i * 0.5) * 0.1;
            });
        }

        // Animate bubbles
        const spawnChance = this.bubbleRate * deltaTime;
        const riseFactor = this.bubbleRiseMultiplier;

        this.bubbles.forEach((bubble, i) => {
            if (Math.random() < spawnChance) {
                bubble.mesh.visible = true;
                bubble.mesh.position.set(
                    (Math.random() - 0.5) * 6,
                    -2,
                    (Math.random() - 0.5) * 6
                );
            }

            if (bubble.mesh.visible) {
                bubble.mesh.position.y += bubble.speed * riseFactor;
                bubble.mesh.position.x += Math.sin(this.waterTime * 3 + bubble.wobble) * 0.005 * riseFactor;
                bubble.mesh.position.z += Math.cos(this.waterTime * 2 + bubble.wobble) * 0.005 * riseFactor;

                // Reset when reaching surface
                if (bubble.mesh.position.y > 5) {
                    bubble.mesh.visible = false;
                }
            }
        });

        // Update particles with cylindrical bounds for the scuba tank
        if (this.particleSystem) {
            this.particleSystem.update(deltaTime, false, this.cylinderParams);
            this.particleSystem.enforceContainment();
        }

        this.updateInfoPanelOrientation();
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
        this.scene.fog = null;
        this.scene.remove(this.group);
    }

    reset() {
        this.state = {
            pressure: 200,
            volume: 12,
            temperature: 288,
            moles: 100.2
        };
        this.calculateMoles();
        this.setPressure(200);
        this.setVolume(12);
        this.setTemperature(288);
    }
}
