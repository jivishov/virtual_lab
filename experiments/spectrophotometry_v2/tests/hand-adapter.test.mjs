import {pipetteIds,isPipette} from '../src/pipettes.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,getStep,notebookDecision,setStatus,totalVolume} from '../src/model.js';
import {classifyHand} from '../src/grasp-core.js';
import {landmarkPacket} from './hand-landmark-fixtures.js';
import {b06Packet,combinePackets} from './b06-landmark-fixtures.js';
import {createDirectHandTrace} from './browser-direct-hand-traces.js';
import {createB06HandTrace} from './browser-b06-hand-traces.js';
import {CUVETTE} from '../assets/cuvette-dimensions.js';

globalThis.E3D={};
const {Manipulation}=await import('../src/manipulation.js');
const {HandControls}=await import('../src/hand-controls.js');

function fixture(t,{manual=false}={}){
  const clock={now:1000},state=createState(),elements=new Map(),feedback=[];
  const context=new Proxy({},{get:()=>()=>{}});
  const element=id=>{
    if(!elements.has(id)){const e=new EventTarget();Object.assign(e,{hidden:false,textContent:'',value:id==='handSide'?'Auto':'',width:320,height:240,dataset:{},style:{setProperty(){}},classList:{toggle(){}},setAttribute(){},getContext:()=>context,querySelector:()=>({textContent:''})});elements.set(id,e)}
    return elements.get(id);
  };
  const document=new EventTarget();document.getElementById=element;document.querySelector=()=>null;globalThis.document=document;
  t.mock.method(performance,'now',()=>clock.now);
  let lidOpen=true;
  const openings={stockBottle:[-4,1.6,-2],waterBottle:[-2,1.6,-2],unknownBottle:[0,1.4,-2],cuvette:[2,CUVETTE.height,2],wasteBeaker:[4,1.07,-1],spec20:[4,1.295,2]};
  Object.keys(state.tubes).forEach((id,index)=>openings[id]=[-3+index,1.232,0]);
  const home={pipette:[-5,.04,2],waterPipette:[-3.9,.04,2],unknownPipette:[-2.8,.04,2],cuvette:[2,CUVETTE.homeY,2],instrument:[3.15,0,1.9]},chamber=[4,CUVETTE.seat[1],2];
  const node=position=>({pos:[...position],rot:[0,0,0],set(...position){this.pos=position;return this}});
  const project=position=>({x:600+position[0]*85,y:350+position[2]*70-position[1]*30,z:position[2]/10});
  const unproject=(x,y,depth)=>[(x-600)/85,(350+depth*700-y)/30,depth*10];
  const scene={objects:{...Object.fromEntries(pipetteIds.map(id=>[id,node(home[id])])),cuvette:node(home.cuvette)},home,homeYaw:{},chamber,
    r:{root:{update(){}},project,unproject,onPlane:(x,y,height)=>[(x-600)/85,height,(y-350+height*30)/70]},
    constrainPlacement:(_id,x,z)=>[x,z],placementBounds:()=>({min:[-7,0,-4],max:[7,Infinity,4.7]}),sync(){},syncLiquids(){},endEquipmentDrag(){},
  };
  const positions={lid:[4,1.5,2],zero:[3.5,.6,3],read:[4,.6,3],clipboard:[0,.1,-3]};
  const geometry={
    isLidOpen:()=>lidOpen,setLid:value=>lidOpen=value,
    opening:id=>openings[id]?{center:[...openings[id]]}:null,
    project(id){
      let p;if(id.endsWith('-stand'))p=home[id.split('-')[0]];
      else if(id==='cuvette-dock')p=home.cuvette;
      else if(isPipette(id.split('-')[0])){p=[...scene.objects[id.split('-')[0]].pos];p[1]+=id.endsWith('-grip')?1.32:1.76}
      else if(id==='cuvette-grip'){p=[...scene.objects.cuvette.pos];p[1]+=CUVETTE.grip[1]}else p=positions[id];
      return p?project(p):null;
    },
    point(id){const p=this.project(id);return p?unproject(p.x,p.y,p.z):null},
    grabPoint(id){return this.point(id+'-grip')},
    pick(x,y,{only=[]}={}){return only.map(id=>({id,p:this.project(id)})).filter(item=>item.p).map(item=>({...item,d:Math.hypot(item.p.x-x,item.p.y-y)})).filter(item=>item.d<20).sort((a,b)=>a.d-b.d).map(item=>({id:item.id,equipment:item.id.split('-')[0]}))[0]||null},
    pipetteContact(id,{mode}){const p=openings[id];return p?{ok:true,mode,above:[p[0],p[1]+.18,p[2]],tip:[p[0],.2,p[2]]}:{ok:false}},
    containsTip(id,{tool='pipette'}={}){const p=scene.objects[tool].pos,o=openings[id];return {ok:!!o&&Math.abs(p[0]-o[0])<.01&&Math.abs(p[2]-o[2])<.01&&Math.abs(p[1]-.2)<.01,reason:'Outside vessel'}},
    cuvettePourPose:angle=>({position:[4,1.3,-1],rotation:[0,0,angle]}),
  };
  const layout={active:false,drag:null,save(){},refresh(){},updateSelection(){}};
  const canvas={clientWidth:1200,clientHeight:800};
  const m=new Manipulation({scene,geometry,getState:()=>state,onFeedback:message=>feedback.push(message)});
  const hand=new HandControls({scene,geometry,interaction:m,layout,canvas,getState:()=>state,onChange(){},onFeedback:message=>feedback.push(message)});
  if(manual)hand.setBulbMode('manual');
  t.after(()=>hand.camera.destroy());
  const lab={
    get state(){return structuredClone(state)},get step(){return {...getStep(state)}},get manipulation(){return structuredClone(m.state)},
    get affordances(){return {regions:Object.fromEntries([...pipetteIds.flatMap(id=>[id+'-grip',id+'-bulb']),'cuvette-grip','lid','zero','read','clipboard'].map(id=>[id,geometry.project(id)])),aim:m.aimScreen?m.aimScreen():m.aimPoint()?project(m.aimPoint()):null}},
    control(status){m.suspend();hand.resetInput();setStatus(state,status)},
    hand:{frame:frame=>hand.frame(frame),packet:packet=>hand.packet(packet),lost:()=>hand.lost(),get state(){return{holding:m.owner==='hand'?m.tool:null}}},
  };
  const sleep=async milliseconds=>{for(let elapsed=0;elapsed<milliseconds;){const dt=Math.min(16,milliseconds-elapsed);clock.now+=dt;elapsed+=dt;m.tick(clock.now)}};
  const trace=createDirectHandTrace({lab,canvas,now:()=>clock.now,sleep});
  return {trace,state,m,hand,lab,clock,scene,layout,sleep,feedback};
}

test('anatomical thumb and wrist fixtures retain the intended pose',()=>{
  for(const pose of ['open','grip','point'])for(const thumbPress of [0,1])for(const roll of [0,.85]){
    const p=landmarkPacket(pose,{x:400,y:300},{width:1200,height:800,stamp:100,thumbPress,roll});const result=classifyHand(p.landmarks[0],p.worldLandmarks[0]);
    assert.equal(result.valid,true);assert.equal(result.pose,pose);assert.ok(thumbPress?result.thumbPress>.68:result.thumbPress<.3);assert.ok(Math.abs(result.roll-roll)<1e-8);
  }
});

test('landmark-derived hand traces complete a real dose through release, loss and pause recovery',async t=>{
  const f=fixture(t,{manual:true}),report=await f.trace.runFirstDose();
  assert.equal(report.step,2);assert.equal(report.history,2);assert.equal(f.state.pipette.volume,0);assert.ok(Math.abs(f.state.tubes.tube_10_0.volume-10)<1e-8);
  assert.ok(report.checks.some(check=>check.name.includes('compressed and immersed')));assert.ok(report.checks.some(check=>check.name.includes('loss and regrasp')));assert.ok(report.checks.some(check=>check.name.includes('pause/run')));
  assert.ok(Math.abs(totalVolume(f.state)-2500)<1e-8);assert.equal(f.hand.camera.running,false);assert.equal(f.hand.camera.stream,null);
});

test('the same public hand trace can prepare the blank and seat, read, withdraw and pour its cuvette',async t=>{
  const f=fixture(t,{manual:true});await f.trace.runFirstDose({recovery:false});await f.sleep(1000);const report=await f.trace.runThroughBlankPour();
  assert.equal(report.waste,3);assert.equal(f.state.cuvette.volume,0);assert.equal(f.state.cuvette.inserted,false);assert.equal(f.state.zeroed,true);assert.equal(f.state.zeroWavelength,630);
  assert.equal(f.m.tool,null);assert.equal(f.m.contact,null);assert.equal(f.m.owner,null);assert.ok(Math.abs(totalVolume(f.state)-2500)<1e-8);
  for(const action of ['insert','zero','remove','empty'])assert.ok(report.actions.some(item=>item.action===action),`${action} must be reached using public hand input`);
  assert.ok(report.checks.some(check=>check.name.includes('batch gap')));
});

test('bounded trace batches re-arm and regrasp after an idle timestamp gap',async t=>{
  const f=fixture(t,{manual:true});await f.trace.runFirstDose({recovery:false});const before=f.lab.state;await f.sleep(1000);
  assert.deepEqual(f.lab.state,before);const report=await f.trace.advance(4);
  assert.equal(report.step,6);assert.equal(report.history,6);assert.ok(report.checks.some(check=>check.name.includes('batch gap')));assert.ok(Math.abs(totalVolume(f.state)-2500)<1e-8);
});

test('raw landmark packets map to the marked grip without completing chemistry on release',async t=>{
  const f=fixture(t),report=await f.trace.packetSmoke();assert.equal(report.history,0);assert.equal(f.state.pipette.volume,0);assert.equal(f.m.owner,null);assert.equal(f.m.flow,false);assert.equal(f.hand.camera.running,false);
});

test('B06 packet ownership survives reordered detections and never follows the other open palm',async t=>{
  const f=fixture(t),start=f.lab.affordances.regions['pipette-grip'];
  const send=async(pose,ms=40,{other=true,reverse=false,onlyOther=false,point=start}={})=>{
    await f.sleep(ms);
    const options={width:1200,height:800,stamp:f.clock.now};
    let packets=onlyOther?[]:[b06Packet(pose,point,options)];
    if(other)packets.push(b06Packet('open',{x:1000,y:280},{...options,hand:'Left'}));
    if(reverse)packets.reverse();f.hand.packet(packets.length?combinePackets(...packets):{landmarks:[],stamp:f.clock.now});
  };
  await send('open');await send('open',100);await send('grip');await send('grip',200,{reverse:true});
  assert.equal(f.m.owner,'hand');const identity=f.hand.primary;
  await send('partial',60,{reverse:true});assert.equal(f.m.owner,'hand','A brief partial opening cannot drop the tool');
  const held=[...f.scene.objects.pipette.pos];
  await send('open',40,{onlyOther:true});
  assert.equal(f.m.owner,'hand','A missing owner is retained during B06’s short grace interval');
  assert.deepEqual(f.scene.objects.pipette.pos,held,'The other palm cannot move the held pipette');
  await send('grip',60,{reverse:true});assert.equal(f.hand.primary,identity);assert.equal(f.m.owner,'hand');
  await send('open');await send('open',150);assert.equal(f.m.owner,'hand','Release requires the full B06 opening dwell');
  await send('open',90);assert.equal(f.m.owner,null);assert.equal(f.state.history.length,0);assert.equal(f.state.pipette.volume,0);
});

test('B06 confirmed hand loss freezes pose and needs a new open–close sequence',async t=>{
  const f=fixture(t),point=f.lab.affordances.regions['pipette-grip'];
  const send=async(pose,ms=50)=>{await f.sleep(ms);f.hand.packet(pose?b06Packet(pose,point,{width:1200,height:800,stamp:f.clock.now}):{landmarks:[],stamp:f.clock.now})};
  await send('open');await send('open',100);await send('grip');await send('grip',200);
  assert.equal(f.m.owner,'hand');const before=f.lab.state,position=[...f.scene.objects.pipette.pos];
  await send(null,80);await send(null,130);assert.equal(f.m.owner,null);assert.deepEqual(f.scene.objects.pipette.pos,position);assert.deepEqual(f.lab.state,before);
  await send('grip');await send('grip',220);assert.equal(f.m.owner,null,'A closed reacquired hand must not auto-grab');
  await send('open');await send('open',100);await send('grip');await send('grip',200);assert.equal(f.m.owner,'hand');
  f.hand.resetInput();await send('grip');await send('grip',220);assert.equal(f.hand.gate.holding,false,'Reset clears gesture evidence');
});

test('a single missed exposure on a slow camera preserves a continuously moving pipette grip',async t=>{
 const f=fixture(t),trace=createB06HandTrace({lab:f.lab,canvas:{clientWidth:1200,clientHeight:800},now:()=>f.clock.now,sleep:f.sleep});
 await trace.grasp('pipette');
 const owner=f.hand.primary,start={...trace.pointer};
 const move=async(dt,dx)=>{await f.sleep(dt);f.hand.packet(b06Packet('grip',{x:start.x+dx,y:start.y},{stamp:f.clock.now}))};
 await move(80,24);await move(80,48);
 await f.sleep(130);f.hand.packet({landmarks:[],stamp:f.clock.now});
 const stopped=[...f.scene.objects.pipette.pos];assert.equal(f.m.owner,'hand');assert.equal(f.m.flow,false);
 await move(90,114);
 assert.equal(f.hand.primary,owner);assert.equal(f.m.owner,'hand');assert.notDeepEqual(f.scene.objects.pipette.pos,stopped);
 // A closed hand reappearing elsewhere cannot inherit the tool across a gap.
 await f.sleep(130);f.hand.packet({landmarks:[],stamp:f.clock.now});await move(90,500);
 assert.equal(f.m.owner,null);assert.equal(f.m.frozen,true);assert.equal(f.state.history.length,0);
});

test('a duplicate camera detection on a moving fist preserves the pipette grip while an ambiguous overlap pauses it',async t=>{
 const f=fixture(t),trace=createB06HandTrace({lab:f.lab,canvas:{clientWidth:1200,clientHeight:800},now:()=>f.clock.now,sleep:f.sleep});
 await trace.grasp('pipette');
 const start={...trace.pointer},owner=f.hand.primary;
 const packetAt=(x)=>b06Packet('grip',{x,y:start.y},{stamp:f.clock.now});
 const narrowPalm=packet=>{
  const points=packet.landmarks[0],wrist=points[0];
  for(const p of points)p.x=wrist.x+(p.x-wrist.x)*.4;
  return packet;
 };
 let x=start.x;
 for(let i=0;i<8;i++){
  await f.sleep(60);x+=22;
  const full=packetAt(x),duplicate=narrowPalm(packetAt(x-26));
  f.hand.packet(i%2?combinePackets(full,duplicate):combinePackets(duplicate,full));
  assert.equal(f.hand.primary,owner);assert.equal(f.m.owner,'hand');
  assert.equal(f.hand.gestures.hands.length,1);assert.equal(f.hand.gestures.hands[0].wrist,full.landmarks[0][0]);
 }
 assert.ok(f.m.lastPointer.x>start.x+140,'The pipette travels with the moving fist');
 // A separate palm of the same reported handedness still gets its own ID.
 await f.sleep(60);f.hand.packet(combinePackets(packetAt(x),narrowPalm(packetAt(x+310))));
 assert.equal(f.hand.gestures.hands.length,2);assert.equal(f.hand.primary,owner);
 for(let i=0;i<5;i++){await f.sleep(60);f.hand.packet(packetAt(x))}
 // Two equally plausible palms on top of each other must never trade the tool.
 const before=[...f.scene.objects.pipette.pos];
 for(let i=0;i<4;i++){await f.sleep(60);f.hand.packet(combinePackets(packetAt(x),packetAt(x+4)))}
 assert.equal(f.m.owner,null);assert.equal(f.m.frozen,true);
 assert.deepEqual(f.scene.objects.pipette.pos,before);assert.equal(f.state.history.length,0);
});

test('B06 raw packets complete pipetting, loss recovery, blanking and cuvette handling through the live adapter',async t=>{
 const f=fixture(t,{manual:true}),trace=createB06HandTrace({lab:f.lab,canvas:{clientWidth:1200,clientHeight:800},now:()=>f.clock.now,sleep:f.sleep});
 const dose=await trace.runFirstDose();assert.equal(dose.step,2);
 const report=await trace.runThroughBlankPour();
 assert.equal(report.waste,3);assert.equal(f.state.zeroed,true);assert.equal(f.state.cuvette.inserted,false);assert.equal(f.state.cuvette.volume,0);
 assert.ok(Math.abs(totalVolume(f.state)-2500)<1e-8);assert.equal(f.m.owner,null);
});

test('opening the working hand above its stand parks the pipette after a missed frame',async t=>{
 const f=fixture(t),trace=createB06HandTrace({lab:f.lab,canvas:{clientWidth:1200,clientHeight:800},now:()=>f.clock.now,sleep:f.sleep});
 await trace.grasp('pipette');
 await trace.moveTo(f.m.aimScreen('pipette-stand'));assert.equal(f.m.hoverTarget,'pipette-stand');
 await f.sleep(40);f.hand.packet({landmarks:[],stamp:f.clock.now});
 assert.equal(f.m.owner,'hand');assert.equal(f.m.hoverTarget,null);
 await trace.hold('open',320);
 assert.equal(f.m.tool,null);assert.equal(f.m.history.at(-1).action,'park');
 assert.equal(f.state.history.length,0);
});

test('a closed B06 hand draws and delivers a guided dose, and interruption preserves the measured liquid',async t=>{
 const f=fixture(t),trace=createB06HandTrace({lab:f.lab,canvas:{clientWidth:1200,clientHeight:800},now:()=>f.clock.now,sleep:f.sleep});
 assert.equal(f.hand.bulbMode,'guided');await trace.grasp('pipette');await trace.align();
 const rim={...trace.pointer};await trace.moveTo({x:rim.x,y:rim.y+4});await trace.hold('grip',500);
 assert.equal(f.m.contact.depth,0);assert.equal(f.state.pipette.volume,0);assert.equal(f.m.compressed,false);
 await trace.lower();await trace.hold('grip',450);
 const partial=f.state.pipette.volume;assert.ok(partial>0&&partial<10);assert.equal(f.hand.pipetteCue().bulb,'relaxed');
 assert.match(f.hand.pipetteCue().instruction,/Drawing/);
 await f.sleep(40);f.hand.packet({landmarks:[],stamp:f.clock.now});const interrupted=f.state.pipette.volume;
 await f.sleep(40);f.hand.packet({landmarks:[],stamp:f.clock.now});
 await trace.hold('grip',500);assert.equal(f.state.pipette.volume,interrupted);assert.equal(f.m.flow,false);
 assert.match(f.hand.pipetteCue().instruction,/lift.*dip again/i);
 await trace.withdraw();await trace.align();await trace.lower();await trace.hold('grip',420);await trace.finishFlow(0);
 assert.ok(Math.abs(f.state.pipette.volume-10)<1e-8);assert.equal(f.state.history.length,1);
 await trace.withdraw();await trace.align();await trace.lower();await trace.hold('grip',450);
 assert.match(f.hand.pipetteCue().instruction,/Dispensing/);assert.equal(f.hand.pipetteCue().bulb,'squeezed');
 assert.ok(f.state.tubes.tube_10_0.volume>0&&f.state.tubes.tube_10_0.volume<10);
 await trace.withdraw();const delivered=f.state.tubes.tube_10_0.volume;await trace.hold('grip',500);
 assert.equal(f.state.tubes.tube_10_0.volume,delivered);await trace.align();await trace.lower();await trace.hold('grip',420);await trace.finishFlow(1);
 assert.ok(Math.abs(f.state.tubes.tube_10_0.volume-10)<1e-8);assert.equal(f.state.pipette.volume,0);
 assert.ok(Math.abs(totalVolume(f.state)-2500)<1e-8);
 const actions=step=>f.m.history.filter(event=>event.step===step).map(event=>event.action);
 assert.ok(actions(0).indexOf('squeeze-bulb')<actions(0).indexOf('lower'));
 assert.ok(actions(0).indexOf('relax-bulb')<actions(0).indexOf('start-flow'));
 assert.ok(actions(1).indexOf('lower')<actions(1).indexOf('squeeze-bulb'));
});

test('one dropped exposure holds the volume still until the same seated grasp is seen again',async t=>{
 const f=fixture(t),trace=createB06HandTrace({lab:f.lab,canvas:{clientWidth:1200,clientHeight:800},now:()=>f.clock.now,sleep:f.sleep});
 await trace.grasp('pipette');await trace.align();await trace.lower();await trace.hold('grip',420);
 const contact=f.m.contact,owner=f.hand.primary;
 await f.sleep(100);f.hand.packet({landmarks:[],stamp:f.clock.now});
 const volume=f.state.pipette.volume;assert.equal(f.m.flow,false);
 await f.sleep(110);assert.equal(f.state.pipette.volume,volume);
 f.hand.packet(b06Packet('grip',trace.pointer,{stamp:f.clock.now}));
 assert.equal(f.hand.primary,owner);assert.equal(f.m.contact,contact);assert.equal(f.m.flow,true);
 assert.equal(f.state.pipette.volume,volume,'The missed interval must never count toward the dose');
 await f.sleep(45);assert.ok(f.state.pipette.volume>volume);
 await f.sleep(40);f.hand.packet({landmarks:[],stamp:f.clock.now});
 const partial=f.state.pipette.volume;
 await trace.hold('open',300);
 assert.equal(f.m.owner,null);assert.equal(f.m.flow,false);assert.equal(f.state.pipette.volume,partial);
});

test('a delayed detector needs two fresh seated grasps and never meters the time spent waiting',async t=>{
 const f=fixture(t),trace=createB06HandTrace({lab:f.lab,canvas:{clientWidth:1200,clientHeight:800},now:()=>f.clock.now,sleep:f.sleep});
 await trace.grasp('pipette');await trace.align();await trace.lower();await trace.hold('grip',420);
 assert.equal(f.hand.holdForDetector(),true);assert.equal(f.m.flow,false);
 const partial=f.state.pipette.volume,owner=f.hand.primary;
 const send=()=>f.hand.packet(b06Packet('grip',trace.pointer,{stamp:f.clock.now}));
 await f.sleep(1460);send();
 assert.equal(f.state.pipette.volume,partial);assert.equal(f.m.flow,false);
 await f.sleep(50);send();
 assert.equal(f.hand.primary,owner);assert.equal(f.m.flow,true);assert.equal(f.state.pipette.volume,partial);
 await f.sleep(80);assert.ok(f.state.pipette.volume>partial);
 assert.equal(f.hand.holdForDetector(),true);
 const retained=f.state.pipette.volume;await f.sleep(1500);send();
 assert.equal(f.m.owner,null);assert.equal(f.m.frozen,true);assert.equal(f.state.pipette.volume,retained);
});

test('an in-flight exposure from before a detector pause cannot start the two-frame confirmation',async t=>{
 const f=fixture(t),trace=createB06HandTrace({lab:f.lab,canvas:{clientWidth:1200,clientHeight:800},now:()=>f.clock.now,sleep:f.sleep});
 await trace.grasp('pipette');await trace.align();await trace.lower();await trace.hold('grip',420);
 const inFlight=f.clock.now+25;
 await f.sleep(300);assert.equal(f.hand.holdForDetector(),true);
 const partial=f.state.pipette.volume,owner=f.hand.primary;
 const send=stamp=>f.hand.packet(b06Packet('grip',trace.pointer,{stamp}));
 send(inFlight);
 await f.sleep(55);send(f.clock.now);
 assert.equal(f.m.owner,'hand');assert.equal(f.hand.primary,owner);assert.equal(f.m.flow,false);
 await f.sleep(55);send(f.clock.now);
 assert.equal(f.m.flow,true);assert.equal(f.state.pipette.volume,partial);
});

test('a closing palm cannot pick up equipment it crosses during the grasp dwell',async t=>{
 const f=fixture(t),grip=f.lab.affordances.regions['pipette-grip'];
 const start={x:grip.x-65,y:grip.y};
 const send=async(pose,point,ms)=>{await f.sleep(ms);f.hand.packet(b06Packet(pose,point,{stamp:f.clock.now}))};
 await send('open',start,50);await send('open',start,90);
 await send('grip',start,60);await send('grip',grip,90);await send('grip',grip,110);
 assert.equal(f.m.owner,null);
 await send('open',grip,80);await send('open',grip,240);
 // A slight shift as the fingers curl keeps the grip that was under the open palm.
 const shift={x:grip.x+14,y:grip.y+5};
 await send('grip',shift,60);await send('grip',shift,200);
 assert.equal(f.m.owner,'hand');assert.equal(f.m.tool,'pipette');
});

test('short B06 palm dips draw 8 mL of stock and dispense it into the second tube',async t=>{
 const f=fixture(t),trace=createB06HandTrace({lab:f.lab,canvas:{clientWidth:1200,clientHeight:800},now:()=>f.clock.now,sleep:f.sleep});
 await trace.grasp('pipette');
 for(const [index,target] of ['stockBottle','tube_10_0','stockBottle','tube_8_2'].entries()){
  assert.equal(f.lab.step.target,target);
  if(index===3){
   const neighbor=f.m.aimScreen('tube_6_4');
   await trace.moveTo(neighbor);await trace.moveTo({x:neighbor.x,y:neighbor.y+17});await trace.hold('grip',400);
   assert.equal(f.m.contact,null);assert.equal(f.state.pipette.volume,8);
  }
  const above=f.m.aimScreen(target);await trace.moveTo({x:above.x,y:above.y-26});
  if(index===2){
   await trace.moveTo({x:above.x,y:above.y-15});await trace.hold('grip',550);
   assert.equal(f.m.contact,null,'The aiming guide above the stock bottle must not start a dip');
   assert.equal(f.state.pipette.volume,0);
  }
  // Take the final receiver in one continuous downward motion through its lip.
  if(index!==3)await trace.align();
  const rim=index===3?above:{...trace.pointer};
  await trace.moveTo({x:rim.x+2,y:rim.y+16});await trace.hold('grip',360);
  assert.equal(f.m.contact.target,target);assert.equal(f.m.contact.depth,1);assert.equal(f.m.flow,true);
  const before=f.state.pipette.volume;
  await trace.moveTo({x:rim.x-1,y:rim.y+11});
  assert.equal(f.m.contact.depth,1);assert.equal(f.m.flow,true,'A small wobble must keep the tip seated');
  assert.ok(index%2?f.state.pipette.volume<before:f.state.pipette.volume>before);
  await trace.finishFlow(index);assert.equal(f.m.owner,'hand');
  if(index===2)assert.equal(f.state.pipette.volume,8);
  // A short lift, or carrying the completed dose sideways, frees the pipette.
  await trace.moveTo(index===0?{x:rim.x+24,y:rim.y+11}:{x:rim.x,y:rim.y-8});
  assert.equal(f.m.contact,null);
 }
 assert.equal(f.state.tubes.tube_10_0.volume,10);assert.equal(f.state.tubes.tube_8_2.volume,8);
 assert.equal(f.state.tubes.tube_6_4.volume,0);assert.equal(f.state.pipette.volume,0);
 assert.equal(f.state.history.length,4);assert.ok(Math.abs(totalVolume(f.state)-2500)<1e-8);
});

test('losing the hand during either fourth-tube dispense preserves both sides of the partial dose',async t=>{
 const f=fixture(t),trace=createB06HandTrace({lab:f.lab,canvas:{clientWidth:1200,clientHeight:800},now:()=>f.clock.now,sleep:f.sleep});
 const interrupted=[];
 while(f.lab.step.index<14){
  const step=f.lab.step,tool=step.pipetteId;
  if(f.m.contact)await trace.withdraw();
  if(f.m.tool!==tool){await trace.park();await trace.grasp(tool)}
  await trace.align();await trace.lower();await trace.hold('grip',360);
  if(step.target==='tube_4_6'&&step.action==='dispense'){
   for(const delay of [40,220]){await f.sleep(delay);f.hand.packet({landmarks:[],stamp:f.clock.now})}
   assert.equal(f.m.frozen,true);assert.equal(f.m.owner,null);
   const rack=structuredClone(f.state.tubes),pipette=structuredClone(f.state[tool]);
   assert.ok(pipette.volume>0&&pipette.volume<step.volume);
   await trace.hold('grip',320);assert.equal(f.m.owner,null);
   await trace.grasp(tool);await trace.withdraw();await trace.align();
   assert.deepEqual(f.state.tubes,rack);assert.deepEqual(f.state[tool],pipette);
   await trace.lower();await trace.hold('grip',360);
   interrupted.push(tool);
  }
  await trace.finishFlow(step.index);
 }
 assert.deepEqual(interrupted,['pipette','waterPipette']);
 const fourth=f.state.tubes.tube_4_6;
 assert.ok(Math.abs(fourth.stockVolume-4)<1e-8&&Math.abs(fourth.waterVolume-6)<1e-8);
 assert.equal(f.state.tubes.tube_2_8.volume,0);assert.equal(f.state.history.length,14);
 assert.ok(Math.abs(totalVolume(f.state)-2500)<1e-8);
});

test('short guided dips prepare and sample every rack tube and the unknown dilution',async t=>{
 const f=fixture(t),trace=createB06HandTrace({lab:f.lab,canvas:{clientWidth:1200,clientHeight:800},now:()=>f.clock.now,sleep:f.sleep});
 await trace.grasp('pipette');await trace.moveTo(f.m.aimScreen('waterBottle'));await trace.hold('grip',500);
 assert.equal(f.m.contact,null);assert.equal(f.state.pipette.volume,0,'Hovering at a different bottle cannot start aspiration');
 const samples=[];
 while(f.lab.step.action!=='report'){
  const step=f.lab.step,before=f.state.history.length;
  assert.ok(before<120,'The hand protocol must advance');
  if(step.action==='fit'||step.action==='plan'){
   const result=notebookDecision(f.state,step.action,{aliquot:5});assert.ok(result.ok,result.message);continue;
  }
  if(step.action!=='aspirate'&&step.action!=='dispense'){await trace.instruction();continue}
  if(f.m.contact)await trace.withdraw();
  if(f.m.tool!==step.pipetteId){await trace.park();await trace.grasp(step.pipetteId)}
  const tubes=structuredClone(f.state.tubes);
  await trace.align();await trace.moveTo({x:trace.pointer.x+2,y:trace.pointer.y+17});await trace.hold('grip',400);
  assert.equal(f.m.contact?.target,step.target);assert.equal(f.m.contact.depth,1);assert.equal(f.m.flow,true);
  await trace.finishFlow(before);assert.equal(f.m.owner,'hand');
  if(step.action==='aspirate'&&Object.hasOwn(tubes,step.target)){
   const source=tubes[step.target],filled=f.state[step.pipetteId];
   assert.ok(Math.abs(source.volume-f.state.tubes[step.target].volume-3)<1e-8);
   assert.ok(Math.abs(filled.volume-3)<1e-8);
   for(const part of ['stockVolume','waterVolume','unknownVolume'])assert.ok(Math.abs(filled[part]-3*source[part]/source.volume)<1e-8);
   samples.push(step.target);
  }
  for(const [id,original] of Object.entries(tubes))if(id!==step.target)assert.deepEqual(f.state.tubes[id],original,id+' changed during '+step.target);
  if(step.index===21){
   assert.ok(Math.abs(f.state.cuvette.volume-3)<1e-8);assert.ok(Math.abs(f.state.tubes.tube_0_10.volume-7)<1e-8);
   for(const id of ['tube_10_0','tube_8_2','tube_6_4','tube_4_6','tube_2_8'])assert.ok(Math.abs(f.state.tubes[id].volume-10)<1e-8);
  }
 }
 assert.deepEqual(samples,['tube_0_10','tube_10_0','tube_8_2','tube_6_4','tube_4_6','tube_2_8','tube_0_10','tube_dilution']);
 assert.ok(Math.abs(f.state.tubes.tube_dilution.unknownVolume-3.5)<1e-8);
 assert.ok(Math.abs(f.state.tubes.tube_dilution.waterVolume-3.5)<1e-8);
 assert.ok(Math.abs(totalVolume(f.state)-2500)<1e-8);
});

test('manual mode reads a thumb-to-index fingertip pinch while the other three fingers hold the pipette',async t=>{
 const f=fixture(t,{manual:true}),trace=createB06HandTrace({lab:f.lab,canvas:{clientWidth:1200,clientHeight:800},now:()=>f.clock.now,sleep:f.sleep});
 await trace.grasp('pipette');await trace.align();const rim={...trace.pointer};
 async function pose(point,pinched,frames=9){
  for(let i=0;i<frames;i++){
   await f.sleep(40);
   const packet=b06Packet('point',point,{stamp:f.clock.now});
   if(pinched)for(const landmarks of [packet.landmarks[0],packet.worldLandmarks[0]])landmarks[4]={...landmarks[8]};
   if(i%2===0)packet.worldLandmarks=[[]];
   f.hand.packet(packet);
  }
 }
 await pose(rim,false);await pose({x:rim.x,y:rim.y+30},false);
 assert.equal(f.m.owner,'hand');assert.equal(f.m.contact.depth,0);assert.equal(f.m.charged,false);
 await pose(rim,false);await pose(rim,true);assert.equal(f.m.compressed,true);assert.equal(f.m.charged,true);
 await pose(rim,false);assert.equal(f.m.charged,false,'Relaxing above the source cancels the priming squeeze');
 await pose(rim,true);const seated={x:rim.x,y:rim.y+85};await pose(seated,true,14);
 assert.equal(f.m.contact.depth,1);assert.equal(f.m.flow,false);assert.equal(f.state.pipette.volume,0);
 await pose(seated,false);assert.equal(f.m.owner,'hand');assert.equal(f.m.flow,true);assert.ok(f.state.pipette.volume>0);
 await pose(seated,false,100);assert.equal(f.state.history.length,1);assert.ok(Math.abs(f.state.pipette.volume-10)<1e-8);
});

test('nearby pipette fallback chooses the nearest visible grip while a direct hit takes priority',t=>{
 const f=fixture(t),g=f.hand.geometry;
 f.scene.objects.waterPipette.pos=[-4.7,.04,2];
 const p=g.project('waterPipette-grip');g.pick=()=>null;
 assert.equal(f.hand.pickTool(p.x+2,p.y),'waterPipette');
 g.screenTarget=id=>({...g.project(id),visible:id!=='waterPipette-grip'});
 assert.equal(f.hand.pickTool(p.x+2,p.y),'pipette','A hidden grip is not a fallback candidate');
 g.pick=()=>({equipment:'unknownPipette'});
 assert.equal(f.hand.pickTool(p.x+2,p.y),'unknownPipette','An actual ray hit takes precedence over nearby projected grips');
});

test('physical pointer takeover places arranged equipment and requires fresh hand arming',async t=>{
 const f=fixture(t),point=f.lab.affordances.regions['pipette-grip'],placed=[];
 f.scene.endEquipmentDrag=(id,keep)=>placed.push({id,keep});let saves=0;f.layout.save=()=>saves++;
 f.hand.suspended={id:'waterPipette'};const pose=[...f.scene.objects.waterPipette.pos];f.hand.yieldToPointer();
 assert.deepEqual(placed,[{id:'waterPipette',keep:true}]);assert.equal(saves,1);assert.deepEqual(f.scene.objects.waterPipette.pos,pose);assert.equal(f.hand.busy,false);
 let pointer=true;f.hand.pointerBusy=()=>pointer;
 const send=async(pose,ms)=>{await f.sleep(ms);f.hand.packet(b06Packet(pose,point,{width:1200,height:800,stamp:f.clock.now}))};
 await send('open',50);await send('open',120);await send('grip',50);await send('grip',220);assert.equal(f.m.owner,null);
 pointer=false;await send('grip',50);await send('grip',220);assert.equal(f.m.owner,null,'Closing during pointer control cannot acquire a tool later');
 await send('open',50);await send('open',100);await send('grip',50);await send('grip',200);assert.equal(f.m.owner,'hand');
 const held=[...f.scene.objects.pipette.pos];f.hand.yieldToPointer();assert.equal(f.m.owner,null);assert.deepEqual(f.scene.objects.pipette.pos,held);assert.equal(f.m.flow,false);
});
