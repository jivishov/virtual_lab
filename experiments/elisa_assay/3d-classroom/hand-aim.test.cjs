const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const core=require('./hand-core.js');
const {Interaction,HAND_AIM}=require('./interaction.js');
const {Protocol}=require('./protocol.js');
const framing=require('./framing.js');

// Screen-space bench shaped like the default working view: wells 33 px apart with a 15 px radius, the second strip
// 75 px lower, and the reagent rack's second row 43 px below the first.
function bench(){
  const targets=[];
  for(let i=1;i<=12;i++)targets.push({id:i,kind:'well',label:'Well '+i,x:408+(i-1)*33,y:431,r:15});
  for(let i=13;i<=24;i++)targets.push({id:i,kind:'well',label:'Well '+i,x:399+(i-13)*35.7,y:506,r:16});
  for(let i=1;i<=24;i++){const w=targets[i-1];targets.push({id:'label'+i,kind:'label',label:'Label pad '+i,x:w.x,y:w.y+22,r:15});}
  ['DIL','AG','POS','NEG','P1'].forEach((id,i)=>targets.push({id,kind:'reagent',label:id,x:193+i*46,y:310,r:18}));
  ['AB1','AB2','TMB','STOP','P2'].forEach((id,i)=>targets.push({id,kind:'reagent',label:id,x:177+i*48.2,y:353,r:19}));
  targets.push({id:'tips',kind:'tips',x:513,y:271,r:21},{id:'WASH',kind:'wash',x:887,y:315,r:48},{id:'waste',kind:'waste',x:239,y:541,r:64},{id:'towels',kind:'towels',x:916,y:568,r:72});
  targets.push({id:'stand:micro',kind:'stand',x:1100,y:420,r:30},{id:'stand:marker',kind:'stand',x:420,y:640,r:28},{id:'home1',kind:'home',x:590,y:454,r:26});
  const pick=(x,y,filter,source,opts={})=>{const hits=[];for(const t of targets){if(!filter(t))continue;const d=Math.hypot(x-t.x,y-t.y)/(t.r*(source==='hand'?1.2:1));if(d<1)hits.push({t,d:t.id===opts.prefer?d*.72:d});}hits.sort((a,b)=>a.d-b.d);return hits[0]?.t||null;};
  return {targets,pick,screen:t=>({x:t.x,y:t.y,r:t.r*1.2}),at:id=>targets.find(t=>t.id===id)};
}
function labelled(){const p=new Protocol();for(let i=1;i<=24;i++)p.dispatch({type:'label',target:i});return p;} // buffer step
function loaded(){const p=labelled();p.dispatch({type:'attach'});p.dispatch({type:'aspirate',target:'DIL'});return p;}
function advanceTo(p,phase){for(let n=0;p.phase!==phase&&n<2000;n++){const a=p.recommend();if(a.type==='wait')p.tick(300);else p.dispatch(a);}assert.equal(p.phase,phase);return p;}
function rig(p=loaded(),tool='micro'){
  const b=bench(),messages=[],rejects=[];
  const c=new Interaction({protocol:()=>p,pick:b.pick,screen:b.screen,say:(s,e)=>messages.push({s,e}),reject:(a,e)=>rejects.push(e)});
  c.select(tool);return {p,c,b,messages,rejects};
}
// Palm height drives insertion depth (0.042 = fully in); the aim dot moves down with the palm, as it does on screen.
const PX=700;
const hand=(now,x,y,palmY=.40,extra={})=>({x,y,rawX:x/1400,palmY,now,source:'hand',ready:true,grip:true,hold:false,open:false,thumbDepth:0,...extra});
function still(c,now,x,y,ms,palmY,extra){let t=now;for(;t<=now+ms;t+=33)c.feed(hand(t,x,y,palmY,extra));return t;}
function lower(c,now,x,y,to,from=.40,extra){for(let i=1;i<=6;i++){now+=33;const py=from+(to-from)*i/6;c.feed(hand(now,x,y+(py-from)*PX,py,extra));}return now;}

test('sweeping along a strip at an ordinary aiming speed never locks the wells passed over',()=>{
  const {c,b}=rig();let now=0;const locked=new Set();
  for(let x=b.at(2).x;x<=b.at(8).x;x+=4){c.feed(hand(now,x,431));if(c.contact)locked.add(c.contact.target.id);now+=33;} // about 120 px/s
  assert.deepEqual([...locked],[],'no well may lock while the aim is still travelling');
  still(c,now,b.at(8).x,431,HAND_AIM.settleMS+40);assert.equal(c.contact?.target.id,8);
});

test('a wrong lock is left by staying on the neighbour, which then takes the delivery with nothing cancelled',()=>{
  const {p,c,b}=rig();const w3=b.at(3),w4=b.at(4);
  let now=still(c,0,w3.x,431,200);assert.equal(c.contact?.target.id,3);
  now+=33;c.feed(hand(now,w4.x-2,431));assert.equal(c.contact?.target.id,3,'a brief excursion keeps the lock');
  now=still(c,now+33,w4.x-2,431,HAND_AIM.exitMS);assert.equal(c.contact,null,'staying on the neighbour releases the lock');
  now=still(c,now,w4.x-2,431,200);assert.equal(c.contact?.target.id,4);
  now=lower(c,now,w4.x-2,431,.44);assert.ok(c.contact.depth>=.85);c.press(hand(now+5,w4.x-2,459,.44,{thumbDepth:1}));
  assert.equal(p.well(4).volume,50);assert.equal(p.well(3).volume,0);assert.equal(c.stats.cancelled,0);
});

test('lowering straight after a brief pause keeps the paused tube instead of the rack row below',()=>{
  const p=labelled();p.dispatch({type:'attach'});const {c,b}=rig(p);const dil=b.at('DIL');
  c.feed(hand(0,dil.x,dil.y));c.press(hand(5,dil.x,dil.y,.40,{thumbDepth:1}));assert.equal(c.pending?.kind,'armed','the plunger is pressed in the air first');
  let now=still(c,33,dil.x,dil.y,66);assert.equal(c.contact,null,'too brief to settle');
  let palm=.40,y=dil.y;for(let i=0;i<8;i++){now+=33;palm+=.006;y+=.006*PX;c.feed(hand(now,dil.x,y,palm,{thumbDown:true}));}
  assert.equal(b.pick(dil.x,y,t=>t.kind==='reagent','hand')?.id,'AB1','the aim itself has slid onto the tube below');
  assert.equal(c.contact?.target.id,'DIL');assert.ok(c.contact.depth>=.85);assert.equal(c.pending?.kind,'draw');
  c.release(hand(now+10,dil.x,y,palm));
  assert.equal(p.tip.volume,50);assert.equal(p.reagents.DIL.volume,950);assert.equal(p.reagents.AB1.volume,1300);
});

test('a sustained lift releases a lock without cancelling, and the same well waits before re-locking',()=>{
  const {c,b}=rig();const w5=b.at(5);
  let now=still(c,0,w5.x,431,200);assert.equal(c.contact?.target.id,5);
  now=still(c,now,w5.x,431,100,.36);assert.equal(c.contact?.target.id,5,'a brief rise keeps the lock');
  let released=null;for(let i=0;i<20&&released===null;i++){c.feed(hand(now,w5.x,431,.36));if(!c.contact)released=now;now+=33;}
  assert.ok(released!==null);assert.equal(c.stats.cancelled,0);
  for(;now<released+HAND_AIM.relockMS-40;now+=33)c.feed(hand(now,w5.x,431,.36));assert.equal(c.contact,null,'no instant re-lock');
  still(c,now,w5.x,431,200,.36);assert.equal(c.contact?.target.id,5);
});

test('a plunger pressed before the aim locks binds to the opening that locks, and a rejected lock stays armed',()=>{
  const p=labelled();p.dispatch({type:'attach'});const {c,b,messages,rejects}=rig(p);
  let now=0;c.feed(hand(now,650,650));c.press(hand(now+5,650,650,.40,{thumbDepth:1}));assert.equal(c.pending?.kind,'armed');
  now=still(c,now+33,b.at(3).x,431,200);assert.equal(c.contact?.target.id,3);assert.equal(c.pending?.kind,'armed');assert.ok(messages.some(m=>m.e));assert.equal(rejects.length,0,'an automatic lock is not logged as a correction');
  const dil=b.at('DIL');for(let k=1;k<=12;k++){now+=33;c.feed(hand(now,b.at(3).x+(dil.x-b.at(3).x)*k/12,431+(dil.y-431)*k/12));}
  now=still(c,now+33,dil.x,dil.y,HAND_AIM.exitMS+250);assert.equal(c.contact?.target.id,'DIL');assert.equal(c.pending?.kind,'draw');
  now=lower(c,now,dil.x,dil.y,.44);c.release(hand(now+5,dil.x,dil.y+28,.44));
  assert.equal(p.tip.volume,50);assert.equal(p.reagents.DIL.volume,950);assert.equal(p.well(3).volume,0);
});

test('pressing with an empty tip already in the liquid is refused as bubbles; lifting out pressed, lowering and releasing draws',()=>{
  const p=labelled();p.dispatch({type:'attach'});const {c,b,rejects}=rig(p);const dil=b.at('DIL');
  let now=still(c,0,dil.x,dil.y,200);now=lower(c,now,dil.x,dil.y,.44);assert.ok(c.contact.depth>=.85);
  c.press(hand(now+5,dil.x,dil.y+28,.44,{thumbDepth:1}));assert.equal(c.pending?.kind,'bubbles');assert.equal(rejects[0]?.code,'plunger');
  now=lower(c,now+10,dil.x,dil.y,.405,.44);assert.equal(c.pending?.kind,'draw','lifting out with the plunger pressed re-arms the stroke');
  now=lower(c,now,dil.x,dil.y,.44,.405);c.release(hand(now+5,dil.x,dil.y+28,.44));
  assert.equal(p.tip.volume,50);assert.equal(p.reagents.DIL.volume,950);
});

test('a serial-dilution well is mixed by pressing and releasing with the tip kept in the liquid',()=>{
  const p=advanceTo(labelled(),'serial');if(!p.tip)p.dispatch({type:'attach'});p.dispatch({type:'aspirate',target:1});
  const {c,b}=rig(p);const w2=b.at(2);
  let now=still(c,0,w2.x,431,200);now=lower(c,now,w2.x,431,.44);c.press(hand(now+5,w2.x,459,.44,{thumbDepth:1}));
  assert.equal(p.serialMixWell,2);assert.equal(p.tip.volume,0);
  c.release(hand(now+40,w2.x,459,.44));assert.equal(p.tip.volume,50,'releasing inside draws the liquid back up');
  for(let k=0;k<5;k++){c.feed(hand(now+=33,w2.x,459,.44));c.press(hand(now+=5,w2.x,459,.44,{thumbDepth:1}));c.feed(hand(now+=33,w2.x,459,.44));if(k<4)c.release(hand(now+=5,w2.x,459,.44));}
  assert.equal(p.well(2).mixes,5);assert.equal(p.serialFrom,2);assert.equal(p.serialMixWell,null);
});

test('a tool is put away at its own stand with an open palm; an open hand elsewhere only pauses handling',()=>{
  const {c,b,messages}=rig();
  let now=still(c,0,700,650,900,.40,{open:true,grip:false});assert.equal(c.tool,'micro','an open hand in mid-air keeps the pipette');
  assert.ok(messages.some(m=>/stand/.test(m.s)),'the learner is told where the stand is');
  still(c,now,b.at('stand:micro').x,b.at('stand:micro').y,600,.40,{open:true,grip:false});assert.equal(c.tool,'navigate');
});

test('towel taps still drain an inverted strip and refuse an upright one',()=>{
  for(const inverted of [true,false]){
    const p=advanceTo(labelled(),'wash1'),{c,b,messages}=rig(p,'strip1'),towels=b.at('towels'),n={normal:inverted?[0,0,-1]:[0,0,1]};
    c.feed(hand(0,700,650,.40,{normal:[0,0,1]}));
    let now=still(c,33,towels.x,towels.y,200,.40,n);assert.equal(c.inverted,inverted);assert.equal(c.contact?.target.id,'towels');
    for(let tap=0;tap<4;tap++){now=lower(c,now,towels.x,towels.y,.445,.40,n);now=lower(c,now,towels.x,towels.y,.40,.445,n);}
    if(inverted){assert.deepEqual(p.drainedStrips,[1]);assert.equal(c.tapDone,true);}
    else{assert.deepEqual(p.drainedStrips,[]);assert.ok(messages.some(m=>m.e&&/Invert the strip/.test(m.s)));}
    assert.equal(c.stats.cancelled,0);
  }
});

test('the marker writes only on a locked pad with the nib lowered; passing over pads with a closed grip writes nothing',()=>{
  const {p,c,b}=rig(new Protocol(),'marker');
  let now=0;for(let x=b.at('label1').x;x<=b.at('label6').x;x+=4)c.feed(hand(now+=33,x,b.at('label1').y,.40,{hold:true})); // about 120 px/s across six pads
  assert.deepEqual(p.labels,[],'pads passed over are never written on');
  const pad=b.at('label3');now=still(c,now+33,pad.x,pad.y,200);assert.equal(c.contact?.target.id,'label3');
  for(let k=1;k<=4;k++)c.feed(hand(now+=33,pad.x+k*3,pad.y,.40));assert.deepEqual(p.labels,[],'a stroke in the air does not write');
  now=lower(c,now,pad.x,pad.y,.43);assert.ok(c.contact.depth>=.5,'the nib is down');
  for(let k=1;k<=4;k++)c.feed(hand(now+=33,pad.x+k*3,pad.y+21,.43));
  assert.deepEqual(p.labels,[3]);
});

test('the marker is laid down by a palm-down turn of the open hand, not by merely opening it',()=>{
  const {c}=rig(new Protocol(),'marker');
  c.feed(hand(0,700,650,.40,{normal:[0,0,1]}));
  const now=still(c,33,700,650,500,.40,{open:true,grip:false,normal:[0,0,1]});assert.equal(c.tool,'marker');
  still(c,now,700,650,500,.40,{open:true,grip:false,normal:[0,1,0]});assert.equal(c.tool,'navigate');
});

test('releasing the plunger inside a well after delivering is a technique correction when no draw-back is allowed',()=>{
  const {p,c,b,rejects}=rig();const w2=b.at(2);
  let now=still(c,0,w2.x,431,200);now=lower(c,now,w2.x,431,.44);c.press(hand(now+5,w2.x,459,.44,{thumbDepth:1}));assert.equal(p.well(2).volume,50);
  c.release(hand(now+40,w2.x,459,.44));
  assert.equal(p.well(2).volume,50);assert.equal(p.tip.volume,0);assert.equal(rejects.at(-1)?.code,'plunger');
  const ok=rig();let t=still(ok.c,0,w2.x,431,200);t=lower(ok.c,t,w2.x,431,.44);ok.c.press(hand(t+5,w2.x,459,.44,{thumbDepth:1}));
  t=lower(ok.c,t+10,w2.x,431,.39,.44);ok.c.release(hand(t+5,w2.x,431,.39));assert.equal(ok.rejects.length,0,'lifting out before releasing is correct technique');
});

test('mouse strokes still fit a tip, draw, deliver and mix without hand-only rules',()=>{
  const p=labelled(),{c,b}=rig(p);const m=(t,x,y,extra={})=>({x,y,now:t,source:'mouse',ready:true,...extra});
  const stroke=(id,dy)=>{const t=b.at(id);c.mouseDown(m(0,t.x,t.y));c.feed(m(10,t.x,t.y+dy,{dragY:dy}));c.mouseUp(m(20,t.x,t.y+dy,{dragY:dy}));};
  stroke('tips',30);assert.ok(p.tip);stroke('DIL',30);assert.equal(p.tip.volume,50);stroke(2,30);assert.equal(p.well(2).volume,50);
});

// Camera level: the v3 webcam with ELISA's controller.
function camera(){
  let now=0;const shape={open:false,folded:true,thumb:0,palmY:.40,valid:true};
  const context=vm.createContext({ClassroomCore:{...core},performance:{now:()=>now},console,setTimeout,clearTimeout,setInterval,clearInterval,cancelAnimationFrame:()=>{},window:{},isSecureContext:true,navigator:{},location:{protocol:'https:'}});
  vm.runInContext(fs.readFileSync(require.resolve('./camera.js'),'utf8'),context);
  context.ClassroomCore.measureHand=()=>({features:shape.valid?Array(7).fill(shape.thumb):[shape.thumb,0,0,0,0,0,3],palmX:.5,palmY:shape.palmY,grip:shape.folded,open:shape.open,pinchRatio:1,extended:shape.open?4:0,normal:[0,0,1],rotation:[0,0,0]});
  const overlay={width:640,height:480,getContext:()=>({clearRect(){}})};
  const cam=new context.ClassroomWebcam({video:{pause(){},play:async()=>{}},overlay,bounds:()=>({width:1180,height:848}),active(){},status(){},lost(){},frame(){},edge(){},meter(){}});
  cam.draw=()=>{};cam.running=true;cam.modelReady=true;cam.profiles={rest:Array(7).fill(0),press:Array(7).fill(1)};cam.calibrationHand='Right';
  const lm=Array.from({length:21},()=>({x:.5,y:.5,z:0}));
  const send=(t,changes={})=>{now=t;Object.assign(shape,changes);cam.result({stamp:t,inferenceMS:20,landmarks:[lm],worldLandmarks:[lm],handedness:[[{categoryName:'Right',score:.99}]]});};
  now=1000;cam.lastSeen=1000;return {cam,send};
}
function drawing(){
  const p=labelled();p.dispatch({type:'attach'});const DIL={id:'DIL',kind:'reagent',x:600,y:400,r:18};
  const c=new Interaction({protocol:()=>p,pick:()=>DIL,screen:()=>DIL});c.select('micro');
  const {cam,send}=camera();cam.o.frame=f=>{f.x=600;f.y=400;c.feed(f);};cam.o.edge=(e,f)=>c[e](f);cam.o.lost=()=>c.resetMotion();
  let t=1000;for(;t<1300;t+=33)send(t);assert.ok(c.contact,'settled aim locks');
  for(;t<1450;t+=33)send(t,{thumb:1});assert.equal(c.pending?.kind,'draw');
  for(;t<1600;t+=33)send(t,{palmY:.446});assert.ok(c.contact.depth>=.85);
  return {p,c,send,t};
}
test('one-frame grip, open-hand or thumb misreads during a draw do not cancel it',()=>{
  let {p,c,send,t}=drawing();
  send(t+=33,{folded:false});send(t+=33,{folded:true});send(t+=33,{valid:false});send(t+=33,{valid:true});send(t+=33,{open:true});send(t+=33,{open:false});
  assert.equal(c.pending?.kind,'draw');assert.equal(c.stats.cancelled,0);
  for(let i=0;i<4;i++)send(t+=33,{thumb:0});
  assert.equal(p.tip.volume,50);assert.equal(p.reagents.DIL.volume,950);
});
test('a sustained open hand ends the stroke with nothing transferred',()=>{
  let {p,c,send,t}=drawing();for(let i=0;i<10;i++)send(t+=33,{open:true});
  assert.equal(c.pending,null);for(let i=0;i<4;i++)send(t+=33,{open:false,thumb:0});assert.equal(p.tip.volume,0);assert.equal(p.reagents.DIL.volume,1000);
});
test('a file:// page loads the hand tracker from the Virtual Lab ELISA copy; a served page uses only the bundled copy',()=>{
  for(const [protocol,expect] of [['file:','virtuallab.az/experiments/elisa_assay/vendor/mediapipe/'],['https:','/elisa_assay/vendor/mediapipe/']]){
    const ctx=vm.createContext({ClassroomCore:{...core},performance,console,window:{},location:{protocol},document:{baseURI:'https://example.test/experiments/elisa_assay/elisa-3d.html'},URL});
    vm.runInContext(fs.readFileSync(require.resolve('./camera.js'),'utf8'),ctx);
    const src=new ctx.ClassroomWebcam({video:{},overlay:{}}).sources();assert.ok(src[0].bundle.includes(expect),src[0].bundle);
    if(protocol==='https:')assert.equal(src.length,1);
  }
});

test('the palm anchor ignores the thumb, so a plunger press does not move the aim',()=>{
  const world=[[0,0,0],[.02,.01,0],[.035,.025,0],[.045,.04,0],[.05,.055,0],[.015,.08,0],[.015,.11,0],[.015,.13,0],[.015,.145,0],[0,.085,0],[0,.115,0],[0,.135,0],[0,.15,0],[-.015,.08,0],[-.015,.105,0],[-.015,.125,0],[-.015,.14,0],[-.03,.07,0],[-.03,.09,0],[-.03,.105,0],[-.03,.115,0]].map(([x,y,z])=>({x,y,z}));
  const lm=world.map(v=>({x:.5+v.x,y:.6-v.y,z:0})),a=core.measureHand(world,lm);assert.ok(a);
  const b=core.measureHand(world,lm.map((v,i)=>i>=1&&i<=4?{x:v.x+.03,y:v.y+.04,z:0}:v));
  assert.equal(b.palmX,a.palmX);assert.equal(b.palmY,a.palmY);
});

test('hand settings default to the thumb press and steadier smoothing lowers the filter cutoff',()=>{
  const ctx=vm.createContext({Event,localStorage:{getItem:()=>null,setItem(){}},dispatchEvent(){}});ctx.globalThis=ctx;
  vm.runInContext(fs.readFileSync(require.resolve('./hand-tuning.js'),'utf8'),ctx);
  const T=ctx.ClassroomHandTuning;assert.equal(T.get().mode,'thumb');
  assert.ok(T.filterParams(1).minCutoff<T.filterParams(0).minCutoff);
});

test('auto-framing keeps each ELISA step’s apparatus in view',()=>{
  const p=new Protocol();assert.deepEqual(framing.workSet(p).names,['strips','marker']);
  advanceTo(p,'buffer');assert.ok(framing.workSet(p).names.includes('rack'));
  advanceTo(p,'wash1');assert.ok(framing.workSet(p).names.includes('towels'));
  advanceTo(p,'read');assert.deepEqual(framing.workSet(p).names,['strips']);
});
