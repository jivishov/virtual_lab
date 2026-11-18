import assert from 'node:assert/strict';

// Exercise the rendered apparatus with real pointer capture. Coordinates from
// the studio are observations only. Every pickup, move and drop is a DOM event.
export async function runCarryChecks(page){
 const canvas=page.locator('#labCanvas');
 const reset=async(view='overview')=>{
  await page.reload();await page.waitForFunction(()=>!!window.lab);
  await page.locator('[data-view="'+view+'"]').click();
 };
 const read=()=>page.evaluate(()=>({control:lab.manipulation,regions:lab.affordances.regions,
  held:lab.affordances.heldPoint,end:lab.affordances.end,aim:lab.affordances.aim,step:lab.step.index}));
 const client=async p=>{const r=await canvas.boundingBox();return {x:r.x+p.x,y:r.y+p.y}};
 const move=async p=>{const q=await client(p);await page.mouse.move(q.x,q.y)};
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const checks=[];
 for(const [view,region,shaft] of [
  ['overview','pipette-bulb'],['overview','waterPipette-grip'],['prepare','unknownPipette-bulb'],
  ['prepare','pipette-grip',true],['instrument','cuvette-grip']
 ]){
  await reset(view);
  const initial=await read(),feature=initial.regions[region],start={x:feature.x,y:feature.y};
  if(shaft){
   const bulb=initial.regions['pipette-bulb'];
   start.x+=1.9*(feature.x-bulb.x);start.y+=1.9*(feature.y-bulb.y);
  }
  await move(start);await page.mouse.down();await page.waitForTimeout(300);
  const grabbed=await read();assert.equal(grabbed.control.owner,'mouse',region);
  assert.ok(dist(grabbed.regions[region],feature)<.01,'Tool rose with a stationary pointer');
  assert.ok(await canvas.evaluate(c=>c.hasPointerCapture(1)),'Mouse did not capture its grip');
  let maxError=0;
  for(const [dx,dy] of [[2,1],[11,-6],[53,-20],[77,-29],[40,-40],[30,-43]]){
   await move({x:start.x+dx,y:start.y+dy});
   const {held}=await read();assert.ok(held,'Free carry unexpectedly locked');
   maxError=Math.max(maxError,dist(held,{x:grabbed.held.x+dx,y:grabbed.held.y+dy}));
  }
  assert.ok(maxError<1.3,region+' slipped by '+maxError+' px');
  await page.mouse.up();const placed=await read();assert.equal(placed.control.owner,null);
  await move({x:start.x+85,y:start.y+35});
  assert.deepEqual((await read()).regions[region].world,placed.regions[region].world,'Released tool chased the pointer');
  checks.push({view,region:shaft?'pipette shaft':region,maxError});
 }

 // Carry by the bulb, place the tip at a real bottle, then operate the bottle.
 await reset();
 let s=await read();
 await move(s.regions['pipette-bulb']);await page.mouse.down();
 for(let i=0;i<3;i++){s=await read();await move(s.aim)}
 await page.mouse.up();s=await read();
 assert.equal(s.control.owner,null);assert.equal(s.control.contact?.target,'stockBottle');
 const mouth=await page.evaluate(()=>lab.targeting.targets.stockBottle);
 await move(mouth);await page.mouse.down();await move({x:mouth.x,y:mouth.y+30});await page.mouse.up();
 await page.waitForFunction(()=>lab.step.index===1&&lab.manipulation.contact===null);
 assert.ok(Math.abs(await page.evaluate(()=>lab.state.pipette.volume)-10)<1e-8);
 // A completed fill and small post-withdrawal movement must also be stable.
 const after=await read();
 await move({x:mouth.x+1,y:mouth.y+31});
 const next=await read();
 assert.ok(dist(after.regions['pipette-bulb'],next.regions['pipette-bulb'])<2.5);

 await reset('prepare');
 const rect=await canvas.boundingBox();
 await page.mouse.move(rect.x+rect.width*.6,rect.y+rect.height*.48);
 await page.mouse.down({button:'middle'});
 await page.mouse.move(rect.x+rect.width*.6-75,rect.y+rect.height*.48+65,{steps:8});
 await page.mouse.up({button:'middle'});
 const oblique=(await read()).regions['unknownPipette-grip'];
 await move(oblique);await page.mouse.down();
 const picked=await read();assert.equal(picked.control.tool,'unknownPipette');
 await move({x:oblique.x+54,y:oblique.y+16});
 const atEdge=await read();
 assert.ok(dist(atEdge.held,{x:picked.held.x+54,y:picked.held.y+16})<1.3);
 await page.mouse.move(rect.x-12,rect.y+rect.height*.5);await page.mouse.up();
 const cancelled=await read();
 assert.equal(cancelled.control.owner,null);assert.equal(cancelled.control.frozen,true);
 await move(oblique);assert.deepEqual((await read()).regions['unknownPipette-grip'].world,atEdge.regions['unknownPipette-grip'].world);
 await move(atEdge.regions['unknownPipette-grip']);await page.mouse.down();await page.mouse.up();
 assert.equal((await read()).control.owner,'mouse');
 await page.locator('[data-view="overview"]').click();
 assert.equal((await read()).control.owner,null,'A view change left stale drag coordinates active');
 const final=(await read()).regions['unknownPipette-grip'];
 assert.deepEqual(final.world,atEdge.regions['unknownPipette-grip'].world);

 await reset();await page.locator('#arrangeButton').click();
 const arranged=(await read()).regions['pipette-bulb'];await move(arranged);await page.mouse.down();
 await move({x:arranged.x+30,y:arranged.y+6});
 const placed=(await read()).regions['pipette-bulb'];
 assert.ok(dist(placed,{x:arranged.x+30,y:arranged.y+6})<3,'Arranging by the bulb lost the grip');
 await page.mouse.up();await move(arranged);
 assert.deepEqual((await read()).regions['pipette-bulb'].world,placed.world);
 return checks;
}

export async function runTouchCarry(page,cdp){
 await page.waitForFunction(()=>!!window.lab);
 const canvas=page.locator('#labCanvas'),rect=await canvas.boundingBox();
 const p=await page.evaluate(()=>lab.affordances.regions['pipette-grip']);
 const handle={x:rect.x+p.x,y:rect.y+p.y};
 const touch=(type,point)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:point?[point]:[]});
 await touch('touchStart',handle);
 const held=await page.evaluate(()=>lab.affordances.heldPoint);
 assert.ok(held);await touch('touchMove',{x:handle.x+22,y:handle.y-14});
 const carried=await page.evaluate(()=>lab.affordances.heldPoint);
 assert.ok(Math.hypot(carried.x-held.x-22,carried.y-held.y+14)<1.5);
 await touch('touchEnd');assert.equal(await page.evaluate(()=>lab.manipulation.owner),null);
 await page.reload();await page.waitForFunction(()=>!!window.lab);
 const grip=await page.evaluate(()=>lab.affordances.regions['pipette-grip']);
 await page.touchscreen.tap(rect.x+grip.x,rect.y+grip.y);
 for(const [i,id] of ['stockBottle','tube_10_0'].entries()){
  const mouth=await page.evaluate(id=>lab.targeting.targets[id],id),at={x:rect.x+mouth.x,y:rect.y+mouth.y};
  await touch('touchStart',at);await touch('touchMove',{x:at.x,y:at.y+32});await touch('touchEnd');
  await page.waitForFunction(step=>lab.step.index===step&&!lab.manipulation.contact,i+1);
 }
 assert.ok(Math.abs(await page.evaluate(()=>lab.state.tubes.tube_10_0.volume)-10)<1e-8);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}
