/* 3D adapter for the existing app's MediaPipe approach.
   Wrist/thumb geometry below is adapted from js/pipette-control.js, blob
   09610b10f3ec4678530a6c9d1f30aae34ce2d2c3. Inference uses the same pinned
   MediaPipe 0.10.17 local-first assets and one-in-flight worker design.
   No physical pipette identification, force measurement or medical inference. */
(function(root){'use strict';
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>Math.hypot(...a),unit=a=>a.map(v=>v/(norm(a)||1e-8)),distance=(a,b)=>Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0)/a.length),median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
function measure(world){if(!world||world.length!==21||!world.slice(0,5).every(p=>p&&[p.x,p.y,p.z].every(Number.isFinite)))return null;let p=world.map(v=>v?[v.x,v.y,v.z]:null),bones=[norm(sub(p[2],p[1])),norm(sub(p[3],p[2])),norm(sub(p[4],p[3]))],scale=bones.reduce((s,v)=>s+v,0);if(scale<.015||scale>.25||bones.some(v=>v/scale<.12||v/scale>.62))return null;let base=norm(sub(p[1],p[0]));if(base/scale<.12||base/scale>1.6)return null;let thumb=[];[3,4].forEach(i=>[0,1,2].forEach(j=>thumb.push(norm(sub(p[i],p[j]))/scale)));let axis=unit(sub(p[2],p[1])),rise=2*(.75*dot(sub(p[4],p[2]),axis)+.25*dot(sub(p[3],p[2]),axis))/(bones[1]+bones[2]);return{thumb,rise,shape:bones.map(v=>v/scale).concat(base/scale)}}
class GestureGate{
 constructor(){this.reset()}
 reset(){this.active=false;this.armed=false;this.restSince=null;this.pressSince=null;this.last=null;this.ejectActive=false;this.ejectSince=null}
 update(depth,eject,now,valid=true){let edges=[];if(!valid||!Number.isFinite(depth)||(this.last!==null&&now-this.last>220)){this.reset();if(!valid)return edges}this.last=now;if(eject){this.restSince=null;this.pressSince=null;if(this.ejectSince===null)this.ejectSince=now;if(now-this.ejectSince>=130&&!this.ejectActive&&this.armed){edges.push('eject');this.ejectActive=true;this.armed=false}return edges}this.ejectSince=null;
 if(depth<.28){this.pressSince=null;if(this.restSince===null)this.restSince=now;if(now-this.restSince>=130){if(this.active)edges.push('release');this.active=false;this.armed=true;this.ejectActive=false}}
 else if(depth>.62){this.restSince=null;if(this.pressSince===null)this.pressSince=now;if(this.armed&&!this.active&&now-this.pressSince>=110){this.active=true;this.armed=false;edges.push('press')}}else{this.pressSince=null;this.restSince=null}return edges}
}
function sources(base,protocol){
 const local={bundle:new URL('vendor/mediapipe/vision_bundle.mjs',base).href,wasm:new URL('vendor/mediapipe/wasm',base).href,model:new URL('vendor/mediapipe/models/hand_landmarker.task',base).href,name:'repository'};
 const cdn={bundle:'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/vision_bundle.mjs',wasm:'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm',model:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',name:'pinned CDN'};
 return protocol==='file:'?[{...local,bundle:'https://jivishov.github.io/virtual_lab/experiments/elisa_assay/vendor/mediapipe/vision_bundle.mjs',wasm:'https://jivishov.github.io/virtual_lab/experiments/elisa_assay/vendor/mediapipe/wasm',model:'https://jivishov.github.io/virtual_lab/experiments/elisa_assay/vendor/mediapipe/models/hand_landmarker.task'},cdn]:[local,cdn];
}
function workerMain(){let detector=null;self.onmessage=async e=>{const m=e.data;
 if(m.type==='init'){let errors=[];for(const source of m.sources){for(const delegate of ['GPU','CPU']){try{const mp=await import(source.bundle),fs=await mp.FilesetResolver.forVisionTasks(source.wasm);detector=await mp.HandLandmarker.createFromOptions(fs,{baseOptions:{modelAssetPath:source.model,delegate},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.55,minHandPresenceConfidence:.55,minTrackingConfidence:.55,canvas:new OffscreenCanvas(640,480)});self.postMessage({type:'ready',backend:source.name+' / '+delegate+' worker'});return}catch(err){errors.push(String(err.message||err));}}}self.postMessage({type:'error',message:errors.join(' | ')});return}
 if(m.type==='frame'){try{const out=detector.detectForVideo(m.bitmap,m.stamp);self.postMessage({type:'result',stamp:m.stamp,landmarks:out.landmarks,worldLandmarks:out.worldLandmarks,handedness:out.handedness})}catch(err){self.postMessage({type:'frame-error',message:String(err.message)})}finally{m.bitmap.close()}}
};}
function cameraMessage(e){const messages={NotAllowedError:'Camera permission was blocked. Open the deployed page in its own HTTPS tab and allow Camera in site permissions. Embedded previews may block camera access.',NotFoundError:'No camera was found. Connect or enable a webcam, then try again.',NotReadableError:'The camera could not be opened. Close other apps using it and check your operating-system camera permissions.',SecurityError:'This page is not allowed to use the camera. Open the deployed HTTPS page directly.',OverconstrainedError:'The camera could not satisfy the requested settings. Try another camera or browser.'};return messages[e?.name]||String(e?.message||e);}
class HandInput{
 constructor(options){this.opt=options;this.video=options.video;this.canvas=options.overlay;this.gate=new GestureGate();this.profiles={};this.modeProfiles={free:this.profiles,real:{}};this.running=false;this.mode='free';this.captureState=null;this.lastSeen=0;this.lastMeasure=null;this.smooth=null;this.generation=0;this.detector=null;this.diagnostics=[];this.inFlight=false;document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop()});}
 say(t){this.opt.status(t)}
 setMode(mode){if(!['free','real'].includes(mode))return;this.modeProfiles[this.mode]=this.profiles;this.mode=mode;this.profiles=this.modeProfiles[mode]||{};this.captureState=null;this.cancelStroke();this.opt.calibrated?.(Object.keys(this.profiles));this.say('Mode: '+(mode==='free'?'free hand':'real micropipette')+'. '+(this.profiles.press?'Calibration restored; relax the thumb before continuing.':'Capture Rest and Press for this mode.'));}
 async start(){if(this.running)return;const gen=++this.generation;this.running=true;this.opt.active?.(true);this.say('Requesting camera permission…');
  try{
   if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('Camera access requires a secure page. Open the deployed 3D page in a top-level HTTPS tab, not an embedded preview.');
   const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
   if(gen!==this.generation){stream.getTracks().forEach(t=>t.stop());return}this.stream=stream;this.video.srcObject=stream;
   await this.video.play();if(gen!==this.generation)return;
   for(const track of stream.getVideoTracks())track.addEventListener('ended',()=>{if(gen===this.generation){this.stop();this.say('The camera was disconnected or permission was withdrawn.')}});
   this.say('Camera connected. Loading the local hand model…');
   const plans=sources(new URL('.',document.baseURI),location.protocol);
   this.diagnostics=[];
   if(window.Worker&&window.OffscreenCanvas&&window.createImageBitmap){try{await this.loadWorker(plans,gen)}catch(e){this.diagnostics.push('Worker: '+e.message);this.disposeWorker();if(gen!==this.generation)return;this.say('Trying the browser-compatible hand-tracking fallback…');}}
   if(!this.worker){await this.loadMain(plans,gen)}
   if(gen!==this.generation)return;
   this.lastSeen=performance.now();this.lastFrameTime=-1;this.frameErrors=0;this.gate.reset();
   this.say('Camera ready · '+this.backend+'. Capture Rest and Press; then grip a tool to pick it up.');
   this.loop=setInterval(()=>this.frame(),80);
  }catch(e){if(gen!==this.generation)return;this.stop();this.say(cameraMessage(e));}
 }
 async loadWorker(plans,gen){
  this.workerURL=URL.createObjectURL(new Blob(['('+workerMain.toString()+')()'],{type:'text/javascript'}));
  // Classic worker deliberately: the Wasm loader may call importScripts,
  // which is forbidden in module workers. The bundle itself is dynamic ESM.
  const worker=this.worker=new Worker(this.workerURL);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Worker model initialization timed out.')),18000);this.loadCancel=()=>{clearTimeout(timer);reject(Error('Camera startup cancelled.'))};worker.onmessage=e=>{if(gen!==this.generation)return;if(e.data.type==='ready'){clearTimeout(timer);this.loadCancel=null;this.backend=e.data.backend;resolve()}else if(e.data.type==='error'){clearTimeout(timer);this.loadCancel=null;reject(Error(e.data.message))}};worker.onerror=e=>{clearTimeout(timer);this.loadCancel=null;reject(Error(e.message||'Worker initialization failed.'))};worker.postMessage({type:'init',sources:plans});});
  if(gen!==this.generation)return;
  worker.onmessage=e=>{if(gen!==this.generation)return;this.inFlight=false;if(e.data.type==='result'){this.frameErrors=0;this.result(e.data)}else this.frameError(e.data.message)};
  worker.onerror=e=>{if(gen!==this.generation)return;this.stop();this.say('Hand tracking stopped: '+(e.message||'worker error')+'. Restart the camera; mouse control remains available.');};
 }
 async loadMain(plans,gen){let last;
  for(const source of plans){for(const delegate of ['GPU','CPU']){if(gen!==this.generation)return;
   let expired=false;const create=(async()=>{const mp=await import(source.bundle),fs=await mp.FilesetResolver.forVisionTasks(source.wasm);return mp.HandLandmarker.createFromOptions(fs,{baseOptions:{modelAssetPath:source.model,delegate},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.55,minHandPresenceConfidence:.55,minTrackingConfidence:.55});})();
   const guarded=create.then(det=>{if(expired||gen!==this.generation){det.close();throw Error('Retired model initialization.')}return det});let timer;
   try{const detector=await Promise.race([guarded,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('Model initialization timed out.'))},15000)})]);clearTimeout(timer);if(gen!==this.generation){detector.close();return}this.detector=detector;this.backend=source.name+' / '+delegate+' compatibility mode';return}
   catch(e){clearTimeout(timer);expired=true;last=e;this.diagnostics.push(source.name+' / '+delegate+': '+e.message);}
  }}throw Error('The camera connected but the hand model could not load. Check that the repository’s vendor/mediapipe files are reachable. '+(last?.message||''));
 }
 frameError(message){this.cancelStroke();this.opt.lost?.();this.frameErrors=(this.frameErrors||0)+1;if(this.frameErrors>=4){this.stop();this.say('Hand tracking could not process camera frames. '+message)}else this.say('Tracking paused; no action committed. Hold the hand in view.');}
 async frame(){if(!this.running)return;
  if(performance.now()-this.lastSeen>300){this.cancelStroke();this.opt.lost?.()}
  if(this.inFlight||this.video.readyState<2||this.video.currentTime===this.lastFrameTime)return;
  this.lastFrameTime=this.video.currentTime;this.inFlight=true;const gen=this.generation,stamp=performance.now();
  try{if(this.worker){let bitmap=await createImageBitmap(this.video);if(gen!==this.generation||!this.worker){bitmap.close();return}this.worker.postMessage({type:'frame',bitmap,stamp},[bitmap]);}
   else if(this.detector){const out=this.detector.detectForVideo(this.video,stamp);this.inFlight=false;this.result({...out,stamp});}
  }catch(e){this.inFlight=false;if(gen===this.generation)this.frameError(e.message)}
 }
 disposeWorker(){this.worker?.terminate();this.worker=null;if(this.workerURL)URL.revokeObjectURL(this.workerURL);this.workerURL=null;}
 stop(){this.generation++;this.running=false;this.loadCancel?.();this.loadCancel=null;clearInterval(this.loop);this.loop=null;this.disposeWorker();try{this.detector?.close()}catch(e){this.diagnostics.push('Close: '+e.message)}this.detector=null;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.pause?.();this.video.srcObject=null;this.captureState=null;this.inFlight=false;this.smooth=null;this.lastHand=null;this.cancelStroke();this.opt.active?.(false);this.opt.lost?.();}
 cancelStroke(){this.gate.reset();this.opt.cancel?.()}
 capture(kind){if(!['rest','press','eject'].includes(kind))return;if(!this.running){this.say('Start the camera before calibrating.');return}this.captureState={kind,start:performance.now()+1300,end:performance.now()+3700,samples:[]};this.cancelStroke();this.say('Get ready: hold '+{rest:'your relaxed thumb in a pipette grip',press:'the thumb plunger press',eject:'the separate ejector press'}[kind]+'. Keep the thumb visible and gently vary your working angle.');}
 finishCapture(){let c=this.captureState;this.captureState=null;if(c.samples.length<8){this.say('Too few reliable thumb readings. Keep thumb and wrist visible and capture again.');return}
  let profile={thumb:Array.from({length:6},(_,i)=>median(c.samples.map(s=>s.thumb[i]))),shape:Array.from({length:4},(_,i)=>median(c.samples.map(s=>s.shape[i]))),rise:median(c.samples.map(s=>s.rise))};profile.noise=median(c.samples.map(s=>distance(s.thumb,profile.thumb)));profile.riseNoise=median(c.samples.map(s=>Math.abs(s.rise-profile.rise)));
  if(profile.noise>.10){this.say('That pose varied too much. Hold a single thumb depth and try smaller wrist turns.');return}
  if(c.kind!=='rest'&&!this.profiles.rest){this.say('Capture the resting pose first.');return}
  if(c.kind!=='rest'&&distance(profile.thumb,this.profiles.rest.thumb)<Math.max(.02,profile.noise*3)&&Math.abs(profile.rise-this.profiles.rest.rise)<.06){this.say('The press is not distinct from rest. Make a clearer thumb movement and capture again.');return}
  if(c.kind==='eject'&&this.profiles.press&&distance(profile.thumb,this.profiles.press.thumb)<.035){this.say('The ejector pose overlaps the plunger pose. Capture the separate movement more clearly.');return}
  if(c.kind==='rest')this.profiles={};this.profiles[c.kind]=profile;this.modeProfiles[this.mode]=this.profiles;this.cancelStroke();this.say('Captured '+c.kind+'. '+(this.profiles.press?'Relax the thumb; close your grip over a tool to pick it up.':'Now capture the pressed thumb.'));this.opt.calibrated?.(Object.keys(this.profiles));
 }
 result(data){let now=performance.now(),lm=data.landmarks?.[0],world=data.worldLandmarks?.[0],m=measure(world);let ctx=this.canvas.getContext('2d');ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
  if((Number.isFinite(data.stamp)&&now-data.stamp>350)||!lm||!m){if(now-this.lastSeen>220){this.cancelStroke();this.opt.lost?.()}return}
  let handedness=data.handedness?.[0]?.[0]?.categoryName;if(this.lastHand&&handedness&&this.lastHand!==handedness){this.cancelStroke();this.smooth=null;}this.lastHand=handedness;
  if(now-this.lastSeen>220)this.cancelStroke();this.lastSeen=now;this.lastMeasure=m;
  ctx.strokeStyle='#70dbcd';ctx.lineWidth=2;for(let chain of[[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]]){ctx.beginPath();chain.forEach((i,n)=>{let x=(1-lm[i].x)*this.canvas.width,y=lm[i].y*this.canvas.height;n?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}
  if(this.captureState){let c=this.captureState;if(now>=c.start&&now<=c.end)c.samples.push(m);if(now>c.end)this.finishCapture();return}
  let rest=this.profiles.rest,press=this.profiles.press,ready=!!(rest&&press);
  const palmX=(lm[0].x+lm[1].x)/2,palmY=(lm[0].y+lm[1].y)/2;
  let raw=[Math.max(0,Math.min(1,(1-palmX-.16)/.68)),Math.max(0,Math.min(1,(palmY-.13)/.75))];
  this.smooth=this.smooth?this.smooth.map((v,i)=>v+(raw[i]-v)*.38):raw;
  if(ready&&distance(m.shape,rest.shape)>.22){this.cancelStroke();return}
  let extended=0,folded=0;
  for(const [base,pip,tip] of [[5,6,8],[9,10,12],[13,14,16],[17,18,20]]){if(![0,base,pip,tip].every(i=>world[i]&&[world[i].x,world[i].y,world[i].z].every(Number.isFinite)))continue;let pt=i=>[world[i].x,world[i].y,world[i].z],dp=norm(sub(pt(pip),pt(0))),dt=norm(sub(pt(tip),pt(0)));if(dt>dp*1.27)extended++;if(dt<dp*1.12)folded++;}
  const scale=Math.max(.03,Math.hypot(lm[9].x-lm[0].x,lm[9].y-lm[0].y)),pinch=Math.hypot(lm[4].x-lm[8].x,lm[4].y-lm[8].y)<scale*.38;
  this.opt.pose?.({x:this.smooth[0],y:this.smooth[1],palmY,grip:ready&&(folded>=2||pinch),open:ready&&extended>=3&&!pinch,roll:Math.atan2(lm[1].y-lm[0].y,lm[1].x-lm[0].x),now});
  this.opt.aim?.(this.smooth[0],this.smooth[1]);
  if(!ready)return;
  if(distance(m.shape,rest.shape)>.22){this.cancelStroke();return}
  let vector=sub(press.thumb,rest.thumb),delta=sub(m.thumb,rest.thumb),depth=dot(delta,vector)/Math.max(1e-6,dot(vector,vector)),residual=distance(delta,vector.map(v=>v*depth)),travel=distance(press.thumb,rest.thumb);
  let isEject=this.mode==='real'&&this.profiles.eject&&distance(m.thumb,this.profiles.eject.thumb)<Math.max(.025,travel*.45)&&distance(m.thumb,this.profiles.eject.thumb)<distance(m.thumb,press.thumb)*.65;
  let valid=residual<Math.max(.05,travel*.6,(rest.noise||0)*3)||isEject;
  // Free-hand bends are evaluated relative to the THUMB BASE, not the knuckle
  // row or only tip-to-wrist distance. Translation/rotation do not define press.
  if(this.mode==='free'&&Math.abs(press.rise-rest.rise)>.06){depth=(m.rise-rest.rise)/(press.rise-rest.rise);valid=Number.isFinite(depth)&&depth>-.8&&depth<2.3;}
  if(!valid){this.cancelStroke();return}
  this.opt.depth?.(Math.max(0,Math.min(1,depth)));
  for(let e of this.gate.update(depth,isEject,now,valid))this.opt.edge(e);
 }
}
root.ELISAHands={measure,GestureGate,HandInput,VerticalSources:sources,cameraMessage};if(typeof module!=='undefined'&&module.exports)module.exports=root.ELISAHands;
})(globalThis);
