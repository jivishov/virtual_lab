// Keep the shared activity controls intact while integrating them with the workbench.
function mountCompactHeader() {
  const main = document.querySelector('main');
  const mast = main?.querySelector('.mast');
  const modes = main?.querySelector('.mode-tabs');
  if (!mast || !modes) return false;
  if (main.classList.contains('compact-studio')) return true;

  const chrome = document.createElement('div');
  chrome.className = 'studio-header';
  mast.before(chrome);
  chrome.append(mast, modes);
  main.classList.add('compact-studio');

  mast.querySelector('h1').textContent = 'Molecular studio';
  mast.querySelector('.eyebrow').hidden = true;
  mast.querySelector('.back-link span').textContent = 'Home';
  mast.querySelector('.back-link').title = 'Back to Virtual Lab home';
  for (const [id, label] of [
    ['camera-backdrop', 'In your room'],
    ['immersive', 'Immerse'],
    ['fullscreen', 'Full screen'],
  ]) {
    const button = document.getElementById(id);
    button.setAttribute('aria-label', label);
    if (!button.title) button.title = label;
  }

  // Reparent the existing nodes; their IDs and listeners remain intact.
  mast.querySelector('.back-link').classList.add('ui-topbar');
  const titleRow = document.createElement('div');
  titleRow.className = 'ui-title-row studio-title-row';
  chrome.append(titleRow);
  titleRow.append(mast.querySelector('.title-lockup'), modes, mast.querySelector('.experience-controls'));

  // Reserve a second row only when a control has a status message.
  const caption = document.getElementById('mode-caption');
  caption.setAttribute('role', 'status');
  caption.setAttribute('aria-live', 'polite');
  const showNotice = () => {
    const text = caption.textContent.trim();
    const visible = Boolean(text);
    caption.classList.toggle('header-notice', visible);
    chrome.classList.toggle('has-header-notice', visible);
  };
  new MutationObserver(showNotice).observe(caption, {childList: true, characterData: true, subtree: true});
  showNotice();

  // The stage receives the space recovered by the header, including in full screen.
  new ResizeObserver(() => {
    main.style.setProperty('--studio-header-height', `${chrome.getBoundingClientRect().height}px`);
  }).observe(chrome);
  return true;
}

if (!mountCompactHeader()) {
  const observer = new MutationObserver(() => {
    if (mountCompactHeader()) observer.disconnect();
  });
  observer.observe(document.querySelector('main'), {childList: true, subtree: true});
}
