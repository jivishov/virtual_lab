/**
 * Shared Particle Physics System
 * Handles particle creation, movement, and collisions
 */

export class ParticleSystem {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.particles = [];
        this.options = {
            count: options.count || 50,
            baseSpeed: options.baseSpeed || 0.001, // Very slow base speed for clear motion
            particleSize: options.particleSize || 0.08,
            showTrails: options.showTrails || false, // Trails off by default
            showCollisions: options.showCollisions || true,
            ...options
        };
        this.temperature = 273; // Kelvin
        this.animationSpeed = 0.05; // Start with slowest speed
        this.bounds = { x: 2, y: 2, z: 2 }; // Half-extents
        this.centerOffset = { x: 0, y: 0, z: 0 }; // Container center position
        this.cylinderParams = options.cylinderParams || null;
    }

    createParticles(count = this.options.count) {
        this.clearParticles();

        for (let i = 0; i < count; i++) {
            this.addParticle();
        }

        return this.particles;
    }

    addParticle(position = null) {
        const radius = this.options.particleSize + Math.random() * 0.02;
        const geometry = new THREE.SphereGeometry(radius, 12, 12);

        // Use same scaling as setTemperature for consistency
        const speedFactor = Math.pow(this.temperature / 300, 1.5);
        const color = this.getParticleColor(this.temperature);

        const material = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.4,
            shininess: 100,
            transparent: true,
            opacity: 0.9
        });

        const mesh = new THREE.Mesh(geometry, material);

        // Position relative to center offset
        if (position) {
            mesh.position.copy(position);
        } else if (this.sphereParams) {
            // Position within spherical bounds
            const r = this.sphereParams.radius * 0.8 * Math.cbrt(Math.random());
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            mesh.position.set(
                this.centerOffset.x + r * Math.sin(phi) * Math.cos(theta),
                this.centerOffset.y + (this.sphereParams.centerY || 0) + r * Math.cos(phi),
                this.centerOffset.z + r * Math.sin(phi) * Math.sin(theta)
            );
        } else if (this.cylinderParams) {
            const { radius: cylinderRadius, yMin, yMax } = this.cylinderParams;
            const pos = this.getRandomCylinderPosition(cylinderRadius, yMin, yMax, radius);
            mesh.position.copy(pos);
        } else {
            mesh.position.set(
                this.centerOffset.x + (Math.random() - 0.5) * this.bounds.x * 1.6,
                this.centerOffset.y + (Math.random() - 0.5) * this.bounds.y * 1.6,
                this.centerOffset.z + (Math.random() - 0.5) * this.bounds.z * 1.6
            );
        }

        // Velocity based on temperature (Maxwell-Boltzmann distribution approximation)
        const baseSpeed = this.options.baseSpeed * speedFactor;
        // Random direction with Gaussian-like speed distribution
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = baseSpeed * (0.5 + Math.random());

        const velocity = new THREE.Vector3(
            speed * Math.sin(phi) * Math.cos(theta),
            speed * Math.sin(phi) * Math.sin(theta),
            speed * Math.cos(phi)
        );

        this.scene.add(mesh);

        const particle = {
            mesh,
            velocity,
            trail: null,
            trailPositions: [],
            radius,
            colliding: false,
            collisionTime: 0,
            baseColor: color.clone()
        };

        if (this.options.showTrails) {
            this.attachTrail(particle);
        }

        this.particles.push(particle);
        return particle;
    }

    removeParticle() {
        if (this.particles.length === 0) return;

        const particle = this.particles.pop();
        this.scene.remove(particle.mesh);
        if (particle.trail) {
            this.detachTrail(particle);
        }
        particle.mesh.geometry.dispose();
        particle.mesh.material.dispose();
    }

    clearParticles() {
        while (this.particles.length > 0) {
            this.removeParticle();
        }
    }

    getParticleColor(temp) {
        // Smooth color gradient based on temperature
        // Blue (cold) -> Cyan -> Green (normal) -> Orange -> Red (hot)
        if (temp < 280) {
            // Cold: blue
            return new THREE.Color(0x3b82f6);
        } else if (temp < 320) {
            // Cool: cyan
            return new THREE.Color(0x06b6d4);
        } else if (temp < 380) {
            // Normal: green
            return new THREE.Color(0x10b981);
        } else if (temp < 450) {
            // Warm: yellow-orange
            return new THREE.Color(0xf59e0b);
        } else {
            // Hot: red
            return new THREE.Color(0xef4444);
        }
    }

    setTemperature(temp) {
        this.temperature = temp;
        // Slower base with wider dynamic range
        // At 250K: factor ~0.8, at 350K: factor ~1.5, at 500K: factor ~2.8
        const speedFactor = Math.pow(temp / 300, 1.5);
        const baseSpeed = this.options.baseSpeed * speedFactor;
        const color = this.getParticleColor(temp);

        this.particles.forEach(particle => {
            // Preserve direction, scale speed
            const currentSpeed = particle.velocity.length();
            if (currentSpeed > 0.0001) {
                // Scale to new temperature-based speed with some randomness
                const newSpeed = baseSpeed * (0.9 + Math.random() * 0.2);
                particle.velocity.normalize().multiplyScalar(newSpeed);
            } else {
                // Particle was stationary, give it new random velocity
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const speed = baseSpeed * (0.8 + Math.random() * 0.4);
                particle.velocity.set(
                    speed * Math.sin(phi) * Math.cos(theta),
                    speed * Math.sin(phi) * Math.sin(theta),
                    speed * Math.cos(phi)
                );
            }

            // Update color based on temperature
            particle.mesh.material.color.copy(color);
            particle.mesh.material.emissive.copy(color);
            particle.baseColor = color.clone();
            if (particle.trail) {
                particle.trail.material.color.copy(color);
            }
        });
    }

    setCenterOffset(x, y, z) {
        this.centerOffset = { x, y, z };
    }

    setBounds(x, y, z) {
        this.bounds = { x, y, z };
    }

    setCylinderParams(params) {
        this.cylinderParams = params ? { ...params } : null;
    }

    setParticleCount(count) {
        const targetCount = Math.max(1, Math.round(count));
        this.options.count = targetCount;

        // Add particles if needed
        while (this.particles.length < targetCount) {
            this.addParticle();
        }

        // Remove particles if needed
        while (this.particles.length > targetCount) {
            this.removeParticle();
        }

        return this.particles.length;
    }

    setParticleSize(size) {
        this.options.particleSize = size;
        // Update existing particles' scale
        this.particles.forEach(particle => {
            const scale = size / 0.08; // 0.08 is the default size
            particle.mesh.scale.set(scale, scale, scale);
            particle.radius = size + Math.random() * 0.02;
        });
    }

    getRandomCylinderPosition(radius, yMin, yMax, particleRadius) {
        const maxDist = Math.max(0.001, radius - particleRadius);
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * maxDist;
        const ySpan = Math.max(0.001, yMax - yMin - particleRadius * 2);
        const y = yMin + particleRadius + Math.random() * ySpan;

        return new THREE.Vector3(
            this.centerOffset.x + dist * Math.cos(angle),
            y,
            this.centerOffset.z + dist * Math.sin(angle)
        );
    }

    // Constrain particles to cylindrical bounds (for piston, cooker, etc.)
    constrainToCylinder(particle, cylinderRadius, yMin, yMax) {
        const mesh = particle.mesh;
        const velocity = particle.velocity;
        const radius = particle.radius;
        let collided = false;

        // Radial constraint (circular cross-section)
        const dx = mesh.position.x - this.centerOffset.x;
        const dz = mesh.position.z - this.centerOffset.z;
        const distFromAxis = Math.sqrt(dx * dx + dz * dz);
        const maxDist = cylinderRadius - radius;

        if (distFromAxis > maxDist) {
            // Push back to cylinder wall
            const scale = maxDist / distFromAxis;
            mesh.position.x = this.centerOffset.x + dx * scale;
            mesh.position.z = this.centerOffset.z + dz * scale;

            // Reflect velocity (tangent to cylinder wall)
            const nx = dx / distFromAxis;
            const nz = dz / distFromAxis;
            const dot = velocity.x * nx + velocity.z * nz;
            velocity.x -= 2 * dot * nx;
            velocity.z -= 2 * dot * nz;
            collided = true;
        }

        // Y bounds (floor and ceiling/piston)
        if (mesh.position.y - radius < yMin) {
            mesh.position.y = yMin + radius;
            velocity.y = Math.abs(velocity.y);
            collided = true;
        } else if (mesh.position.y + radius > yMax) {
            mesh.position.y = yMax - radius;
            velocity.y = -Math.abs(velocity.y);
            collided = true;
        }

        return collided;
    }

    // Constrain particles to spherical bounds (for balloon shapes)
    constrainToSphere(particle, sphereRadius, sphereCenterY = 0) {
        const mesh = particle.mesh;
        const velocity = particle.velocity;
        const radius = particle.radius;
        let collided = false;

        // Calculate distance from sphere center
        const dx = mesh.position.x - this.centerOffset.x;
        const dy = mesh.position.y - (this.centerOffset.y + sphereCenterY);
        const dz = mesh.position.z - this.centerOffset.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const maxDist = sphereRadius - radius;

        if (dist > maxDist && dist > 0.001) {
            // Push back to sphere surface
            const scale = maxDist / dist;
            mesh.position.x = this.centerOffset.x + dx * scale;
            mesh.position.y = this.centerOffset.y + sphereCenterY + dy * scale;
            mesh.position.z = this.centerOffset.z + dz * scale;

            // Reflect velocity (normal to sphere surface)
            const nx = dx / dist;
            const ny = dy / dist;
            const nz = dz / dist;
            const dot = velocity.x * nx + velocity.y * ny + velocity.z * nz;
            velocity.x -= 2 * dot * nx;
            velocity.y -= 2 * dot * ny;
            velocity.z -= 2 * dot * nz;
            collided = true;
        }

        return collided;
    }

    update(deltaTime, useBoxBounds = true, cylinderParams = null) {
        // Speed factor for reference (actual speed set in setTemperature)
        const speedFactor = Math.pow(this.temperature / 300, 1.5);
        const activeCylinderParams = cylinderParams || this.cylinderParams;

        this.particles.forEach((particle, index) => {
            const mesh = particle.mesh;
            const velocity = particle.velocity;
            const radius = particle.radius;

            // Apply velocity with frame-rate independent movement
            const speedMultiplier = this.animationSpeed * deltaTime * 50;
            mesh.position.x += velocity.x * speedMultiplier;
            mesh.position.y += velocity.y * speedMultiplier;
            mesh.position.z += velocity.z * speedMultiplier;

            let collided = false;

            if (this.sphereParams) {
                // Use spherical bounds (for balloon shapes)
                collided = this.constrainToSphere(
                    particle,
                    this.sphereParams.radius,
                    this.sphereParams.centerY || 0
                );
            } else if (activeCylinderParams) {
                // Use cylindrical bounds
                collided = this.constrainToCylinder(
                    particle,
                    activeCylinderParams.radius,
                    activeCylinderParams.yMin,
                    activeCylinderParams.yMax
                );
            } else if (useBoxBounds) {
                // Use box bounds (default)
                const minX = this.centerOffset.x - this.bounds.x;
                const maxX = this.centerOffset.x + this.bounds.x;
                const minY = this.centerOffset.y - this.bounds.y;
                const maxY = this.centerOffset.y + this.bounds.y;
                const minZ = this.centerOffset.z - this.bounds.z;
                const maxZ = this.centerOffset.z + this.bounds.z;

                if (mesh.position.x + radius > maxX) {
                    mesh.position.x = maxX - radius;
                    velocity.x *= -1;
                    collided = true;
                } else if (mesh.position.x - radius < minX) {
                    mesh.position.x = minX + radius;
                    velocity.x *= -1;
                    collided = true;
                }

                if (mesh.position.y + radius > maxY) {
                    mesh.position.y = maxY - radius;
                    velocity.y *= -1;
                    collided = true;
                } else if (mesh.position.y - radius < minY) {
                    mesh.position.y = minY + radius;
                    velocity.y *= -1;
                    collided = true;
                }

                if (mesh.position.z + radius > maxZ) {
                    mesh.position.z = maxZ - radius;
                    velocity.z *= -1;
                    collided = true;
                } else if (mesh.position.z - radius < minZ) {
                    mesh.position.z = minZ + radius;
                    velocity.z *= -1;
                    collided = true;
                }
            }

            // Collision highlighting with smooth fade
            if (collided && this.options.showCollisions) {
                particle.colliding = true;
                particle.collisionTime = 8;
                mesh.material.emissiveIntensity = 1.0;
            } else if (particle.collisionTime > 0) {
                particle.collisionTime -= deltaTime;
                const fade = Math.max(0, particle.collisionTime / 8);
                mesh.material.emissiveIntensity = 0.4 + 0.6 * fade;
            } else {
                mesh.material.emissiveIntensity = 0.4;
            }

            // Particle-particle collisions (elastic)
            for (let j = index + 1; j < this.particles.length; j++) {
                const other = this.particles[j];
                const dx = mesh.position.x - other.mesh.position.x;
                const dy = mesh.position.y - other.mesh.position.y;
                const dz = mesh.position.z - other.mesh.position.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                const minDist = radius + other.radius;

                if (dist < minDist && dist > 0.001) {
                    // Elastic collision response
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const nz = dz / dist;

                    const dvx = velocity.x - other.velocity.x;
                    const dvy = velocity.y - other.velocity.y;
                    const dvz = velocity.z - other.velocity.z;

                    const dvn = dvx * nx + dvy * ny + dvz * nz;

                    if (dvn > 0) continue; // Already separating

                    // Apply impulse
                    velocity.x -= dvn * nx;
                    velocity.y -= dvn * ny;
                    velocity.z -= dvn * nz;

                    other.velocity.x += dvn * nx;
                    other.velocity.y += dvn * ny;
                    other.velocity.z += dvn * nz;

                    // Separate overlapping particles
                    const overlap = minDist - dist;
                    mesh.position.x += overlap * nx * 0.5;
                    mesh.position.y += overlap * ny * 0.5;
                    mesh.position.z += overlap * nz * 0.5;
                    other.mesh.position.x -= overlap * nx * 0.5;
                    other.mesh.position.y -= overlap * ny * 0.5;
                    other.mesh.position.z -= overlap * nz * 0.5;

                    // Both particles flash on collision
                    if (this.options.showCollisions) {
                        particle.collisionTime = 5;
                        other.collisionTime = 5;
                    }
                }
            }

            // Update trail if enabled
            if (this.options.showTrails && particle.trail) {
                particle.trailPositions.push(mesh.position.clone());
                if (particle.trailPositions.length > 10) {
                    particle.trailPositions.shift();
                }

                const positions = particle.trail.geometry.attributes.position.array;
                for (let i = 0; i < particle.trailPositions.length; i++) {
                    positions[i * 3] = particle.trailPositions[i].x;
                    positions[i * 3 + 1] = particle.trailPositions[i].y;
                    positions[i * 3 + 2] = particle.trailPositions[i].z;
                }
                particle.trail.geometry.attributes.position.needsUpdate = true;
                particle.trail.geometry.setDrawRange(0, particle.trailPositions.length);
                particle.trail.visible = true;
            } else if (particle.trail) {
                particle.trail.visible = false;
            }
        });
    }

    attachTrail(particle) {
        if (particle.trail) return;

        const trailGeometry = new THREE.BufferGeometry();
        const trailPositions = new Float32Array(30 * 3);
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        const trailMaterial = new THREE.LineBasicMaterial({
            color: particle.baseColor,
            transparent: true,
            opacity: 0.4
        });
        particle.trail = new THREE.Line(trailGeometry, trailMaterial);
        this.scene.add(particle.trail);
    }

    detachTrail(particle) {
        if (!particle.trail) return;
        this.scene.remove(particle.trail);
        particle.trail.geometry.dispose();
        particle.trail.material.dispose();
        particle.trail = null;
        particle.trailPositions = [];
    }

    // Reposition all particles within current bounds
    repositionParticles() {
        this.particles.forEach(particle => {
            if (this.sphereParams) {
                // Position within spherical bounds
                const r = this.sphereParams.radius * 0.8 * Math.cbrt(Math.random()); // Uniform in sphere
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                particle.mesh.position.set(
                    this.centerOffset.x + r * Math.sin(phi) * Math.cos(theta),
                    this.centerOffset.y + (this.sphereParams.centerY || 0) + r * Math.cos(phi),
                    this.centerOffset.z + r * Math.sin(phi) * Math.sin(theta)
                );
            } else if (this.cylinderParams) {
                const { radius, yMin, yMax } = this.cylinderParams;
                const pos = this.getRandomCylinderPosition(radius, yMin, yMax, particle.radius);
                particle.mesh.position.copy(pos);
            } else {
                // Box bounds (default)
                particle.mesh.position.set(
                    this.centerOffset.x + (Math.random() - 0.5) * this.bounds.x * 1.6,
                    this.centerOffset.y + (Math.random() - 0.5) * this.bounds.y * 1.6,
                    this.centerOffset.z + (Math.random() - 0.5) * this.bounds.z * 1.6
                );
            }
        });
    }

    enforceContainment() {
        if (this.sphereParams) {
            const { radius, centerY = 0 } = this.sphereParams;
            this.particles.forEach(particle => {
                this.constrainToSphere(particle, radius, centerY);
            });
        } else if (this.cylinderParams) {
            const { radius, yMin, yMax } = this.cylinderParams;
            this.particles.forEach(particle => {
                this.constrainToCylinder(particle, radius, yMin, yMax);
            });
        } else {
            const minX = this.centerOffset.x - this.bounds.x;
            const maxX = this.centerOffset.x + this.bounds.x;
            const minY = this.centerOffset.y - this.bounds.y;
            const maxY = this.centerOffset.y + this.bounds.y;
            const minZ = this.centerOffset.z - this.bounds.z;
            const maxZ = this.centerOffset.z + this.bounds.z;

            this.particles.forEach(particle => {
                const { mesh, radius } = particle;
                mesh.position.x = Math.min(maxX - radius, Math.max(minX + radius, mesh.position.x));
                mesh.position.y = Math.min(maxY - radius, Math.max(minY + radius, mesh.position.y));
                mesh.position.z = Math.min(maxZ - radius, Math.max(minZ + radius, mesh.position.z));
            });
        }
    }

    setShowTrails(show) {
        this.options.showTrails = show;

        this.particles.forEach(particle => {
            if (show) {
                this.attachTrail(particle);
            } else {
                this.detachTrail(particle);
            }
        });
    }

    setShowCollisions(show) {
        this.options.showCollisions = show;
        if (!show) {
            this.particles.forEach(particle => {
                particle.colliding = false;
                particle.collisionTime = 0;
                particle.mesh.material.emissiveIntensity = 0.4;
            });
        }
    }

    getCount() {
        return this.particles.length;
    }
}
