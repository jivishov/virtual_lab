// Presentation only: the original select, values and application events remain authoritative.
const entries = new Map();
const knownEntries = new WeakMap();
const watchedOptions = new WeakSet();
const variants = new Set(['segment', 'chips', 'cards', 'list']);
let observer, queued = false;
let pendingFocus = null;

function labelFor(select) {
  const named = select.getAttribute('aria-label') || select.getAttribute('data-label');
  if (named) return named.trim();
  const labelled = (select.getAttribute('aria-labelledby') || '').split(/\s+/)
    .map(id => document.getElementById(id)?.textContent.trim()).filter(Boolean).join(' ');
  if (labelled) return labelled;
  return [...(select.labels || [])].map(label => {
    const copy = label.cloneNode(true);
    copy.querySelectorAll('select, .ui-choices, input, button').forEach(node => node.remove());
    return copy.textContent.replace(/\s+/g, ' ').trim();
  }).filter(Boolean).join(' ') || 'Choose an option';
}

function visibleOptions(select) {
  // Empty values can be real actions (clear a site, return to the current record).
  // Only explicitly marked controls expose them; ordinary prompts stay hidden.
  return [...select.options].filter(option => (option.value !== '' || select.hasAttribute('data-choice-empty')) && !option.hidden &&
    !(option.parentElement.tagName === 'OPTGROUP' && option.parentElement.hidden));
}

function variantFor(select, options) {
  if (variants.has(select.dataset.choice)) return select.dataset.choice;
  const counted = options.filter(option => option.value !== '');
  const labels = counted.map(option => option.text.trim());
  // Long address libraries stay bounded even when an individual address is verbose.
  if (counted.length >= 9) return 'list';
  if (labels.some(label => label.length > 24)) return 'cards';
  if ((counted.length >= 2 && counted.length <= 3 && labels.every(label => label.length <= 16)) ||
      (counted.length > 0 && counted.length <= 7 && labels.every(label => !/\s/.test(label)))) return 'segment';
  return 'chips';
}

function schedule() {
  if (!queued) {
    queued = true;
    requestAnimationFrame(sync);
  }
}

function focusChoice(entry, value, preventScroll = true) {
  const buttons = [...entry.group.querySelectorAll('button:not(:disabled)')];
  const target = buttons.find(button => button.dataset.value === value) ||
    buttons.find(button => button.getAttribute('aria-checked') === 'true') || buttons[0];
  (target || entry.group).focus({ preventScroll });
}

function activate(select, button) {
  if (select.disabled || select.matches(':disabled') || button.disabled) return;
  const wasFocused = button === document.activeElement;
  select.value = button.dataset.value;
  const entry = entries.get(select);
  entry.group.classList.remove('ui-required');
  entry.group.removeAttribute('aria-invalid');
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
  // Some benches replace the entire current-step form in their change handler.
  if (wasFocused && !select.isConnected && select.id) pendingFocus = { id: select.id, value: button.dataset.value };
  schedule();
}

function upgrade(select) {
  if (entries.has(select)) return entries.get(select);
  if (knownEntries.has(select)) {
    const entry = knownEntries.get(select);
    entries.set(select, entry);
    select.after(entry.group);
    return entry;
  }
  const group = document.createElement('div');
  group.className = 'ui-choices';
  group.setAttribute('role', 'radiogroup');
  group.tabIndex = -1;
  const entry = { select, group, signature: '', lastScrolled: null, buttons: [] };
  entries.set(select, entry);
  knownEntries.set(select, entry);
  select.classList.add('ui-select-source');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  select.after(group);

  // Instance wrappers retain the browser's native getters/setters, including validation.
  for (const property of ['value', 'selectedIndex']) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, property);
    Object.defineProperty(select, property, {
      configurable: true, enumerable: descriptor.enumerable,
      get() { return descriptor.get.call(this); },
      set(value) { descriptor.set.call(this, value); schedule(); },
    });
  }
  select.addEventListener('focus', () => focusChoice(entry));
  select.addEventListener('invalid', event => {
    event.preventDefault();
    group.classList.add('ui-required');
    group.setAttribute('aria-invalid', 'true');
    focusChoice(entry, undefined, false);
  });
  group.addEventListener('click', event => {
    const button = event.target.closest('button[data-value]');
    if (!button || !group.contains(button)) return;
    event.preventDefault(); // Do not activate a wrapping label's hidden select.
    activate(select, button);
  });
  group.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const buttons = [...group.querySelectorAll('button:not(:disabled)')];
    if (!buttons.length) return;
    event.preventDefault();
    const current = buttons.indexOf(event.target.closest('button'));
    const delta = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
      (current + delta + buttons.length) % buttons.length;
    buttons[index].focus({ preventScroll: true });
    activate(select, buttons[index]);
  });
  return entry;
}

// Keep hyphenated names and specimen codes together without changing their text.
function appendChoiceText(parent, value) {
  for (const part of value.split(/(\s+)/)) {
    if (!part) continue;
    if (/\s/.test(part)) parent.append(document.createTextNode(part));
    else {
      const token = document.createElement('span');
      token.className = 'ui-choice-token';
      token.textContent = part;
      parent.append(token);
    }
  }
}

function renderOptions(entry, options, variant) {
  const fragment = document.createDocumentFragment();
  let parent, previous;
  entry.buttons = [];
  for (const option of options) {
    const optgroup = option.parentElement.tagName === 'OPTGROUP' ? option.parentElement : null;
    if (!parent || optgroup !== previous) {
      if (optgroup) {
        const heading = document.createElement('div');
        heading.className = 'ui-choice-heading';
        heading.textContent = optgroup.label;
        fragment.append(heading);
      }
      parent = document.createElement('div');
      parent.className = 'ui-choice-options';
      fragment.append(parent);
      previous = optgroup;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ui-choice';
    button.dataset.value = option.value;
    button.setAttribute('role', 'radio');
    button.title = option.title || option.text;
    if (option.hasAttribute('aria-label')) button.setAttribute('aria-label', option.getAttribute('aria-label'));
    const text = document.createElement('span');
    text.className = 'ui-choice-text';
    const formula = entry.select.dataset.choiceFormat === 'formula' && option.text.match(/^(.*?) · (.*)$/s);
    const address = variant === 'list' && option.text.match(/^(.*?)( · |\t)(.*)$/s);
    if (formula) {
      const symbol = document.createElement('strong');
      symbol.className = 'ui-choice-formula';
      appendChoiceText(symbol, formula[1]);
      const name = document.createElement('small');
      name.className = 'ui-choice-sub';
      appendChoiceText(name, formula[2]);
      text.append(symbol, name);
      button.setAttribute('aria-label', option.getAttribute('aria-label') || option.text);
    } else if (address) {
      const prefix = document.createElement('span');
      prefix.className = 'ui-choice-address';
      appendChoiceText(prefix, address[1]);
      text.append(prefix);
      appendChoiceText(text, address[2] + address[3]);
    } else appendChoiceText(text, option.text);
    button.append(text);
    if (option.dataset.sub) {
      const sub = document.createElement('span');
      sub.className = 'ui-choice-sub';
      appendChoiceText(sub, option.dataset.sub);
      button.append(sub);
    }
    parent.append(button);
    entry.buttons.push({ option, button });
  }
  entry.group.replaceChildren(fragment);
}

function sync() {
  queued = false;
  if (!document.body) return;
  for (const [select, entry] of entries) {
    if (!document.body.contains(select)) {
      entry.group.remove();
      entries.delete(select);
    }
  }
  for (const select of document.body.querySelectorAll('select')) {
    const entry = upgrade(select), { group } = entry;
    // Keep the presentation beside a control moved by the workspace or app.
    if (select.nextElementSibling !== group) select.after(group);
    const options = visibleOptions(select);
    // selected is a property-only state too; setting it need not mutate an attribute.
    for (const option of select.options) if (!watchedOptions.has(option)) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLOptionElement.prototype, 'selected');
      Object.defineProperty(option, 'selected', {
        configurable: true, enumerable: descriptor.enumerable,
        get() { return descriptor.get.call(this); },
        set(value) { descriptor.set.call(this, value); schedule(); },
      });
      watchedOptions.add(option);
    }
    const variant = variantFor(select, options);
    const disabled = select.matches(':disabled');
    const label = labelFor(select);
    const signature = JSON.stringify([variant, select.dataset.choiceFormat, label, options.map(option => [option.value, option.text,
      option.title, option.dataset.sub, option.getAttribute('aria-label'), option.parentElement.tagName === 'OPTGROUP' ?
        [...select.children].indexOf(option.parentElement) + ':' + option.parentElement.label : null])]);
    const focused = group.contains(document.activeElement) ? document.activeElement.dataset.value : null;
    if (signature !== entry.signature) {
      entry.signature = signature;
      group.dataset.variant = variant;
      group.dataset.format = select.dataset.choiceFormat || '';
      group.setAttribute('aria-label', label);
      renderOptions(entry, options, variant);
      entry.lastScrolled = null;
    } else {
      // Replaced option nodes can have identical content; always use the live nodes.
      entry.buttons.forEach((item, index) => { item.option = options[index]; });
    }
    group.hidden = select.hidden || !options.length;
    group.setAttribute('aria-disabled', String(disabled));
    group.setAttribute('aria-required', String(select.required));
    const description = select.getAttribute('aria-describedby');
    if (description) group.setAttribute('aria-describedby', description);
    else group.removeAttribute('aria-describedby');
    let checked;
    for (const { option, button } of entry.buttons) {
      button.disabled = disabled || option.disabled || (option.parentElement.tagName === 'OPTGROUP' && option.parentElement.disabled);
      button.setAttribute('aria-checked', String(option.selected));
      button.tabIndex = -1;
      if (option.selected) checked = button;
    }
    const tabbable = checked && !checked.disabled ? checked : entry.buttons.find(({ button }) => !button.disabled)?.button;
    if (tabbable) tabbable.tabIndex = 0;
    if (select.validity.valid) {
      group.classList.remove('ui-required');
      group.removeAttribute('aria-invalid');
    }
    if (focused !== null && !group.contains(document.activeElement)) focusChoice(entry, focused);
    if (variant === 'list' && checked && group.getBoundingClientRect().height && entry.lastScrolled !== select.value) {
      // Only scroll the list; scrollIntoView would also move the page and procedure panel.
      const row = checked.getBoundingClientRect(), box = group.getBoundingClientRect();
      if (row.top < box.top + 28) group.scrollTop += row.top - box.top - 28;
      else if (row.bottom > box.bottom) group.scrollTop += row.bottom - box.bottom;
      entry.lastScrolled = select.value;
    }
  }
  if (pendingFocus) {
    const entry = entries.get(document.getElementById(pendingFocus.id));
    if (entry) focusChoice(entry, pendingFocus.value);
    pendingFocus = null;
  }
}

// Kept as a named export for the workspace and existing B06 render calls.
export function choiceStrips() {
  if (!document.body) return;
  if (!observer) {
    observer = new MutationObserver(records => {
      if (records.some(record => !record.target.closest?.('.ui-choices'))) schedule();
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['disabled', 'hidden', 'selected', 'value', 'label', 'title', 'required',
        'aria-label', 'aria-labelledby', 'aria-describedby', 'data-sub', 'data-choice', 'data-choice-format', 'data-choice-empty'] });
    document.body.addEventListener('input', schedule);
    document.body.addEventListener('change', schedule);
    document.body.addEventListener('reset', schedule);
  }
  sync();
}

window.__uiChoices = () => [...entries.keys()].filter(select => select.isConnected).length;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => choiceStrips(), { once: true });
else choiceStrips();
