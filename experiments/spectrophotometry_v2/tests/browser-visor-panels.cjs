// Measure the rendered copy at each breakpoint, then exercise each panel through its controls.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const {useStandardBench} = require('./browser-modes.cjs');

async function checkCopy(page, protocol) {
  const result = await page.evaluate(async protocol => {
    const { createState, getStep, STEPS } = await import('./src/model.js');
    const byId = id => document.getElementById(id);
    const areas = protocol ? ['stepTitle', 'instruction'] : ['visorInstruction', 'hudTarget', 'hudGrip', 'microInstruction'];
    const before = areas.map(id => byId(id).textContent);
    const bounds = new Map();
    const unclipped = [];
    const labels = ['Stock pipette', ...Array.from(byId('targetSelect').options, o => o.text), 'Stock / standards pipette stand'];
    const grips = ['Open palm', 'Regrasp tool', 'Unknown pipette', 'No tool held', 'Starting camera'];
    const tips = ['Hold steady.', 'Drag the stock / standards pipette by its handle, or click to carry it.',
      'Inspecting Spectrophotometer. Drag empty space to orbit. Choose Bench to return.',
      'Hold the bulb and lower it to continue, or press the opening and drag down.'];
    const state = createState();
    const steps = [];
    for (const step of STEPS) {
      state.step = step.index;
      state.analysis.aliquot = 3;
      steps.push(getStep(state));
      if (step.action === 'empty') {
        state.cuvette.inserted = true;
        steps.push(getStep(state));
        state.cuvette.inserted = false;
      }
      if (step.phase === 'recipe') {
        for (const aliquot of [1, 9]) {
          state.analysis.aliquot = aliquot;
          steps.push(getStep(state));
        }
      }
    }
    state.finished = true;
    steps.push(getStep(state));
    try {
      for (const [i, step] of steps.entries()) {
        const values = protocol
          ? [step.phase === 'prepare' ? step.title.replace(/^Prepare (.+)$/, 'Prepare the $1 standard') : step.title, step.instruction]
          : [step.instruction, labels[i % labels.length], grips[i % grips.length], tips[i % tips.length]];
        areas.forEach((id, j) => { byId(id).textContent = values[j]; });
        const selectors = protocol ? ['.current-step', '.step-copy'] : ['#hudProcedure', '.bench-readout', '#interactionStatus'];
        for (const selector of selectors) {
          const height = document.querySelector(selector).getBoundingClientRect().height;
          if (!bounds.has(selector)) bounds.set(selector, new Set());
          bounds.get(selector).add(height);
        }
        for (const id of areas) {
          const el = byId(id);
          const block = id === 'microInstruction' ? el.parentElement : el;
          const box = block.getBoundingClientRect();
          // The font's full ascent can extend into its line's leading. Check the actual
          // panel boundaries and adjacent rows, as well as the column's width.
          const enclosing = el.closest('.current-step,#hudProcedure,.bench-readout').getBoundingClientRect();
          const next = id === 'stepTitle' ? byId('instruction') : id === 'hudTarget' || id === 'hudGrip' ? byId('interactionStatus') : null;
          const bottom = next ? next.getBoundingClientRect().top : enclosing.bottom;
          const range = document.createRange();
          range.selectNodeContents(el);
          for (const r of range.getClientRects()) {
            if (r.right > box.right + 1 || r.bottom > bottom + 1 || r.left < box.left - 1 || r.top < enclosing.top - 1) {
              unclipped.push({ id, text: el.textContent }); break;
            }
          }
        }
      }
    } finally {
      areas.forEach((id, i) => { byId(id).textContent = before[i]; });
    }
    return { heights: Object.fromEntries([...bounds].map(([k, v]) => [k, [...v]])), overflow: unclipped.slice(0, 3) };
  }, protocol);
  for (const [id, heights] of Object.entries(result.heights)) {
    assert.equal(heights.length, 1, `${JSON.stringify(page.viewportSize())} ${id} changed heights: ${heights}`);
  }
  assert.deepEqual(result.overflow, [], 'Wrapped copy escapes the available space');
  return result.heights;
}

async function checkPanel(page, id) {
  const panel = page.locator('#' + id);
  const shape = await panel.evaluate(el => {
    const b = el.getBoundingClientRect(), s = getComputedStyle(el);
    return { visible: b.width > 0 && b.height > 0, inside: b.left >= -1 && b.right <= innerWidth + 1 &&
      b.top >= -1 && b.bottom <= innerHeight + 1, horizontalOverflow: el.scrollWidth - el.clientWidth,
      colorScheme: s.colorScheme, surface: s.backgroundColor };
  });
  const classic = await page.locator('html').getAttribute('data-theme') === 'classic';
  assert.deepEqual(shape, { visible: true, inside: true, horizontalOverflow: 0, colorScheme: classic ? 'light' : 'dark',
    surface: classic ? 'rgb(250, 249, 245)' : 'rgb(14, 35, 50)' }, id);
  for (const control of await panel.locator('select:visible,button:visible,summary:visible,input:visible,textarea:visible').all()) {
    await control.scrollIntoViewIfNeeded();
    const hit = await control.evaluate(el => {
      const b = el.getBoundingClientRect();
      const at = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return el === at || el.contains(at);
    });
    assert.ok(hit, id + ' obscures ' + await control.evaluate(el => el.id || el.value || el.textContent) +
      ' at ' + page.viewportSize().width + 'px in ' + (classic ? 'Classic' : 'SciFi'));
  }
}

async function checkToolbar(page) {
  const problems = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect();
    const rows = ['.camera-tools', '#liveHandModes', '#immersiveActions'].map(rect);
    const spectrum = rect('#wavelengthScale'), views = rect('.station-views'), guide = rect('#hudProcedure');
    const errors = [];
    const overlaps = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.height || Math.abs(row.right - rows[0].right) > 1 || i && row.top < rows[i-1].bottom) errors.push('command row ' + i);
      if (overlaps(row, views) || overlaps(row, spectrum)) errors.push('left and right controls overlap');
    }
    if (!spectrum.height || spectrum.top < views.bottom || Math.abs(spectrum.left - views.left) > 1) errors.push('wavelength placement');
    for (const b of [...rows, views, spectrum]) {
      if (overlaps(guide, b)) errors.push('procedure overlap');
    }
    for (const button of document.querySelectorAll('#stationBar button')) {
      const b = button.getBoundingClientRect();
      if (!b.width || !button.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2))) errors.push(button.id || button.title);
    }
    return errors;
  });
  assert.deepEqual(problems, [], JSON.stringify(page.viewportSize()) + ' toolbar');
}

async function visitPanels(page, immersive) {
  await page.locator('#handButton').click(); await checkPanel(page, 'handPanel'); await page.locator('#handClose').click();
  await page.locator('#cameraSettingsButton').click(); await checkPanel(page, 'cameraPanel'); await page.locator('#cameraClose').click();
  for (const [menu, panel] of [['targetsMenu', 'targetsPanel'], ['inspectMenu', 'inspectPanel'], ['labMenu', 'settingsPanel']]) {
    const trigger = page.locator('#' + menu + ' summary');
    await trigger.click(); await checkPanel(page, panel); await trigger.click();
  }
  await page.locator('#arrangeButton').click();
  const details = page.locator('#layoutPanel details');
  if (!await details.evaluate(e => e.open)) await details.locator('summary').click();
  await checkPanel(page, 'layoutPanel'); await page.locator('.layout-done').click();
  if (immersive) await page.locator('#immersiveProtocol').click();
  await checkPanel(page, 'taskRibbon');
  if (immersive) await page.locator('#immersiveProtocol').click();
  await page.locator(immersive ? '#immersiveNotebook' : '#notebookButton').click();
  await checkPanel(page, 'notebookDialog');
  await page.locator('#notebookDialog [data-close]').click();
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.STUDIO_URL || 'http://127.0.0.1:8774/');
    await page.waitForFunction(() => !!window.lab);
    await useStandardBench(page);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'scifi');
    const header = page.locator('#headerTheme');
    await header.getByRole('radio', { name: 'SciFi' }).focus();
    await page.keyboard.press('ArrowLeft');
    assert.ok(await header.getByRole('radio', { name: 'Classic' }).isChecked());
    await page.reload(); await page.waitForFunction(() => !!window.lab);
    await useStandardBench(page);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'scifi');
    for (const [width, height] of [[1440, 900], [768, 600], [740, 380], [390, 844], [320, 568]]) {
      await page.setViewportSize({ width, height });
      await checkCopy(page, true);
      for (const theme of ['Classic', 'SciFi']) {
        await header.getByRole('radio', { name: theme }).check();
        for (const immersive of [false, true]) {
          if (immersive) await page.locator('#immerseButton').click();
          const light = theme === 'Classic';
          const surfaces = await page.evaluate(() => ['.topbar','.station-views','.camera-tools','.bench-dock','#taskRibbon','#loading'].map(selector => {
            const rgb = getComputedStyle(document.querySelector(selector)).backgroundColor.match(/[\d.]+/g).map(Number);
            return rgb.length >= 3 && (rgb.length === 3 || rgb[3] > 0) && (rgb[0]+rgb[1]+rgb[2])/3 > 128;
          }));
          assert.ok(surfaces.every(value => value === light), theme + ' header, toolbars, loader and protocol must match');
          await visitPanels(page, immersive);
          if (immersive) await page.locator('#exitImmersive').click();
        }
      }
    }
    await page.locator('#immerseButton').click();
    await page.locator('#targetsMenu summary').click();
    await page.locator('#targetsMenu summary').click();
    for (const [width, height] of [[1440, 900], [1280, 800], [1091, 720], [1024, 768], [768, 600], [740, 380], [600, 380], [566, 720], [446, 800], [411, 800], [390, 844], [360, 640], [320, 568]]) {
      await page.setViewportSize({ width, height });
      await page.waitForFunction(w => lab.renderInfo.css[0] === w && !document.getElementById('hudProcedure').hidden &&
        !document.getElementById('microInstruction').hidden, width);
      await checkToolbar(page);
      const hud = await checkCopy(page, false);
      await page.locator('#immersiveProtocol').click();
      await checkCopy(page, true);
      await page.locator('#immersiveProtocol').click();
      console.log(width, height, JSON.stringify(hud));
    }
    for (const mode of ['view', 'work']) {
      await page.locator('[data-quick-mode="' + mode + '"]').click();
      assert.ok(await page.locator('#handPanel').isVisible());
      assert.equal(await page.locator('[data-hand-mode="' + mode + '"]').getAttribute('aria-pressed'), 'true');
      assert.deepEqual(await page.evaluate(() => lab.studio.cameraUsers), []);
      await page.keyboard.press('Escape');
    }
    await page.locator('#labMenu summary').click();
    const slider = page.getByRole('slider', { name: 'Wavelength', exact: true });
    const exact = page.locator('#wavelength');
    const checkWavelength = nm => page.waitForFunction(value =>
      lab.state.wavelength === value && document.getElementById('wavelength').valueAsNumber === value &&
      document.getElementById('wavelengthSlider').valueAsNumber === value &&
      document.getElementById('wavelengthSlider').getAttribute('aria-valuetext') === value + ' nanometers' &&
      document.getElementById('waveReadout').textContent === value + ' nm' &&
      document.getElementById('scaleValue').textContent === value + ' nm', nm);
    await slider.press('Home'); await checkWavelength(400);
    await slider.press('End'); await checkWavelength(700);
    await slider.press('ArrowLeft'); await checkWavelength(699);

    const box = await slider.boundingBox(), midY = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width - 7, midY);
    await page.mouse.down();
    try {
      await page.mouse.move(box.x + box.width * .35, midY, { steps: 5 });
      const nm = Number(await slider.inputValue());
      assert.ok(nm > 495 && nm < 515, 'Dragging the spectrum should tune the wavelength');
      await checkWavelength(nm);
    } finally { await page.mouse.up(); }

    await exact.fill('550'); await exact.press('Tab');
    await checkWavelength(550);
    await page.locator('#labMenu summary').click();
    assert.equal(await page.locator('.spectrum-ruler i').evaluate(el => getComputedStyle(el).getPropertyValue('--wavelength')), '50%');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
