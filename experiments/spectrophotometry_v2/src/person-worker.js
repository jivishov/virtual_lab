// The local MediaPipe WASM loader calls importScripts, so this is a classic worker.
let mask;
self.onmessage = async ({data}) => {
  try {
    if (data.type === 'init') {
      const {createPersonMask} = await import('./person-mask.js');
      mask = await createPersonMask((w, h) => new OffscreenCanvas(w, h));
      self.postMessage({type:'ready'});
    } else {
      const image = mask.render(data.image, data.time)?.transferToImageBitmap();
      self.postMessage({type:'frame', image}, image ? [image] : []);
    }
  } catch {
    self.postMessage({type:'error'});
  } finally {
    data.image?.close();
  }
};
