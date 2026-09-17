/* Shared, deterministic interaction core. No camera/DOM dependency in these classes. */
(function(root){'use strict';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const sub=(a,b)=>a.map((v,i)=>v-b[i]), dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0), norm=a=>Math.hypot(...a), unit=a=>a.map(v=>v/(norm(a)||1e-9));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], angle=(a,b)=>Math.acos(clamp(dot(unit(a),unit(b)),-1,1));
class AdaptiveFilter{
 constructor(){this.reset()}
 reset(){this.value=null;this.raw=null;this.time=null;this.speed=0}
 update(x,t){if(!Number.isFinite(x)||!Number.isFinite(t))return this.value;if(this.value===null||t-this.time>300||t<=this.time){this.value=x;this.raw=x;this.time=t;this.speed=0;return x}let dt=clamp((t-this.time)/1000,.005,.15),v=(x-this.raw)/dt;this.speed+=.4*(v-this.speed);let cutoff=1.9+4.0*Math.abs(this.speed),a=1/(1+1/(2*Math.PI*cutoff*dt));this.value+=a*(x-this.value);this.raw=x;this.time=t;return this.value}
}
class PressGate{
 constructor(){this.reset()}
 reset(){this.active=false;this.armed=false;this.since=null;this.last=null;this.band=null}
 update(depth,now,valid=true){if(!valid||!Number.isFinite(depth)||!Number.isFinite(now)||(this.last!==null&&(now-this.last>240||now<this.last))){this.reset();if(!valid)return null}this.last=now;let band=depth<.28?'rest':depth>.65?'press':'middle';if(band!==this.band){this.band=band;this.since=now}if(band==='rest'&&now-this.since>=75){let was=this.active;this.active=false;this.armed=true;return was?'release':null}if(band==='press'&&now-this.since>=65&&this.armed&&!this.active){this.active=true;this.armed=false;return'press'}return null}
}
function measureHand(world,lm){if(!world||world.length!==21||!lm||lm.length!==21)return null;const finite=i=>world[i]&&[world[i].x,world[i].y,world[i].z].every(Number.isFinite);if(![0,1,2,3,4,5,9,17].every(finite))return null;let p=world.map(v=>v?[v.x,v.y,v.z]:[0,0,0]),bones=[norm(sub(p[2],p[1])),norm(sub(p[3],p[2])),norm(sub(p[4],p[3]))],scale=bones.reduce((a,b)=>a+b,0);if(scale<.015||scale>.25||bones.some(v=>v/scale<.10||v/scale>.65))return null;
 let features=[];for(let i of[3,4])for(let j of[0,1,2])features.push(norm(sub(p[i],p[j]))/scale);let axis=unit(sub(p[2],p[1]));features.push(2*(.75*dot(sub(p[4],p[2]),axis)+.25*dot(sub(p[3],p[2]),axis))/(bones[1]+bones[2]));let palmAxis=unit(sub(p[9],p[0])),across=unit(sub(p[5],p[17])),normal=unit(cross(across,palmAxis));
 let extended=0,folded=0;for(let [base,pip,tip]of[[5,6,8],[9,10,12],[13,14,16],[17,18,20]]){if(![base,pip,tip].every(finite))continue;let dp=norm(sub(p[pip],p[0])),dt=norm(sub(p[tip],p[0]));if(dt>dp*1.27)extended++;if(dt<dp*1.12)folded++}let pinch=norm(sub(p[4],p[8]))/Math.max(.015,norm(sub(p[5],p[17])))<.40;
 return{features,shape:bones.map(v=>v/scale),normal,axis:palmAxis,grip:folded>=2||pinch,open:extended>=3&&!pinch,pinch,palmX:(lm[0].x+lm[1].x)/2,palmY:(lm[0].y+lm[1].y)/2,rotation:[Math.atan2(palmAxis[2],-palmAxis[1]),Math.atan2(normal[0],normal[2]),Math.atan2(palmAxis[0],-palmAxis[1])]}}
function thumbDepth(features,rest,press){if(!rest||!press)return{depth:0,valid:false};let d=sub(press,rest),v=sub(features,rest),den=dot(d,d);if(den<.0004)return{depth:0,valid:false};let depth=dot(v,d)/den,err=norm(sub(v,d.map(v=>v*depth)))/Math.sqrt(d.length);return{depth,valid:Number.isFinite(depth)&&depth>-.7&&depth<2&&err<Math.max(.11,Math.sqrt(den/d.length)*.8)}}
class Contact{
 constructor(t,f){this.target=t;this.x=f.rawX??f.x;this.y=f.palmY??f.y;this.last=f.now;this.source=f.source;this.depth=0;this.valid=true;this.reason='';this.rearmed=true}
 update(f){let x=f.rawX??f.x,y=f.palmY??f.y;if(![x,y,f.now].every(Number.isFinite)||f.now<this.last||(this.source==='hand'&&f.now-this.last>300)){this.valid=false;this.reason='tracking';return this}this.last=f.now;let hand=this.source==='hand';
  if(hand){let dx=x-this.x,dy=y-this.y;if(Math.abs(dx)>.10||dy<-.028||dy>.25){this.valid=false;this.reason='withdrawal';return this}this.depth=clamp(dy/.042)}
  else{let dx=Number.isFinite(f.dragX)?f.dragX:x-this.x,dy=Number.isFinite(f.dragY)?f.dragY:y-this.y;/* Mouse contact stays locked for the whole left-button stroke. Physical mice can report coarse/high-DPI jumps and ordinary sideways drift, so neither cancels insertion. Deliberately dragging above the entry point still withdraws/cancels. */if(dy< -32){this.valid=false;this.reason='withdrawal';return this}this.depth=clamp(Math.max(0,dy)/28)}
  if(this.depth<.18)this.rearmed=true;return this}
}
class Interaction{
 constructor(api){this.a=api;this.tool='navigate';this.target=null;this.contact=null;this.candidate=null;this.pending=null;this.pressed=false;this.pointerHeld=false;this.pen=null;this.gripSince=null;this.openSince=null;this.stripNormal=null;this.rotationBase=null;this.handRotation=[0,0,0];this.inverted=false;this.taps=0;this.tapDone=false;this.lastFrame=null;this.grabbed=false;this.markerPalmBase=null;this.markerPalmDownSince=null;this.stats={cancelled:0,rejected:0,transfers:0};}
 get p(){return this.a.protocol()}
 resetMotion(reason=''){let had=!!this.pending;this.contact=null;this.candidate=null;this.pending=null;this.pressed=false;this.pointerHeld=false;this.pen=null;this.gripSince=null;this.openSince=null;this.rotationBase=null;this.lastFrame=null;if(had)this.stats.cancelled++;this.a.pose?.(this);if(reason)this.a.say?.(reason);this.a.update?.()}
 select(tool){this.resetMotion();this.a.park?.(this.tool);this.tool=tool;this.target=null;this.inverted=false;this.taps=0;this.tapDone=false;this.stripNormal=null;this.markerPalmBase=null;this.markerPalmDownSince=null;this.a.update?.();this.a.say?.(this.hint())}
 hint(){if(this.pending?.kind==='draw')return this.contact?.depth>=.85?'Tip immersed. Release the plunger to aspirate.':'Keep the plunger pressed and lower into the liquid.';if(this.contact&&['micro','wash'].includes(this.tool))return this.contact.depth>=.85?'Opening locked · tip immersed. Lift above entry height or move sideways to leave.':'Opening locked. Lower to insert; lift slightly or move sideways to leave.';
 if(this.tool==='marker')return'Make a short writing stroke across each well’s label pad. When finished, open the hand and turn the palm downward briefly to place the marker on the bench.';if(this.tool==='micro')return!this.p.tip?'Aim at the highlighted fresh tip, then lower to seat it.':this.p.tip.volume?'Aim at a well, lower the tip and press to dispense.':'Press, lower into the source, then release to aspirate 50 µL.';if(this.tool==='wash')return this.p.washVolume?'Lower over a well and squeeze to deliver wash buffer.':'Squeeze, lower into the beaker, then release to fill.';if(this.tool.startsWith('strip'))return this.p.phase==='mixstop'?'Keep upright. Lower and lift over towels four times.':'Invert the strip, then lower and lift over towels four times.';return'Pick up a tool from the bench or the dock. Mouse: right-drag rotates; wheel zooms.'}
 eligible(t){if(!t)return false;let tool=this.tool;if(tool==='navigate')return['tool','strip','timer'].includes(t.kind);if(t.id==='park')return true;if(tool==='marker')return t.kind==='label';if(tool.startsWith('strip'))return t.id==='towels'||t.id==='home'+tool.slice(-1);if(tool==='micro')return['reagent','well','waste','tips'].includes(t.kind);if(tool==='wash')return['wash','well'].includes(t.kind);return false}
 pick(f){return this.a.pick(f.x,f.y,t=>this.eligible(t))}
 canContact(t){return!!t&&(['micro','wash'].includes(this.tool)&&['reagent','well','wash','tips'].includes(t.kind)||this.tool.startsWith('strip')&&t.id==='towels')}
 setTarget(t){this.target=t;this.a.target?.(t)}
 tryCommit(action,source='mouse'){try{let copy=Object.create(Object.getPrototypeOf(this.p));Object.assign(copy,structuredClone(this.p));copy.dispatch(action);let result=this.p.dispatch(action);this.p.log[this.p.log.length-1].input=source;if(['aspirate','dispense','loadWash','wash'].includes(action.type))this.stats.transfers++;this.a.commit?.(action,result);this.a.update?.();return true}catch(e){this.stats.rejected++;this.a.say?.(e.message,true);return false}}
 lock(t,f){this.contact=new Contact(t,f);this.candidate=null;this.setTarget(t)}
 feed(f){if(!Number.isFinite(f.now))return;this.lastFrame=f;if(!this.contact&&f.source==='hand'&&f.thumbDown&&this.candidate&&f.now-this.candidate.frame.now<260&&Math.abs((f.rawX??0)-(this.candidate.frame.rawX??0))<.05){this.lock(this.candidate.target,this.candidate.frame)}let t=this.pick(f);if(this.contact){this.contact.update(f);if(!this.contact.valid){let pending=this.pending;this.contact=null;this.candidate=null;this.pending=null;if(pending){this.stats.cancelled++;this.pressed=false;this.a.say?.('Transfer cancelled: the tip left its opening. Relax and try again.',true)}this.setTarget(null);this.a.pose?.(this,f);return}t=this.contact.target}
 else if(f.source==='hand'&&f.ready&&this.canContact(t)){let old=this.candidate;if(!old||old.target.id!==t.id){this.candidate={target:t,frame:{...f},since:f.now}}else{if(Math.abs((f.rawX??f.x)-(old.frame.rawX??old.frame.x))>.026||Math.abs(f.palmY-old.frame.palmY)>.020){old.frame={...f};old.since=f.now}if(f.now-old.since>=160||f.thumbDown){this.lock(t,old.frame);this.contact.update(f)}}}else this.candidate=null;
 this.setTarget(t);
 if(f.source==='hand'&&f.ready){if(this.tool==='navigate'){if(!f.grip){this.gripSince=null;this.grabbed=false}if(f.grip&&t&&!this.grabbed){if(this.gripSince===null)this.gripSince=f.now;if(f.now-this.gripSince>260){this.activate(t,'hand');this.gripSince=null;this.grabbed=true}}else this.gripSince=null}else{if(!this.rotationBase&&f.rotation)this.rotationBase=[...f.rotation];if(f.rotation&&this.rotationBase)this.handRotation=f.rotation.map((v,i)=>Math.atan2(Math.sin(v-this.rotationBase[i]),Math.cos(v-this.rotationBase[i])));
 if(this.tool.startsWith('strip')&&f.normal){if(!this.stripNormal)this.stripNormal=[...f.normal];let turn=angle(f.normal,this.stripNormal);if(turn>1.92)this.inverted=true;else if(turn<1.05)this.inverted=false}
 if(this.tool==='marker'&&f.normal&&!this.markerPalmBase)this.markerPalmBase=[...f.normal];
 if(f.open&&!this.pressed&&!this.pending&&!this.contact){
  if(this.tool==='marker'){
   let n=f.normal,base=this.markerPalmBase,turn=n&&base?angle(n,base):0;
   /* Normalize palm-normal sign by handedness when possible. MediaPipe's
      cross-product normal reverses between left/right hands. The absolute-Y
      fallback keeps the deliberate palm-down gesture usable if handedness
      briefly flips while the hand is edge-on. */
   let handedSign=f.handName==='Left'?-1:1,down=n?n[1]*handedSign:0;
   let palmDown=!!(n&&turn>.72&&(down>.28||Math.abs(n[1])>.58));
   if(palmDown){
    if(this.markerPalmDownSince===null)this.markerPalmDownSince=f.now;
    if(f.now-this.markerPalmDownSince>420){
     this.a.say?.('Marker placed on the bench.');
     this.select('navigate');
     return;
    }
   }else this.markerPalmDownSince=null;
   this.openSince=null;
  }else{
   if(this.openSince===null)this.openSince=f.now;
   if(f.now-this.openSince>850){this.select('navigate');return}
  }
 }else{this.openSince=null;this.markerPalmDownSince=null;}
 if(t?.id==='park'&&f.grip&&!this.pending){if(this.gripSince===null)this.gripSince=f.now;if(f.now-this.gripSince>650){this.select('navigate');return}}else this.gripSince=null;
 if(this.tool==='marker'&&f.grip)this.write(t,f);else if(this.tool==='marker')this.pen=null;
 }}
 if(this.contact){let c=this.contact;if(this.tool==='micro'&&t?.id==='tips'&&!this.p.tip&&c.depth>=.95&&c.rearmed){c.rearmed=false;this.tryCommit({type:'attach'},f.source)}
 if(this.tool.startsWith('strip')&&t?.id==='towels'&&c.depth>=.95&&c.rearmed){c.rearmed=false;this.tap(f.source)}
 if(this.pending?.kind==='deliver'&&c.depth>=.55&&this.pressed){let a=this.pending.action;this.pending={kind:'spent'};this.tryCommit(a,f.source)}
 }
 if(f.source==='mouse'&&this.pointerHeld&&this.tool==='marker')this.write(t,f);
 this.a.pose?.(this,f);this.a.update?.();
 }
 write(t,f){if(t?.kind!=='label'){this.pen=null;return}let id=+t.id.slice(5);if(this.p.labels.includes(id))return;if(!this.pen||this.pen.id!==id)this.pen={id,x:f.x,y:f.y,d:0,path:[[f.x,f.y]]};let p=this.pen;p.d+=Math.hypot(f.x-p.x,f.y-p.y);p.x=f.x;p.y=f.y;p.path.push([f.x,f.y]);if(p.d>=7){if(this.tryCommit({type:'label',target:id},f.source))this.a.mark?.(id,p.path);this.pen=null}}
 activate(t,source){if(!t)return;if(t.kind==='tool')this.select({microtool:'micro',washtool:'wash',markertool:'marker'}[t.id]);else if(t.kind==='strip')this.select(t.id);else if(t.id==='park'||t.id==='home'+this.tool.slice(-1))this.select('navigate');else if(t.id==='timer')this.tryCommit({type:'incubate'},source)}
 press(f){if(this.pressed)return;if(this.tool==='navigate'){this.activate(this.target,f.source);return}if(this.target?.id==='park'||this.target?.kind==='home'){this.activate(this.target,f.source);return}if(!['micro','wash'].includes(this.tool))return;this.pressed=true;
 let t=this.contact?.target||this.target;if(!t)return;
 if(this.tool==='micro'&&t.id==='waste'){this.pending={kind:'spent'};this.tryCommit({type:this.p.tip?.volume?'discard':'eject',target:'waste'},f.source);return}
 if(this.tool==='micro'&&!this.p.tip){this.pending={kind:'spent'};return}
 if(!this.canContact(t)||t.kind==='tips'){this.pending={kind:'spent'};return}
 if(!this.contact)this.lock(t,this.candidate?.frame||f);
 let action;if(this.tool==='wash')action=t.id==='WASH'?{type:'loadWash',target:'WASH'}:t.kind==='well'?{type:'wash',target:t.id}:null;
 else action=this.p.tip?.volume?(t.kind==='well'?{type:'dispense',target:t.id}:null):{type:'aspirate',target:t.id};
 if(!action){this.pending={kind:'spent'};this.a.say?.('Choose a receiving well.',true);return}
 try{let copy=Object.create(Object.getPrototypeOf(this.p));Object.assign(copy,structuredClone(this.p));copy.dispatch(action)}catch(e){this.pending={kind:'spent'};this.a.say?.(e.message,true);return}
 let draw=['aspirate','loadWash'].includes(action.type);this.pending={kind:draw?'draw':'deliver',action};if(!draw&&this.contact.depth>=.55){this.pending={kind:'spent'};this.tryCommit(action,f.source)}this.a.pose?.(this,f);this.a.update?.();
 }
 release(f){let pending=this.pending;this.pending=null;this.pressed=false;if(pending?.kind==='draw'){if(this.contact?.valid&&this.contact.depth>=.85)this.tryCommit(pending.action,f.source);else{this.stats.cancelled++;this.a.say?.('Nothing drawn: lower the tip into the liquid before releasing.',true)}}else if(pending?.kind==='deliver')this.a.say?.('Nothing delivered: lower the tip into the receiving well.',true);this.a.pose?.(this,f);this.a.update?.()}
 mouseDown(f){this.feed(f);this.pointerHeld=true;if(this.tool==='marker'){this.write(this.target,f);return;}if(this.tool==='navigate'||this.target?.id==='park'||this.target?.kind==='home'){this.activate(this.target,'mouse');this.pointerHeld=false;return}if(this.canContact(this.target)&&!this.contact)this.lock(this.target,f);if(['micro','wash'].includes(this.tool)&&this.target?.kind!=='tips')this.press(f);this.a.pose?.(this,f)}
 mouseUp(f){if(this.pressed)this.release(f);this.pointerHeld=false;this.contact=null;this.pending=null;this.pen=null;this.a.pose?.(this,f);this.a.update?.()}
 secondary(){if(this.tool.startsWith('strip')){this.inverted=!this.inverted;this.a.pose?.(this,this.lastFrame);this.a.update?.()}else if(this.tool==='micro'&&this.target?.id==='waste'){this.tryCommit({type:'eject',target:'waste'},'mouse')}}
 tap(source){if(this.tapDone)return;let mix=this.p.phase==='mixstop';if(!mix&&!this.p.phase.startsWith('wash')){this.a.say?.('Strip tapping is not required at this step.',true);return}if(mix&&this.inverted||!mix&&!this.inverted){this.a.say?.(mix?'Keep the strip upright for final mixing.':'Invert the strip before draining.',true);return}this.taps++;if(this.taps>=4){if(this.tryCommit({type:mix?'mixStopStrip':'drainStrip',target:+this.tool.slice(-1)},source))this.tapDone=true;else this.taps=0}else this.a.say?.('Strip '+this.tool.slice(-1)+' · tap '+this.taps+' of 4.')}
}
root.ClassroomCore={clamp,sub,dot,norm,unit,cross,angle,AdaptiveFilter,PressGate,measureHand,thumbDepth,Contact,Interaction};if(typeof module!=='undefined'&&module.exports)module.exports=root.ClassroomCore;
})(globalThis);
