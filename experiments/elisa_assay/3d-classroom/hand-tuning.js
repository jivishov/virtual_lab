(function(root){'use strict';
const Webcam=root.ClassroomWebcam;if(!Webcam)return;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const STORE='elisa3d-hand-tuning-v1';
let settings={sensitivity:.70,reactivity:.50};
try{const saved=JSON.parse(localStorage.getItem(STORE)||'null');if(saved){settings.sensitivity=clamp(Number(saved.sensitivity)||.70,.45,1.25);settings.reactivity=clamp(Number(saved.reactivity)||.50,.20,1)}}catch{}
function save(){try{localStorage.setItem(STORE,JSON.stringify(settings))}catch{}}
function bind(){const s=document.getElementById('handSensitivity'),r=document.getElementById('handReactivity'),so=document.getElementById('handSensitivityValue'),ro=document.getElementById('handReactivityValue');if(!s||!r)return;s.value=Math.round(settings.sensitivity*100);r.value=Math.round(settings.reactivity*100);const paint=()=>{if(so)so.value=so.textContent=s.value+'%';if(ro)ro.value=ro.textContent=r.value+'%'};paint();s.addEventListener('input',()=>{settings.sensitivity=clamp(+s.value/100,.45,1.25);paint();save()});r.addEventListener('input',()=>{settings.reactivity=clamp(+r.value/100,.20,1);paint();save()})}
function tune(cam,frame){if(!frame||frame.source!=='hand'||!Number.isFinite(frame.rawX)||!Number.isFinite(frame.palmY))return frame;const sens=settings.sensitivity,react=settings.reactivity;let rx=.5+(frame.rawX-.5)*sens,ry=.5+(frame.palmY-.5)*sens;rx=clamp(rx,-.15,1.15);ry=clamp(ry,-.15,1.15);if(!Number.isFinite(cam.__tuneX)||!Number.isFinite(cam.__tuneY)){cam.__tuneX=rx;cam.__tuneY=ry}else{const dead=.0015+(1-react)*.0105,alpha=.08+react*.68,dx=rx-cam.__tuneX,dy=ry-cam.__tuneY;if(Math.abs(dx)>dead)cam.__tuneX+=dx*alpha;if(Math.abs(dy)>dead)cam.__tuneY+=dy*alpha}const b=cam.o.bounds();frame.rawX=cam.__tuneX;frame.palmY=cam.__tuneY;frame.x=clamp((cam.__tuneX-.13)/.74)*b.width;frame.y=clamp((cam.__tuneY-.10)/.78)*b.height;return frame}
const result=Webcam.prototype.result;Webcam.prototype.result=function(data){const forward=this.o.frame;this.o.frame=frame=>forward(tune(this,frame));try{return result.call(this,data)}finally{this.o.frame=forward}};
for(const name of['lost','stop','setPreference']){const old=Webcam.prototype[name];if(typeof old==='function')Webcam.prototype[name]=function(...args){this.__tuneX=this.__tuneY=null;return old.apply(this,args)}}
root.ClassroomHandTuning={get:()=>({...settings}),set:(s,r)=>{if(Number.isFinite(s))settings.sensitivity=clamp(s,.45,1.25);if(Number.isFinite(r))settings.reactivity=clamp(r,.20,1);save()}};
bind();
})(globalThis);
