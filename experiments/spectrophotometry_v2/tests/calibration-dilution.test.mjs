import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,getStep,perform,notebookDecision,fitCalibration,setStatus,totalVolume} from '../src/model.js';
import {readingsCsv} from '../src/notebook.js';

function workAtBench(state) {
  for (let n=0;n<130;n++) {
    const step=getStep(state);
    if(step.target==='notebook') return step.action;
    const result=perform(state,step.action,step.target);
    assert.ok(result.ok,result.message);
  }
  assert.fail('Expected a notebook decision.');
}

function mustReject(state,fn) {
  const before=structuredClone(state);
  assert.equal(fn().ok,false);
  assert.deepEqual(state,before);
}

test('the fit comes from recorded readings and cannot be accepted early or while paused',()=>{
  const s=createState();
  mustReject(s,()=>notebookDecision(s,'fit'));
  assert.equal(workAtBench(s),'fit');
  const original=fitCalibration(s).slope;
  s.results.tube_10_0.absorbance+=.01;
  assert.ok(fitCalibration(s).slope>original);
  setStatus(s,'paused');
  mustReject(s,()=>notebookDecision(s,'fit'));
  setStatus(s,'running');
  assert.ok(notebookDecision(s,'fit').ok);
  mustReject(s,()=>notebookDecision(s,'fit'));
});

for(const aliquot of [2,3,5,7]){
  test('recover the original concentration from a '+aliquot+' mL aliquot',()=>{
    const s=createState();
    workAtBench(s);notebookDecision(s,'fit');workAtBench(s);
    for(const bad of [0,1,8,9,10,2.5,NaN])mustReject(s,()=>notebookDecision(s,'plan',{aliquot:bad}));
    assert.ok(notebookDecision(s,'plan',{aliquot}).ok);
    assert.equal(workAtBench(s),'report');
    const r=s.results.tube_dilution, factor=10/aliquot;
    assert.ok(Math.abs(r.percentT-100*Math.pow(.39,aliquot/10))<1e-9);
    assert.ok(Math.abs(s.tubes.tube_dilution.unknownVolume-.7*aliquot)<1e-9);
    assert.ok(Math.abs(totalVolume(s)-2500)<1e-8);
    assert.equal(r.inRange,true);
    assert.equal(s.analysis.report,null);
    mustReject(s,()=>perform(s,'report','notebook'));
    const diluted=r.absorbance/fitCalibration(s).slope, original=diluted*factor;
    const values={diluted,factor,original};
    for(const key of Object.keys(values))mustReject(s,()=>notebookDecision(s,'report',{...values,[key]:0}));
    assert.ok(notebookDecision(s,'report',values).ok);
    assert.ok(s.finished);
    assert.ok(Math.abs(original-3.11)<.003);
    const csv=readingsCsv(s).split('\r\n');
    assert.equal(csv.length,9);
    assert.equal(Number(csv.at(-1).split(',').at(-1)),original);
    assert.equal(createState().analysis.report,null);
  });
}
