// Use the actual bench to acquire the readings and the fingertip to operate
// the instrument panels and enter the dilution and concentration calculations.
const assert = require('node:assert/strict');
const {mkdir} = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');
const {installReplay} = require('./browser-spatial-hud.cjs');

async function run() {
  const {STEPS, SAMPLES, DRINK_SAMPLES, fitCalibration} = await import('../src/model.js');
  const {runDirectMouse} = await import('./browser-direct-mouse.js');
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,
    args:['--enable-gpu','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1366,height:768}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.STUDIO_URL || 'http://127.0.0.1:8774/');
    await page.waitForFunction(() => !!window.lab);
    await installReplay(page);
    const $ = s => page.locator(s);
    async function pinch(locator) {
      await locator.evaluate(el => { if (el.closest('#notebookDialog')) el.scrollIntoView({block:'center'}); });
      const r = await locator.boundingBox();
      assert.ok(r, 'Visible ' + locator);
      const at = [r.x+r.width/2, r.y+r.height/2];
      for (const pose of ['open','pinch','open']) await page.evaluate(([x,y,pose]) => hudPose(x,y,pose), [...at,pose]);
    }
    async function number(field, value) {
      await pinch($(field));
      const pad = $('.hand-choice');
      for (const digit of value) await pinch(pad.getByRole('button',{name:digit,exact:true}));
      await pinch(pad.getByRole('button',{name:'Apply value'}));
      assert.equal(await $(field).inputValue(), value);
    }
    async function pinchKey(id) {
      const {x,y,visible} = await page.evaluate(id=>lab.targeting.targets[id],id);
      assert.ok(visible,'Visible instrument key '+id);
      const index = await page.evaluate(()=>lab.step.index);
      for (const pose of ['point','point-pinch','point']) await page.evaluate(([x,y,pose])=>hudPose(x,y,pose),[x,y,pose]);
      assert.equal(await page.evaluate(()=>lab.step.index),index+1,'One acquisition per pinch on '+id);
    }
    async function verifyOptics() {
      await page.waitForFunction(() => {
        const state = lab.state, wing = document.getElementById('opticsWing');
        const r = state.cuvette.inserted && !state.lidOpen && state.zeroed ? state.reading : null;
        return wing.dataset.open === String(state.lidOpen) && wing.dataset.seated === String(state.cuvette.inserted) &&
          document.getElementById('opticsSignal').textContent === (r ? r.percentT.toFixed(1) : '—') &&
          document.getElementById('opticsAbsorbance').textContent === (r ? r.absorbance.toFixed(4) : '—') &&
          Math.abs(Number(getComputedStyle(wing.querySelector('.measured-beam')).opacity) - (r ? r.percentT/100 : 0)) < .00001;
      },null,{timeout:3000});
    }
    async function verifyPlot(metric) {
      await pinch($('[data-plot="'+metric+'"]'));
      const state = await page.evaluate(() => lab.state), fit = fitCalibration(state);
      const plotted = await page.evaluate(maxC => {
        const root = document.getElementById('hudPlot'), line = root.querySelector('.measured-fit');
        let lo = 0, hi = line.getTotalLength();
        const midpointX = 31+180*(maxC/2)/2.5;
        for (let i=0; i<20; i++) {
          const mid=(lo+hi)/2;
          if (line.getPointAtLength(mid).x < midpointX) lo=mid; else hi=mid;
        }
        return {max:Number(document.getElementById('plotYHigh').textContent),
          mid:line.getPointAtLength((lo+hi)/2).y,
          dots:[...root.querySelectorAll('circle')].map(dot=>[dot.cx.baseVal.value,dot.cy.baseVal.value]),
          signals:[...root.querySelectorAll('.drink-signal')].map(p=>[p.getPointAtLength(0).y,p.getPointAtLength(p.getTotalLength()).y]),
          values:[...document.querySelectorAll('#hudUnknowns div:not([hidden]) dd')].map(el=>el.textContent)};
      },fit.maxConcentration);
      const y = v => 64-56*v/plotted.max;
      const close = (n,expected) => assert.ok(Math.abs(n-expected)<.01, n+' vs '+expected);
      assert.equal(plotted.dots.length,6);
      SAMPLES.forEach(({id},i) => {
        const r = state.results[id];
        close(plotted.dots[i][0],31+180*r.concentration/2.5);
        close(plotted.dots[i][1],y(r[metric]));
      });
      const a = fit.slope*fit.maxConcentration/2;
      close(plotted.mid,y(metric==='absorbance'?a:100*10**-a));
      const drinks = DRINK_SAMPLES.map(([id]) => state.results[id]).filter(Boolean);
      assert.equal(plotted.signals.length,drinks.length);
      drinks.forEach((r,i) => {
        plotted.signals[i].forEach(level => close(level,y(r[metric])));
        assert.equal(plotted.values[i],metric==='absorbance'?r.absorbance.toFixed(4)+' A':r.percentT.toFixed(1)+' %T');
      });
    }
    async function preview(name) {
      if (!process.env.HUD_REVIEW_DIR) return;
      await mkdir(process.env.HUD_REVIEW_DIR,{recursive:true});
      await page.screenshot({path:path.join(process.env.HUD_REVIEW_DIR,name+'.jpg'),quality:91});
    }
    await $('#followStep').check(); await $('#immerseButton').click();
    await $('#handButton').click(); await $('#handStart').click(); await $('#handBegin').click();
    let lidChecked = false;
    for (const decision of ['fit','plan','report']) {
      const goal = STEPS.find(s => s.action===decision).index;
      await runDirectMouse(page,goal,async () => {
        const state = await page.evaluate(() => lab.state);
        if (lidChecked || !state.reading || state.lidOpen) return;
        for (let i=0; i<2; i++) {
          const lid = await page.evaluate(()=>lab.targeting.targets.lid);
          await page.mouse.click(lid.x,lid.y);
          assert.equal(await page.evaluate(()=>lab.state.lidOpen),i===0);
          await verifyOptics();
        }
        lidChecked = true;
      },pinchKey);
      await verifyOptics();
      console.log('Verified optics at step',goal+1,decision);
      if (decision==='fit') assert.equal(await $('.measured-fit').count(),0);
      else {
        await verifyPlot('percentT'); await verifyPlot('absorbance');
        if (decision==='report') {
          assert.equal(await $('#hudFlow').textContent(),'Detector');
          const state=await page.evaluate(()=>lab.state);
          assert.equal(await $('#hudVolume').textContent(),state.reading.percentT.toFixed(1)+' %T');
          await preview('laptop');
          const camera=await page.evaluate(()=>lab.camera);
          for (const [value,label] of [['original','Original'],['refined','Refined']]) {
            await pinch($('#labMenu summary'));
            await pinch($('#benchFinish'));
            await pinch($('.hand-choice').getByRole('button',{name:label,exact:true}));
            await pinch($('#labMenu summary'));
            await page.waitForFunction(finish=>lab.renderInfo.finish===finish,value);
            assert.deepEqual(await page.evaluate(()=>lab.state),state);
            assert.deepEqual(await page.evaluate(()=>lab.camera),camera);
            await verifyOptics();
          }
        }
      }
      await pinch($('#immersiveNotebook'));
      if (decision==='fit') await pinch($('#fitButton'));
      if (decision==='plan') { await number('#aliquot','5'); await pinch($('#planButton')); }
      if (decision==='report') {
        await number('#diluted','1.56'); await number('#factor','2'); await number('#original','3.11');
        await pinch($('#checkEstimate'));
      }
      assert.ok(await page.evaluate(index => lab.state.finished || lab.step.index>index,goal),decision+' accepted');
      await pinch($('#notebookDialog [data-close]'));
    }
    assert.ok(lidChecked);
    assert.ok(await page.evaluate(() => lab.state.finished && Object.keys(lab.state.results).length===8));
    for (const [name,width,height] of [['tablet',820,1180],['desktop',1920,1080]]) {
      await page.setViewportSize({width,height});
      await page.waitForFunction(w=>lab.renderInfo.css[0]===w,width);
      await pinch($('[data-view="instrument"]'));
      assert.ok(await $('#hudUnknowns').isVisible());
      assert.ok(await $('#opticsSignal').isVisible());
      await preview(name);
    }
    assert.deepEqual(errors,[]);
    console.log('Completed all 95 steps. Pinched ZERO, acquired all eight readings with READ and entered the report on the keypad. Optical gating and both fitted scales passed.');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode=1; });
