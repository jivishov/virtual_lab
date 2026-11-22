import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createState,getStep,STEPS,FINAL_VOLUME} from '../src/model.js';
import {spokenInstruction,voiceFile} from '../src/procedure-voice.js';

test('every step, recipe volume, cuvette removal and completion has its exact recorded sentence',()=>{
 const state=createState(),recordings=new Map();
 for(state.step=0;state.step<=STEPS.length;state.step++){
  for(state.analysis.aliquot=1;state.analysis.aliquot<FINAL_VOLUME;state.analysis.aliquot++){
   for(const inserted of [true,false]){
    state.cuvette.inserted=inserted;
    const words=spokenInstruction(getStep(state));
    assert.doesNotMatch(words,/undefined| mL| nm|#|\d\/\d/);
    recordings.set(voiceFile(words),words);
   }
  }
 }
 const waves=JSON.parse(readFileSync(new URL('../assets/voice/waveforms.json',import.meta.url),'utf8'));
 for(const [file,words] of recordings){
  const data=readFileSync(new URL('../'+file,import.meta.url));
  assert.ok(data.length>2000,words);
  assert.ok(data.includes(Buffer.from(words)),file+' must match its recorded title');
  assert.match(waves[file.split('/').pop()],/^[0-9a-f]{32}$/);
 }
 const shipped=readdirSync(new URL('../assets/voice/',import.meta.url)).filter(f=>f.endsWith('.mp3'));
 assert.equal(shipped.length,recordings.size);
});

test('spoken quantities and target names distinguish a stock draw, tube delivery and dilution',()=>{
 const state=createState();
 state.step=2;
 assert.equal(spokenInstruction(getStep(state)),'Draw eight milliliters of Blue Number One stock solution.');
 state.step=3;
 assert.equal(spokenInstruction(getStep(state)),'Dispense eight milliliters into the tube labeled eight to two.');
 state.step=STEPS.findIndex(s=>s.phase==='recipe');
 state.analysis.aliquot=1;
 assert.equal(spokenInstruction(getStep(state)),'Draw one milliliter of the unknown drink.');
 state.step+=2;
 assert.equal(spokenInstruction(getStep(state)),'Draw nine milliliters of distilled water.');
});
