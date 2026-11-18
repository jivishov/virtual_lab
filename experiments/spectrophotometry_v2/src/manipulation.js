import {PIPETTES,pipetteIds,isPipette,pipetteForSource} from './pipettes.js';
/* Shared direct manipulation. Mouse, touch, keyboard and hand input use this one state machine. */
import {getStep,beginTransfer,advanceTransfer,perform} from './model.js';
import {LABELS} from './scene.js';
import {CUVETTE} from '../assets/cuvette-dimensions.js';
import {AIM,pickScreenTarget,SettledAim,CONTROL_LABELS} from './targeting.js';
import {beginCarry,carryPosition,pointerForEnd} from './tool-carry.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const FLOW_ML_PER_SECOND=3,MIN_STROKE_SECONDS=1.25;
const GUIDED_SEAT_MS=260;
const PALM_JITTER_PX=5;
const PALM_LIFT_PX=13;
export class Manipulation {
 constructor({scene,geometry,getState,onChange=()=>{},onFeedback=()=>{},onNotebook=()=>{}}){
  Object.assign(this,{scene,geometry,getState,onChange,onFeedback,onNotebook});this.tool=null;this.owner=null;this.contact=null;this.flow=false;this.compressed=false;this.charged=false;this.frozen=false;this.history=[];this.lastNow=null;this.hoverTarget=null;this.hoverSince=null;this.lastPointer=null;this.pourSince=null;
  this.aimSettler=new SettledAim();this.hoverRegion=null;this.previewTarget=null;this.aimHit=null;
  this.pointerDose=null;
  this.getState().lidOpen=geometry.isLidOpen();
 }
 get holdsPipette(){return isPipette(this.tool)}
 get busy(){return !!this.tool||this.flow}
 get step(){return getStep(this.getState())}
 get state(){return {tool:this.tool,owner:this.owner,contact:this.contact?{target:this.contact.target,depth:this.contact.depth,kind:this.contact.kind}:null,flow:this.flow,compressed:this.compressed,charged:this.charged,frozen:this.frozen,tilt:this.tilt||0}}
 event(action,detail={}){this.history.push({number:this.history.length+1,action,step:this.getState().step,...detail})}
 say(message,error=false){this.onFeedback(message,error)}
 changed(){this.scene.r.root.update();this.scene.r.dirtyShadow=true;this.onChange()}
 usable(){return this.getState().status==='running'&&!document.querySelector('dialog[open]')}
 point(region){return this.geometry.project(region)}
 near(x,y,point,radius=36){const p=Array.isArray(point)?this.scene.r.project(point):point;return p&&p.z<1&&Math.hypot(x-p.x,y-p.y)<radius}
 pickTool(x,y){return this.geometry.pick(x,y,{only:[...pipetteIds.flatMap(id=>[id+'-grip',id+'-bulb']),'cuvette-grip'],padding:14})?.equipment||null}
 grab(id,owner,x,y){
  if(this.pointerDose||!this.usable()||!isPipette(id)&&id!=='cuvette')return false;
  if(this.tool&&this.tool!==id){this.say(`Put the ${this.holdsPipette?'pipette in its stand':'cuvette on its pad'} before picking up another tool.`,true);return false}
  if(id==='cuvette'&&this.getState().cuvette.inserted&&!this.geometry.isLidOpen()){this.say('Open the sample-chamber lid before grasping the cuvette.',true);return false}
  const resuming=this.tool===id;
  this.interruptHandStroke();
  this.tool=id;this.owner=owner;this.frozen=false;this.flow=false;this.pourSince=null;this.lastPointer={x,y};this.clearAim();
  if(id==='cuvette'&&this.getState().cuvette.inserted&&!this.contact)this.contact={target:'spec20',kind:'seat',depth:1,above:this.seatAbove(),tip:[...this.scene.chamber],handY:y,handX:x,baseDepth:1};
  if(!this.contact)this.prepareCarry(x,y);
  else{
   const c=this.contact;c.handY=y;c.handX=x;c.baseDepth=c.depth;
   c.seatedY=c.depth===1?y:null;c.retryY=null;
  }
  if(!resuming)this.event('grasp',{tool:id,input:owner});else this.event('regrasp',{tool:id,input:owner});
  this.say(this.describe().instruction);this.changed();return true;
 }
 prepareCarry(x,y){
  const n=this.scene.objects[this.tool],grip=this.geometry.grabPoint(this.tool,x,y);
  this.carry=beginCarry(this.scene.r,n.pos,grip,x,y);
  this.carry.bounds=this.scene.placementBounds(this.tool,n.rot[1]);
  this.lastPointer={x,y};this.clearAim();
 }
 aimPoint(target=this.desiredTarget()){
  if(!target)return null;let p;
  if(target.endsWith('-stand'))p=this.geometry.point?.(target)||this.scene.home[this.tool];
  else if(target==='cuvette-dock')p=this.geometry.point?.(target)||this.scene.home.cuvette;
  else p=this.geometry.opening(target)?.center;
  if(!p)return null;
  return [...p];
 }
 workingEnd(){return this.scene.r.project(this.scene.objects[this.tool].pos)}
 aimScreen(target=this.desiredTarget()){
  const world=this.aimPoint(target);if(!world)return null;
  const p=this.scene.r.project(world);
  return this.carry?pointerForEnd(this.scene.r,this.carry,p):p;
 }
 desiredTarget(){
  if(!this.tool)return null;
  if(this.holdsPipette)return this.step.pipetteId===this.tool?this.step.target:this.tool+'-stand';
  if(this.step.action==='insert')return 'spec20';if(this.step.action==='empty')return 'wasteBeaker';return 'cuvette-dock';
 }
 candidates(){return this.holdsPipette?['stockBottle','waterBottle','unknownBottle',...Object.keys(this.getState().tubes),'cuvette',this.tool+'-stand']:this.tool==='cuvette'?['spec20','wasteBeaker','cuvette-dock']:[...pipetteIds.map(id=>id+'-grip'),'cuvette-grip','lid','zero','read','clipboard']}
 targetName(id){const [tool,part]=(id||'').split('-');if(isPipette(tool))return PIPETTES[tool].name+(part==='stand'?' stand':'');return CONTROL_LABELS[id]||LABELS[id]||id}
 nextTarget(){return this.tool?(this.frozen||!this.owner?this.tool+'-grip':this.contact?.target||this.desiredTarget()):this.describe().region}
 targetScreen(id,{hand=false}={}){
  if(this.geometry.screenTarget)return this.geometry.screenTarget(id,{hand});
  const world=this.aimPoint(id);return world?{id,...this.scene.r.project(world),world,radius:hand?AIM.handRadius:AIM.mouseRadius,visible:true}:null;
 }
 targetAt(x,y,{hand=false,assist=true}={}){
  const ids=this.candidates(),points=this.geometry.screenTargets?.(ids,{hand})||ids.map(id=>this.targetScreen(id,{hand}));
  this.aimHit=pickScreenTarget(points,x,y,{hand,prefer:this.hoverTarget,expected:this.desiredTarget(),assist});return this.aimHit?.id||null;
 }
 workingTarget(hand=false,end=this.workingEnd()){
  return this.targetAt(end.x,end.y,{hand,assist:false});
 }
 clearAim(){this.hoverTarget=null;this.hoverSince=null;this.aimHit=null;this.aimSettler.reset();this.hoverRegion=null;this.previewTarget=null}
 hover(x,y,{hand=false}={}){
  if(this.tool&&this.owner)return;
  const ids=this.tool?[this.tool+'-grip']:this.candidates(),hit=pickScreenTarget(ids.map(id=>this.targetScreen(id,{hand})),x,y,{hand,assist:false});
  const id=hit?.id||null;if(id!==this.hoverRegion){this.hoverRegion=id;this.changed()}
 }
 selectTarget(target,input='keyboard'){
  if(!this.usable()||!target)return false;
  if(!this.tool||!this.owner){
   if(target.endsWith('-grip')){const p=this.point(target);return p?this.grab(target.slice(0,-5),input,p.x,p.y):false}
   return this.activate(target);
  }
  if(this.contact){this.say('Lift the tool clear of its current opening before choosing another target.',true);return false}
  if(!this.candidates().includes(target))return false;
  const p=this.targetScreen(target);if(!p||!p.visible){this.say('Use Show target to bring this opening into view.',true);return false}
  this.lastPointer={x:p.x,y:p.y};return this.align(target,this.lastPointer);
 }
 move(x,y,{hand=false,guidedBulb=false,lowering=false,now=performance.now()}={}){
  if(!this.tool||!this.owner||this.frozen||!this.usable()||!Number.isFinite(x)||!Number.isFinite(y))return false;
  const previous=this.lastPointer;this.lastPointer={x,y};
  if(this.contact){
   if(hand){const c=this.contact;if(c.kind==='pour')return true;
    // Before insertion a deliberate sideways move can select a neighboring
    // opening. It must settle afresh; a locked tip cannot slide through glass.
    if(c.depth===0&&Math.abs(x-(c.handX??x))>18){
     const mouth=this.scene.r.project(this.aimPoint(c.target));
     const neighbor=this.targetAt(mouth.x+x-c.handX,mouth.y,{hand:true,assist:false});
     if(neighbor&&neighbor!==c.target){this.contact=null;this.prepareCarry(c.handX,c.handY);this.event('leave-opening',{tool:this.tool});return this.move(x,y,{hand,guidedBulb,now})}
    }
    const before=c.depth;
    if(c.kind==='pipette'&&guidedBulb&&before===0){
     if(y<=(c.retryY??c.handY)-PALM_LIFT_PX){this.finishDepth();return true}
     if(c.retryY!=null)c.handY=Math.min(c.handY,y);
    }
    if(c.kind==='pipette')this.handPipetteDepth(c,y,now,guidedBulb);
    else this.setDepth(c.baseDepth+(y-c.handY)/68);
    if(c.depth===0&&before>0){
     if(guidedBulb&&c.kind==='pipette'&&c.mode===this.step.action&&c.target===this.step.target){
      // A short lift during an unfinished dose brings the tip back to the rim.
      // From here the same hand can re-dip immediately, or lift farther to leave.
      c.baseDepth=0;c.handX=x;c.handY=c.retryY=y;c.seatedY=null;
     }else this.finishDepth();
     return true;
    }
    if(c.depth===0&&Math.abs(x-(c.handX??x))>64){this.contact=null;this.prepareCarry(c.handX,c.handY);this.event('leave-opening',{tool:this.tool});return this.move(x,y,{hand,guidedBulb,now})}
   }return true;
  }
  const n=this.scene.objects[this.tool];
  const approach=(lowering||hand&&guidedBulb)&&this.holdsPipette&&this.step.pipetteId===this.tool;
  const from=approach?this.workingEnd():null;
  const position=carryPosition(this.scene.r,this.carry,x,y,this.carry.bounds);
  n.set(...position);
  const end=this.workingEnd();
  if(approach&&previous){
   const entry=this.pipetteEntry(from,end,previous,this.lastPointer);
   if(entry&&this.align(this.step.target,entry,entry.depth)){
    if(hand)this.handPipetteDepth(this.contact,y,now,guidedBulb);
    return true;
   }
  }
  const target=this.workingTarget(hand,end);
  if(target!==this.hoverTarget){this.hoverTarget=target;this.hoverSince=now}
  if(hand){
   // The broad aiming guide helps find a bottle. Measure the short dip from
   // its lip, so the last part of approaching from above cannot operate it.
   const guidedPipette=guidedBulb&&this.holdsPipette;
   const eligible=!guidedPipette||(target&&target===this.desiredTarget()&&end.y>=this.aimHit.y-PALM_JITTER_PX);
   const ready=this.aimSettler.update(eligible?target:null,x,y,now,this.aimHit?.radius);
   if(ready&&target&&!target.endsWith('stand')&&!target.endsWith('dock')){
    const depth=this.receiverDepth(this.workingEnd(),target);
    this.align(target,{x,y},depth??(this.holdsPipette?0:null));
   }
  }
  this.changed();return true;
 }
 receiverDepth(point,target=this.step.target){
  return this.holdsPipette&&this.step.pipetteId===this.tool&&this.step.action==='dispense'&&target===this.step.target
   ?this.geometry.tubeDepthAt?.(target,point)??null:null;
 }
 pipetteEntry(from,to,previous,pointer){
  const dy=to.y-from.y;
  if(dy<=0||dy<Math.abs(to.x-from.x)*.8||pointer.y<=previous.y)return null;
  const mouth=this.targetScreen(this.step.target);
  if(!mouth?.visible||to.y<mouth.y)return null;
  if(from.y>mouth.y){
   const depth=this.receiverDepth(from);
   return depth===null?null:{...previous,depth};
  }
  const t=(mouth.y-from.y)/dy,crossX=from.x+(to.x-from.x)*t;
  if(Math.abs(crossX-mouth.x)>mouth.radius*.8||this.targetAt(crossX,mouth.y,{assist:false})!==mouth.id)return null;
  return {x:previous.x+(pointer.x-previous.x)*t,y:previous.y+(pointer.y-previous.y)*t,depth:0};
 }
 handPipetteDepth(c,y,now,guided){
  const height=this.scene.r.canvas?.clientHeight||800;
  const step=this.step;
  const prescribed=step.pipetteId===this.tool&&step.target===c.target&&step.action===c.mode;
  if(!guided){
   if(prescribed&&c.mode==='aspirate'&&!this.charged&&c.depth===0){c.handY=y;c.baseDepth=0;return}
   let depth=clamp(c.baseDepth+(y-c.handY)/clamp(height*.075,32,60));
   if(depth<.14&&(c.depth===0||depth<c.depth))depth=0;
   if(c.depth===1&&depth>.84)depth=1;
   if(depth!==c.depth)this.setDepth(depth);
   return;
  }
  // The palm controls the bulb. A short dip seats the actual tip at the working
  // depth; holding a dose should not require pixel-perfect hand placement.
  const travel=clamp(height*.015,10,13);
  let depth;
  if(c.depth===1){
   c.seatedY=Math.max(c.seatedY??y,y);
   const lifted=c.seatedY-y>=PALM_LIFT_PX;
   const carried=c.handStroke?.finishedX!=null&&Math.abs(this.lastPointer.x-c.handStroke.finishedX)>=18;
   depth=lifted||carried?0:1;
  }else{
   const dy=y-c.handY;
   const movement=Math.sign(dy)*Math.max(0,Math.abs(dy)-PALM_JITTER_PX);
   depth=clamp(c.baseDepth+movement/(travel-PALM_JITTER_PX));
  }
  if(depth<.02)depth=0;
  if(prescribed&&c.depth===0&&depth>0){
   c.retryY=null;
   c.handStroke={seatedAt:null,started:false};
   this.squeeze(c.mode==='aspirate');
  }
  if(depth!==c.depth)this.setDepth(depth);
  const stroke=c.handStroke;
  if(!stroke)return;
  if(c.depth===0){this.interruptHandStroke();return}
  if(!prescribed||stroke.started)return;
  if(c.depth<1){stroke.seatedAt=null;return}
  c.seatedY??=y;
  stroke.seatedAt??=now;
  if(now-stroke.seatedAt>=GUIDED_SEAT_MS){
   stroke.started=this.squeeze(c.mode==='dispense')&&this.flow;
  }
 }
 interruptHandStroke(){
  if(!this.contact?.handStroke)return;
  this.contact.handStroke=null;this.flow=false;this.compressed=false;this.charged=false;this.changed();
 }
 align(target,at=this.lastPointer,entryDepth=null){
  if(this.pointerDose||!this.tool||!this.owner||!this.usable())return false;
  if(target.endsWith('-stand')||target==='cuvette-dock')return this.park(target);
  const state=this.getState();
  if(this.holdsPipette){
   if(this.tool!==this.step.pipetteId){
    const needed=this.step.pipetteId;
    this.say(needed?'Return this pipette and pick up the '+this.targetName(needed).toLowerCase()+'.':'Put the pipette in its stand.',true);return false;
   }
   if(this.step.action==='aspirate'&&pipetteForSource(target)!==this.tool){
    this.say('Use the '+this.targetName(this.tool).toLowerCase()+' at '+this.targetName(this.step.target)+'.',true);return false;
   }
   if(target==='cuvette'&&state.cuvette.inserted){this.say('Withdraw the cuvette before filling it.',true);return false}
   const mode=this.step.action==='dispense'?'dispense':'aspirate';
   const source=state.bottles[target]||state.tubes[target];
   const remaining=this.step.volume-(state.transfer?.delivered||0);
   const p=this.geometry.pipetteContact(target,{mode,tool:this.tool,entryDepth,drawFraction:source?.volume?remaining/source.volume:1});
   if(!p?.ok){this.say(p?.reason||'This opening cannot receive the pipette.',true);return false}
   this.contact={target,kind:'pipette',mode,depth:0,above:[...p.above],tip:[...p.tip],clear:p.clear,handY:at?.y||0,handX:at?.x||0,baseDepth:0};
   this.scene.objects[this.tool].set(...p.above);this.scene.objects[this.tool].rot=[0,0,0];
  }else if(target==='spec20'){
   if(this.step.action!=='insert'){this.say('Prepare the cuvette before seating it.',true);return false}
   if(!this.geometry.isLidOpen()){this.say('Open the sample-chamber lid first.',true);return false}
   this.contact={target,kind:'seat',depth:0,above:this.seatAbove(),tip:[...this.scene.chamber],handY:at?.y||0,handX:at?.x||0,baseDepth:0};
   this.scene.objects.cuvette.set(...this.contact.above);this.scene.objects.cuvette.rot=[0,this.scene.homeYaw.instrument||0,0];
  }else if(target==='wasteBeaker'){
   if(state.cuvette.inserted){this.say('Lift the cuvette out of the chamber first.',true);return false}
   this.contact={target,kind:'pour',depth:0,handY:at?.y||0,handX:at?.x||0};this.tilt=0;this.applyPourPose();
  }else return false;
  this.carry=null;this.clearAim();this.event('align',{tool:this.tool,target});this.say(this.describe().instruction);this.changed();return true;
 }
 seatAbove(){const p=this.scene.chamber;return [p[0],this.scene.home.instrument[1]+1.45,p[2]]}
 setDepth(value){
  const c=this.contact;if(this.pointerDose||!c||c.kind==='pour'||!this.tool||!this.owner||this.frozen||!this.usable())return false;
  let next=clamp(value);if(next>.98)next=1;if(next<.02)next=0;
  if(c.kind==='seat'&&!this.geometry.isLidOpen()){this.say('Open the lid before moving the cuvette.',true);return false}
  if(c.kind==='seat'&&this.getState().cuvette.inserted&&next<c.depth&&this.step.action!=='remove'){this.say('Complete the current reading before withdrawing the cuvette.',true);return false}
  const before=c.depth;c.depth=next;if(c.depth<.96)this.flow=false;
  const p=lerp(c.above,c.tip,c.depth);this.scene.objects[this.tool].set(...p);
  if(c.depth>=.99&&before<.99){
   this.event('lower',{tool:this.tool,target:c.target});
   if(c.kind==='seat'&&!this.getState().cuvette.inserted){const r=perform(this.getState(),'insert','spec20');if(!r.ok){c.depth=0;this.scene.objects.cuvette.set(...c.above);this.say(r.message,true)}else{this.scene.sync(this.getState(),false);this.say('Cuvette seated. Release it, then close the lid.')}}
  }
  if(c.depth===0&&before>0){
   this.event('withdraw',{tool:this.tool,target:c.target});
   if(c.kind==='seat'&&this.getState().cuvette.inserted){const r=perform(this.getState(),'remove','cuvette');if(r.ok)this.scene.sync(this.getState(),false);else this.say(r.message,true)}
  }
  this.changed();return true;
 }
 finishDepth(){
  if(!this.owner||this.frozen||!this.usable()||this.contact?.depth!==0)return false;
  if(this.contact.clear)this.scene.objects[this.tool].set(...this.contact.clear);
  this.interruptHandStroke();this.contact=null;this.prepareCarry(this.lastPointer.x,this.lastPointer.y);
  this.event('leave-opening',{tool:this.tool});this.say(this.describe().instruction);this.changed();return true;
 }
 park(target){
  const id=this.tool;if(!id||!this.owner||this.frozen||!this.usable())return false;
  if(this.contact?.depth>0){this.say('Lift the tool clear of the opening first.',true);return false}
  if(id==='cuvette'&&(this.tilt||0)>.08){this.say('Turn the cuvette upright first.',true);return false}
  if(target!==(isPipette(id)?id+'-stand':'cuvette-dock'))return false;
  const node=this.scene.objects[id];node.set(...this.scene.home[id]);node.rot=[0,this.scene.homeYaw[id]||0,0];
  this.event('park',{tool:id});this.tool=this.owner=this.contact=this.carry=null;this.flow=false;this.frozen=false;this.charged=false;this.compressed=false;this.clearAim();this.say('Tool placed. '+this.describe().instruction);this.changed();return true;
 }
 release(){
  if(this.pointerDose||!this.tool||!this.owner||this.frozen||!this.usable())return false;this.flow=false;this.pourSince=null;
  this.interruptHandStroke();
  // A missing camera frame clears the hover hint. An open palm can still
  // place the held tool when its tip is physically over its own stand.
  const rest=this.hoverTarget??(this.owner==='hand'&&this.carry?this.workingTarget(true):null);
  if(rest?.endsWith('stand')||rest?.endsWith('dock'))return this.park(rest);
  if(this.tool==='cuvette'&&this.contact?.kind==='seat'&&this.contact.depth===1&&this.getState().cuvette.inserted){this.event('release',{tool:this.tool,target:'spec20'});this.tool=this.owner=this.contact=null;this.say('Close the sample-chamber lid.');this.changed();return true}
  this.owner=this.carry=null;this.clearAim();this.event('release',{tool:this.tool});this.say('Tool placed. Grasp it again to continue.');this.changed();return true;
 }
 squeeze(down){
  if(this.pointerDose||!this.holdsPipette||!this.owner||this.frozen||!this.usable())return false;
  const changed=down!==this.compressed;this.compressed=!!down;if(changed)this.event(down?'squeeze-bulb':'relax-bulb',{tool:this.tool});
  const step=this.step,c=this.contact;
  if(down){this.flow=false;if(!c||c.depth<.05)this.charged=true;if(step.action==='dispense'&&c?.depth>=.99)return this.startFlow();}
  else if(step.action==='aspirate'&&c?.depth>=.99&&this.charged)return this.startFlow();
  if(!down&&step.action==='dispense')this.flow=false;
  this.say(this.describe().instruction);this.changed();return true;
 }
 startFlow(){
  if(!this.owner||this.frozen||!this.usable())return false;
  const step=this.step,c=this.contact;if(!this.holdsPipette||!c||c.depth<.99||c.target!==step.target||!['aspirate','dispense'].includes(step.action)){this.say('Position and lower the tip into the required vessel before transferring liquid.',true);return false}
  if(step.action==='aspirate'&&!this.charged){this.say('Lift the tip, squeeze the bulb, then lower it before relaxing.',true);return false}
  const contact=this.geometry.containsTip?.(c.target,{mode:step.action,tool:this.tool});if(contact&&!contact.ok){this.say(contact.reason||'The tip must be inside the vessel.',true);return false}
  const result=beginTransfer(this.getState(),step.action,step.target,this.tool);if(!result.ok){this.say(result.message,true);return false}
  this.flowRate=Math.min(FLOW_ML_PER_SECOND,step.volume/MIN_STROKE_SECONDS);
  this.flow=true;this.flowAction=step.action;this.flowTarget=step.target;this.event('start-flow',{operation:step.action,target:step.target});this.say(`${step.action==='aspirate'?'Drawing':'Delivering'} ${step.volume} mL · watch the graduation.`);this.changed();return true;
 }
 toggleBulb(){if(this.step.action==='dispense'&&this.contact?.depth>=.99)return this.squeeze(true);return this.squeeze(!this.compressed)}
 // A mouse or touch stroke meters the prescribed dose while the tip stays seated.
 // Releasing the pointer requests withdrawal after the last increment.
 measuredStroke(action){
  const c=this.contact;
  if(this.pointerDose||this.flow||!['mouse','touch'].includes(this.owner)||!this.compressed||
     c?.kind!=='pipette'||c.mode!==action||this.step.action!==action||!this.startFlow())return false;
  this.pointerDose={released:false};
  if(action==='aspirate'){this.compressed=false;this.event('relax-bulb',{tool:this.tool})}
  this.event('measured-stroke',{operation:action,target:c.target,input:this.owner});
  this.changed();return true;
 }
 releaseMeteredStroke(){
  if(!this.pointerDose)return;
  this.pointerDose.released=true;
  if(!this.flow){this.endMousePress();this.setDepth(0);this.finishDepth()}
 }
 endMousePress(){
  if(this.compressed)this.event('relax-bulb',{tool:this.tool});
  this.pointerDose=null;this.compressed=false;this.charged=false;this.flow=false;
 }
 setTilt(angle){
  if(this.tool!=='cuvette'||!this.owner||this.contact?.kind!=='pour'||this.frozen||!this.usable())return false;
  this.tilt=clamp(angle,0,2.1);this.applyPourPose();
  if(this.tilt<1.7)this.pourSince=null;
  this.changed();return true;
 }
 applyPourPose(){const pose=this.geometry.cuvettePourPose(-(this.tilt||0),0);if(pose){this.scene.objects.cuvette.set(...pose.position);this.scene.objects.cuvette.rot=[...pose.rotation]}}
 leavePour(){if(!this.owner||this.frozen||!this.usable())return false;if(this.contact?.kind==='pour'&&(this.tilt||0)<.08){this.contact=null;this.pourSince=null;this.say('Carry the upright cuvette to its pad.');this.changed();return true}return false}
 lid(){
  if(!this.usable()||this.flow)return false;
  if(this.tool==='cuvette'&&this.owner&&this.geometry.isLidOpen()){this.say('Release the cuvette before closing the lid.',true);return false}
  const open=!this.geometry.isLidOpen();if(!open&&this.contact?.kind==='seat'&&(this.contact.depth<1||!this.getState().cuvette.inserted)){this.say('The cuvette is obstructing the lid. Seat it fully or lift it clear.',true);return false}this.geometry.setLid(open);this.getState().lidOpen=open;this.event(open?'open-lid':'close-lid');this.say(open?'Lid open. Grasp the cuvette.':'Lid closed. Use the marked instrument key.');this.changed();return true;
 }
 activate(region){
  if(!this.usable())return false;
  if(region==='lid')return this.lid();
  if(region===this.tool+'-bulb'&&this.holdsPipette)return this.toggleBulb();
  if(region==='clipboard'){this.onNotebook();this.changed();return true}
  if(region==='zero'||region==='read'){
   if(this.tool){this.say('Release or park the tool before using the instrument.',true);return false}
   if(this.geometry.isLidOpen()){this.say('Close the sample-chamber lid before reading.',true);return false}
   const r=perform(this.getState(),region==='zero'?'zero':'measure','spec20');this.say(r.message,!r.ok);if(r.ok){this.event('press-key',{key:region});this.scene.sync(this.getState(),false)}this.changed();return r.ok;
  }return false;
 }
 suspend(reason='Input paused. Regrasp the marked tool to continue.'){
  if(this.pointerDose)this.endMousePress();
  this.interruptHandStroke();
  this.flow=false;this.pourSince=null;this.carry=null;this.clearAim();if(this.tool){this.owner=null;this.frozen=true;this.event('freeze',{tool:this.tool})}this.say(reason);this.changed();
 }
 reset(){this.pointerDose=null;this.tool=this.owner=this.contact=this.carry=null;this.flow=false;this.compressed=false;this.charged=false;this.frozen=false;this.tilt=0;this.history=[];this.pourSince=null;this.clearAim();this.lastNow=null;this.geometry.setLid(true);this.getState().lidOpen=true;this.changed()}
 tick(now){
  const dt=this.lastNow==null?0:Math.min(100,Math.max(0,now-this.lastNow));this.lastNow=now;
  if(!this.usable()||this.frozen)return;
  if(this.flow){
   const c=this.contact;
   const seated=this.owner&&c?.depth>=.99&&c.target===this.flowTarget;
   const contact=seated?this.geometry.containsTip(c.target,{mode:this.flowAction,tool:this.tool}):{ok:false};
   const r=contact.ok?advanceTransfer(this.getState(),this.flowRate*dt/1000,this.tool):{ok:false,message:contact.reason||'Reposition the tip inside the vessel.'};
   if(!r.ok){this.flow=false;if(this.pointerDose)this.suspend();this.say(r.message,true)}
   else{
    this.scene.syncLiquids(this.getState());
    if(r.complete){
     this.flow=false;this.charged=false;this.event('finish-flow',{operation:this.flowAction,target:this.flowTarget});
     if(c.handStroke)c.handStroke.finishedX=this.lastPointer.x;
     this.say('Dose complete. Lift the tip clear before moving to the next vessel.');
    }
   }
   if(!this.flow&&this.pointerDose?.released)this.releaseMeteredStroke();
   // Liquid levels do not cast shadows. Withdrawal and bulb changes update them independently.
   this.onChange();
  }
  if(this.tool==='cuvette'&&this.owner&&this.contact?.kind==='pour'&&(this.tilt||0)>=1.7&&this.step.action==='empty'){
   this.pourSince??=now;if(now-this.pourSince>=450){const r=perform(this.getState(),'empty','wasteBeaker');if(r.ok){this.scene.sync(this.getState(),false);this.event('pour',{target:'wasteBeaker'});this.say('Cuvette emptied. Turn it upright, then return it to the pad.')}else this.say(r.message,true);this.pourSince=null;this.changed()}
  }else this.pourSince=null;
 }
 describe(){
  const s=this.step,p=this.getState()[this.holdsPipette?this.tool:'pipette'],c=this.contact;
  if(this.getState().status!=='running')return {instruction:'Choose Run to continue from this position.',kind:'paused'};
  if(this.tool&&(this.frozen||!this.owner))return {instruction:`Regrasp the ${this.holdsPipette?'striped pipette grip':'cuvette rim'} to continue.`,kind:'grasp',region:this.tool+'-grip'};
  if(this.flow)return {instruction:`${this.flowAction==='aspirate'?'Drawing':'Delivering'} · ${p.volume.toFixed(1)} mL in the pipette`,kind:'flow',region:this.tool+'-bulb'};
  if(this.holdsPipette){
   if(c){if(c.target!==s.target||c.mode!==s.action||!['aspirate','dispense'].includes(s.action))return {instruction:'Lift straight up to withdraw the tip.',kind:'withdraw',region:this.tool+'-grip'};
    if(c.depth===0&&s.action==='aspirate'&&!this.charged)return {instruction:'Squeeze the bulb before lowering the empty pipette.',kind:'bulb',region:this.tool+'-bulb'};
    if(c.depth<.99)return {instruction:c.depth===0?'Lower the tip into the opening.':'Keep lowering until the tip is seated.',kind:'depth',region:this.tool+'-grip'};
    if(s.action==='aspirate')return {instruction:this.charged?(this.compressed?'Relax the bulb to draw liquid.':'Squeeze then relax the bulb to resume drawing.'):'Withdraw the tip and squeeze the bulb before immersion.',kind:'bulb',region:this.tool+'-bulb'};
    return {instruction:'Hold the bulb squeezed to deliver liquid.',kind:'bulb',region:this.tool+'-bulb'};
   }
   if(this.tool!==s.pipetteId)return {instruction:'Return the '+this.targetName(this.tool).toLowerCase()+' to its stand.',kind:'carry',target:this.tool+'-stand',region:this.tool+'-grip'};
   if(s.action==='aspirate'&&!this.charged)return {instruction:'Squeeze the bulb before lowering the empty pipette.',kind:'bulb',region:this.tool+'-bulb'};
   return {instruction:`Carry the tip to ${LABELS[this.desiredTarget()]||'the pipette stand'}.`,kind:'carry',target:this.desiredTarget(),region:this.tool+'-grip'};
  }
  if(this.tool==='cuvette'){
   if(c?.kind==='seat')return {instruction:this.getState().cuvette.inserted?(c.depth===1?(s.action==='remove'?'Lift the cuvette straight out of the chamber.':'Release the seated cuvette, then close the lid.'):'Keep lifting until the cuvette clears the chamber.'):'Lower the cuvette straight into the chamber.',kind:'depth',region:'cuvette-grip'};
   if(c?.kind==='pour')return {instruction:s.action==='empty'?'Turn the cuvette over the waste opening to pour.':'Turn the cuvette upright and carry it to its pad.',kind:'tilt',region:'cuvette-grip'};
   return {instruction:`Carry the cuvette to ${this.desiredTarget()==='spec20'?'the open chamber':this.desiredTarget()==='wasteBeaker'?'the waste opening':'its pad'}.`,kind:'carry',target:this.desiredTarget(),region:'cuvette-grip'};
  }
  if(['aspirate','dispense'].includes(s.action))return {instruction:'Pick up the '+PIPETTES[s.pipetteId].name.toLowerCase()+'.',kind:'grasp',region:s.pipetteId+'-grip'};
  if(['insert','remove','empty'].includes(s.action)){if(['insert','remove'].includes(s.action)&&!this.geometry.isLidOpen())return {instruction:'Open the sample-chamber lid.',kind:'lid',region:'lid'};return {instruction:'Grasp the cuvette by its upper rim.',kind:'grasp',region:'cuvette-grip'}}
  if(['zero','measure'].includes(s.action)){if(this.geometry.isLidOpen())return {instruction:'Close the sample-chamber lid.',kind:'lid',region:'lid'};return {instruction:`Press ${s.action==='zero'?'ZERO':'READ'} on the instrument.`,kind:'key',region:s.action==='zero'?'zero':'read'}}
  return {instruction:s.target==='notebook'?'Open the notebook to complete this step.':'Experiment complete. Open your notebook.',kind:'review',region:'clipboard'};
 }
}
