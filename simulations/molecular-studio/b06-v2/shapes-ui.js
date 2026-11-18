// Shapes mode controls (B06 redesign, phase 1, 2026-11-16).
// Presentation only: every button writes the original input, select, checkbox or button,
// so app.js keeps its data, checks, messages and storage.
// Desktop and hand building share this file. hands() is true while hand tracking runs;
// studio-shell.js adds main.ms-hand-layout when the hand layout is on screen.
import {MOLECULES,LETTERS,isBond,partLabel} from './chemistry.js';

const $=id=>document.getElementById(id);
const main=document.querySelector('main');
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SETS=['Foundations','Bond comparison','Five & six domains','Further comparisons'];
const QUESTIONS=[
 {field:'domainAnswer',title:'How many electron domains are at the center?',help:'Count every piece on the hub. A double or triple bond still counts once.',short:'Electron domains',miss:'the domain count',cols:6,handCols:3,
  options:()=>[1,2,3,4,5,6].map(n=>[String(n),String(n)])},
 {field:'shape',title:'What is the molecular shape?',help:'Name it from where the atoms are. Lone pairs are not part of the name.',short:'Molecular shape',miss:'the shape',cols:3,
  options:()=>[...$('shape').options].filter(o=>o.value).map(o=>[o.value,o.text])},
 {field:'dipole',title:'What is the result of adding the bond arrows?',help:'Each arrow points to the more electronegative atom.',short:'Bond-arrow result',miss:'the bond-arrow result',cols:1,handCols:2,
  options:()=>[...$('dipole').options].filter(o=>o.value).map(o=>[o.value,o.text])},
];
// Hand building has no typing: three two-way choices compose the Observe sentence.
export const REASON=[['The model angle',['stayed the same','changed']],['The on-screen angle',['stayed the same','changed']],['The screen shows',['a flat projection of a 3D angle','a different bond angle']]];
const KEYS=['7','8','9','del','4','5','6','1','2','3','0','.'];
const SHELF_PAGE=8;
export const hands=()=>main.classList.contains('hands-on');
const layout=()=>main.classList.contains('ms-hand-layout');
// One name for a gauge pair everywhere: the atoms, then the sites, e.g. "H–C–H · sites B and C".
// Each end is the atom bonded to the center (C for a CH₃ group); sites are in letter order.
export function anglePair(m,sites,first,second){
 const pair=[first,second].filter(l=>LETTERS.includes(l)).sort();
 if(pair.length<2||pair[0]===pair[1])return null;
 const end=l=>{const kind=sites?.[LETTERS.indexOf(l)];return kind==='pair'?'LP':m.pieces[kind]?.element||l;};
 const atoms=end(pair[0])+'–'+m.center+'–'+end(pair[1]),where='sites '+pair[0]+' and '+pair[1];
 return {atoms,sites:where,text:atoms+' · '+where};
}
export const angleName=(m,sites,first,second)=>anglePair(m,sites,first,second)?.text||'';
const reasonText=parts=>REASON.map(([label],i)=>`${label} ${parts[i]}.`).join(' ');
const reasonParts=text=>REASON.map(([label,opts])=>opts.find(o=>String(text||'').includes(`${label} ${o}.`))||null);
// Replace a group's buttons only when they change, so a hand that is aiming at one keeps it.
const paint=(el,html)=>{if(el._msHtml===html)return false;el._msHtml=html;el.innerHTML=html;return true;};

// api: {book, books, molecule, species, reference, observations, currentAngle, angleText, inspect, go, note, refresh}
export function createShapesUI(api){
 const ui={};
 // Desktop opens the first unanswered question; the hand layout always starts at question 1.
 const firstOpen=()=>hands()?0:Math.max(0,QUESTIONS.findIndex(q=>!api.book()[q.field]));
 const state=()=>{
  const s=ui[api.species()]??={hp:null,parts:reasonParts(api.book().reason),entry:''};
  if(s.hp==null)s.hp=firstOpen();
  return s;
 };
 const passed=id=>!!api.books[id]?.attempts.at(-1)?.result.pass;
 const fire=(el,type)=>el.dispatchEvent(new Event(type,{bubbles:true}));
 const set=(field,value)=>{const el=$(field);el.value=value;fire(el,'input');};
 const shelf={open:false,set:'',page:0};
 main.classList.add('ms-shapes-ready');
 $('next').setAttribute('aria-describedby','why-not');

 // ---------- Stage head: practice-set pills and formula buttons ----------
 function currentSet(){return $('vsepr-set')?.value||api.molecule().category;}
 function renderHead(){
  const set=currentSet(),id=api.species();
  const sets=SETS.filter(s=>[...$('vsepr-set').options].some(o=>o.value===s));
  const pills=$('ms-sets'),focused=pills.contains(document.activeElement);
  pills.innerHTML=sets.map(s=>`<button type="button" role="tab" aria-selected="${s===set}" tabindex="${s===set?0:-1}" data-set="${esc(s)}">${esc(s)}</button>`).join('');
  if(focused)pills.querySelector('[aria-selected=true]')?.focus({preventScroll:true});
  const mols=$('ms-mols'),had=mols.contains(document.activeElement)?document.activeElement.dataset.id:null;
  mols.innerHTML=[...$('species').options].filter(o=>!o.hidden).map(o=>{const m=MOLECULES[o.value],done=passed(o.value);
   return `<button type="button" data-id="${o.value}" aria-pressed="${o.value===id}" class="${done?'done':''}" title="${esc(m.name)}" aria-label="${esc(m.formula+' · '+m.name+(done?' · checked, matches':''))}">${esc(m.formula)}</button>`;}).join('');
  if(had)mols.querySelector(`[data-id="${had}"]`)?.focus({preventScroll:true});
 }
 function chooseSet(s){if(s===currentSet())return;$('vsepr-set').value=s;fire($('vsepr-set'),'change');render();}
 function chooseMolecule(id){if(id===api.species())return;$('species').value=id;fire($('species'),'change');}
 $('ms-sets').addEventListener('click',e=>{const b=e.target.closest('[data-set]');if(b)chooseSet(b.dataset.set);});
 $('ms-sets').addEventListener('keydown',e=>{
  const keys={ArrowRight:1,ArrowLeft:-1,Home:'first',End:'last'};if(!(e.key in keys))return;e.preventDefault();
  const all=[...$('ms-sets').querySelectorAll('[data-set]')],i=all.indexOf(e.target.closest('[data-set]'));
  const next=keys[e.key]==='first'?all[0]:keys[e.key]==='last'?all.at(-1):all[(i+keys[e.key]+all.length)%all.length];
  chooseSet(next.dataset.set);$('ms-sets').querySelector(`[data-set="${CSS.escape(next.dataset.set)}"]`)?.focus({preventScroll:true});
 });
 $('ms-mols').addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)chooseMolecule(b.dataset.id);});

 // ---------- Hand layout: paged molecule shelf over the model ----------
 const shelfIds=s=>[...$('species').options].map(o=>o.value).filter(id=>MOLECULES[id]?.category===s);
 function openShelf(open){
  if(open){
   const s=currentSet(),sets=SETS.includes(s)?s:api.molecule().category;
   shelf.set=sets;shelf.page=Math.max(0,Math.floor(shelfIds(sets).indexOf(api.species())/SHELF_PAGE));
  }
  const had=$('ms-shelf').contains(document.activeElement);
  shelf.open=open;renderShelf();renderBuildTiles();
  if(open)($('ms-shelf').querySelector('[data-shelf-mol][aria-pressed=true]')||$('ms-shelf').querySelector('button'))?.focus({preventScroll:true});
  else if(had)($('ms-build-tiles').querySelector('[data-ms-act=shelf]')||document.querySelector('[data-step]:not([hidden]) h2'))?.focus({preventScroll:true});
 }
 function renderShelf(){
  const el=$('ms-shelf'),show=shelf.open&&hands()&&api.book().step===0&&!api.reference();
  if(el.hidden===show)el.hidden=!show;
  if(!show){shelf.open=false;return;}
  const ids=shelfIds(shelf.set),pages=Math.max(1,Math.ceil(ids.length/SHELF_PAGE));
  shelf.page=Math.min(Math.max(0,shelf.page),pages-1);const p=shelf.page;
  paint(el,`<h2 id="ms-shelf-title">Choose a molecule</h2>
   <div class="ms-tiles" style="--cols:4" role="group" aria-label="Practice set">${SETS.map(s=>`<button type="button" class="ms-tile" data-shelf-set="${esc(s)}" aria-pressed="${s===shelf.set}">${esc(s)}</button>`).join('')}</div>
   <div class="ms-cards" role="group" aria-label="Molecules">${ids.slice(p*SHELF_PAGE,p*SHELF_PAGE+SHELF_PAGE).map(id=>{const m=MOLECULES[id],done=passed(id);
    return `<button type="button" class="ms-tile" data-shelf-mol="${id}" aria-pressed="${id===api.species()}" aria-label="${esc(m.formula+' · '+m.name+(done?' · checked, matches':''))}"><b>${esc(m.formula)}${done?' ✓':''}</b><span>${esc(m.name.split(' · ')[0])}</span></button>`;}).join('')}</div>
   <div class="ms-pager"><button type="button" class="ms-tile" data-shelf-page="-1"${p?'':' disabled'}>◂ Previous</button><span>Page ${p+1} of ${pages}</span><button type="button" class="ms-tile" data-shelf-page="1"${p<pages-1?'':' disabled'}>More ▸</button><button type="button" class="ms-tile" data-shelf-close>Close</button></div>`);
 }
 $('ms-shelf').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.shelfSet){shelf.set=b.dataset.shelfSet;shelf.page=0;renderShelf();$('ms-shelf').querySelector(`[data-shelf-set="${CSS.escape(shelf.set)}"]`)?.focus({preventScroll:true});return;}
  if(b.dataset.shelfPage){const k=b.dataset.shelfPage;shelf.page+=Number(k);renderShelf();
   const again=$('ms-shelf').querySelector(`[data-shelf-page="${k}"]:not(:disabled)`)||$('ms-shelf').querySelector('[data-shelf-mol]');again?.focus({preventScroll:true});return;}
  if(b.hasAttribute('data-shelf-close')){openShelf(false);return;}
  const id=b.dataset.shelfMol;if(!id)return;
  const chosen=shelf.set;shelf.open=false;
  // Choose the molecule first, then the set it belongs to, so the set change keeps this molecule.
  if(id!==api.species()){$('species').value=id;fire($('species'),'change');}
  if(currentSet()!==chosen){$('vsepr-set').value=chosen;fire($('vsepr-set'),'change');}
  render();
  document.querySelector('[data-step]:not([hidden]) h2')?.focus({preventScroll:true});
 });
 $('ms-shelf').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();openShelf(false);}});

 // ---------- View tools ----------
 function renderViews(){
  const view=$('view'),box=$('ms-views');
  const opts=[...view.options].filter(o=>!o.hidden);
  const sig=opts.map(o=>o.value+':'+o.text).join('|');
  if(box.dataset.sig!==sig){box.dataset.sig=sig;box.innerHTML=opts.map(o=>`<button type="button" data-view="${esc(o.value)}" aria-pressed="false">${esc(o.text)}</button>`).join('');}
  for(const b of box.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===view.value));
  const on=$('atoms').checked;
  for(const b of [$('ms-atoms'),$('ms-hand-atoms')])b.setAttribute('aria-pressed',String(on));
 }
 $('ms-views').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(!b)return;$('view').value=b.dataset.view;fire($('view'),'change');renderViews();});
 for(const id of ['ms-atoms','ms-hand-atoms'])$(id).addEventListener('click',()=>{$('atoms').click();renderViews();});
 $('ms-hand-fit').addEventListener('click',()=>$('fit').click());
 function renderCamera(){
  const api=main.labCamera;
  for(const b of document.querySelectorAll('[data-ms-camera]')){b.disabled=!api;b.setAttribute('aria-pressed',String(b.dataset.msCamera===(api?.mode||'move')));}
 }
 document.addEventListener('click',e=>{const b=e.target.closest('[data-ms-camera]');if(b&&main.labCamera){main.labCamera.command(b.dataset.msCamera);renderCamera();}});
 document.addEventListener('lab-camera-ready',renderCamera);

 // ---------- Build: hand tiles ----------
 function renderBuildTiles(){
  if(!hands()||api.book().step!==0)return;
  paint($('ms-build-tiles'),`<button type="button" class="ms-tile" data-ms-act="undo"${$('undo').disabled?' disabled':''}>Undo</button>`+
   `<button type="button" class="ms-tile" data-ms-act="shelf" aria-expanded="${shelf.open}" aria-controls="ms-shelf">Molecules</button>`);
 }
 $('ms-build-tiles').addEventListener('click',e=>{
  const b=e.target.closest('[data-ms-act]');if(!b||b.disabled)return;
  if(b.dataset.msAct==='undo')$('undo').click();
  else openShelf(!shelf.open);
 });

 // ---------- Predict: one question at a time; answered questions fold into rows ----------
 const answerText=(q,b)=>q.field==='dipole'?[...$('dipole').options].find(o=>o.value&&o.value===b.dipole)?.text||'':b[q.field]||'';
 function renderPredict(focus){
  const b=api.book(),s=state(),H=hands(),box=$('ms-predict');
  $('ms-predict-title').textContent=H?`Predict · question ${s.hp+1} of 3`:'Predict the structure';
  const question=(q,i)=>`<div class="ms-q" data-q="${i}"><h3 id="ms-q${i}">${H?'':(i+1)+'. '}${esc(q.title)}</h3><p class="ms-help">${esc(q.help)}</p>
   <div class="${H?'ms-tiles':'ms-chips'}" role="group" aria-labelledby="ms-q${i}" style="--cols:${H?q.handCols||Math.min(q.cols,3):q.cols}">${q.options().map(([v,l])=>`<button type="button" class="${H?'ms-tile':''}" data-answer="${esc(v)}" aria-pressed="${String(b[q.field])===v}">${esc(l)}</button>`).join('')}</div></div>`;
  paint(box,H?question(QUESTIONS[s.hp],s.hp):QUESTIONS.map((q,i)=>i===s.hp?question(q,i):
   `<button type="button" class="ms-qrow" data-open="${i}" aria-label="${esc((i+1)+'. '+q.short+': '+(answerText(q,b)||'not chosen yet')+'. Change')}"><span>${i+1}. ${esc(q.short)}</span><b>${esc(answerText(q,b))||'Not chosen yet'}</b></button>`).join(''));
  if(focus){const open=box.querySelector('.ms-q');(open?.querySelector('[aria-pressed=true]')||open?.querySelector('button'))?.focus({preventScroll:true});}
 }
 $('ms-predict').addEventListener('click',e=>{
  const s=state(),b=api.book();
  const row=e.target.closest('[data-open]');
  if(row){s.hp=Number(row.dataset.open);renderPredict(true);return;}
  const choice=e.target.closest('[data-answer]');if(!choice)return;
  const q=QUESTIONS[Number(choice.closest('[data-q]').dataset.q)];
  set(q.field,choice.dataset.answer);
  if(!hands()){const n=QUESTIONS.findIndex((x,i)=>i>s.hp&&!b[x.field]);if(n>=0)s.hp=n;}
  renderPredict(true);renderActions();
 });

 // ---------- Observe: gauge sites as buttons ----------
 function renderGauge(){
  const b=api.book(),m=api.molecule(),a=api.currentAngle(),box=$('ms-sites');
  const bonds=LETTERS.slice(0,m.domains).filter((_,i)=>isBond(b.sites[i]));
  const atom=l=>m.pieces[b.sites[LETTERS.indexOf(l)]]?.element||'';
  const sig=m.formula+bonds.map(l=>l+atom(l)).join('');
  if(box.dataset.sig!==sig){box.dataset.sig=sig;box.innerHTML=bonds.map(l=>`<button type="button" data-site="${l}" aria-pressed="false" aria-label="Site ${l}, ${esc(atom(l))} atom">${l}</button>`).join('');}
  for(const el of box.querySelectorAll('[data-site]'))el.setAttribute('aria-pressed',String(el.dataset.site===b.first||el.dataset.site===b.second));
  const named=a?anglePair(m,b.sites,a.first,a.second):null;
  $('ms-gauge-title').textContent='Angle gauge'+(named?' · '+named.text:'');
  // Until two views are recorded the blocked reason under the task says the same thing.
  const status=$('observation-status'),pair=b.step===2&&!!api.observations().pair;
  if(status.hidden===pair)status.hidden=!pair;
  const pill=$('ms-anglepill'),show=b.step===2&&!api.reference()&&!!a;
  pill.hidden=!show;
  if(show)pill.innerHTML=`${esc(named?.atoms)} <small>${esc(named?.sites)}</small> <span>model <b>${esc(api.angleText(a.value))}</b></span> <span>on screen <b>${esc(api.angleText(a.projected))}</b></span>`;
 }
 $('ms-sites').addEventListener('click',e=>{
  const el=e.target.closest('[data-site]');if(!el)return;const b=api.book(),L=el.dataset.site;
  if(L===b.first||L===b.second){api.note('Site '+L+' is already on the gauge. Choose a different atom to replace the other site.');return;}
  api.inspect(LETTERS.indexOf(L));renderGauge();renderActions();
 });

 // ---------- Observe in the hand layout: keypad, then three two-way reason rows ----------
 function renderHandObserve(){
  const b=api.book(),title=$('ms-observe-title');
  if(!hands()||b.step!==2){if(title.textContent!=='Inspect two views'){title.textContent='Inspect two views';title._msHtml=null;}return;}
  const s=state(),a=api.currentAngle(),o=api.observations(),m=api.molecule(),box=$('ms-observe-hands');
  const pair=a?anglePair(m,b.sites,a.first,a.second):null;
  const t=o.pair?'Observe · explain':'Observe · '+(pair?pair.atoms:'choose two atoms');
  const html=esc(t)+(!o.pair&&pair?` <small>${esc(pair.sites)}</small>`:'');
  if(title._msHtml!==html){title._msHtml=html;title.innerHTML=html;}
  if(!o.pair){
   paint(box,`<div class="ms-bigread"><div><small>Model angle</small><b data-read="model"></b></div><div><small>On screen</small><b data-read="screen"></b></div><div><small>Your entry</small><b data-read="entry"></b></div></div>
    <div class="ms-keypad" role="group" aria-label="Angle keypad">${KEYS.map(k=>`<button type="button" class="ms-tile" data-key="${k}" aria-label="${k==='del'?'Delete':k}">${k==='del'?'⌫':k}</button>`).join('')}<button type="button" class="ms-tile ms-go ms-rec" data-ms-act="record"${$('record').disabled?' disabled':''}>Record reading</button></div>`);
   const read={model:a?api.angleText(a.value):'None yet',screen:a?api.angleText(a.projected):'None yet',entry:(s.entry||'…')+'°'};
   for(const el of box.querySelectorAll('[data-read]'))if(el.textContent!==read[el.dataset.read])el.textContent=read[el.dataset.read];
  }else{
   const status='Two views recorded · '+o.pair.map(r=>api.angleText(r.projected)).join(' and ')+' on screen. Compare them with the 3D reading.';
   paint(box,`<p class="ms-hstatus">${esc(status)}</p>`+REASON.map(([label,opts],r)=>`<div class="ms-rowlabel" id="ms-reason${r}">${esc(label)}…</div>
    <div class="ms-tiles" role="group" aria-labelledby="ms-reason${r}">${opts.map(v=>`<button type="button" class="ms-tile" data-part="${r}" data-value="${esc(v)}" aria-pressed="${s.parts[r]===v}">${esc(v)}</button>`).join('')}</div>`).join(''));
  }
 }
 $('ms-observe-hands').addEventListener('click',e=>{
  const btn=e.target.closest('button');if(!btn||btn.disabled)return;
  const s=state(),b=api.book();
  if(btn.dataset.key){const k=btn.dataset.key;s.entry=k==='del'?s.entry.slice(0,-1):(s.entry+k).slice(0,5);renderHandObserve();return;}
  if(btn.dataset.msAct==='record'){
   const before=b.angles.length;$('angle-entry').value=s.entry;$('record').click();
   if(api.book().angles.length>before)s.entry='';
   renderHandObserve();renderActions();return;
  }
  if(btn.dataset.part){
   s.parts[Number(btn.dataset.part)]=btn.dataset.value;
   if(s.parts.every(Boolean))set('reason',reasonText(s.parts));
   renderHandObserve();renderActions();
   $('ms-observe-hands').querySelector(`[data-part="${btn.dataset.part}"][aria-pressed=true]`)?.focus({preventScroll:true});
  }
 });

 // ---------- Compare ----------
 function renderCompare(){
  const b=api.book(),attempt=b.attempts.at(-1),ref=api.reference();
  $('result-body').hidden=ref;
  $('ms-revise').hidden=!(b.step===3&&attempt?.result.pass);
  // Hand building cannot reach the Bond arrows checkbox; this tile writes it.
  const arrows=$('ms-hand-arrows');arrows.hidden=!ref;arrows.setAttribute('aria-pressed',String($('arrows').checked));
 }
 $('ms-revise').addEventListener('click',()=>api.go(0));
 $('ms-hand-arrows').addEventListener('click',()=>{$('arrows').click();renderCompare();});

 // ---------- Main button and its blocked reason ----------
 function whyNot(){
  const b=api.book(),H=hands(),s=state();
  if(b.step===0)return b.sites.filter(isBond).length<2?'Seat at least two bond pieces so the angle gauge can measure a bond angle.':'';
  if(b.step===1){
   const miss=QUESTIONS.map(q=>!b[q.field]&&q.miss);
   if(H&&s.hp<2)return miss[s.hp]?'Choose '+miss[s.hp]+'.':'';
   const left=miss.filter(Boolean);return left.length?'Still to choose: '+left.join(', ')+'.':'';
  }
  if(b.step===2){
   const o=api.observations();
   if(!o.pair)return o.readings.length?'Turn the model at least 12° or choose another view, then record this pair again.':'Record the first reading with the angle gauge.';
   if(!b.reason.trim())return H?'Choose one answer in each row.':'Write what you observed in the two views.';
  }
  return '';
 }
 function renderActions(){
  const b=api.book(),s=state(),w=whyNot(),pass=b.step===3&&!!b.attempts.at(-1)?.result.pass;
  if($('why-not').textContent!==w)$('why-not').textContent=w;
  $('next').setAttribute('aria-disabled',String(!!w));
  const label=b.step===1&&hands()&&s.hp<2?'Next question':['Continue to Predict','Save prediction','Check attempt',pass?'Next molecule':'Revise assembly'][b.step];
  if($('next').textContent!==label)$('next').textContent=label;
  $('back').hidden=!(b.step||(hands()&&b.step===1&&s.hp));
 }
 // Hand layout asks the three Predict questions one at a time.
 let held=null;
 $('next').addEventListener('click',e=>{
  const b=api.book(),s=state(),w=hands()?whyNot():'';
  held=w?{text:w,species:api.species(),step:b.step}:null;
  if(!(hands()&&b.step===1&&s.hp<2))return;
  e.stopImmediatePropagation();held=null;
  if(w){api.note(w);return;}
  s.hp++;api.note('');renderPredict(false);renderActions();
 });
 // A held step still logs its real reason in the field notes; hand users then see the
 // reason that matches their tiles (no typing, no question list).
 document.addEventListener('click',e=>{
  const h=held;held=null;
  if(h&&e.target.closest?.('#next')&&api.species()===h.species&&api.book().step===h.step)api.note(h.text);
 });
 $('back').addEventListener('click',e=>{
  const b=api.book(),s=state();
  if(!(hands()&&b.step===1&&s.hp>0))return;
  e.stopImmediatePropagation();s.hp--;renderPredict(false);renderActions();
 });

 // ---------- Steps, titles, footer count ----------
 function renderFrame(){
  const b=api.book(),m=api.molecule();
  [...$('steps').children].forEach((li,i)=>{const t=i<b.step?'✓':String(i+1),el=li.querySelector('i');if(el.textContent!==t)el.textContent=t;});
  $('ms-stage-sub').textContent=api.reference()?'Reference model':'Your assembly';
  const n=b.events.length+b.angles.length+b.attempts.length;
  $('ms-notes-count').textContent=n?String(n):'';
  $('ms-handsub').textContent='Hand building · '+m.formula+' '+m.name;
 }

 // Bond workshop opens only when the learner opens it; it no longer covers Build on its own.
 const workshop=$('vsepr-workshop');let wanted=false;
 if(workshop){
  workshop.querySelector('summary').addEventListener('click',()=>{wanted=!workshop.open;});
  workshop.addEventListener('toggle',()=>{if(workshop.open&&!wanted)workshop.open=false;else wanted=workshop.open;});
 }

 // Typing in the reason box updates the blocked reason; app.js stores the text first.
 document.addEventListener('input',e=>{if(e.target.id==='reason')renderActions();});

 // ---------- Hand layout: one big status line ----------
 // The coach line is hidden in the hand layout. When its text changes, it becomes the hand bar's
 // status; hand tracking then replaces it with what the hand is aiming at, as in the mock.
 let lastCoach='';
 const coachText=()=>($('notice').textContent.trim()||$('live-guide').textContent.trim());
 // A held action always shows, even when it repeats; a guide line shows only when it changes,
 // so routine re-renders do not cover what the hand is doing.
 function mirrorCoach(fromNotice){
  const bar=main.querySelector('.hand-bar'),status=bar?.querySelector('[role=status]');
  if(!status||!layout())return;
  const warn=!!$('notice').textContent.trim(),text=coachText();
  if(!text||(text===lastCoach&&!(fromNotice&&warn)))return;
  lastCoach=text;status.textContent=text;bar.classList.toggle('ms-warn',warn);
 }
 new MutationObserver(()=>mirrorCoach(false)).observe($('live-guide'),{childList:true,characterData:true,subtree:true});
 new MutationObserver(()=>mirrorCoach(true)).observe($('notice'),{childList:true,characterData:true,subtree:true});
 const watchStatus=()=>{
  const bar=main.querySelector('.hand-bar'),status=bar?.querySelector('[role=status]');
  if(!status||status._msWatched)return;status._msWatched=true;
  new MutationObserver(()=>{if(status.textContent!==lastCoach)bar.classList.remove('ms-warn');}).observe(status,{childList:true,characterData:true,subtree:true});
 };
 // Entering or leaving hand building switches wording, Predict paging and the tiles.
 let wasHands=hands(),wasLayout=layout();
 new MutationObserver(()=>{
  const h=hands(),l=layout();if(h===wasHands&&l===wasLayout)return;
  if(h!==wasHands)for(const s of Object.values(ui))s.hp=null;
  wasHands=h;wasLayout=l;shelf.open=false;
  if(l){watchStatus();lastCoach=coachText();}
  api.refresh?.();
 }).observe(main,{attributes:true,attributeFilter:['class']});

 // Help lists this molecule's kit: its atoms and the pieces the tray supplies.
 function renderKitHelp(){
  const box=document.querySelector('.vsepr-kit-inventory'),m=api.molecule();if(!box)return;
  const span=box.querySelector('summary span');if(span&&span.textContent!==m.formula)span.textContent=m.formula;
  const atoms=new Set([m.center,...m.ligands.flatMap(p=>p.group?[p.element,'H']:[p.element])]);
  for(const el of box.querySelectorAll('.vsepr-element'))el.hidden=!atoms.has(el.querySelector('i')?.textContent);
  let list=box.querySelector('.ms-kitparts');
  if(!list){list=document.createElement('ul');list.className='ms-kitparts';box.querySelector('.vsepr-elements')?.after(list);}
  paint(list,Object.entries(m.pieces).map(([kind,p])=>`<li>${p.count} × ${esc(partLabel(m,kind).split(' · ')[0])} piece${p.count===1?'':'s'}${p.role?' · '+esc(p.role):''}</li>`).join('')+
   (m.pairs?`<li>${m.pairs} × lone-pair insert${m.pairs===1?'':'s'}</li>`:''));
 }
 function render(){
  const b=api.book(),s=state();
  if(b.step!==1)s.hp=firstOpen();
  renderHead();renderFrame();renderViews();renderCamera();renderKitHelp();
  if(b.step===1)renderPredict(false);
  renderBuildTiles();renderGauge();renderHandObserve();renderCompare();renderShelf();renderActions();
  document.dispatchEvent(new Event('b06-shapes'));
 }
 // After a match: the next molecule in this set not yet passed (wrapping), else the first one
 // not passed in the following sets, in pill order. Null when every molecule has passed.
 function nextMolecule(){
  const id=api.species(),all=[...$('species').options].map(o=>o.value);
  // Sets in the order of the set pills.
  const sets=SETS.filter(s=>[...$('vsepr-set').options].some(o=>o.value===s));
  const here=sets.includes(currentSet())?currentSet():api.molecule().category;
  const ids=all.filter(x=>MOLECULES[x].category===here),i=ids.indexOf(id);
  const inSet=[...ids.slice(i+1),...ids.slice(0,Math.max(0,i))].find(x=>!passed(x));
  if(inSet)return inSet;
  const k=sets.indexOf(here);
  for(const s of [...sets.slice(k+1),...sets.slice(0,k)]){const x=all.find(x=>MOLECULES[x].category===s&&!passed(x));if(x)return x;}
  return null;
 }
 return {
  render,nextMolecule,
  // Live readings: the camera moved or the gauge changed.
  instrument(){renderGauge();renderViews();renderHandObserve();},
  sync(){renderGauge();renderHandObserve();renderActions();renderFrame();},
  coach(b,reference){
   const H=hands();
   if(reference)return 'Reference assembly · ideal site directions.';
   if(b.step===0)return H?'Aim at a kit piece. Close your hand to carry it, open over a socket to let go.':'Drag a kit piece to a lettered socket. Drag open space to turn the hub.';
   if(b.step===2)return H?(api.observations().pair?'Two views recorded. Choose one answer in each row.':'Enter the model angle on the keypad. Grab two atoms to change the pair, or open space to turn the model.'):'Choose two bonded atoms and record their model angle. Then turn the model and record the same pair again.';
   if(b.step===3)return b.attempts.at(-1)?.result.pass?'Checked: your model and predictions match. Inspect the reference model, or go on to the next molecule.':'Checked. Inspect the reference model, or revise and try again.';
   return H?'Aim at an answer. Close and open your hand to choose it.':'Drag open space or use the arrow keys to turn the model.';
  },
  trayNote(b,reference){return b.step!==0||reference?'Pieces can be changed in Build.':hands()?'Close your hand on a piece to carry it.':'Drag a piece to a socket, or press it and then a socket.';},
  state,whyNot,
 };
}
