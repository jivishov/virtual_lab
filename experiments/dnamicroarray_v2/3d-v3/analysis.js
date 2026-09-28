/* Reasoning questions, mistake categories and the end-of-run debrief.
   Questions are grounded in the manual's background (pp.5–6), analysis (p.12) and
   intended-use statement (p.3). Study questions (p.9) are paraphrased, not copied. */
(function(root){
  'use strict';

  // Rejection codes come from protocol.js. Only technique and procedure codes count as mistakes.
  const CATEGORIES = {
    tip:       {label:'Tip handling', group:'technique', hint:'Fresh tip per patient well; keep it through mixing and spotting; never return a used tip to a stock tube.'},
    reagent:   {label:'Wrong reagent or source', group:'technique', hint:'EB for step 2, control cDNA for steps 4–8, HB for step 10.'},
    order:     {label:'Row order', group:'technique', hint:'Work left to right along each row, then move down (p.8, step 8).'},
    mixing:    {label:'Mixing', group:'technique', hint:'Three complete draw/return cycles in the same well before spotting (p.8, step 5).'},
    match:     {label:'Spot matching', group:'technique', hint:'Each well goes to the matching card position (p.8, step 6).'},
    duplicate: {label:'Duplicate deposit', group:'technique', hint:'Each spot receives exactly one 5 µL deposit per step.'},
    volume:    {label:'Pipette volume', group:'technique', hint:'Deliver the 5 µL in the tip before drawing again.'},
    plunger:   {label:'Plunger technique', group:'technique', hint:'Press the plunger before the tip enters the liquid, then release slowly inside to draw. Pressing inside blows bubbles into the liquid.'},
    prep:      {label:'Preparation', group:'procedure', hint:'Orientation, label, PPE and settling come first (p.8, step 1; p.11).'},
    drying:    {label:'Drying and card placement', group:'procedure', hint:'Dry completely between steps and move the card only between drying stages.'},
    uv:        {label:'UV safety and viewing', group:'procedure', hint:'UV goggles before the lamp; read the card only in the UV viewing area.'},
    sequence:  {label:'Out of sequence', group:'procedure', hint:'Follow the current step in the procedure panel.'},
    analysis:  {label:'Notebook checks', group:'analysis', hint:'Validate controls first, then interpret genes.'},
    paused:    {label:'Paused', group:'ignored'}, input:{label:'Input', group:'ignored'}, restore:{label:'Restore', group:'ignored'}
  };
  const categoryOf = code => CATEGORIES[code] ? code : 'sequence';

  const COLOR_NAMES = {yellow:'Yellow', red:'Red (appears orange-red under UV)', green:'Green', black:'Dark (no fluorescence)'};
  const MEANING_NAMES = {up:'↑ Increased', down:'↓ Decreased', equal:'N Similar to control', none:'– No expression'};

  function questions(rows=['A','B','C','D']) {
    const [r1,r2,r3] = rows;
    return [
      {id:'yellow', topic:'Two-colour principle', source:'p.5',
        prompt:`Spot ${r2}1 glows yellow under UV. What produced the yellow colour?`,
        options:[
          {id:'a', text:'Red-labelled patient cDNA and green-labelled control cDNA bound that spot in similar amounts.', correct:true,
            feedback:'Yes. Overlapping red and green fluorescence appears yellow when both samples hybridize equally (p.5).'},
          {id:'b', text:'The hybridization buffer fluoresces yellow.', feedback:'HB went on every spot, yet the spots differ in colour, so HB cannot explain it.'},
          {id:'c', text:'Neither sample bound, so the paper’s own colour shows through.', feedback:'No binding gives a dark spot, like the Blank control in column 4.'},
          {id:'d', text:'Only the patient cDNA bound.', feedback:'Patient cDNA carries the red tag; on its own it would give red, not yellow.'}]},
      {id:'red', topic:'Up-regulation', source:'pp.5–6',
        prompt:`Patient 2, gene 2 (spot ${r2}6) is red. What does this tell you?`,
        options:[
          {id:'a', text:'Patient 2’s cancer cells make more mRNA from gene 2 than the normal control cells: gene 2 is up-regulated.', correct:true,
            feedback:'Yes. More red-labelled patient cDNA than green-labelled control cDNA bound, so expression is higher in the patient (p.6).'},
          {id:'b', text:'Patient 2 has extra copies of gene 2 in their DNA.', feedback:'The cDNA was made from mRNA, so the card compares expression, not how many copies of the gene are in the genome.'},
          {id:'c', text:'Gene 2 is switched off in Patient 2.', feedback:'A switched-off gene would give green (less than control) or dark (no expression), not red.'},
          {id:'d', text:'Patient 2’s sample was contaminated with extra control cDNA.', feedback:'Extra green-labelled control cDNA would push the spot toward green, not red.'}]},
      {id:'controls', topic:'Controls', source:'p.12',
        prompt:'Why do you check columns 1–4 before interpreting any genes?',
        options:[
          {id:'a', text:'They show whether the assay worked: each control must give its expected colour (Normal yellow, Up red, Down green, Blank dark).', correct:true,
            feedback:'Yes. The manual says to check the controls first to make sure the experiment worked as expected (p.12).'},
          {id:'b', text:'They are the genes most likely to be linked to cancer.', feedback:'Columns 1–4 are controls with known outcomes, not genes of interest.'},
          {id:'c', text:'They dry first, so they are ready to read sooner.', feedback:'All 32 spots dry together; the order is about validating the run.'},
          {id:'d', text:'The card must be read from left to right.', feedback:'Reading direction is not the reason; controls tell you whether the gene results can be trusted.'}]},
      {id:'blank', topic:'Troubleshooting', source:'p.12',
        prompt:'Suppose column 4 (Blank) glowed yellow for every patient. What should you conclude?',
        options:[
          {id:'a', text:'Something went wrong in the run (for example contamination or non-specific signal), so the gene results should not be trusted.', correct:true,
            feedback:'Yes. A blank should stay dark. Signal there means the run failed its controls.'},
          {id:'b', text:'All patients express the blank gene at normal levels.', feedback:'The Blank position has no gene to express; any signal there is an artefact.'},
          {id:'c', text:'The UV lamp is too strong, but the genes are still fine.', feedback:'Lamp strength would not create signal on a spot with nothing bound to it.'},
          {id:'d', text:'Nothing. Blank spots are ignored.', feedback:'Blank is one of the four controls you check before interpreting genes.'}]},
      {id:'consistent', topic:'Reading the data', source:'p.12',
        prompt:'Which gene is down-regulated in all four patients?',
        options:[
          {id:'a', text:'Gene 1 (column 5)', feedback:'Gene 1 is decreased in Patients 2–4, but Patient 1 shows no expression at all.'},
          {id:'b', text:'Gene 2 (column 6)', feedback:'Gene 2 is similar to control in Patients 1, 3 and 4, and increased in Patient 2.'},
          {id:'c', text:'Gene 3 (column 7)', correct:true, feedback:'Yes. Column 7 is green for every patient: less expression than the control each time.'},
          {id:'d', text:'Gene 4 (column 8)', feedback:'Gene 4 is increased in Patients 1, 2 and 4 and not expressed in Patient 3.'}]},
      {id:'dark', topic:'Dark versus green', source:'pp.5, 12',
        prompt:`Patient 3, gene 4 (${r3}8) is dark, while Patient 3, gene 3 (${r3}7) is green. How do they differ?`,
        options:[
          {id:'b', text:'Both mean down-regulation; dark is just a stronger decrease.', feedback:'Green needs green-labelled control cDNA to bind. Dark means nothing bound at all, which is a different result.'},
          {id:'c', text:`${r3}8 did not dry as completely as ${r3}7.`, feedback:'The card dried completely three times before UV viewing; drying does not explain the difference.'},
          {id:'a', text:`${r3}8: neither sample produced signal, so there is no detectable expression. ${r3}7: the gene is expressed, but less in the patient than in the control.`, correct:true,
            feedback:'Yes. Green needs control cDNA to bind; dark means neither sample did (p.12 key).'},
          {id:'d', text:`${r3}8 shows the patient expresses more of gene 4.`, feedback:'More patient expression would appear red, not dark.'}]},
      {id:'limits', topic:'What the card can and cannot tell you', source:'p.3',
        prompt:'Can this card be used to diagnose these four patients?',
        options:[
          {id:'a', text:'No. It is a simulated teaching assay with fixed example results; diagnosis needs validated clinical tests, replicates and many more genes.', correct:true,
            feedback:'Yes. The kit is for educational use only and not for diagnostic purposes (p.3).'},
          {id:'b', text:'Yes, because the controls worked.', feedback:'Valid controls show the assay ran as expected, not that it is a clinical test.'},
          {id:'c', text:'Yes, but only for Patient 2.', feedback:'No single patient’s pattern turns a teaching simulation into a diagnosis.'},
          {id:'d', text:'Only if the card is read within one week.', feedback:'The one-week limit (p.8) is about storing the card, not clinical validity.'}]}
    ];
  }
  const OPEN_QUESTIONS = [
    {id:'hgp', prompt:'What new information became available because of the Human Genome Project?'},
    {id:'core', prompt:'Describe the core idea behind microarrays and why it matters for biotechnology and medicine.'},
    {id:'cdna', prompt:'How is a cDNA library made from mRNA?'},
    {id:'uses', prompt:'What kinds of questions have DNA microarrays made it possible to answer?'},
    {id:'spots', prompt:'How are the individual spots on a microarray identified and analysed?'},
    {id:'cer', prompt:'Claim–evidence–reasoning: which gene would you investigate further as a possible cancer-related gene, and why? Cite at least two spots as evidence and say what this card cannot show.'}
  ];

  // Stable per-question option order, so the correct answer is not always first.
  function displayOrder(q){
    let h=2166136261^30;for(const c of q.id)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
    return q.options.map((o,i)=>({o,k:(Math.imul(h+i*374761393,668265263)>>>0)})).sort((a,b)=>a.k-b.k).map(x=>x.o);
  }
  function emptyNotebook(){return {answers:{}, open:{}, notes:''};}
  function answer(notebook, list, questionId, optionId){
    const q=list.find(q=>q.id===questionId), option=q?.options.find(o=>o.id===optionId);
    if(!option)return null;
    const record=notebook.answers[questionId]||{attempts:0, correct:false, first:null, choice:null};
    if(record.correct)return {...record, option};
    record.attempts++;record.choice=optionId;record.correct=!!option.correct;
    if(record.first===null)record.first=!!option.correct;
    notebook.answers[questionId]=record;
    return {...record, option};
  }

  function debrief({protocol:p, mistakes=[], notebook=emptyNotebook(), list=questions(p?.rows), stats={}, activeMS={}}){
    const counted=mistakes.filter(m=>['technique','procedure'].includes(CATEGORIES[m.code]?.group));
    const byCategory={};
    for(const m of counted)(byCategory[m.code]??={label:CATEGORIES[m.code].label,group:CATEGORIES[m.code].group,hint:CATEGORIES[m.code].hint,count:0}).count++;
    const samplesWithMistakes=new Set(mistakes.filter(m=>m.phase==='samples'&&m.sample&&CATEGORIES[m.code]?.group==='technique').map(m=>m.sample));
    const spotted=p.ids.filter(id=>p.wells[id].spotted).length;
    const checks=kind=>{
      const fails=mistakes.filter(m=>m.code==='analysis'&&m.action===kind).length;
      const passed=kind==='verifyControls'?p.controlsVerified||p.phase==='complete':p.phase==='complete';
      return {attempts:fails+(passed?1:0), passed, firstTry:passed&&fails===0};
    };
    const answered=list.filter(q=>notebook.answers[q.id]?.correct);
    const phaseTime=Object.entries(activeMS).map(([phase,ms])=>({phase,minutes:Math.round(ms/6000)/10}));
    return {
      label:p.label, rows:p.rows, phase:p.phase, complete:p.phase==='complete',
      mistakes:{total:counted.length, byCategory, recent:counted.slice(-8).map(m=>({phase:m.phase,label:CATEGORIES[m.code].label,message:m.message}))},
      technique:{samplesSpotted:spotted, samplesClean:spotted-[...samplesWithMistakes].filter(id=>p.wells[id]?.spotted).length, cancelledStrokes:stats.cancelled||0, transfers:stats.transfers||0},
      consumables:{tipsUsed:p.tipCount, minimumTips:34, reagents:{...p.reagents}, expectedRemaining:40, evaporatedUL:p.evaporated, wasteUL:p.waste, balanceErrorUL:p.balance()},
      drying:p.dried.map(d=>({stage:d.phase, minutes:d.seconds/60, mode:d.mode})),
      analysis:{controls:checks('verifyControls'), genes:checks('finish')},
      questions:{total:list.length, correct:answered.length, firstTry:list.filter(q=>notebook.answers[q.id]?.first===true).length, attempts:list.reduce((n,q)=>n+(notebook.answers[q.id]?.attempts||0),0)},
      open:{answered:OPEN_QUESTIONS.filter(q=>(notebook.open[q.id]||'').trim().split(/\s+/).filter(Boolean).length>=5).length, total:OPEN_QUESTIONS.length},
      time:phaseTime
    };
  }

  const api={CATEGORIES, categoryOf, COLOR_NAMES, MEANING_NAMES, questions, OPEN_QUESTIONS, displayOrder, emptyNotebook, answer, debrief};
  root.MicroarrayAnalysis=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
