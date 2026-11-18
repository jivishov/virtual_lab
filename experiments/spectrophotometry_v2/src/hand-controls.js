import {pipetteIds} from './pipettes.js';
/* B06 camera events adapted to the shared laboratory manipulation controller. */
import {bulbPressure,GraspGate} from './grasp-core.js';
import {HandGestures} from './view-gestures.js';
import {HandCamera} from './hand-camera.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));

// During a fast carry MediaPipe can report a second, flattened set of
// knuckles on the same fist. B06 should see the full palm once. Leave
// separately tracked hands and genuinely ambiguous overlaps to B06.
function resolveDuplicatePalm(packet,owner,aspect){
 const {landmarks,handedness}=packet;
 if(!owner?.grip||!owner.label||landmarks.length!==2||
    !landmarks.every((points,i)=>points?.length===21&&handedness?.[i]?.[0]?.categoryName===owner.label&&
      points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z??0))))return packet;
 const distance=(a,b)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y);
 const width=points=>distance(points[5],points[17]);
 const index=width(landmarks[0])>=width(landmarks[1])?0:1;
 const full=landmarks[index],narrow=landmarks[1-index];
 const fullWidth=width(full),narrowWidth=width(narrow),heldWidth=width(owner.points);
 const span=Math.max(fullWidth,distance(full[0],full[9]));
 const collapsed=narrowWidth<.67*fullWidth&&narrowWidth<.86*heldWidth;
 const sameScale=fullWidth>=.65*heldWidth&&fullWidth<=1.8*heldWidth;
 const overlaps=distance(full[0],narrow[0])<span;
 const continuous=distance(owner.wrist,full[0])<1.5*span;
 if(!collapsed||!sameScale||!overlaps||!continuous)return packet;
 return {...packet,landmarks:[full],worldLandmarks:[packet.worldLandmarks?.[index]],handedness:[handedness[index]]};
}

function followsHeldWrist(packet,held,aspect){
 const points=packet.landmarks[0],gap=packet.stamp-held.seen;
 if(packet.landmarks.length!==1||points?.length!==21||packet.handedness?.[0]?.[0]?.categoryName!==held.label||gap>300)return false;
 const distance=(a,b)=>Math.hypot((a?.x-b?.x)*aspect,a?.y-b?.y);
 const span=p=>Math.max(distance(p[0],p[9]),distance(p[5],p[17]));
 const before=span(held.points),after=span(points);
 const expected={x:held.wrist.x+held.vx*gap,y:held.wrist.y+held.vy*gap};
 return Math.min(before,after)>.65*Math.max(before,after)&&distance(points[0],expected)<.8*before;
}

export class HandControls {
 constructor({scene,geometry,interaction,layout,canvas,getState,onChange,onFeedback,onStart,source=null,pointerBusy=()=>false}){
  Object.assign(this,{scene,geometry,interaction,layout,canvas,getState,onChange,onFeedback,onStart,pointerBusy});
  this.gate=new GraspGate();this.gestures=new HandGestures();this.lastPacket=this.lastSeen=-Infinity;this.primary=null;this.lastRaw=null;this.held=null;this.suspended=null;this.dwell=null;this.pointLatched=false;this.press={band:null,since:0,down:false,armed:false};
  const $=id=>document.getElementById(id);this.panel=$('handPanel');this.cursor=$('handCursor');this.video=$('handVideo');this.overlay=$('handOverlay');this.status=$('handStatus');this.hint=$('handHint');
  this.bulbMode='guided';
  $('bulbMode').value=this.bulbMode;
  $('bulbMode').onchange=e=>this.setBulbMode(e.target.value);
  this.camera=new HandCamera({video:this.video,source,onFrame:p=>this.packet(p),onStatus:(s,error)=>{this.status.textContent=s;this.status.classList.toggle('error',!!error)},onActive:a=>this.active(a),onLost:()=>this.lost()});
  $('handStart').onclick=()=>this.camera.running?this.camera.stop():this.camera.start();$('handOff').onclick=()=>this.camera.stop();
  $('handButton').onclick=()=>{this.panel.hidden=!this.panel.hidden;$('handButton').setAttribute('aria-expanded',String(!this.panel.hidden))};$('handClose').onclick=()=>{this.panel.hidden=true;$('handButton').setAttribute('aria-expanded','false');this.resetInput()};
  $('handCenter').onclick=()=>{if(this.lastRaw&&this.camera.modelReady&&performance.now()-this.lastSeen<350&&!this.busy){this.studio?.centerOnHand();this.hint.textContent='Frame centered. Open your hand, then grasp the marked tool.'}};
  $('handSide').onchange=()=>{this.lost();this.primary=null};$('handGain').oninput=e=>this.studio?.setFrameWidth(Number(e.target.value)/100);
  $('handReturn').onclick=()=>{if(this.suspended){this.scene.endEquipmentDrag(this.suspended.id,true);this.layout.save();this.suspended=null;this.refresh();this.onChange()}};
  this.refresh();
 }
 get busy(){return !!this.held||!!this.suspended||this.interaction.owner==='hand'}
 setBulbMode(mode){
  if(!['guided','manual'].includes(mode)||mode===this.bulbMode)return;
  if(this.interaction.owner==='hand')this.interaction.suspend('Bulb control changed. Regrasp the pipette to continue.');
  this.bulbMode=mode;
  document.getElementById('bulbMode').value=mode;
  document.getElementById('bulbHelp').textContent=mode==='guided'?'Keep three fingers curled. At the opening, dip your hand slightly and hold it there while the liquid moves.':'Keep your middle, ring and little fingers curled. Pinch thumb and index to squeeze the bulb. Spread them to relax.';
  this.resetInput();this.refresh();
 }
 resetInput(){this.studio?.clearHands();this.gestures.reset();this.missedCarry=null;this.primary=null;this.workCommand=null;this.pendingTool=null;this.gate.reset();this.dwell=null;this.pointLatched=false;this.press={band:null,since:0,down:false,armed:false};this.cursor.style.setProperty('--dwell','0deg');this.interaction.clearAim();this.onChange()}
 interruptEvidence(){this.gate.interruptEvidence();this.dwell=null;this.press={band:null,since:0,down:false,armed:false};this.cursor.style.setProperty('--dwell','0deg');this.interaction.clearAim();if(this.interaction.owner==='hand'){this.interaction.interruptHandStroke();this.interaction.flow=false}this.onChange()}
 active(a){if(a)this.onStart?.();this.studio?.clearCameraFrames();document.getElementById('handStart').textContent=a?'Stop hands':'Start hands';document.getElementById('handStart').setAttribute('aria-pressed',String(a));document.getElementById('handOff').hidden=!a;document.getElementById('handButton').classList.toggle('camera-on',a);this.panel.classList.toggle('camera-on',a);this.studio?.syncCamera();if(!a){this.lost();this.overlay.getContext('2d').clearRect(0,0,this.overlay.width,this.overlay.height)}this.refresh()}
 stop(){this.camera.stop()}
 reset(){if(this.held||this.suspended){this.scene.endEquipmentDrag((this.held||this.suspended).id,true);this.layout.save()}this.held=this.suspended=null;this.camera.stop();this.primary=null;this.lastRaw=null;this.lastPacket=this.lastSeen=-Infinity;this.resetInput();this.refresh()}
 lost(){if(this.interaction.owner==='hand')this.interaction.suspend('Tracking paused. Regrasp the marked tool; no transfer will restart by itself.');if(this.held){this.suspended=this.held;this.held=null;this.panel.hidden=false}this.cursor.hidden=true;this.resetInput();this.hint.textContent='Show your whole open hand to re-arm.';this.refresh()}
 suspend(){this.lost()}
 yieldToPointer(){
  if(this.interaction.owner==='hand')this.interaction.suspend('Using mouse or touch. Open your hand to resume hand control.');
  const arranged=this.held||this.suspended;
  if(arranged){this.scene.endEquipmentDrag(arranged.id,true);this.layout.save()}
  this.held=this.suspended=null;this.cursor.hidden=true;this.resetInput();this.refresh();
 }
 refresh(){
  const $=id=>document.getElementById(id),c=this.interaction;
  $('handCenter').disabled=!this.camera.modelReady||performance.now()-this.lastSeen>350||this.busy;$('handGain').disabled=this.busy;$('handSide').disabled=this.busy;$('handBegin').hidden=!this.camera.modelReady;
  $('handHeld').textContent=this.held?'Holding layout equipment':c.owner==='hand'?'Holding '+c.targetName(c.tool):c.owner?'Using '+c.owner+' controls':c.tool?'Tool placed · open your palm to regrasp':'Open hand to begin';
  $('handSafety').hidden=!this.suspended;$('handReturn').hidden=!this.suspended;$('handReturn').textContent='Place here';
 }
 workGestures(packet,held,aspect,mirror){
  // At 10–15 fps one empty exposure can span B06's 180 ms loss interval.
  // Stop motion immediately. Only bridge that one exposure when the same
  // palm returns at the predicted wrist position during an unseated carry.
  const missed=this.missedCarry;this.missedCarry=null;
  if(missed&&held?.id===missed.id&&held.seen===missed.seen&&!followsHeldWrist(packet,held,aspect))
   this.gestures.update({landmarks:[]},missed.stamp,aspect,mirror);
  if(!missed&&held?.grip&&held.label&&!held.missing&&!held.candidate&&!this.interaction.contact&&
     !packet.landmarks.length&&packet.stamp-held.seen<=180){
   this.missedCarry={id:held.id,seen:held.seen,stamp:packet.stamp};
   return [{id:held.id,phase:'missing'}];
  }
  return this.gestures.update(packet,packet.stamp,aspect,mirror);
 }
 packet(p){
  const now=performance.now();if(!Number.isFinite(p.stamp)||p.stamp<=this.lastPacket||now-p.stamp>600||now-p.stamp< -10){this.lost();return}this.lastPacket=p.stamp;
  if(this.studio&&p.frameRevision!==undefined&&p.frameRevision!==this.studio.frameRevision)return;
  if(this.pointerBusy()){
   this.studio?.paint(p);this.studio?.resetNavigation();this.gestures.reset();this.gate.reset();this.primary=null;
   this.workCommand=this.pendingTool=null;this.press={band:null,since:0,down:false,armed:false};this.cursor.hidden=true;return;
  }
  if(this.studio&&!this.panel.hidden){
   const aspect=p.frame?p.frame.width/p.frame.height:this.canvas.clientWidth/this.canvas.clientHeight;
   const events=this.gestures.update(p,p.stamp,aspect,this.camera.source?.mirrored??true),seen=events.find(e=>e.points&&e.id===this.studio.framingHand)||events.find(e=>e.points);
   this.studio.paint(p,seen);this.cursor.hidden=true;
   if(seen){this.lastSeen=now;this.lastRaw={...seen.palm}}
   this.refresh();document.getElementById('handHeld').textContent=events.filter(e=>e.points).map(e=>`${e.label||'Tracked'} hand · ${Math.round(e.closure*100)}% closed · ${Math.round(e.openness*100)}% open`).join(' / ')||'Show your open hands inside the frame.';
   return;
  }
  if(this.studio?.handleViewPacket(p))return;
  const mirror=this.camera.source?.mirrored??true;
  const preference=document.getElementById('handSide').value;
  const aspect=p.frame?p.frame.width/p.frame.height:this.canvas.clientWidth/this.canvas.clientHeight;
  const held=this.interaction.owner==='hand'&&this.interaction.holdsPipette&&this.gestures.hands.length===1?this.gestures.hands[0]:null;
  if(held)p=resolveDuplicatePalm(p,held,aspect);
  const events=this.workGestures(p,held,aspect,mirror);
  const old=events.find(e=>e.id===this.primary);
  const allowed=e=>e.points&&(preference==='Auto'||preference===e.label);
  const event=old&&allowed(old)?old:events.find(allowed);
  const ownerMissing=old?.phase==='missing'||old?.phase==='lost'&&(this.interaction.owner==='hand'||this.held);
  this.studio?.paint(p,ownerMissing?null:event);
  if(old?.phase==='missing'){
   // B06 keeps the same owner through a short occlusion; freeze the tool and
   // liquid immediately, then allow only that ID to resume the hold.
   this.cursor.hidden=true;this.workCommand=null;this.pendingTool=null;this.interruptEvidence();return;
  }
  if(old?.phase==='lost'){
   if(this.interaction.owner==='hand'||this.held){this.lost();return}
   // Losing an idle cursor must not discard another already observed open
   // hand. B06 keeps each identity separately; the new hand still owns its
   // own open/close evidence and cannot inherit the previous hand's grasp.
   this.primary=null;this.workCommand=this.pendingTool=null;this.press={band:null,since:0,down:false,armed:false};
  }
  if(!event){this.cursor.hidden=true;this.interruptEvidence();return}
  this.primary=event.id;this.lastSeen=now;this.lastRaw={...event.palm};
  const tracked=this.gestures.hands.find(h=>h.id===event.id),index=p.landmarks.findIndex(points=>points[0]===tracked?.wrist);
  const lm=p.landmarks[index],pressure=this.bulbMode==='manual'?bulbPressure(lm,p.worldLandmarks?.[index],aspect):null;
  const roll=lm?Math.atan2((mirror?-1:1)*(lm[9].x-lm[0].x)*aspect,-(lm[9].y-lm[0].y)):0;
  const cursor=this.studio?this.studio.mapHand(event,p):{x:event.x*this.canvas.clientWidth,y:event.y*this.canvas.clientHeight};
  const {x,y}=cursor,pose=event.openness*100>=this.gestures.settings.open?'open':event.grip||event.intent?'grip':'neutral';
  this.gate.armed=event.armed;this.gate.holding=!!event.grip;
  if(this.studio){
   const held=this.interaction.owner==='hand'||!!this.held;
   if(this.studio.blockWorkAt(cursor,event,held)){
    this.cursor.hidden=true;this.workCommand=null;this.pendingTool=null;this.interruptEvidence();return;
   }
  }
  const edge={valid:true,armed:event.armed,edge:event.phase==='press'?'grab':event.phase==='release'?'release':null};
  // Only thumb pressure and wrist roll are lab-specific. Grasp ownership,
  // release timing, palm motion, identity and all filtering come from B06.
  this.frame({thumbPress:pressure,roll,valid:true,pose,x,y,now:p.stamp,handedness:String(event.id),b06:event,signalsValid:pressure!==null},edge);
 }
 frame(f,transition=null){
  if(this.studio?.mode==='view')return;
  if(!f.valid||![f.x,f.y,f.now].every(Number.isFinite)){this.interruptEvidence();return}
  if(this.getState().status!=='running'||document.querySelector('dialog[open]')||this.layout.drag){this.lost();return}
  const edge=transition||this.gate.update({pose:f.pose,valid:true,handedness:f.handedness},f.now);if(!edge.valid){this.lost();return}
  this.cursor.hidden=false;this.cursor.style.left=f.x+'px';this.cursor.style.top=f.y+'px';this.cursor.dataset.pose=f.pose;
  if(this.layout.active){this.arrange(f,edge.edge);this.refresh();return}
  const c=this.interaction;
  if(f.b06?.intent&&!c.owner&&this.pendingTool?.since!==f.b06.intentSince){
   this.pendingTool={...this.pickWorkTarget(f.x,f.y),x:f.x,y:f.y,since:f.b06.intentSince};
  }
  if(edge.edge==='grab'){
   const reserved=this.pendingTool;
   const target=reserved&&Math.hypot(f.x-reserved.x,f.y-reserved.y)<40?reserved:f.b06?this.pickWorkTarget(f.x,f.y):{id:this.pickTool(f.x,f.y)};
   if(target.id&&c.grab(target.id,'hand',f.x,f.y)){this.rollBase=f.roll||0;this.lastContact=c.contact;this.cursor.dataset.pose='held'}
   else if(target.region)this.workCommand={region:target.region,x:f.x,y:f.y};
  }
  if(c.owner==='hand'){
   if(f.pose==='grip'){
   c.move(f.x,f.y,{hand:true,guidedBulb:this.bulbMode==='guided',now:f.now});
   if(c.contact!==this.lastContact){this.rollBase=f.roll||0;this.lastContact=c.contact}
   if(c.contact?.kind==='pour'){
    const angle=Math.abs(wrap((f.roll||0)-this.rollBase))*2.2;c.setTilt(angle);
    if(c.step.action!=='empty'&&angle<.08&&c.leavePour()){c.prepareCarry(f.x,f.y);this.lastContact=null}
   }
   if(this.bulbMode==='manual'&&c.holdsPipette){
    if(f.signalsValid!==false)this.thumb(f);
    else{this.press={band:null,since:f.now,down:false,armed:false};if(c.flow){c.flow=false;c.changed()}}
   }
   }else{
    // An opening hand releases the tool; it is never a bulb-relax command.
    // Stop immediately while the grasp gate verifies the release edge.
    c.interruptHandStroke();
    if(c.flow){c.flow=false;c.changed()}
    this.press={band:null,since:f.now,down:false,armed:false};
   }
   if(edge.edge==='release')c.release();
   this.cursor.dataset.pose=c.owner==='hand'?'held':f.pose;
  }else{
   if(this.bulbMode==='manual')this.thumb(f,false);
   if(edge.edge==='release'&&this.workCommand){
    const command=this.workCommand;this.workCommand=null;
    const region=this.geometry.pick(f.x,f.y,{only:[command.region],padding:15})?.id;
    if(region===command.region&&Math.hypot(f.x-command.x,f.y-command.y)<40)c.activate(region);
   }
  }
  if(edge.edge==='release')this.pendingTool=null;
  if(!c.owner){c.hover(f.x,f.y,{hand:true});this.point(f)}
  if(c.owner==='hand'&&!c.contact)this.cursor.style.setProperty('--dwell',c.aimSettler.progress*360+'deg');
  else if(c.contact)this.cursor.style.setProperty('--dwell','0deg');
  this.cursor.querySelector('span').textContent=c.owner==='hand'?(c.flow?'Liquid moving':c.contact?'Tip positioned':'Carrying'):(this.workCommand?'Open to select':edge.armed?'Close to grasp':'Open hand');
  this.hint.textContent=this.pipetteCue()?.instruction||c.describe().instruction;this.refresh();
 }
 pipetteCue(){
  const c=this.interaction;
  if(!c.holdsPipette||!c.usable()||this.layout.active||this.studio?.mode==='view')return null;
  const needsGrip=!c.owner&&this.camera.running&&(c.frozen||c.contact);
  if(c.owner!=='hand'&&!needsGrip)return null;
  const at=c.contact,s=c.step,guided=this.bulbMode==='guided';
  const action=s.action==='aspirate'?'draw':'dispense';
  const source=c.targetName(s.target),volume=c.getState()[c.tool].volume.toFixed(1)+' mL';
  const bulb=c.compressed?'squeezed':'relaxed';
  let instruction;
  if(needsGrip)instruction='Open your palm over the pipette, then curl three fingers to regrasp.';
  else if(c.flow)instruction=(c.flowAction==='aspirate'?'Drawing from ':'Dispensing into ')+source+'. Hold steady.';
  else if(at&&(at.target!==s.target||at.mode!==s.action))instruction=guided?'Lift slightly and carry to '+c.targetName(c.desiredTarget())+'.':'Lift your hand to withdraw the tip.';
  else if(c.tool!==s.pipetteId)instruction='Place this pipette in its stand.';
  else if(!at){
   const mouth=c.targetScreen(s.target),tip=c.workingEnd();
   if(c.hoverTarget===s.target)instruction=guided?'Dip your closed hand slightly into the opening.':'Hold the tip steady over the opening.';
   else if(mouth?.visible&&Math.abs(tip.x-mouth.x)<mouth.radius&&tip.y>mouth.y+10)instruction='Lift the tip to the opening of '+source+'.';
   else instruction='Guide the tip to '+source+'.';
  }
  else if(guided){
   if(at.depth>0&&(!at.handStroke||at.handStroke.started))instruction='Lift slightly to clear the opening, then dip again to resume.';
   else if(at.depth===1)instruction='Hold here to '+action+' '+s.volume+' mL.';
   else instruction='Dip your closed hand slightly to '+action+' '+s.volume+' mL.';
  }else if(s.action==='aspirate'&&!c.charged){
   instruction=at.depth>0?'Lift the tip above the liquid to squeeze again.':'Spread thumb and index, then pinch to squeeze.';
  }else if(at.depth<1)instruction=s.action==='aspirate'?'Keep pinching and lower your hand.':'Lower your hand into the receiving vessel.';
  else instruction=s.action==='aspirate'?(c.compressed?'Spread thumb and index to draw.':'Pinch and spread again to resume drawing.'):'Pinch thumb and index to dispense.';
  return {bulb,volume,instruction,flow:c.flow};
 }
 pickTool(x,y){
  const direct=this.interaction.pickTool(x,y);if(direct)return direct;
  const near=[...pipetteIds,'cuvette'].flatMap(tool=>{
   const visible=this.geometry.screenTarget?.(tool+'-grip',{hand:true}),p=visible||this.geometry.project(tool+'-grip');
   return visible?.visible!==false&&p?.z>=-1&&this.interaction.near(x,y,p,38)?[{id:tool,distance:Math.hypot(x-p.x,y-p.y)}]:[];
  }).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
  return near[0]?.id||null;
 }
 pickWorkTarget(x,y){
  const controls=['lid','zero','read','clipboard'];
  const direct=this.geometry.pointerControl?.(x,y)||this.geometry.pick(x,y,{only:[...pipetteIds.flatMap(id=>[id+'-grip',id+'-bulb']),'cuvette-grip',...controls],padding:0})?.id;
  if(controls.includes(direct))return {region:direct};
  if(direct){const tool=direct.split('-')[0];if([...pipetteIds,'cuvette'].includes(tool))return {id:tool}}
  const command=this.geometry.pick(x,y,{only:controls,padding:10})?.id;
  return command?{region:command}:{id:this.pickTool(x,y)};
 }
 thumb(f,operate=true){
  const v=Number.isFinite(f.thumbPress)?f.thumbPress:(f.squeeze===true?1:f.squeeze===false?0:0),band=v>.68?'press':v<.3?'rest':'middle',p=this.press;
  if(band!==p.band){p.band=band;p.since=f.now}
  if(band==='rest'&&f.now-p.since>=100){
   const was=p.down;p.down=false;p.armed=true;
   if(was&&operate){
    const c=this.interaction;
    if(c.step.action==='aspirate'&&(!c.contact||c.contact.depth<.99)&&!c.getState().transfer)c.charged=false;
    c.squeeze(false);
   }
  }
  if(band==='press'&&f.now-p.since>=90&&p.armed&&!p.down){p.down=true;p.armed=false;if(operate)this.interaction.squeeze(true)}
 }
 point(f){
  if(f.pose!=='point'||!this.gate.armed){this.dwell=null;this.cursor.style.setProperty('--dwell','0deg');if(f.pose==='open')this.pointLatched=false;return}
  const region=this.geometry.pick(f.x,f.y,{only:['lid','zero','read','clipboard'],padding:15})?.id;
  if(!region||this.pointLatched){this.dwell=null;return}
  if(!this.dwell||this.dwell.region!==region||Math.hypot(f.x-this.dwell.x,f.y-this.dwell.y)>25)this.dwell={region,start:f.now,x:f.x,y:f.y};
  const t=clamp((f.now-this.dwell.start)/850);this.cursor.style.setProperty('--dwell',t*360+'deg');if(t===1){this.pointLatched=true;this.dwell=null;this.interaction.activate(region);this.cursor.style.setProperty('--dwell','0deg')}
 }
 arrange(f,edge){
  if(this.suspended)return;
  if(edge==='grab'){const grip=this.scene.layoutGrip(f.x,f.y);if(grip){this.held={...grip,roll:f.roll||0};this.scene.beginEquipmentDrag(grip.id);this.layout.selected=grip.id;this.layout.updateSelection()}}
  if(this.held){const h=this.held,delta=clamp(wrap((f.roll||0)-h.roll),-.18,.18);this.scene.rotateEquipment(h.id,-delta);h.roll=wrap(h.roll+delta);this.scene.dragLayoutGrip(h,f.x,f.y);this.cursor.dataset.pose='held';this.onChange();
   if(edge==='release'){this.scene.endEquipmentDrag(h.id,true);this.layout.save();this.held=null;this.onChange()}}
  this.cursor.querySelector('span').textContent=this.held?'Move · turn wrist · open to place':'Grasp equipment';
 }
}
