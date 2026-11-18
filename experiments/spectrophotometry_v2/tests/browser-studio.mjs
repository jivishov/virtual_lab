// Run with a Playwright page on the studio. Chromium's fake video device exercises
// the real browser stream and local detector. Generated landmarks test palm intent.
import assert from 'node:assert/strict';

export async function runStudioChecks(page,onOutline=async()=>{}){
  await page.waitForFunction(()=>!!window.lab);
  assert.deepEqual(await page.evaluate(()=>lab.studio.cameraUsers),[]);
  await page.locator('#handButton').click();
  await page.locator('[data-hand-mode="view"]').click();
  await page.locator('#handClose').click();
  const camera=()=>page.evaluate(()=>lab.camera);
  const gesture=async(pose,targets,frames=7)=>{
    await page.evaluate(async({pose,targets,frames})=>{
      const {b06Packet}=await import('./tests/b06-landmark-fixtures.js');
      const canvas=document.getElementById('labCanvas'),width=canvas.clientWidth,height=canvas.clientHeight;
      for(let i=0;i<frames;i++){
        const stamp=performance.now();
        const samples=targets.map(([x,y,hand,individual])=>b06Packet(individual||pose,{x:x*width,y:y*height},{width,height,hand,stamp,mirrored:lab.studio.mirrored}));
        lab.hand.packet({...Object.fromEntries(['landmarks','worldLandmarks','handedness'].map(key=>[key,samples.flatMap(p=>p[key])])),stamp});
        await new Promise(resolve=>setTimeout(resolve,42));
      }
    },{pose,targets,frames});
  };
  const one=[[.37,.46,'Right']],two=[[.30,.46,'Right'],[.66,.46,'Left']];
  const initial=await camera();
  await gesture('open',one);await onOutline();
  const ink=()=>page.evaluate(()=>{
    const c=document.getElementById('palmTrace'),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let count=0;for(let i=3;i<data.length;i+=4)if(data[i])count++;return count;
  });
  assert.equal(await ink(),0,'Synthetic landmarks alone cannot produce a real camera silhouette; browser-b06-camera.cjs verifies the recorded exposure.');
  await gesture('grip',one);await gesture('grip',[[.47,.49,'Right']]);
  assert.ok(Math.abs((await camera()).yaw-initial.yaw)>.05,'A closed palm should orbit the bench.');
  await gesture('open',two);await gesture('grip',two);
  const beforeZoom=(await camera()).distance;
  await gesture('grip',[[.22,.46,'Right'],[.74,.46,'Left']]);
  assert.ok((await camera()).distance<beforeZoom*.90,'Spreading closed palms should zoom in.');
  await page.evaluate(()=>lab.hand.lost());assert.equal(await ink(),0);
  assert.equal(await page.evaluate(()=>lab.state.history.length),0);
  await page.locator('[data-view="overview"]').click();
  await page.locator('#handButton').click();await page.locator('[data-hand-mode="work"]').click();await page.locator('#handClose').click();
  const smoke=await page.evaluate(async()=>{
    const {createDirectHandTrace}=await import('./tests/browser-direct-hand-traces.js');
    return createDirectHandTrace().packetSmoke();
  });
  assert.equal(smoke.history,0);
  const grip=await page.evaluate(()=>{const p=lab.affordances.regions['pipette-grip'],c=document.getElementById('labCanvas');return [p.x/c.clientWidth,p.y/c.clientHeight,'Right']});
  await gesture('open',[grip]);await gesture('grip',[grip]);
  assert.equal(await page.evaluate(()=>lab.hand.state.holding),'pipette');
  const shifted=[grip[0]+.04,grip[1]-.04,'Right'];await gesture('grip',[shifted]);
  const carried=await page.evaluate(()=>lab.poses.pipette);
  await gesture('grip',[shifted,[.82,.3,'Left','open']]);
  const afterOther=await page.evaluate(()=>lab.poses.pipette);
  assert.ok(Math.hypot(...carried.map((v,i)=>v-afterOther[i]))<.03,'An unrelated open hand cannot take the held pipette.');
  await gesture('open',[shifted]);const released=await page.evaluate(()=>lab.poses.pipette);
  await gesture('open',[[.7,.6,'Right']]);assert.deepEqual(await page.evaluate(()=>lab.poses.pipette),released,'Opening the palm places the pipette at its actual pose.');
  await page.locator('#labMenu summary').click();await page.locator('#resetButton').click();await page.locator('#confirmReset').click();
  await page.locator('#immerseButton').click();assert.equal(await page.evaluate(()=>lab.studio.immersive),true);
  await page.locator('#immersiveProtocol').click();assert.ok(await page.locator('#instruction').isVisible());
  await page.locator('#immersiveNotebook').click();assert.equal(await page.locator('#notebookDialog').evaluate(d=>d.open),true);
  await page.locator('#notebookDialog [data-close]').click();await page.locator('#immersiveProtocol').click();
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>lab.studio.immersive),false);

  await page.locator('#cameraButton').click();await page.locator('#liveRoom').click();
  await page.waitForFunction(()=>lab.studio.liveRoom);
  const mirror=await page.locator('#mirrorCamera').isChecked();
  await page.locator('#mirrorCamera').click();assert.equal(await page.evaluate(()=>lab.studio.mirrored),!mirror);
  await page.locator('#cameraClose').click();await page.locator('#handButton').click();await page.locator('#handStart').click();
  await page.waitForFunction(()=>lab.hand.state.backend&&lab.studio.cameraUsers.includes('hands'),null,{timeout:50000});
  const backend=await page.evaluate(()=>lab.hand.state.backend);
  await page.locator('#handBegin').click();
  await page.locator('#handPanel').waitFor({state:'hidden'});await page.locator('#handButton').click();
  await page.locator('#handStart').click();
  assert.deepEqual(await page.evaluate(()=>lab.studio.cameraUsers),['room']);
  await page.locator('#handClose').click();await page.locator('#handOff').click();
  assert.deepEqual(await page.evaluate(()=>lab.studio.cameraUsers),[]);
  assert.equal(await page.evaluate(()=>lab.studio.liveRoom),false);
  return {backend,palmPickup:true,oneHandOrbit:true,twoHandZoom:true,immersiveNotebook:true};
}
