/* Notebook and debrief rendering. Every notebook entry goes through the protocol's checked
   actions; the notebook never shows the true colour of a spot, only what the student recorded. */
(function(root){
  'use strict';
  const {CONTROLS,isControl,META}=root.MicroarrayProtocol;
  const A=root.MicroarrayAnalysis;
  const COLOR_OPTS=[['','Colour…'],['yellow','Yellow'],['red','Red / orange-red'],['green','Green'],['black','Dark']];
  const MEANING_OPTS=[['','Meaning…'],['up','↑ Increased'],['down','↓ Decreased'],['equal','N Similar'],['none','– No expression']];
  const $=id=>document.getElementById(id);
  function el(tag,attrs={},...kids){
    const n=document.createElement(tag);
    for(const [k,v] of Object.entries(attrs)){if(v===false||v==null)continue;if(k==='class')n.className=v;else if(k==='text')n.textContent=v;else if(k.startsWith('on'))n[k]=v;else if(k==='dataset')Object.assign(n.dataset,v);else n.setAttribute(k,v===true?'':v);}
    for(const kid of kids.flat())if(kid!=null)n.append(kid);
    return n;
  }
  function select(options,value,attrs){const s=el('select',attrs);for(const [v,t] of options)s.append(el('option',{value:v,text:t}));s.value=value||'';return s;}

  class NotebookUI {
    constructor(ctx){this.c=ctx;this.saveTimer=null;}
    get p(){return this.c.protocol();}
    render(){
      const p=this.p,ready=['analyze','complete'].includes(p.phase)&&p.uv,done=p.phase==='complete';
      $('notebookNotice').textContent=done?'Controls valid and all gene interpretations checked. These results reproduce the manual example, not measured clinical data.'
        :ready?(p.controlsVerified?'Controls valid. Record each gene spot’s colour, then its meaning compared with the control.':'Look at the card under UV. Record the colour of every control spot first.')
        :['analyze','complete'].includes(p.phase)?'Switch the UV lamp on to read the card.':'The card is not ready for reading. Finish all three drying stages and view it under UV. Nothing is shown before then.';
      const focus=document.activeElement?.dataset?.cell;
      this.table($('controlsTable'),true,ready&&!done,p);
      this.table($('genesTable'),false,ready&&!done&&p.controlsVerified,p);
      if(focus)document.querySelector('[data-cell="'+focus+'"]')?.focus();
      $('checkControls').disabled=!ready||done||p.controlsVerified;$('checkControls').textContent=p.controlsVerified?'✓ Controls valid':'Check 16 controls';
      $('finishBtn').disabled=!ready||!p.controlsVerified||done;$('finishBtn').textContent=done?'✓ Genes checked':'Check 16 genes';
      this.questions();this.openQuestions();this.info();
    }
    table(table,controls,enabled,p){
      table.replaceChildren();
      const cols=controls?[1,2,3,4]:[5,6,7,8];
      const head=el('tr',{},el('th',{scope:'col',text:'Patient'}),cols.map(c=>el('th',{scope:'col',text:controls?c+' · '+CONTROLS[c-1].name:'Gene '+(c-4)+' · col '+c})));
      const body=el('tbody');
      p.rows.forEach((row,i)=>{
        const tr=el('tr',{},el('th',{scope:'row',text:row+' · Patient '+(i+1)}));
        for(const c of cols){
          const id=row+c,seen=p.colors[id];
          const swatch=el('span',{class:'swatch '+(seen||'unread'),'aria-hidden':'true'});
          const colour=select(COLOR_OPTS,seen,{'aria-label':'Colour seen at '+id,dataset:{cell:id+'c'},disabled:!enabled});
          colour.onchange=()=>this.c.commit({type:'observe',target:id,value:colour.value},'notebook');
          const cell=el('td',{},el('div',{class:'cell-head'},swatch,el('span',{class:'cell-id',text:id})),colour);
          if(!controls){
            const meaning=select(MEANING_OPTS,p.interpretations[id],{'aria-label':'Interpretation at '+id,dataset:{cell:id+'m'},disabled:!enabled});
            meaning.onchange=()=>this.c.commit({type:'interpret',target:id,value:meaning.value},'notebook');cell.append(meaning);
          }
          tr.append(cell);
        }
        body.append(tr);
      });
      table.append(el('thead',{},head),body);
    }
    questions(){
      const p=this.p,list=this.c.questions(),open=p.phase==='complete',box=$('questions');
      $('questionsNotice').textContent=open?'Choose an answer and check it. Feedback explains each choice; first-try accuracy is recorded in the debrief.':'Unlocks after the gene check, so the questions cannot give away the card.';
      // Keep a student's unchecked choices when the notebook re-renders.
      const pending=Object.fromEntries([...box.querySelectorAll('input[type=radio]:checked')].map(i=>[i.name,i.value]));
      box.replaceChildren(...list.map((q,n)=>this.question(q,n,open,pending['q-'+q.id])));
    }
    question(q,n,open,pendingChoice){
      const list=this.c.questions(),nb=this.c.notebook(),rec=nb.answers[q.id],name='q-'+q.id,locked=!open||rec?.correct;
      const selected=rec?.correct?rec.choice:(pendingChoice??rec?.choice);
      const opts=A.displayOrder(q).map(o=>el('label',{class:'option'+(rec?.choice===o.id?(o.correct?' right':' wrong'):'')},el('input',{type:'radio',name,value:o.id,checked:selected===o.id,disabled:locked}),el('span',{text:o.text})));
      const feedback=el('p',{class:'feedback'+(rec?(rec.correct?' right':' wrong'):''),role:'status'});
      if(rec){const chosen=q.options.find(o=>o.id===rec.choice);feedback.textContent=(rec.correct?'✓ ':'')+(chosen?.feedback||'')+(rec.correct&&rec.attempts>1?' ('+rec.attempts+' attempts)':'');}
      const node=el('fieldset',{class:'question'+(open?'':' locked'),dataset:{question:q.id}});
      const check=el('button',{text:rec?.correct?'✓ Answered':'Check answer',disabled:locked,onclick:()=>{
        const choice=node.querySelector('input:checked')?.value;
        if(!choice){feedback.textContent='Choose an answer first.';feedback.className='feedback';return;}
        A.answer(nb,list,q.id,choice);this.c.save();
        const fresh=this.question(q,n,open);node.replaceWith(fresh);fresh.querySelector('button:not(:disabled),input:checked')?.focus();
      }});
      node.append(el('legend',{},el('span',{class:'q-num',text:String(n+1)}),el('span',{text:q.prompt})),el('div',{class:'options'},opts),el('div',{class:'q-foot'},check,el('span',{class:'tiny',text:q.topic+' · manual '+q.source})),feedback);
      return node;
    }
    openQuestions(){
      const box=$('openQuestions'),nb=this.c.notebook();
      if(box.childElementCount===A.OPEN_QUESTIONS.length){for(const q of A.OPEN_QUESTIONS){const t=box.querySelector('[data-open="'+q.id+'"]');if(t&&document.activeElement!==t)t.value=nb.open[q.id]||'';}return;}
      box.replaceChildren(...A.OPEN_QUESTIONS.map((q,i)=>{
        const t=el('textarea',{rows:q.id==='cer'?4:2,dataset:{open:q.id}});t.value=nb.open[q.id]||'';
        t.oninput=()=>{nb.open[q.id]=t.value;clearTimeout(this.saveTimer);this.saveTimer=setTimeout(()=>this.c.save(),400);};
        return el('label',{class:'open-q'},el('span',{text:(i+1)+'. '+q.prompt}),t);
      }));
    }
    info(){
      const p=this.p;
      $('runInfo').textContent=p.tipCount+' tips · '+p.log.length+' checked actions · Remaining: EB '+p.reagents.EB+' µL, control cDNA '+p.reagents.cDNA+' µL, HB '+p.reagents.HB+' µL. Evaporated '+Math.round(p.evaporated*10)/10+' µL; waste '+p.waste+' µL. Added-liquid balance error '+p.balance().toFixed(6)+' µL.';
      $('actionLog').replaceChildren(...p.log.slice(-18).map(a=>el('tr',{},[a.n,a.action,a.target||'—',a.input].map(v=>el('td',{text:String(v)})))));
    }
    debrief(){
      const p=this.p,d=A.debrief({protocol:p,mistakes:this.c.mistakes(),notebook:this.c.notebook(),list:this.c.questions(),stats:this.c.stats(),activeMS:this.c.activeMS()});
      $('debriefTitle').textContent=(d.complete?'Run debrief':'Your run so far')+(d.label?' · '+d.label:'')+' · rows '+d.rows[0]+'–'+d.rows[3];
      const stat=(label,value,note,good)=>el('div',{class:'stat'+(good===true?' good':good===false?' attention':'')},el('span',{class:'eyebrow',text:label}),el('strong',{text:value}),note?el('small',{text:note}):null);
      const yesNo=c=>c.passed?(c.firstTry?'First try':'Passed after '+c.attempts+' checks'):(c.attempts?'Not yet valid ('+c.attempts+' checks)':'Not checked yet');
      const tipsNote=d.consumables.tipsUsed>d.consumables.minimumTips?'minimum for the procedure is 34':'minimum for the full procedure is 34';
      const stats=el('div',{class:'stats'},
        stat('Samples spotted',d.technique.samplesSpotted+' / 32',d.technique.samplesClean+' without a technique correction',d.technique.samplesSpotted?d.technique.samplesClean===d.technique.samplesSpotted:null),
        stat('Corrections',String(d.mistakes.total),'technique and procedure',d.mistakes.total===0),
        stat('Tips used',String(d.consumables.tipsUsed),tipsNote),
        stat('Controls',yesNo(d.analysis.controls),'Normal · Up · Down · Blank',d.analysis.controls.passed?d.analysis.controls.firstTry:null),
        stat('Genes',yesNo(d.analysis.genes),'colour and meaning',d.analysis.genes.passed?d.analysis.genes.firstTry:null),
        stat('Reasoning',d.questions.correct+' / '+d.questions.total,d.questions.firstTry+' right on the first try',d.questions.correct===d.questions.total?true:null),
        stat('Written responses',d.open.answered+' / '+d.open.total,'for your teacher to review'));
      const cats=Object.values(d.mistakes.byCategory).sort((a,b)=>b.count-a.count);
      const catTable=cats.length?el('table',{class:'debrief-table'},el('thead',{},el('tr',{},el('th',{text:'Area'}),el('th',{text:'Count'}),el('th',{text:'What to remember'}))),el('tbody',{},cats.map(c=>el('tr',{},el('td',{text:c.label}),el('td',{text:String(c.count)}),el('td',{text:c.hint||''}))))):el('p',{class:'tiny',text:'No technique or procedure corrections were needed.'});
      const recent=d.mistakes.recent.length?el('ol',{class:'recent'},d.mistakes.recent.map(m=>el('li',{},el('b',{text:(META[m.phase]?.[1]||m.phase)+': '}),m.message))):null;
      const r=d.consumables.reagents;
      const reagents=el('p',{class:'tiny',text:'Remaining in tubes: EB '+r.EB+' µL, control cDNA '+r.cDNA+' µL, HB '+r.HB+' µL (a complete run leaves '+d.consumables.expectedRemaining+' µL of each). Evaporated from the card: '+Math.round(d.consumables.evaporatedUL)+' µL. Balance error '+d.consumables.balanceErrorUL.toFixed(6)+' µL.'});
      const drying=el('p',{class:'tiny',text:d.drying.length?'Drying: '+d.drying.map(x=>x.minutes+' min '+(x.mode==='incubator'?'at 37 °C':'at room temperature')).join(' · '):'No drying stage completed yet.'});
      const time=d.time.some(t=>t.minutes>0)?el('p',{class:'tiny',text:'Active time by step: '+d.time.filter(t=>t.minutes>0).map(t=>(META[t.phase]?.[1]||t.phase)+' '+t.minutes+' min').join(' · ')}):null;
      $('debriefBody').replaceChildren(...[stats,el('h3',{text:'Corrections by area'}),catTable,recent?el('h3',{text:'Most recent corrections'}):null,recent,el('h3',{text:'Reagents, drying and time'}),reagents,drying,time,
        el('p',{class:'source',text:'Results reproduce the manual’s example card (p.12). This is a teaching simulation: it does not measure fluorescence, predict real samples or support diagnosis (p.3).'})].filter(Boolean));
      return d;
    }
  }
  root.MicroarrayNotebookUI=NotebookUI;
})(globalThis);
