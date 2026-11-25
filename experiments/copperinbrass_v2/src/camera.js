import { StudioCamera } from '../../spectrophotometry_v2/src/studio-camera.js';
import { HandCamera } from '../../spectrophotometry_v2/src/hand-camera.js';
import { PersonCamera } from '../../spectrophotometry_v2/src/person-camera.js';
import { cameraRect } from '../../spectrophotometry_v2/src/camera-framing.js';

export function cameraControls(renderer, controls, invalidate) {
  const $ = (id) => document.getElementById(id),
    source = new StudioCamera(),
    cursor = $('handCursor');
  const person = new PersonCamera(document.createElement('canvas'), () => {
    $('usePerson').dataset.state = person.state;
    if (person.state === 'error') $('cameraStatus').textContent = 'Camera cutout unavailable.';
    invalidate();
  });
  let armed = false,
    gesture = false,
    pressed = null,
    lastFrame = -1;
  function release() {
    if (controls.stroke?.id === 'hand') controls.cancel();
    armed = false;
    gesture = false;
    pressed = null;
    cursor.hidden = true;
    cursor.classList.remove('grab');
  }
  function packet(data) {
    const lm = data.landmarks[0];
    if (!lm || !source.video || [...controls.points.keys()].some((k) => k !== 'hand')) {
      release();
      return;
    }
    const aspect = source.video.videoWidth / source.video.videoHeight;
    const dist = (a, b) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);
    const ratio = dist(lm[4], lm[8]) / Math.max(0.015, dist(lm[5], lm[17]));
    const w = renderer.canvas.clientWidth,
      h = renderer.canvas.clientHeight;
    const rect = renderer.roomVideoRect || { left: 0, top: 0, width: 1, height: 1 };
    const sensorX = source.mirrored ? 1 - lm[8].x : lm[8].x;
    const point = {
      x: (rect.left + sensorX * rect.width) * w,
      y: (rect.top + lm[8].y * rect.height) * h,
    };
    cursor.hidden = false;
    cursor.style.transform = 'translate(' + point.x + 'px,' + point.y + 'px)';
    if (ratio > 0.53) {
      if (gesture) {
        if (
          pressed &&
          pressed ===
            document.elementFromPoint(point.x, point.y)?.closest('button,summary,input[type=checkbox]')
        )
          pressed.click();
        else if (!pressed) controls.end('hand', point);
      }
      gesture = false;
      pressed = null;
      armed = true;
      cursor.classList.remove('grab');
    } else if (ratio < 0.3 && armed && !gesture) {
      gesture = true;
      armed = false;
      cursor.classList.add('grab');
      pressed =
        document.elementFromPoint(point.x, point.y)?.closest('button,summary,input[type=checkbox]') ||
        null;
      if (!pressed && !document.querySelector('dialog[open]')) controls.start('hand', point);
    } else if (gesture && !pressed) controls.move('hand', point);
  }
  const hands = new HandCamera({
    video: $('cameraVideo'),
    source,
    onFrame: packet,
    onLost: release,
    onActive: (active) => {
      $('useHands').checked = active;
      if (!active) release();
    },
    onStatus: (message) => {
      $('cameraStatus').textContent = message;
    },
  });
  source.addEventListener('change', () => {
    renderer.mirrored = source.mirrored;
    const video = source.owners.has('room') ? source.video : null;
    person.setVideo(video);
    renderer.roomVideo = video ? person.output : null;
    $('usePerson').checked = source.owners.has('room');
    invalidate();
  });
  $('useHands').onchange = () => {
    if ($('useHands').checked) hands.start();
    else hands.stop();
  };
  $('usePerson').onchange = async () => {
    if (!$('usePerson').checked) {
      source.release('room');
      return;
    }
    try {
      await source.use('room');
    } catch (error) {
      $('cameraStatus').textContent = error.message;
      $('usePerson').checked = false;
    }
  };
  function stop() {
    hands.stop();
    source.stopAll();
    person.setVideo(null);
    release();
  }
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
  return (now) => {
    if (!source.video) return false;
    const video = source.video,
      w = renderer.canvas.clientWidth,
      h = renderer.canvas.clientHeight;
    renderer.roomVideoRect = cameraRect(video.videoWidth / video.videoHeight || 4 / 3, w / h, 1);
    if (!source.owners.has('room')) return false;
    person.update(video, now);
    if (lastFrame === person.output.currentTime) return false;
    lastFrame = person.output.currentTime;
    return true;
  };
}
