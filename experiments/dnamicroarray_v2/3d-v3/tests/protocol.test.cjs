const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Protocol,RESULTS,MEANINGS}=require('../protocol.js');
const {PressGate,HAND_GAP_MS}=require('../hand-core.js');
const {Interaction}=require('../interaction.js');
function act(p,type,rest={}){return p.dispatch({type,...rest},'test');}
function prepared(set){const p=new Protocol(set);act(p,'tapPlate');act(p,'prepare',{label:'QA',ppe:true});return p;}
function rejected(p,action,pattern){const before=JSON.stringify(p);assert.throws(()=>p.dispatch(action),pattern);assert.equal(JSON.stringify(p),before,'Rejected action must be atomic');}
function buffer(p,reagent,order=p.ids){if(p.tip)act(p,'eject');act(p,'attach');for(const id of order){act(p,'aspirate',{target:reagent});act(p,'dispense',{target:id,surface:'card'});assert.equal(p.balance(),0);}act(p,'eject');}
function dry(p,mode='incubator'){
  if(mode==='incubator'){act(p,'pickCard');act(p,'placeCard',{target:'incubator'});}act(p,'dry',{mode});p.tick(mode==='incubator'?300:600);
  if(p.phase!=='uv'&&p.cardLocation!=='bench'){act(p,'pickCard');act(p,'placeCard',{target:'bench'});}
}
function sampleReady(){const p=prepared();buffer(p,'EB');dry(p);return p;}
function prepareSample(p,id){act(p,'attach');act(p,'aspirate',{target:'cDNA'});act(p,'dispense',{target:id,surface:'well'});}
function draw(p,id){act(p,'aspirate',{target:id,surface:'well'});}
function mix(p,id){draw(p,id);act(p,'dispense',{target:id,surface:'well'});}
function allSamples(p){for(const id of p.ids){prepareSample(p,id);for(let n=0;n<3;n++)mix(p,id);draw(p,id);act(p,'dispense',{target:id,surface:'card'});act(p,'eject');assert.equal(p.balance(),0);}}
function fullRun(mode='incubator',set='AD'){
  const p=prepared(set);buffer(p,'EB',mode==='room'?[...p.ids].reverse():p.ids);dry(p,mode);allSamples(p);dry(p,mode);buffer(p,'HB');dry(p,mode);
  act(p,'uvGoggles',{value:true});act(p,'pickCard');act(p,'placeCard',{target:'uv'});act(p,'uv');return p;
}
test('orientation and label/PPE prerequisites are real state constraints',()=>{
  const p=new Protocol();assert.deepEqual(p.orientation,{card:true,plate:true});act(p,'orient',{target:'card'});rejected(p,{type:'prepare',label:'QA',ppe:true},/upper left/);act(p,'orient',{target:'card'});
  rejected(p,{type:'prepare',label:'',ppe:true},/label/);rejected(p,{type:'prepare',label:'QA',ppe:false},/goggles/);
  rejected(p,{type:'attach'},/not needed/);rejected(p,{type:'prepare',label:'QA',ppe:true},/Gently tap/);act(p,'tapPlate');act(p,'prepare',{label:'QA',ppe:true});assert.equal(p.phase,'eb');
});
test('5 µL single doses, source guards, duplicates and stock isolation',()=>{
  const p=prepared();rejected(p,{type:'aspirate',target:'EB'},/fresh tip/);act(p,'attach');
  rejected(p,{type:'aspirate',target:'HB'},/requires EB/);act(p,'aspirate',{target:'EB'});assert.equal(p.reagents.EB,195);
  rejected(p,{type:'aspirate',target:'EB'},/already contains/);act(p,'dispense',{target:'A1',surface:'card'});act(p,'aspirate',{target:'EB'});
  rejected(p,{type:'dispense',target:'A1',surface:'card'},/already received/);act(p,'eject');assert.equal(p.waste,5);assert.equal(p.balance(),0);
});
test('mixing uses three draw/return cycles and the same tip; card cannot be aspirated',()=>{
  const p=sampleReady();prepareSample(p,'A1');assert.equal(p.wells.A1.punctured,true);
  rejected(p,{type:'aspirate',target:'cDNA'},/cannot return/);rejected(p,{type:'aspirate',target:'A1',surface:'card'},/paper card/);
  draw(p,'A1');rejected(p,{type:'dispense',target:'A1',surface:'card'},/three full/);rejected(p,{type:'dispense',target:'A2',surface:'well'},/next patient well/);
  act(p,'dispense',{target:'A1',surface:'well'});mix(p,'A1');mix(p,'A1');assert.equal(p.wells.A1.mixes,3);
  draw(p,'A1');rejected(p,{type:'dispense',target:'A2',surface:'card'},/matched/);act(p,'dispense',{target:'A1',surface:'card'});
  rejected(p,{type:'aspirate',target:'cDNA'},/Eject/);act(p,'eject');prepareSample(p,'A2');assert.equal(p.wells.A2.mixes,0);
});
test('replacing a tip in the middle of a patient sample cannot silently bypass mixing',()=>{
  const p=sampleReady();prepareSample(p,'A1');mix(p,'A1');
  rejected(p,{type:'eject'},/Keep this tip/);rejected(p,{type:'attach'},/Eject/);
  assert.equal(p.wells.A1.mixes,1);mix(p,'A1');mix(p,'A1');draw(p,'A1');act(p,'dispense',{target:'A1',surface:'card'});act(p,'eject');assert.equal(p.tip,null);
});
test('three drying stages enforce source times, station placement, pause, stop and resume',()=>{
  const p=prepared();rejected(p,{type:'dry',mode:'incubator'},/not the current/);buffer(p,'EB');
  rejected(p,{type:'dry',mode:'incubator'},/incubator first/);act(p,'dry',{mode:'room'});p.tick(100);
  assert.equal(p.timer.remaining,500);act(p,'pause');p.tick(1000);assert.equal(p.timer.remaining,500);
  rejected(p,{type:'pickCard'},/Run/);act(p,'stop');p.tick(1000);assert.equal(p.timer.remaining,500);act(p,'run');
  rejected(p,{type:'pickCard'},/Finish drying/);p.tick(499);assert.equal(p.phase,'dry1');p.tick(1);assert.equal(p.phase,'samples');
  assert.equal(p.dried[0].seconds,600);assert.equal(p.evaporated,160);assert.equal(p.balance(),0);
});
test('the full manual example preserves all 32 signals and the added-liquid balance',()=>{
  const p=fullRun();assert.equal(p.phase,'analyze');assert.equal(p.tipCount,34);assert.deepEqual(p.reagents,{EB:40,cDNA:40,HB:40});
  assert.equal(p.evaporated,480);assert.equal(p.balance(),0);assert.equal(p.dried.length,3);
  for(let row=0;row<4;row++)for(let col=1;col<=8;col++)assert.equal(p.result(p.rows[row]+col),RESULTS[row][col-1]);
  assert.equal(p.result('A5'),'black');assert.equal(p.result('B6'),'red');assert.equal(p.result('C8'),'black');
});
test('equivalent E–H card and alternate buffer order/room-temperature path',()=>{
  const p=fullRun('room','EH');assert.equal(p.rows[0],'E');assert.equal(p.result('E5'),'black');assert.equal(p.result('G8'),'black');
  assert.equal(p.elapsed,1800);assert.equal(p.balance(),0);
});
test('v3 notebook: observe colours first, validate controls, then interpret genes; feedback names patients only',()=>{
  const early=prepared();assert.equal(early.result('A1'),null);rejected(early,{type:'uv'},/three drying/);
  const p=fullRun();act(p,'uv');assert.equal(p.result('A1'),null);act(p,'uvGoggles',{value:false});rejected(p,{type:'uv'},/goggles/);
  act(p,'uvGoggles',{value:true});act(p,'uv');
  rejected(p,{type:'observe',target:'A5',value:'black'},/control columns/);rejected(p,{type:'interpret',target:'A5',value:'none'},/control columns/);
  rejected(p,{type:'interpret',target:'A1',value:'equal'},/columns 5–8/);rejected(p,{type:'observe',target:'A1',value:'purple'},/colour/);
  rejected(p,{type:'verifyControls'},/remaining/);
  const controls=p.ids.filter(id=>+id.slice(1)<=4),genes=p.ids.filter(id=>+id.slice(1)>4);
  controls.forEach(id=>act(p,'observe',{target:id,value:p.result(id)}));act(p,'observe',{target:'B2',value:'green'});
  const err=(()=>{try{p.dispatch({type:'verifyControls'});}catch(e){return e;}})();
  assert.equal(err.code,'analysis');assert.match(err.message,/1 colour needs another look \(Patient 2\)/);assert.doesNotMatch(err.message,/B2/);
  act(p,'observe',{target:'B2',value:'red'});act(p,'verifyControls');assert.equal(p.controlsVerified,true);
  genes.forEach(id=>act(p,'observe',{target:id,value:p.result(id)}));rejected(p,{type:'finish'},/remaining/);
  genes.forEach(id=>act(p,'interpret',{target:id,value:MEANINGS[p.result(id)]}));act(p,'interpret',{target:'C8',value:'down'});
  rejected(p,{type:'finish'},/1 interpretation needs another look \(Patient 3\)/);act(p,'interpret',{target:'C8',value:'none'});
  act(p,'observe',{target:'A1',value:'yellow'});assert.equal(p.controlsVerified,false,'editing a control invalidates the check');
  rejected(p,{type:'finish'},/controls first/);act(p,'verifyControls');act(p,'finish');assert.equal(p.phase,'complete');
});
test('v3 rejections carry categories used by the debrief',()=>{
  const p=prepared(),code=a=>{try{p.dispatch(a);}catch(e){return e.code;}};
  assert.equal(code({type:'aspirate',target:'EB'}),'tip');act(p,'attach');assert.equal(code({type:'aspirate',target:'HB'}),'reagent');
  act(p,'aspirate',{target:'EB'});assert.equal(code({type:'aspirate',target:'EB'}),'volume');act(p,'dispense',{target:'A1',surface:'card'});
  act(p,'aspirate',{target:'EB'});assert.equal(code({type:'dispense',target:'A1',surface:'card'}),'duplicate');
  act(p,'pause');assert.equal(code({type:'attach'}),'paused');
  const q=sampleReady();prepareSample(q,'A1');assert.equal(code.call(null,{type:'noop'}),'paused');
  const c=a=>{try{q.dispatch(a);}catch(e){return e.code;}};
  draw(q,'A1');assert.equal(c({type:'dispense',target:'A1',surface:'card'}),'mixing');assert.equal(c({type:'dispense',target:'A2',surface:'well'}),'order');
});
test('v3 log records action details such as surface, mode and value',()=>{
  const p=prepared();act(p,'attach');act(p,'aspirate',{target:'EB'});act(p,'dispense',{target:'A1',surface:'card'});
  const last=p.log.at(-1);assert.equal(last.action,'dispense');assert.deepEqual(last.detail,{surface:'card'});
  assert.deepEqual(p.log.find(e=>e.action==='prepare').detail,{label:'QA',ppe:true});
});
test('invalid numeric clock input, absent IDs and malformed actions are harmless',()=>{
  const p=prepared();for(const target of ['A9','E1','__proto__']){act(p,'attach');act(p,'aspirate',{target:'EB'});rejected(p,{type:'dispense',surface:'card',target},/spot|bookkeeping/);act(p,'eject');}
  assert.equal(p.tick(NaN),false);assert.equal(p.tick(-1),false);assert.equal(p.balance(),0);
  assert.equal(Object.prototype.eb,undefined);assert.equal(Object.prototype.volume,undefined);
});
function inputRig(){
  const p=prepared();let selected={id:'tips',kind:'tips'},messages=[];
  const c=new Interaction({protocol:()=>p,pick:()=>selected,say:s=>messages.push(s)});
  c.select('pipette');return {p,c,messages,target:t=>selected=t};
}
function f(now,y=0,extra={}){return{x:0,y,now,source:'mouse',ready:true,...extra};}
test('mouse insertion is required; cancel never releases a pending aspiration',()=>{
  const {p,c,target}=inputRig();c.mouseDown(f(0));c.feed(f(10,30));c.mouseUp(f(20,30));assert.ok(p.tip);
  target({id:'EB',kind:'reagent'});c.mouseDown(f(30));c.mouseUp(f(40));assert.equal(p.reagents.EB,200);
  c.mouseDown(f(50));c.feed(f(60,30));c.resetMotion();c.mouseUp(f(70,30));assert.equal(p.reagents.EB,200);
  c.mouseDown(f(80));c.feed(f(90,30));c.mouseUp(f(100,30));assert.equal(p.tip.volume,5);
  target({id:'spot:A1',kind:'spot',sample:'A1'});c.mouseDown(f(110));c.feed(f(120,30));c.feed(f(130,30));c.mouseUp(f(140,30));assert.equal(p.spots.A1.volume,5);assert.equal(p.balance(),0);
});
test('calibrated hand contact handles brief gaps, sustained press and long interruption',()=>{
  const {p,c,target}=inputRig();act(p,'attach');target({id:'EB',kind:'reagent'});
  const hand=(now,palmY=.3)=>f(now,0,{source:'hand',rawX:.5,palmY,thumbDown:false,grip:true,open:false});
  c.feed(hand(0));c.feed(hand(230));assert.ok(c.contact);c.press(hand(240));c.feed(hand(330,.346));c.release(hand(350,.346));assert.equal(p.tip.volume,5);
  act(p,'eject');act(p,'attach');c.resetMotion();c.feed(hand(500));c.feed(hand(730));c.press(hand(740));const late=730+HAND_GAP_MS+50;c.feed(hand(late,.346));c.release(hand(late+20,.346));assert.equal(p.tip.volume,0);assert.equal(p.reagents.EB,195);
});
test('thumb press gate needs rest to re-arm after a tracking gap and never duplicates a held press',()=>{
  const g=new PressGate();assert.equal(g.update(.1,0),null);assert.equal(g.update(.1,80),null);assert.equal(g.update(.9,90),null);assert.equal(g.update(.9,160),'press');
  assert.equal(g.update(.9,200),null);const t=200+HAND_GAP_MS+100;assert.equal(g.update(.9,t),null);assert.equal(g.update(.1,t+10),null);assert.equal(g.update(.1,t+90),null);
  g.update(.9,t+100);assert.equal(g.update(.9,t+180),'press');g.update(.1,t+190);assert.equal(g.update(.1,t+270),'release');
});
test('paper liquid decreases during drying, conserves volume, and freezes when paused',()=>{
  for(const mode of ['room','incubator']){
    const p=prepared();buffer(p,'EB');
    if(mode==='incubator'){act(p,'pickCard');act(p,'placeCard',{target:'incubator'});}
    act(p,'dry',{mode});const total=p.timer.total;p.tick(total/2);
    assert.equal(p.spots.A1.volume,2.5);assert.equal(p.evaporated,80);assert.equal(p.balance(),0);
    const volumes=JSON.stringify(p.spots);act(p,'pause');p.tick(900);assert.equal(JSON.stringify(p.spots),volumes);
    act(p,'run');for(let i=0;i<31;i++)p.tick(total/100);
    assert.ok(Math.abs(p.balance())<1e-7);p.tick(total);assert.equal(p.evaporated,160);
    assert.equal(p.spots.D8.volume,0);assert.equal(p.balance(),0);
  }
});
test('a hand gap beyond the press gate timeout also cancels a pending delivery',()=>{
  const {p,c,target}=inputRig();act(p,'attach');act(p,'aspirate',{target:'EB'});
  target({id:'spot:A1',kind:'spot',sample:'A1'});
  const h=(now,palmY=.3)=>f(now,0,{source:'hand',rawX:.5,palmY,grip:true,open:false});
  c.feed(h(0));c.feed(h(170));c.press(h(180));
  const late=170+HAND_GAP_MS+30;c.feed(h(late,.346));c.release(h(late+10,.346));assert.equal(p.tip.volume,5);assert.equal(p.spots.A1.volume,0);
});
test('opening the hand cancels an aspiration rather than completing it',()=>{
  const {p,c,target}=inputRig();act(p,'attach');target({id:'EB',kind:'reagent'});
  const h=(now,palmY=.3)=>f(now,0,{source:'hand',rawX:.5,palmY,grip:true,open:false});
  c.feed(h(0));c.feed(h(170));c.press(h(180));c.feed(h(230,.346));
  const open={...h(250,.346),open:true,grip:false};c.feed(open);c.release(open);
  assert.equal(p.tip.volume,0);assert.equal(p.reagents.EB,200);
  for(let i=1;i<=6;i++)c.feed({...open,now:250+i*180});
  assert.equal(c.tool,'pipette','an open hand away from the stand does not drop the pipette');
  target({id:'stand',kind:'stand'});for(let i=7;i<=10;i++)c.feed({...open,now:250+i*180});
  assert.equal(c.tool,'view','an open palm at the stand hangs it up');
});
test('closed-grip dwell must remain over the same tool',()=>{
  const p=prepared();let picked={id:'pipette',kind:'tool'};
  const c=new Interaction({protocol:()=>p,pick:()=>picked});
  const h=now=>f(now,0,{source:'hand',rawX:.5,palmY:.3,grip:true,open:false});
  c.feed(h(0));c.feed(h(200));picked={id:'bench',kind:'station'};c.feed(h(350));
  picked={id:'pipette',kind:'tool'};c.feed(h(400));assert.equal(c.tool,'view');
  c.feed(h(580));c.feed(h(770));assert.equal(c.tool,'pipette');
});
test('hand lock-on survives realistic camera frame spacing (lock after more than the gap limit of hovering)',()=>{
  const {p,c,target}=inputRig();act(p,'attach');target({id:'EB',kind:'reagent'});
  const hand=(now,palmY=.3)=>f(now,0,{source:'hand',rawX:.5,palmY,grip:true,open:false});
  for(let t=0;t<=300;t+=50)c.feed(hand(t));                 // ~20 fps in-browser inference: lock lands at 250 ms
  assert.ok(c.contact&&c.contact.valid,'contact stays valid after locking');
  c.press(hand(320));for(let t=350;t<=450;t+=50)c.feed(hand(t,.346));c.release(hand(460,.346));
  assert.equal(p.tip.volume,5);assert.equal(p.reagents.EB,195);
});
