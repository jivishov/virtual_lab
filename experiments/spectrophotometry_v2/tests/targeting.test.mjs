import test from 'node:test';
import assert from 'node:assert/strict';
import {pickScreenTarget,SettledAim,AIM} from '../src/targeting.js';

const point=(id,x,y=100,radius=24)=>({id,x,y,radius,z:.9,visible:true});

test('the target under the cursor beats expected-target assistance, including adjacent tubes',()=>{
 const points=[point('expected',100),point('neighbor',136),point('third',172)];
 for(const p of points)assert.equal(pickScreenTarget(points,p.x,p.y,{hand:true,expected:'expected',prefer:'expected'}).id,p.id);
 assert.equal(pickScreenTarget(points,100,152,{hand:true,expected:'expected'}).id,'expected');
 assert.equal(pickScreenTarget(points,100,152,{expected:'expected'}),null,'Mouse cannot silently jump to an expected target');
});

test('hidden, behind-camera and invalid-coordinate targets are not selectable',()=>{
 const points=[{...point('hidden',100),visible:false},{...point('behind',100),z:1.1}];
 assert.equal(pickScreenTarget(points,100,100,{hand:true,expected:'hidden'}),null);
 assert.equal(pickScreenTarget([point('valid',100)],NaN,100),null);
 assert.equal(pickScreenTarget([point('valid',100)],100,190,{hand:true,expected:'valid'}),null);
});

test('hand preference reduces boundary jitter but yields to a clearly closer target',()=>{
 const points=[point('left',100),point('right',136)];
 assert.equal(pickScreenTarget(points,119,100,{hand:true,prefer:'left'}).id,'left');
 assert.equal(pickScreenTarget(points,134,100,{hand:true,prefer:'left'}).id,'right');
 assert.equal(pickScreenTarget(points,119,100).id,'right');
});

test('a sweep never accumulates an alignment lock, while settled continuous samples do',()=>{
 const aim=new SettledAim();
 for(let i=0;i<12;i++)assert.equal(aim.update('tube',100+i*8,100,i*40),false);
 aim.reset();for(const now of [0,40,80,120,160,200,240])assert.equal(aim.update('tube',100,100,now),false);
 assert.equal(aim.update('tube',100,100,AIM.settleMs),true);
});

test('target changes, invalid evidence, timestamp gaps and explicit resets discard settling',()=>{
 const aim=new SettledAim();
 aim.update('a',100,100,0);aim.update('a',100,100,160);
 assert.equal(aim.update('b',100,100,280),false);assert.equal(aim.progress,0);
 assert.equal(aim.update('b',100,100,280+AIM.maxGapMs+1),false,'A stale gap is not a dwell');
 aim.update(null,100,100,640);assert.equal(aim.sample,null);
 aim.update('b',100,100,680);aim.reset();assert.equal(aim.progress,0);assert.equal(aim.sample,null);
});

test('three continuous camera observations can line up a tip at four frames per second',()=>{
 const aim=new SettledAim();
 for(const t of [100,350])assert.equal(aim.update('stockBottle',120,100,t),false);
 assert.equal(aim.update('stockBottle',121,101,600),true);
});
