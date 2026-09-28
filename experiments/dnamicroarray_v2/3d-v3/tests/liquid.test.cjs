const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fillProfile,volumeBelow,QuantityTween}=require('../liquid.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} should equal ${b}`);
test('fill height follows vessel volume, including cone and cylinder limits',()=>{
  near(fillProfile([[0,0],[1,1]],.125).height,.5);
  near(fillProfile([[1,0],[1,1]],.25).height,.25);
  const tube=[[.008,.065],[.062,.14],[.094,.47],[.101,.54]],capacity=volumeBelow(tube,.54);
  for(const fraction of [0,.025,.2,.5,.975,1]){
    const fill=fillProfile(tube,fraction);
    near(volumeBelow(tube,fill.height)/capacity,fraction);
    assert.ok(fill.profile.flat().every(Number.isFinite));
    assert.ok(fill.radius>=.008&&fill.radius<=.101);
  }
});
test('liquid presentation settles at exact quantities and retargets without jumps',()=>{
  const tween=new QuantityTween(200);tween.set(195);tween.advance(.17);
  assert.ok(tween.value>195&&tween.value<200);const current=tween.value;
  tween.set(190);assert.equal(tween.value,current);tween.advance(1);assert.equal(tween.value,190);
  tween.set(0);const before=tween.value;tween.advance(0);assert.equal(tween.value,before);
  tween.advance(1);assert.equal(tween.value,0);assert.equal(tween.advance(1),false);
  tween.set(5,true);assert.equal(tween.value,5);assert.throws(()=>tween.set(NaN));
});
