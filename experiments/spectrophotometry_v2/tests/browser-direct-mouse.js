import {isPipette} from '../src/pipettes.js';
// Playwright mouse events operate the rendered apparatus. Diagnostics only supply
// projected coordinates and observations; the test never sets chemistry or poses.
export async function runDirectMouse(page, through=Infinity, onStep=()=>{}, activateKey){
 const results=[];
 const read=()=>page.evaluate(()=>({
  step:lab.step, tool:lab.manipulation.tool, contact:lab.manipulation.contact,
  lidOpen:lab.state.lidOpen, finished:lab.state.finished, frozen:lab.manipulation.frozen
 }));
 async function point(id){
  // Hands mode paints the workbench at 30 Hz. Wait for Follow step to fit
  // the incoming station after parking a tool at the previous station.
  await page.waitForFunction(id=>(lab.targeting.targets[id]||lab.affordances.regions[id])?.visible,id,{timeout:3500})
    .catch(async error=>{
      const details=await page.evaluate(id=>({
        step:lab.step.index+1,target:id,position:lab.targeting.targets[id]||lab.affordances.regions[id],
        follow:document.querySelector('#followStep').checked,tool:lab.manipulation.tool,camera:lab.camera
      }),id);
      throw Error('Apparatus out of view: '+JSON.stringify(details),{cause:error});
    });
  return page.evaluate(id=>{
   const canvas=document.querySelector('#labCanvas'), rect=canvas.getBoundingClientRect();
   const p=lab.targeting.targets[id]||lab.affordances.regions[id];
   if(!p?.visible) throw Error('Target out of view: '+id);
   const x=p.x+rect.left,y=p.y+rect.top;
   if(document.elementFromPoint(x,y)!==canvas) throw Error('Target covered: '+id);
   return {x,y};
  },id);
 }
 async function click(id,button='left'){
  const p=await point(id); await page.mouse.click(p.x,p.y,{button});
 }
 async function insert(id,dy=30){
  const p=await point(id); await page.mouse.move(p.x,p.y); await page.mouse.down();
  try{ await page.mouse.move(p.x,p.y+dy); }finally{ await page.mouse.up(); }
  await page.waitForFunction(()=>!lab.manipulation.flow,null,{timeout:30000});
 }
 let previous=-1,attempts=0;
 for(;;){
  if(await page.locator('#notebookDialog[open]').count()) await page.locator('#notebookDialog [data-close]').click();
  // Grasp the next tool after Follow step has painted its station. With Hands
  // active the bench runs at 30 Hz even on a screen with a faster refresh rate.
  const previousFrame=await page.evaluate(()=>lab.renderInfo.frameTime);
  await page.waitForFunction(time=>lab.renderInfo.frameTime>time,previousFrame);
  const state=await read(),{step,tool,contact,lidOpen}=state;
  if(state.finished||step.index>=through) return {through:step.index,finished:state.finished,log:results};
  if(previous!==step.index){previous=step.index;attempts=0;results.push({step:step.index,action:step.action});await onStep(step);}
  if(++attempts>12) throw Error('Mouse handling stalled: '+JSON.stringify(state));
  if(tool&&state.frozen){await click(tool+'-grip');continue;}
  if(isPipette(tool)){
   if(tool===step.pipetteId) await insert(step.target);
   else await click(tool+'-stand');
   continue;
  }
  if(tool==='cuvette'){
   if(contact?.kind==='pour'){ await click('wasteBeaker','right'); continue; }
   if(step.action==='insert'){ if(!lidOpen) await click('lid'); else await insert('spec20'); continue; }
   if(step.action==='empty'){
    await click('wasteBeaker','right');
    await page.waitForFunction(()=>lab.step.action!=='empty',null,{timeout:8000});
   }else await click('cuvette-dock');
   continue;
  }
  switch(step.action){
   case 'aspirate':case 'dispense': await click(step.pipetteId+'-grip');break;
   case 'insert':case 'empty': await click('cuvette-grip');break;
   case 'remove': if(!lidOpen) await click('lid'); else await insert('cuvette-grip',-30);break;
   case 'zero':case 'measure':
    if(lidOpen) await click('lid');
    else await (activateKey||click)(step.action==='zero'?'zero':'read');
    break;
   case 'fit': case 'plan': case 'report': {
    const immersive=await page.evaluate(()=>lab.studio.immersive);
    if(immersive&&await page.locator('#spatialHud').isVisible()&&!await page.locator('#immersiveNotebook').isVisible()){
      await page.locator('#dataWing summary').click();
    }
    await page.locator(immersive?'#immersiveNotebook':'#notebookButton').click();
    if(step.action==='fit')await page.locator('#fitButton').click();
    if(step.action==='plan'){
      await page.locator('#aliquot').fill('9');
      await page.locator('#planButton').click();
      if(!(await page.locator('#decisionFeedback').innerText()).includes('less drink'))throw Error('Missing dilution feedback.');
      await page.locator('#aliquot').fill('5');
      await page.locator('#planButton').click();
    }
    if(step.action==='report'){
      await page.locator('#diluted').fill('1.56');
      await page.locator('#factor').fill('2');
      await page.locator('#original').fill('1.56');
      await page.locator('#checkEstimate').click();
      if(!(await page.locator('#decisionFeedback').innerText()).includes('Multiply'))throw Error('Incorrect report accepted.');
      await page.locator('#original').fill('3.11');
      await page.locator('#checkEstimate').click();
    }
    break;
   }
   default: throw Error('Unexpected instruction: '+step.action);
  }
 }
}
