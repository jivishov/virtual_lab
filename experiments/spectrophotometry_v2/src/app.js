import {StudioExperience} from './studio.js';
import {StudioCamera} from './studio-camera.js';
import {ProcedureVoice} from './procedure-voice.js';
import {renderNotebook,bindNotebook,readingsCsv} from './notebook.js';
import {PIPETTES,pipetteIds} from './pipettes.js';
import {createState,getStep,setStatus,setWavelength,STEPS,fitCalibration} from './model.js';
import {LabScene,LABELS} from './scene.js';
import {BenchLayout} from './layout.js';
import {SceneInteraction} from './scene-interaction.js';
import {Manipulation} from './manipulation.js';
import {MouseInput} from './mouse-input.js';
import {InteractionOverlay} from './interaction-overlay.js';
import {HandControls} from './hand-controls.js';
const $=id=>document.getElementById(id),canvas=$('labCanvas');
function setText(id,text){
 const el=$(id);
 if(el.textContent!==text)el.textContent=text;
}
let state=createState(),scene,renderer,layout,geometry,interaction,hands,overlay,mouse,dirty=true,uiDirty=true,observations='';
let noticeTimer,studio,lastRoomFrame=0,lastBenchFrame=-Infinity;
const source=new StudioCamera();
const voice=new ProcedureVoice($('procedureAudio'));
const benchPointers=new Set();
document.addEventListener('pointerdown',e=>{
 if(e.isTrusted&&studio?.spatial.active){benchPointers.add(e.pointerId);studio.panelPointer.cancel()}
},true);
canvas.addEventListener('pointerdown',e=>{benchPointers.add(e.pointerId);if(hands?.camera.running)hands.yieldToPointer()},true);
for(const event of ['pointerup','pointercancel','lostpointercapture']){
 window.addEventListener(event,e=>benchPointers.delete(e.pointerId),true);
}
window.addEventListener('blur',()=>benchPointers.clear());
document.addEventListener('visibilitychange',()=>{if(document.hidden)benchPointers.clear()});
const phaseStarts=[0,...['blank','standards','unknown'].map(phase=>STEPS.findIndex(step=>step.phase===phase)),STEPS.findIndex(step=>step.action==='report')];
function updateProtocol(step){
 const phase=phaseStarts.filter(i=>step.index>=i).length-1;
 document.querySelectorAll('#phaseList li').forEach((item,i)=>{
   const current=i===phase&&!state.finished;
   item.classList.toggle('current',current);item.classList.toggle('done',i<phase||state.finished);
   if(current)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');
 });
 $('waveReadout').textContent=state.wavelength+' nm';$('runStatus').dataset.status=state.status;
}
function clearNotice(){
 clearTimeout(noticeTimer); $('feedback').hidden=true; $('microInstruction').hidden=false; $('interactionStatus').classList.remove('error');
}
function feedback(message,error=false){
 clearTimeout(noticeTimer); $('feedback').textContent=message; $('feedback').hidden=false;
 $('microInstruction').hidden=true; $('interactionStatus').classList.toggle('error',error);
 noticeTimer=setTimeout(clearNotice,error?4200:2300);
}
function usePointer(){
 closeDockMenus(); clearNotice();
}
function suspendInput(message){
 mouse?.forget(); mouse?.stopKey();
 if(['mouse','touch'].includes(interaction?.owner)) interaction.endMousePress();
 interaction?.suspend(message);
}
function changed(){dirty=true;uiDirty=true}
function useTabletFraming(){
 return matchMedia('(max-width: 760px), (min-width: 768px) and (min-height: 600px) and (max-width: 1199px), (pointer: coarse) and (min-width: 768px) and (min-height: 768px) and (max-width: 1366px)').matches;
}
function stopFollowing(){
 $('followStep').checked=false;
}
function followOperation(step){
 if(!$('followStep').checked||!interaction||layout.active||mouse.stroke||interaction.owner||interaction.contact||interaction.flow||
    interaction.frozen||state.status!=='running'||document.querySelector('dialog[open]'))return;
 // Keep the previous station visible until the learner parks the outgoing tool.
 if(interaction.tool && interaction.tool!==(step.pipetteId||'cuvette'))return;
 if(interaction.tool==='cuvette' && !['insert','empty','remove'].includes(step.action))return;
 let ids;
 if(step.pipetteId){
   // Frame the whole run with this pipette before pickup. Every source and
   // destination stays reachable while the learner keeps the same grip.
   const needed=new Set([PIPETTES[step.pipetteId].stand]);
   for(let i=step.index;i<STEPS.length&&STEPS[i].pipetteId===step.pipetteId;i++)needed.add(STEPS[i].target);
   ids=[...needed];
 }else if(step.target==='notebook')ids=['clipboard','instrument'];
 else if(step.action==='empty'||step.action==='remove')ids=['instrument','wasteBeaker','cuvetteDock'];
 else if(step.action)ids=['instrument','cuvetteDock'];
 else return;
 const current=scene.viewSelection?.ids;
 const handReach=!!(step.pipetteId&&hands?.camera.running);
 if(current?.length===ids.length&&current.every((id,i)=>id===ids[i])&&scene.viewSelection.handReach===handReach)return;
 scene.frameOperation(ids,handReach);
 $('inspectMenu').classList.remove('selected');
 $('inspectEquipment').value='';
 document.querySelectorAll('[data-view]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')});
}
function updateUI(){
 scene.updateInstrument(state);
 const contact=interaction?.contact;
 const inserted=contact?.kind==='pipette'&&contact.depth>0;
 renderer.insertedPipette=inserted?interaction.tool:null;
 renderer.surroundingLiquid=inserted?scene.liquids[contact.target]?.node:null;
 scene?.setBulbPressed(!!interaction?.compressed,interaction?.tool);
 const step=getStep(state);
 setText('stepCount',String(Math.min(step.index+1,STEPS.length)).padStart(2,'0')+' / '+STEPS.length);
 setText('stepTitle',step.phase==='prepare'?step.title.replace(/^Prepare (.+)$/,'Prepare the $1 standard'):step.title);
 setText('instruction',step.instruction);
 updateProtocol(step);$('progressFill').style.width=step.index/STEPS.length*100+'%';
 setText('readingCount',Object.keys(state.results).length+'/8');
 setText('runStatus',state.status==='paused'?'Paused':state.status==='stopped'?'Stopped':interaction?.flow?'Transferring':state.finished?'Complete':'Ready');
 for(const [id,status] of [['runButton','running'],['pauseButton','paused'],['stopButton','stopped']]){$(id).classList.toggle('active',state.status===status);$(id).setAttribute('aria-pressed',String(state.status===status))}
 const wavelengthInput=$('wavelength'),wavelengthSlider=$('wavelengthSlider');
 wavelengthInput.disabled=state.status!=='running'||!!interaction?.flow;
 wavelengthSlider.disabled=wavelengthInput.disabled;
 if(document.activeElement!==wavelengthInput)wavelengthInput.value=state.wavelength;
 wavelengthSlider.value=state.wavelength;
 const spokenWavelength=state.wavelength+' nanometers';
 if(wavelengthSlider.getAttribute('aria-valuetext')!==spokenWavelength)wavelengthSlider.setAttribute('aria-valuetext',spokenWavelength);
 layout?.refresh();hands?.refresh();followOperation(step);
 const handCue=hands?.pipetteCue();
 overlay?.update(handCue,!studio?.immersive);
 let hint=handCue?.instruction||mouse?.instruction()||'';
 if(hands?.camera.running&&!['mouse','touch','keyboard'].includes(interaction.owner)){
   if(studio?.mode==='view')hint='Close one palm to orbit. Spread two to zoom.';
   else if(!hands.camera.modelReady)hint='Starting local hand tracking…';
   else if(!interaction.tool){
    const target=interaction.hoverRegion;
    hint=hands.cursor.hidden?'Show an open palm.':target?(hands.gate.holding?'Open your palm.':target.endsWith('-grip')?'Curl three fingers to grasp.':'Close and open to select.'):
      step.pipetteId?'Aim your open palm at the '+PIPETTES[step.pipetteId].mark.toLowerCase()+' pipette.':hands.hint;
   }
 }
 hint=studio?.updateHud(step,overlay.guides.focus)||hint;
 setText('microInstruction',hint);
 voice.sync(step,state.status);
 uiDirty=false;if($('notebookDialog').open)renderNotebook(state);
}
function control(status){suspendInput(status==='running'?'Regrasp the marked tool to continue.':status==='paused'?'Paused. All partial volumes and poses are preserved.':'Stopped. Partial volumes are preserved; choose Run and regrasp.');if(status==='stopped')studio?.stop();else hands?.resetInput();setStatus(state,status);changed();updateUI()}
function animate(now){
 // Leave GPU time for camera inference while continuously rendering a dose.
 // Liquid advances by elapsed time; gesture evidence uses sensor timestamps.
 if(!hands?.camera.running||now-lastBenchFrame>=1000/30-1){
  lastBenchFrame=now;interaction?.tick(now);
  if(renderer?.roomVideo&&renderer.roomVideo.currentTime!==renderer.videoTime&&now-lastRoomFrame>55){dirty=true;lastRoomFrame=now}
  if(uiDirty)updateUI();
  if(dirty&&renderer){renderer.render();dirty=false}
 }
 requestAnimationFrame(animate)}
function guardViewChange(){
 stopFollowing();
 if(interaction?.owner)suspendInput('View changed. Pick up the tool again to continue.');
 hands?.resetInput();
}
function setView(view){guardViewChange();$('inspectMenu').classList.remove('selected');scene.setView(view);$('inspectEquipment').value='';document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view))});changed()}
function locateTarget(id){
 if(!id)return;const region=geometry.region(id),equipment=region?.equipment;
 const main=equipment?.endsWith('-stand')?PIPETTES[equipment.slice(0,-6)]?.stand:
   ({instrument_lid:'instrument','cuvette-dock':'cuvetteDock'})[equipment]||equipment;
 if(!main||!scene.objects[main])return;
 guardViewChange();closeDockMenus();
 scene.focusTarget(main,interaction.tool);
 document.querySelectorAll('[data-view]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')});
 clearNotice();changed();
}
function setupCamera(){
 let pointer=null;
 const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
 const local=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}};
 const panLimits=[7,4.5,4.5];
 const pan=(from,to)=>{
  if(!from||!to)return;
  const at=renderer.cam.at;
  const offset=from.map((value,axis)=>value-to[axis]);
  // Stop the whole motion at a limit. Clipping components separately would
  // make a vertical drag slide sideways or move closer to the apparatus.
  let fraction=1;
  for(let axis=0;axis<3;axis++){
   const delta=offset[axis];
   if(Math.abs(delta)<1e-8)continue;
   const edge=Math.sign(delta)*panLimits[axis];
   fraction=Math.min(fraction,Math.max(0,(edge-at[axis])/delta));
  }
  for(let axis=0;axis<3;axis++)at[axis]+=offset[axis]*fraction;
  renderer.updateCamera();
 };
 const endDrag=()=>{
  if(!pointer)return;
  const {id,drag}=pointer;pointer=null;
  if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
  if(drag)canvas.style.cursor=layout.active?'grab':'';
 };
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault()});
 canvas.addEventListener('pointerdown',e=>{
  if(!e.isPrimary||pointer||mouse.stroke||layout.drag||![0,1,2].includes(e.button))return;
  if(e.button===0&&e.pointerType!=='mouse')return;
  const mode=e.button===2&&!e.shiftKey&&!e.altKey?'pan':'orbit';
  const p=local(e);
  usePointer();e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
  pointer={id:e.pointerId,button:e.button,buttons:e.buttons,mode,last:p,drag:false};
 });
 canvas.addEventListener('pointermove',e=>{
  if(!pointer||pointer.id!==e.pointerId)return;
  if(e.buttons!==pointer.buttons){endDrag();return}
  const p=local(e),last=pointer.last;
  const dx=p.x-last.x,dy=p.y-last.y;
  if(!pointer.drag){
   if(Math.hypot(dx,dy)<=3)return;
   pointer.drag=true;guardViewChange();scene.viewSelection=null;
   canvas.style.cursor='grabbing';
  }
  if(pointer.mode==='pan'){
   // Drag in the plane of the screen at the bench's focus distance.
   const depth=renderer.project(renderer.cam.at).z;
   pan(renderer.unproject(last.x,last.y,depth),renderer.unproject(p.x,p.y,depth));
  }else{
   renderer.cam.yaw-=dx*.006;
   if(dy)renderer.cam.pitch=clamp(renderer.cam.pitch+dy*.005,.22,1.5);
   renderer.updateCamera();
  }
  pointer.last=p;changed();
 });
 canvas.addEventListener('pointerup',e=>{
  if(!pointer||pointer.id!==e.pointerId)return;
  const secondaryClick=pointer.button===2&&e.button===2&&!pointer.drag;
  endDrag();if(secondaryClick)mouse.secondary(local(e));
 });
 const cancel=e=>{if(pointer?.id===e.pointerId)endDrag()};
 canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);
 window.addEventListener('blur',endDrag);
 canvas.addEventListener('wheel',e=>{
  e.preventDefault();guardViewChange();scene.viewSelection=null;
  const p=local(e),before=renderer.onPlane(p.x,p.y);
  renderer.cam.distance=clamp(renderer.cam.distance*Math.exp(e.deltaY*.0012),.6,23);renderer.updateCamera();
  pan(before,renderer.onPlane(p.x,p.y));changed();
 },{passive:false});
 canvas.addEventListener('keydown',e=>{if(layout.active||interaction.tool)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','+','-'].includes(e.key)){e.preventDefault();guardViewChange();scene.viewSelection=null;if(e.key==='Home')setView('overview');if(e.key==='ArrowLeft')renderer.cam.yaw-=.1;if(e.key==='ArrowRight')renderer.cam.yaw+=.1;if(e.key==='ArrowUp')renderer.cam.pitch=Math.min(1.5,renderer.cam.pitch+.08);if(e.key==='ArrowDown')renderer.cam.pitch=Math.max(.22,renderer.cam.pitch-.08);if(e.key==='+')renderer.cam.distance=Math.max(.6,renderer.cam.distance*.9);if(e.key==='-')renderer.cam.distance=Math.min(23,renderer.cam.distance/ .9);renderer.updateCamera();changed()}});
 new ResizeObserver(()=>{
  if(interaction.owner)guardViewChange();
  renderer.resize();scene.refitView();changed();
 }).observe(canvas);
}
function openNotebook(){
 if(interaction?.tool)suspendInput('Notebook open. Pick up the tool again after closing it.');
 hands?.resetInput();
 $('decisionFeedback').textContent='';
 renderNotebook(state);
 const dialog=$('notebookDialog');
 if(!dialog.open)dialog.showModal();
 const field={fit:'fitButton',plan:'aliquot',report:'diluted'}[getStep(state).action];
 if(field)$(field).focus();
}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function closeDockMenus(){document.querySelectorAll('.dock-entry').forEach(menu=>{menu.open=false})}
function setupControls(){
 document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',changed));
 $('runButton').onclick=()=>control('running');$('pauseButton').onclick=()=>control('paused');$('stopButton').onclick=()=>control('stopped');
 $('resetButton').onclick=()=>{$('labMenu').open=false;suspendInput('Reset confirmation open.');$('resetDialog').showModal()};
 $('confirmReset').onclick=()=>{studio.stop();studio.setMode('work');hands.reset();voice.reset();state=createState();scene.cancel();scene.sync(state);interaction.reset();setView('overview');$('followStep').checked=useTabletFraming();observations='';$('observations').value='';for(const id of ['aliquot','original','factor','diluted'])$(id).value='';$('decisionFeedback').textContent='';$('resetDialog').close();clearNotice();changed();updateUI()};
 const tuneWavelength=e=>{
  const input=e.currentTarget;
  if(interaction.flow){input.value=state.wavelength;return}
  const result=setWavelength(state,input.valueAsNumber);
  $('wavelength').value=state.wavelength;
  if(e.type==='change')feedback(result.message,!result.ok);
  changed();
 };
 $('wavelength').onchange=tuneWavelength;
 $('wavelengthSlider').oninput=tuneWavelength;
 $('wavelengthSlider').onchange=tuneWavelength;
 $('followStep').onchange=()=>{if(!$('followStep').checked)scene.viewSelection=null;changed()};
 $('notebookButton').onclick=openNotebook;$('helpButton').onclick=()=>{suspendInput('Guide open. Pick up the tool again after closing it.');hands.resetInput();$('helpDialog').showModal()};
 document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{setView(b.dataset.view);closeDockMenus()});
 for(const menu of document.querySelectorAll('.dock-entry')){menu.addEventListener('toggle',()=>{menu.querySelector('summary').setAttribute('aria-expanded',String(menu.open));if(menu.open){document.querySelectorAll('.dock-entry').forEach(other=>{if(other!==menu)other.open=false});$('handPanel').hidden=true;$('handButton').setAttribute('aria-expanded','false')}})}
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('.dock-entry,.hand-choice'))closeDockMenus()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){const open=document.querySelector('.dock-entry[open]');if(open){closeDockMenus();open.querySelector('summary').focus();e.preventDefault()}}});
 $('handButton').addEventListener('click',closeDockMenus);
 for(const item of scene.layoutItems){$('inspectEquipment').add(new Option(item.label,item.id))}
 $('inspectEquipment').onchange=()=>{const id=$('inspectEquipment').value;if(!id)return;guardViewChange();closeDockMenus();$('inspectMenu').classList.add('selected');scene.inspectEquipment(id);document.querySelectorAll('[data-view]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')});feedback('Inspecting '+$('inspectEquipment').selectedOptions[0].text+'. Drag empty space to orbit. Choose Bench to return.');changed()};
 $('qualityButton').onclick=()=>{const levels=['balanced','high','low'],next=levels[(levels.indexOf(renderer.level)+1)%3];renderer.setQuality(next);$('qualityButton').textContent='Quality: '+next;changed()};
 const toggleGuidance=()=>{const collapsed=$('taskRibbon').classList.toggle('collapsed');$('collapseTask').setAttribute('aria-expanded',String(!collapsed));$('collapseTask').setAttribute('aria-label',collapsed?'Expand step guidance':'Minimize step guidance');$('collapseTask').textContent=collapsed?'+':'−'};
 $('collapseTask').onclick=toggleGuidance;$('taskRibbon').addEventListener('click',e=>{if(e.target.id!=='collapseTask'&&$('taskRibbon').classList.contains('collapsed'))toggleGuidance()});
 $('observations').oninput=()=>{observations=$('observations').value};
 bindNotebook(()=>state,()=>{changed();updateUI()});
 $('exportJson').onclick=()=>download('blue-1-v2-notebook.json',JSON.stringify({experiment:'Blue #1 calibration and dilution',version:2,...state,calibration:state.analysis.fitted?fitCalibration(state):null,observations,layout:scene.layoutData()},null,2),'application/json');
 $('exportCsv').onclick=()=>download('blue-1-v2-readings.csv',readingsCsv(state),'text/csv');
}
function readAffordances(){
 const ids=[...pipetteIds.flatMap(id=>[id+'-grip',id+'-bulb']),'cuvette-grip','lid','zero','read','clipboard'];
 const tool=interaction.tool,carry=interaction.carry,node=scene.objects[tool];
 const heldPoint=tool&&carry?renderer.project(node.pos.map((v,i)=>v+carry.gripOffset[i])):null;
 return {
  description:interaction.describe(),grip:geometry.project(tool?tool+'-grip':interaction.describe().region),
  bulb:geometry.project('pipette-bulb'),heldPoint,end:tool?interaction.workingEnd():null,
  aim:interaction.aimScreen(),regions:Object.fromEntries(ids.map(id=>[id,geometry.project(id)]))
 };
}
async function start(){try{
 renderer=new E3D.Renderer(canvas,'high');scene=new LabScene(renderer);await scene.load();scene.sync(state);geometry=new SceneInteraction(scene);
 interaction=new Manipulation({scene,geometry,getState:()=>state,onChange:changed,onFeedback:(message,error)=>{if(error)feedback(message,true)},onNotebook:openNotebook});
 layout=new BenchLayout(scene,{canvas,onChange:changed,onFeedback:feedback,isBusy:()=>interaction.busy||!!hands?.busy,onModeChange:()=>{hands?.resetInput();closeDockMenus();changed()}});
 mouse=new MouseInput({canvas,geometry,interaction,layout,usePointer,handActive:()=>!!hands?.camera.running});
 overlay=new InteractionOverlay({scene,geometry,interaction,layout,mouse,onLocate:locateTarget,stopHand:()=>{if(hands?.camera.running&&!studio?.spatial.active)hands.stop()}});
 hands=new HandControls({scene,geometry,interaction,layout,canvas,source,pointerBusy:()=>benchPointers.size>0||['mouse','touch','keyboard'].includes(interaction.owner),onStart:()=>suspendInput('Hand control enabled. Grasp the tool to continue.'),getState:()=>state,onChange:changed,onFeedback:feedback});
 studio=new StudioExperience({source,hands,renderer,scene,canvas,suspend:suspendInput,stopFollowing,changed,trackingChanged:()=>{uiDirty=true},openNotebook,locateTarget,pointerDown:()=>benchPointers.size>0});
 $('targetsMenu').addEventListener('toggle',()=>{
   if(!$('targetsMenu').open&&studio.spatial.active&&interaction.owner==='keyboard')suspendInput('Targets closed. Regrasp the marked tool to continue.');
 });
 setupCamera();setupControls();setView(canvas.clientWidth<=760?'prepare':'overview');$('followStep').checked=useTabletFraming();
 $('loading').hidden=true;clearNotice();updateUI();renderer.render();requestAnimationFrame(animate);
 globalThis.lab={get state(){return structuredClone(state)},get step(){return {...getStep(state)}},get busy(){return interaction.flow},control,get camera(){return structuredClone(renderer.cam)},get layout(){return scene.layoutData()},get layoutActive(){return layout.active},get equipmentPositions(){return Object.fromEntries(scene.layoutItems.map(({id})=>[id,[...scene.objects[id].pos]]))},get chamber(){return [...scene.chamber]},get poses(){return {pipette:[...scene.objects.pipette.pos],cuvette:[...scene.objects.cuvette.pos],cuvetteRotation:[...scene.objects.cuvette.rot],lid:scene.lid.rot[0]}},get manipulation(){return structuredClone(interaction.state)},get atomicHistory(){return structuredClone(interaction.history)},get targeting(){return {next:interaction.nextTarget(),hover:interaction.hoverTarget||interaction.hoverRegion,locked:interaction.contact?.target||null,settle:interaction.aimSettler.progress,label:null,rings:{next:overlay.guides.beacon.id,focus:overlay.guides.focus.id},targets:Object.fromEntries([...new Set([...interaction.candidates(),...pipetteIds.map(id=>id+'-grip'),...['cuvette-grip','lid','zero','read','clipboard']])].map(id=>[id,geometry.screenTarget(id)]))}},get affordances(){return readAffordances()},hand:{frame:f=>hands.frame(f),packet:p=>hands.packet(p),lost:()=>hands.lost(),get state(){return {active:hands.camera.running,backend:hands.camera.backend,armed:hands.gate.armed,holding:interaction.owner==='hand'?interaction.tool:hands.held?.id||null}}},get studio(){return {immersive:studio.immersive,handMode:studio.mode,liveRoom:!!renderer.roomVideo,cameraUsers:[...source.owners],mirrored:source.mirrored}},get renderInfo(){return {frameTime:lastBenchFrame,quality:renderer.level,resolution:[canvas.width,canvas.height],css:[canvas.clientWidth,canvas.clientHeight],bloom:renderer.bloomOn,meshes:renderer.meshes.length}},get assetMeta(){return scene.assetMeta}};
 }catch(error){console.error(error);$('loading').hidden=false;$('loading').querySelector('h2').textContent='The 3D laboratory could not start';$('loading').querySelector('p').textContent=error.message;$('loading').querySelector('.loading-mark').style.display='none'}}
start();
