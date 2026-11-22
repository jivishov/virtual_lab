/* Local MediaPipe inference transport, adapted from the supplied ELISA camera lifecycle.
 * No gesture classification, frame storage, uploads or automatic camera start. */
const FRAME_INTERVAL_MS=32,STALE_MS=600,WORKER_TIMEOUT_MS=18000,FRAME_TIMEOUT_MS=8000;
const FIRST_FRAME_TIMEOUT_MS=30000;
const SLOW_FRAME_MS=260;
export const HELD_FRAME_LIMIT_MS=1500;
const aborted=()=>Object.assign(new Error('Camera startup cancelled.'),{name:'AbortError'});
const closeDetector=detector=>{try{detector?.close()}catch{/* Disposal must not prevent camera-track cleanup. */}};
const stopStream=stream=>{for(const track of stream?.getTracks?.()||[]){try{track.stop()}catch{/* Continue closing the other tracks. */}}};

export function localSources(){
 const base=new URL('../vendor/mediapipe/',import.meta.url);
 return {bundle:new URL('vision_bundle.mjs',base).href,wasm:new URL('wasm',base).href,model:new URL('models/hand_landmarker.task',base).href};
}

export async function createDetector({offscreen=false,signal}={},runtime={}){
 const source=localSources(),load=runtime.importModule||(url=>import(url)),Canvas=runtime.OffscreenCanvas||globalThis.OffscreenCanvas;
 if(signal?.aborted)throw aborted();
 const mp=await load(source.bundle);if(signal?.aborted)throw aborted();
 const files=await mp.FilesetResolver.forVisionTasks(source.wasm);if(signal?.aborted)throw aborted();
 const errors=[];
 for(const delegate of ['GPU','CPU']){
  let detector;
  try{
   const options={baseOptions:{modelAssetPath:source.model,delegate},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.55,minHandPresenceConfidence:.55,minTrackingConfidence:.6};
   if(offscreen&&Canvas)options.canvas=new Canvas(640,480);
   detector=await mp.HandLandmarker.createFromOptions(files,options);
   if(signal?.aborted){closeDetector(detector);throw aborted()}
   return {detector,backend:`Local MediaPipe / ${delegate}`};
  }catch(error){
   if(signal?.aborted||error?.name==='AbortError')throw aborted();
   closeDetector(detector);errors.push(`${delegate}: ${String(error?.message||error).slice(0,200)}`);
  }
 }
 throw new Error(`Local hand tracking could not initialize. ${errors.join(' | ')}`);
}

function platformDefaults(){
 return {secureContext:globalThis.isSecureContext===true,mediaDevices:globalThis.navigator?.mediaDevices,
  Worker:globalThis.Worker,OffscreenCanvas:globalThis.OffscreenCanvas,createImageBitmap:globalThis.createImageBitmap?.bind(globalThis),
  requestAnimationFrame:globalThis.requestAnimationFrame?.bind(globalThis),cancelAnimationFrame:globalThis.cancelAnimationFrame?.bind(globalThis),
  setTimeout:globalThis.setTimeout.bind(globalThis),clearTimeout:globalThis.clearTimeout.bind(globalThis),
  setInterval:globalThis.setInterval.bind(globalThis),clearInterval:globalThis.clearInterval.bind(globalThis),
  now:()=>performance.now(),document:globalThis.document,window:globalThis.window,detectorFactory:createDetector};
}

export class HandCamera {
 constructor({video,source=null,frameSource=null,onFrame=()=>{},onStatus=()=>{},onActive=()=>{},onLost=()=>{},onDelay=null}={},platform={}){
  if(!video)throw new Error('A camera preview video is required.');
  this.source=source;this.video=video;this.frameSource=frameSource;this.callbacks={onFrame,onStatus,onActive,onLost,onDelay};this.p={...platformDefaults(),...platform};
  this.running=false;this.modelReady=false;this.generation=0;this.worker=null;this.detector=null;this.stream=null;this.backend='';
  this.busy=false;this.inFlight=null;this.frameID=0;this.lastVideoTime=-1;this.lastSubmit=-Infinity;this.lastPacket=-Infinity;
  this.lastReceived=0;this.lostSent=false;this.errors=0;this.vfc=null;this.raf=null;this.monitor=null;this.abort=null;this.startPromise=null;this.trackListeners=[];
  this.sourceChanged=()=>{
   if(!this.running||!this.stream)return;
   const next=this.source?.video?.srcObject;
   if(!this.source.owners.has('hands')||!next){this.stop();return}
   if(next===this.stream)return;
   this.lost('device-change');this.stream=next;this.video.srcObject=next;
   this.inFlight=null;this.busy=false;this.lastVideoTime=-1;this.lastSubmit=-Infinity;
   this.video.play().catch(()=>{if(this.stream===next){this.stop();this.status('The new camera could not start.',true)}});
  };
  this.source?.addEventListener('change',this.sourceChanged);
  this.onVisibility=()=>{if(this.p.document?.hidden&&this.running){this.stop();this.status('Camera off while this tab is hidden. Start it again when you return.')}};
  this.onPageHide=()=>this.stop();
  this.p.document?.addEventListener('visibilitychange',this.onVisibility);
  this.p.window?.addEventListener('pagehide',this.onPageHide);
 }
 status(message,error=false){
  if(this.lastStatus===message&&this.lastStatusError===error)return;
  this.lastStatus=message;this.lastStatusError=error;this.callbacks.onStatus(message,error);
 }
 current(gen){return this.running&&gen===this.generation}
 async start(){
  if(this.running)return this.startPromise||this.modelReady;
  this.running=true;this.modelReady=false;const gen=++this.generation;
  this.abort=new AbortController();const signal=this.abort.signal;
  this.callbacks.onActive(true);this.status('Opening camera…');
  const operation=this.startGeneration(gen,signal);this.startPromise=operation;
  try{return await operation}finally{if(this.startPromise===operation)this.startPromise=null}
 }
 async startGeneration(gen,signal){
  try{
   if(!this.p.secureContext||!this.p.mediaDevices?.getUserMedia)throw new Error('Camera access needs localhost or a secure website.');
   if(this.p.document?.hidden)throw new Error('Keep this tab visible when starting the camera.');
   const stream=this.source?(await this.source.use('hands')).srcObject:await this.p.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30},facingMode:'user'},audio:false});
   if(!this.current(gen)){if(!this.source)stopStream(stream);return false}
   this.stream=stream;this.video.muted=true;this.video.playsInline=true;this.video.srcObject=stream;
   const tracks=stream.getVideoTracks();if(!tracks.length)throw new Error('The camera did not provide a video track.');
   for(const track of tracks){
    const ended=()=>{if(this.current(gen)&&this.stream===stream){this.stop();this.status('Camera disconnected. Start it again or use the mouse controls.',true)}};
    const muted=()=>{if(this.current(gen))this.lost('camera-muted')};
    track.addEventListener('ended',ended);track.addEventListener('mute',muted);this.trackListeners.push({track,ended,muted});
   }
   await this.video.play();if(!this.current(gen))return false;
   this.status('Loading hand tracking on this device…');
   if(this.p.Worker&&this.p.OffscreenCanvas&&this.p.createImageBitmap){
    try{await this.startWorker(gen,signal)}catch(error){if(!this.current(gen)||signal.aborted)return false;this.status('Preparing compatible hand tracking…')}
   }
   if(!this.worker){
    const out=await this.p.detectorFactory({offscreen:false,signal});
    if(!this.current(gen)){closeDetector(out.detector);return false}
    this.detector=out.detector;this.backend=`${out.backend} / main thread`;
   }
   if(!this.current(gen))return false;
   this.modelReady=true;this.lastVideoTime=-1;this.lastSubmit=-Infinity;this.lastPacket=-Infinity;this.lastReceived=this.p.now();this.errors=0;this.lostSent=false;
   this.status('Show an open palm.');
   this.monitor=this.p.setInterval(()=>this.checkHealth(gen),100);this.schedule(gen);return true;
  }catch(error){
   if(!this.current(gen))return false;
   this.stop();
   const messages={NotAllowedError:'Camera permission was denied. Allow camera access or use the mouse controls.',NotFoundError:'No camera was found. Mouse controls are available.',NotReadableError:'The camera is busy. Close other camera apps and try again.',OverconstrainedError:'This camera cannot use the requested settings. Try another camera.'};
   this.status(messages[error?.name]||`Hand tracking could not start. ${String(error?.message||error).slice(0,240)}`,true);return false;
  }
 }
 async startWorker(gen,signal){
  // Classic worker is intentional: the inherited MediaPipe WASM loader uses importScripts.
  const worker=new this.p.Worker(new URL('./hand-worker.js',import.meta.url));this.worker=worker;
  try{
   await new Promise((resolve,reject)=>{
    let settled=false;
    const finish=error=>{if(settled)return;settled=true;this.p.clearTimeout(timer);signal.removeEventListener('abort',cancel);worker.onmessage=worker.onerror=worker.onmessageerror=null;error?reject(error):resolve()};
    const cancel=()=>finish(aborted()),timer=this.p.setTimeout(()=>finish(new Error('Hand tracker initialization timed out.')),WORKER_TIMEOUT_MS);
    signal.addEventListener('abort',cancel,{once:true});
    worker.onerror=()=>finish(new Error('The background hand tracker could not load.'));
    worker.onmessageerror=()=>finish(new Error('The background hand tracker could not initialize.'));
    worker.onmessage=event=>{const data=event.data;if(!this.current(gen)||data.generation!==gen)return;if(data.type==='ready'){this.backend=`${data.backend} / worker`;finish()}else if(data.type==='error')finish(new Error(data.message||'Hand tracker initialization failed.'))};
    if(signal.aborted)cancel();else worker.postMessage({type:'init',generation:gen});
   });
   if(!this.current(gen)){worker.terminate();return}
   worker.onmessage=event=>this.workerResult(event.data,worker,gen);
   worker.onerror=()=>{if(this.current(gen)&&this.worker===worker){this.stop();this.status('Hand tracking stopped unexpectedly. Start the camera again.',true)}};
   worker.onmessageerror=()=>{if(this.current(gen)&&this.worker===worker)this.processingError(gen)};
  }catch(error){worker.terminate();if(this.worker===worker)this.worker=null;throw error}
 }
 schedule(gen){
  if(!this.current(gen)||!this.modelReady)return;
  const callback=()=>{this.vfc=this.raf=null;if(!this.current(gen))return;this.schedule(gen);void this.frame(gen)};
  if(this.video.requestVideoFrameCallback)this.vfc=this.video.requestVideoFrameCallback(callback);
  else this.raf=this.p.requestAnimationFrame(callback);
 }
 async frame(gen){
  const now=this.p.now();
  if(!this.current(gen)||!this.modelReady||this.busy||this.video.readyState<2||this.video.currentTime===this.lastVideoTime||now-this.lastSubmit<FRAME_INTERVAL_MS)return;
  this.lastVideoTime=this.video.currentTime;this.lastSubmit=now;this.busy=true;
  const requestId=++this.frameID;const worker=this.worker;
  try{
   // Keep the captured exposure until its result arrives so the contour and
   // displayed webcam pixels correspond to the same instant.
   const exposure=this.frameSource?.(this.video,now)||null,input=exposure?.detectorImage||exposure?.image||this.video;
   this.inFlight={requestId,stamp:now,exposure};
   if(worker){
    const bitmap=await this.p.createImageBitmap(input);
    if(!this.current(gen)||this.worker!==worker){bitmap.close();return}
    try{worker.postMessage({type:'frame',generation:gen,requestId,stamp:now,bitmap},[bitmap])}catch(error){bitmap.close();throw error}
   }else{
    const started=this.p.now(),result=this.detector.detectForVideo(input,now);
    if(!this.current(gen))return;
    this.busy=false;this.inFlight=null;this.accept({...result,stamp:now,inferenceMS:this.p.now()-started,exposure},gen);
   }
  }catch{this.processingError(gen)}
 }
 workerResult(data,worker,gen){
  if(!this.current(gen)||this.worker!==worker||data.generation!==gen||!this.inFlight||data.requestId!==this.inFlight.requestId)return;
  const exposure=this.inFlight.exposure;this.busy=false;this.inFlight=null;
  if(data.type==='result')this.accept({...data,exposure},gen);else this.processingError(gen);
 }
 accept(data,gen){
  if(!this.current(gen))return;
  const now=this.p.now(),age=now-data.stamp;
  if(!Number.isFinite(data.stamp)||age<0||data.stamp<=this.lastPacket){this.lost('invalid-frame');return}
  if(age>STALE_MS){if(!this.holdDelayedFrame(now))this.lost('invalid-frame');return}
  if(this.lastPacket!==-Infinity&&now-this.lastReceived>SLOW_FRAME_MS)this.holdDelayedFrame(now);
  if(this.lastPacket===-Infinity)this.status('Camera ready. Tracking locally.');
  this.lastPacket=data.stamp;this.lastReceived=now;this.errors=0;this.lostSent=false;
  const crop=data.exposure?.crop;
  let landmarks=data.landmarks||[];
  // Consumers use full sensor coordinates for matching, contour, mirror and
  // bench projection. MediaPipe normalizes z to the input image's width.
  if(crop&&data.exposure.detectorImage)landmarks=landmarks.map(hand=>hand.map(p=>({...p,x:crop.left+p.x*crop.width,y:crop.top+p.y*crop.height,z:(p.z??0)*crop.width})));
  this.callbacks.onFrame({landmarks,worldLandmarks:data.worldLandmarks||[],handedness:data.handedness||[],stamp:data.stamp,inferenceMS:Number.isFinite(data.inferenceMS)?data.inferenceMS:0,
   frame:data.exposure?.image||null,crop:crop||null,frameRevision:data.exposure?.revision});
 }
 lost(reason){if(!this.lostSent){this.lostSent=true;this.callbacks.onLost({reason,stamp:this.p.now()})}}
 holdDelayedFrame(now){
  return !this.lostSent&&this.lastPacket!==-Infinity&&now-this.lastReceived<HELD_FRAME_LIMIT_MS&&this.callbacks.onDelay?.()===true;
 }
 checkHealth(gen){
  if(!this.current(gen)||!this.modelReady)return;const now=this.p.now();
  // A cold GPU can spend several seconds compiling the first inference.
  // Only a fresh frame ends warm-up. Subsequent exposures use the normal watchdog.
  const warmingUp=this.lastPacket===-Infinity;
  if(!warmingUp&&now-this.lastReceived>SLOW_FRAME_MS){
   const holding=this.holdDelayedFrame(now);
   if(now-this.lastReceived>STALE_MS&&!holding)this.lost('stale-frames');
  }
  // Hidden setup video can present callbacks slowly even as the source advances.
  if(!this.busy&&now-this.lastSubmit>=100&&this.video.currentTime!==this.lastVideoTime)void this.frame(gen);
  const timedOut=warmingUp?now-this.lastReceived>FIRST_FRAME_TIMEOUT_MS:
   this.inFlight&&now-this.inFlight.stamp>FRAME_TIMEOUT_MS;
  if(timedOut){this.stop();this.status('Hand tracking stopped responding. Start the camera again.',true)}
 }
 processingError(gen){
  if(!this.current(gen))return;this.busy=false;this.inFlight=null;this.lost('processing-error');
  if(++this.errors>=3){this.stop();this.status('Hand tracking could not process the camera. Start it again or use mouse controls.',true)}
 }
 stop(){
  this.running=false;this.modelReady=false;this.generation++;
  this.abort?.abort();this.abort=null;
  if(this.monitor!==null)this.p.clearInterval(this.monitor);this.monitor=null;
  if(this.vfc!==null)this.video.cancelVideoFrameCallback?.(this.vfc);
  if(this.raf!==null)this.p.cancelAnimationFrame?.(this.raf);this.vfc=this.raf=null;
  for(const {track,ended,muted} of this.trackListeners){track.removeEventListener('ended',ended);track.removeEventListener('mute',muted)}this.trackListeners=[];
  const worker=this.worker;this.worker=null;if(worker){worker.onmessage=worker.onerror=worker.onmessageerror=null;worker.terminate()}
  const detector=this.detector;this.detector=null;closeDetector(detector);
  const stream=this.stream;this.stream=null;if(this.source)this.source.release('hands');else stopStream(stream);this.video.pause?.();this.video.srcObject=null;
  this.busy=false;this.inFlight=null;this.lastPacket=-Infinity;this.lastVideoTime=-1;this.lostSent=false;this.lost('stopped');
  this.callbacks.onActive(false);this.status('Camera off. Video stays on this device.');
 }
 destroy(){this.stop();this.source?.removeEventListener('change',this.sourceChanged);this.p.document?.removeEventListener('visibilitychange',this.onVisibility);this.p.window?.removeEventListener('pagehide',this.onPageHide)}
}
