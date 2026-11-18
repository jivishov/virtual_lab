import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyHand,GraspGate,OneEuro,GRASP_DEFAULTS} from '../src/grasp-core.js';

const v=(x,y,z=0)=>({x,y,z});
const fingerIndices=[[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]];
// Anatomical 21-landmark fixtures: wrist, four thumb joints and four joints per finger.
function openHand(){return [
  v(0,0),v(-.22,-.10),v(-.40,-.25),v(-.58,-.38),v(-.75,-.48),
  v(-.30,-.65),v(-.33,-1.02),v(-.35,-1.25),v(-.37,-1.44),
  v(0,-.72),v(0,-1.13),v(0,-1.40),v(0,-1.60),
  v(.27,-.67),v(.29,-1.04),v(.31,-1.27),v(.33,-1.46),
  v(.49,-.57),v(.55,-.84),v(.58,-1.03),v(.61,-1.19)
]}
function bendFinger(hand,index,tight=false){
  const [mcp,pip,dip,tip]=fingerIndices[index],base=hand[mcp],size=index===3?.8:1;
  const offsets=tight?[[0,-.22,.15],[0,-.10,.33],[0,.05,.27]]:[[0,-.30,.12],[0,-.40,.30],[0,-.32,.42]];
  [pip,dip,tip].forEach((id,i)=>{hand[id]=v(base.x+offsets[i][0]*size,base.y+offsets[i][1]*size,base.z+offsets[i][2]*size)});
}
function gripHand(tight=false){const h=openHand();for(let i=0;i<4;i++)bendFinger(h,i,tight);return h}
function pointHand(){const h=openHand();for(let i=1;i<4;i++)bendFinger(h,i);return h}
function pinchHand(){const h=openHand();bendFinger(h,0);h[4]={...h[8]};return h}
function imageOf(world){return world.map(p=>v(.5+p.x*.21,.6+p.y*.21,p.z*.21))}
function classify(world){return classifyHand(imageOf(world),world)}
function transform(points,{scale=1,rx=0,ry=0,rz=0,tx=0,ty=0,tz=0}={}){
  return points.map(p=>{
    let{x,y,z}=p;[y,z]=[y*Math.cos(rx)-z*Math.sin(rx),y*Math.sin(rx)+z*Math.cos(rx)];
    [x,z]=[x*Math.cos(ry)+z*Math.sin(ry),-x*Math.sin(ry)+z*Math.cos(ry)];
    [x,y]=[x*Math.cos(rz)-y*Math.sin(rz),x*Math.sin(rz)+y*Math.cos(rz)];
    return v(x*scale+tx,y*scale+ty,z*scale+tz);
  });
}
const frame=(pose,handedness='Right')=>({pose,valid:true,handedness});
function arm(gate,start=0,hand='Right'){
  gate.update(frame('open',hand),start);
  const result=gate.update(frame('open',hand),start+GRASP_DEFAULTS.openMs);
  assert.equal(result.armed,true);assert.equal(result.edge,null);
  return start+GRASP_DEFAULTS.openMs;
}
function grab(gate,start=0,hand='Right'){
  const now=arm(gate,start,hand)+20;gate.update(frame('grip',hand),now);
  const result=gate.update(frame('grip',hand),now+GRASP_DEFAULTS.gripMs);
  assert.equal(result.edge,'grab');assert.equal(result.armed,false);
  return now+GRASP_DEFAULTS.gripMs;
}

test('21-point fixtures distinguish open, relaxed whole-hand grip, tight fist and pointing',()=>{
  assert.equal(classify(openHand()).pose,'open');
  const relaxed=classify(gripHand()),tight=classify(gripHand(true));
  assert.equal(relaxed.pose,'grip');assert.equal(tight.pose,'grip');
  assert.ok(relaxed.gripStrength>.28);assert.ok(tight.gripStrength>relaxed.gripStrength);
  assert.equal(classify(pointHand()).pose,'point');
});

test('pinching thumb and index with other fingers extended neither grabs nor releases',()=>{
  const result=classify(pinchHand());assert.equal(result.valid,true);assert.equal(result.pose,'neutral');
  const nearlyStraight=openHand();nearlyStraight[4]={...nearlyStraight[8]};
  assert.equal(classify(nearlyStraight).pose,'neutral');
  const g=new GraspGate();let now=grab(g);
  for(let i=0;i<20;i++){now+=33;assert.equal(g.update({...result,handedness:'Right'},now).edge,null)}
  assert.equal(g.holding,true,'A pinch does not synthesize a carried-object release');
});

test('classification is invariant under 3D rotation, translation, reflection and uniform scale',()=>{
  const fixtures=[['open',openHand()],['grip',gripHand()],['grip',gripHand(true)],['point',pointHand()],['neutral',pinchHand()]];
  const transforms=[{scale:.025,rx:.6,ry:-.5,rz:1.1,tx:.25,ty:-.3,tz:.1},{scale:2.5,rx:-1.2,ry:.9,rz:-2.2,tx:9,ty:3,tz:-4},{scale:.003,rx:.2,ry:1.4,rz:Math.PI}];
  for(const[expected,hand]of fixtures){
    const baseline=classify(hand);
    for(const t of transforms){
      const moved=transform(hand,t),result=classifyHand(imageOf(hand),moved);
      assert.equal(result.valid,true);assert.equal(result.pose,expected);
      // acos near a perfectly straight joint amplifies floating-point roundoff.
      assert.ok(Math.abs(result.gripStrength-baseline.gripStrength)<1e-7);
    }
    assert.equal(classify(hand.map(p=>v(-p.x,p.y,p.z))).pose,expected);
  }
});

test('palm cursor and roll ignore thumb/fingertip motion; normalized fallback remains usable',()=>{
  const open=openHand(),grip=gripHand(),before=classify(open),after=classify(grip);
  assert.equal(before.palmX,after.palmX);assert.equal(before.palmY,after.palmY);assert.equal(before.roll,after.roll);
  const turned=transform(open,{rz:Math.PI/2}),r=classify(turned);
  assert.ok(Math.abs(r.roll-Math.PI/2)<1e-10);
  assert.equal(classifyHand(imageOf(grip)).pose,'grip');
});

test('small landmark jitter preserves intent through the complete open-grab-carry-release sequence',()=>{
  const gate=new GraspGate(),edges=[];
  for(let tick=0;tick<=60;tick++){
    const hand=tick<12?openHand():tick<42?gripHand():openHand();
    const noisy=hand.map((p,i)=>v(p.x+Math.sin(tick+i*3)*.001,p.y+Math.cos(tick*2+i)*.001,p.z+Math.sin(tick*3+i)*.001));
    const measured=classify(noisy),result=gate.update({...measured,handedness:'Right'},tick*20);
    assert.equal(measured.pose,tick<12||tick>=42?'open':'grip');
    if(result.edge)edges.push(result.edge);
  }
  assert.deepEqual(edges,['grab','release']);
  assert.equal(gate.holding,false);assert.equal(gate.armed,true);
});

test('missing, nonfinite and collapsed landmarks are rejected',()=>{
  assert.equal(classifyHand([]).valid,false);
  const hand=openHand(),bad=structuredClone(hand);bad[12].z=NaN;
  assert.equal(classifyHand(imageOf(hand),bad).valid,false);
  assert.equal(classifyHand(imageOf(hand),[]).valid,false);
  assert.equal(classifyHand(Array.from({length:21},()=>v(0,0)),hand).valid,false);
  assert.equal(classifyHand(imageOf(hand),Array.from({length:21},()=>v(0,0))).valid,false);
  const collapsed=openHand();collapsed[6]={...collapsed[5]};
  assert.equal(classify(collapsed).valid,false);
});

test('initial closed hand never grabs until a fresh stable open hand arms the gate',()=>{
  const g=new GraspGate();for(let now=0;now<=600;now+=60){const r=g.update(frame('grip'),now);assert.equal(r.edge,null);assert.equal(r.armed,false)}
  g.update(frame('open'),620);assert.equal(g.update(frame('open'),779).armed,false);assert.equal(g.update(frame('open'),780).armed,true);
  g.update(frame('grip'),800);assert.equal(g.update(frame('grip'),939).edge,null);assert.equal(g.update(frame('grip'),940).edge,'grab');
  assert.equal(g.update(frame('grip'),970).edge,null,'A stable grip emits only one edge');
});

test('brief pose jitter cannot grab or release; neutral and pointing preserve a carried grip',()=>{
  const g=new GraspGate();let now=arm(g);
  for(const pose of ['grip','neutral','grip','open','grip']){now+=40;assert.equal(g.update(frame(pose),now).edge,null)}
  now+=140;assert.equal(g.update(frame('grip'),now).edge,'grab');
  for(const pose of ['open','neutral','point','open','grip','neutral']){now+=60;assert.equal(g.update(frame(pose),now).edge,null)}
  assert.equal(g.holding,true);
  now+=20;g.update(frame('open'),now);assert.equal(g.update(frame('open'),now+159).edge,null);assert.equal(g.update(frame('open'),now+160).edge,'release');
  assert.equal(g.update(frame('open'),now+190).edge,null,'A stable open hand releases only once');
});

test('loss and reacquisition never fabricate a release or a new grab',()=>{
  const g=new GraspGate();const now=grab(g);
  const lost=g.update({valid:false},now+33);assert.deepEqual(lost,{pose:'neutral',edge:null,armed:false,valid:false});
  for(const t of [now+60,now+120,now+200]){const r=g.update(frame('grip'),t);assert.equal(r.edge,null);assert.equal(r.armed,false)}
  g.update(frame('open'),now+220);assert.equal(g.update(frame('open'),now+380).armed,true);
  g.update(frame('grip'),now+400);assert.equal(g.update(frame('grip'),now+540).edge,'grab');
});

test('brief missing evidence restarts open and grip debounce instead of counting an unseen interval',()=>{
  const g=new GraspGate();
  g.update(frame('open'),0);assert.equal(g.update(frame('open'),100).armed,false);
  g.interruptEvidence();
  assert.equal(g.update(frame('open'),160).armed,false);
  assert.equal(g.update(frame('open'),319).armed,false);
  assert.equal(g.update(frame('open'),320).armed,true);
  g.update(frame('grip'),340);assert.equal(g.update(frame('grip'),440).edge,null);
  g.interruptEvidence();assert.equal(g.armed,true,'A brief miss preserves prior open-hand arming');
  assert.equal(g.update(frame('grip'),480).edge,null);
  assert.equal(g.update(frame('grip'),619).edge,null);
  assert.equal(g.update(frame('grip'),620).edge,'grab');
});

test('brief missing evidence preserves a held grip but requires a complete newly observed release',()=>{
  const g=new GraspGate();const now=grab(g);
  g.update(frame('open'),now+20);assert.equal(g.update(frame('open'),now+140).edge,null);
  g.interruptEvidence();assert.equal(g.holding,true);assert.equal(g.armed,false);
  assert.equal(g.update(frame('open'),now+190).edge,null,'An open observation across a miss cannot finish the old debounce');
  assert.equal(g.update(frame('open'),now+349).edge,null);assert.equal(g.holding,true);
  assert.equal(g.update(frame('open'),now+350).edge,'release');assert.equal(g.holding,false);
});

test('interrupting evidence does not erase timestamp or identity continuity checks',()=>{
  const g=new GraspGate();const now=grab(g);g.interruptEvidence();
  assert.equal(g.update(frame('open'),now).valid,false,'Duplicate packets remain stale after an evidence interruption');
  assert.equal(g.holding,false);assert.equal(g.armed,false);
  const h=new GraspGate();const t=grab(h);h.interruptEvidence();
  const gap=h.update(frame('open'),t+351);
  assert.equal(gap.valid,false);assert.equal(gap.edge,null);assert.equal(h.holding,false);
  const k=new GraspGate();const u=grab(k);k.interruptEvidence();
  const switched=k.update(frame('open','Left'),u+20);
  assert.equal(switched.valid,false);assert.equal(switched.edge,null);assert.equal(k.holding,false);
});

test('hand identity changes require a new open-arm sequence even when both hands are closed',()=>{
  const g=new GraspGate();const now=grab(g);
  assert.equal(g.update(frame('grip','Left'),now+30).valid,false);
  assert.equal(g.update(frame('grip','Left'),now+200).edge,null);
  g.update(frame('open','Left'),now+220);assert.equal(g.update(frame('open','Left'),now+380).armed,true);
  g.update(frame('grip','Left'),now+400);assert.equal(g.update(frame('grip','Left'),now+540).edge,'grab');
});

test('duplicate/backward timestamps and long gaps invalidate without edges and keep a stale-packet watermark',()=>{
  for(const badTime of [320,300,701]){
    const g=new GraspGate();assert.equal(grab(g),320);
    const bad=g.update(frame('open'),badTime);assert.equal(bad.valid,false);assert.equal(bad.edge,null);assert.equal(bad.armed,false);
    const baseline=Math.max(320,badTime);assert.equal(g.update(frame('open'),baseline-1).valid,false);
    g.update(frame('grip'),baseline+20);assert.equal(g.update(frame('grip'),baseline+200).edge,null);
    g.update(frame('open'),baseline+220);assert.equal(g.update(frame('open'),baseline+380).armed,true);
  }
});

test('explicit reset and configurable debounce durations are enforced',()=>{
  const g=new GraspGate({openMs:50,gripMs:60,releaseMs:70,maxGapMs:200});
  g.update(frame('open'),0);assert.equal(g.update(frame('open'),50).armed,true);
  g.update(frame('grip'),60);assert.equal(g.update(frame('grip'),120).edge,'grab');
  g.reset();assert.equal(g.update(frame('open'),0).edge,null);assert.equal(g.armed,false);assert.equal(g.holding,false);
  assert.throws(()=>new GraspGate({gripMs:0}));assert.throws(()=>new GraspGate({maxGapMs:NaN}));
});

test('One Euro smoothing reduces stationary jitter, rejects stale input and resets across long gaps',()=>{
  const f=new OneEuro();assert.equal(f.update(.5,0),.5);let maxDeviation=0;
  for(let i=1;i<=30;i++){const out=f.update(i%2?.51:.49,i*16);maxDeviation=Math.max(maxDeviation,Math.abs(out-.5))}
  assert.ok(maxDeviation<.01,'Filtered jitter is smaller than raw ±.01 motion');
  const previous=f.x;assert.equal(f.update(1,100),previous);assert.equal(f.update(NaN,600),previous);
  assert.equal(f.update(.8,1000),.8,'A new tracking interval starts at its current position');
  f.reset();assert.equal(f.update(.1,1),.1);assert.throws(()=>new OneEuro(0));
});
