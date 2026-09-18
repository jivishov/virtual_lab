const test=require('node:test'),assert=require('node:assert/strict');
const {TimerClock}=require('./timer-clock.js');

test('timer clock advances independently of render frames at 60x',()=>{
  let now=0,speed=60,advanced=0;
  const clock=new TimerClock({now:()=>now,readSpeed:()=>speed,advance:s=>{advanced+=s}});
  clock.start();
  now=1000;
  assert.equal(clock.sync(),60);
  assert.equal(advanced,60);
  now=5000;
  assert.equal(clock.sync(),240);
  assert.equal(advanced,300);
});

test('timer clock preserves elapsed time across speed changes',()=>{
  let now=0,speed=60,advanced=0;
  const clock=new TimerClock({now:()=>now,readSpeed:()=>speed,advance:s=>{advanced+=s}});
  clock.start();
  now=1000;
  speed=30;
  clock.changeSpeed();
  assert.equal(advanced,60);
  now=2000;
  clock.sync();
  assert.equal(advanced,90);
});

test('timer clock catches up after a throttled or hidden interval',()=>{
  let now=0,advanced=0;
  const clock=new TimerClock({now:()=>now,readSpeed:()=>60,advance:s=>{advanced+=s}});
  clock.start();
  now=5000;
  clock.sync();
  assert.equal(advanced,300);
});

test('reset prevents stale elapsed time from leaking into a later incubation',()=>{
  let now=0,advanced=0;
  const clock=new TimerClock({now:()=>now,readSpeed:()=>60,advance:s=>{advanced+=s}});
  clock.start();
  now=1000;
  clock.sync();
  clock.reset();
  now=10000;
  clock.start();
  now=11000;
  clock.sync();
  assert.equal(advanced,120);
});
