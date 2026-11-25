import {createPersonMask} from './person-mask.js';

function canvas(width, height) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return element;
}

// Only this transparent canvas is presented. The original stream stays available
// to the hand tracker, and each inference uses a single captured exposure.
export class PersonCamera {
  constructor(output, changed) {
    this.output = output;
    this.context = output.getContext('2d');
    this.capture = canvas(1, 1);
    this.captureContext = this.capture.getContext('2d', {alpha:false});
    this.changed = changed;
    this.state = 'off';
    this.session = null;
  }
  setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.changed();
  }
  clear() {
    this.context.clearRect(0, 0, this.output.width, this.output.height);
    this.output.readyState = 0;
    this.output.currentTime = -1;
  }
  setVideo(video, retry = false) {
    const previous = this.session;
    if ((previous?.video ?? null) === video && !retry) return;
    this.session = null;
    if (previous) {
      clearTimeout(previous.timer);
      previous.worker?.terminate();
      previous.mask?.close();
      previous.track?.removeEventListener('mute', previous.onMute);
    }
    this.clear();
    if (!video) { this.setState('off'); return; }
    const session = {video, ready:false, busy:false, lastTime:-1, lastSubmit:-Infinity, revision:0};
    this.session = session;
    session.track = video.srcObject?.getVideoTracks()[0];
    session.onMute = () => {
      session.revision++;
      this.clear();
      if (this.state === 'ready') this.setState('loading');
    };
    session.track?.addEventListener('mute', session.onMute);
    this.setState('loading');
    if (globalThis.Worker && globalThis.OffscreenCanvas && globalThis.createImageBitmap) {
      try {
        const worker = new Worker(new URL('./person-worker.js', import.meta.url));
        session.worker = worker;
        worker.onmessage = ({data}) => {
          if (this.session !== session || session.worker !== worker) { data.image?.close(); return; }
          clearTimeout(session.timer);
          if (data.type === 'ready') session.ready = true;
          else if (data.type === 'frame') {
            try { this.present(session, data.image); } finally { data.image?.close(); }
          } else this.useMainThread(session);
        };
        worker.onerror = worker.onmessageerror = () => {
          if (this.session === session && session.worker === worker) this.useMainThread(session);
        };
        session.timer = setTimeout(() => this.useMainThread(session), 30000);
        worker.postMessage({type:'init'});
        return;
      } catch { /* Use the same mask on browsers without a compatible worker. */ }
    }
    this.useMainThread(session);
  }
  async useMainThread(session) {
    if (this.session !== session) return;
    clearTimeout(session.timer);
    session.worker?.terminate();
    session.worker = null;
    session.ready = session.busy = false;
    this.clear();
    this.setState('loading');
    try {
      const mask = await createPersonMask(canvas);
      if (this.session !== session) { mask.close(); return; }
      session.mask = mask;
      session.ready = true;
    } catch { if (this.session === session) this.failed(session); }
  }
  failed(session) {
    session.ready = session.busy = false;
    clearTimeout(session.timer);
    session.worker?.terminate();
    session.worker = null;
    session.mask?.close();
    session.mask = null;
    this.clear();
    this.setState('error');
  }
  update(exposure, now) {
    const session = this.session;
    if (!session?.ready || session.busy || session.track?.muted) return;
    const frame = exposure || session.video;
    if (frame.readyState < 2 || frame.currentTime === session.lastTime ||
        now - session.lastSubmit < (session.worker ? 65 : 110)) return;
    const scale = Math.min(1, 768 / Math.max(frame.videoWidth, frame.videoHeight));
    const width = Math.round(frame.videoWidth * scale), height = Math.round(frame.videoHeight * scale);
    if (!width || !height) return;
    session.lastTime = frame.currentTime;
    session.lastSubmit = now;
    session.frameRevision = session.revision;
    session.busy = true;
    if (this.capture.width !== width || this.capture.height !== height) {
      this.capture.width = width;
      this.capture.height = height;
    }
    try {
      this.captureContext.drawImage(frame, 0, 0, width, height);
      if (session.worker) this.sendFrame(session, now);
      else this.present(session, session.mask.render(this.capture, now));
    } catch { this.failed(session); }
  }
  async sendFrame(session, time) {
    const worker = session.worker;
    let image;
    try {
      image = await createImageBitmap(this.capture);
      if (this.session !== session || session.worker !== worker) { image.close(); return; }
      worker.postMessage({type:'frame', image, time}, [image]);
      session.timer = setTimeout(() => this.useMainThread(session), 8000);
    } catch {
      image?.close();
      if (this.session === session && session.worker === worker) this.useMainThread(session);
    }
  }
  present(session, image) {
    session.busy = false;
    if (session.frameRevision !== session.revision || session.track?.muted) return;
    const out = this.output;
    if (image) {
      if (out.width !== image.width || out.height !== image.height) {
        out.width = image.width;
        out.height = image.height;
      }
      this.context.globalCompositeOperation = 'copy';
      this.context.drawImage(image, 0, 0);
    } else {
      // Keep looking for the next person without redrawing the same empty bench.
      if (session.empty && this.state === 'ready') return;
      this.clear();
    }
    session.empty = !image;
    out.readyState = 2;
    out.currentTime = session.lastSubmit / 1000;
    this.setState('ready');
  }
}
