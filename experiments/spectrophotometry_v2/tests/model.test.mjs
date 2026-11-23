import test from 'node:test';
import assert from 'node:assert/strict';
import {SAMPLES,STEPS,createState,getStep,perform,validate,calculateConcentration,percentT,absorbanceFromPercentT,fitCalibration,totalVolume,setStatus,setWavelength} from '../src/model.js';

import { instrumentDisplay, notebookDecision } from '../src/model.js';
function advanceProtocol(s,step){
  if(step.target!=='notebook')return perform(s,step.action,step.target);
  return notebookDecision(s,step.action,step.action==='report'?{diluted:1.555,factor:2,original:3.11}:{aliquot:5});
}
function next(s) { const step=getStep(s);const r=advanceProtocol(s,step);assert.equal(r.ok,true,`Step ${s.step}: ${r.message}`);return step; }
function until(s,predicate) {let limit=150;while(!predicate(getStep(s),s)&&limit--)next(s);assert.ok(limit>0,'Protocol reachability');}
function unchanged(s,fn) {const before=JSON.stringify(s);assert.equal(fn().ok,false);assert.equal(JSON.stringify(s),before);}

test('source dilution concentrations and optical conversions are correct',()=>{
  assert.deepEqual(SAMPLES.map(s=>Number(s.concentration.toFixed(3))),[2.31,1.848,1.386,.924,.462,0]);
  assert.equal(calculateConcentration(0,0),0);
  for(const n of [-1,NaN,Infinity])assert.throws(()=>calculateConcentration(n,1));
  assert.equal(percentT(2.31),49);assert.equal(percentT(.462),87);assert.equal(percentT(0),100);assert.equal(percentT(-1),39);
  assert.ok(Math.abs(percentT(1.848)-58.0304347826087)<1e-12);
  assert.ok(Math.abs(absorbanceFromPercentT(39)-.4089353929735008)<1e-12);
  assert.throws(()=>percentT(NaN));assert.throws(()=>percentT(-2));assert.throws(()=>absorbanceFromPercentT(0));assert.throws(()=>absorbanceFromPercentT(101));
});

test('instrument readouts require the closed chamber, acquired signal and matching reference',()=>{
  const state=createState();
  assert.equal(instrumentDisplay(state).caption,'Chamber empty');
  until(state,step=>step.action==='zero');
  assert.deepEqual(instrumentDisplay(state),{caption:'Set blank reference',reading:null});
  next(state);
  assert.equal(instrumentDisplay(state).reading.percentT,100);
  until(state,step=>step.action==='measure'&&step.sample==='tube_10_0');
  assert.deepEqual(instrumentDisplay(state),{caption:'Ready to read',reading:null});
  next(state);
  const measured=instrumentDisplay(state).reading;
  assert.equal(measured.percentT,49);
  state.lidOpen=true;
  assert.deepEqual(instrumentDisplay(state),{caption:'Chamber open',reading:null});
  state.lidOpen=false;
  assert.equal(instrumentDisplay(state).reading,measured);
  setWavelength(state,540);
  assert.deepEqual(instrumentDisplay(state),{caption:'Select 630 nm',reading:null});
  setWavelength(state,630);
  assert.deepEqual(instrumentDisplay(state),{caption:'Ready to read',reading:null});
  assert.equal(state.results.tube_10_0.percentT,49);
});

test('full source path completes and conserves every mL and stock equivalent',()=>{
  const s=createState();let count=0;
  assert.equal(STEPS.length,95);
  while(!s.finished){next(s);count++;assert.ok(count<120);assert.ok(Math.abs(totalVolume(s)-2500)<1e-8);}
  assert.equal(count,103); // 95 numbered instructions plus eight explicit withdrawals.
  assert.equal(s.waste,48);assert.equal(s.cuvette.volume,3);assert.equal(s.bottles.stockBottle.volume,970);assert.equal(s.bottles.waterBottle.volume,941);assert.equal(s.bottles.unknownBottle.volume,492);
  for(const sample of SAMPLES)assert.equal(s.tubes[sample.id].volume,sample.stock?7:4);
  const liquids=[...Object.values(s.bottles),...Object.values(s.tubes),s.pipette,s.cuvette,s.wasteContents];
  assert.ok(Math.abs(liquids.reduce((n,l)=>n+l.stockVolume,0)-1000)<1e-8);
  assert.ok(Math.abs(liquids.reduce((n,l)=>n+l.waterVolume,0)-1000)<1e-8);
  assert.ok(Math.abs(liquids.reduce((n,l)=>n+l.unknownVolume,0)-500)<1e-8);
  assert.equal(Object.keys(s.results).length,8);assert.equal(s.results.tube_0_10.absorbance,0);
  assert.equal(s.results.unknown.concentration,null);assert.equal(s.results.unknown.absorbance,.4089);assert.equal(s.results.unknown.inRange,false);
  assert.equal(s.results.tube_dilution.inRange,true);
  const fit=fitCalibration(s);assert.ok(Math.abs(fit.slope-.13147973)<1e-7);assert.equal(fit.method,'least-squares-through-origin');assert.equal(fit.count,6);assert.ok(fit.slope>0);assert.ok(fit.rSquared>.95);assert.ok(s.analysis.report.original>fit.maxConcentration);
  unchanged(s,()=>perform(s,'continue','notebook'));
});

test('wrong action and target do not consume reagent or advance the protocol',()=>{
  const s=createState();unchanged(s,()=>perform(s,'dispense','tube_10_0'));unchanged(s,()=>perform(s,'aspirate','waterBottle'));
  next(s);assert.equal(s.pipette.volume,10);unchanged(s,()=>perform(s,'dispense','tube_8_2'));assert.equal(s.tubes.tube_10_0.volume,0);
});

test('source depletion, pipette capacity and overflow are enforced before commit',()=>{
  const s=createState();s.bottles.stockBottle.volume=5;s.bottles.stockBottle.stockVolume=5;unchanged(s,()=>perform(s,'aspirate','stockBottle'));
  const s2=createState();next(s2);s2.tubes.tube_10_0.volume=1;s2.tubes.tube_10_0.waterVolume=1;unchanged(s2,()=>perform(s2,'dispense','tube_10_0'));
  const s3=createState();next(s3);s3.pipette.volume=9;s3.pipette.stockVolume=9;unchanged(s3,()=>perform(s3,'dispense','tube_10_0'));
});

test('blank, cleanliness, insertion and complete rinsing are meaningful gates',()=>{
  const s=createState();until(s,step=>step.action==='zero');s.cuvette.source='tube_10_0';unchanged(s,()=>perform(s,'zero','spec20'));s.cuvette.source='tube_0_10';next(s);
  assert.equal(getStep(s).action,'remove');unchanged(s,()=>perform(s,'empty','wasteBeaker'));next(s);next(s);assert.equal(s.cuvette.clean,false);
  next(s);next(s);assert.equal(s.cuvette.clean,false);s.cuvette.source='tube_0_10';unchanged(s,()=>perform(s,'empty','wasteBeaker'));s.cuvette.source='waterBottle';next(s);assert.equal(s.cuvette.clean,true);
  next(s);s.cuvette.clean=false;unchanged(s,()=>perform(s,'dispense','cuvette'));s.cuvette.clean=true;next(s);s.cuvette.clean=false;unchanged(s,()=>perform(s,'insert','spec20'));
});

test('measurement requires current sample, optical fill, and valid blank reference',()=>{
  const s=createState();until(s,step=>step.action==='measure');s.zeroed=false;unchanged(s,()=>perform(s,'measure','spec20'));s.zeroed=true;
  s.cuvette.source='tube_8_2';unchanged(s,()=>perform(s,'measure','spec20'));s.cuvette.source='tube_10_0';
  s.cuvette.inserted=false;unchanged(s,()=>perform(s,'measure','spec20'));s.cuvette.inserted=true;
  assert.equal(validate(s,'measure','spec20').ok,true);assert.equal(Object.keys(s.results).length,0);
});

test('wavelength is bounded and blank reference is specific to its wavelength',()=>{
  const s=createState();for(const v of [NaN,Infinity,399,701,'630'])unchanged(s,()=>setWavelength(s,v));
  until(s,step=>step.action==='zero');setWavelength(s,500);unchanged(s,()=>perform(s,'zero','spec20'));setWavelength(s,630);next(s);assert.equal(s.zeroed,true);
  setWavelength(s,500);assert.equal(s.zeroed,false);setWavelength(s,630);assert.equal(s.zeroed,true);
});

test('Pause and Stop preserve state, Run resumes, and a factory reset is independent',()=>{
  const s=createState();next(s);const snapshot=structuredClone(s);
  for(const status of ['paused','stopped']){assert.equal(setStatus(s,status).ok,true);unchanged(s,()=>perform(s,'dispense','tube_10_0'));unchanged(s,()=>setWavelength(s,500));}
  setStatus(s,'running');next(s);assert.equal(s.tubes.tube_10_0.volume,10);
  const reset=createState();assert.equal(reset.step,0);assert.equal(reset.pipette.volume,0);assert.equal(reset.waste,0);assert.deepEqual(reset.results,{});assert.equal(reset.history.length,0);assert.equal(reset.bottles.stockBottle.volume,1000);
  assert.equal(snapshot.pipette.volume,10);assert.equal(snapshot.tubes.tube_10_0.volume,0);
});
