/* In-page end-to-end run for v3. No install needed: serve the folder, open microarray-3d.html,
   then in the browser console run:
     const {runE2E}=await import('./3d-v3/tests/e2e-in-page.js'); console.table(await runE2E());
   It clicks the real accessible controls (target selector + action button), the real drying,
   card-move, UV and notebook controls, and waits for the real drying clock at 60×.
   It deletes any saved run in this browser before starting. */
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const change=(el,value)=>{el.value=value;el.dispatchEvent(new Event('change'));};
const assert=(ok,message)=>{if(!ok)throw new Error('E2E: '+message);};
const lab=()=>window.MicroarrayLab,proto=()=>lab().protocol;

function targetId(a){
  if(a.type==='attach')return 'tips';if(a.type==='eject')return 'waste';if(a.type==='pickCard')return 'card';
  if(a.type==='placeCard')return a.target;if(a.type==='tapPlate')return 'plate';
  if(a.surface==='card')return 'spot:'+a.target;if(a.surface==='well'||(a.type==='aspirate'&&proto().ids.includes(a.target)))return 'well:'+a.target;
  return a.target;
}
async function useTarget(id){change($('targetSelect'),id);$('targetAction').click();await sleep(0);}
async function waitFor(test,ms,label){const end=performance.now()+ms;while(!test()){if(performance.now()>end)throw new Error('E2E: timed out waiting for '+label);await sleep(50);}}

export async function runE2E({dryModes=['incubator','room','incubator']}={}){
  const t0=performance.now(),report={};
  if($('resumeDialog').open)$('resumeFresh').click();
  const confirm=window.confirm;window.confirm=()=>true;$('resetBtn').click();window.confirm=confirm;
  assert(proto().phase==='prepare'&&proto().log.length===0,'fresh run');
  change($('clockSpeed'),'60');
  // Step 1: the two-page set-up dialog (label, then safety and orientation checklist).
  assert(!$('setupDialog').hidden&&$('stepCard').hidden,'set-up dialog shown first');
  $('setupNext').click();assert(!$('labelError').hidden,'label required');
  $('groupLabel').value='E2E';$('groupLabel').dispatchEvent(new Event('input'));$('setupNext').click();
  assert(!document.querySelector('.setup-page[data-page="2"]').hidden,'checklist page');
  $('rotateCard').click();assert($('prepareBtn').disabled&&proto().orientation.card===false,'inverted card blocks preparation');$('rotateCard').click();
  $('tapPlate').click();$('ppe').click();assert(!$('prepareBtn').disabled,'checklist complete');$('prepareBtn').click();
  assert(proto().phase==='eb'&&$('setupDialog').hidden&&!$('stepCard').hidden,'prepared; step card takes over');
  let dryIndex=0,guard=0,paused=false;
  while(!['uv','analyze','complete'].includes(proto().phase)){
    assert(++guard<1500,'too many steps');
    const p=proto();
    if(p.phase.startsWith('dry')){
      if(!p.timer){
        const mode=dryModes[dryIndex++%dryModes.length];change($('dryMode'),mode);$('placeDryBtn').click();$('timerStart').click();
        assert(proto().timer?.mode===mode,'drying started in '+mode);
        if(!paused){paused=true;await sleep(400);$('pauseBtn').click();const frozen=proto().timer.remaining;await sleep(600);proto().tick(30);assert(proto().timer.remaining===frozen,'pause freezes the clock');$('runBtn').click();}
      }
      const phase=p.phase;
      // The app pauses drying in a hidden tab by design; a hidden automated run advances simulated time directly.
      if(document.hidden){report.clock='hidden tab: simulated time advanced by the test';while(proto().phase===phase){proto().tick(15);lab().scene.sync(proto());await sleep(0);}}
      else{report.clock='real 60× clock';await waitFor(()=>proto().phase!==phase,15000,'drying '+phase);}
      continue;
    }
    const a=p.next();assert(a.type,'next action at '+p.phase+': '+a.text);
    const before=p.log.length;await useTarget(targetId(a));
    assert(proto().log.length===before+1,'action accepted: '+a.text+' ('+(lab().mistakes.at(-1)?.message||'no message')+')');
  }
  // Step 12: UV goggles, viewing area, lamp.
  $('uvGoggles').click();$('placeUVBtn').click();$('uvBtn').click();
  assert(proto().phase==='analyze'&&proto().uv&&proto().cardLocation==='uv','UV viewing');
  // Notebook: gene inputs locked until the controls are valid; observe, validate, interpret.
  assert(!$('analyzeBox').hidden,'step card offers the notebook');$('openNotebookBtn').click();await sleep(50);
  const p=proto(),truth=id=>p.result(id),cell=(id,k)=>document.querySelector('[data-cell="'+id+k+'"]');
  const controls=p.ids.filter(id=>+id.slice(1)<=4),genes=p.ids.filter(id=>+id.slice(1)>4);
  assert(cell(genes[0],'c').disabled&&cell(genes[0],'m').disabled,'genes locked before controls');
  for(const id of controls)change(cell(id,'c'),truth(id));
  change(cell(controls[5],'c'),truth(controls[5])==='yellow'?'green':'yellow');$('checkControls').click();
  assert(!proto().controlsVerified&&/Patient/.test($('controlsFeedback').textContent)&&!$('controlsFeedback').textContent.includes(controls[5]),'wrong control caught without naming the cell');
  change(cell(controls[5],'c'),truth(controls[5]));$('checkControls').click();assert(proto().controlsVerified,'controls valid');
  const meaning={yellow:'equal',red:'up',green:'down',black:'none'};
  for(const id of genes){change(cell(id,'c'),truth(id));change(cell(id,'m'),meaning[truth(id)]);}
  $('finishBtn').click();assert(proto().phase==='complete','genes checked');
  // Reasoning questions, all answered correctly on the first try.
  const list=window.MicroarrayAnalysis.questions(p.rows);
  for(const q of list){const fs=document.querySelector('[data-question="'+q.id+'"]');fs.querySelector('input[value="'+q.options.find(o=>o.correct).id+'"]').click();fs.querySelector('button').click();}
  const answers=lab().notebook.answers;assert(list.every(q=>answers[q.id]?.correct&&answers[q.id].first),'questions answered');
  const cer=document.querySelector('[data-open="cer"]');cer.value='Gene 3 is green for all four patients (spots in column 7), so it is expressed less than in control cells; the card cannot diagnose anyone.';cer.dispatchEvent(new Event('input'));
  $('debriefBtn').click();await sleep(50);const stats=[...document.querySelectorAll('#debriefBody .stat strong')].map(s=>s.textContent);$('debriefDialog').close();
  const end=proto();
  Object.assign(report,{phase:end.phase,checkedActions:end.log.length,tipsUsed:end.tipCount,reagents:JSON.stringify(end.reagents),evaporatedUL:Math.round(end.evaporated*1e6)/1e6,balanceErrorUL:end.balance(),dryingModes:end.dried.map(d=>d.mode).join(','),
    rejectedDuringRun:lab().mistakes.filter(m=>m.code!=='analysis').length,analysisChecks:lab().mistakes.filter(m=>m.code==='analysis').length,debrief:stats.join(' | '),seconds:Math.round((performance.now()-t0)/100)/10});
  assert(end.tipCount===34&&end.reagents.EB===40&&end.reagents.cDNA===40&&end.reagents.HB===40,'consumables');
  assert(Math.abs(end.balance())<1e-7&&Math.abs(end.evaporated-480)<1e-6,'liquid balance');
  assert(report.rejectedDuringRun===0&&report.analysisChecks===1,'only the deliberate control mistake was recorded');
  return report;
}
