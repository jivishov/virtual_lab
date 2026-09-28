const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const core=require('../hand-core.js');
const {Protocol}=require('../protocol.js');
const {Interaction,HAND_AIM}=require('../interaction.js');
function act(p,type,rest={}){return p.dispatch({type,...rest},'test');}
function prepared(){const p=new Protocol();act(p,'tapPlate');act(p,'prepare',{label:'Aim',ppe:true});return p;}
// A screen-space bench: card spots 31 px apart in a row and 24 px between rows, as in the default bench view.
function bench(){
  const targets=[];
  for(const [row,y] of [['A',200],['B',224]])for(let col=1;col<=8;col++)targets.push({id:'spot:'+row+col,kind:'spot',sample:row+col,x:100+(col-1)*31,y,r:13});
  targets.push({id:'EB',kind:'reagent',x:600,y:80,r:15});
  const pick=(x,y,filter,source,opts={})=>{const hits=[];for(const t of targets){if(!filter(t))continue;const d=Math.hypot(x-t.x,y-t.y)/t.r;if(d<1)hits.push({t,d:t.id===opts.prefer?d*.72:d});}hits.sort((a,b)=>a.d-b.d);return hits[0]?.t||null;};
  return {targets,pick,screen:t=>({x:t.x,y:t.y,r:t.r}),spot:id=>targets.find(t=>t.id===id)};
}
function rig(p=prepared()){
  const b=bench(),messages=[];
  const c=new Interaction({protocol:()=>p,pick:b.pick,screen:b.screen,say:(s,e)=>messages.push({s,e})});
  c.select('pipette');return {p,c,b,messages};
}
// Palm height drives insertion depth; the aim dot moves with the palm too, as it does on screen.
const hand=(now,x,y,palmY=.30,extra={})=>({x,y,rawX:x/1400,palmY,now,source:'hand',ready:true,grip:true,open:false,thumbDepth:0,...extra});
function still(c,now,x,y,ms,palmY){let t=now;for(;t<=now+ms;t+=33)c.feed(hand(t,x,y,palmY));return t;}

test('sweeping across card spots at an ordinary aiming speed never locks the spots passed over',()=>{
  const {p,c,b}=rig();act(p,'attach');act(p,'aspirate',{target:'EB'});
  let now=0,locked=new Set();
  for(let x=100;x<=100+31*6;x+=4){c.feed(hand(now,x,200));if(c.contact)locked.add(c.contact.target.id);now+=33;} // about 120 px/s
  assert.deepEqual([...locked],[],'no spot may lock while the aim is still travelling');
  still(c,now,b.spot('spot:A7').x,200,HAND_AIM.settleMS+40);
  assert.equal(c.contact?.target.id,'spot:A7');
});

test('a wrong lock is left by sliding sideways, and the neighbour then accepts the delivery',()=>{
  const {p,c,b}=rig();act(p,'attach');act(p,'aspirate',{target:'EB'});
  const a2=b.spot('spot:A2'),a3=b.spot('spot:A3');
  let now=still(c,0,a2.x,200,200);assert.equal(c.contact?.target.id,'spot:A2');
  now+=33;c.feed(hand(now,a2.x+14,200));assert.equal(c.contact?.target.id,'spot:A2','small sideways drift stays locked');
  now+=33;c.feed(hand(now,a3.x-4,200));assert.equal(c.contact?.target.id,'spot:A2','a brief excursion onto the neighbour keeps the lock');
  now=still(c,now+33,a3.x-4,200,HAND_AIM.exitMS);assert.equal(c.contact,null,'staying on the neighbour releases the lock');assert.equal(c.target.id,'spot:A3');
  now=still(c,now,a3.x-4,200,200);assert.equal(c.contact?.target.id,'spot:A3');
  c.feed(hand(now+33,a3.x-4,200,.346));c.press(hand(now+40,a3.x-4,200,.346,{thumbDepth:1}));
  assert.equal(p.spots.A3.volume,5);assert.equal(p.spots.A2.volume,0);assert.equal(c.stats.cancelled,0);
});

test('creeping slowly onto a neighbour hands the lock over once the aim is nearer that spot',()=>{
  const {p,c,b}=rig();act(p,'attach');act(p,'aspirate',{target:'EB'});
  const a3=b.spot('spot:A3'),a4=b.spot('spot:A4');
  let now=still(c,0,a3.x,200,200);assert.equal(c.contact?.target.id,'spot:A3');
  let released=null;
  for(let x=a3.x;x<=a4.x;x+=1){now+=33;c.feed(hand(now,x,200));if(released===null&&c.contact?.target.id!=='spot:A3')released=x-a3.x;}
  const spacing=a4.x-a3.x;assert.ok(released!==null&&released<spacing,`released after ${released} of ${spacing} px`);
  still(c,now+33,a4.x,200,200);assert.equal(c.contact?.target.id,'spot:A4');
});

test('lowering straight after a brief pause keeps the paused spot instead of the row below',()=>{
  const {p,c,b}=rig();act(p,'attach');act(p,'aspirate',{target:'EB'});
  const a4=b.spot('spot:A4');let now=still(c,0,a4.x,200,99);assert.equal(c.contact,null,'too brief to settle');
  // The palm drops 0.046 while the aim slides down past B4, as lowering does on screen.
  for(let i=1;i<=10;i++){now+=33;c.feed(hand(now,a4.x,200+i*5,.30+i*.0046));}
  assert.equal(c.contact?.target.id,'spot:A4');assert.ok(c.contact.depth>=.85);
  c.press(hand(now+10,a4.x,250,.346,{thumbDepth:1}));
  assert.equal(p.spots.A4.volume,5);assert.equal(p.spots.B4.volume,0);
});

test('pausing off-centre and then moving down the card travels to the row below instead of locking the paused spot',()=>{
  const {p,c,b}=rig();act(p,'attach');act(p,'aspirate',{target:'EB'});
  const a6=b.spot('spot:A6'),b6=b.spot('spot:B6');let now=still(c,0,a6.x+9,a6.y-2,110);assert.equal(c.contact,null);
  for(let i=1;i<=6;i++){c.feed(hand(now,a6.x+9-i,a6.y-2+i*6.5,.30+i*.0046));now+=33;} // about 200 px/s straight after the pause
  assert.notEqual(c.contact?.target.id,'spot:A6','a pause away from the centre is not an aim');
  still(c,now,b6.x,b6.y,200,.30+6*.0046);assert.equal(c.contact?.target.id,'spot:B6');
});

test('lifting releases a lock without cancelling, and the same spot waits before re-locking',()=>{
  const {c,b}=rig();const a5=b.spot('spot:A5');
  let now=still(c,0,a5.x,200,200);assert.equal(c.contact?.target.id,'spot:A5');
  now=still(c,now,a5.x,200,100,.25);assert.equal(c.contact?.target.id,'spot:A5','a brief rise keeps the lock');
  let released=null;for(let i=0;i<20&&released===null;i++){c.feed(hand(now,a5.x,200,.25));if(!c.contact)released=now;now+=33;}
  assert.ok(released!==null,'a sustained rise releases the lock');assert.equal(c.stats.cancelled,0);
  for(;now<released+HAND_AIM.relockMS-40;now+=33)c.feed(hand(now,a5.x,200,.25));assert.equal(c.contact,null,'no instant re-lock after leaving');
  still(c,now,a5.x,200,200,.25);assert.equal(c.contact?.target.id,'spot:A5');
});

test('extended-arm sway and tremor keep the lock on a spot, including a brief jolt onto the neighbour; a deliberate move still leaves',()=>{
  const {p,c,b}=rig();act(p,'attach');act(p,'aspirate',{target:'EB'});
  const a4=b.spot('spot:A4'),a5=b.spot('spot:A5');let now=still(c,0,a4.x,200,200);assert.equal(c.contact?.target.id,'spot:A4');
  const start=now,lost=[];
  for(;now<start+3000;now+=33){
    const s=(now-start)/1000,jolt=s>1&&s<1.15?22:0; // a 150 ms jolt about 9 mm towards A5
    const x=a4.x+10*Math.sin(2*Math.PI*.8*s)+2*Math.sin(2*Math.PI*9*s)+jolt,palmY=.30+.012*Math.sin(2*Math.PI*.5*s); // about 4 mm sway, tremor, 7 mm vertical sway
    c.feed(hand(now,x,200+(palmY-.30)*600,palmY));if(c.contact?.target.id!=='spot:A4')lost.push(Math.round(now-start));
  }
  assert.deepEqual(lost,[],'the lock never drops during natural sway');
  still(c,now,a5.x,200,HAND_AIM.exitMS+250);assert.equal(c.contact?.target.id,'spot:A5','moving to the neighbour and staying there hands the lock over');
});

test('while a draw is held in the liquid, sideways sway of about 3 cm and a brief larger jolt do not cancel it',()=>{
  const {p,c,b}=rig();act(p,'attach');const eb=b.spot('EB');
  let now=still(c,0,eb.x,eb.y,200);assert.equal(c.contact?.target.id,'EB');
  c.press(hand(now,eb.x,eb.y,.30,{thumbDepth:1}));assert.equal(c.pending?.kind,'draw');
  now=still(c,now+33,eb.x,eb.y+28,150,.346);assert.ok(c.contact.depth>=.85);
  const start=now;for(;now<start+1500;now+=33){const s=(now-start)/1000,jolt=s>.8&&s<.9?84:0;c.feed(hand(now,eb.x+40*Math.sin(2*Math.PI*.7*s)+jolt,eb.y+28,.346));}
  assert.equal(c.pending?.kind,'draw','sway keeps the stroke');assert.equal(c.contact?.target.id,'EB');
  c.release(hand(now,eb.x,eb.y+28,.346));assert.equal(p.tip.volume,5);assert.equal(p.reagents.EB,195);assert.equal(c.stats.cancelled,0);
});

test('a plunger pressed before the aim locks binds to the target that locks, and a rejected lock stays armed',()=>{
  const {p,c,b,messages}=rig();act(p,'attach');
  let now=0;c.feed(hand(now,400,400));c.press(hand(now+5,400,400,.30,{thumbDepth:1}));assert.equal(c.pending?.kind,'armed');
  // Locking a card spot with an empty tip is refused, but the pressed plunger remains usable.
  now=still(c,now+33,b.spot('spot:A1').x,200,200);assert.equal(c.contact?.target.id,'spot:A1');assert.equal(c.pending?.kind,'armed');assert.ok(messages.some(m=>m.e));
  for(let x=b.spot('spot:A1').x;x<=600;x+=40){now+=33;c.feed(hand(now,x,Math.max(80,200-(x-100)*.25)));}
  now=still(c,now+33,600,80,200);assert.equal(c.contact?.target.id,'EB');assert.equal(c.pending?.kind,'draw');
  c.feed(hand(now+33,600,80,.346));c.release(hand(now+40,600,80,.346));
  assert.equal(p.tip.volume,5);assert.equal(p.reagents.EB,195);assert.equal(p.balance(),0);
});

// Camera-level: pose classifiers and thumb validity are debounced before they reach the controller.
function camera(){
  let now=0,shape={grip:true,open:false,thumb:0,palmY:.40,valid:true};
  const events={edges:[],lost:0};
  const context=vm.createContext({ClassroomCore:{...core},performance:{now:()=>now},console,setTimeout,clearTimeout,setInterval,clearInterval,cancelAnimationFrame:()=>{},window:{},isSecureContext:true,navigator:{}});
  vm.runInContext(fs.readFileSync(require.resolve('../camera.js'),'utf8'),context);
  context.ClassroomCore.measureHand=()=>({features:shape.valid?Array(7).fill(shape.thumb):[shape.thumb,0,0,0,0,0,3],palmX:.5,palmY:shape.palmY,grip:shape.grip,open:shape.open,normal:[0,0,1],rotation:[0,0,0]});
  const overlay={width:640,height:480,getContext:()=>({clearRect(){}})};
  const cam=new context.ClassroomWebcam({video:{pause(){},play:async()=>{}},overlay,bounds:()=>({width:1000,height:700}),active(){},status(){},lost:()=>events.lost++,frame:()=>{},edge:e=>events.edges.push(e),meter(){}});
  cam.draw=()=>{};cam.running=true;cam.modelReady=true;cam.profiles={rest:Array(7).fill(0),press:Array(7).fill(1)};cam.calibrationHand='Right';
  const lm=Array.from({length:21},()=>({x:.5,y:.5,z:0}));
  const send=(t,changes={})=>{now=t;Object.assign(shape,changes);cam.result({stamp:t,inferenceMS:20,landmarks:[lm],worldLandmarks:[lm],handedness:[[{categoryName:'Right',score:.99}]]});};
  return {cam,events,send,shape};
}
test('a one-frame grip or thumb misread during a draw does not cancel it',()=>{
  const p=prepared();act(p,'attach');const EB={id:'EB',kind:'reagent'};
  const c=new Interaction({protocol:()=>p,pick:()=>EB});c.select('pipette');
  const {cam,send}=camera();cam.o.frame=f=>c.feed(f);cam.o.edge=(e,f)=>c[e](f);cam.o.lost=()=>c.resetMotion();
  let t=1000;for(;t<1300;t+=33)send(t);assert.ok(c.contact,'settled aim locks');
  for(;t<1450;t+=33)send(t,{thumb:1});assert.equal(c.pending?.kind,'draw');
  for(;t<1600;t+=33)send(t,{palmY:.446});assert.ok(c.contact.depth>=.85);
  send(t+=33,{grip:false});send(t+=33,{grip:true});
  send(t+=33,{valid:false});send(t+=33,{valid:true});
  send(t+=33,{open:true,grip:false});send(t+=33,{open:false,grip:true});
  assert.equal(c.pending?.kind,'draw','brief misreads keep the stroke');
  for(let i=0;i<4;i++)send(t+=33,{thumb:0});
  assert.equal(p.tip.volume,5);assert.equal(p.reagents.EB,195);
});
test('thumb mode: a sustained open hand ends the stroke with nothing transferred; a loose curl keeps holding',()=>{
  for(const loose of [false,true]){
    const p=prepared();act(p,'attach');const EB={id:'EB',kind:'reagent'};
    const c=new Interaction({protocol:()=>p,pick:()=>EB});c.select('pipette');
    const {cam,send}=camera();cam.o.frame=f=>c.feed(f);cam.o.edge=(e,f)=>c[e](f);cam.o.lost=()=>c.resetMotion();
    let t=1000;for(;t<1300;t+=33)send(t);for(;t<1450;t+=33)send(t,{thumb:1});for(;t<1600;t+=33)send(t,{palmY:.446});
    assert.equal(c.pending?.kind,'draw');
    for(let i=0;i<10;i++)send(t+=33,loose?{grip:false,open:false}:{open:true,grip:false});
    if(loose){assert.equal(c.pending?.kind,'draw','fingers need not be tightly closed around the pipette');for(let i=0;i<4;i++)send(t+=33,{thumb:0});assert.equal(p.tip.volume,5);assert.equal(p.reagents.EB,195);}
    else{assert.equal(c.pending,null);send(t+=33,{open:false,grip:true,thumb:0});send(t+=33);send(t+=33);send(t+=33);assert.equal(p.tip.volume,0);assert.equal(p.reagents.EB,200);}
  }
});
test('thumb mode counts a firm partial press: 60% of the calibrated travel presses and 20% releases',()=>{
  const p=prepared();act(p,'attach');const EB={id:'EB',kind:'reagent'};
  const c=new Interaction({protocol:()=>p,pick:()=>EB});c.select('pipette');
  const {cam,send}=camera();cam.o.frame=f=>c.feed(f);cam.o.edge=(e,f)=>c[e](f);cam.o.lost=()=>c.resetMotion();
  let t=1000;for(;t<1300;t+=33)send(t);for(;t<1450;t+=33)send(t,{thumb:.6});assert.equal(c.pending?.kind,'draw','a 60% press presses the plunger');
  for(;t<1600;t+=33)send(t,{palmY:.446});for(let i=0;i<4;i++)send(t+=33,{thumb:.2});
  assert.equal(p.tip.volume,5);assert.equal(p.reagents.EB,195);
});
test('thumb calibration accepts a loose pipette grip; only a spread hand is skipped',()=>{
  const {cam,send}=camera();cam.profiles={};cam.calibrationHand=null;let t=1000;
  send(t,{grip:false,open:false,thumb:0});cam.capture('rest');for(t=1700;t<=2300;t+=100)send(t,{grip:false,open:false,thumb:0});cam.finishCapture();assert.ok(cam.profiles.rest,'loose rest pose captured');
  t=2500;send(t,{thumb:1});cam.capture('press');for(t=3200;t<=3800;t+=100)send(t,{grip:false,open:false,thumb:1});cam.finishCapture();assert.equal(cam.calibrated,true);
  const {cam:spread,send:send2}=camera();spread.profiles={};spread.calibrationHand=null;t=1000;
  send2(t,{open:true,grip:false});spread.capture('rest');for(t=1700;t<=2300;t+=100)send2(t,{open:true,grip:false});spread.finishCapture();assert.equal(spread.profiles.rest,undefined);
});

// In pinch mode, spreading the fingers also opens the pinch, and opening the pinch at depth is the draw itself.
test('pinch mode: a one-frame spread misread keeps the stroke; a held spread releases the lock, and at the stand hangs the pipette up',()=>{
  for(const held of [false,true]){
    const p=prepared();act(p,'attach');const EB={id:'EB',kind:'reagent'};
    let picked=EB;const c=new Interaction({protocol:()=>p,pick:()=>picked});c.select('pipette');
    let now=0,pose={ratio:1,extended:1,palmY:.40};
    const context=vm.createContext({ClassroomCore:{...core},performance:{now:()=>now},console,setTimeout,clearTimeout,setInterval,clearInterval,cancelAnimationFrame:()=>{},window:{},isSecureContext:true,navigator:{}});
    vm.runInContext(fs.readFileSync(require.resolve('../camera.js'),'utf8'),context);
    context.ClassroomCore.measureHand=()=>({features:Array(7).fill(0),palmX:.5,palmY:pose.palmY,grip:true,open:false,pinch:pose.ratio<.4,pinchRatio:pose.ratio,extended:pose.extended,normal:[0,0,1],rotation:[0,0,0]});
    const cam=new context.ClassroomWebcam({video:{pause(){},play:async()=>{}},overlay:{width:640,height:480,getContext:()=>({clearRect(){}})},mode:'pinch',bounds:()=>({width:1000,height:700}),active(){},status(){},lost:()=>c.resetMotion(),frame:f=>c.feed(f),edge:(e,f)=>c[e](f),meter(){}});
    cam.draw=()=>{};cam.running=true;cam.modelReady=true;
    const lm=Array.from({length:21},()=>({x:.5,y:.5,z:0}));
    const send=(t,changes={})=>{now=t;Object.assign(pose,changes);cam.result({stamp:t,inferenceMS:20,landmarks:[lm],worldLandmarks:[lm],handedness:[[{categoryName:'Right',score:.99}]]});};
    let t=1000;for(;t<1300;t+=33)send(t);assert.ok(c.contact,'settled aim locks');
    if(!held){
      for(;t<1450;t+=33)send(t,{ratio:.2});assert.equal(c.pending?.kind,'draw');
      for(;t<1600;t+=33)send(t,{palmY:.446});
      send(t+=33,{extended:4,ratio:1});send(t+=33,{extended:1,ratio:.2});assert.equal(c.pending?.kind,'draw','one spread frame keeps the stroke');
      for(let i=0;i<4;i++)send(t+=33,{ratio:1});assert.equal(p.tip.volume,5);assert.equal(p.reagents.EB,195);
    }else{
      for(;t<1600;t+=33)send(t,{palmY:.446});assert.ok(c.contact.depth>=.85);
      send(t+=33,{extended:4});send(t+=33,{extended:1});assert.ok(c.contact,'one spread frame keeps the lock');
      for(let i=0;i<8;i++)send(t+=33,{extended:4});assert.equal(c.contact,null,'a held spread releases the lock');
      for(let i=0;i<30;i++)send(t+=33,{extended:4});assert.equal(c.tool,'pipette','away from the stand the pipette is kept');
      picked={id:'stand',kind:'stand'};for(let i=0;i<16;i++)send(t+=33,{extended:4});assert.equal(c.tool,'view','a held spread at the stand hangs the pipette up');
      assert.equal(p.tip.volume,0);assert.equal(p.reagents.EB,200);
    }
  }
});

// Real plunger technique.
function sampleStep(){const p=prepared();act(p,'attach');for(const id of p.ids){act(p,'aspirate',{target:'EB'});act(p,'dispense',{target:id,surface:'card'});}act(p,'eject');
  act(p,'pickCard');act(p,'placeCard',{target:'incubator'});act(p,'dry',{mode:'incubator'});p.tick(300);if(p.cardLocation!=='bench'){act(p,'pickCard');act(p,'placeCard',{target:'bench'});}return p;}
function handRig(p,target){const said=[],rejects=[];let picked=target;const c=new Interaction({protocol:()=>p,pick:()=>picked,say:(s,e)=>said.push({s,e}),reject:(a,e)=>rejects.push(e.code)});c.select('pipette');return {c,said,rejects,pick:t=>picked=t};}
const h2=(now,palmY=.30,extra={})=>({x:0,y:0,rawX:.5,palmY,now,source:'hand',ready:true,grip:true,open:false,thumbDepth:0,...extra});
test('pressing the plunger with an empty tip already in the liquid is refused as bubbles and logged as plunger technique',()=>{
  const p=prepared();act(p,'attach');const {c,said,rejects}=handRig(p,{id:'EB',kind:'reagent'});
  c.feed(h2(0));c.feed(h2(170));assert.ok(c.contact);c.feed(h2(250,.346));assert.ok(c.contact.depth>=.85,'tip in the liquid with the plunger up');
  c.press(h2(260,.346));assert.equal(c.pending?.kind,'bubbles');assert.deepEqual(rejects,['plunger']);assert.match(said.at(-1).s,/Bubbles/);
  c.release(h2(330,.346));assert.equal(p.tip.volume,0,'nothing is drawn');assert.equal(p.reagents.EB,200);
});
test('after a bubble press, lifting out with the plunger still pressed, lowering back in and releasing draws correctly',()=>{
  const p=prepared();act(p,'attach');const {c}=handRig(p,{id:'EB',kind:'reagent'});
  c.feed(h2(0));c.feed(h2(170));c.feed(h2(250,.346));c.press(h2(260,.346));assert.equal(c.pending?.kind,'bubbles');
  c.feed(h2(300,.315));assert.equal(c.pending?.kind,'draw','lifted out with the plunger down');
  c.feed(h2(360,.346));c.release(h2(380,.346));assert.equal(p.tip.volume,5);assert.equal(p.reagents.EB,195);
});
test('pressing before the tip enters the liquid, lowering, then releasing draws: the correct technique',()=>{
  const p=prepared();act(p,'attach');const {c,rejects}=handRig(p,{id:'EB',kind:'reagent'});
  c.feed(h2(0));c.feed(h2(170));c.press(h2(180));c.feed(h2(250,.346));c.release(h2(270,.346));
  assert.equal(p.tip.volume,5);assert.deepEqual(rejects,[]);
});
test('mixing in the well is press and release with the tip kept in the liquid, as on a real pipette',()=>{
  const p=sampleStep();const id=p.currentSample;act(p,'attach');act(p,'aspirate',{target:'cDNA'});
  const {c,rejects}=handRig(p,{id:'well:'+id,kind:'well',sample:id});
  let t=0;c.feed(h2(t));c.feed(h2(t+=170));c.feed(h2(t+=60,.346));assert.ok(c.contact.depth>=.85);
  c.press(h2(t+=20,.346,{thumbDepth:1}));assert.equal(p.tip.volume,0,'cDNA delivered into the well');
  for(let n=1;n<=3;n++){
    c.release(h2(t+=80,.346));assert.equal(p.tip.volume,5,'releasing inside draws the liquid back up');
    c.press(h2(t+=80,.346,{thumbDepth:1}));assert.equal(p.tip.volume,0);assert.equal(p.wells[id].mixes,n);
  }
  c.release(h2(t+=80,.346));assert.equal(p.tip.volume,5,'the final draw for spotting');assert.deepEqual(rejects,[]);assert.equal(p.balance(),0);
});
test('the micropipette is put down by bringing it to its stand and showing an open palm there',()=>{
  const p=prepared();const {c,said,pick}=handRig(p,{id:'EB',kind:'reagent'});
  const open=now=>h2(now,.30,{open:true,grip:false});
  for(let t=0;t<=1200;t+=60)c.feed(open(t));assert.equal(c.tool,'pipette','an open hand elsewhere keeps the pipette');assert.ok(said.some(m=>/stand/.test(m.s)),'the learner is told where to hang it');
  pick({id:'stand',kind:'stand'});for(let t=1260;t<=1560;t+=60)c.feed(open(t));assert.equal(c.tool,'pipette','a glance past the stand is not enough');
  for(let t=1620;t<=1800;t+=60)c.feed(open(t));assert.equal(c.tool,'view','held over the stand, the pipette is hung up');
});
