const assert = require('node:assert/strict');
const {chromium} = require('playwright');

const studio = process.env.STUDIO_URL || 'http://127.0.0.1:8774/';
const preference = 'spectrophotometry-v2-bench-finish';

async function openLab(page, url = studio) {
  await page.goto(url);
  await page.waitForFunction(() => !!window.lab);
}

async function frame(page) {
  await page.mouse.move(5, 5);
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  return page.locator('#labCanvas').screenshot({style:'.stage > :not(#labCanvas) { visibility:hidden !important }'});
}

async function selectFinish(page, finish) {
  await page.locator('#labMenu summary').click();
  await page.locator('#benchFinish').selectOption(finish);
  await page.waitForFunction(value => lab.renderInfo.finish === value, finish);
  await page.locator('#labMenu summary').click();
}

async function instrument(page) {
  await page.locator('#inspectMenu summary').click();
  await page.locator('#inspectEquipment').selectOption('instrument');
}

async function snapshot(page) {
  return page.evaluate(() => ({
    state:lab.state, camera:lab.camera, layout:lab.layout, equipment:lab.equipmentPositions, poses:lab.poses,
    controls:['lid','zero','read'].map(id => lab.targeting.targets[id]),
  }));
}

// Compare decoded pixels so PNG encoder differences and very small GPU dithering are harmless.
async function difference(page, a, b) {
  return page.evaluate(async encoded => {
    async function pixels(base64) {
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const image = await createImageBitmap(new Blob([bytes],{type:'image/png'}));
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image,0,0);
      image.close();
      return ctx.getImageData(0,0,canvas.width,canvas.height).data;
    }
    const [a,b] = await Promise.all(encoded.map(pixels));
    if (a.length !== b.length) throw Error('Mismatched comparison sizes');
    let changed = 0;
    for (let i=0;i<a.length;i+=4) {
      if (Math.abs(a[i]-b[i])>6 || Math.abs(a[i+1]-b[i+1])>6 || Math.abs(a[i+2]-b[i+2])>6) changed++;
    }
    return changed/(a.length/4);
  },[a.toString('base64'),b.toString('base64')]);
}

async function run() {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,
    args:['--enable-gpu','--enable-unsafe-swiftshader']});
  try {
    const size = {viewport:{width:1366,height:768}};
    const page = await browser.newPage(size);
    const errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (r.url().includes('/assets/refined/')) requests.push(r.url()); });
    await openLab(page);
    assert.equal(await page.evaluate(() => lab.renderInfo.finish),'refined');
    assert.equal(new Set(requests).size,4);
    await instrument(page);
    await selectFinish(page,'original');
    const original = await frame(page);
    const before = await snapshot(page);
    await selectFinish(page,'refined');
    const refined = await frame(page);
    assert.deepEqual(await snapshot(page),before);
    assert.ok(await difference(page,original,refined)>.15,'Visibly different instrument and room');
    await selectFinish(page,'original');
    const restored = await frame(page);
    assert.deepEqual(await snapshot(page),before);
    assert.ok(await difference(page,original,restored)<.001,'Original pixels restored');
    assert.equal(requests.length,4,'Cached assets on repeat selection');
    if (process.env.ORIGINAL_STUDIO_URL) {
      const baseline = await browser.newPage(size);
      await openLab(baseline,process.env.ORIGINAL_STUDIO_URL);
      await instrument(baseline);
      const published = await frame(baseline);
      const diff = await difference(page,original,published);
      console.log('Original pixels differing from the release by more than 6/255:',(100*diff).toFixed(4)+'%');
      assert.ok(diff<.001,'Original reproduces the existing release');
      await baseline.close();
    }
    requests.length = 0;
    await openLab(page);
    assert.equal(await page.evaluate(() => lab.renderInfo.finish),'original');
    assert.equal(requests.length,0,'Original starts independently of the trial assets');

    let cancelLoad, manifestRequested;
    const hold = new Promise(resolve => { cancelLoad = resolve; });
    const requestSeen = new Promise(resolve => { manifestRequested = resolve; });
    await page.route('**/assets/refined/console.json',async route => {
      manifestRequested();
      await hold;
      await route.continue();
    });
    await page.locator('#labMenu summary').click();
    await page.locator('#benchFinish').selectOption('refined');
    await requestSeen;
    await page.locator('#benchFinish').selectOption('original');
    cancelLoad();
    await page.waitForLoadState('networkidle');
    assert.equal(await page.evaluate(() => lab.renderInfo.finish),'original');
    assert.equal(await page.evaluate(key => localStorage.getItem(key),preference),'original');
    await page.unroute('**/assets/refined/console.json');
    await page.locator('#labMenu summary').click();
    await selectFinish(page,'refined');
    await openLab(page);
    assert.equal(await page.evaluate(() => lab.renderInfo.finish),'refined');

    await page.route('**/assets/refined/**',route => route.abort());
    await openLab(page);
    assert.equal(await page.evaluate(() => lab.renderInfo.finish),'original');
    await page.locator('#labMenu summary').click();
    assert.ok(await page.locator('#benchFinishStatus').isVisible());
    await page.unroute('**/assets/refined/**');
    await page.locator('#benchFinish').selectOption('refined');
    await page.waitForFunction(() => lab.renderInfo.finish==='refined');
    assert.ok(await page.locator('#benchFinishStatus').isHidden());
    assert.deepEqual(errors,[]);
    console.log('Finish selection, camera and hit targets, pixel restoration, persistence, delayed selection, fallback and retry passed.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {console.error(error);process.exitCode=1;});
