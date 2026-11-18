import test from 'node:test';
import assert from 'node:assert/strict';
import {HandCamera,createDetector,localSources} from '../src/hand-camera.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Track extends EventTarget{stops=0;stop(){this.stops++}}
const stream=()=>{const track=new Track();return{track,getTracks:()=>[track],getVideoTracks:()=>[track]}};
function fixture(overrides={}){
 const clock={now:100},timers=new Map(),frames=new Map(),document=new EventTarget(),window=new EventTarget();let serial=0;
 document.hidden=false;
 const video={readyState:2,currentTime:1,srcObject:null,plays:0,pauses:0,play(){this.plays++;return Promise.resolve()},pause(){this.pauses++},requestVideoFrameCallback(cb){const id=++serial;frames.set(id,cb);return id},cancelVideoFrameCallback(id){frames.delete(id)}};
 const source=stream(),calls=[],packets=[],statuses=[],active=[],lost=[];
 const detector={closed:0,detectForVideo:()=>({landmarks:[],worldLandmarks:[],handedness:[]}),close(){this.closed++}};
 const platform={secureContext:true,mediaDevices:{getUserMedia:async options=>{calls.push(options);return source}},Worker:undefined,OffscreenCanvas:undefined,createImageBitmap:undefined,
  setTimeout:cb=>{const id=++serial;timers.set(id,cb);return id},clearTimeout:id=>timers.delete(id),setInterval:cb=>{const id=++serial;timers.set(id,cb);return id},clearInterval:id=>timers.delete(id),
  requestAnimationFrame:cb=>{const id=++serial;frames.set(id,cb);return id},cancelAnimationFrame:id=>frames.delete(id),now:()=>clock.now,document,window,detectorFactory:async()=>({detector,backend:'fixture / CPU'}),...overrides};
 const camera=new HandCamera({video,onFrame:p=>packets.push(p),onStatus:(text,error)=>statuses.push({text,error}),onActive:v=>active.push(v),onLost:p=>lost.push(p)},platform);
 return{camera,clock,timers,frames,document,window,video,source,calls,packets,statuses,active,lost,detector,platform};
}
function workerFactory(mode='ready'){
 const instances=[];
 class Worker{
  posts=[];terminated=0;
  constructor(url){this.url=String(url);instances.push(this)}
  postMessage(message){this.posts.push(message);if(message.type==='init')queueMicrotask(()=>this.emit({type:mode,generation:message.generation,backend:'fixture / GPU',message:'fixture load failure'}))}
  emit(data){this.onmessage?.({data})}
  terminate(){this.terminated++}
 }
 return{Worker,instances};
}

test('constructor stays idle; explicit start requests video without audio and stop disposes resources',async()=>{
 const f=fixture();assert.equal(f.calls.length,0);assert.equal(f.camera.running,false);
 assert.equal(await f.camera.start(),true);assert.equal(f.calls.length,1);assert.equal(f.calls[0].audio,false);assert.equal(f.camera.modelReady,true);
 assert.equal(await f.camera.start(),true);assert.equal(f.calls.length,1);
 f.camera.stop();assert.equal(f.source.track.stops,1);assert.equal(f.detector.closed,1);assert.equal(f.video.srcObject,null);assert.equal(f.camera.running,false);
 assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);assert.deepEqual(f.active,[true,false]);f.camera.destroy();
});

test('late permission result is stopped without replacing a newer camera session',async()=>{
 const first=deferred(),second=deferred();let n=0;
 const f=fixture({mediaDevices:{getUserMedia:()=>++n===1?first.promise:second.promise}}),old=stream(),fresh=stream();
 const a=f.camera.start();f.camera.stop();const b=f.camera.start();second.resolve(fresh);assert.equal(await b,true);
 first.resolve(old);assert.equal(await a,false);assert.equal(old.track.stops,1);assert.equal(fresh.track.stops,0);assert.equal(f.video.srcObject,fresh);
 f.camera.destroy();assert.equal(fresh.track.stops,1);
});

test('stop while video.play is pending does not initialize a detector later',async()=>{
 const pending=deferred();let detectorCalls=0;const f=fixture({detectorFactory:async()=>{detectorCalls++;return{detector:{close(){}},backend:'fixture'}}});
 f.video.play=()=>pending.promise;const started=f.camera.start();await tick();f.camera.stop();pending.resolve();
 assert.equal(await started,false);assert.equal(detectorCalls,0);assert.equal(f.source.track.stops,1);f.camera.destroy();
});

test('late detector completion is closed after stop',async()=>{
 const pending=deferred(),late={closed:0,close(){this.closed++}},f=fixture({detectorFactory:()=>pending.promise});
 const started=f.camera.start();await tick();f.camera.stop();pending.resolve({detector:late,backend:'fixture'});
 assert.equal(await started,false);assert.equal(late.closed,1);assert.equal(f.camera.detector,null);assert.equal(f.camera.modelReady,false);f.camera.destroy();
});

test('permission denial reports a failure and leaves no running session',async()=>{
 const f=fixture({mediaDevices:{getUserMedia:async()=>{throw Object.assign(new Error('denied'),{name:'NotAllowedError'})}}});
 assert.equal(await f.camera.start(),false);assert.equal(f.camera.running,false);assert.match(f.statuses.at(-1).text,/permission was denied/);assert.equal(f.statuses.at(-1).error,true);f.camera.destroy();
});

test('hidden tabs and insecure origins do not request camera permission',async()=>{
 const f=fixture();f.document.hidden=true;assert.equal(await f.camera.start(),false);assert.equal(f.calls.length,0);f.camera.destroy();
 const g=fixture({secureContext:false});assert.equal(await g.camera.start(),false);assert.equal(g.calls.length,0);g.camera.destroy();
});

test('detector uses local assets, VIDEO mode and GPU to CPU fallback',async()=>{
 const delegates=[],fake={close(){}};
 const out=await createDetector({offscreen:true},{OffscreenCanvas:class{},importModule:async url=>{
  assert.equal(url,localSources().bundle);
  return{FilesetResolver:{forVisionTasks:async path=>{assert.equal(path,localSources().wasm);return{}}},HandLandmarker:{createFromOptions:async(files,options)=>{
   delegates.push(options.baseOptions.delegate);assert.equal(options.baseOptions.modelAssetPath,localSources().model);assert.equal(options.runningMode,'VIDEO');assert.equal(options.numHands,2);assert.ok(options.canvas);
   if(options.baseOptions.delegate==='GPU')throw Error('GPU unavailable');return fake;
  }}};
 }});
 assert.deepEqual(delegates,['GPU','CPU']);assert.equal(out.detector,fake);assert.match(out.backend,/CPU/);
});

test('aborting detector creation closes the late-created detector',async()=>{
 const pending=deferred(),abort=new AbortController(),fake={closed:0,close(){this.closed++}};
 const creating=createDetector({signal:abort.signal},{importModule:async()=>({FilesetResolver:{forVisionTasks:async()=>({})},HandLandmarker:{createFromOptions:()=>pending.promise}})});
 await tick();abort.abort();pending.resolve(fake);await assert.rejects(creating,{name:'AbortError'});assert.equal(fake.closed,1);
});

test('transport rejects stale, duplicate, future and post-stop packets',async()=>{
 const f=fixture();await f.camera.start();const gen=f.camera.generation,packet={stamp:100,landmarks:[],worldLandmarks:[],handedness:[],inferenceMS:4};
 f.camera.accept(packet,gen);assert.equal(f.packets.length,1);
 f.camera.accept(packet,gen);f.camera.accept({...packet,stamp:101},gen);assert.equal(f.packets.length,1);assert.equal(f.lost.at(-1).reason,'invalid-frame');
 f.clock.now=1000;f.camera.accept({...packet,stamp:102},gen);assert.equal(f.packets.length,1);
 f.camera.accept({...packet,stamp:1000},gen);assert.equal(f.packets.length,2);
 f.camera.stop();f.camera.accept({...packet,stamp:1001},gen);assert.equal(f.packets.length,2);f.camera.destroy();
});

test('worker inference has backpressure and matches responses to their request',async()=>{
 const pool=workerFactory(),f=fixture({Worker:pool.Worker,OffscreenCanvas:class{},createImageBitmap:async()=>({close(){}})});
 await f.camera.start();const worker=pool.instances[0],gen=f.camera.generation;
 await f.camera.frame(gen);assert.equal(worker.posts.filter(p=>p.type==='frame').length,1);assert.equal(f.camera.busy,true);
 f.video.currentTime=2;f.clock.now=150;await f.camera.frame(gen);assert.equal(worker.posts.filter(p=>p.type==='frame').length,1);
 const request=worker.posts.at(-1);worker.emit({type:'result',generation:gen,requestId:request.requestId-1,stamp:100});assert.equal(f.camera.busy,true);
 worker.emit({type:'result',generation:gen,requestId:request.requestId,stamp:100,landmarks:[],worldLandmarks:[],handedness:[]});assert.equal(f.camera.busy,false);assert.equal(f.packets.length,1);
 await f.camera.frame(gen);assert.equal(worker.posts.filter(p=>p.type==='frame').length,2);const next=worker.posts.at(-1);
 worker.emit({type:'result',generation:gen,requestId:request.requestId,stamp:100});assert.equal(f.camera.busy,true);
 f.clock.now=900;worker.emit({type:'result',generation:gen,requestId:next.requestId,stamp:150});assert.equal(f.camera.busy,false);assert.equal(f.packets.length,1);
 assert.equal(f.lost.at(-1).reason,'invalid-frame','A stale response invalidates intent immediately');f.camera.checkHealth(gen);assert.equal(f.lost.at(-1).reason,'invalid-frame');f.camera.destroy();assert.ok(worker.terminated>=1);
});

test('late bitmap after stop is closed and never transferred',async()=>{
 const bitmap=deferred(),image={closed:0,close(){this.closed++}},pool=workerFactory(),f=fixture({Worker:pool.Worker,OffscreenCanvas:class{},createImageBitmap:()=>bitmap.promise});
 await f.camera.start();const processing=f.camera.frame(f.camera.generation);f.camera.stop();bitmap.resolve(image);await processing;
 assert.equal(image.closed,1);assert.equal(pool.instances[0].posts.filter(p=>p.type==='frame').length,0);assert.equal(f.packets.length,0);f.camera.destroy();
});

test('worker initialization failure disposes the worker and uses the main-thread detector',async()=>{
 const pool=workerFactory('error'),f=fixture({Worker:pool.Worker,OffscreenCanvas:class{},createImageBitmap:async()=>({close(){}})});
 assert.equal(await f.camera.start(),true);assert.equal(f.camera.worker,null);assert.equal(f.camera.detector,f.detector);assert.ok(pool.instances[0].terminated>=1);assert.match(f.camera.backend,/main thread/);f.camera.destroy();
});

test('stop during worker initialization cancels startup and terminates its worker',async()=>{
 const pool=workerFactory('never-ready'),f=fixture({Worker:pool.Worker,OffscreenCanvas:class{},createImageBitmap:async()=>({close(){}})});
 const started=f.camera.start();await tick();f.camera.stop();assert.equal(await started,false);assert.ok(pool.instances[0].terminated>=1);assert.equal(f.timers.size,0);f.camera.destroy();
});

test('visibility hide, page leave and device disconnect stop the camera',async()=>{
 for(const cause of ['hidden','pagehide','ended']){
  const f=fixture();await f.camera.start();
  if(cause==='hidden'){f.document.hidden=true;f.document.dispatchEvent(new Event('visibilitychange'))}
  if(cause==='pagehide')f.window.dispatchEvent(new Event('pagehide'));
  if(cause==='ended')f.source.track.dispatchEvent(new Event('ended'));
  assert.equal(f.camera.running,false,cause);assert.equal(f.source.track.stops,1,cause);assert.equal(f.detector.closed,1,cause);assert.equal(f.video.srcObject,null,cause);f.camera.destroy();
 }
});

test('unresponsive worker watchdog closes camera resources',async()=>{
 const pool=workerFactory(),f=fixture({Worker:pool.Worker,OffscreenCanvas:class{},createImageBitmap:async()=>({close(){}})});
 await f.camera.start();const gen=f.camera.generation;await f.camera.frame(gen);f.clock.now=8200;f.camera.checkHealth(gen);
 assert.equal(f.camera.running,false);assert.equal(f.source.track.stops,1);assert.match(f.statuses.at(-1).text,/stopped responding/);f.camera.destroy();
});

test('main-thread inference and outline receive the same cropped exposure',async()=>{
 const f=fixture(),image={width:640,height:360},crop={left:.1,top:.2,width:.8,height:.6};
 f.camera.frameSource=()=>({image,crop,revision:7});
 f.detector.detectForVideo=(input,stamp)=>{assert.equal(input,image);assert.equal(stamp,100);return {landmarks:[]}};
 await f.camera.start();await f.camera.frame(f.camera.generation);
 assert.equal(f.packets[0].frame,image);assert.deepEqual(f.packets[0].crop,crop);assert.equal(f.packets[0].frameRevision,7);f.camera.destroy();
});

test('worker retains the submitted exposure and crop until its matching response',async()=>{
 const image={width:640,height:360},crop={left:.15,top:.1,width:.7,height:.5},pool=workerFactory();
 const f=fixture({Worker:pool.Worker,OffscreenCanvas:class{},createImageBitmap:async input=>{assert.equal(input,image);return {close(){}}}});
 let captures=0;f.camera.frameSource=()=>{captures++;return {image,crop,revision:12}};
 await f.camera.start();await f.camera.frame(f.camera.generation);
 f.video.currentTime=2;f.clock.now=150;await f.camera.frame(f.camera.generation);assert.equal(captures,1);
 const worker=pool.instances[0],request=worker.posts.at(-1);
 worker.emit({type:'result',generation:f.camera.generation,requestId:request.requestId,stamp:100,landmarks:[]});
 assert.equal(f.packets[0].frame,image);assert.deepEqual(f.packets[0].crop,crop);assert.equal(f.packets[0].frameRevision,12);f.camera.destroy();
});
