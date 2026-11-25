// Compare the cursor and actual click against the landmark on the painted
// exposure. The expected position comes from the outline canvas in the DOM.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {openReplayLab} = require('./browser-spatial-hud.cjs');

async function run() {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,
    args:['--enable-gpu','--enable-unsafe-swiftshader','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}});
    await openReplayLab(page);
    const $ = selector => page.locator(selector);
    const pose = (at, kind, frames) => page.evaluate(([x,y,p,n]) => hudPose(x,y,p,n), [...at,kind,frames??6]);
    async function center(selector) {
      await $(selector).click({trial:true});
      const r=await $(selector).boundingBox();
      return [r.x+r.width/2,r.y+r.height/2];
    }
    let worst = 0;
    async function registered(joint) {
      const sample=await page.evaluate(joint => {
        const points=window.hudLandmarks;
        const p=joint==='tip'?points[8]:[0,5,9,13,17].reduce((s,i)=>({x:s.x+points[i].x/5,y:s.y+points[i].y/5}),{x:0,y:0});
        const outline=document.querySelector('#palmTrace').getBoundingClientRect();
        const finger=[outline.left+(lab.studio.mirrored?1-p.x:p.x)*outline.width,outline.top+p.y*outline.height];
        const active=document.querySelector(joint==='tip'?'#panelPointer':'#handCursor');
        const other=document.querySelector(joint==='tip'?'#handCursor':'#panelPointer');
        const r=active.getBoundingClientRect(), circle=[r.left+r.width/2,r.top+r.height/2];
        return {finger,circle,visible:!active.hidden,single:other.hidden,hover:document.querySelector('[data-hand-hover]')?.textContent.trim(),
          hit:document.elementFromPoint(...finger)?.closest('button')?.textContent.trim()};
      },joint);
      assert.ok(sample.visible && sample.single,'Exactly one active cursor '+JSON.stringify(sample));
      const distance=Math.hypot(sample.circle[0]-sample.finger[0],sample.circle[1]-sample.finger[1]);
      assert.ok(distance<1.25,joint+' is detached from its displayed landmark '+JSON.stringify(sample));
      worst=Math.max(worst,distance);
      return sample;
    }
    const unknown='[data-locate-grip="unknownPipette"]', stock='[data-locate-grip="pipette"]';
    await page.evaluate(()=>{window.pinchClicks=[];document.addEventListener('click',e=>{
      if(e.target.closest('[data-locate-grip]'))pinchClicks.push([e.target.closest('button').dataset.locateGrip,e.clientX,e.clientY]);
    })});
    let expectedClicks=0;
    for (const [width,height,size,mirror] of [[1440,900,80,true],[1024,768,50,false],[1902,901,100,true]]) {
      await page.setViewportSize({width,height});
      await page.locator('#cameraSettingsButton').click();
      await page.locator('#roomCameraSize').fill(String(size));
      await page.locator('#mirrorCamera').setChecked(mirror);
      await page.locator('#cameraClose').click();
      await page.locator('#handButton').click();
      await page.locator('#handGain').fill('60');
      const image=await page.locator('#handImageFrame').boundingBox();
      await page.mouse.click(image.x+.56*image.width,image.y+.46*image.height);
      await page.locator('#handClose').click();
      const remote=await center(unknown),nearby=await center(stock);
      await pose(remote,'point'); const aimed=await registered('tip');
      assert.equal(aimed.hover,'Unknown',JSON.stringify({width,height,size,mirror,target:remote,aimed,
        live:await $(unknown).boundingBox(),top:await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.outerHTML.slice(0,140),remote)}));
      // A fresh exposure crossing a boundary must move both hit test and ring immediately.
      await pose(nearby,'point',1); const moved=await registered('tip');
      assert.equal(moved.hit,'Stock');assert.equal(moved.hover,'Stock');
      await pose(nearby,'point-pinch');await pose(nearby,'point',1);
      const click=(await page.evaluate(()=>pinchClicks.at(-1)));
      assert.equal(click?.[0],'pipette');
      assert.ok(Math.hypot(click[1]-nearby[0],click[2]-nearby[1])<2,'Click fired at the visible stock control');
      await page.locator('[data-view="overview"]').click();

      const grip=await page.evaluate(()=>{const p=lab.targeting.targets['pipette-grip'],b=labCanvas.getBoundingClientRect();return [b.left+p.x,b.top+p.y]});
      await pose(remote,'point');
      await pose(remote,'point-pinch');
      await pose(grip,'grip',1);
      await registered('palm');
      await pose(grip,'palm',1);
      const bench=await registered('palm');
      assert.equal(bench.hover,undefined,'The panel gives up the target as soon as the palm takes the bench');
      await pose(grip,'palm'); await pose(grip,'grip',8);
      assert.equal(await page.evaluate(()=>lab.hand.state.holding),'pipette');
      await registered('palm');
      await pose(grip,'palm',9);
      assert.equal(await page.evaluate(()=>lab.hand.state.holding),null);
      assert.equal(await page.evaluate(()=>pinchClicks.length),++expectedClicks);
      await pose(remote,'lost',1);
      assert.ok(await $('#panelPointer').isHidden() && await $('#handCursor').isHidden());
    }
    await $('#immersiveNotebook').click();
    const close=await center('#notebookDialog [data-close]');
    await pose(close,'point');await registered('tip');
    await pose(close,'point-pinch');await pose(close,'point');
    assert.ok(await $('#notebookDialog').isHidden());
    console.log('Fingertip, click and palm registration verified at three viewport sizes and webcam scales, with both mirror settings and a modal. Maximum cursor error '+worst.toFixed(2)+' CSS px.');
  } finally { await browser.close(); }
}
run().catch(error=>{console.error(error);process.exitCode=1});
