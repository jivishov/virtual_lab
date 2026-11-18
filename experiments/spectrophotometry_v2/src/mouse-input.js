// A captured drag can carry and lower the pipette in one stroke.
// The locked contact owns the whole stroke, even if the pointer crosses another vessel.
const INSERT_PIXELS = 28;
const WITHDRAW_PIXELS = 32;
const pointerOwner = owner => owner === 'mouse' || owner === 'touch';
const isHome = id => id?.endsWith('-stand') || id === 'cuvette-dock';

export class MouseInput {
 constructor({canvas, geometry, interaction, layout, usePointer, handActive}){
  Object.assign(this, {canvas, geometry, interaction, layout, usePointer, handActive});
  this.stroke = null;
  this.keyDispensing = null;
  canvas.addEventListener('pointerdown', e => this.down(e));
  canvas.addEventListener('pointermove', e => this.move(e));
  canvas.addEventListener('pointerup', e => this.up(e));
  canvas.addEventListener('pointercancel', e => this.cancel(e));
  canvas.addEventListener('lostpointercapture', e => this.cancel(e));
  canvas.addEventListener('pointerleave', e => {
   if(this.stroke || this.layout.active || this.handActive()) return;
   const c = this.interaction;
   if(c.owner==='mouse'&&!c.contact&&this.outside(this.xy(e))){this.interrupt();return}
   if(c.hoverTarget || c.hoverRegion){ c.clearAim(); c.changed(); }
  });
  canvas.addEventListener('keydown', e => this.key(e));
  canvas.addEventListener('keyup', e => {
   if(this.keyDispensing === e.key){ this.consume(e); this.stopKey(); }
  });
  canvas.addEventListener('blur', () => this.stopKey());
  window.addEventListener('blur', () => this.interrupt());
  document.addEventListener('visibilitychange', () => { if(document.hidden) this.interrupt(); });
 }
 xy(e){
  const r = this.canvas.getBoundingClientRect();
  return {x:e.clientX-r.left, y:e.clientY-r.top};
 }
 outside(p){return p.x<0||p.y<0||p.x>=this.canvas.clientWidth||p.y>=this.canvas.clientHeight}
 consume(e){ e.preventDefault(); e.stopImmediatePropagation(); }
 stopKey(){
  if(this.keyDispensing){ this.keyDispensing=null; this.interaction.squeeze(false); }
 }
 capture(e, kind, p){
  const c=this.interaction;
  this.stroke={pointer:e.pointerId, owner:c.owner, contact:c.contact, kind, x:p.x, y:p.y,
   depth:c.contact?.depth||0, committed:false, dragged:false};
  this.canvas.setPointerCapture(e.pointerId);
  this.canvas.style.cursor='grabbing';
  c.changed();
 }
 forget(){
  const s=this.stroke;
  this.stroke=null;
  if(s && this.canvas.hasPointerCapture(s.pointer)) this.canvas.releasePointerCapture(s.pointer);
 }
 interrupt(message='Input interrupted. Click the tool to pick it up again.'){
  const c=this.interaction;
  this.stopKey(); this.forget();
  if(pointerOwner(c.owner)){
   c.endMousePress(); c.suspend(message);
   this.canvas.style.cursor='default';
  }
 }
 cancel(e){ if(this.stroke?.pointer===e.pointerId) this.interrupt(); }
 down(e){
  if(e.button!==0 || !e.isPrimary || this.layout.active || !this.interaction.usable() || this.stroke) return;
  this.consume(e);
  if(this.interaction.pointerDose) return;
  this.canvas.focus({preventScroll:true});
  this.usePointer();
  const c=this.interaction, p=this.xy(e);
  const owner=e.pointerType==='touch'?'touch':'mouse';
  if(!pointerOwner(c.owner)){
   const contact=c.contact,poised=contact&&!c.frozen&&contact.target===c.desiredTarget()&&
    (contact.depth===0||contact.mode==='dispense'&&contact.depth<1);
   if(poised&&(c.targetAt(p.x,p.y)===contact.target||c.receiverDepth(p)!==null)){
    c.grab(c.tool,owner,p.x,p.y);
    if(c.contact.kind==='pour'){this.turnCuvette(p);return}
    if(c.holdsPipette)c.squeeze(true);
    this.capture(e,c.holdsPipette?c.step.action:'seat',p);return;
   }
   const region=this.geometry.pointerControl(p.x,p.y);
   if(!region) return;
   if(!region.endsWith('-grip')){ c.activate(region); return; }
   const tool=region.slice(0,-5);
   if(!c.grab(tool,owner,p.x,p.y)) return;
   // A fresh press after interruption cannot finish the interrupted stroke.
   if(c.contact?.kind==='pipette'&&!poised){ c.endMousePress(); c.setDepth(0); c.finishDepth(); }
   if(c.contact?.kind==='pour'){ c.setTilt(0); c.leavePour();c.prepareCarry(p.x,p.y); }
   if(c.contact?.kind==='seat'){
    if(c.getState().cuvette.inserted && c.step.action!=='remove'){ c.release(); return; }
    this.capture(e,c.getState().cuvette.inserted?'remove':'seat',p);
   }else this.capture(e,'carry',p);
   this.canvas.style.cursor='grabbing';
   return;
  }
  const tipDepth=c.receiverDepth(c.workingEnd());
  const target=this.operationTarget(p)??(tipDepth!==null||c.receiverDepth(p)!==null?c.desiredTarget():null);
  if(c.contact?.kind==='pour'){
   if(target==='wasteBeaker') this.turnCuvette(p);
   else c.say('Click the waste opening again to turn the cuvette upright.',true);
   return;
  }
  if(c.tool==='cuvette' && !this.geometry.isLidOpen() &&
     this.geometry.pick(p.x,p.y,{only:['lid'],padding:6})){
   c.lid(); return;
  }
  if(!target){
   if(!c.contact){c.prepareCarry(p.x,p.y);this.capture(e,'carry',p);this.stroke.alreadyHeld=true}
   return;
  }
  if(isHome(target)){ c.park(target); this.canvas.style.cursor='grab'; return; }
  if(target!==c.desiredTarget()){
   const message=c.holdsPipette&&c.step.pipetteId&&c.step.pipetteId!==c.tool
    ?'Return this pipette and pick up the '+c.targetName(c.step.pipetteId).toLowerCase()+'.'
    :'Use '+c.targetName(c.desiredTarget())+' for this step.';
   c.say(message,true);return;
  }
  if(c.tool==='cuvette' && target==='wasteBeaker'){ this.turnCuvette(p); return; }
  if(c.contact?.target!==target&&!c.align(target,p,tipDepth)) return;
  if(c.holdsPipette){
   c.squeeze(true); // Squeeze at the mouth, before descending into the liquid.
   this.capture(e,c.step.action,p);
  }else this.capture(e,'seat',p);
 }
 operationTarget(p){
  const c=this.interaction,pointed=c.targetAt(p.x,p.y),tip=c.workingTarget();
  if(pointed===c.desiredTarget()||isHome(pointed))return pointed;
  return tip===c.desiredTarget()?tip:pointed||tip;
 }
 move(e){
  const c=this.interaction;
  if(!e.isPrimary || this.layout.active || !c.usable() || this.handActive()&&!pointerOwner(c.owner)) return;
  const p=this.xy(e);
  if(this.stroke){
   if(this.stroke.pointer!==e.pointerId) return;
   if(e.buttons!==1){ this.interrupt(); return; }
   this.consume(e);
   if(this.stroke.kind==='carry'){
    if(!this.outside(p))this.carry(p);
   }else{c.lastPointer=p;this.updateDepth(p.y)}
  }else if(!(e.buttons & 6)){
   if(pointerOwner(c.owner)){
    if(!c.contact)c.move(p.x,p.y);else c.lastPointer=p;
    this.canvas.style.cursor=c.hoverTarget||c.contact?'crosshair':'grabbing';
   }else if(!c.owner){
    const id=this.geometry.pointerControl(p.x,p.y);
    if(id!==c.hoverRegion){ c.hoverRegion=id; c.changed(); }
    this.canvas.style.cursor=id?.endsWith('-grip')?'grab':id?'pointer':'default';
   }
  }
 }
 carry(p){
  const c=this.interaction,s=this.stroke,dx=p.x-s.x,dy=p.y-s.y;
  s.dragged ||= Math.hypot(dx,dy)>=5;
  // A tool placed at the rim can be lowered by its handle on the next drag.
  // Moving sideways or away first carries it off the mouth.
  if(c.contact?.kind==='pipette'){
   if(!s.dragged)return;
   if(c.contact.depth===0&&(dy<=0||dy<Math.abs(dx)*.8))c.finishDepth();
  }
  if(!c.contact&&(p.x!==c.lastPointer.x||p.y!==c.lastPointer.y)){
   c.move(p.x,p.y,{lowering:s.dragged});
  }
  if(c.contact?.kind!=='pipette')return;
  s.kind=c.contact.mode;s.contact=c.contact;s.fromCarry=true;
  s.x=c.contact.handX;s.y=c.contact.handY;s.depth=c.contact.depth;
  c.lastPointer=p;c.squeeze(true);this.updateDepth(p.y);
 }
 updateDepth(y){
  const s=this.stroke, c=this.interaction;
  if(!s || !c.usable() || c.frozen || c.owner!==s.owner || c.contact!==s.contact){
   this.forget(); return;
  }
  if(s.committed) return;
  const dy=y-s.y;
  if(s.kind!=='remove' && dy < -WITHDRAW_PIXELS){
   this.finish(false); return;
  }
  c.setDepth(s.depth+dy/INSERT_PIXELS);
  if(s.kind==='dispense' && c.contact.depth===1 && !s.committed){
   s.committed=c.measuredStroke('dispense');
  }else if(s.kind==='remove' && c.contact.depth===0 && !c.getState().cuvette.inserted){
   s.committed=true;
  }else if(s.kind==='seat' && c.contact.depth===1 && c.getState().cuvette.inserted){
   s.committed=true;
  }
 }
 up(e){
  if(!this.stroke || this.stroke.pointer!==e.pointerId) return;
  this.consume(e);
  if(e.button!==0 || e.buttons){ this.interrupt(); return; }
  const p=this.xy(e);
  if(this.outside(p)){ this.interrupt(); return; }
  if(this.stroke.kind==='carry')this.carry(p);
  if(!this.stroke)return;
  if(this.stroke.kind==='carry'){
   const s=this.stroke,c=this.interaction;this.forget();
   if(s.dragged||s.alreadyHeld||Math.hypot(p.x-s.x,p.y-s.y)>=5){
    const target=c.workingTarget()||c.targetAt(p.x,p.y);
    if(isHome(target))c.park(target);
    else{if(target&&target===c.desiredTarget())c.align(target,p);c.release()}
   }
   this.canvas.style.cursor=c.owner?'grabbing':'grab';c.changed();return;
  }
  this.interaction.lastPointer=p;
  this.updateDepth(p.y);
  if(this.stroke) this.finish(true);
 }
 finish(released){
  const c=this.interaction, s=this.stroke;
  this.forget();
  if(!s || !c.usable() || c.frozen || c.owner!==s.owner || c.contact!==s.contact) return;
  if(s.kind==='aspirate' || s.kind==='dispense'){
   if(s.kind==='aspirate' && released && c.contact.depth===1) s.committed=c.measuredStroke('aspirate');
   if(s.committed) c.releaseMeteredStroke();
   else if(released&&s.fromCarry&&(s.kind==='dispense'||c.contact.depth===0)){
    c.endMousePress();c.release();
   }
   else{
    c.endMousePress(); c.setDepth(0); c.finishDepth();
    c.say('Stroke cancelled. Hold over the opening and move down about 28 pixels.',true);
   }
  }else if(c.getState().cuvette.inserted){
   // An incomplete withdrawal returns the cell to its seat.
   if(c.contact.depth<1) c.setDepth(1);
   c.release();
   if(!s.committed) c.say('Keep holding the cuvette and move up to lift it clear.',true);
  }else{
   c.setDepth(0); c.finishDepth();
   if(!s.committed) c.say('Move down a little farther to seat the cuvette.',true);
  }
  this.canvas.style.cursor=c.owner?'grabbing':'default';
  c.changed();
 }
 turnCuvette(p){
  const c=this.interaction;
  if(c.contact?.kind==='pour'){
   if(!c.tilt&&c.step.action==='empty')return c.setTilt(2.1);
   c.setTilt(0); c.leavePour(); c.prepareCarry(p.x,p.y); c.changed(); return true;
  }
  if(c.step.action!=='empty'||!c.align('wasteBeaker',p)) return false;
  return c.setTilt(2.1);
 }
 secondary(p){
  const c=this.interaction;
  if(this.layout.active || !c.usable() || !pointerOwner(c.owner) || c.tool!=='cuvette' ||
     this.stroke || c.targetAt(p.x,p.y)!=='wasteBeaker') return false;
  return this.turnCuvette(p);
 }
 instruction(){
  const c=this.interaction, s=c.step, op=this.stroke, tap=c.owner==='touch'?'Tap':'Click';
  if(this.layout.active) return 'Drag equipment to a comfortable position.';
  if(!c.usable() || this.handActive()&&!pointerOwner(c.owner) || c.owner && !pointerOwner(c.owner)) return c.describe().instruction;
  if(c.flow) return c.flowAction==='aspirate'?'Drawing · watch the meniscus rise.':'Dispensing · watch the meniscus fall.';
  if(!c.owner){
   if(c.contact?.kind==='pipette'&&!c.frozen)return 'Hold the bulb and lower it to continue, or press the opening and drag down.';
   if(c.tool&&!c.frozen&&c.contact?.depth===0)return 'Press the opening to use the tool, or drag the tool to move it again.';
   if(c.tool) return 'Click the '+(c.holdsPipette?c.targetName(c.tool).toLowerCase():c.tool)+' to take hold again.';
   if(s.action==='remove' && this.geometry.isLidOpen()) return 'Hold the cuvette and drag up to lift it out.';
   const cue=c.describe();
   if(cue.kind==='grasp') return 'Drag the '+(cue.region==='cuvette-grip'?'cuvette':c.targetName(cue.region).toLowerCase())+' by its handle, or click to carry it.';
   return cue.instruction;
  }
  if(op){
   if(op.kind==='carry')return c.holdsPipette?'Guide the tip over the opening and keep dragging down.':'Drag to move. Release over an opening to position the tool.';
   if(op.kind==='aspirate') return op.contact.depth===1?'Tip immersed. Release to draw.':'Keep holding and move down into the liquid.';
   if(op.kind==='dispense') return op.committed?'Dose delivered. Release to lift the tip.':'Keep holding and move down to deliver.';
   if(op.kind==='seat') return op.committed?'Cuvette seated. Release to leave it in the chamber.':'Keep holding and move down to seat the cuvette.';
   return op.committed?'Cuvette clear. Release to carry it.':'Keep holding and move up to lift the cuvette out.';
  }
  if(c.contact?.kind==='pour') return s.action==='empty'?'Pouring into waste.':tap+' the waste opening again to turn the cuvette upright.';
  if(isHome(c.desiredTarget())) return tap+' the '+(c.holdsPipette?c.targetName(c.tool+'-stand').toLowerCase():'cuvette pad')+' to put it down.';
  if(c.tool==='cuvette') return s.action==='empty'?tap+' the waste opening to tip the cuvette.':this.geometry.isLidOpen()?'Hold over the open chamber and drag down to seat the cuvette.':tap+' the chamber lid to open it.';
  if(c.hoverTarget){
   if(isHome(c.hoverTarget))return tap+' to put the pipette in its stand.';
   const name=c.targetName(c.hoverTarget);
   if(c.hoverTarget!==c.desiredTarget())return name+' · Aim at '+c.targetName(c.desiredTarget())+'.';
   return name+(s.action==='aspirate'?' · Hold, drag down, then release to draw.':' · Hold and drag down to deliver.');
  }
  return s.action==='aspirate'?'Hold over the source, drag down, then release to draw.':'Hold over the receiving opening and drag down to deliver.';
 }
 key(e){
  if(this.layout.active || e.altKey || e.ctrlKey || e.metaKey) return;
  const c=this.interaction, keys=['Enter',' ','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
  if(!keys.includes(e.key) || !c.usable() || this.stroke) return;
  if(!c.tool && e.key!=='Enter') return;
  if(c.owner==='hand') return;
  this.consume(e);
  if(c.pointerDose) return;
  if(c.owner && pointerOwner(c.owner)) c.owner='keyboard';
  if((e.key==='Enter'||e.key===' ') && e.repeat) return;
  if(e.key==='Escape'){ c.release(); return; }
  if(e.key===' ' && c.holdsPipette){
   if(c.step.action==='dispense' && c.contact?.depth>=.99){ this.keyDispensing=e.key; c.squeeze(true); }
   else c.toggleBulb();
   return;
  }
  if(e.key==='Enter'){
   const cue=c.describe();
   if(cue.kind==='grasp'){ c.selectTarget(cue.region,'keyboard'); return; }
   if(c.contact?.kind==='pour' && c.tilt<.08 && c.step.action!=='empty'){
    c.leavePour(); const p=this.geometry.project('cuvette-grip'); c.prepareCarry(p.x,p.y); return;
   }
   if(c.tool && !c.contact){ c.selectTarget(c.hoverTarget||c.desiredTarget(),'keyboard'); return; }
   if(cue.region) c.activate(cue.region);
   return;
  }
  if(!c.owner) return;
  const dx=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0, dy=e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0;
  if(c.contact?.kind==='pour'){ if(dx) c.setTilt((c.tilt||0)+dx*.15); return; }
  if(c.contact){ if(dy){ c.setDepth(c.contact.depth+dy*.15); if(c.contact?.depth===0 && dy<0) c.finishDepth(); } return; }
  const p=c.lastPointer||this.geometry.project(c.tool+'-grip'); c.move(p.x+dx*12,p.y+dy*12);
 }
}
