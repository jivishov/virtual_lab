const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const core=require('../hand-core.js');
const source=fs.readFileSync(require.resolve('../camera.js'),'utf8');
function fixture(getUserMedia,extra={}){
  const events={frames:[],edges:[],lost:0,status:[],cleared:0};
  const context=vm.createContext({ClassroomCore:{...core},performance,console,setTimeout,clearTimeout,setInterval,clearInterval,cancelAnimationFrame:()=>{},window:{},isSecureContext:true,navigator:{mediaDevices:{getUserMedia}},...extra});
  vm.runInContext(source,context);
  const video={pause(){},play:async()=>{},srcObject:null},overlay={width:640,height:480,getContext:()=>({clearRect:()=>events.cleared++})};
  const cam=new context.ClassroomWebcam({video,overlay,bounds:()=>({width:1000,height:700}),active:()=>{},status:s=>events.status.push(s),lost:()=>events.lost++,frame:f=>events.frames.push(f),edge:e=>events.edges.push(e),meter:()=>{}});
  cam.draw=()=>{};return {cam,context,events,video};
}
test('camera denial leaves mouse mode and no active stream or worker',async()=>{
  const {cam,events,video}=fixture(async()=>{throw Object.assign(new Error('denied'),{name:'NotAllowedError'});});
  await cam.start();assert.equal(cam.running,false);assert.equal(video.srcObject,null);assert.equal(cam.worker,null);
  assert.match(events.status.at(-1),/permission was denied/);assert.ok(events.cleared>0);
});
function skeleton(pressed=false){
  const coords=[[0,0,0],[.018,.008,0],[.037,.015,0],[.054,.013,0],[.066,.020,0],
    [.02,.045,0],[.02,.075,0],[.02,.063,-.01],[.02,.054,-.012],
    [0,.047,0],[0,.080,0],[0,.065,-.01],[0,.05,-.01],
    [-.016,.043,0],[-.016,.073,0],[-.016,.062,-.01],[-.016,.05,-.01],
    [-.031,.033,0],[-.031,.06,0],[-.031,.05,-.01],[-.031,.04,-.01]];
  if(pressed){coords[3]=[.05,.03,0];coords[4]=[.049,.047,.004];}
  return coords.map(([x,y,z])=>({x,y,z}));
}
function packet(stamp,{name='Right',pressed=false,dy=0,world=skeleton(pressed)}={}){
  return {stamp,inferenceMS:15,landmarks:[skeleton(pressed).map(p=>({x:.5+p.x*3,y:.45-p.y*3+dy,z:p.z*3}))],worldLandmarks:[world],handedness:[[{categoryName:name,score:.99}]]};
}
test('Auto calibration samples one hand and never substitutes image geometry',()=>{
  let now=0;const {cam}=fixture(undefined,{performance:{now:()=>now}});cam.running=true;cam.modelReady=true;
  cam.result(packet(now));cam.capture('rest');now=700;cam.result(packet(now));assert.equal(cam.captureState.samples.length,1);
  now=800;cam.result(packet(now,{name:'Left'}));assert.equal(cam.captureState.samples.length,1);
  now=900;cam.result(packet(now,{world:undefined})); // packet default intentionally provides valid world geometry
  const before=cam.captureState.samples.length;
  now=1000;const missing=packet(now);missing.worldLandmarks=[];cam.result(missing);assert.equal(cam.captureState.samples.length,before);
  for(now=1100;now<=1500;now+=100)cam.result(packet(now));cam.finishCapture();
  assert.equal(cam.calibrationHand,'Right');assert.ok(cam.profiles.rest);cam.stop();
});
test('actual landmark geometry, calibration, press gating and contact complete one transfer',()=>{
  const {Protocol}=require('../protocol.js'),{Interaction}=require('../interaction.js');
  let now=0;const {cam}=fixture(undefined,{performance:{now:()=>now}});
  const p=new Protocol();p.dispatch({type:'tapPlate'});p.dispatch({type:'prepare',label:'Hand regression',ppe:true});p.dispatch({type:'attach'});
  let target={id:'EB',kind:'reagent'};
  const interaction=new Interaction({protocol:()=>p,pick:()=>target});interaction.select('pipette');
  cam.o.frame=f=>interaction.feed(f);cam.o.edge=(edge,f)=>interaction[edge](f);cam.o.lost=()=>interaction.resetMotion();
  cam.running=true;cam.modelReady=true;
  cam.result(packet(now));cam.capture('rest');for(now=700;now<=1300;now+=100)cam.result(packet(now));cam.finishCapture();assert.ok(cam.profiles.rest);
  now=1500;cam.capture('press');for(now=2200;now<=2800;now+=100)cam.result(packet(now,{pressed:true}));cam.finishCapture();assert.equal(cam.calibrated,true);
  const send=(time,pressed=false,dy=0)=>{now=time;cam.result(packet(now,{pressed,dy}));};
  send(5000);send(5100);send(5230);send(5300,true);send(5370,true);send(5450,true,.046);send(5520,false,.046);send(5610,false,.046);
  assert.equal(p.tip.volume,5);assert.equal(p.reagents.EB,195);
  send(5680,false,-.05);target={id:'spot:A1',kind:'spot',sample:'A1'};
  for(let t=5750;t<=6250;t+=100)send(t); /* hover: the lock waits until the smoothed cursor has settled for 160 ms */
  send(6300,false,.046);send(6390,true,.046);send(6470,true,.046);send(6540,true,.046);send(6750,true,.046);
  assert.equal(p.spots.A1.volume,5);assert.equal(p.tip.volume,0);assert.equal(interaction.stats.transfers,2);assert.equal(p.balance(),0);cam.stop();
});
test('stale, future, repeated and out-of-order packets cannot produce gesture edges',()=>{
  let now=1000;const {cam,events}=fixture(undefined,{performance:{now:()=>now}});cam.running=true;
  cam.result(packet(1000));const n=events.frames.length;assert.equal(n,1);
  cam.result(packet(1000));cam.result(packet(999));cam.result(packet(1001));cam.result(packet(700));
  assert.equal(events.frames.length,n);assert.equal(events.edges.length,0);assert.equal(cam.stats.rejectedFrames,4);cam.stop();
});
test('calibration waits for a recent detected hand rather than consuming a cold-start timeout',()=>{
  let now=0;const {cam,events}=fixture(undefined,{performance:{now:()=>now}});cam.running=true;cam.modelReady=true;
  cam.capture('rest');assert.equal(cam.captureState,undefined);assert.match(events.status.at(-1),/tracking is stable/);
  cam.result(packet(now));now=core.HAND_GAP_MS+60;cam.capture('rest');assert.equal(cam.captureState,undefined);
  cam.result(packet(now));cam.capture('rest');assert.ok(cam.captureState);cam.stop();
});
test('cancelled worker initialization cannot terminate its replacement worker',async()=>{
  const workers=[],revoked=[];
  class Worker{constructor(){workers.push(this);this.terminated=false;}postMessage(){}terminate(){this.terminated=true;}}
  let seq=0;
  const {cam}=fixture(undefined,{Worker,Blob,URL:{createObjectURL:()=>`blob:${++seq}`,revokeObjectURL:url=>revoked.push(url)}});
  cam.sources=()=>[];cam.generation=1;
  const first=cam.startWorker(1).catch(e=>e);const cancel=cam.cancelInit;
  cam.generation=2;const second=cam.startWorker(2);cancel();await first;
  assert.equal(workers[0].terminated,true);assert.equal(workers[1].terminated,false);assert.equal(cam.worker,workers[1]);
  workers[1].onmessage({data:{type:'ready',backend:'test'}});await second;assert.equal(cam.worker,workers[1]);cam.stop();
});
test('late image capture failure from a stopped session leaves the new session intact',async()=>{
  let reject;const {cam}=fixture(undefined,{createImageBitmap:()=>new Promise((_,r)=>reject=r)});
  cam.running=true;cam.generation=1;cam.worker={postMessage(){},terminate(){}};cam.video.readyState=2;cam.video.currentTime=1;
  const pending=cam.frame(1);cam.stop();cam.running=true;cam.generation=3;cam.busy=true;cam.errors=0;
  const nextWorker={terminate(){}};cam.worker=nextWorker;reject(Error('old bitmap failed'));await pending;
  assert.equal(cam.worker,nextWorker);assert.equal(cam.running,true);assert.equal(cam.busy,true);assert.equal(cam.errors,0);cam.stop();
});
test('stopping while camera permission is pending closes a late-arriving stream',async()=>{
  let resolve,stopped=0;const {cam,video}=fixture(()=>new Promise(r=>resolve=r));
  const pending=cam.start();cam.stop();resolve({getTracks:()=>[{stop:()=>stopped++}]});await pending;
  assert.equal(stopped,1);assert.equal(cam.running,false);assert.equal(video.srcObject,null);assert.equal(cam.worker,null);
});
test('a calibrated Auto hand cannot silently transfer control to the other hand',()=>{
  let now=1000;const {cam,context,events}=fixture(undefined,{performance:{now:()=>now}});
  context.ClassroomCore.measureHand=()=>({features:Array(7).fill(.1),palmX:.5,palmY:.5,grip:true,open:false,normal:[0,0,1],rotation:[0,0,0]});
  cam.running=true;cam.profiles={rest:Array(7).fill(0),press:Array(7).fill(1)};cam.calibrationHand='Right';cam.lastSeen=now;
  const packet=(name,stamp=now)=>({stamp,inferenceMS:12,landmarks:[Array.from({length:21},()=>({x:.5,y:.5,z:0}))],worldLandmarks:[Array.from({length:21},()=>({x:.05,y:.05,z:0}))],handedness:[[{categoryName:name,score:.99}]]});
  cam.result(packet('Left'));assert.equal(events.frames.length,0);now=1030;cam.result(packet('Right'));assert.equal(events.frames.length,1);assert.equal(events.frames[0].handName,'Right');
  now=1060;cam.result(packet('Right',now-2000));assert.equal(events.frames.length,1);assert.equal(events.edges.length,0);
  // Stale packets and the other hand count as missed detections; control is released once no usable frame arrives within the gap limit.
  now=1030+core.HAND_GAP_MS+10;cam.result(packet('Left'));assert.equal(events.frames.length,1);assert.equal(events.edges.length,0);assert.ok(events.lost>=1);
});
function pinchPacket(stamp,{pinched=false,dy=0,dx=0}={}){
  const world=skeleton();if(pinched)world[4]={x:.024,y:.052,z:-.01}; // thumb tip touching the index tip
  return {stamp,inferenceMS:15,landmarks:[world.map(p=>({x:.5+p.x*3+dx,y:.45-p.y*3+dy,z:p.z*3}))],worldLandmarks:[world],handedness:[[{categoryName:'Right',score:.99}]]};
}
test('pinch mode needs no calibration: hover to lock, pinch, lower, release draws exactly 5 µL',()=>{
  const {Protocol}=require('../protocol.js'),{Interaction}=require('../interaction.js');
  let now=0;const {cam}=fixture(undefined,{performance:{now:()=>now}});cam.mode='pinch';
  const p=new Protocol();p.dispatch({type:'tapPlate'});p.dispatch({type:'prepare',label:'Pinch',ppe:true});p.dispatch({type:'attach'});
  const target={id:'EB',kind:'reagent'},interaction=new Interaction({protocol:()=>p,pick:()=>target});interaction.select('pipette');
  const frames=[];cam.o.frame=f=>{frames.push(f);interaction.feed(f);};cam.o.edge=(edge,f)=>interaction[edge](f);cam.o.lost=()=>interaction.resetMotion();
  cam.running=true;cam.modelReady=true;assert.equal(cam.calibrated,true);
  const send=(time,o)=>{now=time;cam.result(pinchPacket(now,o));};
  for(let t=0;t<=240;t+=60)send(t);                       // steady hover arms the pinch gate and locks the target
  assert.ok(interaction.contact,'target locked after a short hover');
  send(300,{pinched:true});send(380,{pinched:true});       // pinch = plunger pressed
  assert.equal(interaction.pending?.kind,'draw');
  send(440,{pinched:true,dy:.046});send(500,{dy:.046});send(590,{dy:.046}); // lower into the liquid, then let go
  assert.equal(p.tip.volume,5);assert.equal(p.reagents.EB,195);assert.equal(p.balance(),0);
  assert.ok(frames.every(f=>f.ready&&f.grip&&!f.open),'pinch mode never reports an uncertain thumb pose');
  cam.stop();
});
test('pinch mode sets a home position and cursor gain changes travel, never the palm coordinates',()=>{
  let now=0;const {cam,context}=fixture(undefined,{performance:{now:()=>now}});cam.mode='pinch';cam.running=true;cam.modelReady=true;
  const frames=[];cam.o.frame=f=>frames.push(f);
  for(let i=0;i<22;i++){now=i*40;cam.result(pinchPacket(now));}
  assert.ok(cam.home,'home set automatically after steady tracking');
  const travel=gain=>{context.ClassroomHandTuning={get:()=>({gain,smoothing:0}),filterParams:()=>({minCutoff:50,beta:0})};cam.fx.reset();cam.fy.reset();
    now+=40;cam.result(pinchPacket(now,{dx:.05}));now+=40;cam.result(pinchPacket(now,{dx:.05}));const f=frames.at(-1);return {x:f.x,rawX:f.rawX,palmY:f.palmY};};
  const slow=travel(1.5),fast=travel(3);
  assert.ok(Math.abs(fast.x-500)>Math.abs(slow.x-500)*1.6,'higher gain moves the cursor further from the centre');
  assert.equal(slow.rawX,fast.rawX);assert.equal(slow.palmY,fast.palmY);
  cam.stop();
});

test('a file:// page loads the hand tracker from pinned HTTPS copies; a served page uses only the bundled copy',()=>{
  const {cam:file}=fixture(undefined,{location:{protocol:'file:'},document:{baseURI:'file:///C:/lab/microarray.html'}});
  const remote=file.sources();assert.equal(remote.length,2);
  for(const s of remote)for(const url of [s.bundle,s.wasm,s.model])assert.match(url,/^https:\/\//);
  assert.match(remote[1].bundle,/tasks-vision@0\.10\.17\//);
  const {cam:served}=fixture(undefined,{URL,location:{protocol:'http:'},document:{baseURI:'http://127.0.0.1:8766/microarray.html'}});
  const local=served.sources();assert.equal(local.length,1);
  for(const url of [local[0].bundle,local[0].wasm,local[0].model])assert.ok(url.startsWith('http://127.0.0.1:8766/vendor/mediapipe/'),url);
});
