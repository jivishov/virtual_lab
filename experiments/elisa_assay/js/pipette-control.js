/* Learn the visible thumb movements around a real micropipette.
   Calibration is kept only for this page session. This reads hand landmarks;
   it does not identify the physical instrument or sense its mechanical stops. */
(function (Lab) {
  'use strict';
  var enabled = true, profile = null, step = -1, poses = [], capture = null;
  var host = null, changed = null, notice = '', timerText = '';
  var names = ['Resting grip', 'Plunger pressed', 'Tip ejector pressed'];
  var instructions = [
    'Hold your normal vertical grip with your thumb resting on the top plunger. Gently move through your usual working angles.',
    'Keep that grip. Hold the top plunger at its first stop while gently moving through the same working angles.',
    'Release the plunger. Hold the separate tip ejector down and repeat those small wrist turns.'
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
    return samples[0][key].map(function (_, i) {
      var values = samples.map(function (s) { return s[key][i]; }).filter(function (v) { return v !== null; });
      return values.length ? median(values) : null;
    });
  }

  // Button features use only wrist + thumb (0..4), not the four MCPs hidden
  // behind a vertical grip. Distances in world space are invariant to rigid
  // rotation/translation, including an edge-on fist. They remain estimates:
  // structural checks reject malformed geometry, not every possible occlusion.
  function valid(p) {
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
  }
  function measure(world) {
    if (!world || world.length !== 21 || !world.slice(0, 5).every(valid)) return null;
    var p = world.map(function (v) { return valid(v) ? [v.x, v.y, v.z] : null; });
    var bones = [length(sub(p[2], p[1])), length(sub(p[3], p[2])), length(sub(p[4], p[3]))];
    var scale = bones.reduce(function (sum, v) { return sum + v; }, 0);
    if (scale < 0.015 || scale > 0.25 || bones.some(function (v) {
      return v / scale < 0.12 || v / scale > 0.62;
    })) return null;
    var base = length(sub(p[1], p[0]));
    if (base / scale < 0.12 || base / scale > 1.6) return null;
    var thumb = [];
    [3, 4].forEach(function (i) {
      [0, 1, 2].forEach(function (anchor) { thumb.push(length(sub(p[i], p[anchor])) / scale); });
    });
    var fingers = [], bent = 0, extended = 0;
    [5, 9, 13, 17].forEach(function (i) {
      if (!p[i] || !p[i + 1] || !p[i + 3]) { fingers.push(null, null); return; }
      var first = sub(p[i + 1], p[i]), end = sub(p[i + 3], p[i + 1]);
      var bone = length(first), reach = length(sub(p[i + 3], p[i])) / Math.max(1e-6, bone);
      if (bone / scale < 0.08 || bone / scale > 0.85 || reach > 3.6) {
        fingers.push(null, null); return;
      }
      var alignment = dot(unit(first), unit(end));
      fingers.push(reach * 0.5, alignment * 0.7);
      if (reach < 1.5 || (reach < 2.7 && alignment < 0.75)) bent++;
      if (reach > 1.75 && alignment > 0.65) extended++;
    });

    // Free-hand presses must measure thumb articulation, not just distance
    // to the wrist. A moderate bend can follow an almost constant wrist
    // radius, so the previous radial signal never crossed the press gate.
    // Project the IP and tip from the thumb MCP onto the CMC->MCP axis and
    // normalize by the two moving bones. No finger-knuckle frame is needed.
    // The factor of two maps a moderate bend into the existing 0.16 gate;
    // debounce, release hysteresis and interruption protection stay intact.
    // Only `rise` changes: calibrated real-pipette features above, shape
    // checks and button classification are deliberately unchanged.
    var thumbAxis = unit(sub(p[2], p[1]));
    var distalLength = bones[1] + bones[2];
    var rise = 2 * (0.75 * dot(sub(p[4], p[2]), thumbAxis) +
      0.25 * dot(sub(p[3], p[2]), thumbAxis)) / distalLength;
    // Ejector direction remains an optional, separate palm reading. A
    // missing across-knuckle frame cannot disable the plunger signal.
    var side = null;
    if (p[5] && p[9] && p[17]) {
      var palmSpan = length(sub(p[9], p[0]));
      var up = unit(sub(p[9], p[0]));
      var width = sub(p[17], p[5]);
      var acrossRaw = width.map(function (v, i) { return v - dot(width, up) * up[i]; });
      if (palmSpan / scale > 0.3 && length(acrossRaw) / palmSpan > 0.25) {
        side = dot(sub(p[4], p[5]), unit(acrossRaw)) / palmSpan;
      }
    }
    return { thumb: thumb, fingers: fingers, bent: bent, extended: extended,
      shape: bones.map(function (v) { return v / scale; }).concat(base / scale),
      rise: rise, side: side };
  }

  // Two consistent fingers are sufficient to acquire a tool. Once acquired,
  // the caller's grip latch (released by a positively open hand) owns holding;
  // hidden ring/little fingers must not veto every subsequent thumb press.
  function gripDistance(a, b) {
    var errors = [];
    for (var i = 0; i < 8; i += 2) {
      if (a[i] !== null && b[i] !== null) errors.push(distance(a.slice(i, i + 2), b.slice(i, i + 2)));
    }
    errors.sort(function (x, y) { return x - y; });
    return errors.length >= 2 ? (errors[0] + errors[1]) / 2 : Infinity;
  }
  function nearest(m, pose) {
    var best = { d: Infinity, value: pose.thumb };
    (pose.examples || [pose.thumb]).forEach(function (value) {
      var d = distance(m, value);
      if (d < best.d) best = { d: d, value: value };
    });
    return best;
  }
  function ready() { return enabled && !!profile && step < 0; }
  function classify(m, latched) {
    var unknown = { holding: false, button: 'unknown', depth: 0, selection: 'press' };
    if (!ready() || !m || distance(m.shape, profile.rest.shape) > 0.16) return unknown;
    var holding = m.extended < 3 && (latched ||
      m.bent >= 2 && gripDistance(m.fingers, profile.rest.fingers) < 0.42);
    var rest = nearest(m.thumb, profile.rest);
    var options = ['press', 'eject'].map(function (key) {
      var target = nearest(m.thumb, profile[key]);
      var vector = subVector(target.value, rest.value);
      var displacement = subVector(m.thumb, rest.value);
      var travel = distance(target.value, rest.value);
      var depth = dot(displacement, vector) / Math.max(1e-8, dot(vector, vector));
      var residual = distance(displacement, vector.map(function (v) { return v * depth; }));
      return { key: key, d: target.d, travel: travel,
        depth: Math.max(0, Math.min(1.2, depth)),
        transition: depth > 0 && depth < 1.1 && residual < Math.max(travel * 0.22, profile.noise * 2) };
    }).sort(function (a, b) { return a.d - b.d; });
    var best = options[0], other = options[1];
    var restRange = Math.max(Math.min(options[0].travel, options[1].travel) * 0.30, profile.noise * 2);
    var button = rest.d < restRange ? 'rest' : 'unknown';
    if (holding && button !== 'rest' && best.depth > 0.58 &&
        best.d < Math.max(best.travel * 0.55, profile.noise * 3) &&
        best.d < rest.d * 0.80 && best.d + profile.noise < other.d * 0.85) button = best.key;
    // A plausible position between rest and a learned button is not lost
    // tracking. It must not fire an edge, but a slow physical stroke needs
    // time to pass through it without being mistaken for an occlusion.
    return { holding: holding, button: button, depth: best.depth, selection: best.key,
      transition: holding && button === 'unknown' && options.some(function (o) { return o.transition; }) };
  }
  function subVector(a, b) { return a.map(function (v, i) { return v - b[i]; }); }

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
    capture = { start: now + 1400, end: now + 3800, samples: [] };
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
      : 'Hold the button pose; gently turn your wrist…';
    if (timerText !== next) {
      timerText = next;
      if (host) host.querySelector('.pipette-cal__status').textContent = next;
    }
    if (now > capture.end + 260) finishCapture();
  }
  function finishCapture() {
    var samples = capture.samples; capture = null;
    if (samples.length < 6) {
      notice = 'Not enough usable thumb readings. Keep your thumb and wrist in view, then try again.';
      render(); return;
    }
    var pose = { thumb: centre(samples, 'thumb'), fingers: centre(samples, 'fingers'),
      shape: centre(samples, 'shape') };
    pose.noise = median(samples.map(function (s) { return distance(s.thumb, pose.thumb); }));
    if ((step === 0 && median(samples.map(function (s) { return s.bent; })) < 2) ||
        median(samples.map(function (s) { return s.extended; })) >= 3 || pose.noise > 0.08) {
      notice = 'Keep a normal closed grip and hold the button at one depth. Use smaller wrist turns during capture.';
      render(); return;
    }
    if (step > 0) {
      var minimum = Math.max(0.025, (poses[0].noise + pose.noise) * 4);
      if (distance(pose.thumb, poses[0].thumb) < minimum || distance(pose.shape, poses[0].shape) > 0.16) {
        notice = 'That press was not distinct from rest. Keep the thumb in view and recapture its full button travel in your normal grip.';
        render(); return;
      }
      if (step === 2 && distance(pose.thumb, poses[1].thumb) < Math.max(minimum, distance(poses[1].thumb, poses[0].thumb) * 0.45)) {
        notice = 'The two buttons look too similar. Show the separate ejector movement more clearly, then recapture.';
        render(); return;
      }
    }
    // Keep representative, non-outlier readings rather than only one angle's
    // centroid. Reject overlap with any previously captured button class.
    var usable = samples.filter(function (s) {
      return distance(s.thumb, pose.thumb) <= Math.max(0.018, pose.noise * 2.5) &&
        distance(s.shape, pose.shape) < 0.12;
    });
    pose.examples = [pose.thumb];
    for (var k = 0; k < Math.min(6, usable.length); k++) {
      pose.examples.push(usable[Math.floor(k * usable.length / Math.min(6, usable.length))].thumb);
    }
    var overlap = poses.some(function (other) {
      return pose.examples.some(function (a) {
        return nearest(a, other).d < Math.max(0.015, Math.max(pose.noise, other.noise) * 2);
      });
    });
    if (overlap) {
      notice = 'These button poses overlap at some angles. Recapture with smaller turns and a clear, consistent button depth.';
      render(); return;
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
      '<p class="pipette-cal__help">Use an empty pipette for setup. Use your normal vertical grip; keep your thumb and wrist in view. The camera reads thumb motion, not physical button contact.</p>' +
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
      : 'Capture three button poses. During each capture, gently turn through the angles used between reagents and strips.');
    host.querySelector('.pipette-cal__help').textContent = profile && step < 0
      ? 'Knuckles need not face the camera. Keep the thumb visible; recalibrate after changing hand or grip.'
      : 'Use an empty pipette for setup. Use your normal vertical grip; keep your thumb and wrist in view. The camera reads thumb motion, not physical button contact.';
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
