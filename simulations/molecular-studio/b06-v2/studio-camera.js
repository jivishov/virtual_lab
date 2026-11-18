// A room backdrop and a hand-building session can share one physical camera.
const owners = new Set();
const events = new EventTarget();
let video = null, pending = null, generation = 0, mirrored = true;
const aborted = () => new DOMException('Camera request ended', 'AbortError');
const stopTracks = stream => stream?.getTracks().forEach(track => track.stop());
const notify = () => events.dispatchEvent(new Event('change'));

async function open(deviceId, facingMode) {
  const token = generation;
  const devices = navigator.mediaDevices;
  if (!devices?.getUserMedia) throw new Error('Open the local preview or use HTTPS to enable the camera.');
  const stream = await devices.getUserMedia({audio: false, video: {
    ...(deviceId ? {deviceId: {exact: deviceId}} : {facingMode: {ideal: facingMode}}),
    width: {ideal: 1280}, height: {ideal: 720}, frameRate: {ideal: 30}
  }});
  const next = document.createElement('video');
  next.muted = next.playsInline = next.autoplay = true;
  try {
    if (generation !== token || document.hidden) throw aborted();
    next.srcObject = stream;
    await next.play();
    if (generation !== token || document.hidden) throw aborted();
  } catch (error) {
    stopTracks(stream);
    next.srcObject = null;
    throw error;
  }
  const prior = video;
  video = next;
  const track = stream.getVideoTracks()[0];
  const facing = track.getSettings().facingMode;
  mirrored = facing ? facing === 'user' : true;
  track.addEventListener('ended', () => { if (video === next) stopAll(); }, {once:true});
  if (prior) { stopTracks(prior.srcObject); prior.srcObject = null; }
  notify();
}

function opening(deviceId, facingMode) {
  const task = open(deviceId, facingMode).finally(() => { if (pending === task) pending = null; });
  pending = task;
  return task;
}

function stopAll() {
  generation++;
  owners.clear();
  pending = null;
  if (video) { stopTracks(video.srcObject); video.srcObject = null; video = null; }
  notify();
}

export const studioCamera = {
  events,
  get video() { return video; },
  get mirrored() { return mirrored; },
  has(owner) { return owners.has(owner); },
  async use(owner) {
    const token = generation;
    owners.add(owner);
    try {
      if (!video) await (pending || opening('', owner === 'hands' ? 'user' : 'environment'));
      if (token !== generation || !owners.has(owner) || !video) throw aborted();
      return video;
    } catch (error) {
      if (token === generation) owners.delete(owner);
      throw error;
    }
  },
  release(owner) {
    if (owners.delete(owner) && !owners.size) stopAll();
  },
  async inputs() {
    try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); }
    catch { return []; }
  },
  async switchDevice() {
    const previous = video, inputs = await this.inputs();
    if (!previous || previous !== video || inputs.length < 2 || pending) return;
    const id = previous.srcObject.getVideoTracks()[0].getSettings().deviceId;
    await opening(inputs[(inputs.findIndex(d => d.deviceId === id) + 1) % inputs.length].deviceId, 'user');
  },
  flip() { mirrored = !mirrored; notify(); },
  stopAll
};
document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); });
window.addEventListener('pagehide', stopAll);
