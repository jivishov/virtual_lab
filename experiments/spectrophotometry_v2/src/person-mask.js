// The landscape selfie model has one confidence channel, labelled "selfie".
// Keep the colour exposure and its matte together, including while a hand moves.
export async function createPersonMask(makeCanvas) {
  const base = new URL('../vendor/mediapipe/', import.meta.url);
  const {FilesetResolver, ImageSegmenter} = await import(new URL('vision_bundle.mjs', base).href);
  const files = await FilesetResolver.forVisionTasks(new URL('wasm', base).href);
  const segmenter = await ImageSegmenter.createFromOptions(files, {
    baseOptions: {modelAssetPath: new URL('models/selfie_segmenter_landscape.tflite', base).href, delegate: 'CPU'},
    canvas: makeCanvas(1, 1),
    runningMode: 'VIDEO',
    outputCategoryMask: false,
    outputConfidenceMasks: true
  });

  const input = makeCanvas(1, 1), matte = makeCanvas(1, 1), cutout = makeCanvas(1, 1);
  const inputContext = input.getContext('2d', {alpha:false});
  const matteContext = matte.getContext('2d'), output = cutout.getContext('2d');
  let pixels;

  function render(frame, time) {
    const scale = Math.min(1, 256 / Math.max(frame.width, frame.height));
    const width = Math.max(1, Math.round(frame.width * scale));
    const height = Math.max(1, Math.round(frame.height * scale));
    if (input.width !== width || input.height !== height) {
      input.width = width;
      input.height = height;
    }
    inputContext.drawImage(frame, 0, 0, width, height);
    let visible = false;
    segmenter.segmentForVideo(input, time, result => {
      const mask = result.confidenceMasks[0];
      if (!pixels || matte.width !== mask.width || matte.height !== mask.height) {
        matte.width = mask.width;
        matte.height = mask.height;
        pixels = matteContext.createImageData(mask.width, mask.height);
      }
      const confidence = mask.getAsFloat32Array();
      const w = mask.width, h = mask.height;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x, score = confidence[i];
          // Move the soft edge inward by part of one mask pixel to keep bright
          // room colours out of hair and shoulder edges against a darker lab.
          let inner = score;
          if (score > .22 && x > 0 && x < w - 1 && y > 0 && y < h - 1) {
            inner = Math.min(score, confidence[i - 1], confidence[i + 1], confidence[i - w], confidence[i + w]);
          }
          const a = Math.max(0, Math.min(1, (.36 * score + .64 * inner - .26) / .56));
          pixels.data[i * 4 + 3] = 255 * a * a * (3 - 2 * a);
          if (pixels.data[i * 4 + 3]) visible = true;
        }
      }
      if (visible) matteContext.putImageData(pixels, 0, 0);
    });
    if (!visible) return null;
    if (cutout.width !== frame.width || cutout.height !== frame.height) {
      cutout.width = frame.width;
      cutout.height = frame.height;
    }
    output.globalCompositeOperation = 'copy';
    output.drawImage(frame, 0, 0);
    output.globalCompositeOperation = 'destination-in';
    output.drawImage(matte, 0, 0, cutout.width, cutout.height);
    return cutout;
  }
  return {render, close: () => segmenter.close()};
}
