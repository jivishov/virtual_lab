import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,getStep,perform,validate,beginTransfer,advanceTransfer,setStatus,totalVolume,fitCalibration} from '../src/model.js';

const close=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} ≈ ${expected}`);
function unchanged(state,fn){const before=structuredClone(state),result=fn();assert.equal(result.ok,false,result.message);assert.deepEqual(state,before);return result}
import { notebookDecision } from '../src/model.js';
function advanceProtocol(s,step){
  if(step.target!=='notebook')return perform(s,step.action,step.target);
  return notebookDecision(s,step.action,step.action==='report'?{diluted:1.555,factor:2,original:3.11}:{aliquot:5});
}
function next(state){const step=getStep(state),result=advanceProtocol(state,step);assert.equal(result.ok,true,`Step ${state.step}: ${result.message}`);return result}
function until(state,predicate){let budget=120;while(!predicate(getStep(state),state)&&budget--)next(state);assert.ok(budget>0)}
function components(state){const liquids=[...Object.values(state.bottles),...Object.values(state.tubes),state.pipette,state.waterPipette,state.unknownPipette,state.cuvette,state.wasteContents];return ['stockVolume','waterVolume','unknownVolume'].map(key=>liquids.reduce((sum,l)=>sum+l[key],0))}
function conserved(state){close(totalVolume(state),2500);components(state).forEach((v,i)=>close(v,[1000,1000,500][i]));}

test('aspiration begins without material mutation, resumes in place, and commits one completed instruction',()=>{
  const s=createState(),before=structuredClone(s);
  const begun=beginTransfer(s,'aspirate','stockBottle');assert.equal(begun.ok,true);assert.equal(begun.remaining,10);
  assert.deepEqual(s.pipette,before.pipette);assert.deepEqual(s.bottles,before.bottles);assert.equal(s.history.length,0);
  assert.deepEqual(s.transfer,{action:'aspirate',target:'stockBottle',pipetteId:'pipette',goal:10,delivered:0,step:0});
  let result=advanceTransfer(s,1.25);assert.equal(result.complete,false);assert.equal(result.transferred,1.25);assert.equal(result.remaining,8.75);
  assert.equal(s.pipette.volume,1.25);assert.equal(s.pipette.source,'stockBottle');assert.equal(s.pipette.stockVolume,1.25);assert.equal(s.bottles.stockBottle.volume,998.75);assert.equal(s.step,0);assert.equal(s.history.length,0);conserved(s);
  const partial=structuredClone(s);assert.equal(beginTransfer(s,'aspirate','stockBottle').ok,true);assert.deepEqual(s,partial,'Resuming does not restart or duplicate material');
  advanceTransfer(s,2.75);assert.equal(s.pipette.volume,4);assert.equal(s.transfer.delivered,4);conserved(s);
  result=advanceTransfer(s,99);assert.equal(result.transferred,6);assert.equal(result.complete,true);assert.equal(result.remaining,0);
  assert.equal(s.pipette.volume,10);assert.equal(s.transfer,null);assert.equal(s.step,1);assert.equal(s.history.length,1);assert.equal(s.history[0].volume,10);conserved(s);
  unchanged(s,()=>advanceTransfer(s,1));
});

test('delivery retains material in the pipette and receiver until the complete dose is recorded',()=>{
  const s=createState();next(s);assert.equal(beginTransfer(s,'dispense','tube_10_0').ok,true);
  const r=advanceTransfer(s,2.5);assert.equal(r.complete,false);assert.equal(s.pipette.volume,7.5);assert.equal(s.tubes.tube_10_0.volume,2.5);
  assert.equal(s.tubes.tube_10_0.source,'tube_10_0');assert.equal(s.pipette.source,'stockBottle');assert.equal(s.step,1);assert.equal(s.history.length,1);conserved(s);
  assert.equal(validate(s,'dispense','tube_10_0').ok,true);
  const finished=perform(s,'dispense','tube_10_0');assert.equal(finished.ok,true);assert.equal(finished.transferred,7.5);assert.equal(finished.complete,true);
  assert.equal(s.pipette.volume,0);assert.equal(s.pipette.source,null);assert.equal(s.tubes.tube_10_0.volume,10);assert.equal(s.history.length,2);assert.equal(s.step,2);conserved(s);
});

test('water added in increments updates dilution concentration from actual volumes',()=>{
  const s=createState();until(s,step=>step.action==='dispense'&&step.target==='tube_8_2'&&step.volume===2);
  beginTransfer(s,'dispense','tube_8_2');advanceTransfer(s,.25);
  const tube=s.tubes.tube_8_2;assert.equal(tube.stockVolume,8);assert.equal(tube.waterVolume,.25);assert.equal(tube.volume,8.25);close(tube.concentration,2.31*8/8.25);conserved(s);
  advanceTransfer(s,.5);assert.equal(tube.waterVolume,.75);close(tube.concentration,2.31*8/8.75);conserved(s);
  const end=advanceTransfer(s,2);assert.equal(end.transferred,1.25);assert.equal(end.complete,true);assert.equal(tube.volume,10);close(tube.concentration,1.848);conserved(s);
});

test('mixed standard aliquots conserve both component equivalents during aspiration and delivery',()=>{
  const s=createState();until(s,step=>step.action==='aspirate'&&step.target==='tube_8_2');
  beginTransfer(s,'aspirate','tube_8_2');advanceTransfer(s,.5);
  close(s.pipette.stockVolume,.4);close(s.pipette.waterVolume,.1);close(s.tubes.tube_8_2.stockVolume,7.6);close(s.tubes.tube_8_2.waterVolume,1.9);conserved(s);
  advanceTransfer(s,2.5);beginTransfer(s,'dispense','cuvette');advanceTransfer(s,.75);
  close(s.cuvette.stockVolume,.6);close(s.cuvette.waterVolume,.15);close(s.cuvette.concentration,1.848);assert.equal(s.cuvette.source,'tube_8_2');assert.equal(s.cuvette.clean,true);conserved(s);
  advanceTransfer(s,10);assert.equal(s.cuvette.volume,3);assert.equal(s.pipette.volume,0);conserved(s);
});

test('partial rinsing does not mark a dirty cuvette clean or permit early insertion',()=>{
  const s=createState();until(s,step=>step.action==='dispense'&&step.target==='cuvette'&&!s.cuvette.clean);
  beginTransfer(s,'dispense','cuvette');advanceTransfer(s,.5);
  assert.equal(s.cuvette.source,'waterBottle');assert.equal(s.cuvette.clean,false);unchanged(s,()=>perform(s,'insert','spec20'));unchanged(s,()=>perform(s,'empty','wasteBeaker'));
  advanceTransfer(s,2.5);assert.equal(s.cuvette.clean,false);next(s);assert.equal(s.cuvette.clean,true);conserved(s);
});

test('an explicitly open chamber lid blocks zero and measurement without changing state',()=>{
  const s=createState();until(s,step=>step.action==='zero');
  s.lidOpen=true;
  assert.match(unchanged(s,()=>perform(s,'zero','spec20')).message,/Close the sample chamber lid/);
  s.lidOpen=false;next(s);assert.equal(s.zeroed,true);
  until(s,step=>step.action==='measure');s.lidOpen=true;
  assert.match(unchanged(s,()=>perform(s,'measure','spec20')).message,/Close the sample chamber lid/);
  s.lidOpen=false;next(s);assert.equal(Object.keys(s.results).length,1);
});

test('Pause and Stop preserve the partial transfer and Run resumes the same dose',()=>{
  const s=createState();beginTransfer(s,'aspirate','stockBottle');advanceTransfer(s,2.25);
  for(const status of ['paused','stopped']){
    setStatus(s,status);unchanged(s,()=>advanceTransfer(s,1));unchanged(s,()=>beginTransfer(s,'aspirate','stockBottle'));unchanged(s,()=>perform(s,'aspirate','stockBottle'));
    assert.equal(s.pipette.volume,2.25);assert.equal(s.transfer.delivered,2.25);assert.equal(s.history.length,0);
  }
  setStatus(s,'running');assert.equal(beginTransfer(s,'aspirate','stockBottle').remaining,7.75);advanceTransfer(s,7.75);assert.equal(s.pipette.volume,10);assert.equal(s.history.length,1);conserved(s);
  beginTransfer(s,'dispense','tube_10_0');advanceTransfer(s,1.75);setStatus(s,'stopped');setStatus(s,'running');next(s);assert.equal(s.tubes.tube_10_0.volume,10);conserved(s);
  const reset=createState();assert.equal(reset.transfer,null);assert.equal(reset.pipette.volume,0);assert.equal(reset.bottles.stockBottle.volume,1000);
});

test('wrong actions, targets and invalid volume inputs leave transfer and material untouched',()=>{
  const s=createState();unchanged(s,()=>beginTransfer(s,'dispense','tube_10_0'));unchanged(s,()=>beginTransfer(s,'aspirate','waterBottle'));unchanged(s,()=>beginTransfer(s,'measure','spec20'));
  beginTransfer(s,'aspirate','stockBottle');advanceTransfer(s,2);
  unchanged(s,()=>beginTransfer(s,'aspirate','waterBottle'));unchanged(s,()=>beginTransfer(s,'dispense','tube_10_0'));unchanged(s,()=>perform(s,'dispense','tube_10_0'));
  for(const volume of [-1,NaN,Infinity,'1',null])unchanged(s,()=>advanceTransfer(s,volume));
  const before=structuredClone(s);assert.equal(advanceTransfer(s,0).transferred,0);assert.deepEqual(s,before);conserved(s);
});

test('depleted sources, overflowing destinations and unrelated pipette contents reject atomically',()=>{
  const depleted=createState();Object.assign(depleted.bottles.stockBottle,{volume:5,stockVolume:5});unchanged(depleted,()=>beginTransfer(depleted,'aspirate','stockBottle'));assert.equal(depleted.transfer,null);
  const unrelated=createState();Object.assign(unrelated.pipette,{volume:1,stockVolume:0,waterVolume:1,concentration:0,source:'waterBottle'});unchanged(unrelated,()=>beginTransfer(unrelated,'aspirate','stockBottle'));
  const overflow=createState();next(overflow);Object.assign(overflow.tubes.tube_10_0,{volume:1,waterVolume:1,source:'waterBottle'});unchanged(overflow,()=>beginTransfer(overflow,'dispense','tube_10_0'));assert.equal(overflow.transfer,null);
  const changed=createState();beginTransfer(changed,'aspirate','stockBottle');advanceTransfer(changed,2);changed.pipette.source='waterBottle';unchanged(changed,()=>beginTransfer(changed,'aspirate','stockBottle'));unchanged(changed,()=>advanceTransfer(changed,1));
  const dry=createState();beginTransfer(dry,'aspirate','stockBottle');advanceTransfer(dry,2);Object.assign(dry.bottles.stockBottle,{volume:1,stockVolume:1});unchanged(dry,()=>advanceTransfer(dry,.25));
});

test('corrupt partial metadata and inconsistent material state reject without partial mutation',()=>{
  const base=createState();beginTransfer(base,'aspirate','stockBottle');advanceTransfer(base,1);
  for(const change of [s=>s.transfer.step++,s=>s.transfer.goal=8,s=>s.transfer.delivered=NaN,s=>s.transfer.delivered=10,s=>s.transfer.target='waterBottle',s=>s.pipette.waterVolume=.5,s=>s.pipette.concentration=0,s=>s.tubes=null,s=>s.history=null]){
    const s=structuredClone(base);change(s);unchanged(s,()=>advanceTransfer(s,.1));unchanged(s,()=>beginTransfer(s,'aspirate','stockBottle'));
  }
});

test('a remainder below validation tolerance is retained until actually transferred',()=>{
  const s=createState();beginTransfer(s,'aspirate','stockBottle');
  assert.equal(advanceTransfer(s,10-1e-9).complete,false);assert.ok(s.transfer);assert.equal(s.step,0);
  assert.equal(advanceTransfer(s,1e-10).complete,false);assert.ok(s.transfer);
  const completed=advanceTransfer(s,1);assert.equal(completed.complete,true);close(s.pipette.volume,10,1e-12);conserved(s);
  beginTransfer(s,'dispense','tube_10_0');assert.equal(advanceTransfer(s,10-1e-9).complete,false);assert.ok(s.pipette.volume>0);
  assert.equal(advanceTransfer(s,1).complete,true);assert.equal(s.pipette.volume,0);conserved(s);
});

test('the full experiment with irregular partial increments matches the original reference execution',()=>{
  const reference=createState();while(!reference.finished)next(reference);
  const s=createState(),sizes=[.07,.33,.2,.41,.09];let i=0,budget=4000;
  while(!s.finished&&budget--){
    const step=getStep(s);
    if(['aspirate','dispense'].includes(step.action)){
      const priorHistory=s.history.length,priorStep=s.step;
      assert.equal(beginTransfer(s,step.action,step.target).ok,true);
      while(s.transfer&&budget--){const result=advanceTransfer(s,sizes[i++%sizes.length]);assert.equal(result.ok,true,`Partial step ${s.step}: ${result.message}`);conserved(s);if(!result.complete){assert.equal(s.step,priorStep);assert.equal(s.history.length,priorHistory)}}
      assert.equal(s.history.length,priorHistory+1);
    }else next(s);
  }
  assert.ok(budget>0);assert.equal(s.finished,true);assert.equal(s.transfer,null);assert.equal(s.history.length,103);assert.deepEqual(s.history,reference.history);
  for(const[id,r]of Object.entries(reference.results)){const actual=s.results[id];assert.equal(actual.absorbance,r.absorbance);close(actual.percentT,r.percentT);if(r.concentration!==null)close(actual.concentration,r.concentration);else assert.equal(actual.concentration,null)}
  close(s.analysis.report.original,2*.2045/fitCalibration(s).slope);assert.equal(s.results.unknown.inRange,false);assert.equal(s.waste,48);close(s.cuvette.unknownVolume,1.5);conserved(s);
});


test('each source and its delivery belong to a dedicated pipette, including partial doses',()=>{
 const state=createState(),tools=['pipette','waterPipette','unknownPipette'];
 for(let budget=115;!state.finished && budget-->0;){
  const step=getStep(state);
  if(!step.pipetteId){next(state);continue}
  const tool=step.pipetteId;
  if(step.action==='aspirate'){
   const expected=['unknownBottle','tube_dilution'].includes(step.target)?'unknownPipette':['tube_0_10','waterBottle'].includes(step.target)?'waterPipette':'pipette';
   assert.equal(tool,expected);
  }
  for(const wrong of tools.filter(id=>id!==tool))unchanged(state,()=>perform(state,step.action,step.target,wrong));
  assert.ok(beginTransfer(state,step.action,step.target,tool).ok);
  assert.ok(advanceTransfer(state,.25,tool).ok);
  for(const wrong of tools.filter(id=>id!==tool)){
   unchanged(state,()=>advanceTransfer(state,1,wrong));assert.equal(state[wrong].volume,0);
  }
  assert.ok(advanceTransfer(state,step.volume,tool).complete);conserved(state);
 }
 assert.ok(state.finished);assert.equal(state.results.unknown.percentT,39);
});
