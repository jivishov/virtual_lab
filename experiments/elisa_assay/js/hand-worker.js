/* MediaPipe inference runs here so a camera frame cannot block the bench.
   The caller sends at most one transferable ImageBitmap at a time. Every
   bitmap is closed, including failed frames, and no frame queue is kept. */
(function (root) {
'use strict';

function runHandWorker() {

var detector = null;

async function initialize(plans, options) {
  var lastError;
  for (var i = 0; i < plans.length; i++) {
    try {
      var plan = plans[i];
      var mp = await import(plan.src.bundle);
      var fileset = await mp.FilesetResolver.forVisionTasks(plan.src.wasm);
      detector = await mp.HandLandmarker.createFromOptions(fileset, Object.assign({}, options, {
        baseOptions: { modelAssetPath: plan.src.model, delegate: plan.delegate },
        canvas: new OffscreenCanvas(640, 480)
      }));
      return plan.delegate;
    } catch (err) { lastError = err; }
  }
  throw lastError || new Error('The hand model could not start.');
}

self.onmessage = async function (event) {
  var msg = event.data;
  if (msg.type === 'init') {
    try {
      var delegate = await initialize(msg.plans, msg.options);
      self.postMessage({ type: 'ready', delegate: delegate });
    } catch (err) { self.postMessage({ type: 'error', message: String(err.message || err) }); }
    return;
  }
  if (msg.type !== 'frame') return;
  var began = performance.now();
  try {
    if (!detector) throw new Error('Hand tracking is not ready.');
    var result = detector.detectForVideo(msg.bitmap, msg.stamp);
    self.postMessage({
      type: 'result', id: msg.id, run: msg.run, stamp: msg.stamp,
      inferenceMs: performance.now() - began,
      landmarks: result.landmarks, worldLandmarks: result.worldLandmarks,
      handedness: result.handedness
    });
  } catch (err) {
    self.postMessage({ type: 'frame-error', id: msg.id, run: msg.run, message: String(err.message || err) });
  } finally { msg.bitmap.close(); }
};
}

// A file:// page cannot fetch a sibling worker script. Loading this small
// bootstrap as a normal script also makes the same worker available as a
// Blob URL, with no duplicate implementation or executable model on the UI.
if (typeof document === 'undefined') runHandWorker();
else (root.Lab = root.Lab || {}).handWorkerSource = '(' + runHandWorker.toString() + ')();';
})(self);
