import {pipetteIds} from './pipettes.js';
/* B06 camera events adapted to the shared laboratory manipulation controller. */
import {bulbPressure,GraspGate} from './grasp-core.js';
import {HandGestures,steadyHandMotion} from './view-gestures.js';
import {HandCamera,HELD_FRAME_LIMIT_MS} from './hand-camera.js';
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
  const $=id=>document.getElementById(id);this.panel=$('handPanel');this.cursor=$('handCursor');this.video=$('handVideo');this.overlay=$('handOverlay');this.status=$('handStatus');
  this.hint='Show an open palm.';this.previewPose='';
  this.bulbMode='guided';
  $('bulbMode').value=this.bulbMode;
  $('bulbMode').onchange=e=>this.setBulbMode(e.target.value);
  this.camera=new HandCamera({video:this.video,source,onFrame:p=>this.packet(p),onStatus:(s,error)=>{this.status.textContent=s;this.status.classList.toggle('error',!!error)},onActive:a=>this.active(a),onLost:()=>this.lost(),onDelay:()=>this.holdForDetector()});
  $('handStart').onclick=()=>this.camera.running?this.camera.stop():this.camera.start();
  $('handButton').onclick=()=>{this.panel.hidden=!this.panel.hidden;$('handButton').setAttribute('aria-expanded',String(!this.panel.hidden));if(!this.panel.hidden)$('handClose').focus({preventScroll:true})};$('handClose').onclick=()=>{this.panel.hidden=true;$('handButton').setAttribute('aria-expanded','false');this.resetInput();$('handButton').focus({preventScroll:true})};
  $('handCenter').onclick=()=>{if(this.lastRaw&&this.camera.modelReady&&performance.now()-this.lastSeen<350&&!this.busy)this.studio?.centerOnHand()};
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
  document.getElementById('bulbHelp').textContent=mode==='guided'?'Dip slightly and hold to move liquid.':'Pinch to squeeze. Spread to draw.';
  this.resetInput();this.refresh();
 }
 resetInput(){this.studio?.clearHands();this.gestures.reset();this.missedCarry=this.pausedStroke=this.delayedGrip=null;this.aimAnchor=this.openAim=null;this.previewPose='';this.primary=null;this.workCommand=null;this.pendingTool=null;this.gate.reset();this.dwell=null;this.pointLatched=false;this.press={band:null,since:0,down:false,armed:false};this.cursor.style.setProperty('--dwell','0deg');this.interaction.clearAim();this.onChange()}
 interruptEvidence(bridge=false){
  this.gate.interruptEvidence();this.dwell=null;this.aimAnchor=this.openAim=null;this.press={band:null,since:0,down:false,armed:false};
  this.cursor.style.setProperty('--dwell','0deg');const c=this.interaction;c.clearAim();
  if(c.owner==='hand'){
   this.pausedStroke=bridge&&c.flow&&this.bulbMode==='guided'&&c.contact?.depth===1&&c.contact.handStroke?.started
    ?{contact:c.contact,stroke:c.contact.handStroke,point:c.lastPointer}:null;
   if(!this.pausedStroke)c.interruptHandStroke();
   c.flow=false;
  }
  this.onChange();
 }
 holdForDetector(){
  const c=this.interaction,owner=this.gestures.hands.find(h=>h.id===this.primary);
  if(this.delayedGrip)return performance.now()-this.lastSeen<HELD_FRAME_LIMIT_MS;
  if(this.bulbMode!=='guided'||!c.flow||c.owner!=='hand'||c.contact?.depth!==1||!c.contact.handStroke?.started||
     !owner?.grip||!owner.label||owner.missing||owner.candidate||this.gestures.hands.length!==1||this.missedCarry)return false;
  this.delayedGrip={id:owner.id,seen:owner.seen,started:performance.now(),first:null};
  this.cursor.hidden=true;this.interruptEvidence(true);
  return true;
 }
 confirmDelayedGrip(packet,owner,aspect,mirror){
  const pause=this.delayedGrip;
  // A slow detector supplies no evidence about the hand. Require two new
  // closed-palm observations at the seated wrist before restoring its ID.
  const probe=new HandGestures(this.gestures.settings);
  const [event]=probe.update(packet,packet.stamp,aspect,mirror),seen=probe.hands[0];
  const distance=(a,b)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y);
  const span=points=>Math.max(distance(points[5],points[17]),distance(points[0],points[9]));
  const gap=packet.stamp-(pause.first??pause.seen);
  if(!owner||owner.id!==pause.id||gap>=(pause.first===null?HELD_FRAME_LIMIT_MS:260)||
     packet.landmarks.length!==1||!event?.points||event.label!==owner.label||event.closure*100<this.gestures.settings.close||
     distance(seen.wrist,owner.wrist)>.3*span(owner.points)||Math.min(span(seen.points),span(owner.points))<.8*Math.max(span(seen.points),span(owner.points))){
   this.lost();return false;
  }
  // An exposure already in the worker when flow stopped can identify a loss,
  // but cannot count as one of the two observations after the pause.
  if(packet.stamp<pause.started)return false;
  if(pause.first===null){pause.first=packet.stamp;this.lastSeen=performance.now();return false}
  Object.assign(owner,{wrist:seen.wrist,points:seen.points,seen:packet.stamp,vx:0,vy:0});
  this.delayedGrip=null;return true;
 }
 active(a){if(a)this.onStart?.();this.studio?.clearCameraFrames();document.getElementById('handStart').textContent=a?'Stop hands':'Start hands';document.getElementById('handStart').setAttribute('aria-pressed',String(a));document.getElementById('handButton').classList.toggle('camera-on',a);this.panel.classList.toggle('camera-on',a);this.studio?.syncCamera();if(!a){this.lost();this.overlay.getContext('2d').clearRect(0,0,this.overlay.width,this.overlay.height)}this.refresh()}
 stop(){this.camera.stop()}
 reset(){if(this.held||this.suspended){this.scene.endEquipmentDrag((this.held||this.suspended).id,true);this.layout.save()}this.held=this.suspended=null;this.camera.stop();this.primary=null;this.lastRaw=null;this.lastPacket=this.lastSeen=-Infinity;this.resetInput();this.refresh()}
 lost(){
  const pointer=this.studio?.panelPointer;
  if(pointer&&!pointer.adjusting)pointer.cancel();
  if(this.interaction.owner==='hand')this.interaction.suspend('Tracking paused. Regrasp the marked tool to continue.');
  if(this.held){this.suspended=this.held;this.held=null;this.panel.hidden=false}
  this.cursor.hidden=true;this.resetInput();this.hint='Show an open palm.';this.refresh();
 }
 suspend(){this.lost()}
 yieldToPointer(){
  if(this.interaction.owner==='hand')this.interaction.suspend('Using mouse or touch. Open your hand to resume hand control.');
  const arranged=this.held||this.suspended;
  if(arranged){this.scene.endEquipmentDrag(arranged.id,true);this.layout.save()}
  this.held=this.suspended=null;this.cursor.hidden=true;this.resetInput();this.refresh();
 }
 refresh(){
  const $=id=>document.getElementById(id);
  $('handCenter').disabled=!this.camera.modelReady||performance.now()-this.lastSeen>350||this.busy;$('handGain').disabled=this.busy;$('handSide').disabled=this.busy;$('handBegin').hidden=!this.camera.modelReady;
  const pose=this.camera.modelReady?(this.previewPose||'Show an open palm'):'';
  if(!this.panel.hidden&&$('handHeld').textContent!==pose)$('handHeld').textContent=pose;
  $('handSafety').hidden=!this.suspended;$('handReturn').hidden=!this.suspended;$('handReturn').textContent='Place here';
 }
 workGestures(packet,held,aspect,mirror){
  // One empty exposure on a slow camera can span the B06 loss interval.
  // Withhold motion until the next image confirms the same wrist and scale.
  const missed=this.missedCarry;this.missedCarry=null;
  if(missed){
   const same=held?.id===missed.id&&held.seen===missed.seen&&followsHeldWrist(packet,held,aspect);
   if(!same){
    this.gestures.update({landmarks:[]},missed.stamp,aspect,mirror);
    if(this.pausedStroke){this.interaction.interruptHandStroke();this.pausedStroke=null}
    if(!this.gestures.hands.some(h=>h.id===missed.id))return [{id:missed.id,phase:'lost'}];
   }
  }
  if(!missed&&held?.grip&&held.label&&!held.missing&&!held.candidate&&
     !packet.landmarks.length&&packet.stamp-held.seen<=300){
   this.missedCarry={id:held.id,seen:held.seen,stamp:packet.stamp};
   return [{id:held.id,phase:'missing'}];
  }
  return this.gestures.update(packet,packet.stamp,aspect,mirror);
 }
 packet(p){
  const now=performance.now();if(!Number.isFinite(p.stamp)||p.stamp<=this.lastPacket||now-p.stamp>600||now-p.stamp< -10){this.lost();return}this.lastPacket=p.stamp;
  if(this.studio&&p.frameRevision!==undefined&&p.frameRevision!==this.studio.frameRevision)return;
  if(this.studio?.handlePanelPacket?.(p))return;
  if(this.pointerBusy()){
   this.studio?.paint(p);this.studio?.resetNavigation();this.gestures.reset();this.gate.reset();this.primary=null;
   this.workCommand=this.pendingTool=null;this.press={band:null,since:0,down:false,armed:false};this.cursor.hidden=true;return;
  }
  if(this.studio&&!this.panel.hidden){
   const aspect=p.frame?p.frame.width/p.frame.height:this.canvas.clientWidth/this.canvas.clientHeight;
   const events=this.gestures.update(p,p.stamp,aspect,this.camera.source?.mirrored??true),seen=events.find(e=>e.points&&e.id===this.studio.framingHand)||events.find(e=>e.points);
   this.studio.paint(p,seen);this.cursor.hidden=true;
   if(seen){this.lastSeen=now;this.lastRaw={...seen.palm}}
   this.previewPose=events.filter(e=>e.points).map(e=>(e.label?e.label+' · ':'')+(e.closure*100>=this.gestures.settings.close?'Grasp':e.openness*100>=this.gestures.settings.open?'Open palm':'Hand in view')).join(' / ');
   this.refresh();
   return;
  }
  if(this.studio?.handleViewPacket(p))return;
  const mirror=this.camera.source?.mirrored??true;
  const preference=document.getElementById('handSide').value;
  const aspect=p.frame?p.frame.width/p.frame.height:this.canvas.clientWidth/this.canvas.clientHeight;
  const held=this.interaction.owner==='hand'&&this.interaction.holdsPipette&&this.gestures.hands.length===1?this.gestures.hands[0]:null;
  if(held)p=resolveDuplicatePalm(p,held,aspect);
  if(this.delayedGrip&&!this.confirmDelayedGrip(p,held,aspect,mirror)){this.studio?.paint(p);return}
  const events=this.workGestures(p,held,aspect,mirror);
  const old=events.find(e=>e.id===this.primary);
  const allowed=e=>e.points&&(preference==='Auto'||preference===e.label);
  const event=old&&allowed(old)?old:events.find(allowed);
  const ownerMissing=old?.phase==='missing'||old?.phase==='lost'&&(this.interaction.owner==='hand'||this.held);
  this.studio?.paint(p,ownerMissing?null:event);
  if(old?.phase==='missing'){
   // B06 keeps the same owner through a short occlusion; freeze the tool and
   // liquid immediately, then allow only that ID to resume the hold.
   this.cursor.hidden=true;this.workCommand=null;this.pendingTool=null;this.interruptEvidence(!!this.missedCarry);return;
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
  let cursor=this.studio?this.studio.mapHand(event,p):{x:event.x*this.canvas.clientWidth,y:event.y*this.canvas.clientHeight};
  if(!this.interaction.owner&&!this.held){
   cursor=steadyHandMotion(this.aimAnchor?.id===event.id?this.aimAnchor:null,cursor,2);
   this.aimAnchor={id:event.id,x:cursor.x,y:cursor.y};
  }else this.aimAnchor=null;
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
  let aim;
  if(f.b06&&!c.owner){
   aim=this.pickWorkTarget(f.x,f.y);
   if(f.pose==='open')this.openAim={...aim,x:f.x,y:f.y,at:f.now,id:f.b06.id};
   if(f.b06.intent&&f.b06.phase!=='press'&&this.pendingTool?.since!==f.b06.intentSince){
    // Closing shifts the palm center. Reserve the last open-palm hit when
    // it is still under the grip, then keep that choice through B06's dwell.
    const open=this.openAim;
    const useOpen=open?.id===f.b06.id&&f.now-open.at<=240&&Math.hypot(f.x-open.x,f.y-open.y)<=22;
    const choice=useOpen?open:aim;
    this.pendingTool={id:choice.tool,region:choice.region,x:f.x,y:f.y,since:f.b06.intentSince};
   }
   if(this.pendingTool&&Math.hypot(f.x-this.pendingTool.x,f.y-this.pendingTool.y)>32)this.pendingTool.cancelled=true;
  }
  if(edge.edge==='grab'){
   const reserved=this.pendingTool;
   const confirmed=reserved&&!reserved.cancelled&&reserved.since===f.b06?.intentSince;
   const target=f.b06?(confirmed?reserved:{}):{id:this.pickTool(f.x,f.y)};
   if(target.id&&c.grab(target.id,'hand',f.x,f.y)){this.rollBase=f.roll||0;this.lastContact=c.contact;this.cursor.dataset.pose='held'}
   else if(target.region)this.workCommand={region:target.region,x:f.x,y:f.y};
  }
  if(c.owner==='hand'){
   if(this.pausedStroke){
    const {contact,stroke,point}=this.pausedStroke;this.pausedStroke=null;
    if(c.contact===contact&&contact.handStroke===stroke&&f.b06?.closure*100>=this.gestures.settings.close&&
       Math.hypot(f.x-point.x,f.y-point.y)<=8&&c.step.target===contact.target&&c.step.action===contact.mode){
     c.flow=true;c.lastNow=performance.now();
    }else c.interruptHandStroke();
   }
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
  if(!c.owner){
   if(aim){
    const hit=this.pendingTool&&!this.pendingTool.cancelled&&f.b06.intent?this.pendingTool:null;
    const tool=hit?hit.id:aim.tool,region=hit?hit.region:aim.region;
    const id=tool?tool+'-grip':region||null;
    if(c.hoverRegion!==id){c.hoverRegion=id;c.changed()}
   }else c.hover(f.x,f.y,{hand:true});
   this.point(f);
  }
  if(c.owner==='hand'&&!c.contact)this.cursor.style.setProperty('--dwell',c.aimSettler.progress*360+'deg');
  else if(c.contact)this.cursor.style.setProperty('--dwell','0deg');
  this.cursor.querySelector('span').textContent=c.owner==='hand'?(c.flow?'Liquid moving':c.contact?'Tip positioned':'Carrying'):(this.workCommand?'Open to select':edge.armed?'Close to grasp':'Open hand');
  this.hint=this.pipetteCue()?.instruction||c.describe().instruction;this.refresh();
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
  if(needsGrip)instruction='Open over the grip. Curl three fingers to regrasp.';
  else if(this.pausedStroke)instruction='Hold steady at the opening.';
  else if(c.flow)instruction=(c.flowAction==='aspirate'?'Drawing':'Dispensing')+' · hold steady.';
  else if(at&&(at.target!==s.target||at.mode!==s.action))instruction=guided?'Lift and carry to '+c.targetName(c.desiredTarget())+'.':'Lift to withdraw.';
  else if(c.tool!==s.pipetteId)instruction='Place this pipette in its stand.';
  else if(!at){
   const mouth=c.targetScreen(s.target),tip=c.workingEnd();
   if(c.hoverTarget===s.target)instruction=guided?'Dip slightly at the opening.':'Hold over the opening.';
   else if(mouth?.visible&&Math.abs(tip.x-mouth.x)<mouth.radius&&tip.y>mouth.y+10)instruction='Lift the tip to the opening of '+source+'.';
   else instruction='Guide the tip to '+source+'.';
  }
  else if(guided){
   if(at.depth>0&&(!at.handStroke||at.handStroke.started))instruction='Lift, then dip again to resume.';
   else if(at.depth===1)instruction='Hold here to '+action+' '+s.volume+' mL.';
   else instruction='Dip slightly to '+action+' '+s.volume+' mL.';
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
  if(direct){const tool=direct.split('-')[0];if([...pipetteIds,'cuvette'].includes(tool))return {tool}}
  const command=this.geometry.pick(x,y,{only:controls,padding:10})?.id;
  return command?{region:command}:{tool:this.pickTool(x,y)};
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
