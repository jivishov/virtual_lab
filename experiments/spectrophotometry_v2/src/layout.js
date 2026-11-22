/* Personal bench arrangement. Only equipment layout is stored; experiment state stays separate. */
const STORAGE_KEY='spectrophotometry.bench-layout.v2-studio';
const TURN=Math.PI/12;

export class BenchLayout {
 constructor(scene,{canvas,onChange=()=>{},onFeedback=()=>{},isBusy=()=>false,onModeChange=()=>{}}={}){
  this.scene=scene;this.canvas=canvas;this.onChange=onChange;this.onFeedback=onFeedback;this.isBusy=isBusy;this.onModeChange=onModeChange;
  this.active=false;this.drag=null;this.selected=null;this.storageAvailable=true;
  this.button=document.getElementById('arrangeButton');this.panel=document.getElementById('layoutPanel');
  if(!canvas||!this.button||!this.panel)throw Error('Bench arrangement controls are unavailable.');
  this.items=scene.layoutItems||[];this.stage=canvas.closest('.stage');
  this.build();this.bind();this.load();this.refresh();
 }
 build(){
  this.button.type='button';this.button.setAttribute('aria-controls','layoutPanel');this.button.setAttribute('aria-pressed','false');
  this.panel.classList.add('bench-layout');this.panel.setAttribute('aria-label','Arrange your bench');this.panel.hidden=true;
  this.panel.innerHTML=`<div class="layout-heading"><div><span class="eyebrow">YOUR WORKSPACE</span><h2>Arrange the bench</h2></div><button type="button" class="layout-done" aria-label="Finish arranging">Done</button></div>
   <p class="layout-intro">Drag equipment to a comfortable position.</p>
   <details class="layout-settings"><summary><span>Position controls</span><span class="layout-selected-label">Choose equipment</span></summary>
    <fieldset class="layout-fields"><legend class="layout-sr-only">Equipment arrangement</legend>
     <label class="layout-select-label" for="layoutEquipment">Equipment</label><select id="layoutEquipment" aria-describedby="layoutHint"></select>
     <div class="layout-nudge" role="group" aria-label="Move selected equipment in the current view">
      <button type="button" data-nudge="0,-1" class="layout-up" aria-label="Move farther away" title="Move farther away">↑</button>
      <button type="button" data-nudge="-1,0" class="layout-left" aria-label="Move left" title="Move left">←</button>
      <span class="layout-nudge-center" aria-hidden="true">Move</span>
      <button type="button" data-nudge="1,0" class="layout-right" aria-label="Move right" title="Move right">→</button>
      <button type="button" data-nudge="0,1" class="layout-down" aria-label="Move closer" title="Move closer">↓</button>
     </div>
     <div class="layout-rotate" role="group" aria-label="Rotate selected equipment"><button type="button" data-rotate="-1" aria-label="Rotate counterclockwise 15 degrees">↶ <span>15°</span></button><button type="button" data-rotate="1" aria-label="Rotate clockwise 15 degrees">↷ <span>15°</span></button></div>
     <p id="layoutHint" class="layout-hint">Arrow keys move in this view. Hold Shift for larger steps. [ and ] turn.</p>
     <button type="button" class="layout-restore">Restore starting layout</button>
    </fieldset>
   </details>
   <p class="layout-status" role="status" aria-live="polite">Your arrangement is saved on this device.</p>`;
  this.select=this.panel.querySelector('select');this.fields=this.panel.querySelector('fieldset');this.details=this.panel.querySelector('details');
  this.status=this.panel.querySelector('.layout-status');this.selectedLabel=this.panel.querySelector('.layout-selected-label');
  this.details.open=!matchMedia('(max-width:760px)').matches;
  for(const item of this.items){const option=document.createElement('option');option.value=item.id;option.textContent=item.label;this.select.append(option)}
  this.selected=this.items[0]?.id||null;this.updateSelection();
 }
 bind(){
  this.button.addEventListener('click',()=>this.toggle());
  this.panel.querySelector('.layout-done').addEventListener('click',()=>this.toggle());
  this.select.addEventListener('change',()=>{this.selected=this.select.value;this.updateSelection();this.announce(`${this.label()}. Drag it on the bench or use the arrows.`,false)});
  for(const button of this.panel.querySelectorAll('[data-nudge]'))button.addEventListener('click',()=>this.nudge(...button.dataset.nudge.split(',').map(Number)));
  for(const button of this.panel.querySelectorAll('[data-rotate]'))button.addEventListener('click',()=>this.rotate(Number(button.dataset.rotate)));
  this.panel.querySelector('.layout-restore').addEventListener('click',()=>this.restore());
  // Capture prevents a layout gesture from becoming an ordinary experiment click.
  this.canvas.addEventListener('pointerdown',e=>this.pointerDown(e),true);
  this.canvas.addEventListener('pointermove',e=>this.pointerMove(e),true);
  this.canvas.addEventListener('pointerup',e=>this.pointerEnd(e),true);
  this.canvas.addEventListener('pointercancel',e=>this.pointerEnd(e),true);
  this.canvas.addEventListener('lostpointercapture',e=>this.pointerEnd(e),true);
  this.canvas.addEventListener('keydown',e=>this.keyDown(e),true);
  this.panel.addEventListener('keydown',e=>this.keyDown(e),true);
 }
 toggle(){
  if(this.isBusy()){this.announce('Finish the current handling operation before arranging the bench.');this.refresh();return false}
  this.endDrag();this.active=!this.active;this.panel.hidden=!this.active;
  this.stage?.classList.toggle('arranging-bench',this.active);
  this.canvas.style.cursor=this.active?'grab':'';
  this.button.setAttribute('aria-pressed',String(this.active));this.button.setAttribute('aria-expanded',String(this.active));
  (this.button.querySelector('.dock-label')||this.button).textContent=this.active?'Done':'Arrange';this.button.setAttribute('aria-label',this.active?'Finish arranging':'Arrange bench');this.button.classList.toggle('active',this.active);
  this.button.title=this.active?'Return to the experiment':'Move equipment to suit your workspace';
  this.onModeChange(this.active);this.refresh();
  this.announce(this.active?'Drag equipment on the bench, or select an item and use the arrows.':'Bench arranged. Continue your experiment.');
  if(this.active)this.canvas.focus({preventScroll:true});else this.button.focus({preventScroll:true});
  return true;
 }
 refresh(){
  const busy=!!this.isBusy();
  this.button.disabled=busy;this.fields.disabled=busy||!this.selected;
  this.panel.querySelector('.layout-done').disabled=busy;
  if(busy&&this.drag)this.endDrag();
  if(busy&&this.active)this.status.textContent='Finish the current handling operation to move equipment.';
  this.updateSelection();
 }
 updateSelection(){
  if(this.selected)this.select.value=this.selected;
  this.selectedLabel.textContent=this.selected?this.label():'Choose equipment';
 }
 label(){return this.items.find(item=>item.id===this.selected)?.label||'Equipment'}
 announce(message,external=true){this.status.textContent=message;if(external)this.onFeedback(message)}
 localPoint(event){const rect=this.canvas.getBoundingClientRect();return[event.clientX-rect.left,event.clientY-rect.top]}
 swallow(event){event.preventDefault();event.stopImmediatePropagation()}
 pointerDown(event){
  if(!this.active||event.button!==0||!event.isPrimary||this.drag)return;
  if(this.isBusy()){this.swallow(event);this.refresh();return}
  const [x,y]=this.localPoint(event),grip=this.scene.layoutGrip(x,y);
  if(!grip){
   if(event.pointerType!=='mouse')this.swallow(event);
   this.announce('Choose equipment on the bench, or use the list.',false);return;
  }
  this.swallow(event);
  this.selected=grip.id;this.updateSelection();
  this.drag={pointerId:event.pointerId,id:grip.id,grip,moved:false,lastMessage:''};this.scene.beginEquipmentDrag?.(grip.id);
  this.canvas.setPointerCapture(event.pointerId);this.canvas.style.cursor='grabbing';this.canvas.focus({preventScroll:true});
  this.announce(`Moving ${this.label().toLowerCase()}.`,false);
 }
 pointerMove(event){
  if(!this.active)return;
  if(!this.drag){
   if(event.buttons===0){const [x,y]=this.localPoint(event);this.canvas.style.cursor=this.scene.pickEquipment(x,y)?'grab':'default';this.swallow(event)}
   return;
  }
  if(event.pointerId!==this.drag.pointerId)return;
  this.swallow(event);
  if(this.isBusy()){this.endDrag();this.refresh();return}
  const [x,y]=this.localPoint(event);
  const result=this.scene.dragLayoutGrip(this.drag.grip,x,y);
  if(result?.ok===false){if(result.message!==this.drag.lastMessage){this.drag.lastMessage=result.message;this.announce(result.message||'Choose another position on the bench.',false)}return}
  this.drag.moved=true;this.drag.lastMessage='';this.onChange();
 }
 pointerEnd(event){
  if(!this.drag||event.pointerId!==this.drag.pointerId)return;
  this.swallow(event);this.endDrag();
 }
 endDrag(){
  const drag=this.drag;if(!drag)return;this.drag=null;this.scene.endEquipmentDrag?.(drag.id,drag.moved);this.onChange();
  if(this.canvas.hasPointerCapture(drag.pointerId))this.canvas.releasePointerCapture(drag.pointerId);
  this.canvas.style.cursor=this.active?'grab':'';
  if(drag.moved){this.save();this.announce(`${this.label()} moved.`,false)}
 }
 nudge(horizontal,vertical,large=false){
  if(!this.active||!this.selected||this.isBusy())return;
  const p=this.scene.equipmentPosition(this.selected);if(!p)return;
  const step=large ? .35 : .12,yaw=this.scene.r.cam.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw);
  this.applyResult(this.scene.moveEquipment(this.selected,p[0]+step*(horizontal*c+vertical*s),p[2]+step*(-horizontal*s+vertical*c)),`${this.label()} moved.`);
 }
 rotate(direction){
  if(!this.active||!this.selected||this.isBusy())return;
  this.applyResult(this.scene.rotateEquipment(this.selected,direction*TURN),`${this.label()} turned 15°.`);
 }
 applyResult(result,message){
  if(result?.ok===false){this.announce(result.message||'Choose another position on the bench.');return false}
  this.onChange();this.save();this.announce(message,false);return true;
 }
 keyDown(event){
  if(!this.active||event.altKey||event.ctrlKey||event.metaKey)return;
  if(event.key==='Escape'){this.swallow(event);this.toggle();return}
  if(event.target.matches('select,input,textarea'))return;
  const arrows={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(arrows[event.key]){this.swallow(event);this.nudge(...arrows[event.key],event.shiftKey)}
  else if(event.key==='['||event.key===']'){this.swallow(event);this.rotate(event.key==='['?-1:1)}
 }
 restore(){
  if(this.isBusy()){this.announce('Finish the current handling operation before restoring the layout.');return false}
  this.endDrag();const result=this.scene.restoreLayout();
  if(result?.ok===false){this.announce(result.message||'The starting layout could not be restored.');return false}
  this.onChange();this.save();this.refresh();this.announce('Starting layout restored.');return true;
 }
 load(){
  let stored;
  try{stored=localStorage.getItem(STORAGE_KEY)}
  catch{this.storageAvailable=false;this.status.textContent='Your arrangement will stay available during this visit.';return}
  if(!stored)return;
  try{
   const saved=JSON.parse(stored);if(saved?.version!==1||!saved.layout||typeof saved.layout!=='object')return;
   const result=this.scene.applyLayout(saved.layout);
   if(result?.ok!==false){this.onChange();this.status.textContent='Your saved arrangement is ready.'}
  }catch{this.status.textContent='The starting layout is ready. Arrange it to save a new preference.'}
 }
 save(){
  if(!this.storageAvailable)return;
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,layout:this.scene.layoutData()}))}
  catch{this.storageAvailable=false;this.onFeedback('Your arrangement will stay available during this visit; this browser could not save it.')}
 }
}
