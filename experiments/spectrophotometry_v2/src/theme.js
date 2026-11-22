// Apply the saved appearance before styles or the bench are painted.
(() => {
  const key = 'spectrophotometry-v2-theme';
  const root = document.documentElement;
  const resolve = value => value === 'classic' ? 'classic' : 'scifi';
  try { root.dataset.theme = resolve(localStorage.getItem(key)); } catch {}

  document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('headerTheme');
    const settings = header.cloneNode(true);
    settings.id = 'settingsTheme';
    for (const input of settings.querySelectorAll('input')) input.name = 'settings-theme';
    document.getElementById('settingsThemeSlot').replaceWith(settings);

    const choices = document.querySelectorAll('.theme-switch input');
    function select(value) {
      root.dataset.theme = resolve(value);
      for (const input of choices) input.checked = input.value === root.dataset.theme;
    }
    select(root.dataset.theme);
    for (const input of choices) {
      input.addEventListener('change', () => {
        select(input.value);
        try { localStorage.setItem(key, root.dataset.theme); } catch {}
      });
    }
    window.addEventListener('storage', event => {
      if (event.key === key || event.key === null) select(event.newValue);
    });
  });
})();
