export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));

// A tap selects the piece. A drag commits once, on release over a valid target.
// The caller supplies native button and keyboard paths for the same action.
export function mountPointerDrag(root, {sources, targets, read, accept = () => true, drop, pick, label, reject}) {
  const controller = new AbortController();
  const listen = (node, name, fn) => node.addEventListener(name, fn, {signal: controller.signal, capture: true});
  let active = null, ghost = null, hover = null, swallowClick = false;

  function release() {
    const id = active?.pointerId;
    active = null;
    hover?.classList.remove('direct-drop-active');
    hover = null;
    ghost?.remove();
    ghost = null;
    root.classList.remove('direct-dragging');
    if (id !== undefined && root.hasPointerCapture(id)) root.releasePointerCapture(id);
  }
  function targetAt(event) {
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(targets);
    return target && root.contains(target) && accept(active.data, target) ? target : null;
  }
  listen(root, 'pointerdown', event => {
    if (active || !event.isPrimary || event.button !== 0) return;
    swallowClick = false;
    const source = event.target.closest(sources);
    if (!source || source.disabled) return;
    const data = read(source);
    if (!data) return;
    active = {source, data, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false};
    root.setPointerCapture(event.pointerId);
  });
  listen(root, 'pointermove', event => {
    if (!active || event.pointerId !== active.pointerId) return;
    if (!active.moved && Math.hypot(event.clientX - active.x, event.clientY - active.y) < 6) return;
    event.preventDefault();
    active.moved = true;
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.className = 'direct-drag-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      ghost.textContent = label(active.data);
      document.body.append(ghost);
      root.classList.add('direct-dragging');
    }
    ghost.style.transform = `translate(${event.clientX + 14}px,${event.clientY + 14}px)`;
    const target = targetAt(event);
    if (target === hover) return;
    hover?.classList.remove('direct-drop-active');
    hover = target;
    hover?.classList.add('direct-drop-active');
  });
  listen(root, 'pointerup', event => {
    if (!active || event.pointerId !== active.pointerId) return;
    const gesture = active;
    const target = targetAt(event);
    swallowClick = true;
    release();
    if (!gesture.moved) pick(gesture.data, gesture.source, event);
    else if (target) drop(gesture.data, target, event);
    else reject?.(gesture.data);
  });
  listen(root, 'click', event => {
    if (!swallowClick || event.detail === 0) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  });
  listen(root, 'pointercancel', event => {
    if (event.pointerId === active?.pointerId) release();
  });
  listen(root, 'lostpointercapture', event => {
    if (event.pointerId === active?.pointerId) release();
  });
  listen(document, 'keydown', event => {
    if (event.key !== 'Escape' || !active) return;
    event.preventDefault();
    swallowClick = true;
    release();
  });
  return () => {release(); controller.abort();};
}
