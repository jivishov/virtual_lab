// Coordinates use the top left of the bench and the displayed (possibly mirrored) video.
export const DEFAULT_CAMERA_SIZE = .8;
export const CAMERA_SIZE_KEY = 'spectrophotometry-studio.camera-size';

export function savedCameraSize(value) {
  const size = Number(value);
  return Number.isFinite(size) && size >= .5 && size <= 1 ? size : DEFAULT_CAMERA_SIZE;
}

function axisOrigin(size, start, span, palm) {
  const center = start + span / 2;
  const origin = .5 - center * size;
  if (palm == null) return origin;

  // Hold the image still in the central part of the work area. At the sides,
  // translate it gently so the palm can reach the bench edge at its true scale.
  const distance = (palm - center) / (span / 2);
  const t = Math.max(0, Math.min(1, (Math.abs(distance) - .22) / .78));
  // Short ramps keep outer targets from feeling more sensitive than nearby tools.
  const ramp = .1;
  let ease = (t - ramp / 2) / (1 - ramp);
  if (t < ramp) ease = t * t / (2 * ramp * (1 - ramp));
  if (t > 1 - ramp) ease = 1 - (1 - t) ** 2 / (2 * ramp * (1 - ramp));
  return origin + Math.sign(distance) * ease * (1 - span * size) / 2;
}

export function cameraRect(videoAspect, benchAspect, size, area = {left:0, top:0, width:1, height:1}, palm = null) {
  const width = size * Math.min(1, videoAspect / benchAspect);
  const height = size * Math.min(1, benchAspect / videoAspect);
  return {
    left: axisOrigin(width, area.left, area.width, palm?.x),
    top: axisOrigin(height, area.top, area.height, palm?.y),
    width, height
  };
}
