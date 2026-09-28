/* Shared, deterministic interaction core. No camera/DOM dependency in these classes. */
(function(root){'use strict';
/* Longest tracking gap a gesture survives. MediaPipe routinely drops a few frames during quick moves or on slower CPU inference; no gesture edge is produced during a gap. */
const HAND_GAP_MS=400;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const sub=(a,b)=>a.map((v,i)=>v-b[i]), dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0), norm=a=>Math.hypot(...a), unit=a=>a.map(v=>v/(norm(a)||1e-9));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], angle=(a,b)=>Math.acos(clamp(dot(unit(a),unit(b)),-1,1));
class AdaptiveFilter{
 constructor(){this.reset()}
 reset(){this.value=null;this.raw=null;this.time=null;this.speed=0}
 update(x,t){if(!Number.isFinite(x)||!Number.isFinite(t))return this.value;if(this.value===null||t-this.time>300||t<=this.time){this.value=x;this.raw=x;this.time=t;this.speed=0;return x}let dt=clamp((t-this.time)/1000,.005,.15),v=(x-this.raw)/dt;this.speed+=.4*(v-this.speed);let cutoff=1.9+4.0*Math.abs(this.speed),a=1/(1+1/(2*Math.PI*cutoff*dt));this.value+=a*(x-this.value);this.raw=x;this.time=t;return this.value}
}
class OneEuro{
 constructor(minCutoff=1.2,beta=6,dCutoff=1.2){this.minCutoff=minCutoff;this.beta=beta;this.dCutoff=dCutoff;this.reset()}
 reset(){this.x=null;this.dx=0;this.t=null}
 alpha(cutoff,dt){const tau=1/(2*Math.PI*cutoff);return 1/(1+tau/dt)}
 update(x,t){if(!Number.isFinite(x)||!Number.isFinite(t))return this.x;if(this.x===null||t<=this.t||t-this.t>300){this.x=x;this.dx=0;this.t=t;return x}const dt=clamp((t-this.t)/1000,.004,.2),d=(x-this.x)/dt;this.dx+=this.alpha(this.dCutoff,dt)*(d-this.dx);const cutoff=this.minCutoff+this.beta*Math.abs(this.dx);this.x+=this.alpha(cutoff,dt)*(x-this.x);this.t=t;return this.x}
}
/* Plunger edges from a 0..1 press depth. The bands leave a dead middle so a hovering thumb cannot chatter. */
class PressGate{
 constructor(bands={}){this.rest=bands.rest??.28;this.press=bands.press??.65;this.reset()}
 reset(){this.active=false;this.armed=false;this.since=null;this.last=null;this.band=null}
 update(depth,now,valid=true){if(!valid||!Number.isFinite(depth)||!Number.isFinite(now)||(this.last!==null&&(now-this.last>HAND_GAP_MS||now<this.last))){this.reset();if(!valid||!Number.isFinite(depth)||!Number.isFinite(now))return null}this.last=now;let band=depth<this.rest?'rest':depth>this.press?'press':'middle';if(band!==this.band){this.band=band;this.since=now}if(band==='rest'&&now-this.since>=75){let was=this.active;this.active=false;this.armed=true;return was?'release':null}if(band==='press'&&now-this.since>=65&&this.armed&&!this.active){this.active=true;this.armed=false;return'press'}return null}
}
function measureHand(world,lm){if(!world||world.length!==21||!lm||lm.length!==21)return null;const finite=i=>world[i]&&[world[i].x,world[i].y,world[i].z].every(Number.isFinite);if(![0,1,2,3,4,5,9,17].every(finite))return null;let p=world.map(v=>v?[v.x,v.y,v.z]:[0,0,0]),bones=[norm(sub(p[2],p[1])),norm(sub(p[3],p[2])),norm(sub(p[4],p[3]))],scale=bones.reduce((a,b)=>a+b,0);if(scale<.015||scale>.25||bones.some(v=>v/scale<.10||v/scale>.65))return null;
 let features=[];for(let i of[3,4])for(let j of[0,1,2])features.push(norm(sub(p[i],p[j]))/scale);let axis=unit(sub(p[2],p[1]));features.push(2*(.75*dot(sub(p[4],p[2]),axis)+.25*dot(sub(p[3],p[2]),axis))/(bones[1]+bones[2]));let palmAxis=unit(sub(p[9],p[0])),across=unit(sub(p[5],p[17])),normal=unit(cross(across,palmAxis));
 let extended=0,folded=0;for(let [base,pip,tip]of[[5,6,8],[9,10,12],[13,14,16],[17,18,20]]){if(![base,pip,tip].every(finite))continue;let dp=norm(sub(p[pip],p[0])),dt=norm(sub(p[tip],p[0]));if(dt>dp*1.27)extended++;if(dt<dp*1.12)folded++}let pinchRatio=norm(sub(p[4],p[8]))/Math.max(.015,norm(sub(p[5],p[17]))),pinch=pinchRatio<.40;
 /* The palm point uses the wrist and the index/pinky knuckles only, so thumb movement never shifts it. */
 return{features,shape:bones.map(v=>v/scale),normal,axis:palmAxis,grip:folded>=2||pinch,open:extended>=3&&!pinch,pinch,pinchRatio,extended,palmX:(lm[0].x+lm[5].x+lm[17].x)/3,palmY:(lm[0].y+lm[5].y+lm[17].y)/3,rotation:[Math.atan2(palmAxis[2],-palmAxis[1]),Math.atan2(normal[0],normal[2]),Math.atan2(palmAxis[0],-palmAxis[1])]}}
function thumbDepth(features,rest,press){if(!rest||!press)return{depth:0,valid:false};let d=sub(press,rest),v=sub(features,rest),den=dot(d,d);if(den<.0004)return{depth:0,valid:false};let depth=dot(v,d)/den,err=norm(sub(v,d.map(v=>v*depth)))/Math.sqrt(d.length);return{depth,valid:Number.isFinite(depth)&&depth>-.7&&depth<2&&err<Math.max(.11,Math.sqrt(den/d.length)*.8)}}
/* Hand exits, in normalized camera units measured from the locked palm position. The camera sees roughly an arm's-length
   width, so .01 is about 6 mm of hand travel. An unsupported, extended arm sways by several millimetres and trembles, so
   the limits are generous, and the controller acts only when an exit lasts (HAND_AIM.exitMS) or is clearly deliberate
   (twice the limit). Contact only reports a possible exit; it never ends itself for a hand. */
const HAND_EXIT={travel:.042,lift:-.03,backUp:.012,sideShallow:.03,sideDeep:.05,overshoot:.07,deep:.25};
class Contact{
 constructor(t,f){this.target=t;this.x=f.rawX??f.x;this.y=f.palmY??f.y;this.cx=f.x;this.cy=f.y;this.last=f.now;this.source=f.source;this.depth=0;this.inserted=false;this.valid=true;this.reason='';this.rearmed=true}
 /* holding: a plunger stroke is bound to this target, so deeper travel is tolerated instead of being treated as moving on. */
 update(f,holding=false){let x=f.rawX??f.x,y=f.palmY??f.y;if(![x,y,f.now].every(Number.isFinite)||f.now<this.last||(this.source==='hand'&&f.now-this.last>HAND_GAP_MS)){this.valid=false;this.reason='tracking';return this}this.last=f.now;let hand=this.source==='hand';
  if(hand){/* Leave by lifting above the lock height, lifting back up after inserting, moving well to the side, or travelling far past the insertion depth with no stroke bound. */
   const L=HAND_EXIT,dx=x-this.x,dy=y-this.y,side=Math.abs(dx);this.depth=clamp(dy/L.travel);if(this.depth>=.85)this.inserted=true;
   const sideLimit=this.depth>=.35?L.sideDeep:L.sideShallow;let exit=null,far=false;
   if(dy<L.lift){exit='withdrawal';far=dy<2*L.lift}
   else if(this.inserted&&dy<L.backUp){exit='withdrawal';far=dy<L.lift/2}
   else if(side>sideLimit){exit='slide';far=side>2*sideLimit}
   else if(dy>(holding?L.deep:L.overshoot)){exit='overshoot';far=true}
   this.exit=exit;this.far=far}
  else{let dx=Number.isFinite(f.dragX)?f.dragX:x-this.x,dy=Number.isFinite(f.dragY)?f.dragY:y-this.y;/* Mouse contact stays locked for the whole left-button stroke. Physical mice can report coarse/high-DPI jumps and ordinary sideways drift, so neither cancels insertion. Deliberately dragging above the entry point still withdraws/cancels. */if(dy< -32){this.valid=false;this.reason='withdrawal';return this}this.depth=clamp(Math.max(0,dy)/28)}
  if(this.depth<.18)this.rearmed=true;return this}
}
root.ClassroomCore={HAND_GAP_MS,HAND_EXIT,clamp,sub,dot,norm,unit,cross,angle,AdaptiveFilter,OneEuro,PressGate,measureHand,thumbDepth,Contact};if(typeof module!=='undefined')module.exports=root.ClassroomCore;
})(globalThis);

