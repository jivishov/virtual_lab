/**
 * Shared materials. Transparent shells are drawn after the spheres
 * (depthWrite off) so the gas stays visible through glass and latex.
 */
import * as THREE from 'three';

// Glass and latex use the standard material: physical clearcoat and sheen
// cost a second lighting pass per pixel, which weak classroom GPUs feel.
export const glass = (opts = {}) =>
  new THREE.MeshStandardMaterial({
    color: 0xe8f3f4, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.16,
    envMapIntensity: 1.6, depthWrite: false, side: THREE.FrontSide, ...opts,
  });

export const latex = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({
    color, roughness: 0.28, metalness: 0, transparent: true, opacity: 0.4,
    envMapIntensity: 1.2, depthWrite: false, side: THREE.DoubleSide, ...opts,
  });

export const metal = (color = 0xc9ced3, roughness = 0.28) =>
  new THREE.MeshStandardMaterial({ color, metalness: 1, roughness, envMapIntensity: 1.1 });

export const chrome = () => metal(0xe7eaed, 0.12);
export const aluminum = () => metal(0xb9c1c7, 0.38);
export const brass = () => metal(0xc8a35a, 0.3);

export const rubber = (color = 0x24272a) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0 });

export const plastic = (color, roughness = 0.45) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

export const enamel = () => new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.35 });

export const ink = (color = 0x26323b) => new THREE.MeshBasicMaterial({ color });

export const liquid = (color, opacity = 0.28) =>
  new THREE.MeshStandardMaterial({
    color, roughness: 0.06, metalness: 0, transparent: true, opacity,
    envMapIntensity: 1.0, depthWrite: false, side: THREE.FrontSide,
  });

/** Clip everything in front of z = z0, for cutaway views. */
export const cutaway = (z0 = 0) => [new THREE.Plane(new THREE.Vector3(0, 0, -1), z0)];
