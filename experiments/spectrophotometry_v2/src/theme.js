// Each visit starts in SciFi. Both theme switches control the current page.
(() => {
  const root = document.documentElement;

  document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('headerTheme');
    const settings = header.cloneNode(true);
    settings.id = 'settingsTheme';
    for (const input of settings.querySelectorAll('input')) input.name = 'settings-theme';
    document.getElementById('settingsThemeSlot').replaceWith(settings);

    const choices = document.querySelectorAll('.theme-switch input');
    function select(value) {
      root.dataset.theme = value;
      for (const input of choices) input.checked = input.value === root.dataset.theme;
    }
    select('scifi');
    for (const input of choices) {
      input.addEventListener('change', () => select(input.value));
    }
  });
})();
