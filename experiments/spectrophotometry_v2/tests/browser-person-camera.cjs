const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright');
const {installCalibrationCamera} = require('./person-camera-fixture.cjs');
const url = process.env.STUDIO_URL || 'http://127.0.0.1:8774/';

function matte() {
  const canvas = document.querySelector('#handForeground');
  const {width, height} = canvas;
  const rgba = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  const alpha = (x, y) => rgba[(Math.floor(y * height / 720) * width + Math.floor(x * width / 960)) * 4 + 3];
  let opaque = 0, soft = 0;
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] > 230) opaque++;
    else if (rgba[i] > 15) soft++;
  }
  return {face:alpha(352, 157), movedFace:alpha(717,157), jacket:alpha(242, 416), flag:alpha(109, 75),
    backdrop:alpha(875, 180), opaque:opaque / (width * height), soft:soft / (width * height)};
}
function benchPixels() {
  const sample = document.createElement('canvas');
  sample.width = 170;
  sample.height = 96;
  const ctx = sample.getContext('2d');
  ctx.drawImage(document.querySelector('#labCanvas'), 0, 0, sample.width, sample.height);
  return Array.from(ctx.getImageData(0, 0, sample.width, sample.height).data);
}
function difference(a, b) {
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.max(...[0, 1, 2].map(c => Math.abs(a[i + c] - b[i + c]))) > 12) changed++;
  }
  return changed / (a.length / 4);
}
async function rendered(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page.evaluate(benchPixels);
}
async function run() {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,
    args:['--enable-gpu','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await installCalibrationCamera(page);
    await page.goto(url);
    await page.waitForFunction(() => window.lab?.studio.liveRoom && lab.hand.state.backend, null, {timeout:60000});
    assert.equal(await page.evaluate(() => getComputedStyle(handVideo).opacity),'0');
    const seen = await page.evaluate(matte);
    assert.ok(seen.face > 230 && seen.jacket > 230 && seen.backdrop < 4 && seen.flag < 15, JSON.stringify(seen));
    assert.ok(seen.opaque > .10 && seen.opaque < .32 && seen.soft > .001, JSON.stringify(seen));
    await rendered(page);
    if (process.env.PERSON_SCREENSHOT) await page.screenshot({path:process.env.PERSON_SCREENSHOT,quality:93});
    for (const [size,width,height] of [['tablet',1024,768],['desktop',1902,901]]) {
      await page.setViewportSize({width,height});
      await page.waitForFunction(w => lab.renderInfo.css[0] === w,width);
      assert.ok((await page.evaluate(matte)).face > 230);
      if (process.env.PERSON_SCREENSHOT) {
        const file = path.parse(process.env.PERSON_SCREENSHOT);
        await page.screenshot({path:path.join(file.dir,file.name+'-'+size+file.ext),quality:91});
      }
    }
    await page.setViewportSize({width:1440,height:900});
    await page.waitForFunction(() => lab.renderInfo.css[0] === 1440);
    const portrait = await rendered(page);

    await page.locator('#cameraSettingsButton').click();
    await page.locator('#photoRoom').click();
    await page.waitForFunction(() => !lab.studio.liveRoom);
    assert.deepEqual(await page.evaluate(() => [lab.studio.cameraUsers, calibrationTrack.readyState]), [['hands'], 'live']);
    assert.equal((await page.evaluate(matte)).opaque, 0);
    const labOnly = await rendered(page);
    assert.ok(difference(portrait, labOnly) > .035, 'The person appears behind the bench');
    await page.locator('#liveRoom').click();
    await page.waitForFunction(() => lab.studio.liveRoom);
    assert.equal(await page.evaluate(() => cameraRequests), 1);
    await page.evaluate(() => { window.cameraScene = 'right'; });
    await page.waitForFunction(`(() => { const m = (${matte})(); return m.face < 8 && m.movedFace > 230; })()`);
    await page.evaluate(() => { window.cameraScene = 'empty'; });
    await page.waitForFunction(`(${matte})().opaque < .003`);
    assert.ok(difference(await rendered(page), labOnly) < .004, 'An empty camera exposes the original themed scene');

    await page.evaluate(() => { window.cameraScene = 'portrait'; });
    await page.waitForFunction(`(${matte})().face > 230`);
    await page.locator('#cameraClose').click();
    await page.locator('#labMenu summary').click();
    await page.locator('#benchFinish').selectOption('refined');
    await page.waitForFunction(() => lab.renderInfo.finish === 'refined');
    await page.locator('#labMenu summary').click();
    assert.ok(difference(await rendered(page), portrait) > .25, 'Switching the room preserves the person');
    await page.locator('#handButton').click();
    assert.match(await page.locator('#handImageFrame').evaluate(el => getComputedStyle(el).backgroundImage), /refined\/clean-lab/);
    assert.ok((await page.evaluate(matte)).jacket > 230);
    await page.locator('#handClose').click();
    await page.locator('#cameraButton').click();
    assert.deepEqual(await page.evaluate(() => [lab.studio.liveRoom, calibrationTrack.readyState, lab.studio.cameraUsers]), [false, 'ended', []]);
    assert.equal((await page.evaluate(matte)).opaque, 0);
    await page.close();

    // Exercise the compatible renderer on a browser without worker segmentation.
    // Block the model first to verify that an unavailable mask never exposes raw video.
    const retry = await browser.newPage();
    retry.on('pageerror', error => errors.push(error.message));
    await retry.addInitScript(() => {
      const NativeWorker = Worker;
      window.Worker = class extends NativeWorker {
        constructor(url, options) {
          if (String(url).includes('person-worker.js')) throw Error('No segmentation worker');
          super(url, options);
        }
      };
    });
    const model = '**/models/selfie_segmenter_landscape.tflite';
    await retry.route(model, route => route.abort());
    await installCalibrationCamera(retry);
    await retry.goto(url);
    await retry.waitForFunction(() => document.querySelector('#roomStatus').textContent.includes('retry'));
    assert.equal(await retry.evaluate(() => lab.studio.liveRoom), false);
    assert.equal((await retry.evaluate(matte)).opaque, 0);
    assert.equal(await retry.locator('#handVideo').evaluate(el => getComputedStyle(el).opacity), '0');
    await retry.unroute(model);
    await retry.locator('#cameraSettingsButton').click();
    await retry.locator('#liveRoom').click();
    await retry.waitForFunction(() => lab.studio.liveRoom, null, {timeout:60000});
    assert.ok((await retry.evaluate(matte)).face > 230);
    assert.equal(await retry.evaluate(() => cameraRequests), 1);
    assert.deepEqual(errors, []);
    console.log('Real person matte, empty scene, theme change, shared camera, stop, model failure and main-thread retry passed.', seen);
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
