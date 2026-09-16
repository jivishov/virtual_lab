'use strict';
// Unit tests of production geometry and the production free-hand button gate.
// Synthetic articulated landmarks are not a test of webcam/model accuracy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const controlSource = fs.readFileSync(path.join(root, 'js/pipette-control.js'), 'utf8');
const handSource = fs.readFileSync(path.join(root, 'js/handcontrol.js'), 'utf8');
function extract(re, name) {
  const found = handSource.match(re);
  assert.ok(found, `Production ${name} not found; update this test with the implementation.`);
  return found[0];
}
function rig(tool = 'pipette') {
  const actions = [];
  const Lab = {};
  let now = 0;
  const context = { Lab, window: { Lab }, console, performance: { now: () => now } };
  vm.createContext(context);
  vm.runInContext(controlSource.replace('  Lab.pipetteControl = {',
    '  Lab._capture = startCapture;\n  Lab.pipetteControl = {'), context);
  // Extract the real gate and thresholds, not a rewritten mock of them.
  vm.runInContext([
    extract(/  var RISE_TRAVEL = [^;]+;/, 'press threshold'),
    extract(/  var RISE_BACK = [^;]+;/, 'release threshold'),
    extract(/  var SIDE_OUT = [^;]+;/, 'eject thresholds'),
    extract(/  function Gate\([\s\S]*?Gate\.prototype\.set = [\s\S]*?\n  };/, 'Gate'),
    extract(/  function updateFreeButtons\([\s\S]*?\n  }/, 'free buttons'),
    `var S = {held: ${JSON.stringify(tool)}};
     var press = new Gate(60, 80), freeRest = new Gate(90), ejectReady = new Gate(120);
     var restRise = null, restSide = null, freeNeedsRest = false;
     var thumbSmooth = null, thumbStamp = 0, settleUntil = 0, pressKind = 'press';
     function onPlunger() { emit('press'); }
     function onEject() { emit('eject'); }
     function feed(m, stamp) {
       updateFreeButtons({thumbReady: !!m, rise: m ? m.rise : null, side: m ? m.side : null}, stamp);
     }`
  ].join('\n'), context);
  context.emit = value => actions.push(value);
  return { Lab, actions, context, now: value => { now = value; },
    feed(p, time) { now = time; context.feed(Lab.pipetteControl.measure(p), time); } };
}
// Fixed thumb bone lengths. A short stroke changes the MCP angle by only
// 20 degrees and the distal segment by 40 degrees, unlike the previous
// fixture's 54/109-degree bend. Also supports isolated MCP/IP flexion.
function hand(mcp = 0, ip = 0, side = -.12) {
  const p = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  p[1] = { x: -.025, y: .025, z: 0 };
  function extend(from, length, degrees) {
    const a = degrees * Math.PI / 180;
    return { x: from.x + length * Math.sin(side),
      y: from.y + length * Math.cos(side) * Math.cos(a),
      z: from.z + length * Math.cos(side) * Math.sin(a) };
  }
  p[2] = extend(p[1], .032, 0);
  p[3] = extend(p[2], .025, mcp);
  p[4] = extend(p[3], .02, mcp + ip);
  [5, 9, 13, 17].forEach((i, f) => {
    p[i] = { x: -.019 + f * .018, y: .06 - (f === 3 ? .01 : 0), z: 0 };
    p[i + 1] = { x: p[i].x, y: p[i].y + .02, z: .01 };
    p[i + 2] = { x: p[i].x, y: p[i].y + .01, z: .028 };
    p[i + 3] = { x: p[i].x, y: p[i].y + .004, z: .025 };
  });
  return p;
}
function transform(p, yaw = 0, pitch = 0, roll = 0, scale = 1, mirror = 1) {
  return p.map(v => {
    let x = v.x * mirror, y = v.y, z = v.z;
    [x, z] = [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
    [y, z] = [y * Math.cos(pitch) - z * Math.sin(pitch), y * Math.sin(pitch) + z * Math.cos(pitch)];
    [x, y] = [x * Math.cos(roll) - y * Math.sin(roll), x * Math.sin(roll) + y * Math.cos(roll)];
    return { x: x * scale + .03, y: y * scale - .02, z: z * scale + .04 };
  });
}
function hold(r, p, from, to, step = 20) { for (let t = from; t <= to; t += step) r.feed(p, t); }
function cycle(r, start = 0, p = hand(20, 20)) {
  hold(r, hand(), start, start + 400);
  hold(r, p, start + 420, start + 800);
  hold(r, hand(), start + 820, start + 1200);
}
function legacyRise(p) {
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const scale = d(p[2], p[1]) + d(p[3], p[2]) + d(p[4], p[3]);
  return (.75 * d(p[4], p[0]) + .25 * d(p[3], p[0])) / scale - 1;
}
test('regression: moderate 20/20-degree thumb bend passes the actual free-hand gate', () => {
  assert.ok(legacyRise(hand()) - legacyRise(hand(20, 20)) < .16,
    'The former wrist-distance signal misses this articulated stroke.');
  const r = rig(); cycle(r); assert.deepEqual(r.actions, ['press']);
});
test('short MCP-only and IP-only bends work without an exaggerated full-thumb fold', () => {
  for (const pose of [hand(30, 0), hand(0, 45), hand(10, 30)]) {
    const r = rig(); cycle(r, 0, pose); assert.deepEqual(r.actions, ['press']);
  }
});
test('the same free-hand gate operates the micropipette, transfer pipet and marker', () => {
  for (const tool of ['pipette', 'transfer', 'marker']) {
    const r = rig(tool); cycle(r); assert.deepEqual(r.actions, ['press'], tool);
  }
});
test('holding the thumb down cannot repeat; a release permits the next press', () => {
  const r = rig(); hold(r, hand(), 0, 400); hold(r, hand(20, 20), 420, 2400);
  assert.deepEqual(r.actions, ['press']);
  hold(r, hand(), 2420, 2800); hold(r, hand(20, 20), 2820, 3200);
  assert.deepEqual(r.actions, ['press', 'press']);
});
test('rigid hand rotations, translation, scale and mirroring do not change the free signal', () => {
  const r = rig(); const c = r.Lab.pipetteControl;
  for (const pose of [hand(), hand(20, 20)]) {
    const base = c.measure(pose).rise;
    for (const yaw of [-1.5, -.7, 0, .7, 1.5]) for (const pitch of [-1, 0, 1])
      for (const roll of [-1, 0, 1]) for (const scale of [.7, 1, 1.3]) for (const mirror of [-1, 1]) {
        assert.ok(Math.abs(c.measure(transform(pose, yaw, pitch, roll, scale, mirror)).rise - base) < 1e-10);
      }
  }
});
test('moving/turning a resting fist produces no action; turning during a stroke still works', () => {
  const r = rig(); hold(r, hand(), 0, 400);
  for (let i = 0; i < 100; i++) r.feed(transform(hand(), Math.sin(i / 20), .4, .6), 420 + i * 20);
  assert.deepEqual(r.actions, []);
  hold(r, transform(hand(20, 20), 1.4, -.4, .6), 2420, 2900);
  assert.deepEqual(r.actions, ['press']);
});
test('collapsed or missing finger knuckles do not disable a usable thumb bend', () => {
  for (const missing of [false, true]) {
    const r = rig(); const a = hand(), b = hand(20, 20);
    for (let i = 5; i < 21; i++) { a[i] = b[i] = missing ? null : { x: 0, y: 0, z: 0 }; }
    assert.equal(r.Lab.pipetteControl.measure(a).side, null);
    hold(r, a, 0, 400); hold(r, b, 420, 850); assert.deepEqual(r.actions, ['press']);
  }
});
test('slow continuous strokes are not absorbed into the resting reference', () => {
  for (const duration of [200, 600, 1000, 1500]) {
    const r = rig(); hold(r, hand(), 0, 400);
    for (let t = 0; t <= duration; t += 20) r.feed(hand(20 * t / duration, 20 * t / duration), 420 + t);
    hold(r, hand(20, 20), 440 + duration, 840 + duration);
    assert.deepEqual(r.actions, ['press'], String(duration));
  }
});
test('a brief partial bend does not fire, and resting jitter does not accumulate presses', () => {
  const r = rig(); hold(r, hand(), 0, 400);
  for (let i = 0; i < 100; i++) r.feed(hand(2 + 2 * Math.sin(i), 2 + 2 * Math.cos(i)), 420 + i * 20);
  assert.deepEqual(r.actions, []);
  hold(r, hand(20, 20), 2420, 2440); hold(r, hand(), 2460, 2800);
  assert.deepEqual(r.actions, []);
});
test('missing/malformed thumb readings cannot press or replay an interrupted press', () => {
  const r = rig(); hold(r, hand(), 0, 400);
  for (const bad of [null, { x: NaN, y: 0, z: 0 }, { x: Infinity, y: 0, z: 0 }]) {
    const p = hand(); p[4] = bad; assert.equal(r.Lab.pipetteControl.measure(p), null);
  }
  r.feed(hand(20, 20), 420); r.feed(null, 440);
  hold(r, hand(20, 20), 460, 900); assert.deepEqual(r.actions, []);
  hold(r, hand(), 920, 1400); hold(r, hand(20, 20), 1420, 1800);
  assert.deepEqual(r.actions, ['press']);
});
test('an already bent resting thumb can still make another moderate press', () => {
  const r = rig(); hold(r, hand(12, 12), 0, 400); hold(r, hand(32, 32), 420, 900);
  assert.deepEqual(r.actions, ['press']);
});
test('free gesture measurement works without running physical-pipette calibration', () => {
  const r = rig(); r.Lab.pipetteControl.setEnabled(false); cycle(r);
  assert.equal(r.Lab.pipetteControl.ready(), false); assert.deepEqual(r.actions, ['press']);
});
test('real-pipette calibration and button discrimination retain their original feature vectors', () => {
  const r = rig(); const c = r.Lab.pipetteControl;
  const poses = [hand(), hand(54, 55), hand(29, 45, -.85)];
  poses.forEach((pose, k) => {
    r.now(k * 5000); r.Lab._capture();
    for (let i = 0; i < 45; i++) c.observe(c.measure(transform(pose, (i / 44 - .5) * 2, .2, .1)), k * 5000 + 1450 + i * 45);
    r.now(k * 5000 + 4100); c.tick(k * 5000 + 4100);
  });
  assert.equal(c.ready(), true);
  poses.forEach((pose, k) => assert.equal(c.classify(c.measure(pose), true).button, ['rest', 'press', 'eject'][k]));
});
test('an outward preparation selects the ejector, while an ordinary bend selects the plunger', () => {
  const r = rig(); hold(r, hand(), 0, 400);
  hold(r, hand(0, 0, -.85), 420, 800);
  hold(r, hand(29, 45, -.85), 820, 1300);
  assert.deepEqual(r.actions, ['eject']);
});
test('moderate free-hand strokes work at both low and high frame rates', () => {
  for (const step of [16, 33, 67, 100]) {
    const r = rig(); hold(r, hand(), 0, 500, step);
    hold(r, hand(20, 20), 550, 1200, step);
    hold(r, hand(), 1250, 1800, step);
    hold(r, hand(20, 20), 1850, 2500, step);
    assert.deepEqual(r.actions, ['press', 'press'], `frame interval ${step}ms`);
  }
});
test('0.5mm deterministic landmark jitter at rest does not press', () => {
  const r = rig(); hold(r, hand(), 0, 400);
  for (let i = 0; i < 300; i++) {
    const p = hand();
    for (let j = 1; j <= 4; j++) {
      p[j].x += .0005 * Math.sin(i * 1.3 + j);
      p[j].y += .0005 * Math.sin(i * 1.7 + j);
      p[j].z += .0005 * Math.cos(i * 1.9 + j);
    }
    r.feed(p, 420 + i * 20);
  }
  assert.deepEqual(r.actions, []);
});
