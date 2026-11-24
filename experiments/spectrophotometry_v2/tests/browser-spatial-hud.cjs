// Feed known detector results to the camera's normal acceptance path. The
// photographic replay exercises the real detector separately.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');

async function installReplay(page) {
  await page.evaluate(async () => {
    const {b06Packet} = await import('./tests/b06-landmark-fixtures.js');
    const {HandCamera} = await import('./src/hand-camera.js');
    let camera;
    HandCamera.prototype.startWorker = async function() {
      camera = this; this.backend = 'Landmark replay'; this.worker = {terminate() {}};
    };
    HandCamera.prototype.schedule = HandCamera.prototype.checkHealth = function() {};
    window.hudPose = async (x, y, pose) => {
      const frame = document.getElementById('handPlayerFrame').style;
      const rect = Object.fromEntries(['left','top','width','height'].map(k => [k, parseFloat(frame[k]) / 100]));
      const mirror = lab.studio.mirrored;
      const video = document.getElementById('handVideo');
      const packet = b06Packet(pose.startsWith('point') ? 'point' : 'open', {x:320,y:240}, {width:video.videoWidth,height:video.videoHeight,mirrored:mirror});
      delete packet.stamp;
      const points = packet.landmarks[0], world = packet.worldLandmarks[0];
      if (pose === 'pinch' || pose === 'point-pinch') {
        // Both digits move toward contact. The screen coordinate below is the
        // resulting fingertip position, so a flight across a button edge can be replayed.
        for (const joints of [points, world]) for (const axis of ['x','y','z']) {
          const bend = (joints[4][axis] - joints[8][axis]) * .24;
          joints[7][axis] += bend * .45;
          joints[8][axis] += bend;
          joints[4][axis] = joints[8][axis];
        }
      }
      const tipX = rect.left + x / (innerWidth - 1) * rect.width;
      const dx = (mirror ? 1 - tipX : tipX) - points[8].x;
      const dy = rect.top + y / (innerHeight - 1) * rect.height - points[8].y;
      points.forEach(p => { p.x += dx; p.y += dy; });
      if (pose === 'lost') { packet.landmarks = []; packet.worldLandmarks = []; packet.handedness = []; }
      for (let frame = 0; frame < 6 && camera.running; frame++) {
        const stamp = performance.now();
        camera.accept({...packet,stamp,exposure:camera.frameSource(video,stamp)},camera.generation);
        await new Promise(resolve => setTimeout(resolve,42));
      }
    };
  });
}

async function run() {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,
    args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.STUDIO_URL || 'http://127.0.0.1:8774/');
    await page.waitForFunction(() => !!window.lab);
    await installReplay(page);
    const $ = s => page.locator(s);
    async function center(selector) {
      const b = await $(selector).boundingBox();
      assert.ok(b, 'Visible target: ' + selector);
      return [b.x + b.width / 2, b.y + b.height / 2];
    }
    const pose = (at, kind) => page.evaluate(([x,y,kind]) => window.hudPose(x,y,kind), [...at,kind]);
    async function click(selector, hand='open') {
      const at = await center(selector);
      await pose(at, hand);
      await page.waitForFunction(s => document.querySelector(s)?.matches('[data-hand-hover],:has([data-hand-hover])'),selector,{timeout:3500})
        .catch(async () => { throw Error('Finger missed '+selector+' '+JSON.stringify(await page.evaluate(([x,y])=>({
          hit:document.elementFromPoint(x,y)?.outerHTML.slice(0,120),cursor:document.querySelector('#panelPointer').style.transform,
          hover:document.querySelector('[data-hand-hover]')?.outerHTML.slice(0,90),handPanel:!document.querySelector('#handPanel').hidden,dialog:document.querySelector('dialog[open]')?.id
        }),at))); });
      await pose(at, hand==='point'?'point-pinch':'pinch');
      await pose(at, hand);
    }
    await $('#immerseButton').click();
    assert.ok(!await $('#spatialHud').isVisible());
    await $('#handButton').click(); await $('#handStart').click(); await $('#handBegin').waitFor({state:'visible'});
    await click('#handBegin');
    await $('#handPanel').waitFor({state:'hidden',timeout:3000});
    assert.ok(await $('#spatialHud').isVisible());
    await click('[data-plot="percentT"]','point');
    assert.equal(await $('#hudPlotUnit').textContent(), 'Transmittance (%)');
    // A held pinch and a lost press must never toggle a control on reacquisition.
    const metric = '[data-plot="absorbance"]', a = await center(metric);
    await pose(a,'open'); await pose(a,'pinch'); await pose(a,'pinch');
    assert.equal(await $(metric).getAttribute('aria-pressed'), 'false');
    await pose(a,'lost'); await pose(a,'pinch'); await pose(a,'open');
    assert.equal(await $(metric).getAttribute('aria-pressed'), 'false');
    const elsewhere = [720,390];
    await pose(elsewhere,'open'); await pose(elsewhere,'pinch'); await pose(a,'pinch'); await pose(a,'open');
    assert.equal(await $(metric).getAttribute('aria-pressed'), 'false');
    await click(metric);
    const aBox = await $(metric).boundingBox(), edge = [aBox.x+aBox.width-3,a[1]], across = [edge[0]+10,a[1]];
    await page.evaluate(() => { window.plotClicks=[]; document.querySelector('.plot-tools').addEventListener('click',e=>plotClicks.push(e.target.dataset.plot)); });
    await pose(edge,'open'); await pose(across,'pinch'); await pose(across,'open');
    assert.deepEqual(await page.evaluate(()=>plotClicks),[],'Releasing over a neighboring button cancels the click');
    await pose(edge,'open'); await pose(across,'pinch'); await pose(edge,'open');
    assert.deepEqual(await page.evaluate(()=>plotClicks),['absorbance'],'A natural closing drift preserves the original target');
    await click('[data-view="instrument"]');
    async function pointClick(id,label) {
      const at = await page.evaluate(id=>{
        const {x,y,visible}=lab.targeting.targets[id], r=document.querySelector('#labCanvas').getBoundingClientRect();
        if (!visible || document.elementFromPoint(x+r.left,y+r.top)?.id!=='labCanvas') throw Error('Covered bench control '+id);
        return [x+r.left,y+r.top];
      },id);
      await pose(at,'point');
      assert.equal(await $('#hudTarget').textContent(),label);
      await pose(at,'point-pinch'); await pose(at,'point');
    }
    await pointClick('read','READ key');
    assert.match(await $('#feedback').textContent(),/Close the sample-chamber lid/);
    await pointClick('lid','Sample-chamber lid');
    assert.equal(await $('#opticsState').textContent(),'Chamber empty');
    await pointClick('zero','ZERO key');
    assert.equal(await page.evaluate(()=>lab.state.zeroed),false,'Pinching ZERO cannot blank an empty chamber');
    await pointClick('lid','Sample-chamber lid');
    await click('[data-view="overview"]'); await pointClick('clipboard','Lab notebook');
    await click('#notebookDialog [data-close]');
    const voice = '#hudProcedure [data-voice-toggle]', wasVoiced = await $(voice).getAttribute('aria-pressed');
    await click(voice); assert.notEqual(await $(voice).getAttribute('aria-pressed'),wasVoiced);
    await click(voice); await click('#hudProcedure [data-voice-replay]');
    await click('[data-quick-mode="view"]'); await click('[data-view="instrument"]');
    assert.equal(await $('[data-view="instrument"]').getAttribute('aria-pressed'), 'true');
    await click('#immersiveProtocol'); await click('#pauseButton');
    assert.equal(await page.evaluate(() => lab.state.status),'paused');
    await click('#runButton'); await click('#immersiveProtocol');
    await click('#immersiveNotebook'); assert.ok(await $('#notebookDialog').isVisible());
    await click('#notebookDialog [data-close]'); assert.ok(!await $('#notebookDialog').isVisible());
    await click('#cameraSettingsButton'); await click('#mirrorCamera');
    assert.equal(await page.evaluate(() => lab.studio.mirrored), false);
    await click('#cameraClose'); await click('[data-quick-mode="work"]');
    await click('#handButton'); await click('#bulbMode'); await click('.hand-choice .choices button:last-child');
    assert.equal(await $('#bulbMode').inputValue(),'manual');
    const size = await $('#handCameraSize').boundingBox(), scalePoint = [size.x+size.width*.25, size.y+size.height/2];
    await pose(scalePoint,'open'); await pose(scalePoint,'pinch'); await pose(scalePoint,'open');
    assert.ok(Number(await $('#handCameraSize').inputValue())<70,'Camera scale follows a pinch even while framing is recalibrated');
    await click('#handClose');
    await click('#labMenu summary');
    for (const [finish,option] of [['original','last-child'],['refined','first-child']]) {
      await click('#benchFinish');
      await click('.hand-choice .choices button:'+option);
      await page.waitForFunction(value=>lab.renderInfo.finish===value,finish);
    }
    const range = await $('#wavelengthSlider').boundingBox(), y = range.y + range.height / 2;
    const left = [range.x + range.width * .25,y], right = [range.x + range.width - 1,y];
    await pose(left,'open'); await pose(left,'pinch'); await pose(right,'pinch'); await pose(right,'open');
    assert.equal(await page.evaluate(() => lab.state.wavelength),700);
    await click('#wavelength');
    await click('.digit-keys button:nth-child(6)'); // 6
    assert.ok(await $('.hand-choice footer button:last-child').isDisabled());
    await click('.digit-keys button:nth-child(9)'); // 3
    await click('.digit-keys button:nth-child(11)'); // 0
    assert.equal(await page.evaluate(()=>lab.state.wavelength),700,'Digits are staged until applied');
    await click('.hand-choice footer button:last-child');
    assert.equal(await page.evaluate(()=>lab.state.wavelength),630);
    await click('#wavelength'); await click('.hand-choice footer button:first-child');
    await click('.hand-choice header button');
    assert.equal(await $('#wavelength').inputValue(),'630','Cancel restores the original value');
    await click('#settingsTheme input[value=classic]');
    assert.equal(await $('html').getAttribute('data-theme'),'classic');
    await click('#settingsTheme input[value=scifi]');
    await click('#helpButton'); await click('#helpDialog [data-close]');
    if (!await $('#labMenu').evaluate(el=>el.open)) await click('#labMenu summary');
    await click('#resetButton'); await click('#resetDialog [data-close]');
    assert.equal(await page.evaluate(() => lab.state.wavelength),630);
    await click('#inspectMenu summary'); await click('#inspectEquipment');
    await click('.hand-choice footer button:last-child'); await click('.hand-choice .choices button:first-child');
    assert.ok(await $('#inspectEquipment').inputValue());
    await click('#arrangeButton'); await click('.layout-done');
    await click('#targetsMenu summary'); await click('#targetUse');
    assert.ok(await page.evaluate(() => lab.hand.state.active),'Target controls retain the camera');
    await click('#targetsMenu summary');
    assert.equal(await page.evaluate(() => lab.state.step),0);
    for (const [width,height] of [[768,1024],[820,1180],[1024,768],[1194,834],[1280,720],[1366,650],[1366,768],[1440,900],[1536,864],[1920,1080],[2560,1440]]) {
      await page.setViewportSize({width,height});
      await page.waitForFunction(w => lab.renderInfo.css[0] === w,width);
      await page.evaluate(() => new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const bad = await page.evaluate(() => {
        const selectors = '#spatialHud button,#spatialHud summary,#spatialNav button,.bench-dock>button,.dock-entry>summary';
        return Array.from(document.querySelectorAll(selectors)).filter(el => {
          if (!el.checkVisibility() || el.disabled) return false;
          const r = el.getBoundingClientRect(), x = r.x+r.width/2, y = r.y+r.height/2;
          if (r.x < 0 || r.y < 0 || r.right > innerWidth+1 || r.bottom > innerHeight+1 || !el.contains(document.elementFromPoint(x,y))) return true;
          if (!el.closest('.flight-wing')) return false;
          // Verify the projected hit area on the angled glass, including the far edge.
          return r.width < 44 || r.height < 44 || [[-17,0],[17,0],[0,-17],[0,17]].some(([dx,dy]) =>
            !el.contains(document.elementFromPoint(x+dx,y+dy)));
        }).map(el => ({control:el.id||el.textContent.trim(),box:el.getBoundingClientRect().toJSON(),wing:el.closest('.flight-wing')?.open}));
      });
      assert.deepEqual(bad,[], width+' × '+height+' HUD targets');
      assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.flight-wing')].every(el=>el.open)),'Open instrument panels at '+width+' × '+height);
      const grips=['waterPipette-grip','pipette-grip','unknownPipette-grip'];
      for (const [view,ids] of [['overview',[...grips,'lid','zero','read','clipboard']],['prepare',grips],['instrument',['lid','zero','read','cuvette-grip']]]) {
        await $('[data-view="'+view+'"]').click();
        const covered=await page.evaluate(async ids=>{
          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          const targets=lab.targeting.targets, r=document.getElementById('labCanvas').getBoundingClientRect();
          return ids.filter(id=>!targets[id]?.visible || document.elementFromPoint(r.left+targets[id].x,r.top+targets[id].y)?.id!=='labCanvas');
        },ids);
        assert.deepEqual(covered,[],width+' × '+height+' '+view+' apparatus hit targets');
      }
    }
    await page.setViewportSize({width:1024,height:768});
    await click('#opticsWing summary'); await click('#opticsWing summary');
    await click('[data-locate-grip="waterPipette"]'); await click('#immersiveNotebook');
    const note = await $('#notebookDialog').boundingBox(), start = [note.x+12, note.y+note.height*.55];
    const end = [start[0],start[1]-80];
    await pose(start,'open'); await pose(start,'pinch'); await pose(end,'pinch'); await pose(end,'open');
    assert.ok(await $('#notebookDialog').evaluate(el=>el.scrollTop>35),'A pinch drag scrolls the notebook');
    await pose(end,'open'); await pose(end,'pinch'); await pose([start[0],start[1]+30],'pinch'); await pose(start,'open');
    await click('#notebookDialog [data-close]');
    await click('#immersiveProtocol'); await click('#stepRationale summary');
    assert.match(await $('#stepReason').innerText(),/2\.31 µM/);
    await click('#stepRationale summary'); await click('#locateTarget');
    assert.ok(!await $('#taskRibbon').isVisible(),'Show target returns to the highlighted bench');
    await click('#immersiveProtocol'); await click('#spatialProtocolClose');
    await click('#exitImmersive');
    assert.ok(!await $('#spatialHud').isVisible());
    assert.ok(await $('#stationBar .camera-tools #handButton').isVisible());
    assert.ok(await page.evaluate(() => lab.hand.state.active),'Exiting immersive retains regular Hands mode');
    await $('#immerseButton').click(); await click('#cameraButton');
    assert.ok(!await $('#spatialHud').isVisible());
    assert.equal(await page.evaluate(() => lab.studio.immersive),true);
    assert.deepEqual(await page.evaluate(() => lab.studio.cameraUsers),[]);
    assert.deepEqual(errors,[]);
    console.log('Pinch clicks, numeric entry, tracking loss and modal scrolling passed. HUD controls and apparatus were reachable in all three bench views at 11 tablet, laptop and desktop sizes.');
  } finally { await browser.close(); }
}
module.exports = {installReplay};
if (require.main === module) run().catch(e => {console.error(e);process.exitCode=1;});
