/* =============================================================================
 * handcontrol.js  —  The student's own hand on the bench, through the webcam.
 *
 * MediaPipe's hand landmarker turns a camera frame into 21 points.  This
 * module maps those points to the bench. With a real micropipette,
 * pipette-control.js learns the resting grip and both thumb-button poses:
 * release the plunger to aspirate, press to dispense, and use the separate
 * ejector over waste. A tracking pause cancels an uncommitted upstroke;
 * isolated missed frames keep the gesture pending for a fresh observation.
 *
 * Free-hand gestures for the other tools and the optional empty-hand mode:
 *
 *   CLOSE the hand over a tool     pick it up and carry it — the palm holds
 *                                  the barrel, as it does at a real bench
 *   OPEN the hand                  set the tool down where it is
 *   PRESS the thumb DOWN           the PLUNGER: draw, dispense, and each of
 *                                  the five mixing strokes
 *   HOLD the thumb OUT, press down the TIP EJECTOR, which on a micropipette
 *                                  is a second rod beside the plunger and is
 *                                  worked by a thumb held clear of the fingers
 *   PINCH, empty-handed            a click, for everything that is not a tool
 *
 * WHAT THIS MODULE IS NOT ALLOWED TO DO
 * It may not decide whether an action is legal.  engine.js is the single
 * authority on that and stays so: the hand AIMS (engine.aimAt) and the thumb
 * COMMITS (engine.evaluate → engine.perform), which are the same two calls the
 * mouse makes.  Every rule in the protocol — a fresh tip before the antigen,
 * five mixing strokes per well, the washes done with the transfer pipet — is
 * therefore identical whichever hand is on the bench.  Nothing about the
 * science is easier or harder in front of a camera.
 *
 * WHY THE DWELL IS OFF HERE
 * The mouse path acts when the pointer rests on a target for a moment.  A hand
 * held in the air is never still, and a hand that stops moving is usually a
 * student reading the bench rather than one asking for 50 µL.  So hovering
 * only ever highlights, and the thumb is the trigger — which is what the thumb
 * is for on the real instrument.
 *
 * WHERE MEDIAPIPE COMES FROM
 * vendor/mediapipe first, so a classroom with no internet still works; the
 * jsDelivr copy second, because a page opened straight off the disk as file://
 * cannot fetch its own .wasm and .task neighbours — the browser refuses them
 * as cross-origin — while it can fetch them from a CDN.  Between the two,
 * every way this page gets opened is covered.
 *
 * Exposed as  Lab.hand
 * ========================================================================== */
(function (Lab) {
  'use strict';

  /* --------------------------------------------------------------------- */
  /*  Where the model comes from                                            */
  /* --------------------------------------------------------------------- */
  var MP_VERSION = '0.10.17';        // the vendored copy; keep the two in step
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function localUrl(p) {
    try { return new URL(p, document.baseURI).href; } catch (e) { return p; }
  }

  function sources() {
    return [
      {
        bundle: localUrl('vendor/mediapipe/vision_bundle.mjs'),
        wasm: localUrl('vendor/mediapipe/wasm'),
        model: localUrl('vendor/mediapipe/models/hand_landmarker.task')
      },
      {
        bundle: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MP_VERSION + '/vision_bundle.mjs',
        wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MP_VERSION + '/wasm',
        model: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/' +
               'hand_landmarker/float16/1/hand_landmarker.task'
      }
    ];
  }

  /* import() is written through Function so that a browser too old to parse
     dynamic import fails HERE, at the call, rather than failing to parse this
     whole file and taking Lab.hand down with it.  Everything else on the
     bench keeps working; only the camera button reports that it cannot run. */
  var dynamicImport = null;
  try { dynamicImport = new Function('u', 'return import(u);'); } catch (e) { dynamicImport = null; }

  /* --------------------------------------------------------------------- */
  /*  Landmarks, and the geometry read off them                             */
  /*                                                                        */
  /*  MediaPipe numbers a hand 0–20: 0 is the wrist, then the thumb, index,  */
  /*  middle, ring and little fingers, four points each running from the     */
  /*  knuckle out to the tip.                                               */
  /* --------------------------------------------------------------------- */
  var WRIST = 0, THUMB_TIP = 4, INDEX_MCP = 5, INDEX_TIP = 8, MIDDLE_MCP = 9, PINKY_MCP = 17;
  var MCPS = [5, 9, 13, 17];
  var PALM = [0, 5, 9, 13, 17];
  var FINGERS = [
    { mcp: 5,  pip: 6,  tip: 8  },
    { mcp: 9,  pip: 10, tip: 12 },
    { mcp: 13, pip: 14, tip: 16 },
    { mcp: 17, pip: 18, tip: 20 }
  ];
  var BONES = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17]
  ];

  /* Grip/pinch use palm or finger size; thumb travel uses the 3D thumb
     chain in pipette-control.js, independent of the projected knuckle width. */
  var CURL_IN = 1.45;      // a finger counts as closed at this reach …
  var CURL_OUT = 1.75;     // … and opens again only well past it
  var GRIP_ON = 3;         // three closed fingers starts a grip
  var GRIP_OFF = 1;        // at most one closed finger rearms an empty hand

  /* A PRESS is the thumb travelling DOWN the palm, from up by the plunger to
     level with the knuckles.  It is measured that way — as travel along the
     palm — and not as "the thumb is near the index knuckle", which was the
     first thing tried and is wrong: a thumb held up beside a fist is only
     half a palm span from that knuckle, so a hand at rest read as a hand
     pressing and the pipette dispensed on its own. */
  var RISE_TRAVEL = 0.16;  // how far down the thumb travels to press
  var RISE_BACK = 0.55;    // of that travel, to come off the button again

  /* WHICH button that press was.  On a micropipette the plunger is on top of
     the barrel and the tip ejector is a second rod beside it, so the thumb
     that works the ejector is held OUT — away from the fingers — as it goes
     down.  Out is measured against this student's own resting thumb as well
     as against an absolute, because how wide a thumb sits is a fact about a
     person.  Anything not clearly out is the plunger: that is the button
     pressed ninety times in a run, and the ejector is pressed ten. */
  var SIDE_OUT = -0.38, SIDE_TRAVEL = 0.12;

  var PINCH_ON = 0.38, PINCH_OFF = 0.58;
  var MIN_SPAN = 0.035;    // below this the hand is too far away to read

  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function len(a) { return Math.sqrt(a.x * a.x + a.y * a.y); }
  function dist(a, b) { return len(sub(a, b)); }
  function unit(a) { var m = len(a) || 1e-6; return { x: a.x / m, y: a.y / m }; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function median(vals) {
    var s = vals.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /** A landmark in SQUARE units — camera x is stretched by the aspect ratio,
      or a distance across the frame would read shorter than the same distance
      down it and every threshold here would depend on the webcam. */
  function pt(lm, i, aspect) { return { x: lm[i].x * aspect, y: lm[i].y }; }

  /**
   * Everything the rest of this module needs to know about one hand.
   * Returns null when the reading cannot be trusted.
   */
  function readHand(lm, aspect, wasGripping, world) {
    if (!lm || lm.length < 21) return null;
    for (var i = 0; i < 21; i++) {
      if (!lm[i] || !isFinite(lm[i].x) || !isFinite(lm[i].y)) return null;
    }

    var physical = Lab.pipetteControl ? Lab.pipetteControl.measure(world) : null;
    var wrist = pt(lm, WRIST, aspect);
    var span = median(MCPS.map(function (k) { return dist(wrist, pt(lm, k, aspect)); }));
    if (span < MIN_SPAN) return null;

    var indexMcp = pt(lm, INDEX_MCP, aspect);
    var thumb = pt(lm, THUMB_TIP, aspect);

    /* A finger is curled when its tip has come back toward its own knuckle.
       Measured against the first bone of that same finger rather than against
       the palm, which makes it true of a long hand and a small one alike. */
    var edge = wasGripping ? CURL_OUT : CURL_IN;
    var curled = 0, extended = 0;
    var hasWorld = world && world.length === 21 && world.every(function (p) {
      return p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
    });
    hasWorld = hasWorld && Math.hypot(world[0].x - world[9].x, world[0].y - world[9].y, world[0].z - world[9].z) > 0.00001;
    function fingerPoint(i) {
      if (hasWorld) return world[i];
      var p = pt(lm, i, aspect); p.z = 0; return p;
    }
    function length3(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
    for (var f = 0; f < FINGERS.length; f++) {
      var mcp = fingerPoint(FINGERS[f].mcp);
      var pip = fingerPoint(FINGERS[f].pip);
      var tip = fingerPoint(FINGERS[f].tip);
      var bone = length3(pip, mcp) || 1e-6;
      var reachRatio = length3(tip, mcp) / bone;
      if (reachRatio < edge) curled++;
      var alignment = ((pip.x - mcp.x) * (tip.x - pip.x) +
        (pip.y - mcp.y) * (tip.y - pip.y) + (pip.z - mcp.z) * (tip.z - pip.z)) /
        (bone * (length3(tip, pip) || 1e-6));
      // Losing a curl reading is not the same as opening a hand. Require
      // visibly extended fingers before releasing a latched instrument.
      if (reachRatio > CURL_OUT && alignment > 0.45) extended++;
    }

    /* The point the hand IS at: the palm centre, deliberately not a fingertip
       — what carries a tool must not shift when the fingers close around it.
       Left in raw normalised camera units; the mapping onto the page happens
       once, in toViewport(). */
    var cx = 0, cy = 0;
    for (var p = 0; p < PALM.length; p++) { cx += lm[PALM[p]].x; cy += lm[PALM[p]].y; }

    return {
      nx: cx / PALM.length,
      ny: cy / PALM.length,
      span: span,
      curled: curled,
      extended: extended,
      // World-space radial thumb travel: turning the fist must not masquerade
      // as a plunger stroke. No 2D fallback when thumb geometry is invalid.
      rise: physical ? physical.rise : null,
      physical: physical,
      thumbReady: !!physical,
      // Optional world-space outward direction, used only for the ejector.
      side: physical ? physical.side : null,
      // plain distance to the index knuckle — not used for either button,
      // kept because it is the number to look at when a hand will not read
      tuck: dist(thumb, indexMcp) / span,
      pinch: dist(thumb, pt(lm, INDEX_TIP, aspect)) / span
    };
  }

  /* --------------------------------------------------------------------- */
  /*  Camera units → the page                                               */
  /* --------------------------------------------------------------------- */
  /* A hand cannot be held at the very edge of the picture — it stops being
     tracked there — so the middle of the frame is stretched to cover the
     whole page.  Without this the outer wells are unreachable. */
  var EDGE_X = 0.13, EDGE_Y = 0.10;

  function expand(v, margin) {
    var span = 1 - margin * 2;
    return span <= 0 ? clamp01(v) : clamp01((v - margin) / span);
  }

  function toViewport(nx, ny) {
    var d = document.documentElement;
    return {
      // mirrored, because the student is looking at themselves: moving the
      // real hand to the right has to move the tool to the right
      x: expand(clamp01(1 - nx), EDGE_X) * (d.clientWidth || window.innerWidth || 1),
      y: expand(clamp01(ny), EDGE_Y) * (d.clientHeight || window.innerHeight || 1)
    };
  }

  /* ----- the 1€ filter ---------------------------------------------------
     A raw landmark jitters by a few pixels even from a hand held still, and a
     few pixels is most of a well.  The 1€ filter smooths hard while the hand
     is slow — which is when the student is aiming — and lets go while it is
     fast, which is when they are only travelling.  So it costs no lag at the
     one moment lag would be felt. */
  var FILTER = { minCutoff: 2.8, beta: 7.0, dCutoff: 1.5 };

  function alphaFor(cutoff, dt) {
    var tau = 1 / (2 * Math.PI * Math.max(0.0001, cutoff));
    return 1 / (1 + tau / dt);
  }

  function Axis() { this.ready = false; }
  Axis.prototype.next = function (value, tMs) {
    if (!this.ready || tMs <= this.t || tMs - this.t > 250) {
      this.ready = true; this.t = tMs; this.raw = value; this.out = value; this.dv = 0;
      return value;
    }
    var dt = Math.min(0.1, Math.max(1 / 240, (tMs - this.t) / 1000));
    var dv = (value - this.raw) / dt;
    this.dv += (dv - this.dv) * alphaFor(FILTER.dCutoff, dt);
    var a = alphaFor(FILTER.minCutoff + FILTER.beta * Math.abs(this.dv), dt);
    this.out += (value - this.out) * a;
    this.raw = value; this.t = tMs;
    return this.out;
  };

  /* Time, rather than frame count: a grip should feel the same on a slow
     laptop and a fast camera. Release takes longer than pickup so a momentary
     finger occlusion cannot set an instrument down. */
  function Gate(onMs, offMs) {
    this.onMs = onMs; this.offMs = offMs || onMs; this.reset();
  }
  Gate.prototype.reset = function (on) { this.on = !!on; this.since = null; };
  Gate.prototype.set = function (raw, stamp) {
    if (raw === this.on) { this.since = null; return 0; }
    if (this.since === null) { this.since = stamp; return 0; }
    if (stamp - this.since < (raw ? this.onMs : this.offMs)) return 0;
    this.since = null; this.on = raw;
    return raw ? 1 : -1;
  };

  /* --------------------------------------------------------------------- */
  /*  State                                                                 */
  /* --------------------------------------------------------------------- */
  var S = {
    mode: 'off',            // off | starting | loading | live | error
    held: null,             // the tool this hand is carrying, if any
    last: null,             // where the hand was on the previous frame
    lostAt: null,           // freeze immediately; set down after a short grace
    armed: false,           // an open hand is required after tracking restarts
    dragging: null,         // a caption/panel moved by an empty-handed pinch
    anchor: null,           // palm's attachment point within a carried tool
    lit: null               // which row of the legend is lit
  };

  var grip = new Gate(60, 220), press = new Gate(60, 80), pinch = new Gate(60, 120);
  var neutral = new Gate(80);
  var ax = new Axis(), ay = new Axis();
  var restRise = 0;              // measured off this hand, once it holds a tool
  var restSide = null;
  var pressKind = 'press';       // which button the thumb went down on
  var realPickup = new Gate(450), realPress = new Gate(55, 65), realRest = new Gate(90);
  var realReading = null, realKind = 'press', realNeedsRest = true;
  var realCycle = null, realPickupLock = false, realUnknownAt = null;
  var freeNeedsRest = false, freeRest = new Gate(90), ejectReady = new Gate(120);
  var thumbSmooth = null, thumbStamp = 0, thumbTracked = false;
  var lastMove = 0;              // stamp of the previous carried frame
  var settleUntil = 0;
  var LOST_GRACE = 1800;
  var GESTURE_GAP = 100;         // isolated misses may bridge a pending gesture
  var steadyUntil = 0;           // a brief action pulse, never a held-thumb lock
  var cursorMap = null;
  var session = 0;

  var landmarker = null;     // kept between sessions: rebuilding costs seconds
  var modelPending = null;
  var detectorWorker = null, workerStarting = null, workerReady = false;
  var workerFailed = false, fallbackPending = false;
  var inFlight = null, capturePending = false, captureStarted = 0, captureId = 0, frameId = 0;
  var lastResultAt = 0, nextMainFrame = 0;
  var runtime = { backend: 'off', delegate: null, frames: 0, fps: 0, inferenceMs: 0, resultAgeMs: 0, skippedFrames: 0 };
  var rateStarted = 0, rateFrames = 0;
  var stream = null, video = null, raf = 0;
  var lastVideoTime = -1, lastStamp = 0;
  var aspect = 4 / 3;        // of the camera picture, for un-squashing landmarks
  var toggleBtn = null;
  var els = {};              // the panel's parts
  var paint = {};            // token colours resolved for the canvas
  var paintWired = false;
  var aimReading = null;

  function attribute(el, name, value) {
    value = String(value);
    if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  }

  /* A carried tool is moved with pointer acceleration, for the same reason a
     mouse has it: a SLOW hand is aiming and wants less than 1:1, because the
     whole page is reachable in about 25 cm of real movement and 1:1 puts a
     well's width inside the tremor of a held-up arm — while a FAST hand is
     travelling and wants more than 1:1, or the far end of the bench cannot be
     reached at all without opening the hand, moving it back and closing it
     again.  A flat gain cannot be both: measured at a flat 0.72, the reagent
     tubes along the top of the shelf were out of reach of a hand that had
     started at the bottom of the bench, and stopped 34 px short. */
  var CARRY_SLOW = 0.78, CARRY_FAST = 1.5;
  var CARRY_SLOW_PX = 2, CARRY_FAST_PX = 18;      // per 33 ms, i.e. per camera frame

  function carryGain(dx, dy, dt) {
    var speed = Math.sqrt(dx * dx + dy * dy) * (33 / Math.max(8, Math.min(120, dt)));
    var t = (speed - CARRY_SLOW_PX) / (CARRY_FAST_PX - CARRY_SLOW_PX);
    return CARRY_SLOW + (CARRY_FAST - CARRY_SLOW) * clamp01(t);
  }

  /* --------------------------------------------------------------------- */
  /*  Turning it on and off                                                 */
  /* --------------------------------------------------------------------- */
  function start() {
    if (S.mode !== 'off' && S.mode !== 'error') return;
    if (!dynamicImport) { buildPanel(); fail('This browser is too old to load the hand model.'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      buildPanel();
      fail('This browser will not open a camera from this page.');
      return;
    }
    buildPanel();
    var run = ++session;
    setMode('starting', 'Asking for the camera…');

    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 }, facingMode: 'user' },
      audio: false
    }).then(function (s) {
      /* Switched off while the permission prompt was still up.  The stream
         arrives anyway, and a stream nobody stops is a camera light left on
         in a classroom. */
      if (run !== session || S.mode === 'off' || !video) {
        s.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
        return null;
      }
      stream = s;
      video.srcObject = s;
      return video.play();
    }).then(function () {
      if (run !== session || S.mode === 'off') return null;
      if (landmarker || workerReady) return null;
      setMode('loading', 'Loading the hand model — this happens once.');
      return buildDetector();
    }).then(function () {
      if (run !== session || S.mode === 'off') return;
      setMode('live', 'Hold your hand up to the camera.');
      lastVideoTime = -1;
      lastResultAt = performance.now();
      rateStarted = lastResultAt; rateFrames = 0;
      raf = requestAnimationFrame(tick);
    })['catch'](function (err) {
      if (run !== session) return;
      stopCamera();
      fail(reasonFor(err));
    });
  }

  function stop() {
    if (S.mode === 'off') return;
    session++;
    releaseTool();
    endDrag();
    stopCamera();
    if (Lab.engine && Lab.engine.clearHighlight) Lab.engine.clearHighlight();
    setMode('off', '');
    removePanel();
  }

  function stopCamera() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (stream) {
      stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      stream = null;
    }
    if (video) { try { video.srcObject = null; } catch (e) {} }
    grip.reset(); press.reset(); pinch.reset(); neutral.reset();
    resetRealPress(); realPickupLock = false;
    S.last = null; S.lostAt = null; S.armed = false;
    lastReach = { id: null, at: -1e9, point: null };
    cursorMap = null;
    captureId++; capturePending = false; steadyUntil = 0;
    ax = new Axis(); ay = new Axis();
  }

  function toggle() { if (S.mode === 'off' || S.mode === 'error') start(); else stop(); }

  /** The landmarker: from the vendored copy if it can be read, from the CDN
      if it cannot, on the GPU if this machine has a usable one and on the CPU
      if it does not.  Four attempts, first one wins. */
  function detectorPlans() {
    var plans = [];
    var candidates = sources();
    if (location.protocol === 'file:') candidates = candidates.slice(1);
    candidates.forEach(function (src) {
      plans.push({ src: src, delegate: 'GPU' });
      plans.push({ src: src, delegate: 'CPU' });
    });
    return plans;
  }

  function detectorOptions() {
    return { numHands: 1, runningMode: 'VIDEO', minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 };
  }

  function buildDetector() {
    if (!workerFailed && window.Worker && window.OffscreenCanvas && window.createImageBitmap) {
      return buildWorker()['catch'](function () {
        workerFailed = true;
        return buildLandmarker();
      });
    }
    return buildLandmarker();
  }

  function buildWorker() {
    if (workerReady) return Promise.resolve();
    if (workerStarting) return workerStarting;
    workerStarting = new Promise(function (resolve, reject) {
      var worker, blobUrl = null;
      function releaseUrl() { if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; } }
      try {
        if (location.protocol === 'file:' && Lab.handWorkerSource) {
          blobUrl = URL.createObjectURL(new Blob([Lab.handWorkerSource], { type: 'text/javascript' }));
        }
        worker = new Worker(blobUrl || localUrl('js/hand-worker.js?v=4'));
      } catch (err) { releaseUrl(); reject(err); return; }
      detectorWorker = worker;
      var timer = setTimeout(function () { failure(new Error('Hand model startup timed out.')); }, 20000);
      function failure(err) {
        if (worker !== detectorWorker) return;
        releaseUrl();
        clearTimeout(timer);
        if (!workerReady) {
          worker.terminate(); detectorWorker = null; reject(err);
        } else fallbackToMain();
      }
      worker.onerror = function (event) { event.preventDefault(); failure(new Error(event.message)); };
      worker.onmessage = function (event) {
        if (worker !== detectorWorker) return;
        var msg = event.data;
        if (msg.type === 'ready') {
          releaseUrl();
          clearTimeout(timer); workerReady = true;
          runtime.backend = 'worker'; runtime.delegate = msg.delegate;
          resolve(); return;
        }
        if (msg.type === 'error') { failure(new Error(msg.message)); return; }
        if (!inFlight || msg.id !== inFlight.id) return;
        var frame = inFlight; inFlight = null;
        if (frame.run !== session || S.mode !== 'live') return;
        if (msg.type === 'frame-error') { fallbackToMain(); return; }
        if (msg.type === 'result') receiveResult(msg, frame.stamp, frame.aspect, msg.inferenceMs);
      };
      worker.postMessage({ type: 'init', plans: detectorPlans(), options: detectorOptions() });
    }).then(function () { workerStarting = null; }, function (err) { workerStarting = null; throw err; });
    return workerStarting;
  }

  function fallbackToMain() {
    if (fallbackPending) return;
    workerFailed = true; workerReady = false;
    if (detectorWorker) detectorWorker.terminate();
    detectorWorker = null; inFlight = null;
    captureId++; capturePending = false;
    fallbackPending = true;
    onHandLost(performance.now(), true);
    buildLandmarker(true).then(function () {
      fallbackPending = false;
      if (S.mode === 'live') lastResultAt = performance.now();
    })['catch'](function (err) {
      fallbackPending = false;
      if (S.mode === 'off') return;
      releaseTool(); endDrag(); stopCamera(); fail(reasonFor(err));
    });
  }

  function buildLandmarker(preferCpu) {
    if (landmarker) return Promise.resolve(landmarker);
    if (modelPending) return modelPending;
    var plans = detectorPlans();
    if (preferCpu) plans = plans.filter(function (p) { return p.delegate === 'CPU'; })
      .concat(plans.filter(function (p) { return p.delegate !== 'CPU'; }));
    var attempt = 0;

    function next(err) {
      if (attempt >= plans.length) throw (err || new Error('no hand model'));
      var plan = plans[attempt++];
      return dynamicImport(plan.src.bundle).then(function (mp) {
        return mp.FilesetResolver.forVisionTasks(plan.src.wasm).then(function (fileset) {
          return mp.HandLandmarker.createFromOptions(fileset, Object.assign(detectorOptions(), {
            baseOptions: { modelAssetPath: plan.src.model, delegate: plan.delegate }
          }));
        });
      }).then(function (made) {
        landmarker = made;
        runtime.backend = 'main'; runtime.delegate = plan.delegate;
        return made;
      })['catch'](next);
    }
    modelPending = next(null).then(function (made) {
      modelPending = null;
      return made;
    }, function (err) {
      modelPending = null;
      throw err;
    });
    return modelPending;
  }

  function reasonFor(err) {
    var name = (err && err.name) || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return 'The camera was blocked. Allow it in the address bar, then switch this back on.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'No camera found on this computer.';
    }
    if (name === 'NotReadableError') return 'The camera is already in use by another program.';
    if (location.protocol === 'file:') {
      return 'The hand model would not load into a page opened as a file. ' +
             'Serve this folder over http, or be online the first time.';
    }
    return 'The hand model would not load. Check the connection and try again.';
  }

  function fail(message) {
    setMode('error', message);
    if (Lab.ui && Lab.ui.flash) Lab.ui.flash(message);
  }

  /* --------------------------------------------------------------------- */
  /*  The frame loop                                                        */
  /* --------------------------------------------------------------------- */
  function tick() {
    raf = requestAnimationFrame(tick);
    if (S.mode !== 'live' || !video) return;
    var now = performance.now();
    if (Lab.pipetteControl) Lab.pipetteControl.tick(now);
    if (now - lastResultAt > 250) onHandLost(now, true);
    if (capturePending && now - captureStarted > 1000) { fallbackToMain(); return; }
    if (inFlight && now - inFlight.stamp > 4000) { fallbackToMain(); return; }
    if (video.readyState < 2 || !video.videoWidth || video.currentTime === lastVideoTime) {
      return;
    }
    if (workerReady) {
      if (!inFlight && !capturePending) sendFrame(now);
      return;
    }
    if (!landmarker || fallbackPending || now < nextMainFrame) return;
    lastVideoTime = video.currentTime;

    // detectForVideo insists on a timestamp that always moves forward
    var stamp = Math.max(lastStamp + 1, Math.round(performance.now()));
    lastStamp = stamp;

    var result;
    try { result = landmarker.detectForVideo(video, stamp); }
    catch (e) { onHandLost(stamp, true); return; }
    var elapsed = performance.now() - stamp;
    // A browser without worker support still gets time to paint and accept
    // input between synchronous detections. It never builds a frame backlog.
    nextMainFrame = performance.now() + Math.max(8, Math.min(35, elapsed * 0.35));
    receiveResult(result, stamp, video.videoWidth / video.videoHeight, elapsed);
  }

  function sendFrame(stamp) {
    var run = session, ticket = ++captureId;
    var worker = detectorWorker;
    var ratio = video.videoWidth / video.videoHeight;
    var width = Math.min(640, video.videoWidth), height = Math.round(width / ratio);
    lastVideoTime = video.currentTime;
    capturePending = true;
    captureStarted = stamp;
    createImageBitmap(video, { resizeWidth: width, resizeHeight: height, resizeQuality: 'low' }).then(function (bitmap) {
      if (ticket !== captureId || run !== session || worker !== detectorWorker || S.mode !== 'live') {
        bitmap.close(); return;
      }
      capturePending = false;
      if (performance.now() - stamp > 180) { bitmap.close(); runtime.skippedFrames++; return; }
      inFlight = { id: ++frameId, run: run, stamp: stamp, aspect: ratio };
      try {
        worker.postMessage({ type: 'frame', id: inFlight.id, run: run, stamp: stamp, bitmap: bitmap }, [bitmap]);
      } catch (err) { bitmap.close(); fallbackToMain(); }
    })['catch'](function () {
      if (ticket !== captureId || run !== session) return;
      capturePending = false; fallbackToMain();
    });
  }

  function receiveResult(result, stamp, frameAspect, inferenceMs) {
    var now = performance.now();
    lastResultAt = now;
    runtime.frames++; rateFrames++;
    runtime.inferenceMs = Math.round(inferenceMs);
    runtime.resultAgeMs = Math.round(now - stamp);
    if (now - rateStarted >= 1000) {
      runtime.fps = Math.round(rateFrames * 1000 / (now - rateStarted));
      rateFrames = 0; rateStarted = now;
    }
    // Warmup or a busy device can deliver an old frame. It must never move
    // an object or fire a gesture seconds after that gesture happened.
    if (now - stamp > 250) { runtime.skippedFrames++; onHandLost(now, true); return; }
    if (aspect !== frameAspect) {
      aspect = frameAspect;
      if (els.panel) els.panel.style.setProperty('--camera-ratio', aspect);
    }
    var lm = result && result.landmarks && result.landmarks[0];
    drawPreview(lm);
    var hand = lm ? readHand(lm, aspect, grip.on, result.worldLandmarks && result.worldLandmarks[0]) : null;
    if (!hand) { onHandLost(stamp); return; }
    if (Lab.pipetteControl) {
      Lab.pipetteControl.observe(hand.physical, stamp);
    }
    if (S.lostAt !== null) {
      var resumed = mapCursor(toViewport(hand.nx, hand.ny));
      var gap = stamp - S.lostAt;
      var brief = gap < 160 && S.last && dist(resumed, S.last) < 100;
      // Check here too: the next result may arrive after the grace without
      // any intervening missing frame to cancel the old gesture.
      if (!brief || gap >= GESTURE_GAP) cancelPendingGestures();
      if (!brief) {
        // Larger gaps rebase at the parked instrument. Single missed frames
        // keep their movement reference instead of swallowing the next move.
        S.last = null; ax = new Axis(); ay = new Axis(); press.since = null;
        if (!S.held) { press.reset(); restRise = hand.rise; restSide = hand.side; }
        settleUntil = stamp + 110;
      }
      S.lostAt = null;
    }
    onHand(lm, hand, stamp);
  }

  function cancelPendingGestures() {
    // Keep committed free-hand presses latched until the thumb comes up, so
    // resuming with it still down cannot repeat an action. A real upstroke
    // needs a fresh rest/press/release sequence after an actual tracking pause.
    grip.since = null; press.since = null; pinch.since = null;
    neutral.reset(); resetRealPress();
    freeNeedsRest = true; freeRest.reset(); ejectReady.reset(); thumbSmooth = null;
    lastReach = { id: null, at: -1e9, point: null };
  }

  function onHandLost(stamp, interrupted) {
    thumbTracked = false;
    if (S.lostAt === null) S.lostAt = stamp;
    // Resetting on every single miss starves both button gates: intermittent
    // detections can carry the tool, yet never finish a press or release.
    // Preserve intent briefly; only onHand with fresh landmarks can commit it.
    // A stalled/failed detector or a stale result still cancels immediately.
    if (interrupted || stamp - S.lostAt >= GESTURE_GAP) cancelPendingGestures();
    // One missed camera frame should not flash the whole hand into a paused
    // state. Movement already waits for fresh landmarks; show a pause only
    // when the gap is long enough to matter to the person holding the tool.
    if (stamp - S.lostAt < 120) return;
    markReach(null);
    if (Lab.engine) Lab.engine.clearHighlight();
    if (els.glove) els.glove.classList.add('is-lost');
    if (els.panel) attribute(els.panel, 'data-tracking', 'lost');
    if (stamp - S.lostAt < LOST_GRACE) {
      say(S.held || S.dragging ? 'Tracking paused — hold your hand in view.' : 'Looking for your hand…');
      return;
    }
    if (S.held) {
      releaseTool();
      say('Lost your hand — the tool is back on the bench.');
    } else if (S.mode === 'live') {
      say('Hold your hand up to the camera.');
    }
    endDrag();
    grip.reset(); press.reset(); pinch.reset();
    neutral.reset();
    S.armed = false;
    S.last = null;
    light(null);
    hideGlove();
  }

  function onHand(lm, h, stamp) {
    var rawPoint = toViewport(ax.next(h.nx, stamp), ay.next(h.ny, stamp));
    var point = mapCursor(rawPoint);
    point.x = Math.max(1, Math.min(document.documentElement.clientWidth - 1, point.x));
    point.y = Math.max(1, Math.min(document.documentElement.clientHeight - 1, point.y));
    if (els.panel) attribute(els.panel, 'data-tracking', 'tracked');
    var control = Lab.pipetteControl;
    var realContext = control && control.enabled() && (S.held === 'pipette' || wantedTool() === 'pipette');
    realReading = control ? control.classify(h.physical, S.held === 'pipette') : null;
    thumbTracked = h.thumbReady;
    if (control && control.calibrating()) {
      S.last = point; lastMove = stamp;
      say('Follow the three grip captures below.');
      drawGlove(lm, h, point, null, stamp); return;
    }
    if (realContext && !control.ready()) {
      S.last = point; lastMove = stamp;
      say('Calibrate your real micropipette below, or choose free-hand gestures.');
      drawGlove(lm, h, point, null, stamp); return;
    }
    if (!S.armed) {
      if (realContext && realReading.holding && realReading.button === 'rest') S.armed = true;
      else if (!realContext && neutral.set(h.curled <= GRIP_OFF && h.pinch > PINCH_OFF, stamp) === 1) S.armed = true;
      else {
        S.last = point; lastMove = stamp;
        say(realContext ? 'Hold your calibrated grip with both buttons released.' : 'Show an open hand to begin.');
        drawGlove(lm, h, point, null, stamp);
        return;
      }
    }
    if (Lab.tools.active() && Lab.tools.owner() !== 'hand') {
      // Mouse ownership wins, including a drag of the same instrument.
      // Keep camera frames out of its target highlight and dwell timer.
      if (S.held) { S.held = null; S.anchor = null; }
      resetRealPress();
      endDrag(); press.reset(); pinch.reset(); grip.reset(); neutral.reset();
      S.armed = false; S.last = null;
      hideGlove();
      say('Mouse control — show an open hand when you are ready.');
      return;
    }
    var near = S.held || S.dragging ? null : toolUnder(point);
    if (near !== 'pipette' && !S.held) realPickupLock = false;
    if (near && !grip.on && h.curled < GRIP_ON) {
      lastReach = { id: near, at: stamp, point: { x: point.x, y: point.y } };
    }

    /* ---- the palm: grip, carry, set down ------------------------------- */
    var gripping = grip.on ? h.extended < 3 : h.curled >= GRIP_ON;
    var gripChange = realContext && !S.held ? 0 : grip.set(gripping, stamp);
    if (realContext && !S.held) {
      var canPick = !realPickupLock && near === 'pipette' && realReading.holding && realReading.button === 'rest';
      if (realPickup.set(canPick, stamp) === 1) {
        takeTool('pipette', stamp, point, h);
        if (S.held) grip.reset(true);
      }
    } else realPickup.reset();
    if (!realContext && gripChange === 1 && !S.dragging) takeTool(near, stamp, point, h);
    else if (gripChange === -1 && S.held) {
      // Continue from the drawn palm after release, even after acceleration
      // or reaching a bench edge. There is no cursor jump on opening.
      var placed = heldPalm();
      releaseTool();
      if (placed) {
        cursorMap = { raw: rawPoint, shown: placed };
        point = placed;
      }
      near = null;
    }

    if (S.held) {
      var heldEl = Lab.tools.elementOf(S.held);
      if (!heldEl || heldEl.classList.contains('tool-stowed')) {
        /* The protocol has moved on and stations.js has put this tool away —
           only the tool a step actually uses is on the bench.  A stowed tool
           is invisible and can do nothing, so it cannot stay in the hand. */
        releaseTool();
      } else if (Lab.tools.active() !== S.held || Lab.tools.owner() !== 'hand') {
        releaseTool();                         // the mouse took it out of this hand
      } else if (S.last && performance.now() >= steadyUntil) {
        var dx = point.x - S.last.x, dy = point.y - S.last.y;
        var gain = carryGain(dx, dy, stamp - lastMove);
        Lab.tools.moveBy(S.held, dx * gain, dy * gain);
      }
    }

    /* ---- the thumb: one movement, two buttons ---------------------------
       The press is the thumb travelling down the palm.  WHICH button it
       pressed is decided once, at the moment it goes down, by whether the
       thumb was held out to its own side — so the two can never fire at the
       same time, and a press that is only half-way out is the plunger rather
       than nothing at all.

       Both the rest position and how far out "out" is are measured off this
       student's own hand while the thumb is up, because both are facts about
       a person rather than about the gesture. */
    if (S.held === 'pipette' && realContext) {
      pinch.reset(); press.reset();
      updateRealButtons(realReading, stamp);
    } else if (S.held) {
      pinch.reset();
      updateFreeButtons(h, stamp);
    } else if (!grip.on && !realContext) {
      press.reset();
      restRise = h.rise; restSide = null;
      var pinchChange = pinch.set(h.pinch < (pinch.on ? PINCH_OFF : PINCH_ON), stamp);
      if (pinchChange === 1) {
        S.dragging = Lab.reposition && Lab.reposition.beginAt(point);
        if (!S.dragging) onPinch(point);
        S.last = point;
      } else if (pinchChange === -1) endDrag();
      if (S.dragging && S.last) S.dragging.moveBy(point.x - S.last.x, point.y - S.last.y);
    } else {
      // a hand closed on nothing: no thumb means anything until it holds one
      press.reset(); pinch.reset(); endDrag();
    }

    S.last = point; lastMove = stamp;
    if (S.mode !== 'live') return; // a pinch may have switched hand control off
    if (S.dragging) say('Moving the caption — separate your fingers to place it.');
    else aim(point, near);
    light(S.held ? (grip.since !== null ? 'open' : realContext && realPress.on ? realKind : press.on ? pressKind : 'grip') : (pinch.on ? 'click' : null));
    markReach(S.held ? null : near);
    drawGlove(lm, h, heldPalm() || point, near, stamp);
  }

  function updateFreeButtons(h, stamp) {
    if (!h.thumbReady || !Number.isFinite(h.rise)) {
      press.since = null; freeNeedsRest = true; freeRest.reset();
      ejectReady.reset(); thumbSmooth = null;
      return;
    }
    var dt = Math.max(1, Math.min(100, stamp - thumbStamp));
    thumbSmooth = thumbSmooth === null ? h.rise
      : thumbSmooth + (h.rise - thumbSmooth) * (1 - Math.exp(-dt / 35));
    thumbStamp = stamp;
    var rise = thumbSmooth;
    if (!Number.isFinite(restRise)) {
      // Pickup may precede the first usable thumb reading. Establish only a
      // baseline here; no button edge can be emitted from that first pose.
      restRise = rise; restSide = h.side; freeNeedsRest = false;
      settleUntil = stamp + 180; press.reset(); freeRest.reset(); return;
    }
    if (freeNeedsRest) {
      // Preserve the old release reference across occlusion. Re-learning a
      // resting pose from a still-depressed thumb could generate a new press.
      if (Number.isFinite(restRise) && freeRest.set(rise >= restRise - RISE_TRAVEL * 0.45, stamp) === 1) {
        freeNeedsRest = false; freeRest.reset(); press.reset();
        restRise = rise; restSide = h.side;
      }
      return;
    }
    if (stamp < settleUntil || !Number.isFinite(restRise)) {
      restRise = rise; restSide = h.side; press.reset(); ejectReady.reset(); return;
    }
    if (!press.on && press.since === null) {
      // Do not let the baseline follow a slow press down. Only small resting
      // drift is adapted, with time-based smoothing independent of frame rate.
      if (rise > restRise) restRise = rise;
      else if (restRise - rise < 0.04) restRise += (rise - restRise) * (1 - Math.exp(-dt / 2000));
    }
    var out = h.side !== null && restSide !== null &&
      h.side < Math.min(SIDE_OUT, restSide - SIDE_TRAVEL);
    if (!press.on && rise > restRise - RISE_TRAVEL * 0.45) {
      ejectReady.set(out, stamp);
      if (!out && h.side !== null) restSide = restSide === null ? h.side : restSide + (h.side - restSide) * 0.03;
    }
    var trip = restRise - RISE_TRAVEL;
    var down = press.on ? rise < trip + RISE_TRAVEL * RISE_BACK : rise < trip;
    if (press.set(down, stamp) === 1) {
      // An ejector needs a deliberate outward preparation, not one bad frame
      // at the bottom of a normal plunger stroke.
      pressKind = ejectReady.on && out && S.held === 'pipette' ? 'eject' : 'press';
      ejectReady.reset();
      if (pressKind === 'eject') onEject(); else onPlunger();
    }
  }

  function endDrag() {
    if (S.dragging) S.dragging.end();
    S.dragging = null;
  }

  // Preserve the release point while keeping both screen edges reachable.
  // A constant offset would strand the opposite side of the bench.
  function mapCursor(raw) {
    if (!cursorMap) return { x: raw.x, y: raw.y };
    function axis(value, from, to, size) {
      to = Math.max(1, Math.min(size - 1, to));
      return value <= from ? value * to / Math.max(1, from)
        : to + (value - from) * (size - to) / Math.max(1, size - from);
    }
    return {
      x: axis(raw.x, cursorMap.raw.x, cursorMap.shown.x, document.documentElement.clientWidth),
      y: axis(raw.y, cursorMap.raw.y, cursorMap.shown.y, document.documentElement.clientHeight)
    };
  }

  function heldPalm() {
    if (!S.held || !S.anchor) return null;
    var el = Lab.tools.elementOf(S.held);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { x: r.left + S.anchor.x, y: r.top + S.anchor.y };
  }

  /* --------------------------------------------------------------------- */
  /*  Picking a tool up                                                     */
  /* --------------------------------------------------------------------- */
  /* Generous, because a camera is not a mouse — but not so generous that
     closing your hand in mid-air lifts something from across the bench.

     The tool THIS STEP needs gets the wider circle.  When more than one is
     out, the one the protocol is asking for is overwhelmingly the one being
     reached for, and there is no reason to make a student prove that to the
     pixel; the narrower circle stops the other tools being swept up with it. */
  var REACH = 54, REACH_WANTED = 90;

  /* A hand does not stop moving at the instant it closes.  It drifts as the
     fingers come in — and the grip itself must remain steady briefly,
     by which time the palm has moved again.  So the tool the OPEN hand was
     last over is remembered for a moment, and closing the hand takes THAT.
     Without it the grab misses what the student was plainly reaching for,
     which reads as the camera being inaccurate when it is only being
     literal about the frame the fingers happened to finish on. */
  var REACH_MEMORY = 400;                         // ms
  var lastReach = { id: null, at: -1e9, point: null };
  var reachEl = null;

  function wantedTool() {
    try { return Lab.engine.toolFor(Lab.state.S.phase); } catch (e) { return null; }
  }

  /** The element of a tool that is actually on the bench right now. */
  function grabbable(id) {
    var el = Lab.tools.elementOf(id);
    if (!el || el.classList.contains('tool-stowed')) return null;
    return el.getBoundingClientRect().width > 0 ? el : null;
  }

  function toolUnder(point) {
    var top = document.elementFromPoint(point.x, point.y);
    if (top && top.closest('.handpanel')) return null;
    var want = wantedTool();
    var best = null, bestScore = Infinity;
    ['pipette', 'transfer', 'marker'].forEach(function (id) {
      var el = grabbable(id);
      if (!el) return;
      var r = el.getBoundingClientRect();
      var dx = Math.max(r.left - point.x, 0, point.x - r.right);
      var dy = Math.max(r.top - point.y, 0, point.y - r.bottom);
      var d = Math.sqrt(dx * dx + dy * dy);
      var limit = id === want ? REACH_WANTED : REACH;
      if (d > limit) return;
      /* Scored as a fraction of its own circle, so being barely inside the
         wide one never beats being dead on the narrow one. */
      var score = d / limit;
      if (score < bestScore) { bestScore = score; best = id; }
    });
    return best;
  }

  /** Outline the tool that closing the hand would pick up.  Answering "which
      one?" on the tool itself is worth more than any amount of precision in
      the pointer: the student stops guessing and simply closes their hand. */
  function markReach(id) {
    var el = id ? Lab.tools.elementOf(id) : null;
    if (el === reachEl) return;
    if (reachEl) reachEl.classList.remove('tool-reach');
    reachEl = el;
    if (reachEl) reachEl.classList.add('tool-reach');
  }

  function takeTool(near, stamp, point, h) {
    if (S.held || Lab.state.S.busy) return;
    if (Lab.tools.active()) return;             // the mouse is already holding one
    var id = near;
    if (!id && lastReach.id && stamp - lastReach.at < REACH_MEMORY &&
        lastReach.point && dist(point, lastReach.point) <= 64) id = lastReach.id;
    if (id && !grabbable(id)) id = null;        // stowed or gone since
    if (!id) { say(reachNote()); return; }
    if (!Lab.tools.grab(id, 'hand')) return;
    S.held = id;
    var r = Lab.tools.elementOf(id).getBoundingClientRect();
    S.anchor = { x: r.width / 2, y: r.height * 0.42 };
    S.last = point; // pickup itself must not move the object
    restRise = h.rise; restSide = h.side;
    settleUntil = stamp + 180;
    press.reset(); freeNeedsRest = false; freeRest.reset(); ejectReady.reset();
    thumbSmooth = null;
    resetRealPress();
    markReach(null);
    lastReach = { id: null, at: -1e9, point: null };
  }

  function releaseTool() {
    if (!S.held) return;
    var id = S.held;
    S.held = null; S.anchor = null;
    press.reset();
    resetRealPress();
    /* Deliberately NOT engine.releaseAt(): letting go with the mouse performs
       whatever is under the tip, because letting go is how a mouse commits.
       Here the thumb commits, so opening the hand has to be allowed to mean
       nothing more than "I have put it down". */
    if (Lab.tools.active() === id && Lab.tools.owner() === 'hand') Lab.tools.drop(id);
    if (Lab.engine && Lab.engine.clearHighlight) Lab.engine.clearHighlight();
    if (Lab.engine && Lab.engine.refresh) Lab.engine.refresh();
  }

  /* --------------------------------------------------------------------- */
  /*  What the thumb does                                                   */
  /* --------------------------------------------------------------------- */
  function resetRealPress() {
    realPress.reset(); realRest.reset(); realPickup.reset();
    realNeedsRest = true; realCycle = null; realUnknownAt = null;
    if (Lab.pipette && Lab.pipette.handButtons) Lab.pipette.handButtons(null);
  }

  function realInputChanged() {
    releaseTool(); endDrag(); resetRealPress();
    S.armed = false; grip.reset(); press.reset(); neutral.reset();
  }

  function placeRealPipette() {
    if (S.held !== 'pipette') return;
    releaseTool(); realPickupLock = true;
    grip.reset(); S.armed = false;
    say('Pipette placed. Move away, then return to pick it up.');
  }

  function pipetteStateKey() {
    var p = Lab.state.S.pipette;
    return [Lab.state.S.module, Lab.state.S.phase, p.hasTip, p.volume, p.reagent,
      p.fresh, p.lastReagent, p.source, Lab.state.S.serial && Lab.state.S.serial.target,
      Lab.state.S.wash && Lab.state.S.wash.step].join('|');
  }

  function isDrawAction(ev) {
    return ev && ['aspirate', 'aspirate-sample', 'serial-draw', 'discard-draw'].indexOf(ev.action) >= 0;
  }

  function updateRealButtons(reading, stamp) {
    if (!reading || !reading.holding || grip.since !== null) {
      realCycle = null; realPress.since = null; realNeedsRest = true; realRest.reset();
      return;
    }
    if (realNeedsRest) {
      if (realRest.set(reading.button === 'rest', stamp) !== 1) return;
      realNeedsRest = false; realPress.reset();
    }
    if (Lab.pipette.handButtons) Lab.pipette.handButtons({
      kind: realPress.on ? realKind : reading.selection,
      depth: reading.button === 'rest' ? 0 : reading.depth
    });
    if (reading.button === 'unknown' || (realPress.on && reading.button !== 'rest' && reading.button !== realKind)) {
      realPress.since = null;
      if (realUnknownAt === null) realUnknownAt = stamp;
      if (stamp - realUnknownAt >= GESTURE_GAP) {
        realCycle = null; realNeedsRest = true; realRest.reset();
      }
      return;
    }
    realUnknownAt = null;
    var edge = realPress.set(reading.button !== 'rest', stamp);
    if (edge === 1) {
      realKind = reading.button;
      if (realKind === 'eject') { realCycle = null; onEject(); }
      else realPlungerDown();
    } else if (edge === -1 && realKind === 'press') realPlungerUp();
  }

  // A real air-displacement pipette draws on the UP stroke. The down stroke
  // may happen above the source, so resolve and validate the source at release.
  // Dispensing consumes only the down edge; its release must never draw again.
  function realPlungerDown() {
    realCycle = null;
    if (Lab.state.S.busy) return;
    var point = workingPoint(), t = point && Lab.engine.targetAt(point);
    var ev = t && Lab.engine.evaluate(t, 'pipette');
    if (ev && ev.ok && ev.action === 'serial-mix') {
      realCycle = { kind: 'mix', target: t.el, state: pipetteStateKey() }; return;
    }
    if (Lab.state.S.pipette.hasTip && Lab.state.S.pipette.volume === 0 && (!ev || ev.action !== 'retip')) {
      realCycle = { kind: 'draw', state: pipetteStateKey() }; return;
    }
    if (ev && ev.ok && ev.action !== 'discard-tip' && !isDrawAction(ev)) {
      steadyUntil = performance.now() + 70;
      Lab.engine.perform(t, ev, point);
    } else if (ev && ev.reason) Lab.ui.flash(ev.reason);
  }

  function realPlungerUp() {
    var cycle = realCycle; realCycle = null;
    if (!cycle || Lab.state.S.busy || cycle.state !== pipetteStateKey()) return;
    var point = workingPoint(), t = point && Lab.engine.targetAt(point);
    var ev = t && Lab.engine.evaluate(t, 'pipette');
    var valid = ev && ev.ok && (cycle.kind === 'draw' ? isDrawAction(ev)
      : ev.action === 'serial-mix' && t.el === cycle.target);
    if (valid) {
      steadyUntil = performance.now() + 70; Lab.engine.perform(t, ev, point);
    } else Lab.ui.flash(ev && ev.reason || 'Keep the tip over the liquid while releasing the plunger.');
  }

  function workingPoint() {
    var tipFn = S.held && Lab.tools.tipOf(S.held);
    return tipFn ? tipFn() : null;
  }

  /** The instrument answers the thumb even when the bench does not: a plunger
      that never moves reads as a camera that has stopped working. */
  function bob() {
    if (S.held === 'pipette' && Lab.pipette.plungerPress) Lab.pipette.plungerPress();
    else if (S.held === 'transfer' && Lab.stations.squeeze) Lab.stations.squeeze();
    else if (S.held === 'marker' && Lab.stations.dabMarker) Lab.stations.dabMarker();
  }

  function onPlunger() {
    var point = workingPoint();
    if (!point || Lab.state.S.busy) { bob(); return; }
    var t = Lab.engine.targetAt(point);
    var ev = t ? Lab.engine.evaluate(t, S.held) : null;
    if (ev && ev.ok) { steadyUntil = performance.now() + 70; Lab.engine.perform(t, ev, point); return; }
    bob();
    if (ev && ev.reason) Lab.ui.flash(ev.reason);
    else say('Nothing under the tip to press into.');
  }

  function onEject() {
    if (S.held !== 'pipette') { say('Only the micropipette has a tip ejector.'); return; }
    if (!Lab.state.S.pipette.hasTip) { say('There is no tip on the pipette to eject.'); return; }
    var point = workingPoint();
    if (!point || Lab.state.S.busy) return;

    var t = Lab.engine.targetAt(point);
    var ev = t ? Lab.engine.evaluate(t, 'pipette') : null;
    if (ev && ev.ok && ev.action === 'discard-tip') { steadyUntil = performance.now() + 70; Lab.engine.perform(t, ev, point); return; }
    /* The engine offers 'dump' instead whenever the tip still holds liquid.
       Emptying it is the PLUNGER's job — blowing the tip out — and doing it
       from the ejector would quietly bin a dose the student had drawn. */
    if (ev && ev.action === 'dump') {
      Lab.ui.flash('The tip still holds liquid — press the plunger over the waste to empty it first.');
      return;
    }
    Lab.ui.flash('Hold the used tip over the waste bin, then press the ejector.');
  }

  /** Empty-handed, a pinch is a click, and the bench answers it exactly as it
      answers a mouse — so the timer, the towels, the sample rack, the module
      tabs and the whole of Module 2 need nothing of their own here. */
  function onPinch(point) {
    var st = Lab.state.S;
    if (st.module === 1 && st.phase !== 'intro' && st.phase !== 'analysis' && !st.busy) {
      var t = Lab.engine.targetAt(point);
      if (t && t.el) { Lab.engine.clickAct(t.el); return; }
    }
    var el = document.elementFromPoint(point.x, point.y);
    if (!el) return;
    var ev;
    try {
      ev = new MouseEvent('click', {
        bubbles: true, cancelable: true, view: window,
        clientX: point.x, clientY: point.y
      });
    } catch (e) {
      ev = document.createEvent('MouseEvents');
      ev.initEvent('click', true, true);
    }
    el.dispatchEvent(ev);
  }

  /* --------------------------------------------------------------------- */
  /*  Aiming: highlight the target, and say what a press would do           */
  /* --------------------------------------------------------------------- */
  function aim(point, near) {
    aimReading = null;
    var tool = S.held || Lab.engine.toolFor(Lab.state.S.phase);
    var at = S.held ? workingPoint() : point;
    if (!at) return;
    var t = Lab.engine.aimAt(at, tool);
    var ev = S.held && t ? Lab.engine.evaluate(t, S.held) : null;
    aimReading = { point: at, target: t, evaluation: ev };
    if (Lab.pipetteControl && Lab.pipetteControl.ready() && (S.held === 'pipette' || !S.held && wantedTool() === 'pipette')) {
      if (!S.held) {
        say(realPickupLock ? 'Move away from the pipette before picking it up again.'
          : near === 'pipette' ? 'Hold your resting grip here to pick up the micropipette.'
          : 'Aim your resting grip over the on-screen micropipette.');
      } else if (realNeedsRest) say('Release both real buttons to resume control.');
      else if (!realReading || !realReading.holding) say('Keep your calibrated grip and thumb in view.');
      else if (realCycle && realCycle.kind === 'draw') say(ev && ev.ok && isDrawAction(ev)
        ? 'Release the plunger to aspirate 50 µL.' : 'Keep the plunger down; move the tip over the source liquid.');
      else if (realCycle && realCycle.kind === 'mix') say('Release the plunger to complete this mixing stroke.');
      else if (ev && ev.ok && ev.action === 'discard-tip') say('Press the real tip ejector to release the tip into waste.');
      else if (ev && ev.ok && isDrawAction(ev)) say('Press, then release the real plunger to aspirate 50 µL.');
      else if (ev && ev.ok) say('Press the real plunger: ' + actionWords(ev, t) + '.');
      else say(ev && ev.reason || 'Carry the pipette with both buttons released.');
      return;
    }
    if (!S.held) {
      say(grip.on ? 'Open your hand, then close it over a tool.'
        : near ? 'Close your hand to pick up the ' + toolName(near) + '.' : reachNote());
      return;
    }
    if (!thumbTracked || freeNeedsRest) { say('Thumb tracking paused — show the thumb, then release it to resume.'); return; }
    if (grip.since !== null) { say('Opening your hand to place the ' + toolName(S.held) + '.'); return; }
    if (!t) { say('Carrying the ' + toolName(S.held) + '.'); return; }
    say(ev.ok ? 'Press your thumb: ' + actionWords(ev, t) : (ev.reason || 'Not here.'));
  }

  function reachNote() {
    var st = Lab.state.S;
    if (st.phase === 'intro') return 'Pinch to press a button.';
    if (st.module === 2 || st.phase === 'analysis') return 'Pinch to read the plate.';
    var want = Lab.engine.toolFor(st.phase);
    var el = Lab.tools.elementOf(want);
    if (el && !el.classList.contains('tool-stowed')) {
      return 'Close your hand over the ' + toolName(want) + ' to pick it up.';
    }
    return 'Pinch to act, or close your hand over a tool.';
  }

  function toolName(id) {
    return id === 'pipette' ? 'micropipette'
         : id === 'transfer' ? 'transfer pipet'
         : id === 'marker' ? 'marker' : 'tool';
  }

  /** Plain words for what one press would do — for this panel only.  The
      engine's own refusals are the ones that carry the protocol. */
  function actionWords(ev, t) {
    var a = ev.action;
    if (a === 'retip') return 'fit a fresh tip';
    if (a === 'discard-tip') return 'drop the tip';
    if (a === 'dump') return 'empty the tip';
    if (a === 'aspirate' || a === 'aspirate-sample' ||
        a === 'serial-draw' || a === 'discard-draw') return 'draw 50 µL';
    if (a === 'dispense' || a === 'dispense-sample' ||
        a === 'serial-dispense') return 'dispense into well ' + t.n;
    if (a === 'serial-mix') {
      return 'mix well ' + t.n + ' (' + Lab.state.S.wells[t.n].mixStrokes + ' of 5)';
    }
    if (a === 'load-wash') return 'fill the transfer pipet';
    if (a === 'wash-fill') return 'flood well ' + t.n;
    if (a === 'overfill') return 'careful — well ' + t.n + ' is full already';
    if (a === 'label') return 'number strip ' + ev.strip;
    if (a === 'incubate') return 'start the incubation';
    if (a === 'invert') return 'invert the strips';
    return 'act here';
  }

  /* --------------------------------------------------------------------- */
  /*  The panel                                                             */
  /* --------------------------------------------------------------------- */
  var KEYS = [
    ['grip',  'Close your hand',      'over a tool, to pick it up'],
    ['open',  'Open your hand',       'set the tool down'],
    ['press', 'Thumb down',            'the plunger: draw, dispense, mix'],
    ['eject', 'Thumb out, then down',  'the tip ejector'],
    ['click', 'Pinch, empty-handed',   'click; hold a caption to move it']
  ];

  function buildPanel() {
    if (els.panel) return;
    var wrap = document.createElement('section');
    wrap.className = 'handpanel';
    wrap.id = 'handpanel';
    wrap.innerHTML =
      '<header class="handpanel__head">' +
        '<span class="handpanel__led" aria-hidden="true"></span>' +
        '<h2 class="minihead">Hand control</h2>' +
        '<button type="button" class="grip" id="hand-grip" ' +
          'title="Drag this header, or use the arrow keys, to move the panel" ' +
          'aria-label="Move the hand control panel">\u2725</button>' +
        '<button type="button" class="handpanel__btn" id="hand-fold" ' +
          'aria-label="Shrink this panel to one line">–</button>' +
        '<button type="button" class="handpanel__btn" id="hand-off" ' +
          'aria-label="Turn hand control off">✕</button>' +
      '</header>' +
      '<div class="handpanel__cam">' +
        '<video id="hand-video" playsinline autoplay muted></video>' +
        '<canvas id="hand-canvas" width="176" height="132"></canvas>' +
      '</div>' +
      '<p class="handpanel__say" role="status"></p>' +
      '<div class="pipette-cal"></div>' +
      '<ul class="handkeys">' +
        KEYS.map(function (k) {
          return '<li data-key="' + k[0] + '"><b>' + k[1] + '</b> — ' + k[2] + '</li>';
        }).join('') +
      '</ul>';
    document.body.appendChild(wrap);
    /* style.css reads this: it gives the procedure checklist back the height
       this panel takes, and slides the equipment column down into the middle
       of the screen, where an arm can reach it. */
    document.body.classList.add('hand-on');
    repark();

    /* Wherever this panel is put it is on top of something, and which
       something matters depends on what the student is reading — so it is
       moved rather than placed.  Dragged by its header, kept inside the
       window, and remembered under its own name so switching the camera off
       and on again does not throw the choice away. */
    if (Lab.reposition) {
      Lab.reposition.attach(wrap, {
        id: 'handpanel', handle: '.handpanel__head',
        ignore: '.handpanel__btn', axis: 'xy', box: 'window'
      });
    }

    els.panel = wrap;
    if (Lab.pipetteControl) Lab.pipetteControl.mount(wrap.querySelector('.pipette-cal'), realInputChanged, placeRealPipette);
    els.canvas = wrap.querySelector('#hand-canvas');
    els.say = wrap.querySelector('.handpanel__say');
    els.keys = wrap.querySelectorAll('.handkeys li');
    video = wrap.querySelector('#hand-video');
    buildGlove();
    lastSaid = '';

    wrap.querySelector('#hand-off').addEventListener('click', stop);
    wrap.querySelector('#hand-fold').addEventListener('click', function (e) {
      var folded = wrap.classList.toggle('handpanel--folded');
      e.currentTarget.textContent = folded ? '+' : '–';
      e.currentTarget.setAttribute('aria-label',
        folded ? 'Show the camera and the key' : 'Shrink this panel to one line');
    });

    readPaint();
    /* state.js has no off(), and neither has theme.js — so this is wired once
       for the life of the page, not once per time the camera is switched on. */
    if (!paintWired && Lab.theme && Lab.theme.onChange) {
      paintWired = true;
      Lab.theme.onChange(readPaint);
    }
  }

  function removePanel() {
    if (Lab.pipetteControl) Lab.pipetteControl.unmount();
    if (els.panel && Lab.reposition) Lab.reposition.release(els.panel);
    if (els.panel && els.panel.parentNode) els.panel.parentNode.removeChild(els.panel);
    if (els.glove && els.glove.parentNode) els.glove.parentNode.removeChild(els.glove);
    markReach(null);
    document.body.classList.remove('hand-on');
    els = {};
    video = null;
    S.lit = null;
    repark();
  }

  /** The equipment column moves when this panel comes and goes, so the tools'
      resting places move with it.  Waits a frame for the new layout. */
  function repark() {
    if (!Lab.bench || !Lab.bench.parkTools) return;
    setTimeout(function () { Lab.bench.parkTools(0); }, 60);
  }

  function readPaint() {
    if (!Lab.theme || !Lab.theme.color) return;
    paint.bone = Lab.theme.color('--accent', '#3b5bdb');
    paint.joint = Lab.theme.color('--ink-1', '#222222');
    paint.live = Lab.theme.color('--state-ok', '#2f9e44');
  }

  function setMode(mode, message) {
    S.mode = mode;
    if (els.panel) els.panel.setAttribute('data-mode', mode);
    if (message) say(message);
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', mode === 'live' || mode === 'starting' || mode === 'loading' ? 'true' : 'false');
      toggleBtn.setAttribute('data-mode', mode);
    }
    if (mode === 'off') light(null);
  }

  var lastSaid = '';
  function say(text) {
    if (!els.say || text === lastSaid) return;
    lastSaid = text;
    els.say.textContent = text;
  }

  function light(key) {
    if (S.lit === key || !els.keys) return;
    S.lit = key;
    for (var i = 0; i < els.keys.length; i++) {
      els.keys[i].classList.toggle('is-live', els.keys[i].getAttribute('data-key') === key);
    }
  }

  /* ----- the hand on the bench --------------------------------------------
     Not a dot.  A dot says where the computer thinks you are pointing; a hand
     says what your hand is DOING, and closing your fingers round a pipette is
     the whole gesture — you can see the fingers close, see the tool inside
     them, and see when the grip has not taken.  It is drawn from the same 21
     landmarks everything else is read from, so it cannot disagree with what
     the engine believes.

     Drawn at a FIXED size whatever the distance from the lens.  A hand that
     grew as the student leaned in would keep changing how much of the bench
     it covers, and covering things is the whole question when the target is a
     34px well. */
  var GLOVE_SPAN = 42;                 // px on screen for one palm span

  /* The silhouette.  A hand is not a stick figure and it is not five identical
     sausages: the palm is a rounded slab, the fingers narrow toward the tip,
     and the thumb is thicker than the little finger.  Getting those three
     things right is the whole difference between something a student reads as
     their hand and something they read as a bug.

     Widths are fractions of the palm span, so the proportions hold whatever
     GLOVE_SPAN is set to. */
  /* The palm runs out to the thumb's FIRST KNUCKLE, not to its root joint.
     The fleshy mound at the base of the thumb is most of what makes a hand
     read as a hand from above; with the boundary at the root joint instead,
     the thumb left the palm as a thin arm and the whole shape read as a
     mitten with a lasso hanging off it. */
  /* The loop is walked as: heel, thumb mound, then the knuckle line with a
     WEB between each pair of fingers.  The web is the point of it.  Run
     straight from knuckle to knuckle the palm's top edge is a flat shelf with
     four tubes standing on it, and the slot between each pair of tubes goes
     down to the shelf — which is not what the gap between two fingers looks
     like from any angle.  Carrying the edge up between them, further than the
     knuckles themselves are carried, is the skin that is actually there. */
  var PALM_LOOP = [
    { at: 0, out: 0.02, side: -0.22 },       // two corners make a real wrist
    { at: 2, out: 0.06 },
    { at: 5, out: 0.04 },
    { mid: [5, 9], out: 0.06 },
    { at: 9, out: 0.04 },
    { mid: [9, 13], out: 0.06 },
    { at: 13, out: 0.04 },
    { mid: [13, 17], out: 0.05 },
    { at: 17, out: 0.06 },
    { at: 0, out: 0.02, side: 0.22 }
  ];
  var PALM_FAT = 0.13;
  /* …and the loop is pushed out past those landmarks before it is drawn.  The
     landmarks are KNUCKLES — joints inside the flesh — so a palm that stops on
     them is a palm drawn a centimetre inside its own skin, which is what left
     the fingers standing in it like four separate posts.  Swelling it is what
     gives the fingers a webbed base to grow out of.

     Per point, and not the same everywhere: a flat swell pushed the KNUCKLE
     line up as far as it pushed the heel out, and fingers measured from a
     knuckle that has moved up to meet them are fingers that come out stubs.
     The heel and the thumb mound take the most, the four knuckles take
     barely enough to web them. */
  /* The heel, and nothing past it.  This used to run most of a palm-span
     below the hand and ended in a round cap in mid-air, which read as a tail:
     there is no forearm to draw and pretending otherwise looked worse than
     stopping at the wrist. */
  var WRIST_FAT = 0.42, WRIST_RUN = 0.04;
  /* A fingertip is not the last landmark: the landmark is the bone's end and
     the pad of the finger carries on past it.  Without this the fingers read
     as stubs, and worse, they read as stubs in proportion to how fat the palm
     under them is — so every gram put on the palm has to be paid for here. */
  var TIP_RUN = 0.09;
  var DIGITS = [
    { pts: [1, 2, 3, 4],     w: [0.34, 0.29, 0.23] },   // thumb, thickest
    { pts: [5, 6, 7, 8],     w: [0.27, 0.23, 0.185] },  // index
    { pts: [9, 10, 11, 12],  w: [0.28, 0.24, 0.195] },  // middle, longest
    { pts: [13, 14, 15, 16], w: [0.27, 0.23, 0.185] },  // ring
    { pts: [17, 18, 19, 20], w: [0.24, 0.20, 0.155] }   // little
  ];

  var gloveSeq = 0;

  function buildGlove() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'handglove');
    svg.setAttribute('aria-hidden', 'true');

    /* THE RIM.
       The hand is a dozen overlapping shapes, and there is no way to stroke
       the outside of a union of shapes in plain SVG — stroke them one by one
       and every knuckle and every crossing draws its own edge through the
       middle of the hand.  So the outline is grown from the finished shape
       instead: dilate its alpha, flood that with ink, and lay the hand back
       on top.  One rim, right round the silhouette, none inside it.

       The last step fades the WHOLE composite at once.  Painting the pieces
       translucent instead is what made the first attempt look like spilt
       ink: every overlap doubled up and the hand lost its own edges. */
    /* One rim and one soft shadow. Multiple inner blurs were repainting on
       every landmark update. The silhouette now uses local coordinates, so
       carrying a steady pose only changes its group's translation. */
    var id = 'handglove-ink-' + (++gloveSeq);
    var html =
      '<defs><filter id="' + id + '" x="-45%" y="-45%" width="190%" height="195%" ' +
        'color-interpolation-filters="sRGB">' +
        '<feMorphology in="SourceAlpha" operator="dilate" radius="1" result="fat"/>' +
        '<feFlood class="handglove__ink" result="ink"/>' +
        '<feComposite in="ink" in2="fat" operator="in" result="rim"/>' +
        // the bench underneath it
        '<feGaussianBlur in="fat" stdDeviation="1.8" result="cast"/>' +
        '<feOffset in="cast" dy="2" result="castOff"/>' +
        '<feFlood class="handglove__cast" result="castInk"/>' +
        '<feComposite in="castInk" in2="castOff" operator="in" result="castShadow"/>' +
        '<feMerge>' +
          '<feMergeNode in="castShadow"/><feMergeNode in="rim"/><feMergeNode in="SourceGraphic"/>' +
        '</feMerge>' +
        '<feComponentTransfer class="handglove__fade">' +
          '<feFuncA type="linear" slope="0.62"/>' +
        '</feComponentTransfer>' +
      '</filter></defs>' +
      '<g class="handglove__pose">' +
      '<g class="handglove__body" filter="url(#' + id + ')">' +
      '<path class="handglove__wrist" stroke-width="' + (WRIST_FAT * GLOVE_SPAN).toFixed(1) + '"></path>' +
      '<path class="handglove__palm" stroke-width="' + (PALM_FAT * GLOVE_SPAN).toFixed(1) + '"></path>';
    for (var f = 0; f < DIGITS.length; f++) {
      for (var b = 0; b < DIGITS[f].w.length; b++) {
        html += '<path class="handglove__bone" stroke-width="' +
                (DIGITS[f].w[b] * GLOVE_SPAN).toFixed(1) + '"></path>';
      }
    }
    svg.innerHTML = html + '</g>' +
      '<g class="handglove__details">' +
        '<path class="handglove__cuff"/>' +
        '<path class="handglove__crease"/>' +
        '<path class="handglove__knuckles"/>' +
      '</g></g>' +
      '<g class="handglove__hotspot"><circle r="4"/><circle class="handglove__dot" r="1.4"/></g>' +
      '<circle class="handglove__progress" r="10" pathLength="100"/>' +
      '<g class="handglove__aim"><circle class="handglove__aim-halo" r="8"/>' +
        '<circle class="handglove__aim-ring" r="8"/><circle class="handglove__dot" r="1.6"/></g>';
    document.body.appendChild(svg);
    els.fade = svg.querySelector('.handglove__fade feFuncA');
    els.glove = svg;
    els.pose = svg.querySelector('.handglove__pose');
    els.palm = svg.querySelector('.handglove__palm');
    els.wrist = svg.querySelector('.handglove__wrist');
    els.bones = svg.querySelectorAll('.handglove__bone');
    els.cuff = svg.querySelector('.handglove__cuff');
    els.crease = svg.querySelector('.handglove__crease');
    els.knuckles = svg.querySelector('.handglove__knuckles');
    els.hotspot = svg.querySelector('.handglove__hotspot');
    els.progress = svg.querySelector('.handglove__progress');
    els.aim = svg.querySelector('.handglove__aim');
    lastFade = -1;
    gloveShape = null;
  }

  /* A closed Catmull-Rom through the knuckles, written out as cubics.  The
     palm read as a cut gemstone while it was a polygon; six points and a
     little curvature is all it needed. */
  function roundLoop(p) {
    var n = p.length, d = 'M' + fix(p[0]);
    for (var i = 0; i < n; i++) {
      var p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
      d += 'C' + fix({ x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }) +
           ' ' + fix({ x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }) +
           ' ' + fix(p2);
    }
    return d + 'Z';
  }
  function fix(q) { return q.x.toFixed(1) + ' ' + q.y.toFixed(1); }

  var gloveShape = null, gloveStamp = 0;
  function drawGlove(lm, h, point, near, stamp) {
    if (!els.glove) return;
    var screenPoint = point;
    attribute(els.pose, 'transform', 'translate(' + fix(point) + ')');
    point = { x: 0, y: 0 };
    var k = GLOVE_SPAN / Math.max(1e-6, h.span);
    // mirrored, and about the palm centre — which is the point the bench is
    // being aimed with, so the drawn hand is centred on its own hotspot
    // Smooth the silhouette in palm-local coordinates. Finger jitter should
    // not make the outline fizz, or add any delay to the tool's actual aim.
    var blend = !gloveShape || stamp - gloveStamp > 200 ? 1
      : 1 - Math.exp(-Math.max(1, stamp - gloveStamp) / 45);
    if (!gloveShape) gloveShape = [];
    for (var s = 0; s < 21; s++) {
      var target = { x: (h.nx - lm[s].x) * aspect * k, y: (lm[s].y - h.ny) * k };
      var old = gloveShape[s] || target;
      gloveShape[s] = { x: old.x + (target.x - old.x) * blend, y: old.y + (target.y - old.y) * blend };
    }
    gloveStamp = stamp;
    function at(i) { return { x: point.x + gloveShape[i].x, y: point.y + gloveShape[i].y }; }
    var across = unit(sub(at(17), at(5)));

    /* Pushed out along the ray from the palm centre: every knuckle moves the
       same distance OUTWARD, so the loop keeps its shape and simply gains a
       skin.  Pushing along the ray rather than along a normal also means a
       curled hand, whose knuckles crowd together, swells rather than folding
       in on itself. */
    var edge = [];
    for (var e = 0; e < PALM_LOOP.length; e++) {
      var step = PALM_LOOP[e], q;
      if (step.mid) {
        var a = at(step.mid[0]), b = at(step.mid[1]);
        q = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      } else {
        q = at(step.at);
      }
      if (step.side) {
        q.x += across.x * step.side * GLOVE_SPAN;
        q.y += across.y * step.side * GLOVE_SPAN;
      }
      var qx = q.x - point.x, qy = q.y - point.y;
      var ql = Math.sqrt(qx * qx + qy * qy) || 1;
      var swell = step.out * GLOVE_SPAN;
      edge.push({ x: q.x + qx / ql * swell, y: q.y + qy / ql * swell });
    }
    attribute(els.palm, 'd', roundLoop(edge));

    // the heel of the hand: a short, broad stub that stops at the wrist
    var w = at(0);
    attribute(els.wrist, 'd', 'M' + fix(point) + 'L' +
      fix({ x: w.x + (w.x - point.x) * WRIST_RUN, y: w.y + (w.y - point.y) * WRIST_RUN }));

    var up = unit(sub(at(9), w));
    function cuffPoint(side, down) {
      return { x: w.x + across.x * side - up.x * down, y: w.y + across.y * side - up.y * down };
    }
    attribute(els.cuff, 'd', 'M' + fix(cuffPoint(-11, -2)) + 'L' + fix(cuffPoint(11, -2)) +
      'L' + fix(cuffPoint(10, 5)) + 'L' + fix(cuffPoint(-10, 5)) + 'Z');
    var thumbBase = at(2), index = at(5);
    attribute(els.crease, 'd', 'M' + fix({ x: (thumbBase.x + point.x) / 2, y: (thumbBase.y + point.y) / 2 }) +
      'Q' + fix(point) + ' ' + fix({ x: (index.x + point.x) / 2, y: (index.y + point.y) / 2 }));
    var creases = '';
    for (var j = 0; j < FINGERS.length; j++) {
      var joint = at(grip.on ? FINGERS[j].mcp : FINGERS[j].pip);
      creases += 'M' + fix({ x: joint.x - across.x * 2.5, y: joint.y - across.y * 2.5 }) +
        'Q' + fix({ x: joint.x + up.x * 1.5, y: joint.y + up.y * 1.5 }) +
        ' ' + fix({ x: joint.x + across.x * 2.5, y: joint.y + across.y * 2.5 });
    }
    attribute(els.knuckles, 'd', creases);

    var n = 0;
    for (var f = 0; f < DIGITS.length; f++) {
      var pts = DIGITS[f].pts;
      for (var b = 0; b + 1 < pts.length; b++) {
        var j0 = at(pts[b]), j1 = at(pts[b + 1]);
        if (b === pts.length - 2) {          // the last bone carries the pad
          var tx = j1.x - j0.x, ty = j1.y - j0.y;
          var tl = Math.sqrt(tx * tx + ty * ty) || 1;
          j1 = { x: j1.x + tx / tl * TIP_RUN * GLOVE_SPAN,
                 y: j1.y + ty / tl * TIP_RUN * GLOVE_SPAN };
        }
        attribute(els.bones[n++], 'd', 'M' + fix(j0) + 'L' + fix(j1));
      }
    }

    point = screenPoint;
    var c = els.glove.classList;
    var pressing = (press.on && pressKind === 'press') || (realPress.on && realKind === 'press') || pinch.on;
    var ejecting = (press.on && pressKind === 'eject') || (realPress.on && realKind === 'eject');
    c.add('is-on');
    c.remove('is-lost');
    c.toggle('is-grip', !!S.held);
    c.toggle('is-reach', !S.held && !!near);
    c.toggle('is-press', pressing);
    c.toggle('is-eject', ejecting);
    c.toggle('is-drag', !!S.dragging);
    els.hotspot.setAttribute('transform', 'translate(' + point.x + ' ' + point.y + ')');
    var progress = realPickup.since !== null && !S.held ? clamp01((stamp - realPickup.since) / realPickup.onMs)
      : grip.since === null ? 0 : clamp01((stamp - grip.since) / (grip.on ? grip.offMs : grip.onMs));
    els.progress.setAttribute('cx', point.x); els.progress.setAttribute('cy', point.y);
    els.progress.style.strokeDashoffset = 100 - progress * 100;
    els.progress.style.opacity = progress && (near || S.held) ? '1' : '0';
    var tip = S.held && aimReading ? aimReading.point : null;
    els.aim.style.display = tip ? '' : 'none';
    if (tip) {
      els.aim.setAttribute('transform', 'translate(' + tip.x + ' ' + tip.y + ')');
      var ev = aimReading.evaluation;
      els.aim.classList.toggle('is-ready', !!(ev && ev.ok));
      els.aim.classList.toggle('is-blocked', !!(ev && !ev.ok));
    }
    /* How solid the hand is, in one number.  It leans in as it comes within
       reach and again as the thumb goes down, and steps back once a tool is
       in it — from there the tool is the thing to watch, not the hand. */
    fade(pressing || ejecting ? 0.62 : S.held ? 0.40 : near ? 0.84 : 0.76);
  }

  var lastFade = -1;
  function fade(a) {
    if (!els.fade || Math.abs(a - lastFade) < 0.01) return;
    lastFade = a;
    els.fade.setAttribute('slope', a);
  }

  function hideGlove() {
    if (els.glove) els.glove.classList.remove('is-on');
    markReach(null);
  }

  /* The picture is mirrored, so the skeleton is drawn mirrored over it — a
     hand that moved the opposite way to its own reflection would be unusable
     as a way of telling whether the camera can see you. */
  function drawPreview(lm) {
    if (!els.canvas) return;
    var ctx = els.canvas.getContext('2d');
    if (!ctx) return;
    var w = video.clientWidth || 176, h = video.clientHeight || 132;
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (els.canvas.width !== Math.round(w * ratio) || els.canvas.height !== Math.round(h * ratio)) {
      els.canvas.width = Math.round(w * ratio); els.canvas.height = Math.round(h * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!lm) return;

    var X = function (i) { return (1 - lm[i].x) * w; };
    var Y = function (i) { return lm[i].y * h; };

    ctx.lineWidth = 2;
    ctx.strokeStyle = S.held ? (paint.live || '#2f9e44') : (paint.bone || '#3b5bdb');
    ctx.beginPath();
    for (var b = 0; b < BONES.length; b++) {
      ctx.moveTo(X(BONES[b][0]), Y(BONES[b][0]));
      ctx.lineTo(X(BONES[b][1]), Y(BONES[b][1]));
    }
    ctx.stroke();

    ctx.fillStyle = paint.joint || '#222222';
    for (var i = 0; i < 21; i++) {
      ctx.beginPath();
      // the thumb tip is drawn larger: it is the tip doing the pressing
      ctx.arc(X(i), Y(i), i === THUMB_TIP ? 3.4 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* --------------------------------------------------------------------- */
  /*  Wiring                                                                */
  /* --------------------------------------------------------------------- */
  function init(button) {
    if (!button) return;
    toggleBtn = button;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', toggle);
    Lab.state.on('change', function () {
      if (realCycle && realCycle.state !== pipetteStateKey()) realCycle = null;
    });
    // a camera left running into the next lesson is nobody's idea of good
    window.addEventListener('pagehide', function () {
      stop();
      if (detectorWorker) detectorWorker.terminate();
      detectorWorker = null; workerReady = false; workerStarting = null; inFlight = null;
    });
  }

  Lab.hand = {
    init: init,
    start: start,
    stop: stop,
    toggle: toggle,
    isOn: function () { return S.mode === 'live'; },
    held: function () { return S.held; },
    /* The reading itself, public on purpose.  Every number in this module is
       a threshold on a real hand, and a threshold nobody can measure is a
       threshold nobody can tune: read(landmarks, aspect) returns the curl
       count, the thumb's tuck and rise and the pinch for any 21 points, so a
       pose that will not register can be looked at rather than guessed at. */
    read: readHand,
    stats: function () { return Object.assign({}, runtime, { pendingFrames: inFlight ? 1 : 0, trackingLost: S.lostAt !== null, thumbTracked: thumbTracked, thumbGeometry: 'wrist-thumb-3d' }); }
  };
})(window.Lab = window.Lab || {});
