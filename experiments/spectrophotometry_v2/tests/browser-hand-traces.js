async (page) => {
 await page.evaluate(() => {
  window.traceClock=performance.now();
  window.trace=(pose,p,count=3,extra={})=>{for(let i=0;i<count;i++){traceClock+=85;lab.hand.frame({pose,valid:true,x:p.x,y:p.y,now:traceClock,handedness:'Right',roll:0,...extra})}};
  window.gestureAction=async()=>{
   const s=lab.step,t=lab.hand.targets,before=lab.state.history.length;
   if(['zero','measure','continue'].includes(s.action)){
    const p=t[s.action==='continue'?'notebook':s.action];trace('open',p);trace('point',p,12);
   }else{
    const tool=['aspirate','dispense'].includes(s.action)?'pipette':'cuvette';
    trace('open',t[tool]);trace('grip',t[tool]);
    if(lab.hand.state.holding!==tool)throw Error('Grab failed at '+s.index+' '+JSON.stringify(lab.hand.state));
    const target=s.action==='insert'?t.chamber:s.action==='remove'?t.dock:lab.targetPositions[s.target];
    trace('grip',target,7);trace('open',target);
   }
   const start=performance.now();while(lab.busy&&performance.now()-start<15000)await new Promise(r=>setTimeout(r,25));
   if(document.querySelector('#notebookDialog').open)document.querySelector('#notebookDialog').close();
   if(lab.state.history.length!==before+1)throw Error('Action failed at '+s.index+' '+s.action+' '+JSON.stringify(lab.hand.state)+' '+document.querySelector('#feedback').textContent);
   return {step:s.index,action:s.action,target:s.target};
  };
  window.runGestureBatch=async count=>{const actions=[];for(let i=0;i<count&&!lab.state.finished;i++)actions.push(await gestureAction());return {actions,step:lab.step.index,readings:Object.keys(lab.state.results).length,waste:lab.state.waste,complete:lab.state.finished}};
 });
 return await page.evaluate(()=>runGestureBatch(12));
}
