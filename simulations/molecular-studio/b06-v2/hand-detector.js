// The runtime and model are served with the workbench; inference loads on demand.
const cacheQuery = new URL(import.meta.url).search;

export async function loadHandModel(canvas) {
  const {HandLandmarker, FilesetResolver} = await import(`./mediapipe/vision_bundle.mjs${cacheQuery}`);
  const files = await FilesetResolver.forVisionTasks(new URL('./mediapipe/wasm', import.meta.url).href);
  files.wasmLoaderPath += cacheQuery;
  files.wasmBinaryPath += cacheQuery;
  return HandLandmarker.createFromOptions(files, {
    baseOptions:{modelAssetPath:new URL(`./mediapipe/hand_landmarker.task${cacheQuery}`,import.meta.url).href, delegate:'CPU'},
    runningMode:'VIDEO', numHands:2, minHandDetectionConfidence:.55,
    minHandPresenceConfidence:.55, minTrackingConfidence:.6, ...(canvas ? {canvas} : {})
  });
}

function workerModel(signal) {
  return new Promise((resolve,reject) => {
    const worker = new Worker(new URL(`./hand-worker.js${cacheQuery}`,import.meta.url));
    let waiting, failed;
    function close(error = new DOMException('Hand tracking stopped','AbortError')) {
      failed = error;
      signal.removeEventListener('abort',abort);
      worker.terminate();
      waiting?.reject(error); waiting = null;
      reject(error);
    }
    const abort = () => close();
    signal.addEventListener('abort',abort,{once:true});
    worker.onerror = e => close(new Error(e.message || 'The hand tracker could not start.'));
    worker.onmessage = ({data}) => {
      if (data.error) { close(new Error(data.error)); return; }
      if (data.ready) {
        resolve({close, async detect(canvas,time) {
          const image = await createImageBitmap(canvas);
          if (failed) { image.close(); throw failed; }
          return new Promise((resolve,reject) => {
            waiting = {resolve,reject};
            worker.postMessage({image,time},[image]);
          });
        }});
      } else { waiting?.resolve(data); waiting = null; }
    };
    worker.postMessage({open:true});
  });
}

export async function openHandDetector(signal) {
  signal.throwIfAborted();
  if (typeof Worker === 'function' && typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function') {
    try { return await workerModel(signal); }
    catch { signal.throwIfAborted(); }
  }
  const model = await loadHandModel();
  if (signal.aborted) { model.close(); signal.throwIfAborted(); }
  return {detect:(frame,time)=>model.detectForVideo(frame,time), close:()=>model.close()};
}
