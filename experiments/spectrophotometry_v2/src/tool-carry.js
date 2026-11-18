// A constant projected depth is a camera-facing drag plane. Keep the originally
// touched surface point registered with the pointer as the tool moves.
export function beginCarry(renderer, position, grip, x, y) {
  const projected = renderer.project(grip);
  return {
    depth: projected.z,
    endDepth: renderer.project(position).z,
    screenOffset: [projected.x - x, projected.y - y],
    gripOffset: grip.map((v, axis) => v - position[axis])
  };
}

// The tip and the grip sit at different depths in an oblique camera. For an
// indicated vessel, project the grip from the tip's drag plane so long carries
// and close-up views use the same perspective as the physical apparatus.
export function pointerForEnd(renderer, carry, target) {
  const tip = renderer.unproject(target.x, target.y, carry.endDepth);
  const grip = renderer.project(tip.map((v, i) => v + carry.gripOffset[i]));
  return {...target, x: grip.x - carry.screenOffset[0], y: grip.y - carry.screenOffset[1]};
}

export function carryPosition(renderer, carry, x, y, bounds) {
  const sx = x + carry.screenOffset[0], sy = y + carry.screenOffset[1];
  const near = renderer.unproject(sx, sy, -1);
  const plane = renderer.unproject(sx, sy, carry.depth);
  const origin = near.map((v, i) => v - carry.gripOffset[i]);
  const direction = plane.map((v, i) => v - near[i]);
  // Where the drag plane goes through the benchtop, slide along this same
  // sightline to stay above it. The grip still lands at the same screen pixel.
  let entry = 0, exit = Infinity;
  for (let axis = 0; axis < 3; axis++) {
    const d = direction[axis];
    if (Math.abs(d) < 1e-8) continue;
    const a = (bounds.min[axis] - origin[axis]) / d;
    const b = (bounds.max[axis] - origin[axis]) / d;
    entry = Math.max(entry, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
  }
  // Beyond the reachable bench, the two clipping planes can cross. Approaching
  // that edge from either side should leave the tool at the same boundary.
  const lower = Math.min(entry, exit), upper = Math.max(entry, exit);
  const t = Math.max(0, Math.min(upper, Math.max(lower, 1)));
  return origin.map((v, i) => Math.min(bounds.max[i], Math.max(bounds.min[i], v + direction[i] * t)));
}
