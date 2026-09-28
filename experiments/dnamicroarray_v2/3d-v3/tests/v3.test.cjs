const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Protocol,RESULTS,MEANINGS}=require('../protocol.js');
const A=require('../analysis.js');
const {Session,age}=require('../session.js');
const E3D=(require('../renderer.js'),globalThis.E3D);
const {workSet,stateKey,fit,AutoFrame}=require('../framing.js');

const act=(p,type,rest={})=>p.dispatch({type,...rest},'test');
function prepared(set){const p=new Protocol(set);act(p,'tapPlate');act(p,'prepare',{label:'QA',ppe:true});return p;}
function buffer(p,reagent){act(p,'attach');for(const id of p.ids){act(p,'aspirate',{target:reagent});act(p,'dispense',{target:id,surface:'card'});}act(p,'eject');}
function dry(p){act(p,'pickCard');act(p,'placeCard',{target:'incubator'});act(p,'dry',{mode:'incubator'});p.tick(300);if(p.phase!=='uv'){act(p,'pickCard');act(p,'placeCard',{target:'bench'});}}
function samples(p){for(const id of p.ids){act(p,'attach');act(p,'aspirate',{target:'cDNA'});act(p,'dispense',{target:id,surface:'well'});for(let n=0;n<3;n++){act(p,'aspirate',{target:id,surface:'well'});act(p,'dispense',{target:id,surface:'well'});}act(p,'aspirate',{target:id,surface:'well'});act(p,'dispense',{target:id,surface:'card'});act(p,'eject');}}
function fullRun(set){const p=prepared(set);buffer(p,'EB');dry(p);samples(p);dry(p);buffer(p,'HB');dry(p);act(p,'uvGoggles',{value:true});act(p,'pickCard');act(p,'placeCard',{target:'uv'});act(p,'uv');return p;}
function memoryStorage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),m};}

test('serialize/restore round-trips mid-sample, mid-drying and analysis states exactly',()=>{
  const mid=prepared();buffer(mid,'EB');dry(mid);act(mid,'attach');act(mid,'aspirate',{target:'cDNA'});act(mid,'dispense',{target:'A1',surface:'well'});act(mid,'aspirate',{target:'A1',surface:'well'});
  const drying=prepared('EH');buffer(drying,'EB');act(drying,'dry',{mode:'room'});drying.tick(123.5);
  const analysis=fullRun();act(analysis,'observe',{target:'A1',value:'yellow'});
  for(const p of [mid,drying,analysis]){
    const json=JSON.parse(JSON.stringify(p.serialize())),back=Protocol.restore(json);
    assert.deepEqual(back.serialize(),p.serialize());assert.equal(back.balance(),p.balance());
    assert.deepEqual(back.next(),p.next());
  }
  const back=Protocol.restore(JSON.parse(JSON.stringify(mid.serialize())));
  act(back,'dispense',{target:'A1',surface:'well'});assert.equal(back.wells.A1.mixes,1,'restored runs continue under the same rules');
  const d=Protocol.restore(JSON.parse(JSON.stringify(drying.serialize())));d.tick(476.5);assert.equal(d.phase,'samples');assert.equal(d.rows[0],'E');
});
test('restore rejects tampered, foreign or inconsistent saves',()=>{
  const p=prepared();act(p,'attach');act(p,'aspirate',{target:'EB'});const good=()=>JSON.parse(JSON.stringify(p.serialize()));
  const bad=[
    s=>{s.schema='microarray-3d-2';},s=>{s.phase='skip';},s=>{s.reagents.EB=1000;},s=>{s.tip.volume=3;},
    s=>{s.wells.A1.mixes=7;},s=>{delete s.spots.B2;},s=>{s.waste=50;},s=>{s.colors.A1='purple';},
    s=>{s.interpretations.A1='up';},s=>{s.timer={total:300,remaining:10,phase:'eb',mode:'incubator',initialVolumes:{},evaporatedStart:0};},
    s=>{s.rows=['A','B','C','Z'];},s=>{s.tipCount=500;}
  ];
  for(const mutate of bad){const s=good();mutate(s);assert.throws(()=>Protocol.restore(s),e=>e.code==='restore',String(mutate));}
  assert.throws(()=>Protocol.restore(null),/different version/);
  assert.equal(Protocol.restore(good()).reagents.EB,195);
});
test('session saves, loads and clears, and tolerates unavailable storage',()=>{
  const store=memoryStorage(),s=new Session(store);assert.equal(s.available,true);
  assert.equal(s.load(),null);assert.equal(s.save({protocol:{log:[1]},notebook:{}}),true);
  const data=s.load();assert.equal(data.app,'microarray-3d-3');assert.ok(data.savedAt>0);assert.deepEqual(data.protocol,{log:[1]});
  store.setItem('microarray3d-v3-run','{not json');assert.equal(s.load(),null);
  s.clear();assert.equal(s.load(),null);
  const broken=new Session({getItem(){throw Error('x')},setItem(){throw Error('quota')},removeItem(){}});
  assert.equal(broken.available,false);assert.equal(broken.save({protocol:{}}),false);assert.equal(broken.load(),null);
  assert.equal(age(Date.now()-30e3),'just now');assert.equal(age(Date.now()-14*60e3),'14 min ago');assert.equal(age(Date.now()-3*3600e3),'3 h ago');
});
test('reasoning questions match the manual example for both card sets',()=>{
  for(const set of ['AD','EH']){
    const p=fullRun(set),list=A.questions(p.rows);assert.equal(list.length,7);
    for(const q of list){assert.equal(q.options.filter(o=>o.correct).length,1,q.id);assert.ok(q.options.every(o=>o.feedback&&o.text),q.id);}
    const color=(row,col)=>p.result(p.rows[row]+col);
    assert.equal(color(1,1),'yellow');assert.equal(color(1,6),'red');assert.equal(color(2,8),'black');assert.equal(color(2,7),'green');
    const col7=[0,1,2,3].map(r=>color(r,7));assert.deepEqual(col7,['green','green','green','green']);
    for(const c of [5,6,8])assert.ok([0,1,2,3].some(r=>color(r,c)!=='green'),'only gene 3 is down in every patient');
    assert.match(list.find(q=>q.id==='red').prompt,new RegExp(p.rows[1]+'6'));
  }
  const positions=A.questions().map(q=>A.displayOrder(q).findIndex(o=>o.correct));assert.ok(new Set(positions).size>=3,'correct answers are not always in the same place');
});
test('answers record attempts and first-try accuracy; debrief summarises corrections',()=>{
  const p=fullRun(),list=A.questions(p.rows),nb=A.emptyNotebook();
  const wrong=list[0].options.find(o=>!o.correct),right=list[0].options.find(o=>o.correct);
  assert.equal(A.answer(nb,list,list[0].id,wrong.id).correct,false);assert.equal(A.answer(nb,list,list[0].id,right.id).correct,true);
  assert.deepEqual({attempts:nb.answers[list[0].id].attempts,first:nb.answers[list[0].id].first},{attempts:2,first:false});
  A.answer(nb,list,list[1].id,list[1].options.find(o=>o.correct).id);
  nb.open.cer='Gene 3 is green in all four patients, so it is expressed less than in control cells.';
  const mistakes=[{code:'tip',message:'x',phase:'samples',sample:'A2',action:'aspirate'},{code:'order',message:'y',phase:'samples',sample:'A2',action:'dispense'},{code:'mixing',message:'z',phase:'samples',sample:'C4',action:'dispense'},{code:'paused',message:'p',phase:'eb'},{code:'analysis',message:'a',phase:'analyze',action:'verifyControls'}];
  const d=A.debrief({protocol:p,mistakes,notebook:nb,list});
  assert.equal(d.mistakes.total,3);assert.equal(d.mistakes.byCategory.tip.count,1);assert.equal(d.technique.samplesClean,30);
  assert.equal(d.consumables.tipsUsed,34);assert.deepEqual(d.consumables.reagents,{EB:40,cDNA:40,HB:40});
  assert.equal(d.questions.correct,2);assert.equal(d.questions.firstTry,1);assert.equal(d.open.answered,1);
  assert.deepEqual(d.analysis.controls,{attempts:1,passed:false,firstTry:false});
  assert.equal(A.categoryOf('unknown-code'),'sequence');
});
test('framing chooses the working set for each step and fits it inside the safe rectangle',()=>{
  const p=prepared();assert.deepEqual(workSet(p).names,['card','rack','tips']);
  const k1=stateKey(p);act(p,'attach');assert.equal(stateKey(p),k1,'sub-steps do not move the camera');
  const q=fullRun();assert.deepEqual(workSet(q).names,['cardAt']);
  const pts=[[-4.6,0,-1.4],[4.6,0,-1.4],[-4.6,.5,2.6],[4.6,.5,2.6]],size={w:1100,h:720},safe={left:16,right:860,top:120,bottom:600};
  const cam=fit(pts,{at:[0,0,0],yaw:0,pitch:1.05,distance:12,fov:42},size,safe,E3D.cameraMatrices);
  const {vp}=E3D.cameraMatrices(cam,size.w,size.h),proj=pts.map(p=>{const v=E3D.M.point(vp,p);return [(v[0]+1)/2*size.w,(1-v[1])/2*size.h];});
  const xs=proj.map(p=>p[0]),ys=proj.map(p=>p[1]);
  assert.ok(Math.min(...xs)>=safe.left-2&&Math.max(...xs)<=safe.right+2,'fits horizontally');assert.ok(Math.min(...ys)>=safe.top-2&&Math.max(...ys)<=safe.bottom+2,'fits vertically');
  assert.ok(Math.max(...xs)-Math.min(...xs)>(safe.right-safe.left)*.9||Math.max(...ys)-Math.min(...ys)>(safe.bottom-safe.top)*.9,'uses the available space');
});
test('auto-framing never moves the camera during a stroke and yields to manual control',()=>{
  const cam={at:[0,0,0],yaw:0,pitch:.9,distance:15,fov:42};let busy=false,applied=0;
  const f=new AutoFrame({camera:()=>cam,apply:c=>{Object.assign(cam,c);applied++;},size:()=>({w:1000,h:700}),safe:()=>({left:16,right:980,top:100,bottom:600}),bounds:()=>[[-2,0,-1],[2,0,1]],cameraMatrices:E3D.cameraMatrices,busy:()=>busy,reduced:()=>true});
  const p=prepared();busy=true;assert.equal(f.update(p),false);assert.equal(applied,0);
  busy=false;assert.equal(f.retry(p),true);assert.equal(applied,1);
  f.userMoved();act(p,'attach');assert.equal(f.update(p,{force:true}),false,'manual camera is respected within a step');
  act(p,'eject');buffer(p,'EB');assert.equal(f.update(p),true,'a new step re-enables framing');assert.equal(f.manual,false);
});
