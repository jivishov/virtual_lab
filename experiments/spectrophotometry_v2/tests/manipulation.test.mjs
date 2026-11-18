import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,getStep,perform,setStatus,totalVolume} from '../src/model.js';
import {CUVETTE} from '../assets/cuvette-dimensions.js';
import {pipetteLevel} from '../src/pipettes.js';

// These checks exercise the actual controller and scientific model. The scene
// double supplies deterministic poses/contact, not browser hit-testing or optics.
globalThis.E3D={};
globalThis.document={querySelector:()=>null};
const {Manipulation}=await import('../src/manipulation.js');

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} ≈ ${expected}`);
function next(state){const step=getStep(state),result=perform(state,step.action,step.target);assert.equal(result.ok,true,result.message)}
function atAction(action){const state=createState();let remaining=150;while(getStep(state).action!==action&&remaining--)next(state);assert.ok(remaining>0);return state}
function snapshot(rig){return structuredClone({model:rig.state,control:rig.m.state,contact:rig.m.contact,positions:Object.fromEntries(Object.entries(rig.scene.objects).map(([id,node])=>[id,node.pos])),history:rig.m.history})}

function makeRig(state=createState()){
  let lidOpen=true;
  const messages=[],openings={stockBottle:[-4,1.6,-2],waterBottle:[-2,1.6,-2],unknownBottle:[0,1.4,-2],cuvette:[2,CUVETTE.height,2],wasteBeaker:[4,1.07,-1],spec20:[4,1.295,2]};
  Object.keys(state.tubes).forEach((id,index)=>openings[id]=[-3+index,1.232,0]);
  const home={pipette:[-5,.04,2],cuvette:[2,CUVETTE.homeY,2],instrument:[3.15,0,1.9]},chamber=[4,CUVETTE.seat[1],2];
  const node=position=>({pos:[...position],rot:[0,0,0],set(...position){this.pos=position;return this}});
  const project=position=>({x:500+position[0]*100,y:200+position[2]*100-position[1]*30,z:position[2]/10});
  const unproject=(x,y,z)=>[(x-500)/100,(200+z*1000-y)/30,z*10];
  const scene={
    objects:{pipette:node(home.pipette),cuvette:node(state.cuvette.inserted?chamber:home.cuvette)},home,homeYaw:{},chamber,
    r:{root:{update(){}},project,unproject},
    placementBounds:()=>({min:[-7,0,-4],max:[7,Infinity,4.7]}),sync(){},syncLiquids(){},
  };
  const geometry={
    contactValid:true,contactChecks:0,
    grabPoint(id){const p=[...scene.objects[id].pos];p[1]+=id==='pipette'?1.32:CUVETTE.grip[1];return p},
    isLidOpen:()=>lidOpen,setLid:value=>lidOpen=value,
    opening:id=>openings[id]?{center:[...openings[id]]}:null,
    pipetteContact(id,{mode}){
      const opening=openings[id];if(!opening)return {ok:false,reason:'No opening.'};
      return {ok:true,mode,above:[opening[0],opening[1]+.18,opening[2]],tip:[opening[0],.2,opening[2]]};
    },
    containsTip(id){
      this.contactChecks++;const opening=openings[id],p=scene.objects.pipette.pos;
      const ok=this.contactValid&&!!opening&&Math.abs(p[0]-opening[0])<.01&&Math.abs(p[2]-opening[2])<.01&&Math.abs(p[1]-.2)<.01;
      return {ok,reason:'Tip is no longer immersed.'};
    },
    cuvettePourPose:angle=>({position:[4,1.3,-1],rotation:[0,0,angle]}),
  };
  const m=new Manipulation({scene,geometry,getState:()=>state,onFeedback:(message,error)=>messages.push({message,error})});
  return {m,state,scene,geometry,messages,clock:0};
}

function grab(rig,tool='pipette',owner='mouse'){
  const pos=[...rig.scene.objects[tool].pos];pos[1]+=tool==='pipette'?1.32:CUVETTE.grip[1];
  const p=rig.scene.r.project(pos);assert.equal(rig.m.grab(tool,owner,p.x,p.y),true);return p;
}
function startAspiration(rig,owner='mouse'){
  grab(rig,'pipette',owner);rig.m.squeeze(true);assert.equal(rig.m.align(getStep(rig.state).target),true);rig.m.setDepth(1);
  assert.equal(rig.m.squeeze(false),true);assert.equal(rig.m.flow,true);rig.m.tick(rig.clock);
}
function tick(rig,elapsed=100){rig.clock+=elapsed;rig.m.tick(rig.clock)}
function finishFlow(rig){let remaining=100;while(rig.m.flow&&remaining--)tick(rig);assert.ok(remaining>0,'The active dose must finish');}
function startPour(rig){grab(rig,'cuvette');rig.m.align('wasteBeaker');rig.m.setTilt(1.8);rig.m.tick(rig.clock)}

test('mouse and palm retain the picked point on pickup, free carry, bench limits and release',()=>{
 for(const owner of ['mouse','hand'])for(const tool of ['pipette','cuvette']){
  const rig=makeRig(),{m,scene,geometry}=rig,p=grab(rig,tool,owner);
  const node=scene.objects[tool],home=[...node.pos],point=()=>scene.r.project(geometry.grabPoint(tool));
  for(const t of [0,80,160,240,320])m.tick(t);
  assert.deepEqual(node.pos,home,'A stationary grip must leave the tool where it was picked up');
  for(const [dx,dy] of [[2,1],[72,-35],[35,20]]){
   m.move(p.x+dx,p.y+dy,{hand:owner==='hand',now:450+dx});
   close(point().x,p.x+dx);close(point().y,p.y+dy);assert.ok(node.pos[1]>=0);
  }
  m.move(p.x+2400,p.y+30);assert.ok(node.pos[0]<=7);
  m.move(p.x,p.y);close(point().x,p.x);close(point().y,p.y);
  m.move(p.x+45,p.y-40);m.release();const placed=[...node.pos];
  assert.equal(m.move(p.x+145,p.y),false);assert.deepEqual(node.pos,placed);assert.equal(rig.state.step,0);
 }
});

test('aim coordinates identify the mouth, and hand travel alone does not align or change chemistry',()=>{
 const r=makeRig(),before=structuredClone(r.state);grab(r,'pipette','hand');
 assert.deepEqual(r.m.aimPoint('stockBottle'),r.geometry.opening('stockBottle').center);
 const p=r.m.aimScreen('stockBottle');
 for(let i=0;i<10;i++)r.m.move(p.x-25+i*5,p.y,{hand:true,now:i*40});
 assert.equal(r.m.contact,null,'Continuous travel across the hit region is not settled aiming');
 assert.deepEqual(r.state,before,'Aiming does not perform the scientific operation');
 r.m.clearAim();for(const now of [500,600,700,800])r.m.move(p.x,p.y,{hand:true,now});
 assert.equal(r.m.contact.target,'stockBottle');assert.equal(r.m.contact.depth,0);assert.deepEqual(r.state,before);
});

test('wrong-vessel alignment cannot start a dose and suspension clears target evidence',()=>{
 const r=makeRig(),before=structuredClone(r.state);grab(r,'pipette','hand');r.m.squeeze(true);r.m.align('tube_8_2');r.m.setDepth(1);
 assert.equal(r.m.squeeze(false),false);assert.equal(r.m.flow,false);assert.deepEqual(r.state,before);
 r.m.hoverTarget='tube_8_2';r.m.aimSettler.update('tube_8_2',10,10,100);r.m.suspend();
 assert.equal(r.m.hoverTarget,null);assert.equal(r.m.aimSettler.sample,null);assert.equal(r.m.flow,false);assert.deepEqual(r.state,before);
});

test('hand can move to an adjacent opening before insertion, requiring a fresh settled lock',()=>{
 const r=makeRig();grab(r,'pipette','hand');
 // Make the mouths 40 screen pixels apart, closer than the former 64 px exit.
 const original=r.geometry.opening;r.geometry.opening=id=>id==='tube_8_2'?{center:[-3.6,1.6,-2]}:original(id);
 const a=r.scene.r.project(r.m.aimPoint('stockBottle')),b=r.scene.r.project(r.m.aimPoint('tube_8_2'));
 r.m.align('stockBottle',a);r.m.move(b.x,b.y,{hand:true,now:100});
 assert.equal(r.m.contact,null);assert.equal(r.m.hoverTarget,'tube_8_2');
 for(const now of [200,300,400])r.m.move(b.x,b.y,{hand:true,now});
 assert.equal(r.m.contact.target,'tube_8_2');assert.equal(r.m.contact.depth,0);assert.equal(r.state.pipette.volume,0);
 r.m.move(b.x,b.y+68,{hand:true,now:500});r.m.move(a.x,b.y+68,{hand:true,now:600});assert.equal(r.m.contact.target,'tube_8_2','Inserted tip stays in its opening');
});

test('premature withdrawal cannot separate visual position from the inserted model state',()=>{
  const r=makeRig(atAction('zero'));grab(r,'cuvette');const before=snapshot(r);
  assert.equal(r.m.setDepth(.5),false);assert.equal(r.m.setDepth(0),false);r.m.finishDepth();assert.equal(r.m.park('cuvette-dock'),false);
  assert.deepEqual(snapshot(r),before);assert.equal(r.state.cuvette.inserted,true);
  assert.equal(r.m.release(),true);assert.equal(r.m.tool,null);assert.equal(r.m.lid(),true);assert.equal(r.m.activate('zero'),true);
  assert.equal(getStep(r.state).action,'remove');assert.equal(r.state.zeroed,true);
});

test('a suspended seated cuvette ignores release until Run and a fresh grasp',()=>{
  for(const status of ['paused','stopped','running']){
    const r=makeRig(atAction('zero'));grab(r,'cuvette','keyboard');
    setStatus(r.state,status);r.m.suspend();const before=snapshot(r);
    assert.equal(r.m.release(),false,`Escape cannot release a suspended cuvette while ${status}`);
    assert.deepEqual(snapshot(r),before,'Rejected release preserves the seated tool and recovery state');
    setStatus(r.state,'running');
    assert.equal(r.m.release(),false,'Run alone does not restore ownership');
    assert.equal(r.m.describe().region,'cuvette-grip');
    grab(r,'cuvette','keyboard');assert.equal(r.m.release(),true);
    assert.equal(r.m.tool,null);assert.equal(r.m.owner,null);assert.equal(r.m.contact,null);assert.equal(r.m.frozen,false);
    assert.deepEqual(r.m.describe(),{instruction:'Close the sample-chamber lid.',kind:'lid',region:'lid'});
    assert.equal(r.m.lid(),true);assert.equal(r.m.activate('zero'),true);
    assert.equal(r.state.zeroed,true);assert.equal(getStep(r.state).action,'remove');
  }
});

test('a released partially seated cuvette blocks lid closure and seating rechecks the lid',()=>{
  const r=makeRig(atAction('insert'));grab(r,'cuvette');r.m.align('spec20');r.m.setDepth(.5);r.m.release();
  assert.equal(r.m.lid(),false);assert.equal(r.state.lidOpen,true);assert.equal(r.geometry.isLidOpen(),true);
  grab(r,'cuvette');r.geometry.setLid(false);r.state.lidOpen=false;const before=snapshot(r);
  assert.equal(r.m.setDepth(1),false);assert.deepEqual(snapshot(r),before);assert.equal(r.state.cuvette.inserted,false);
  r.geometry.setLid(true);r.state.lidOpen=true;r.m.setDepth(1);r.m.release();
  assert.equal(r.m.tool,null);assert.equal(r.m.lid(),true);assert.equal(r.state.lidOpen,false);assert.equal(r.state.cuvette.inserted,true);
});

test('near-complete seating uses one threshold for insertion and release',()=>{
  const r=makeRig(atAction('insert'));grab(r,'cuvette','hand');r.m.align('spec20');r.m.setDepth(.995);
  assert.equal(r.state.cuvette.inserted,true);assert.equal(r.m.contact.depth,1);assert.equal(r.m.release(),true);
  assert.equal(r.m.tool,null);assert.equal(r.m.owner,null);assert.equal(r.m.contact,null);
  assert.equal(r.m.lid(),true);assert.equal(r.m.activate('zero'),true);
});

test('pouring needs a continuous owned hold; released time cannot complete the pour',()=>{
  const r=makeRig(atAction('empty')),history=r.state.history.length;startPour(r);tick(r,200);
  assert.equal(r.state.cuvette.volume,3);r.m.release();tick(r,1000);assert.equal(r.state.cuvette.volume,3);assert.equal(r.m.pourSince,null);
  grab(r,'cuvette');tick(r,1);tick(r,449);assert.equal(r.state.cuvette.volume,3);
  tick(r,1);assert.equal(r.state.cuvette.volume,0);assert.equal(r.state.waste,3);assert.equal(r.state.history.length,history+1);
  tick(r,1000);assert.equal(r.state.waste,3);assert.equal(r.state.history.length,history+1);close(totalVolume(r.state),2500);
});

test('aspiration stops before another increment when contact or immersion is lost',()=>{
  const r=makeRig();startAspiration(r);tick(r);close(r.state.pipette.volume,.3);const before=structuredClone(r.state),checks=r.geometry.contactChecks;
  r.geometry.contactValid=false;tick(r);assert.equal(r.m.flow,false);assert.deepEqual(r.state,before);assert.ok(r.geometry.contactChecks>checks);
  assert.equal(r.state.step,0);assert.equal(r.state.history.length,0);assert.equal(r.m.contact.depth,1);
  r.geometry.contactValid=true;r.m.squeeze(true);r.m.squeeze(false);tick(r);close(r.state.pipette.volume,.6);finishFlow(r);
  assert.equal(r.state.step,1);assert.equal(r.state.history.length,1);close(r.state.pipette.volume,10);close(totalVolume(r.state),2500);
});

for(const status of ['paused','stopped'])test(`${status} input preserves partial liquid and requires a regrasp before resuming`,()=>{
  const r=makeRig();startAspiration(r);tick(r);setStatus(r.state,status);r.m.suspend();const before=snapshot(r);
  tick(r,5000);assert.equal(r.m.squeeze(false),false);assert.equal(r.m.setDepth(0),false);assert.equal(r.m.move(100,100),false);assert.equal(r.m.grab('pipette','hand',100,100),false);
  assert.deepEqual(snapshot(r),before);close(r.state.pipette.volume,.3);
  setStatus(r.state,'running');tick(r);assert.equal(r.m.flow,false);close(r.state.pipette.volume,.3);
  grab(r,'pipette','hand');assert.equal(r.m.flow,false);r.m.squeeze(true);r.m.squeeze(false);finishFlow(r);
  assert.equal(r.state.step,1);assert.equal(r.state.history.length,1);assert.equal(r.state.transfer,null);close(r.state.pipette.volume,10);close(totalVolume(r.state),2500);
});

test('wrong-source and early bulb actions cannot consume or transfer liquid',()=>{
  const r=makeRig(),initial=structuredClone(r.state);assert.equal(r.m.squeeze(true),false);
  grab(r);r.m.align('stockBottle');r.m.setDepth(1);r.m.squeeze(true);r.m.squeeze(false);tick(r,1000);
  assert.equal(r.m.charged,false);assert.equal(r.m.flow,false);assert.deepEqual(r.state,initial);
  r.m.setDepth(0);r.m.finishDepth();r.m.squeeze(true);assert.equal(r.m.align('waterBottle'),false);assert.equal(r.m.contact,null);r.m.align('tube_8_2');r.m.setDepth(1);
  assert.equal(r.m.squeeze(false),false);tick(r,1000);assert.equal(r.m.flow,false);assert.deepEqual(r.state,initial);
  r.m.setDepth(0);r.m.finishDepth();r.m.align('stockBottle');r.m.setDepth(.5);r.m.squeeze(false);tick(r,1000);
  assert.equal(r.m.flow,false);assert.deepEqual(r.state,initial);
  r.m.setDepth(1);assert.equal(r.m.flow,false);r.m.squeeze(true);r.m.squeeze(false);tick(r);close(r.state.pipette.volume,.3);
});

test('released tools cannot start flow or change position/contact without a new owner',()=>{
  const r=makeRig();grab(r);r.m.squeeze(true);r.m.align('stockBottle');r.m.setDepth(1);r.m.release();let before=snapshot(r);
  assert.equal(r.m.startFlow(),false);assert.equal(r.m.squeeze(false),false);assert.equal(r.m.setDepth(0),false);assert.equal(r.m.move(100,100),false);assert.equal(r.m.align('waterBottle'),false);
  assert.deepEqual(snapshot(r),before);
  grab(r);r.m.setDepth(0);r.m.release();before=snapshot(r);r.m.finishDepth();assert.equal(r.m.park('pipette-stand'),false);assert.deepEqual(snapshot(r),before);
  const pour=makeRig(atAction('empty'));grab(pour,'cuvette');pour.m.align('wasteBeaker');pour.m.release();before=snapshot(pour);
  assert.equal(pour.m.setTilt(1.8),false);assert.equal(pour.m.leavePour(),false);assert.deepEqual(snapshot(pour),before);
});

for(const operation of ['aspirate','dispense'])test(`releasing during ${operation} stops flow and preserves the unfinished dose`,()=>{
  const r=makeRig(atAction(operation));
  if(operation==='aspirate')startAspiration(r);
  else{grab(r);r.m.align('tube_10_0');r.m.setDepth(1);r.m.squeeze(true);r.m.tick(r.clock)}
  tick(r);const before=structuredClone(r.state);assert.ok(r.state.transfer);r.m.release();tick(r,5000);
  assert.equal(r.m.flow,false);assert.equal(r.m.owner,null);assert.equal(r.m.contact.depth,1);assert.deepEqual(r.state,before);
  grab(r,'pipette','hand');tick(r);assert.equal(r.m.flow,false);assert.deepEqual(r.state,before);
});

function carryAndLower(rig,owner,target){
 const {m}=rig,p=m.aimScreen(target);
  if(owner==='hand'){
    for(const now of [100,200,300,400])m.move(p.x,p.y,{hand:true,now});
    assert.equal(m.contact?.target,target);m.move(p.x,p.y+68,{hand:true,now:500});
  }else{m.move(p.x,p.y,{now:100});m.selectTarget(target,owner);assert.equal(m.contact?.target,target);m.setDepth(1)}
  assert.equal(m.contact.depth,1);
}
function equivalentDose(owner){
  const r=makeRig();grab(r,'pipette',owner);r.m.squeeze(true);carryAndLower(r,owner,'stockBottle');r.m.squeeze(false);r.m.tick(r.clock);tick(r);tick(r);
  r.m.release();tick(r,1000);grab(r,'pipette',owner);r.m.squeeze(true);r.m.squeeze(false);finishFlow(r);
  if(owner==='hand'){
    const c=r.m.contact;r.m.move(c.handX+70,c.handY-68,{hand:true,now:2000});assert.equal(r.m.contact,null);
  }else{r.m.setDepth(0);r.m.finishDepth()}
  carryAndLower(r,owner,'tube_10_0');r.m.squeeze(true);finishFlow(r);r.m.release();return r;
}

test('keyboard alignment and hand dwell/depth routes perform the same continuous doses',()=>{
  const keyboard=equivalentDose('keyboard'),hand=equivalentDose('hand');
  assert.deepEqual(hand.state,keyboard.state);assert.equal(keyboard.state.step,2);assert.equal(keyboard.state.history.length,2);assert.equal(keyboard.state.pipette.volume,0);close(keyboard.state.tubes.tube_10_0.volume,10);
  for(const rig of [keyboard,hand]){
    assert.equal(rig.m.flow,false);assert.equal(rig.m.owner,null);close(totalVolume(rig.state),2500);
    for(const event of ['grasp','align','lower','start-flow','finish-flow','withdraw','release','regrasp'])assert.ok(rig.m.history.some(item=>item.action===event),`${event} must occur on the ${rig===keyboard?'keyboard':'hand'} path`);
  }
});


test('a metered stroke moves liquid on successive ticks with the tip seated and records one dose',()=>{
 const rig=makeRig(),{m,state,geometry}=rig;
 grab(rig);m.squeeze(true);m.align('waterBottle');m.setDepth(1);
 assert.equal(m.measuredStroke('aspirate'),false);assert.equal(state.pipette.volume,0);
 m.setDepth(0);m.finishDepth();m.align('stockBottle');m.setDepth(.6);
 assert.equal(m.measuredStroke('aspirate'),false);m.setDepth(1);
 geometry.contactValid=false;assert.equal(m.measuredStroke('aspirate'),false);
 geometry.contactValid=true;assert.equal(m.measuredStroke('aspirate'),true);
 assert.equal(m.measuredStroke('aspirate'),false);assert.equal(state.pipette.volume,0);
 m.releaseMeteredStroke();m.tick(rig.clock);
 for(let i=1;i<=4;i++){
  tick(rig);close(state.pipette.volume,i*.3);close(state.bottles.stockBottle.volume,1000-i*.3);
  assert.equal(m.contact.depth,1);assert.equal(m.setDepth(0),false);assert.equal(state.step,0);
 }
 finishFlow(rig);assert.equal(m.contact,null);close(state.pipette.volume,10);
 m.align('tube_10_0');m.squeeze(true);m.setDepth(1);
 assert.equal(m.measuredStroke('dispense'),true);assert.equal(m.measuredStroke('dispense'),false);
 for(let i=1;i<=4;i++){
  tick(rig);close(state.pipette.volume,10-i*.3);close(state.tubes.tube_10_0.volume,i*.3);
  assert.equal(m.contact.depth,1);assert.equal(state.step,1);
 }
 finishFlow(rig);assert.equal(m.contact.depth,1,'A held press keeps the tip seated after delivery');
 m.releaseMeteredStroke();assert.equal(m.contact,null);
 assert.equal(state.history.length,2);close(state.tubes.tube_10_0.volume,10);close(totalVolume(state),2500);
});

test('switching from a partial hand draw to a mouse stroke meters only the remainder',()=>{
 const rig=makeRig(),{m,state}=rig;
 startAspiration(rig,'hand');tick(rig);close(state.pipette.volume,.3);m.suspend();
 assert.equal(m.measuredStroke('aspirate'),false);
 grab(rig,'pipette','mouse');m.endMousePress();m.setDepth(0);m.finishDepth();
 m.align('stockBottle');m.squeeze(true);m.setDepth(1);
 assert.ok(m.measuredStroke('aspirate'));m.releaseMeteredStroke();finishFlow(rig);assert.equal(state.step,1);
 close(state.pipette.volume,10);close(state.bottles.stockBottle.volume,990);close(totalVolume(state),2500);
});

test('an interrupted touch delivery preserves both liquid levels and resumes only the remaining dose',()=>{
 const rig=makeRig(),{m,state}=rig;next(state);
 const deliver=()=>{m.align('tube_10_0');m.squeeze(true);m.setDepth(1);assert.ok(m.measuredStroke('dispense'));m.releaseMeteredStroke()};
 grab(rig,'pipette','touch');deliver();m.tick(rig.clock);tick(rig);tick(rig);m.suspend();
 for(let i=0;i<12;i++)tick(rig);
 close(state.pipette.volume,9.4);close(state.tubes.tube_10_0.volume,.6);assert.equal(state.step,1);
 grab(rig,'pipette','touch');m.setDepth(0);m.finishDepth();deliver();finishFlow(rig);
 assert.equal(m.contact,null);assert.equal(state.history.length,2);close(state.pipette.volume,0);
 close(state.tubes.tube_10_0.volume,10);close(totalVolume(state),2500);
});

test('the meniscus climbs from the tip to the etched divisions and the 10 mL mark',()=>{
 close(pipetteLevel(0),0);
 assert.ok(pipetteLevel(.1)>0&&pipetteLevel(.1)<pipetteLevel(.2));
 for(const ml of [.2,1,2,5,8,10])close(pipetteLevel(ml),.2+.125*ml);
 close(pipetteLevel(10+1e-12),1.45);
});

test('losing physical contact during a metered draw freezes the partial volume',()=>{
 const rig=makeRig(),{m,state,geometry}=rig;
 grab(rig);m.align('stockBottle');m.squeeze(true);m.setDepth(1);
 assert.ok(m.measuredStroke('aspirate'));m.releaseMeteredStroke();m.tick(rig.clock);tick(rig);
 geometry.contactValid=false;tick(rig);assert.equal(m.flow,false);assert.equal(m.owner,null);
 tick(rig);close(state.pipette.volume,.3);assert.equal(state.history.length,0);
});
