'use strict';
// Synthetic-landmark regression tests. These test application geometry and
// state transitions, not webcam/model accuracy on real occluded hands.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function rig() {
  let now = 0, actions = [];
  const Lab = { state: { S: { busy: false, module: 1, phase: 'buffer', pipette: {
    hasTip: true, volume: 0, reagent: null }, wells: {} } },
    pipette: { handButtons() {}, plungerPress() {} }, stations: {},
    engine: { clearHighlight() {}, targetAt() { return {el: 'source'}; },
      evaluate() { return {ok: true, action: 'aspirate'}; },
      perform(t, e) { actions.push(e.action); } }, tools: { tipOf() { return () => ({x: 1, y: 1}); } },
    ui: { flash() {} } };
  const box = { Lab, console, performance: { now: () => now }, window: { Lab },
    document: { documentElement: {clientWidth: 1200, clientHeight: 800} } };
  vm.createContext(box);
  let src = fs.readFileSync(path.join(root, 'js/pipette-control.js'), 'utf8');
  src = src.replace('  Lab.pipetteControl = {', '  Lab._cal = {startCapture: startCapture, begin: begin, cancel: cancel, get: function () {return {profile:profile, step:step, notice:notice};}};\n  Lab.pipetteControl = {');
  vm.runInContext(src, box);
  src = fs.readFileSync(path.join(root, 'js/handcontrol.js'), 'utf8');
  src = src.replace('  Lab.hand = {', `  Lab._hand = {
    free: updateFreeButtons, real: updateRealButtons, cancel: cancelPendingGestures,
    lost: onHandLost, Gate: Gate, receive: receiveResult,
    setup: function (h) { S.held='pipette'; grip.reset(true); restRise=h.rise;
      restSide=h.side; settleUntil=0; freeNeedsRest=false; thumbSmooth=null;
      press.reset(); resetRealPress(); },
    counters: function () {return {pressed:press.on, needsRest:freeNeedsRest, cycle:realCycle};},
    replaceActions: function (fn) { onPlunger=function(){fn('press');}; onEject=function(){fn('eject');}; }
  };\n  Lab.hand = {`);
  vm.runInContext(src, box);
  Lab._hand.replaceActions(a => actions.push(a));
  return { Lab, actions, now: value => { now = value; } };
}
function hand(kind='rest', open=false) {
  const p = Array.from({length:21}, () => ({x:0,y:0,z:0}));
  p[1]={x:-.025,y:.025,z:0};
  function extend(from, len, angle, side=0) {
    return {x:from.x+len*Math.sin(side), y:from.y+len*Math.cos(side)*Math.cos(angle),
      z:from.z+len*Math.cos(side)*Math.sin(angle)};
  }
  const sideways=kind==='eject' ? -.85 : -.12;
  p[2]=extend(p[1],.032,0,sideways);
  p[3]=extend(p[2],.025,kind==='press' ? .95 : kind==='eject' ? .5 : 0,sideways);
  p[4]=extend(p[3],.02,kind==='press' ? 1.9 : kind==='eject' ? 1.3 : 0,sideways);
  [5,9,13,17].forEach((i,f) => {
    p[i]={x:-.019+f*.018,y:.06-(f===3?.01:0),z:0};
    p[i+1]={x:p[i].x,y:p[i].y+.020,z:.01};
    p[i+2]={x:p[i].x,y:p[i].y+(open?.038:.010),z:open?.01:.028};
    p[i+3]={x:p[i].x,y:p[i].y+(open?.060:.004),z:open?.01:.025};
  });
  return p;
}
function rotate(p, yaw=0, pitch=0, roll=0, scale=1, mirror=1) {
  return p.map(q=>{
    let x=q.x*mirror, y=q.y, z=q.z;
    [x,z]=[x*Math.cos(yaw)+z*Math.sin(yaw),-x*Math.sin(yaw)+z*Math.cos(yaw)];
    [y,z]=[y*Math.cos(pitch)-z*Math.sin(pitch),y*Math.sin(pitch)+z*Math.cos(pitch)];
    [x,y]=[x*Math.cos(roll)-y*Math.sin(roll),x*Math.sin(roll)+y*Math.cos(roll)];
    return {x:x*scale+.03,y:y*scale-.02,z:z*scale+.04};
  });
}
function image(world, aspect=4/3) {
  return world.map(p=>({x:.5+p.x*3/aspect,y:.6-p.y*3,z:-p.z*3/aspect}));
}
function calibrate(r) {
  const c=r.Lab.pipetteControl;
  ['rest','press','eject'].forEach((kind,k)=> {
    const base=5000*k; r.now(base); r.Lab._cal.startCapture();
    for(let i=0;i<48;i++) c.observe(c.measure(rotate(hand(kind),(i/47-.5)*2.4,.25,.15)),base+1450+i*45);
    r.now(base+4100); c.tick(base+4100);
    assert.equal(r.Lab._cal.get().step, k===2?-1:k+1, r.Lab._cal.get().notice);
  });
  assert.ok(c.ready());
}
function driveFree(r, world, from, until) {
  const c=r.Lab.pipetteControl;
  for(let t=from;t<=until;t+=20){r.now(t); const m=c.measure(world);r.Lab._hand.free({thumbReady:!!m,rise:m&&m.rise,side:m&&m.side},t);}
}
test('calibration and both buttons survive 3D rotations, translation, scale and mirrored geometry',()=>{
  const r=rig();calibrate(r);const c=r.Lab.pipetteControl;
  for(const kind of ['rest','press','eject']) for(const yaw of [-1.5,-.9,0,.9,1.5])
    for(const pitch of [-.8,0,.8]) for(const roll of [-1,0,1]) for(const scale of [.7,1,1.3])
      for(const mirror of [-1,1]) {
        const m=c.measure(rotate(hand(kind),yaw,pitch,roll,scale,mirror));
        assert.equal(c.classify(m,true).button,kind,`${kind},${yaw},${pitch},${roll},${scale},${mirror}`);
      }
});
test('hidden/collapsed finger landmarks do not veto a held pipette; cannot acquire with no finger evidence',()=>{
  const r=rig();calibrate(r);const c=r.Lab.pipetteControl;
  for(const kind of ['rest','press','eject']) {
    const p=hand(kind);for(let i=5;i<21;i++)p[i]={...p[0]};
    const m=c.measure(p); assert.ok(m); assert.equal(c.classify(m,true).button,kind);
    assert.equal(c.classify(m,true).holding,true);assert.equal(c.classify(m,false).holding,false);
  }
});
test('missing ring and little finger world coordinates preserve primary thumb features',()=>{
  const r=rig(), c=r.Lab.pipetteControl, p=hand('press');
  const before=c.measure(p).thumb; for(let i=13;i<21;i++)p[i]={x:NaN,y:NaN,z:NaN};
  assert.deepEqual(c.measure(p).thumb,before);
});
test('open fingers still release holding permission',()=>{
  const r=rig();calibrate(r);const c=r.Lab.pipetteControl;
  assert.equal(c.classify(c.measure(hand('rest',true)),true).holding,false);
});
test('invalid thumb/world readings are rejected, without falling back to projected presses',()=>{
  const r=rig(),c=r.Lab.pipetteControl;assert.equal(c.measure(null),null);
  for(const bad of [null,{x:NaN,y:0,z:0},{x:Infinity,y:0,z:0}]){const p=hand();p[4]=bad;assert.equal(c.measure(p),null);}
  const p=hand();p[4]={...p[3]};assert.equal(c.measure(p),null);
  const h=r.Lab.hand.read(image(hand()),4/3,true,null);assert.equal(h.thumbReady,false);assert.equal(h.rise,null);
});
test('free-hand thumb signal is yaw/pitch/roll invariant in the actual readHand entry point',()=>{
  const r=rig();const base=r.Lab.hand.read(image(hand()),4/3,true,hand());
  for(const aspect of [4/3,16/9,9/16]) for(const yaw of [-1.5,-.8,0,.8,1.5]){
    const p=rotate(hand(),yaw,.4,.5);const h=r.Lab.hand.read(image(p,aspect),aspect,true,p);
    assert.ok(h && h.thumbReady);assert.ok(Math.abs(h.rise-base.rise)<1e-10);
  }
});
test('turning a fist does not press; one held downstroke fires once, then release rearms',()=>{
  const r=rig(),c=r.Lab.pipetteControl;r.Lab._hand.setup(c.measure(hand()));
  for(let i=0;i<50;i++)driveFree(r,rotate(hand(),(i/49-.5)*3,.5,.4),i*20,i*20);
  assert.deepEqual(r.actions,[]);driveFree(r,hand('press'),1000,1600);assert.deepEqual(r.actions,['press']);
  driveFree(r,hand(),1620,2000);driveFree(r,hand('press'),2020,2600);assert.deepEqual(r.actions,['press','press']);
});
test('free-hand tracking gap keeps tool gesture locked until a visible release',()=>{
  const r=rig(),c=r.Lab.pipetteControl;r.Lab._hand.setup(c.measure(hand()));
  driveFree(r,hand(),0,300);driveFree(r,hand('press'),320,650);assert.equal(r.actions.length,1);
  r.Lab._hand.cancel();driveFree(r,hand('press'),900,1400);assert.equal(r.actions.length,1);
  driveFree(r,hand(),1420,1800);driveFree(r,hand('press'),1820,2300);assert.equal(r.actions.length,2);
});
test('a missing thumb cannot complete a pending free-hand press',()=>{
  const r=rig(),c=r.Lab.pipetteControl;r.Lab._hand.setup(c.measure(hand()));
  driveFree(r,hand(),0,300);driveFree(r,hand('press'),320,340);
  r.Lab._hand.free({thumbReady:false,rise:null,side:null},360);
  driveFree(r,hand('press'),400,800);assert.equal(r.actions.length,0);
  driveFree(r,hand(),820,1150);driveFree(r,hand('press'),1170,1600);assert.equal(r.actions.length,1);
});
test('slow free-hand plunger motion is not absorbed by baseline adaptation',()=>{
  const r=rig(),c=r.Lab.pipetteControl;const a=hand(),b=hand('press');r.Lab._hand.setup(c.measure(a));
  driveFree(r,a,0,300);
  for(let i=0;i<=75;i++){
    const u=i/75,p=a.map((v,j)=>({x:v.x*(1-u)+b[j].x*u,y:v.y*(1-u)+b[j].y*u,z:v.z*(1-u)+b[j].z*u}));
    driveFree(r,p,320+i*20,320+i*20);
  }
  driveFree(r,b,1840,2100);assert.equal(r.actions.length,1);
});
test('real aspiration occurs only on fresh release, even when fingers collapse during the stroke',()=>{
  const r=rig();calibrate(r);const c=r.Lab.pipetteControl;r.Lab._hand.setup(c.measure(hand()));
  function feed(kind,from,to,collapse=false){const p=hand(kind);if(collapse)for(let i=5;i<21;i++)p[i]={...p[0]};
    for(let t=from;t<=to;t+=20){r.now(t);r.Lab._hand.real(c.classify(c.measure(p),true),t);}}
  feed('rest',0,200);feed('press',220,500,true);assert.equal(r.actions.length,0);
  feed('rest',520,800,true);assert.deepEqual(r.actions,['aspirate']);
});
test('a tracking gap cancels real pending aspiration rather than replaying release',()=>{
  const r=rig();calibrate(r);const c=r.Lab.pipetteControl;r.Lab._hand.setup(c.measure(hand()));
  const feed=(kind,a,b)=>{for(let t=a;t<=b;t+=20){r.now(t);r.Lab._hand.real(c.classify(c.measure(hand(kind)),true),t);}};
  feed('rest',0,200);feed('press',220,500);r.Lab._hand.cancel();feed('rest',800,1100);assert.equal(r.actions.length,0);
  feed('press',1120,1400);feed('rest',1420,1700);assert.deepEqual(r.actions,['aspirate']);
});
test('sustained ambiguous real thumb readings cancel a pending upstroke',()=>{
  const r=rig();calibrate(r);const c=r.Lab.pipetteControl;r.Lab._hand.setup(c.measure(hand()));
  for(let t=0;t<=200;t+=20)r.Lab._hand.real(c.classify(c.measure(hand()),true),t);
  for(let t=220;t<=500;t+=20)r.Lab._hand.real(c.classify(c.measure(hand('press')),true),t);
  for(let t=520;t<=720;t+=20)r.Lab._hand.real({holding:true,button:'unknown',depth:.5,selection:'press'},t);
  for(let t=740;t<=1000;t+=20)r.Lab._hand.real(c.classify(c.measure(hand()),true),t);
  assert.equal(r.actions.length,0);
});
test('calibration rejects identical button poses',()=>{
  const r=rig(),c=r.Lab.pipetteControl;
  for(let k=0;k<2;k++){const base=k*5000;r.now(base);r.Lab._cal.startCapture();
    for(let i=0;i<30;i++)c.observe(c.measure(hand()),base+1450+i*60);
    r.now(base+4100);c.tick(base+4100);}
  assert.equal(c.ready(),false);assert.equal(r.Lab._cal.get().step,1);
  assert.match(r.Lab._cal.get().notice,/not distinct/);
});

test('free-hand pickup before a usable thumb reading recovers without an action',()=>{
  const r=rig();r.Lab._hand.setup({rise:null,side:null});
  r.Lab._hand.free({thumbReady:false,rise:null,side:null},0);
  driveFree(r,hand(),100,500);assert.equal(r.actions.length,0);
  driveFree(r,hand('press'),520,900);assert.equal(r.actions.length,1);
});
test('free-hand plunger still works with an unusable across-knuckle frame',()=>{
  const r=rig(),c=r.Lab.pipetteControl;const a=hand(),b=hand('press');
  for(let i=5;i<21;i++){a[i]={...a[0]};b[i]={...b[0]};}
  assert.equal(c.measure(a).side,null);r.Lab._hand.setup(c.measure(a));
  driveFree(r,a,0,300);driveFree(r,b,320,750);assert.deepEqual(r.actions,['press']);
});
test('small deterministic thumb jitter during a held resting grip does not fire',()=>{
  const r=rig(),c=r.Lab.pipetteControl;r.Lab._hand.setup(c.measure(hand()));
  for(let i=0;i<200;i++){
    const p=hand();p[3].y+=Math.sin(i*1.8)*.0008;p[4].y+=Math.cos(i*1.7)*.001;
    driveFree(r,p,i*20,i*20);
  }
  assert.deepEqual(r.actions,[]);
});
test('unreliable thumb geometry cancels real aspiration and requires release to rearm',()=>{
  const r=rig();calibrate(r);const c=r.Lab.pipetteControl;r.Lab._hand.setup(c.measure(hand()));
  const feed=(kind,a,b)=>{for(let t=a;t<=b;t+=20)r.Lab._hand.real(c.classify(c.measure(hand(kind)),true),t);};
  feed('rest',0,200);feed('press',220,500);
  r.Lab._hand.real(c.classify(null,true),520);feed('press',540,800);feed('rest',820,1100);
  assert.equal(r.actions.length,0);feed('press',1120,1400);feed('rest',1420,1700);
  assert.deepEqual(r.actions,['aspirate']);
});
test('real release cannot aspirate after protocol state changed during the stroke',()=>{
  const r=rig();calibrate(r);const c=r.Lab.pipetteControl;r.Lab._hand.setup(c.measure(hand()));
  for(let t=0;t<=200;t+=20)r.Lab._hand.real(c.classify(c.measure(hand()),true),t);
  for(let t=220;t<=500;t+=20)r.Lab._hand.real(c.classify(c.measure(hand('press')),true),t);
  r.Lab.state.S.phase='antigen';
  for(let t=520;t<=800;t+=20)r.Lab._hand.real(c.classify(c.measure(hand()),true),t);
  assert.equal(r.actions.length,0);
});
test('free-hand selection does not accidentally enable real calibrated actions',()=>{
  const r=rig();calibrate(r);const c=r.Lab.pipetteControl;c.setEnabled(false);
  assert.equal(c.ready(),false);assert.equal(c.classify(c.measure(hand('press')),true).button,'unknown');
  assert.ok(c.measure(hand()).rise!==null); // free geometry remains available
});
