// Input to the real camera/worker pipeline is a video of translated hand
// photographs. The test moves the pictures and observes the normal bench UI.
const {chromium}=require('playwright');
const {useStandardBench}=require('./browser-modes.cjs');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
const path=require('node:path');
const standards=[10,8,6,4,2,0].map(stock=>({id:`tube_${stock}_${10-stock}`,stock,water:10-stock}));
const allTubes=process.argv.includes('--all-tubes');
const immersive=process.argv.includes('--immersive')||process.env.WIDE_BENCH==='1';
const previewDir=process.env.HAND_PREVIEW_DIR;
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-7,`${label}: expected ${expected}, observed ${actual}`);

function checkRack(tubes,expected){
 for(const [id,recipe] of Object.entries(expected)){
  const sample=tubes[id];
  near(sample.stockVolume,recipe.stockVolume,id+' stock');near(sample.waterVolume,recipe.waterVolume,id+' water');
  near(sample.unknownVolume,0,id+' unknown');near(sample.volume,recipe.stockVolume+recipe.waterVolume,id+' total');
 }
}

async function installCamera(page,openFile,fistFile){
 const pictures=await Promise.all([openFile,fistFile].map(async file=>'data:image/jpeg;base64,'+(await fs.readFile(file)).toString('base64')));
 await page.addInitScript(({pictures,reflect})=>{
  const source=document.createElement('canvas');source.width=960;source.height=720;
  const ctx=source.getContext('2d',{alpha:false});
  const input=window.photoHand={pose:'open',x:.5,y:.5};
  const decoded=Promise.all(pictures.map(async url=>{const im=new Image();im.src=url;await im.decode();return im}));
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
   const [open,fist]=await decoded;
   function paint(){
    const spread=input.pose==='open',im=spread?open:fist;
    // Crop the upright hand, keeping the palm at the same point when testing
    // the opposite handedness. The detector still receives only image pixels.
    const sx=spread?362:0,sy=0,sw=im.width-sx,sh=im.height,size=220;
    const dx=input.x*source.width-size*(spread?.573:.472);
    const dy=input.y*source.height-size*(spread?.643:.403);
    ctx.fillStyle='#d6d8d4';ctx.fillRect(0,0,source.width,source.height);
    if(input.pose!=='missing'){
     ctx.save();
     if(reflect){ctx.translate(2*input.x*source.width,0);ctx.scale(-1,1)}
     ctx.drawImage(im,sx,sy,sw,sh,dx,dy,size,size);ctx.restore();
    }
   }
   paint();const timer=setInterval(paint,40),stream=source.captureStream(25);
   stream.getVideoTracks()[0].addEventListener('ended',()=>clearInterval(timer));
   return stream;
  }});
 },{pictures,reflect:process.env.HAND_SIDE==='Left'});
}

async function verify(page){
 await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:8774/');
 await page.waitForFunction(()=>!!window.lab);
 await useStandardBench(page);
 // Capture diagnostics only when the controller actually drops a held tool.
 // This leaves the detector and the timing of every ordinary packet untouched.
 await page.evaluate(async()=>{
  const {HandControls}=await import('./src/hand-controls.js'),lost=HandControls.prototype.lost;
  window.replayLosses=[];
  HandControls.prototype.lost=function(){
   if(this.interaction.owner==='hand')window.replayLosses.push({
    step:this.interaction.step.index,pose:photoHand.pose,waitingForGrip:!!this.delayedGrip,
    msSinceHand:Math.round(performance.now()-this.lastSeen),
    msSinceCamera:Math.round(performance.now()-this.camera.lastReceived),
    caller:new Error().stack?.split('\n').slice(2,5).join(' / ')
   });
   return lost.call(this);
  };
 });
 await page.locator('#labMenu summary').click();await page.locator('#qualityButton').click();await page.locator('#labMenu summary').click();
 if(process.env.WIDE_BENCH==='1'){
  await page.locator('#followStep').uncheck();await page.locator('#immerseButton').click();
  await page.locator('[data-view="overview"]').click();
 }else{
  await page.locator('#followStep').check();
  if(immersive)await page.locator('#immerseButton').click();
 }
 await page.locator('#handButton').click();
 if(process.env.HAND_SIDE)await page.locator('#handSide').selectOption(process.env.HAND_SIDE);
 assert.equal(await page.locator('#bulbMode').inputValue(),'guided');
 await page.locator('#handStart').click();
 await page.locator('#handBegin').waitFor({state:'visible',timeout:45000});
 const setup=await page.locator('#handPanel').evaluate(panel=>{
  const preview=document.querySelector('#handPreview').getBoundingClientRect(),mode=panel.querySelector('.hand-settings').getBoundingClientRect();
  return {viewport:innerWidth,width:panel.clientWidth,stacked:mode.top>=preview.bottom,
   scrollHeight:panel.scrollHeight,height:panel.clientHeight,contentWidth:panel.scrollWidth};
 });
 assert.equal(setup.contentWidth,setup.width,'Setup must fit horizontally');
 assert.equal(setup.stacked,setup.viewport<=565);
 if(setup.viewport>=1024){assert.ok(setup.width>=600);assert.equal(setup.scrollHeight,setup.height)}
 if(previewDir){
  await fs.mkdir(previewDir,{recursive:true});
  await page.waitForFunction(()=>document.querySelector('#handHeld').textContent.includes('Open palm'),null,{timeout:45000});
  await page.screenshot({path:path.join(previewDir,'hands-setup.jpg'),quality:90});
 }
 await page.locator('#handBegin').click({timeout:30000});
 await page.waitForFunction(()=>lab.hand.state.armed,null,{timeout:30000});
 if(immersive){
  assert.ok(await page.locator('#handHud').isVisible());
  await page.waitForFunction(()=>document.querySelector('#hudGrip').textContent==='Open palm');
 }
 // Position the hand photograph in the sensor frame. The resulting pickup,
 // liquid, occlusion, regrasp and withdrawal all run through the actual camera.
 await page.evaluate(async()=>{
  const {cameraRect}=await import(new URL('src/camera-framing.js',document.baseURI).href);
  const surface=document.getElementById('labCanvas'),input=window.photoHand;
  input.move=async(x,y,ms)=>{
   const w=surface.clientWidth,h=surface.clientHeight;
   const box=document.getElementById('handPlayerFrame').style;
   const area=Object.fromEntries(['left','top','width','height'].map(k=>[k,parseFloat(box[k])/100]));
   const size=Number(document.getElementById('handCameraSize').value)/100;
   const low={x:0,y:0},high={x:1,y:1};
   for(let i=0;i<20;i++){
    const palm={x:(low.x+high.x)/2,y:(low.y+high.y)/2},r=cameraRect(960/720,w/h,size,area,palm);
    if(r.left+palm.x*r.width<x/w)low.x=palm.x;else high.x=palm.x;
    if(r.top+palm.y*r.height<y/h)low.y=palm.y;else high.y=palm.y;
   }
   const destX=lab.studio.mirrored?1-low.x:low.x,destY=low.y;
   const startX=input.x,startY=input.y,begin=performance.now();
   // A short dip takes a fraction of a second. A cross-bench carry travels
   // farther in the camera image and takes correspondingly longer.
   const distance=Math.hypot((destX-startX)*960/720,destY-startY);
   const duration=ms??Math.max(420,distance/.65*1000);
   for(;;){
    const t=Math.min(1,(performance.now()-begin)/duration);
    input.x=startX+(destX-startX)*t;input.y=startY+(destY-startY)*t;
    if(t===1)return;
    await new Promise(r=>setTimeout(r,25));
   }
  };
 });
 const move=p=>page.evaluate(({x,y})=>photoHand.move(x,y),p);
 const observed=()=>page.evaluate(()=>({volume:lab.state[lab.manipulation.tool]?.volume||0,
  cue:lab.studio.immersive?document.getElementById('hudFlow').textContent+' '+document.getElementById('interactionStatus').innerText:
   document.getElementById('pipetteCue').innerText}));
 const awaitState=(fn,arg)=>page.waitForFunction(fn,arg,{timeout:14000});
 const cursor=()=>page.evaluate(()=>{const c=document.getElementById('handCursor');return {x:parseFloat(c.style.left),y:parseFloat(c.style.top)}});
 async function takePipette(id){
  const current=await page.evaluate(()=>lab.manipulation.tool);
  if(current===id)return;
  if(current){
   await move(await page.evaluate(()=>lab.affordances.aim));
   await awaitState(stand=>lab.targeting.hover===stand,current+'-stand');
   await page.evaluate(()=>photoHand.pose='open');
   await awaitState(()=>!lab.manipulation.tool&&lab.hand.state.armed);
  }
  const grip=id+'-grip';
  // Parking can reframe Follow step. Aim at the newly rendered station.
  await awaitState(key=>Object.values(lab.targeting.rings).includes(key),grip);
  await move(await page.evaluate(key=>lab.affordances.regions[key],grip));
  await awaitState(key=>{const c=document.getElementById('handCursor'),p=lab.affordances.regions[key];return !c.hidden&&Math.hypot(parseFloat(c.style.left)-p.x,parseFloat(c.style.top)-p.y)<15},grip);
  if(immersive){
   await awaitState(key=>lab.targeting.hover===key&&document.querySelector('#hudTargetLabel').textContent==='Palm target'&&
    document.querySelector('#hudTarget').textContent.toLowerCase().includes(key.startsWith('water')?'water':'stock'),grip);
   assert.match(await page.locator('#hudTarget').textContent(),id==='pipette'?/Stock/i:/water/i);
  }
  await page.evaluate(()=>photoHand.pose='fist');
  await awaitState(tool=>lab.manipulation.owner==='hand'&&lab.manipulation.tool===tool,id);
 }
 const transfers=standards.flatMap(({id,stock,water})=>[
  {tube:id,source:'stockBottle',tool:'pipette',component:'stockVolume',volume:stock},
  {tube:id,source:'waterBottle',tool:'waterPipette',component:'waterVolume',volume:water}
 ].filter(t=>t.volume>0));
 const strokes=(allTubes?transfers:transfers.slice(0,2)).flatMap(t=>[
  {...t,action:'aspirate',target:t.source},{...t,action:'dispense',target:t.tube}
 ]);
 const levels=await page.evaluate(()=>({stockBottle:lab.state.bottles.stockBottle.volume,waterBottle:lab.state.bottles.waterBottle.volume}));
 const expected=Object.fromEntries(standards.map(s=>[s.id,{stockVolume:0,waterVolume:0}]));
 const dips=[];
 for(const [index,{tube,source,component,action,target,tool,volume}] of strokes.entries()){
  const step=await page.evaluate(()=>lab.step);
  assert.deepEqual([step.index,step.action,step.target,step.pipetteId,step.volume],[index,action,target,tool,volume]);
  await takePipette(tool);
  const point=await page.evaluate(()=>lab.affordances.aim);
  const drawing=action==='aspirate';
  near((await observed()).volume,drawing?0:volume,'Pipette before '+action);
  await move({x:point.x,y:point.y-32});
  await move(point);await awaitState(id=>lab.manipulation.contact?.target===id,target);
  let rim=await cursor();
  if(index===0){
   await page.waitForTimeout(500);
   assert.equal((await observed()).volume,0,'A closed hand resting at the rim must not draw');
  }
  // Move only the photograph. Measure the palm displacement reported by the
  // detector, independent of the gesture threshold used by the controller.
  await move({x:rim.x+3,y:rim.y+17});
  await awaitState(({target,volume,tool})=>lab.manipulation.contact?.target===target&&lab.manipulation.flow
   &&lab.state[tool].volume>.05&&lab.state[tool].volume<volume-.05,{target,volume,tool});
  const seated=await cursor(),dy=seated.y-rim.y;
  assert.ok(dy>0&&dy<=21,'A short dip should seat the pipette, observed '+dy+' px');
  dips.push({action,target,volume,palmTravelPx:+dy.toFixed(1)});
  const flowing=await observed();
  assert.ok(await page.locator(immersive?'#handHud':'#pipetteCue').isVisible());
  assert.match(flowing.cue,drawing?/Drawing/:/Dispensing/);
  if(immersive){
   assert.equal(await page.locator('#hudFlow').textContent(),drawing?'Drawing':'Dispensing');
   assert.equal(await page.locator('#hudGripLabel').textContent(),'Holding');
   assert.equal(await page.locator('#hudTargetLabel').textContent(),'Tip target');
   const targetName=target==='stockBottle'?'Blue #1 stock':target==='waterBottle'?'Distilled water':target.slice(5).split('_').join(' / ');
   assert.ok((await page.locator('#hudTarget').textContent()).includes(targetName));
   assert.ok(await page.evaluate(()=>document.querySelector('#hudVolume').textContent===document.querySelector('#meniscusGuide span').textContent));
   assert.equal(await page.evaluate(()=>lab.studio.liveRoom),false);
   const hudFits=await page.locator('#handHud').evaluate(el=>{
    const r=el.getBoundingClientRect(),dock=document.querySelector('.bench-dock').getBoundingClientRect();
    return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&(r.right<=dock.left||r.bottom<=dock.top);
   });
   assert.ok(hudFits,'The HUD must clear the bench tool dock');
   if(previewDir&&index===3){
    await awaitState(()=>lab.state.tubes.tube_8_2.stockVolume>=2);
    await page.screenshot({path:path.join(previewDir,'immersive-hands.jpg'),quality:92});
   }
  }
  if(index===0){
   // Lose tracking during aspiration, then regrasp and re-dip at the same mouth.
   await page.evaluate(()=>photoHand.pose='missing');
   await awaitState(()=>lab.manipulation.frozen&&!lab.manipulation.owner);
   await awaitState(()=>/regrasp/i.test(document.getElementById(lab.studio.immersive?'interactionStatus':'pipetteCue').innerText));
   const interrupted=await observed();assert.ok(interrupted.volume>0&&interrupted.volume<10);
   assert.match(interrupted.cue,/regrasp/);
   await move(await page.evaluate(()=>lab.affordances.regions['pipette-grip']));
   await page.evaluate(()=>photoHand.pose='open');await awaitState(()=>lab.hand.state.armed);
   await page.evaluate(()=>photoHand.pose='fist');await awaitState(()=>lab.manipulation.owner==='hand');
   assert.equal((await observed()).volume,interrupted.volume);
   const held=await cursor();await move({x:held.x+2,y:held.y-19});
   await awaitState(()=>lab.manipulation.contact?.target==='stockBottle'&&lab.manipulation.contact.depth===0);
   assert.equal((await observed()).volume,interrupted.volume);
   rim=await cursor();await move({x:rim.x,y:rim.y+17});await awaitState(()=>lab.manipulation.flow);
  }else{
   await page.evaluate(({x,y})=>photoHand.move(x+3,y-4,200),seated);
   assert.equal(await page.evaluate(()=>lab.manipulation.contact?.depth),1,'A brief wobble lifted the tip');
  }
  await awaitState(next=>lab.step.index===next,index+1);
  const state=await page.evaluate(()=>lab.state);
  if(drawing){
   levels[source]-=volume;
   await awaitState(text=>{const guide=document.getElementById('meniscusGuide');return !guide.hidden&&guide.textContent.trim()===text},volume.toFixed(1)+' mL');
  }else expected[tube][component]+=volume;
  for(const id of ['pipette','waterPipette','unknownPipette'])near(state[id].volume,drawing&&id===tool?volume:0,id);
  for(const [id,level] of Object.entries(levels))near(state.bottles[id].volume,level,id);
  checkRack(state.tubes,expected);
  assert.equal(state.history.length,index+1);
  if(allTubes&&!drawing)console.log(`${tube}: delivered ${volume} mL from ${source}, checked all six tubes`);
  await move({x:rim.x,y:rim.y-20});
  await awaitState(()=>lab.manipulation.contact===null);
 }
 const outcome=await page.evaluate(()=>({stock:lab.state.bottles.stockBottle.volume,water:lab.state.bottles.waterBottle.volume,
  tube1:lab.state.tubes.tube_10_0.volume,tube2:lab.state.tubes.tube_8_2.volume,tube3:lab.state.tubes.tube_6_4.volume,pipette:lab.state.pipette.volume,
  records:lab.state.history.length,backend:lab.hand.state.backend,grips:lab.atomicHistory.filter(e=>['grasp','regrasp'].includes(e.action)).map(e=>e.input),
  freezes:lab.atomicHistory.filter(e=>e.action==='freeze').map(e=>e.step)}));
 assert.equal(outcome.records,strokes.length);
 assert.ok(outcome.grips.length>0&&outcome.grips.every(owner=>owner==='hand'));
 assert.deepEqual(outcome.freezes,[0],'Only the deliberately hidden hand should require a regrasp');
 if(immersive&&!await page.locator('#immersiveNotebook').isVisible())await page.locator('#dataWing summary').click();
 await page.locator(immersive?'#immersiveNotebook':'#notebookButton').click();
 const download=page.waitForEvent('download');await page.locator('#exportJson').click();
 const notebook=JSON.parse(await fs.readFile(await (await download).path(),'utf8'));
 assert.equal(notebook.step,strokes.length);assert.equal(notebook.history.length,strokes.length);
 checkRack(notebook.tubes,expected);
 const tubes=Object.fromEntries(standards.map(({id})=>{
  const {stockVolume,waterVolume,volume}=notebook.tubes[id];return [id,{stockVolume,waterVolume,volume}];
 }));
 await page.locator('#notebookDialog [data-close]').click();
 assert.deepEqual(await page.evaluate(()=>lab.studio.cameraUsers),['hands']);
 const track=await page.locator('#handVideo').evaluateHandle(video=>video.srcObject.getVideoTracks()[0]);
 await page.locator('#cameraButton').click();
 assert.equal(await track.evaluate(t=>t.readyState),'ended');
 assert.deepEqual(await page.evaluate(()=>lab.studio.cameraUsers),[]);
 console.log(JSON.stringify({...outcome,workingHand:await page.locator('#handSide').inputValue(),tubes,dips}));
}

async function main(){
 const [openFile,fistFile]=process.argv.slice(2);
 if(!openFile||!fistFile)throw Error('Pass MediaPipe right_hands.jpg and fist.jpg as the two arguments.');
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,
  args:['--enable-unsafe-swiftshader','--disable-renderer-backgrounding','--disable-background-timer-throttling']});
 try{
  const page=await browser.newPage({viewport:process.env.WIDE_BENCH==='1'?{width:1856,height:866}:
   process.argv.includes('--phone')?{width:390,height:844}:process.argv.includes('--laptop')?{width:1280,height:800}:{width:1440,height:900}});
  await installCamera(page,openFile,fistFile);
  try{await verify(page)}catch(error){
   console.error(await page.evaluate(()=>({step:lab.step.index,state:lab.manipulation,next:lab.affordances.aim,
    tip:lab.affordances.end,hover:lab.targeting.hover,status:document.getElementById('handStatus').innerText,
    cue:document.getElementById('pipetteCue').innerText,cursor:document.getElementById('handCursor').style.cssText,
    events:lab.atomicHistory.slice(-5),losses:window.replayLosses})));throw error;
  }
 }finally{await browser.close()}
}
module.exports={installCamera};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1});
