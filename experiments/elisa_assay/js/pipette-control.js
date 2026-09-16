/* Learn the visible thumb movements around a real micropipette.
   Calibration is kept only for this page session. This reads hand landmarks;
   it does not identify the physical instrument or sense its mechanical stops. */
(function (Lab) {
  'use strict';
  var enabled = true, profile = null, step = -1, poses = [], capture = null;
  var host = null, changed = null, notice = '', timerText = '';
  var names = ['Resting grip', 'Plunger pressed', 'Tip ejector pressed'];
  var instructions = [
    'Hold the barrel normally, with your thumb resting on the top plunger.',
    'Keep the same grip. Press the top plunger to its first stop and hold it.',
    'Release the plunger. Move your thumb onto the separate tip ejector, press and hold.'
  ];

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a.reduce(function (s, v, i) { return s + v * b[i]; }, 0); }
  function length(a) { return Math.sqrt(dot(a, a)); }
  function unit(a) { var d = length(a) || 1e-6; return a.map(function (v) { return v / d; }); }
  function distance(a, b) {
    return Math.sqrt(a.reduce(function (s, v, i) { return s + Math.pow(v - b[i], 2); }, 0) / a.length);
  }
  function median(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a[Math.floor(a.length / 2)]; }
  function centre(samples, key) {
    return samples[0][key].map(function (_, i) { return median(samples.map(function (s) { return s[key][i]; })); });
  }

  // A palm-local 3D frame makes a learned press independent of screen angle,
  // hand size and distance from the camera. A two-dimensional fallback could
  // mistake turning the pipette for pressing its button, so calibration waits
  // for a usable world-space hand reading.
  function measure(world) {
    if (!world || world.length !== 21 || !world.every(function (p) {
      return p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
    })) return null;
    var p = world.map(function (v) { return [v.x, v.y, v.z]; });
    var span = median([5, 9, 13, 17].map(function (i) { return length(sub(p[i], p[0])); }));
    if (span < 0.005) return null;
    var up = unit(sub(p[9], p[0]));
    var width = sub(p[17], p[5]), along = dot(width, up);
    var acrossRaw = width.map(function (v, i) { return v - along * up[i]; });
    if (length(acrossRaw) / span < 0.2) return null;
    var across = unit(acrossRaw);
    var normal = [up[1] * across[2] - up[2] * across[1],
      up[2] * across[0] - up[0] * across[2], up[0] * across[1] - up[1] * across[0]];
    var thumb = [];
    [3, 4].forEach(function (i) {
      var v = sub(p[i], p[5]);
      [up, across, normal].forEach(function (axis) { thumb.push(dot(v, axis) / span); });
    });
    var fingers = [], bent = 0;
    [5, 9, 13, 17].forEach(function (i) {
      var first = sub(p[i + 1], p[i]), end = sub(p[i + 3], p[i + 1]);
      var bone = length(first);
      if (bone < span * 0.08) { fingers.push(10, 10); return; }
      var reach = length(sub(p[i + 3], p[i])) / bone;
      var alignment = dot(unit(first), unit(end));
      fingers.push(reach * 0.5, alignment * 0.7);
      if (reach < 1.5 || (reach < 2.7 && alignment < 0.75)) bent++;
    });
    return { thumb: thumb, fingers: fingers, bent: bent };
  }

  function ready() { return enabled && !!profile && step < 0; }
  function classify(m) {
    if (!ready() || !m) return { holding: false, button: 'unknown', depth: 0, selection: 'press' };
    var holding = m.bent >= 2 && distance(m.fingers, profile.rest.fingers) < 0.42;
    var rest = profile.rest.thumb;
    var dr = distance(m.thumb, rest);
    var options = ['press', 'eject'].map(function (key) {
      var target = profile[key].thumb;
      var vector = target.map(function (v, i) { return v - rest[i]; });
      var displacement = m.thumb.map(function (v, i) { return v - rest[i]; });
      return { key: key, d: distance(m.thumb, target), travel: distance(target, rest),
        depth: Math.max(0, Math.min(1.2, dot(displacement, vector) / Math.max(1e-8, dot(vector, vector)))) };
    }).sort(function (a, b) { return a.d - b.d; });
    var best = options[0], other = options[1];
    var restRange = Math.max(Math.min(options[0].travel, options[1].travel) * 0.32, profile.noise * 3);
    var button = dr < restRange ? 'rest' : 'unknown';
    if (holding && best.depth > 0.58 && best.d < Math.max(best.travel * 0.65, profile.noise * 4) &&
        best.d < dr * 0.85 && best.d * 1.15 < other.d) button = best.key;
    return { holding: holding, button: button, depth: best.depth, selection: best.key };
  }

  function resetControl() { if (changed) changed(); }
  function setEnabled(value) {
    enabled = !!value; capture = null; step = -1; notice = '';
    resetControl(); render();
  }
  function begin() {
    step = 0; poses = []; capture = null; notice = '';
    resetControl(); render();
  }
  function startCapture() {
    if (step < 0) begin();
    var now = performance.now();
    capture = { start: now + 1400, end: now + 2900, samples: [] };
    notice = ''; render();
  }
  function cancel() { capture = null; step = -1; notice = ''; resetControl(); render(); }
  function observe(m, stamp) {
    if (capture && m && stamp >= capture.start && stamp <= capture.end) capture.samples.push(m);
    if (ready() && notice && m && classify(m).button === 'rest') { notice = ''; render(); }
  }
  function tick(now) {
    if (!capture) return;
    var next = now < capture.start ? 'Get ready… ' + Math.ceil((capture.start - now) / 1000)
      : 'Hold this position…';
    if (timerText !== next) {
      timerText = next;
      if (host) host.querySelector('.pipette-cal__status').textContent = next;
    }
    if (now > capture.end + 260) finishCapture();
  }
  function finishCapture() {
    var samples = capture.samples; capture = null;
    if (samples.length < 6) {
      notice = 'Not enough clear readings. Keep your thumb and knuckles visible, then try again.';
      render(); return;
    }
    var pose = { thumb: centre(samples, 'thumb'), fingers: centre(samples, 'fingers') };
    pose.noise = median(samples.map(function (s) { return distance(s.thumb, pose.thumb); }));
    if (median(samples.map(function (s) { return s.bent; })) < 2 || pose.noise > 0.08) {
      notice = 'Wrap your fingers around the barrel and hold the thumb still during capture.';
      render(); return;
    }
    if (step > 0) {
      var minimum = Math.max(0.025, (poses[0].noise + pose.noise) * 4);
      if (distance(pose.thumb, poses[0].thumb) < minimum || distance(pose.fingers, poses[0].fingers) > 0.42) {
        notice = 'That press was not distinct from your resting grip. Turn the hand so the camera can see your thumb move and recapture.';
        render(); return;
      }
      if (step === 2 && distance(pose.thumb, poses[1].thumb) < Math.max(minimum, distance(poses[1].thumb, poses[0].thumb) * 0.45)) {
        notice = 'The two buttons look too similar. Show the separate ejector movement more clearly, then recapture.';
        render(); return;
      }
    }
    poses[step] = pose; step++;
    if (step === 3) {
      profile = { rest: poses[0], press: poses[1], eject: poses[2],
        noise: Math.max(0.004, poses[0].noise, poses[1].noise, poses[2].noise) };
      step = -1; notice = 'Grip learned. Release both buttons before picking up the on-screen pipette.';
      resetControl();
    }
    render();
  }

  function mount(container, onChange, onPlace) {
    host = container; changed = onChange;
    host.innerHTML = '<label class="pipette-cal__mode">Micropipette input' +
      '<select aria-label="Micropipette input"><option value="real">Real micropipette</option>' +
      '<option value="free">Free-hand gestures</option></select></label>' +
      '<div class="pipette-cal__body"><p class="pipette-cal__title"></p>' +
      '<p class="pipette-cal__status" role="status"></p>' +
      '<p class="pipette-cal__help">Use an empty pipette for setup. Keep your thumb and knuckles visible. The camera reads thumb motion, not physical button contact.</p>' +
      '<div class="pipette-cal__actions"><button type="button" class="btn btn--small" data-cal="capture"></button>' +
      '<button type="button" class="btn btn--small" data-cal="cancel">Cancel</button>' +
      '<button type="button" class="btn btn--small" data-cal="place">Set down</button></div></div>';
    host.querySelector('select').addEventListener('change', function (e) { setEnabled(e.target.value === 'real'); });
    host.querySelector('[data-cal="capture"]').addEventListener('click', startCapture);
    host.querySelector('[data-cal="cancel"]').addEventListener('click', cancel);
    host.querySelector('[data-cal="place"]').addEventListener('click', onPlace);
    render();
  }
  function render() {
    timerText = '';
    if (!host) return;
    host.querySelector('select').value = enabled ? 'real' : 'free';
    host.querySelector('.pipette-cal__body').hidden = !enabled;
    host.closest('.handpanel').classList.toggle('handpanel--real', enabled);
    host.querySelector('.pipette-cal__title').textContent = step >= 0
      ? (step + 1) + ' / 3 · ' + names[step] : profile ? 'Real pipette · calibrated' : 'Learn your grip and both buttons';
    host.querySelector('.pipette-cal__status').textContent = notice || (step >= 0 ? instructions[step]
      : profile ? 'Plunger: release to aspirate, press to dispense. Ejector: press over waste. Set down parks the virtual pipette.'
      : 'Capture three positions using your normal grip. Each capture gives you time to move your thumb.');
    host.querySelector('.pipette-cal__help').textContent = profile && step < 0
      ? 'Keep your thumb visible. Recalibrate if you change your hand or grip.'
      : 'Use an empty pipette for setup. Keep your thumb and knuckles visible. The camera reads thumb motion, not physical button contact.';
    var button = host.querySelector('[data-cal="capture"]');
    button.textContent = capture ? 'Reading…' : step >= 0 ? 'Capture ' + names[step].toLowerCase()
      : profile ? 'Recalibrate' : 'Calibrate grip';
    button.disabled = !!capture;
    host.querySelector('[data-cal="cancel"]').hidden = step < 0;
    host.querySelector('[data-cal="place"]').hidden = !profile || step >= 0;
  }
  function unmount() { host = null; capture = null; step = -1; changed = null; }

  Lab.pipetteControl = {
    measure: measure, classify: classify, observe: observe, tick: tick,
    enabled: function () { return enabled; }, ready: ready,
    calibrating: function () { return step >= 0; },
    setEnabled: setEnabled, mount: mount, unmount: unmount,
    status: function () { return { enabled: enabled, calibrated: !!profile, step: step,
      capturing: !!capture, samples: capture ? capture.samples.length : 0 }; }
  };
})(window.Lab = window.Lab || {});
