const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function load(saved){
  const events=[],store={};if(saved)store['microarray3d-v3-hand']=JSON.stringify(saved);
  const c=vm.createContext({Event,dispatchEvent:e=>events.push(e.type),document:{getElementById:()=>null},localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=v}});
  c.globalThis=c;vm.runInContext(fs.readFileSync(require.resolve('../hand-tuning.js'),'utf8'),c);return {t:c.ClassroomHandTuning,events,store};
}
test('hand settings default to the thumb press, clamp values and announce changes',()=>{
  const {t,events,store}=load();assert.deepEqual(JSON.parse(JSON.stringify(t.get())),{mode:'thumb',gain:2.2,smoothing:.5,assist:true});
  t.set({gain:9,smoothing:-1,mode:'pinch',assist:false});assert.deepEqual(JSON.parse(JSON.stringify(t.get())),{mode:'pinch',gain:4,smoothing:0,assist:false});
  assert.deepEqual([...events],['microarray-hand-settings']);assert.equal(JSON.parse(store['microarray3d-v3-hand']).mode,'pinch');
  assert.equal(load({mode:'weird',gain:'x'}).t.get().mode,'thumb');
});
test('a pinch saved only because it used to be the default becomes the thumb press; a chosen pinch is kept',()=>{
  const old=load({mode:'pinch',gain:3,smoothing:.2,assist:true}).t.get();assert.equal(old.mode,'thumb');assert.equal(old.gain,3);
  assert.equal(load({mode:'pinch',gain:3,smoothing:.2,assist:true,modeChosen:true}).t.get().mode,'pinch');
  const {t,store}=load();t.set({mode:'pinch'});assert.equal(load(JSON.parse(store['microarray3d-v3-hand'])).t.get().mode,'pinch');
});
test('steadier smoothing lowers the filter cutoff and speed response',()=>{
  const {t}=load(),quick=t.filterParams(0),steady=t.filterParams(1);
  assert.ok(quick.minCutoff>steady.minCutoff&&quick.beta>steady.beta&&steady.minCutoff>0);
});
