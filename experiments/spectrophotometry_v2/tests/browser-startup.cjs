const assert = require('node:assert/strict');
const {mkdir} = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');

async function run() {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,
    args:['--enable-gpu','--enable-unsafe-swiftshader','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  try {
    const context = await browser.newContext({viewport:{width:1366,height:768}});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('spectrophotometry-v2-theme','classic');
      localStorage.setItem('spectrophotometry-v2-bench-finish','original');
      window.videoRequests = [];
      navigator.mediaDevices.getUserMedia = constraints => new Promise((resolve,reject) => {
        videoRequests.push(constraints);
        window.declineCamera = () => reject(new DOMException('Permission denied','NotAllowedError'));
        window.grantCamera = () => {
          const stream = document.createElement('canvas').captureStream();
          window.lateTrack = stream.getVideoTracks()[0];
          resolve(stream);
        };
      });
    });
    await page.goto(process.env.STUDIO_URL || 'http://127.0.0.1:8774/');
    await page.waitForFunction(() => window.lab && videoRequests.length === 1);
    const $ = selector => page.locator(selector);
    const settings = $('#labMenu summary'), hint = $('#benchStyleHint');
    assert.deepEqual(await page.evaluate(() => [document.documentElement.dataset.theme, lab.renderInfo.finish,
      lab.studio.immersive, lab.studio.handMode, lab.studio.cameraUsers, lab.studio.liveRoom]),
      ['scifi','cinematic',true,'work',['hands'],false]);
    assert.equal(await page.evaluate(() => videoRequests[0].audio),false);
    assert.equal(await $('#handLinkState').textContent(),'Opening camera');
    assert.ok(await $('#spatialHud').isVisible() && await $('#handPanel').isHidden());
    assert.equal(await settings.getAttribute('aria-describedby'),'benchStyleHint');
    assert.equal(await settings.evaluate(el=>getComputedStyle(el).animationName),'bench-settings-pulse');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await settings.evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(() => declineCamera());
    await page.waitForFunction(() => !lab.hand.state.active && document.querySelector('#handLinkState').textContent === 'Camera off');
    assert.ok(await $('#spatialHud').isVisible());
    assert.match(await $('#handStatus').textContent(),/denied/);

    for (const [name,width,height] of [['tablet',820,1180],['tablet-landscape',1024,768],['laptop',1366,768],['desktop',1920,1080]]) {
      await page.setViewportSize({width,height});
      await page.waitForFunction(width => lab.renderInfo.css[0] === width,width);
      const box = await hint.boundingBox(), target = await settings.boundingBox();
      assert.ok(box && target && box.y >= 0 && box.x >= 0 && box.x+box.width <= width);
      assert.ok(box.y+box.height <= target.y && box.x < target.x+target.width/2 && box.x+box.width > target.x+target.width/2);
      const buttons = await $('#spatialNav').locator('button:visible').all();
      for (const button of buttons) {
        const b = await button.boundingBox();
        assert.ok(box.x+box.width<=b.x || b.x+b.width<=box.x || box.y+box.height<=b.y || b.y+b.height<=box.y,
          name+' hint covers a navigation control');
      }
      if (process.env.STARTUP_REVIEW_DIR) {
        await mkdir(process.env.STARTUP_REVIEW_DIR,{recursive:true});
        await page.screenshot({path:path.join(process.env.STARTUP_REVIEW_DIR,name+'.jpg'),quality:90});
      }
    }
    await settings.focus(); await settings.press('Enter');
    await hint.waitFor({state:'hidden'});
    await page.waitForFunction(() => !document.querySelector('#labMenu summary').hasAttribute('aria-describedby'));
    assert.equal(await $('#benchFinish').evaluate(el=>getComputedStyle(el).animationName),'bench-settings-pulse');
    await page.getByLabel('Bench appearance').selectOption('refined');
    await page.waitForFunction(() => lab.renderInfo.finish === 'refined');
    await $('#settingsTheme').getByRole('radio',{name:'Classic'}).check();
    await page.reload(); await page.waitForFunction(() => window.lab && videoRequests.length === 1);
    assert.deepEqual(await page.evaluate(() => [document.documentElement.dataset.theme,lab.renderInfo.finish,lab.studio.immersive]),
      ['scifi','cinematic',true]);
    await $('#cameraButton').click(); await page.evaluate(() => grantCamera());
    await page.waitForFunction(() => lateTrack.readyState === 'ended' && !lab.hand.state.active);
    assert.deepEqual(await page.evaluate(() => lab.studio.cameraUsers),[]);
    await hint.waitFor({state:'hidden',timeout:18000});
    const granted = await context.newPage();
    await granted.setViewportSize({width:1902,height:901});
    await granted.goto(page.url());
    await granted.waitForFunction(() => window.lab?.hand.state.backend && !document.querySelector('#handBegin').hidden,null,{timeout:60000});
    const startup = await granted.evaluate(() => ({
      theme:document.documentElement.dataset.theme,finish:lab.renderInfo.finish,immersive:lab.studio.immersive,
      panelClosed:document.querySelector('#handPanel').hidden,owners:lab.studio.cameraUsers,
      video:document.querySelector('#handVideo').srcObject.getVideoTracks()[0].readyState
    }));
    assert.deepEqual(startup,{theme:'scifi',finish:'cinematic',immersive:true,panelClosed:true,owners:['hands'],video:'live'});
    if (process.env.STARTUP_REVIEW_DIR) {
      await granted.screenshot({path:path.join(process.env.STARTUP_REVIEW_DIR,'hands-desktop.jpg'),quality:93});
    }
    await granted.evaluate(() => {
      window.grantedTrack=document.querySelector('#handVideo').srcObject.getVideoTracks()[0];
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await granted.waitForFunction(() => grantedTrack.readyState==='ended' && !lab.hand.state.active);
    assert.ok(await granted.locator('#spatialHud').isVisible());
    assert.deepEqual(errors,[]);
    console.log('Fresh and returning visits, real detector over simulated video, pending and denied permission, cancellation, hint placement and reduced motion passed.');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode=1; });
