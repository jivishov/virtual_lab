// Public-domain NASA portrait of Eileen Collins, distributed by scikit-image:
// https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.astronaut
async function installCalibrationCamera(page, markFace = false) {
  await page.addInitScript(markFace => {
    window.cameraScene = 'portrait';
    window.cameraRequests = 0;
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {value:async () => {
      window.cameraRequests++;
      if (window.denyNextCamera) {
        window.denyNextCamera = false;
        throw new DOMException('Camera permission denied', 'NotAllowedError');
      }
      if (window.cameraGate) await window.cameraGate;
      const portrait = new Image();
      portrait.src = new URL('tests/camera-portrait.jpg', document.baseURI);
      await portrait.decode();
      const image = document.createElement('canvas');
      image.width = 960;
      image.height = 720;
      const ctx = image.getContext('2d');
      const paint = () => {
        ctx.fillStyle = '#078044';
        ctx.fillRect(0, 0, 960, 720);
        if (window.cameraScene !== 'empty') {
          ctx.drawImage(portrait, window.cameraScene === 'right' ? 445 : 80, 0, 640, 640);
          if (markFace) {
            ctx.fillStyle = '#fb0bf6';
            ctx.fillRect(330, 120, 30, 22);
          }
        }
      };
      paint();
      const stream = image.captureStream(15);
      const track = window.calibrationTrack = stream.getVideoTracks()[0];
      const timer = setInterval(() => track.readyState === 'ended' ? clearInterval(timer) : paint(), 67);
      return stream;
    }});
  }, markFace);
}
module.exports = {installCalibrationCamera};
